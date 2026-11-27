import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { FACEBOOK_RATIO_PRESETS, STANDARDS_BUNDLE_VERSION } from '../constants/platformRegistry';
import type {
  DesignGroupId,
  ExportManifestEntry,
  FacebookRatioKey,
  GroupImageAsset,
  GroupRuntimeSettings,
  OutputFileFormat,
  PlatformStandardEntry,
  QueueProgressState,
  SmartExportSelection,
} from '../types/multichannel';
import type { StudioConfig } from '../types/studio';
import {
  encodeCanvasWithLimit,
  isSlideMissingVerifiedData,
  renderGroupSlideCanvas,
} from './multiChannelRenderer';
import { validateGroupAsset } from './validationEngine';

export function slugifyAscii(input: string, maxLen = 40): string {
  const cleaned = (input || 'VUTECH')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
  return (cleaned || 'SANPHAM').slice(0, maxLen);
}

export function buildSkuSlug(config: StudioConfig): string {
  const raw = config.modelCode?.trim() || config.productName?.trim() || 'SKU';
  return slugifyAscii(raw, 28).toUpperCase();
}

export function buildSeoFileName(params: {
  config: StudioConfig;
  groupSlug: string;
  slotIndex: number;
  width: number;
  height: number;
  format: OutputFileFormat;
  isWebSeo?: boolean;
  slideShortTitle?: string;
}): string {
  const sku = buildSkuSlug(params.config);
  const stt = String(params.slotIndex).padStart(2, '0');
  const dims = `${params.width}x${params.height}`;
  const ext = params.format === 'jpg' ? 'jpg' : params.format;
  if (params.isWebSeo) {
    const productSlug = slugifyAscii(params.config.productName || 'thiet-bi-loc-nuoc', 36).toLowerCase().replace(/_/g, '-');
    return `VUTECH_${sku}_${params.groupSlug}_${stt}_${productSlug}_${dims}.${ext}`;
  }
  return `VUTECH_${sku}_${params.groupSlug}_${stt}_${dims}.${ext}`;
}

export function buildAltText(config: StudioConfig, slideTitle: string): string {
  const parts = [
    config.productName?.trim() || 'Thiết bị lọc nước VUTECH',
    config.modelCode?.trim() ? `Model ${config.modelCode.trim()}` : '',
    slideTitle.replace(/^\d+\.\s*/, ''),
    'Công ty TNHH XNK VUTECH',
  ].filter(Boolean);
  return parts.join(' - ');
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Release Blob URL cleanly after browser starts download
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function buildCsvReport(entries: ExportManifestEntry[]): string {
  const headers = [
    'Ma_SKU',
    'Ten_San_Pham',
    'Nhom_Thiet_Ke',
    'Thu_Muc',
    'Ten_File',
    'Kich_Thuoc_Thuc_Te',
    'Dung_Luong_KB',
    'Dinh_Dang',
    'Trang_Thai_Kiem_Tra',
    'Ghi_Chu_Kiem_Tra',
    'Phien_Ban_Quy_Chuan',
    'ALT_TEXT',
  ];

  const escapeCsv = (val: string | number) => {
    const s = String(val ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const rows = entries.map((e) =>
    [
      e.sku,
      e.productName,
      e.groupName,
      e.folderPath,
      e.fileName,
      `${e.width}x${e.height}`,
      e.fileSizeKB,
      e.format.toUpperCase(),
      e.validationStatus,
      e.validationSummary,
      e.standardVersion,
      e.altText,
    ]
      .map(escapeCsv)
      .join(',')
  );

  // UTF-8 BOM so Microsoft Excel renders Vietnamese diacritics accurately
  return `\uFEFF${[headers.join(','), ...rows].join('\n')}`;
}

export interface ExportQueueController {
  isPaused: () => boolean;
  isCancelled: () => boolean;
}

async function yieldToFrame(): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, 12));
}

async function waitWhilePaused(ctrl?: ExportQueueController): Promise<boolean> {
  if (!ctrl) return true;
  while (ctrl.isPaused()) {
    if (ctrl.isCancelled()) return false;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  }
  return !ctrl.isCancelled();
}

export interface PlannedExportUnit {
  groupId: DesignGroupId;
  standard: PlatformStandardEntry;
  asset: GroupImageAsset;
  folderPath: string;
  fileGroupSlug: string;
  width: number;
  height: number;
  aspectRatioLabel: string;
  ratioKey?: FacebookRatioKey;
  format: OutputFileFormat;
  quality: number;
  maxSizeKB: number | null;
}

/**
 * Computes the exact list of files to be generated & packaged for any export mode,
 * supporting dynamic counts (e.g., 10 watermark images, 5×4=20 Facebook files, etc.).
 */
export function buildExportPlan(params: {
  selection: SmartExportSelection;
  registry: PlatformStandardEntry[];
  settingsByGroup: Record<DesignGroupId, GroupRuntimeSettings>;
  assetsByGroup: Record<DesignGroupId, GroupImageAsset[]>;
}): PlannedExportUnit[] {
  const { selection, registry, settingsByGroup, assetsByGroup } = params;
  const plan: PlannedExportUnit[] = [];

  for (const groupId of selection.selectedGroupIds) {
    const standard = registry.find((r) => r.id === groupId);
    if (!standard) continue;
    const gSettings = settingsByGroup[groupId];
    const allAssets = (assetsByGroup[groupId] ?? []).filter((a) => !a.skipped);

    const pickedAssets =
      selection.selectedAssetIds.length > 0
        ? allAssets.filter((a) => selection.selectedAssetIds.includes(a.id))
        : allAssets;

    const chosenFormat: OutputFileFormat =
      selection.overrideFormat && selection.overrideFormat !== 'group-default'
        ? selection.overrideFormat
        : gSettings.format;
    const chosenQuality = selection.overrideQuality ?? gSettings.quality;
    const chosenMaxKB =
      selection.overrideMaxSizeKB !== undefined
        ? selection.overrideMaxSizeKB
        : gSettings.enforceMaxSizeKB;

    if (groupId === '04_facebook_ads') {
      const ratios: FacebookRatioKey[] =
        selection.facebookRatiosOverride && selection.facebookRatiosOverride.length > 0
          ? selection.facebookRatiosOverride
          : gSettings.facebookRatios.length > 0
          ? gSettings.facebookRatios
          : ['4:5'];

      for (const ratioKey of ratios) {
        const preset =
          FACEBOOK_RATIO_PRESETS.find((r) => r.key === ratioKey) ?? FACEBOOK_RATIO_PRESETS[0];
        for (const asset of pickedAssets) {
          if (isSlideMissingVerifiedData(asset)) continue;
          plan.push({
            groupId,
            standard,
            asset,
            folderPath: `${standard.folderName}/${preset.subFolder}`,
            fileGroupSlug: preset.fileSlug,
            width: preset.width,
            height: preset.height,
            aspectRatioLabel: preset.key,
            ratioKey: preset.key,
            format: chosenFormat === 'pdf' ? 'jpg' : chosenFormat,
            quality: chosenQuality,
            maxSizeKB: chosenMaxKB,
          });
        }
      }
    } else {
      const sizeOpt =
        standard.sizeOptions.find((s) => s.id === gSettings.sizeId) ?? standard.sizeOptions[0];

      for (const asset of pickedAssets) {
        if (isSlideMissingVerifiedData(asset)) continue;
        plan.push({
          groupId,
          standard,
          asset,
          folderPath: standard.folderName,
          fileGroupSlug: standard.fileGroupSlug,
          width: sizeOpt.width,
          height: sizeOpt.height,
          aspectRatioLabel: sizeOpt.aspectRatio,
          format: chosenFormat === 'pdf' ? 'png' : chosenFormat,
          quality: chosenQuality,
          maxSizeKB: chosenMaxKB,
        });
      }
    }
  }

  return plan;
}

export function estimatePlanSizeKB(plan: PlannedExportUnit[]): number {
  return plan.reduce((acc, unit) => {
    if (unit.asset.fileSizeBytes > 0) {
      return acc + Math.round(unit.asset.fileSizeBytes / 1024);
    }
    if (unit.format === 'webp') return acc + 280;
    if (unit.format === 'png') return acc + 1150;
    return acc + 480;
  }, 0);
}

/**
 * Executes real smart export: single file, group ZIP, multi-group ZIP with exact VUTECH_[SKU] folder tree,
 * manifest.json + bao_cao_xuat_anh.csv, and optional Technical PDF for Group 05.
 * Zero AI API calls — 100% Canvas rendering + client-side compression.
 */
export async function executeSmartExport(params: {
  selection: SmartExportSelection;
  registry: PlatformStandardEntry[];
  settingsByGroup: Record<DesignGroupId, GroupRuntimeSettings>;
  assetsByGroup: Record<DesignGroupId, GroupImageAsset[]>;
  studioConfig: StudioConfig;
  concurrency?: number;
  controller?: ExportQueueController;
  onProgress: (state: QueueProgressState) => void;
}): Promise<{ exportedCount: number; skippedInvalidCount: number; zipFileName: string }> {
  const {
    selection,
    registry,
    settingsByGroup,
    assetsByGroup,
    studioConfig,
    concurrency = 2,
    controller,
    onProgress,
  } = params;

  const plan = buildExportPlan({ selection, registry, settingsByGroup, assetsByGroup });
  const sku = buildSkuSlug(studioConfig);
  const errors: string[] = [];

  if (plan.length === 0) {
    onProgress({
      stage: 'failed',
      total: 0,
      completed: 0,
      failed: 0,
      currentLabel: 'Không có ảnh hợp lệ nào được chọn để xuất.',
      concurrency,
      errors: ['Không có ảnh hợp lệ để xuất (kiểm tra các ảnh thiếu dữ liệu kỹ thuật hoặc bị bỏ qua).'],
    });
    return { exportedCount: 0, skippedInvalidCount: 0, zipFileName: '' };
  }

  onProgress({
    stage: 'waiting',
    total: plan.length,
    completed: 0,
    failed: 0,
    currentLabel: `Chuẩn bị xuất ${plan.length} tệp ảnh...`,
    concurrency,
    errors: [],
  });

  const renderedResults: Array<{
    unit: PlannedExportUnit;
    blob: Blob;
    dataUrl: string;
    fileName: string;
    actualWidth: number;
    actualHeight: number;
    actualFormat: OutputFileFormat;
    manifest: ExportManifestEntry;
  }> = [];

  const usedNames = new Set<string>();
  let completed = 0;
  let failed = 0;
  let skippedInvalidCount = 0;

  // Concurrency-controlled worker pool (default 2 tasks)
  let nextIdx = 0;
  const worker = async () => {
    while (nextIdx < plan.length) {
      const okToContinue = await waitWhilePaused(controller);
      if (!okToContinue) return;

      const idx = nextIdx++;
      const unit = plan[idx];
      const offscreen = document.createElement('canvas');

      try {
        onProgress({
          stage: 'generating',
          total: plan.length,
          completed,
          failed,
          currentLabel: `Đang kết xuất ${unit.standard.shortName} #${unit.asset.slotIndex} (${unit.aspectRatioLabel})...`,
          concurrency,
          errors: [...errors],
        });

        const dims = await renderGroupSlideCanvas({
          canvas: offscreen,
          groupId: unit.groupId,
          asset: unit.asset,
          standard: unit.standard,
          settings: settingsByGroup[unit.groupId],
          studioConfig,
          overrideDimensions:
            unit.width > 0 && unit.height > 0
              ? {
                  width: unit.width,
                  height: unit.height,
                  aspectLabel: unit.aspectRatioLabel,
                  ratioKey: unit.ratioKey,
                }
              : undefined,
        });

        await yieldToFrame();

        onProgress({
          stage: 'optimizing',
          total: plan.length,
          completed,
          failed,
          currentLabel: `Đang tối ưu dung lượng ${unit.standard.shortName} #${unit.asset.slotIndex}...`,
          concurrency,
          errors: [...errors],
        });

        const encoded = await encodeCanvasWithLimit({
          canvas: offscreen,
          format: unit.format,
          initialQuality: unit.quality,
          maxFileSizeKB: unit.maxSizeKB,
        });

        onProgress({
          stage: 'validating',
          total: plan.length,
          completed,
          failed,
          currentLabel: `Đang kiểm tra quy chuẩn ${unit.standard.shortName} #${unit.asset.slotIndex}...`,
          concurrency,
          errors: [...errors],
        });

        const validation = validateGroupAsset({
          asset: {
            ...unit.asset,
            status: 'ready',
            renderedWidth: dims.width,
            renderedHeight: dims.height,
            fileSizeBytes: encoded.blob.size,
            format: encoded.format,
            mimeType: encoded.mimeType,
          },
          standard: unit.standard,
          settings: settingsByGroup[unit.groupId],
          studioConfig,
          totalActiveInGroup: (assetsByGroup[unit.groupId] ?? []).filter((a) => !a.skipped).length,
          expectedWidth: unit.width || undefined,
          expectedHeight: unit.height || undefined,
          expectedAspectRatio: unit.aspectRatioLabel,
        });

        if (selection.includeOnlyCompliant && !validation.canExportAsPlatformCompliant) {
          skippedInvalidCount++;
          errors.push(
            `Bỏ qua ${unit.standard.shortName} #${unit.asset.slotIndex}: ${validation.summary}`
          );
          completed++;
          continue;
        }

        if (encoded.hitQualityFloor && unit.maxSizeKB) {
          errors.push(
            `Cảnh báo dung lượng ${unit.standard.shortName} #${unit.asset.slotIndex}: không thể giảm thêm dưới ${unit.maxSizeKB} KB mà vẫn giữ độ nét tối thiểu.`
          );
        }

        // Deduplicated ASCII file name strictly following VUTECH_[SKU]_[NHOM]_[STT]_[KICH-THUOC].[DINH-DANG]
        let fileName = buildSeoFileName({
          config: studioConfig,
          groupSlug: unit.fileGroupSlug,
          slotIndex: unit.asset.slotIndex,
          width: dims.width,
          height: dims.height,
          format: encoded.format,
          isWebSeo: unit.groupId === '03_web_clean',
          slideShortTitle: unit.asset.shortTitle,
        });
        const uniqueKey = `${unit.folderPath}/${fileName}`;
        if (usedNames.has(uniqueKey)) {
          const dotIdx = fileName.lastIndexOf('.');
          fileName = `${fileName.slice(0, dotIdx)}_${idx + 1}${fileName.slice(dotIdx)}`;
        }
        usedNames.add(`${unit.folderPath}/${fileName}`);

        const manifest: ExportManifestEntry = {
          sku,
          productName: studioConfig.productName || 'Thiết bị lọc nước VUTECH',
          groupId: unit.groupId,
          groupName: unit.standard.name,
          folderPath: `VUTECH_${sku}/${unit.folderPath}`,
          fileName,
          width: dims.width,
          height: dims.height,
          fileSizeBytes: encoded.blob.size,
          fileSizeKB: Math.round((encoded.blob.size / 1024) * 10) / 10,
          format: encoded.format,
          validationStatus: validation.status,
          validationSummary: validation.summary,
          standardVersion: unit.standard.standardVersion || STANDARDS_BUNDLE_VERSION,
          altText: buildAltText(studioConfig, unit.asset.title),
        };

        renderedResults.push({
          unit,
          blob: encoded.blob,
          dataUrl: encoded.dataUrl,
          fileName,
          actualWidth: dims.width,
          actualHeight: dims.height,
          actualFormat: encoded.format,
          manifest,
        });

        completed++;
      } catch (err) {
        failed++;
        errors.push(
          `Lỗi xuất ${unit.standard.shortName} #${unit.asset.slotIndex}: ${
            err instanceof Error ? err.message : 'Không xác định'
          }`
        );
      } finally {
        // Explicit canvas memory release
        offscreen.width = 0;
        offscreen.height = 0;
        await yieldToFrame();
      }
    }
  };

  const workers = Array.from({ length: Math.max(1, Math.min(3, concurrency)) }, () => worker());
  await Promise.all(workers);

  if (controller?.isCancelled()) {
    onProgress({
      stage: 'cancelled',
      total: plan.length,
      completed,
      failed,
      currentLabel: 'Đã hủy tác vụ xuất ảnh.',
      concurrency,
      errors,
    });
    return { exportedCount: 0, skippedInvalidCount, zipFileName: '' };
  }

  if (renderedResults.length === 0) {
    onProgress({
      stage: 'failed',
      total: plan.length,
      completed,
      failed,
      currentLabel: 'Không có ảnh nào đạt điều kiện xuất.',
      concurrency,
      errors,
    });
    return { exportedCount: 0, skippedInvalidCount, zipFileName: '' };
  }

  // Case 1: Single file download (no ZIP needed unless PDF requested)
  const shouldGenerateIndustrialPdf =
    selection.exportIndustrialAsPdf &&
    renderedResults.some((r) => r.unit.groupId === '05_industrial_tech');

  if (selection.mode === 'single' && renderedResults.length === 1 && !shouldGenerateIndustrialPdf) {
    const single = renderedResults[0];
    triggerBlobDownload(single.blob, single.fileName);
    onProgress({
      stage: 'completed',
      total: plan.length,
      completed: plan.length,
      failed,
      currentLabel: `Đã tải xuống ${single.fileName}`,
      concurrency,
      errors,
    });
    return { exportedCount: 1, skippedInvalidCount, zipFileName: single.fileName };
  }

  // Case 2: Package ZIP with exact folder hierarchy VUTECH_[SKU]/... + manifest.json + CSV + optional Technical PDF
  onProgress({
    stage: 'packaging',
    total: plan.length,
    completed,
    failed,
    currentLabel: `Đang đóng gói ${renderedResults.length} ảnh vào tệp ZIP chuẩn thư mục...`,
    concurrency,
    errors,
  });

  const zip = new JSZip();
  const rootFolder = zip.folder(`VUTECH_${sku}`);

  for (const res of renderedResults) {
    const targetFolder = rootFolder?.folder(res.unit.folderPath);
    targetFolder?.file(res.fileName, res.blob);
  }

  // Optional Technical PDF combining all Group 05 slides into one multi-page engineering datasheet PDF
  if (shouldGenerateIndustrialPdf) {
    const techSlides = renderedResults
      .filter((r) => r.unit.groupId === '05_industrial_tech')
      .sort((a, b) => a.unit.asset.slotIndex - b.unit.asset.slotIndex);

    if (techSlides.length > 0) {
      const first = techSlides[0];
      const orientation = first.actualWidth >= first.actualHeight ? 'landscape' : 'portrait';
      const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [first.actualWidth, first.actualHeight],
        compress: true,
      });

      techSlides.forEach((slide, i) => {
        if (i > 0) {
          pdf.addPage([slide.actualWidth, slide.actualHeight], slide.actualWidth >= slide.actualHeight ? 'landscape' : 'portrait');
        }
        const pdfImgType = slide.actualFormat === 'jpg' ? 'JPEG' : 'PNG';
        pdf.addImage(slide.dataUrl, pdfImgType, 0, 0, slide.actualWidth, slide.actualHeight);
      });

      const pdfBlob = pdf.output('blob');
      const pdfName = `VUTECH_${sku}_TAILIEU_KYTHUAT.pdf`;
      rootFolder?.folder('05_KY_THUAT_CONG_NGHIEP')?.file(pdfName, pdfBlob);
    }
  }

  if (selection.includeManifestAndCsv) {
    const manifestEntries = renderedResults.map((r) => r.manifest);
    const manifestPayload = {
      generatedAt: new Date().toISOString(),
      company: studioConfig.companyName || 'CÔNG TY TNHH XNK VUTECH',
      sku,
      productName: studioConfig.productName,
      standardVersion: STANDARDS_BUNDLE_VERSION,
      totalFiles: manifestEntries.length,
      skippedInvalidCount,
      files: manifestEntries,
    };
    rootFolder?.file('manifest.json', JSON.stringify(manifestPayload, null, 2));
    rootFolder?.file('bao_cao_xuat_anh.csv', buildCsvReport(manifestEntries));
  }

  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const zipFileName = `VUTECH_${sku}_${selection.selectedGroupIds.length === 1 ? renderedResults[0].unit.standard.fileGroupSlug : 'BO_DA_KENH'}.zip`;
  triggerBlobDownload(zipBlob, zipFileName);

  onProgress({
    stage: 'completed',
    total: plan.length,
    completed: plan.length,
    failed,
    currentLabel: `Hoàn thành xuất ${renderedResults.length} ảnh (${zipFileName}).`,
    concurrency,
    errors,
  });

  return {
    exportedCount: renderedResults.length,
    skippedInvalidCount,
    zipFileName,
  };
}
