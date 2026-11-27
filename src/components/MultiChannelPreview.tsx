import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  FileWarning,
  FolderArchive,
  Globe,
  Grid,
  Layers,
  Lock,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Square,
  XCircle,
} from 'lucide-react';
import {
  createDefaultGroupSettings,
  FACEBOOK_RATIO_PRESETS,
  loadPlatformRegistry,
  savePlatformRegistry,
} from '../constants/platformRegistry';
import type {
  DesignGroupId,
  ExportMode,
  GroupImageAsset,
  GroupRuntimeSettings,
  PlatformStandardEntry,
  QueueProgressState,
  QueueStage,
  ValidationStatus,
} from '../types/multichannel';
import type { ExportFormat, StudioConfig, TemplateId } from '../types/studio';
import {
  encodeCanvasWithLimit,
  isSlideMissingVerifiedData,
  renderGroupSlideCanvas,
} from '../utils/multiChannelRenderer';
import { buildAltText, buildSeoFileName } from '../utils/smartExportEngine';
import {
  enrichTechnicalDocsFromFile,
  enrichTechnicalDocsOnline,
  type TechnicalDocEnrichmentResult,
} from '../utils/technicalDocEnricher';
import { createPendingValidation, validateGroupAsset } from '../utils/validationEngine';
import { GroupGalleryModal } from './GroupGalleryModal';
import { PlatformStandardsManager } from './PlatformStandardsManager';
import { SmartExportModal } from './SmartExportModal';

interface MultiChannelPreviewProps {
  config: StudioConfig;
  batchItems: Array<{ id: string; config: StudioConfig }>;
  activeItemId: string;
  onSelectBatchItem: (id: string) => void;
  exportFormat: ExportFormat;
  onUpdateConfig?: (patch: Partial<StudioConfig>) => void;
  onOpenInEditor: (patch: Partial<StudioConfig>) => void;
}

function buildInitialAssetsForGroup(
  standard: PlatformStandardEntry,
  settings: GroupRuntimeSettings,
  studioConfig: StudioConfig,
  batchItems: Array<{ id: string; config: StudioConfig }>,
  existing?: GroupImageAsset[],
  cachedTechNotesBySlideKey?: Record<string, string>
): GroupImageAsset[] {
  const sizeObj =
    standard.sizeOptions.find((s) => s.id === settings.sizeId) ?? standard.sizeOptions[0];

  // Group 07: Dynamic N input images -> N output images (seeded from batchItems + preserves any extra uploaded files)
  if (standard.id === '07_copyright_watermark') {
    const existingExtra = (existing ?? []).filter((a) => a.id.startsWith('wm-extra-'));
    const existingByBatchKey = new Map(
      (existing ?? []).map((a) => [a.slideKey, a])
    );

    const fromBatch: GroupImageAsset[] = batchItems.map((item, idx) => {
      const key = `wm-batch-${item.id}`;
      const prev = existingByBatchKey.get(key);
      if (prev && prev.approved) {
        return { ...prev, slotIndex: idx + 1 };
      }
      const sameSource = prev?.customSourceUrl === item.config.sourceImageUrl;
      return {
        id: prev?.id ?? `07_copyright_watermark__${key}`,
        groupId: '07_copyright_watermark',
        slotIndex: idx + 1,
        slideKey: key,
        title: `Ảnh bản quyền #${String(idx + 1).padStart(2, '0')} · ${item.config.productName || 'Sản phẩm'}`,
        shortTitle: item.config.productName || `Ảnh #${idx + 1}`,
        description: 'Giữ nguyên tỷ lệ & độ phân giải gốc, đóng dấu bản quyền VUTECH bằng Canvas.',
        status: sameSource && prev?.previewDataUrl ? prev.status : 'not-generated',
        approved: prev?.approved ?? false,
        skipped: prev?.skipped ?? false,
        customSourceUrl: item.config.sourceImageUrl,
        customSourceName: item.config.productName,
        previewDataUrl: sameSource ? prev?.previewDataUrl : undefined,
        renderedWidth: sameSource ? prev?.renderedWidth ?? 0 : 0,
        renderedHeight: sameSource ? prev?.renderedHeight ?? 0 : 0,
        fileSizeBytes: sameSource ? prev?.fileSizeBytes ?? 0 : 0,
        format: settings.format,
        mimeType: prev?.mimeType ?? 'image/png',
        seoFileName: buildSeoFileName({
          config: item.config,
          groupSlug: standard.fileGroupSlug,
          slotIndex: idx + 1,
          width: prev?.renderedWidth || 1200,
          height: prev?.renderedHeight || 1200,
          format: settings.format,
        }),
        altText: buildAltText(item.config, 'Ảnh bản quyền VUTECH'),
        validation:
          sameSource && prev?.validation
            ? prev.validation
            : createPendingValidation('Nhấn "Tạo trọn bộ" để đóng dấu bản quyền bằng Canvas.'),
      };
    });

    return [
      ...fromBatch,
      ...existingExtra.map((ex, i) => ({
        ...ex,
        slotIndex: fromBatch.length + i + 1,
      })),
    ];
  }

  const prevByKey = new Map((existing ?? []).map((a) => [a.slideKey, a]));

  // Preserve custom drag-and-drop ordering if user reordered slides previously
  const orderedBlueprints =
    existing && existing.length === standard.slides.length
      ? existing
          .map((e) => standard.slides.find((b) => b.key === e.slideKey))
          .filter((b): b is NonNullable<typeof b> => Boolean(b))
      : standard.slides;

  const finalBlueprints =
    orderedBlueprints.length === standard.slides.length ? orderedBlueprints : standard.slides;

  return finalBlueprints.map((bp, idx) => {
    const slotIndex = idx + 1;
    const prev = prevByKey.get(bp.key);
    if (prev && prev.approved) {
      return { ...prev, slotIndex };
    }

    const enrichedNotes = cachedTechNotesBySlideKey?.[bp.key] ?? prev?.customTechnicalNotes;

    const baseAsset: GroupImageAsset = {
      id: prev?.id ?? `${standard.id}__${bp.key}`,
      groupId: standard.id,
      slotIndex,
      slideKey: bp.key,
      title: bp.title,
      shortTitle: bp.shortTitle,
      description: bp.description,
      status: prev?.status === 'ready' ? 'not-generated' : prev?.status ?? 'not-generated',
      approved: false,
      skipped: prev?.skipped ?? false,
      customSourceUrl: prev?.customSourceUrl,
      customSourceName: prev?.customSourceName,
      customTechnicalNotes: enrichedNotes,
      previewDataUrl: undefined,
      renderedWidth: sizeObj?.width ?? 1200,
      renderedHeight: sizeObj?.height ?? 1200,
      fileSizeBytes: 0,
      format: settings.format,
      mimeType:
        settings.format === 'png'
          ? 'image/png'
          : settings.format === 'webp'
          ? 'image/webp'
          : 'image/jpeg',
      seoFileName: buildSeoFileName({
        config: studioConfig,
        groupSlug: standard.fileGroupSlug,
        slotIndex,
        width: sizeObj?.width ?? 1200,
        height: sizeObj?.height ?? 1200,
        format: settings.format,
        isWebSeo: standard.id === '03_web_clean',
        slideShortTitle: bp.shortTitle,
      }),
      altText: buildAltText(studioConfig, bp.title),
      validation: createPendingValidation('Chưa tạo ảnh để kiểm tra quy chuẩn.'),
      requiresTechnicalDoc: bp.requiresTechnicalDoc,
      requiresVerifiedCert: bp.requiresVerifiedCert,
    };

    if (isSlideMissingVerifiedData(baseAsset)) {
      baseAsset.status = 'missing-data';
      baseAsset.validation = validateGroupAsset({
        asset: baseAsset,
        standard,
        settings,
        studioConfig,
        totalActiveInGroup: finalBlueprints.length,
      });
    } else if (baseAsset.status === 'missing-data') {
      baseAsset.status = 'not-generated';
    }

    return baseAsset;
  });
}

function getAggregateValidationStatus(assets: GroupImageAsset[]): ValidationStatus {
  const active = assets.filter((a) => !a.skipped);
  if (active.length === 0) return 'pending';
  if (active.some((a) => a.validation.status === 'fail' || a.status === 'error')) return 'fail';
  const generated = active.filter((a) => a.status === 'ready');
  if (generated.length === 0) return 'pending';
  if (active.some((a) => a.validation.status === 'warning' || a.status === 'missing-data')) {
    return 'warning';
  }
  if (generated.length < active.length) return 'pending';
  return 'pass';
}

function ValidationStatusText({ status }: { status: ValidationStatus }) {
  if (status === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        Đạt quy chuẩn
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
        Cần kiểm tra lại
      </span>
    );
  }
  if (status === 'fail') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        Không đạt quy chuẩn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      Chưa tạo / Thiếu dữ liệu
    </span>
  );
}

function stageLabelVi(stage: QueueStage): string {
  switch (stage) {
    case 'waiting':
      return 'Đang chờ';
    case 'generating':
      return 'Đang tạo ảnh';
    case 'validating':
      return 'Đang kiểm tra quy chuẩn';
    case 'optimizing':
      return 'Đang tối ưu dung lượng';
    case 'packaging':
      return 'Đang đóng gói';
    case 'completed':
      return 'Hoàn thành';
    case 'paused':
      return 'Tạm dừng';
    case 'cancelled':
      return 'Đã hủy';
    case 'failed':
      return 'Có lỗi cần thử lại';
    default:
      return 'Sẵn sàng';
  }
}

function mapGroupToEditorPatch(
  groupId: DesignGroupId,
  settings: GroupRuntimeSettings
): Partial<StudioConfig> {
  const map: Record<
    DesignGroupId,
    { template: TemplateId; aspectRatio: StudioConfig['aspectRatio']; patch?: Partial<StudioConfig> }
  > = {
    '01_shopee_cover': {
      template: 'shopee-cover',
      aspectRatio: '1:1',
      patch: { backdrop: 'pure-white', showContactFooter: false, logoPosition: 'top-center' },
    },
    '02_shopee_detail': {
      template: 'shopee-detail',
      aspectRatio: settings.sizeId === '900x1200' ? '3:4' : '1:1',
      patch: { backdrop: 'pure-white', showSpecsPanel: true, showContactFooter: false },
    },
    '03_web_clean': {
      template: 'web-clean',
      aspectRatio: '1:1',
      patch: { showSpecsPanel: true, showContactFooter: true },
    },
    '04_facebook_ads': {
      template: 'facebook-promo',
      aspectRatio: settings.facebookRatios.includes('1:1')
        ? '1:1'
        : settings.facebookRatios.includes('9:16')
        ? '9:16'
        : '3:4',
      patch: { showSpecsPanel: true, showContactFooter: true },
    },
    '05_industrial_tech': {
      template: 'industrial-tech',
      aspectRatio: settings.sizeId === '1920x1080' ? '16:9' : '4:3',
      patch: { showSpecsPanel: true, showContactFooter: true },
    },
    '06_minimal_luxury': {
      template: 'minimal-luxury',
      aspectRatio:
        settings.sizeId === '1728x2160'
          ? '3:4'
          : settings.sizeId === '1440x2560'
          ? '9:16'
          : '1:1',
      patch: { showSpecsPanel: true, showContactFooter: true },
    },
    '07_copyright_watermark': {
      template: 'watermark-protect',
      aspectRatio: '1:1',
      patch: {},
    },
  };
  const target = map[groupId];
  return {
    template: target.template,
    aspectRatio: target.aspectRatio,
    ...(target.patch ?? {}),
  };
}

export function MultiChannelPreview({
  config,
  batchItems,
  activeItemId,
  onSelectBatchItem,
  onUpdateConfig,
  onOpenInEditor,
}: MultiChannelPreviewProps) {
  const [registry, setRegistry] = useState<PlatformStandardEntry[]>(() => loadPlatformRegistry());
  const [settingsByGroup, setSettingsByGroup] = useState<Record<DesignGroupId, GroupRuntimeSettings>>(() =>
    createDefaultGroupSettings(loadPlatformRegistry())
  );

  // Per-product cached technical notes by slideKey so switching between batch items preserves AI-enriched technical docs
  const techNotesCacheByItemRef = useRef<Record<string, Record<string, string>>>({});
  const autoEnrichedSignatureSetRef = useRef<Set<string>>(new Set());

  const [assetsByGroup, setAssetsByGroup] = useState<Record<DesignGroupId, GroupImageAsset[]>>(() => {
    const reg = loadPlatformRegistry();
    const sets = createDefaultGroupSettings(reg);
    const map = {} as Record<DesignGroupId, GroupImageAsset[]>;
    for (const std of reg) {
      map[std.id] = buildInitialAssetsForGroup(std, sets[std.id], config, batchItems);
    }
    return map;
  });

  const [activeSubView, setActiveSubView] = useState<'groups' | 'standards'>('groups');
  const [selectedGroupIds, setSelectedGroupIds] = useState<DesignGroupId[]>(() =>
    registry.map((r) => r.id)
  );
  const [activeSlideIdByGroup, setActiveSlideIdByGroup] = useState<Record<DesignGroupId, string>>(() => {
    const init = {} as Record<DesignGroupId, string>;
    for (const std of registry) {
      init[std.id] = assetsByGroup[std.id]?.[0]?.id ?? '';
    }
    return init;
  });

  // AI Technical Documentation Enrichment State (Priority 1 Online Search + Method 2 File Upload)
  const [isEnrichingTechDocs, setIsEnrichingTechDocs] = useState(false);
  const [techEnrichStatus, setTechEnrichStatus] = useState<{
    mode: 'online-search' | 'file-upload';
    summary: string;
    webSources: Array<{ title: string; uri: string }>;
    error?: string;
  } | null>(null);
  const globalTechFileInputRef = useRef<HTMLInputElement | null>(null);

  // Modals state
  const [galleryState, setGalleryState] = useState<{
    open: boolean;
    groupId: DesignGroupId;
    assetId?: string;
    key: number;
  }>({ open: false, groupId: '01_shopee_cover', key: 0 });

  const [exportModalState, setExportModalState] = useState<{
    open: boolean;
    mode: ExportMode;
    groupIds: DesignGroupId[];
    assetIds: string[];
    key: number;
  }>({
    open: false,
    mode: 'all-groups',
    groupIds: registry.map((r) => r.id),
    assetIds: [],
    key: 0,
  });

  // Generation Queue State & Controls
  const [queue, setQueue] = useState<QueueProgressState>({
    stage: 'idle',
    total: 0,
    completed: 0,
    failed: 0,
    currentLabel: '',
    concurrency: 2,
    errors: [],
  });
  const [failedTasks, setFailedTasks] = useState<Array<{ groupId: DesignGroupId; assetId: string }>>([]);
  const [isPausedUi, setIsPausedUi] = useState(false);

  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);
  const runTokenRef = useRef(0);
  const createdObjectUrlsRef = useRef<string[]>([]);

  // Always keep latest state accessible to async queue workers
  const assetsRef = useRef(assetsByGroup);
  assetsRef.current = assetsByGroup;
  const settingsRef = useRef(settingsByGroup);
  settingsRef.current = settingsByGroup;
  const registryRef = useRef(registry);
  registryRef.current = registry;
  const configRef = useRef(config);
  configRef.current = config;

  // Cleanup any created object URLs on unmount
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      for (const url of createdObjectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  // Re-sync unapproved slides whenever product info or batch images change
  const productSyncKey = useMemo(
    () =>
      JSON.stringify({
        activeItemId,
        src: config.sourceImageUrl,
        name: config.productName,
        model: config.modelCode,
        tag: config.tagline,
        specs: config.specs,
        hotline: config.hotline,
        website: config.website,
        facebookPage: config.facebookPage,
        scale: config.productScale,
        ox: config.productOffsetX,
        oy: config.productOffsetY,
        blurOn: config.backgroundBlurEnabled,
        blurAmt: config.backgroundBlurAmount,
        batchKeys: batchItems.map((b) => `${b.id}:${b.config.sourceImageUrl}:${b.config.productName}`),
      }),
    [config, batchItems, activeItemId]
  );

  // Core single-slide render & validation worker (Zero AI calls, pure Canvas 2D + clean canvas disposal)
  const renderAndValidateAsset = useCallback(
    async (groupId: DesignGroupId, assetId: string): Promise<boolean> => {
      const standard = registryRef.current.find((r) => r.id === groupId);
      const settings = settingsRef.current[groupId];
      const groupList = assetsRef.current[groupId] ?? [];
      const asset = groupList.find((a) => a.id === assetId);
      const curConfig = configRef.current;

      if (!standard || !settings || !asset) return false;

      if (isSlideMissingVerifiedData(asset)) {
        const missingAsset: GroupImageAsset = {
          ...asset,
          status: 'missing-data',
        };
        const report = validateGroupAsset({
          asset: missingAsset,
          standard,
          settings,
          studioConfig: curConfig,
          totalActiveInGroup: groupList.filter((a) => !a.skipped).length,
        });
        setAssetsByGroup((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] ?? []).map((a) =>
            a.id === assetId ? { ...missingAsset, validation: report } : a
          ),
        }));
        return true;
      }

      setAssetsByGroup((prev) => ({
        ...prev,
        [groupId]: (prev[groupId] ?? []).map((a) =>
          a.id === assetId ? { ...a, status: 'generating', errorMessage: undefined } : a
        ),
      }));

      const canvas = document.createElement('canvas');
      try {
        let overrideDimensions:
          | { width: number; height: number; aspectLabel?: string; ratioKey?: '4:5' | '1:1' | '9:16' | '1.91:1' }
          | undefined;
        if (groupId === '04_facebook_ads') {
          const primaryKey = settings.facebookRatios[0] ?? '4:5';
          const preset =
            FACEBOOK_RATIO_PRESETS.find((p) => p.key === primaryKey) ?? FACEBOOK_RATIO_PRESETS[0];
          overrideDimensions = {
            width: preset.width,
            height: preset.height,
            aspectLabel: preset.key,
            ratioKey: preset.key,
          };
        }

        const dims = await renderGroupSlideCanvas({
          canvas,
          groupId,
          asset,
          standard,
          settings,
          studioConfig: curConfig,
          overrideDimensions,
          previewScaleMaxEdge: 1600,
        });

        setAssetsByGroup((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] ?? []).map((a) =>
            a.id === assetId ? { ...a, status: 'optimizing' } : a
          ),
        }));

        const maxSizeKB =
          settings.enforceMaxSizeKB !== undefined ? settings.enforceMaxSizeKB : standard.maxFileSizeKB;

        const encoded = await encodeCanvasWithLimit({
          canvas,
          format: settings.format,
          initialQuality: settings.quality,
          maxFileSizeKB: maxSizeKB,
        });

        const updatedAsset: GroupImageAsset = {
          ...asset,
          status: 'ready',
          previewDataUrl: encoded.dataUrl,
          renderedWidth: dims.width,
          renderedHeight: dims.height,
          fileSizeBytes: encoded.blob.size,
          format: encoded.format,
          mimeType: encoded.mimeType,
          seoFileName: buildSeoFileName({
            config: curConfig,
            groupSlug: standard.fileGroupSlug,
            slotIndex: asset.slotIndex,
            width: dims.width,
            height: dims.height,
            format: encoded.format,
            isWebSeo: groupId === '03_web_clean',
            slideShortTitle: asset.shortTitle,
          }),
          altText: buildAltText(curConfig, asset.title),
          updatedAt: new Date().toISOString(),
        };

        const report = validateGroupAsset({
          asset: updatedAsset,
          standard,
          settings,
          studioConfig: curConfig,
          totalActiveInGroup: (assetsRef.current[groupId] ?? []).filter((a) => !a.skipped).length,
          expectedWidth: overrideDimensions?.width,
          expectedHeight: overrideDimensions?.height,
          expectedAspectRatio: overrideDimensions?.aspectLabel,
        });

        setAssetsByGroup((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] ?? []).map((a) =>
            a.id === assetId ? { ...updatedAsset, validation: report } : a
          ),
        }));

        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Lỗi kết xuất ảnh';
        setAssetsByGroup((prev) => ({
          ...prev,
          [groupId]: (prev[groupId] ?? []).map((a) =>
            a.id === assetId
              ? {
                  ...a,
                  status: 'error',
                  errorMessage: message,
                  validation: validateGroupAsset({
                    asset: { ...a, status: 'error' },
                    standard,
                    settings,
                    studioConfig: curConfig,
                    totalActiveInGroup: (assetsRef.current[groupId] ?? []).filter((x) => !x.skipped)
                      .length,
                  }),
                }
              : a
          ),
        }));
        return false;
      } finally {
        // Explicit canvas memory cleanup
        canvas.width = 0;
        canvas.height = 0;
      }
    },
    []
  );

  // Concurrency-limited queue runner (2 parallel workers, Pause/Resume/Cancel, zero UI lockups)
  const runGenerationQueue = useCallback(
    async (
      tasks: Array<{ groupId: DesignGroupId; assetId: string; label: string }>,
      options?: { silent?: boolean }
    ) => {
      if (tasks.length === 0) return;

      const token = ++runTokenRef.current;
      pausedRef.current = false;
      cancelledRef.current = false;
      setIsPausedUi(false);

      if (!options?.silent) {
        setFailedTasks([]);
        setQueue({
          stage: 'waiting',
          total: tasks.length,
          completed: 0,
          failed: 0,
          currentLabel: tasks[0]?.label ?? '',
          concurrency: 2,
          errors: [],
        });
      }

      let cursor = 0;
      let completed = 0;
      let failed = 0;
      const errors: string[] = [];
      const localFailed: Array<{ groupId: DesignGroupId; assetId: string }> = [];

      const worker = async () => {
        while (true) {
          if (cancelledRef.current || token !== runTokenRef.current) return;

          while (pausedRef.current && !cancelledRef.current && token === runTokenRef.current) {
            if (!options?.silent) {
              setQueue((prev) => ({ ...prev, stage: 'paused' }));
            }
            await new Promise((r) => window.setTimeout(r, 150));
          }
          if (cancelledRef.current || token !== runTokenRef.current) return;

          const idx = cursor++;
          if (idx >= tasks.length) return;
          const task = tasks[idx];

          if (!options?.silent) {
            setQueue((prev) => ({
              ...prev,
              stage: 'generating',
              currentLabel: task.label,
            }));
          }

          const ok = await renderAndValidateAsset(task.groupId, task.assetId);
          if (ok) {
            completed++;
          } else {
            failed++;
            errors.push(`Lỗi: ${task.label}`);
            localFailed.push({ groupId: task.groupId, assetId: task.assetId });
          }

          if (!options?.silent && token === runTokenRef.current) {
            setQueue((prev) => ({
              ...prev,
              stage: 'validating',
              completed,
              failed,
              errors: [...errors],
            }));
          }

          await new Promise((r) => window.setTimeout(r, 18));
        }
      };

      const concurrency = Math.min(2, tasks.length);
      await Promise.all(Array.from({ length: concurrency }, () => worker()));

      if (!options?.silent && token === runTokenRef.current) {
        setFailedTasks(localFailed);
        setQueue((prev) => ({
          ...prev,
          stage: cancelledRef.current ? 'cancelled' : failed > 0 ? 'failed' : 'completed',
          completed,
          failed,
          currentLabel: cancelledRef.current
            ? 'Đã dừng theo yêu cầu'
            : failed > 0
            ? `Hoàn thành ${completed}/${tasks.length}, có ${failed} ảnh lỗi`
            : `Đã tạo và kiểm tra xong ${completed} ảnh`,
        }));
      }
    },
    [renderAndValidateAsset]
  );

  /**
   * Applies AI-enriched technical documentation (from Priority 1 Online Search or Method 2 File Upload)
   * across all matching slides of Shopee (Group 02), Website (Group 03), and Industrial Tech (Group 05),
   * then immediately renders & validates those slides!
   */
  const applyEnrichmentToWorkspace = useCallback(
    async (
      result: TechnicalDocEnrichmentResult,
      options?: { targetAssetId?: string; syncCoreConfig?: boolean; silentQueue?: boolean }
    ) => {
      const slideMap = result.slides ?? {};
      const itemCache = {
        ...(techNotesCacheByItemRef.current[activeItemId] ?? {}),
        ...slideMap,
      };
      techNotesCacheByItemRef.current[activeItemId] = itemCache;

      const tasksToRender: Array<{ groupId: DesignGroupId; assetId: string; label: string }> = [];
      const nextAll = { ...assetsRef.current };

      for (const std of registryRef.current) {
        const list = nextAll[std.id] ?? [];
        nextAll[std.id] = list.map((asset) => {
          if (asset.approved) return asset; // Respect approval lock

          const mappedText =
            slideMap[asset.slideKey] ||
            (asset.requiresTechnicalDoc
              ? slideMap['tech-03-drawing'] || slideMap['tech-02-deep-specs']
              : asset.requiresVerifiedCert
              ? slideMap['sp-sub-08-packaging-cert']
              : undefined);

          const isTargetSlide = options?.targetAssetId && asset.id === options.targetAssetId;

          if (!mappedText && !isTargetSlide) return asset;

          const updated: GroupImageAsset = {
            ...asset,
            customTechnicalNotes: mappedText ? mappedText.trim() : asset.customTechnicalNotes,
            customSourceUrl:
              isTargetSlide && result.uploadedVisualDataUrl
                ? result.uploadedVisualDataUrl
                : asset.customSourceUrl,
            customSourceName:
              isTargetSlide && result.uploadedFileName
                ? result.uploadedFileName
                : asset.customSourceName,
          };

          if (!isSlideMissingVerifiedData(updated) && updated.status === 'missing-data') {
            updated.status = 'not-generated';
          }

          tasksToRender.push({
            groupId: std.id,
            assetId: updated.id,
            label: `${std.shortName} · ${updated.shortTitle}`,
          });

          return updated;
        });
      }

      assetsRef.current = nextAll;
      setAssetsByGroup(nextAll);

      // If Method 2 (file upload) extracted 3 core specs, sync them cleanly with the main product config
      if (
        options?.syncCoreConfig &&
        onUpdateConfig &&
        Array.isArray(result.coreSpecs) &&
        result.coreSpecs.length >= 3
      ) {
        onUpdateConfig({
          specs: [
            result.coreSpecs[0] || configRef.current.specs[0],
            result.coreSpecs[1] || configRef.current.specs[1],
            result.coreSpecs[2] || configRef.current.specs[2],
          ],
          ...(result.standardizedModelCode ? { modelCode: result.standardizedModelCode } : {}),
        });
      }

      setTechEnrichStatus({
        mode: result.mode,
        summary: result.sourceSummary,
        webSources: result.webSources ?? [],
      });

      if (tasksToRender.length > 0) {
        await runGenerationQueue(tasksToRender, { silent: options?.silentQueue });
      }
    },
    [activeItemId, onUpdateConfig, runGenerationQueue]
  );

  // Priority 1 Handler: Proactive AI Online Search Grounding
  const handleEnrichOnline = useCallback(
    async (options?: { silentAuto?: boolean }) => {
      if (isEnrichingTechDocs) return;
      setIsEnrichingTechDocs(true);
      if (!options?.silentAuto) {
        setTechEnrichStatus(null);
      }
      try {
        const enrichment = await enrichTechnicalDocsOnline(configRef.current);
        await applyEnrichmentToWorkspace(enrichment, {
          syncCoreConfig: false,
          silentQueue: options?.silentAuto,
        });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Không thể tra cứu trực tuyến lúc này. Vui lòng dùng Phương án 2 (Tải file thông tin sản phẩm).';
        if (!options?.silentAuto) {
          setTechEnrichStatus({
            mode: 'online-search',
            summary: '',
            webSources: [],
            error: msg,
          });
        }
      } finally {
        setIsEnrichingTechDocs(false);
      }
    },
    [isEnrichingTechDocs, applyEnrichmentToWorkspace]
  );

  // Method 2 Handler: Upload Product File (PDF, Image, TXT, CSV, JSON) for AI Standardization & Mapping
  const handleEnrichFromFile = useCallback(
    async (file: File, targetAssetId?: string) => {
      if (!file || isEnrichingTechDocs) return;
      setIsEnrichingTechDocs(true);
      setTechEnrichStatus(null);
      try {
        const enrichment = await enrichTechnicalDocsFromFile(configRef.current, file);
        await applyEnrichmentToWorkspace(enrichment, {
          targetAssetId,
          syncCoreConfig: true,
          silentQueue: false,
        });
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Không thể phân tích file tải lên. Vui lòng kiểm tra định dạng file.';
        setTechEnrichStatus({
          mode: 'file-upload',
          summary: '',
          webSources: [],
          error: msg,
        });
      } finally {
        setIsEnrichingTechDocs(false);
      }
    },
    [isEnrichingTechDocs, applyEnrichmentToWorkspace]
  );

  // Sync assets when active product / studio config changes, render slot #1 of each group,
  // and PROACTIVELY run Priority 1 (AI Online Search) if technical slides need data!
  useEffect(() => {
    const nextMap = {} as Record<DesignGroupId, GroupImageAsset[]>;
    const heroTasks: Array<{ groupId: DesignGroupId; assetId: string; label: string }> = [];
    const cachedNotes = techNotesCacheByItemRef.current[activeItemId];
    let hasMissingTechSlides = false;

    for (const std of registryRef.current) {
      const rebuilt = buildInitialAssetsForGroup(
        std,
        settingsRef.current[std.id],
        config,
        batchItems,
        assetsRef.current[std.id],
        cachedNotes
      );
      nextMap[std.id] = rebuilt;

      if (rebuilt.some((a) => !a.skipped && a.status === 'missing-data')) {
        hasMissingTechSlides = true;
      }

      const firstReadyTarget = rebuilt.find(
        (a) => !a.skipped && !a.approved && !isSlideMissingVerifiedData(a)
      );
      if (firstReadyTarget) {
        heroTasks.push({
          groupId: std.id,
          assetId: firstReadyTarget.id,
          label: `${std.shortName} · ${firstReadyTarget.shortTitle}`,
        });
      }
    }

    assetsRef.current = nextMap;
    setAssetsByGroup(nextMap);

    setActiveSlideIdByGroup((prev) => {
      const next = { ...prev };
      for (const std of registryRef.current) {
        const list = nextMap[std.id] ?? [];
        if (!list.some((a) => a.id === next[std.id])) {
          next[std.id] = list[0]?.id ?? '';
        }
      }
      return next;
    });

    // Silently render cover/first slide of all 7 groups so cards show real visuals immediately
    const timer = window.setTimeout(async () => {
      await runGenerationQueue(heroTasks, { silent: true }).catch(() => {});

      // Priority 1: Proactively search online via AI for any product whose technical slides are not yet enriched
      const autoSig = `${activeItemId}::${config.productName}::${config.modelCode}`;
      if (hasMissingTechSlides && !autoEnrichedSignatureSetRef.current.has(autoSig)) {
        autoEnrichedSignatureSetRef.current.add(autoSig);
        handleEnrichOnline({ silentAuto: true }).catch(() => {});
      }
    }, 60);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSyncKey]);

  const handleUpdateRegistry = useCallback((next: PlatformStandardEntry[]) => {
    setRegistry(next);
    savePlatformRegistry(next);
  }, []);

  const handleUpdateSettings = useCallback(
    (groupId: DesignGroupId, patch: Partial<GroupRuntimeSettings>) => {
      setSettingsByGroup((prev) => {
        const nextGroupSettings = { ...prev[groupId], ...patch };
        const nextAll = { ...prev, [groupId]: nextGroupSettings };
        settingsRef.current = nextAll;
        return nextAll;
      });

      const currentActiveId =
        activeSlideIdByGroup[groupId] || assetsRef.current[groupId]?.[0]?.id;
      if (currentActiveId) {
        window.setTimeout(() => {
          renderAndValidateAsset(groupId, currentActiveId).catch(() => {});
        }, 40);
      }
    },
    [activeSlideIdByGroup, renderAndValidateAsset]
  );

  const handleUpdateAsset = useCallback(
    (groupId: DesignGroupId, assetId: string, patch: Partial<GroupImageAsset>) => {
      setAssetsByGroup((prev) => {
        const updatedList = (prev[groupId] ?? []).map((a) => {
          if (a.id !== assetId) return a;
          const merged = { ...a, ...patch };
          if (patch.customTechnicalNotes !== undefined) {
            techNotesCacheByItemRef.current[activeItemId] = {
              ...(techNotesCacheByItemRef.current[activeItemId] ?? {}),
              [a.slideKey]: patch.customTechnicalNotes,
            };
          }
          if (patch.customSourceUrl !== undefined || patch.customTechnicalNotes !== undefined) {
            if (!isSlideMissingVerifiedData(merged) && merged.status === 'missing-data') {
              merged.status = 'not-generated';
            }
          }
          return merged;
        });
        const nextAll = { ...prev, [groupId]: updatedList };
        assetsRef.current = nextAll;
        return nextAll;
      });

      if (patch.customSourceUrl !== undefined || patch.customTechnicalNotes !== undefined) {
        window.setTimeout(() => {
          renderAndValidateAsset(groupId, assetId).catch(() => {});
        }, 50);
      }
    },
    [activeItemId, renderAndValidateAsset]
  );

  const handleReorderAssets = useCallback(
    (groupId: DesignGroupId, fromIndex: number, toIndex: number) => {
      setAssetsByGroup((prev) => {
        const list = [...(prev[groupId] ?? [])];
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= list.length || toIndex >= list.length) {
          return prev;
        }
        const [moved] = list.splice(fromIndex, 1);
        list.splice(toIndex, 0, moved);
        const reindexed = list.map((item, idx) => ({ ...item, slotIndex: idx + 1 }));
        const nextAll = { ...prev, [groupId]: reindexed };
        assetsRef.current = nextAll;
        return nextAll;
      });
    },
    []
  );

  const handleGenerateGroup = useCallback(
    async (groupId: DesignGroupId, forceApproved = false) => {
      const std = registryRef.current.find((r) => r.id === groupId);
      const list = assetsRef.current[groupId] ?? [];
      if (!std) return;
      const tasks = list
        .filter((a) => !a.skipped && (forceApproved || !a.approved))
        .map((a) => ({
          groupId,
          assetId: a.id,
          label: `${std.shortName} · ${a.shortTitle}`,
        }));
      await runGenerationQueue(tasks);
    },
    [runGenerationQueue]
  );

  const handleGenerateSelectedGroups = useCallback(async () => {
    const targetIds = selectedGroupIds.length > 0 ? selectedGroupIds : registry.map((r) => r.id);
    const tasks: Array<{ groupId: DesignGroupId; assetId: string; label: string }> = [];
    for (const groupId of targetIds) {
      const std = registryRef.current.find((r) => r.id === groupId);
      const list = assetsRef.current[groupId] ?? [];
      if (!std) continue;
      for (const a of list) {
        if (a.skipped || a.approved) continue;
        tasks.push({
          groupId,
          assetId: a.id,
          label: `${std.shortName} · ${a.shortTitle}`,
        });
      }
    }
    await runGenerationQueue(tasks);
  }, [selectedGroupIds, registry, runGenerationQueue]);

  const handleRetryFailed = useCallback(async () => {
    if (failedTasks.length === 0) return;
    const tasks = failedTasks.map((t) => {
      const std = registryRef.current.find((r) => r.id === t.groupId);
      const asset = assetsRef.current[t.groupId]?.find((a) => a.id === t.assetId);
      return {
        groupId: t.groupId,
        assetId: t.assetId,
        label: `${std?.shortName ?? ''} · ${asset?.shortTitle ?? ''}`,
      };
    });
    await runGenerationQueue(tasks);
  }, [failedTasks, runGenerationQueue]);

  const handleUploadWatermarkBatch = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      const std = registryRef.current.find((r) => r.id === '07_copyright_watermark');
      const settings = settingsRef.current['07_copyright_watermark'];
      if (!std || !settings) return;

      const currentList = assetsRef.current['07_copyright_watermark'] ?? [];
      const newAssets: GroupImageAsset[] = files.map((file, idx) => {
        const objUrl = URL.createObjectURL(file);
        createdObjectUrlsRef.current.push(objUrl);
        const slotIndex = currentList.length + idx + 1;
        const baseName = file.name.replace(/\.[^.]+$/, '');
        const uniqueId = `wm-extra-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`;
        return {
          id: uniqueId,
          groupId: '07_copyright_watermark',
          slotIndex,
          slideKey: uniqueId,
          title: `Ảnh bản quyền #${String(slotIndex).padStart(2, '0')} · ${baseName}`,
          shortTitle: baseName.slice(0, 26),
          description: `Giữ nguyên tỷ lệ & độ phân giải file gốc (${file.name}).`,
          status: 'not-generated',
          approved: false,
          skipped: false,
          customSourceUrl: objUrl,
          customSourceName: file.name,
          renderedWidth: 0,
          renderedHeight: 0,
          fileSizeBytes: 0,
          format: settings.format,
          mimeType: file.type || 'image/png',
          seoFileName: buildSeoFileName({
            config: configRef.current,
            groupSlug: std.fileGroupSlug,
            slotIndex,
            width: 1200,
            height: 1200,
            format: settings.format,
          }),
          altText: buildAltText(configRef.current, baseName),
          validation: createPendingValidation('Đang chuẩn bị đóng dấu bản quyền bằng Canvas.'),
        };
      });

      const merged = [...currentList, ...newAssets];
      assetsRef.current = { ...assetsRef.current, '07_copyright_watermark': merged };
      setAssetsByGroup((prev) => ({
        ...prev,
        '07_copyright_watermark': merged,
      }));

      await runGenerationQueue(
        newAssets.map((a) => ({
          groupId: '07_copyright_watermark',
          assetId: a.id,
          label: `Đóng dấu bản quyền · ${a.shortTitle}`,
        }))
      );
    },
    [runGenerationQueue]
  );

  const handleRemoveWatermarkAsset = useCallback((assetId: string) => {
    setAssetsByGroup((prev) => {
      const list = prev['07_copyright_watermark'] ?? [];
      if (list.length <= 1) return prev;
      const target = list.find((a) => a.id === assetId);
      if (target?.customSourceUrl && target.customSourceUrl.startsWith('blob:')) {
        URL.revokeObjectURL(target.customSourceUrl);
      }
      const nextList = list
        .filter((a) => a.id !== assetId)
        .map((a, idx) => ({ ...a, slotIndex: idx + 1 }));
      const nextAll = { ...prev, '07_copyright_watermark': nextList };
      assetsRef.current = nextAll;
      return nextAll;
    });
  }, []);

  const toggleGroupSelection = (groupId: DesignGroupId) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const openExportModal = (mode: ExportMode, groupIds: DesignGroupId[], assetIds: string[] = []) => {
    setExportModalState((prev) => ({
      open: true,
      mode,
      groupIds,
      assetIds,
      key: prev.key + 1,
    }));
  };

  const openGalleryModal = (groupId: DesignGroupId, assetId?: string) => {
    setGalleryState((prev) => ({
      open: true,
      groupId,
      assetId,
      key: prev.key + 1,
    }));
  };

  const isQueueActive =
    queue.stage === 'waiting' ||
    queue.stage === 'generating' ||
    queue.stage === 'validating' ||
    queue.stage === 'optimizing' ||
    queue.stage === 'paused';

  const totalGeneratedCount = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const std of registry) {
      const list = (assetsByGroup[std.id] ?? []).filter((a) => !a.skipped);
      total += list.length;
      done += list.filter((a) => a.status === 'ready').length;
    }
    return { done, total };
  }, [registry, assetsByGroup]);

  const galleryStandard =
    registry.find((r) => r.id === galleryState.groupId) ?? null;

  return (
    <div className="max-w-[1440px] mx-auto px-6 py-7 space-y-6">
      {/* Header Bar */}
      <div className="pb-5 border-b border-slate-200 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              Bộ Quy Chuẩn Hình Ảnh Đa Kênh – VUTECH Studio
            </h1>
          </div>
          <p className="text-sm text-slate-600">
            Hệ thống 7 nhóm thiết kế chuẩn hóa, kiểm tra quy chuẩn độc lập và xuất file thông minh cho sản phẩm{' '}
            <span className="font-semibold text-slate-900">{config.productName}</span>
            {config.modelCode ? (
              <span className="font-mono text-xs text-slate-500 ml-1.5">({config.modelCode})</span>
            ) : null}
            .
          </p>

          {/* Sub-view Switcher */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg border border-slate-200 mt-1">
            <button
              type="button"
              onClick={() => setActiveSubView('groups')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                activeSubView === 'groups'
                  ? 'bg-white text-[#0052B4] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>7 Nhóm thiết kế ({totalGeneratedCount.done}/{totalGeneratedCount.total} ảnh)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubView('standards')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                activeSubView === 'standards'
                  ? 'bg-white text-[#0052B4] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Quản lý quy chuẩn</span>
            </button>
          </div>
        </div>

        {/* Two Primary Header Buttons as Required */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleGenerateSelectedGroups}
            disabled={isQueueActive}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 border border-[#0052B4]/25 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>
              {isQueueActive
                ? `Đang tạo (${queue.completed}/${queue.total})...`
                : `Tạo bộ ảnh (${selectedGroupIds.length} nhóm)`}
            </span>
          </button>

          <button
            type="button"
            onClick={() =>
              openExportModal(
                'all-groups',
                selectedGroupIds.length > 0 ? selectedGroupIds : registry.map((r) => r.id)
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <FolderArchive className="w-4 h-4" />
            <span>Tải xuống theo lựa chọn</span>
          </button>
        </div>
      </div>

      {/* Synced 1–5 Product Batch Selector */}
      {batchItems.length > 1 && (
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
          <span className="text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
            Đồng bộ sản phẩm trong đợt ({batchItems.length}):
          </span>
          {batchItems.map((item, idx) => {
            const active = item.id === activeItemId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectBatchItem(item.id)}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-[#0052B4] bg-[#0052B4]/8 text-[#0052B4]'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                }`}
              >
                <img
                  src={item.config.sourceImageUrl}
                  alt={item.config.productName}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded object-cover bg-slate-100 shrink-0"
                />
                <span className="font-mono text-[11px] tabular-nums">#{idx + 1}</span>
                <span className="max-w-[180px] truncate">{item.config.productName}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* AI Technical Documentation Enrichment Hub: Priority 1 (Online Search) + Method 2 (Manual File Upload + AI Parse) */}
      {activeSubView === 'groups' && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#0052B4] shrink-0" />
                <h2 className="text-sm font-bold text-slate-900">
                  Trung Tâm Bổ Sung Tài Liệu Kỹ Thuật &amp; Chuẩn Hóa Dữ Liệu Hình Ảnh AI
                </h2>
              </div>
              <p className="text-xs text-slate-600">
                Tự động điền thông số kích thước, bản vẽ, mô hình cắt lớp, sơ đồ nguyên lý &amp; chứng nhận vào đúng quy chuẩn từng nhóm ảnh (Shopee · Website · Kỹ thuật Công nghiệp).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {/* Priority 1: Proactive Online Search */}
              <button
                type="button"
                disabled={isEnrichingTechDocs}
                onClick={() => handleEnrichOnline({ silentAuto: false })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                <Globe className={`w-3.5 h-3.5 ${isEnrichingTechDocs ? 'animate-spin' : ''}`} />
                <span>
                  {isEnrichingTechDocs
                    ? 'AI đang tìm kiếm & phân tích...'
                    : 'Ưu tiên 1: AI Tìm kiếm Trực tuyến & Bổ sung theo chuẩn'}
                </span>
              </button>

              {/* Method 2: Manual File Upload for AI Analysis & Multi-Channel Mapping */}
              <input
                ref={globalTechFileInputRef}
                type="file"
                accept=".pdf,.txt,.csv,.json,.md,image/*,application/pdf"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    handleEnrichFromFile(file);
                  }
                  e.target.value = '';
                }}
                className="hidden"
              />
              <button
                type="button"
                disabled={isEnrichingTechDocs}
                onClick={() => globalTechFileInputRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 border border-[#0052B4]/25 disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Phương án 2: Up file sản phẩm (PDF/Ảnh/TXT/CSV) để AI phân tích</span>
              </button>
            </div>
          </div>

          {techEnrichStatus && (
            <div
              className={`rounded-lg px-3.5 py-2.5 border text-xs flex flex-wrap items-center justify-between gap-3 ${
                techEnrichStatus.error
                  ? 'bg-amber-50 border-amber-200 text-amber-900'
                  : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
              }`}
            >
              <div className="space-y-1 min-w-0">
                <div className="font-semibold flex items-center gap-1.5">
                  {techEnrichStatus.error ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span>{techEnrichStatus.error}</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>
                        {techEnrichStatus.mode === 'online-search'
                          ? 'Đã tự động tra cứu trực tuyến & bổ sung tài liệu kỹ thuật:'
                          : 'Đã phân tích file tải lên & đẩy chuẩn dữ liệu vào các mục hình ảnh:'}{' '}
                        <span className="font-normal">{techEnrichStatus.summary}</span>
                      </span>
                    </>
                  )}
                </div>

                {techEnrichStatus.webSources.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-700">Nguồn đối chiếu trực tuyến:</span>
                    {techEnrichStatus.webSources.map((src) => (
                      <a
                        key={src.uri}
                        href={src.uri}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#0052B4] hover:underline truncate max-w-[240px]"
                      >
                        <span className="truncate">{src.title}</span>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setTechEnrichStatus(null)}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 cursor-pointer shrink-0"
              >
                Ẩn thông báo
              </button>
            </div>
          )}
        </div>
      )}

      {/* Live Queue Progress Bar (Pause / Resume / Cancel / Retry Failed) */}
      {queue.stage !== 'idle' && (
        <div className="bg-white border border-slate-200 rounded-xl px-5 py-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="font-bold text-slate-900">{stageLabelVi(queue.stage)}</span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="text-slate-600 truncate max-w-[420px]">{queue.currentLabel}</span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span className="font-mono font-semibold text-slate-700 tabular-nums">
                {queue.completed}/{queue.total}
                {queue.failed > 0 ? ` (${queue.failed} lỗi)` : ''}
              </span>

              {isQueueActive && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      pausedRef.current = !pausedRef.current;
                      setIsPausedUi(pausedRef.current);
                      setQueue((prev) => ({
                        ...prev,
                        stage: pausedRef.current ? 'paused' : 'generating',
                      }));
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                  >
                    {isPausedUi ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                    <span>{isPausedUi ? 'Tiếp tục' : 'Tạm dừng'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      cancelledRef.current = true;
                      pausedRef.current = false;
                      setIsPausedUi(false);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 rounded-md cursor-pointer"
                  >
                    <Square className="w-3 h-3" />
                    <span>Hủy</span>
                  </button>
                </>
              )}

              {!isQueueActive && failedTasks.length > 0 && (
                <button
                  type="button"
                  onClick={handleRetryFailed}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-md cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Thử lại ảnh lỗi ({failedTasks.length})</span>
                </button>
              )}

              {!isQueueActive && (
                <button
                  type="button"
                  onClick={() =>
                    setQueue((prev) => ({ ...prev, stage: 'idle', errors: [] }))
                  }
                  className="text-xs text-slate-500 hover:text-slate-800 px-1.5 py-1 cursor-pointer"
                >
                  Đóng
                </button>
              )}
            </div>
          </div>

          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                queue.stage === 'failed'
                  ? 'bg-red-500'
                  : queue.stage === 'completed'
                  ? 'bg-emerald-600'
                  : 'bg-[#0052B4]'
              }`}
              style={{
                width: `${
                  queue.total > 0
                    ? Math.round(((queue.completed + queue.failed) / queue.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Main Content Area: Either 7-Group Workspace or Platform Standards Manager */}
      {activeSubView === 'standards' ? (
        <PlatformStandardsManager
          registry={registry}
          onUpdateRegistry={handleUpdateRegistry}
        />
      ) : (
        <div className="space-y-4">
          {/* Compact Group Selection Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedGroupIds(registry.map((r) => r.id))}
                className="font-semibold text-[#0052B4] hover:underline cursor-pointer"
              >
                Chọn tất cả 7 nhóm
              </button>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <button
                type="button"
                onClick={() => setSelectedGroupIds([])}
                className="font-semibold text-slate-600 hover:text-slate-900 hover:underline cursor-pointer"
              >
                Bỏ chọn
              </button>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span>
                Đang chọn <strong className="text-slate-900">{selectedGroupIds.length}/7</strong> nhóm để tạo hoặc tải ZIP
              </span>
            </div>
            <div className="text-slate-500">
              Ảnh đã duyệt (khóa) sẽ được bảo vệ khỏi thao tác tạo hàng loạt.
            </div>
          </div>

          {/* 2-Column Desktop / 1-Column Mobile Grid of All 7 Groups */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {registry.map((std) => {
              const settings = settingsByGroup[std.id];
              const assets = assetsByGroup[std.id] ?? [];
              const checked = selectedGroupIds.includes(std.id);
              const activeAsset =
                assets.find((a) => a.id === activeSlideIdByGroup[std.id]) ?? assets[0];

              const nonSkipped = assets.filter((a) => !a.skipped);
              const readyCount = nonSkipped.filter((a) => a.status === 'ready').length;
              const approvedCount = nonSkipped.filter((a) => a.approved).length;
              const missingCount = nonSkipped.filter((a) => a.status === 'missing-data').length;
              const aggStatus = getAggregateValidationStatus(assets);

              const activeSize =
                std.sizeOptions.find((s) => s.id === settings.sizeId) ?? std.sizeOptions[0];

              const ratioSummary =
                std.id === '04_facebook_ads'
                  ? `${settings.facebookRatios.join(', ')} (${
                      nonSkipped.length * Math.max(1, settings.facebookRatios.length)
                    } file)`
                  : std.id === '07_copyright_watermark'
                  ? 'Giữ nguyên tỷ lệ gốc'
                  : activeSize?.aspectRatio || std.aspectRatios[0];

              const resolutionSummary =
                std.id === '07_copyright_watermark'
                  ? activeAsset?.renderedWidth
                    ? `${activeAsset.renderedWidth}×${activeAsset.renderedHeight} px (Gốc)`
                    : 'Độ phân giải ảnh gốc'
                  : std.id === '04_facebook_ads'
                  ? (() => {
                      const p =
                        FACEBOOK_RATIO_PRESETS.find((x) => x.key === settings.facebookRatios[0]) ??
                        FACEBOOK_RATIO_PRESETS[0];
                      return `${p.width}×${p.height} px`;
                    })()
                  : `${activeSize.width}×${activeSize.height} px`;

              const formatSummary =
                std.id === '05_industrial_tech'
                  ? `${settings.format.toUpperCase()} / PDF`
                  : settings.format.toUpperCase();

              const isShopeeCover = std.id === '01_shopee_cover';
              const isWatermarkGroup = std.id === '07_copyright_watermark';

              return (
                <article
                  key={std.id}
                  className={`bg-white rounded-xl border transition-colors flex flex-col overflow-hidden ${
                    checked ? 'border-slate-300 shadow-xs' : 'border-slate-200 opacity-90'
                  }`}
                >
                  {/* Card Header: Checkbox + Name + Count + Inline Metadata */}
                  <div className="px-5 py-4 border-b border-slate-200 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <label className="flex items-start gap-2.5 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleGroupSelection(std.id)}
                          aria-label={`Chọn ${std.name}`}
                          className="mt-0.5 w-4 h-4 rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4] shrink-0 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <h2 className="text-sm font-bold text-slate-900 leading-snug">
                            {std.name}
                          </h2>
                          <div className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-semibold text-slate-700">
                              {isWatermarkGroup
                                ? `Đã xử lý ${readyCount}/${nonSkipped.length} ảnh gốc`
                                : `Đã tạo ${readyCount}/${nonSkipped.length} ảnh`}
                            </span>
                            {approvedCount > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-emerald-700 font-medium">
                                  {approvedCount} đã duyệt
                                </span>
                              </>
                            )}
                            {missingCount > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="text-amber-700 font-medium">
                                  {missingCount} cần bổ sung tài liệu
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </label>

                      <div className="shrink-0 pt-0.5">
                        <ValidationStatusText status={aggStatus} />
                      </div>
                    </div>

                    {/* Clean Inline Spec Metadata (Zero Pill Clutter) */}
                    <div className="pl-6 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                      <span>Tỷ lệ: <strong className="text-slate-800">{ratioSummary}</strong></span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span className="font-mono tabular-nums text-[11px]">{resolutionSummary}</span>
                      <span aria-hidden="true" className="text-slate-300">·</span>
                      <span>Định dạng: <strong className="text-slate-800">{formatSummary}</strong></span>
                      {std.maxFileSizeKB && (
                        <>
                          <span aria-hidden="true" className="text-slate-300">·</span>
                          <span>≤ {(std.maxFileSizeKB / 1024).toFixed(0)} MB</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Card Large Hero Preview Stage */}
                  <div className="studio-grid-bg relative px-5 py-5 flex-1 flex flex-col items-center justify-center min-h-[290px]">
                    {/* Group 01 Shopee Preview Overlay Switch (Pure Preview Layer - NEVER Exported) */}
                    {isShopeeCover && (
                      <div className="w-full flex items-center justify-between gap-2 mb-3 bg-white/90 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                        <label className="inline-flex items-center gap-2 font-semibold text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={settings.shopeePreviewOverlay}
                            onChange={(e) =>
                              handleUpdateSettings(std.id, {
                                shopeePreviewOverlay: e.target.checked,
                              })
                            }
                            className="w-3.5 h-3.5 rounded border-slate-300 text-[#EE4D2D] focus:ring-[#EE4D2D] cursor-pointer"
                          />
                          <span>Xem trước giao diện Shopee</span>
                        </label>
                        <span className="text-[11px] text-slate-500 flex items-center gap-1">
                          {settings.shopeePreviewOverlay ? (
                            <Eye className="w-3.5 h-3.5 text-[#EE4D2D]" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>Chỉ mô phỏng · Không lưu vào file tải</span>
                        </span>
                      </div>
                    )}

                    {/* Group 07 Direct Multi-File Upload Strip (N in -> N out) */}
                    {isWatermarkGroup && (
                      <div className="w-full flex items-center justify-between gap-2 mb-3 bg-white/95 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                        <span className="text-slate-700 font-medium">
                          Canvas 2D thuần (0 API AI) · Kiểu:{' '}
                          <strong className="text-slate-900">
                            {settings.watermark.mode === 'corner'
                              ? 'Đóng góc'
                              : settings.watermark.mode === 'center'
                              ? 'Chìm giữa ảnh'
                              : 'Lặp toàn khung'}
                          </strong>{' '}
                          ({settings.watermark.opacityPct}%)
                        </span>
                        <label className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 rounded-md cursor-pointer whitespace-nowrap">
                          <Plus className="w-3.5 h-3.5" />
                          <span>Thêm nhiều ảnh gốc</span>
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const list = Array.from(e.target.files ?? []);
                              if (list.length > 0) {
                                handleUploadWatermarkBatch(list).catch(() => {});
                              }
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>
                    )}

                    {/* Main Preview Frame */}
                    {activeAsset?.status === 'missing-data' ? (
                      <div className="w-[380px] max-w-full bg-white border border-dashed border-[#0052B4]/35 rounded-xl p-5 flex flex-col items-center justify-center text-center gap-2.5 shadow-xs">
                        <FileWarning className="w-7 h-7 text-[#0052B4]" />
                        <div className="text-sm font-bold text-slate-900">
                          {activeAsset.title}
                        </div>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          Chọn 1 trong 2 phương án để AI bổ sung dữ liệu kỹ thuật chuẩn cho sản phẩm và tạo ngay hình ảnh mục này:
                        </p>
                        <div className="w-full flex flex-col gap-1.5 pt-1">
                          <button
                            type="button"
                            disabled={isEnrichingTechDocs}
                            onClick={() => handleEnrichOnline({ silentAuto: false })}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] disabled:opacity-60 rounded-lg cursor-pointer"
                          >
                            <Globe className={`w-3.5 h-3.5 ${isEnrichingTechDocs ? 'animate-spin' : ''}`} />
                            <span>
                              {isEnrichingTechDocs
                                ? 'AI đang tra cứu trực tuyến...'
                                : 'Ưu tiên 1: AI Tìm kiếm Trực tuyến & Bổ sung'}
                            </span>
                          </button>

                          <button
                            type="button"
                            disabled={isEnrichingTechDocs}
                            onClick={() => globalTechFileInputRef.current?.click()}
                            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 border border-[#0052B4]/25 disabled:opacity-60 rounded-lg cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Phương án 2: Up file sản phẩm để AI phân tích</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        onClick={() => openGalleryModal(std.id, activeAsset?.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            openGalleryModal(std.id, activeAsset?.id);
                          }
                        }}
                        className="relative group cursor-pointer max-w-full flex items-center justify-center"
                        title="Nhấn để mở thư viện phóng to và tùy chỉnh nhóm"
                      >
                        {activeAsset?.previewDataUrl ? (
                          <div className="relative inline-block">
                            <img
                              src={activeAsset.previewDataUrl}
                              alt={activeAsset.altText}
                              className="block max-h-[265px] max-w-full w-auto h-auto rounded-xs shadow-md border border-slate-300/60 bg-white"
                            />

                            {/* Pure CSS Shopee Preview Overlay (Strict Separation from Export Canvas!) */}
                            {isShopeeCover && settings.shopeePreviewOverlay && (
                              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xs">
                                <div className="absolute top-1.5 left-0 bg-[#EE4D2D] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-r-xs shadow-xs">
                                  Yêu thích+
                                </div>
                                <div className="absolute top-0 right-0 bg-[#FFD424] text-[#EE4D2D] text-[10px] font-extrabold px-1.5 py-0.5 text-center leading-tight shadow-xs">
                                  <div>15%</div>
                                  <div className="text-[8px] font-bold text-slate-900">GIẢM</div>
                                </div>
                                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-r from-[#00BFA5] via-[#00A88F] to-[#EE4D2D] text-white text-[10px] font-bold px-2 py-1 flex items-center justify-between opacity-92">
                                  <span>FREESHIP XTRA</span>
                                  <span>VOUCHER XTRA</span>
                                </div>
                              </div>
                            )}

                            {activeAsset.approved && (
                              <div className="absolute top-2 left-2 bg-emerald-700/92 text-white text-[10px] font-semibold px-2 py-0.5 rounded-xs inline-flex items-center gap-1 shadow-xs">
                                <Lock className="w-3 h-3" />
                                <span>Đã duyệt</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="w-[260px] h-[220px] bg-white border border-slate-200 rounded-lg flex flex-col items-center justify-center text-center p-4 gap-2">
                            <Layers className="w-7 h-7 text-slate-400" />
                            <div className="text-xs font-semibold text-slate-700">
                              {activeAsset?.status === 'generating'
                                ? 'Đang kết xuất ảnh...'
                                : activeAsset?.status === 'error'
                                ? 'Kết xuất lỗi — nhấn Tạo lại'
                                : 'Chưa tạo bản xem trước cho ảnh này'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Nhấn &quot;Tạo trọn bộ&quot; hoặc &quot;Tạo lại ảnh chọn&quot; bên dưới.
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Selected Slide Caption */}
                    {activeAsset && (
                      <div className="mt-3 w-full flex items-center justify-between gap-2 text-xs text-slate-600">
                        <span className="font-medium text-slate-800 truncate">
                          {activeAsset.title}
                        </span>
                        {activeAsset.fileSizeBytes > 0 && (
                          <span className="font-mono text-[11px] text-slate-500 shrink-0 tabular-nums">
                            {Math.round(activeAsset.fileSizeBytes / 1024)} KB · {activeAsset.format.toUpperCase()}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Thumbnail Strip of All Slides in Group */}
                  <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {assets.map((slide) => {
                        const isSelected = slide.id === activeAsset?.id;
                        const dotColor =
                          slide.status === 'error' || slide.validation.status === 'fail'
                            ? 'bg-red-500'
                            : slide.status === 'missing-data' || slide.validation.status === 'warning'
                            ? 'bg-amber-500'
                            : slide.status === 'ready' && slide.validation.status === 'pass'
                            ? 'bg-emerald-500'
                            : 'bg-slate-300';

                        return (
                          <button
                            key={slide.id}
                            type="button"
                            onClick={() =>
                              setActiveSlideIdByGroup((prev) => ({
                                ...prev,
                                [std.id]: slide.id,
                              }))
                            }
                            title={slide.title}
                            className={`relative shrink-0 w-16 rounded-md border overflow-hidden text-left transition-all cursor-pointer bg-white ${
                              isSelected
                                ? 'border-[#0052B4] ring-2 ring-[#0052B4]/20'
                                : 'border-slate-200 hover:border-slate-300'
                            } ${slide.skipped ? 'opacity-45' : ''}`}
                          >
                            <div className="h-12 bg-slate-100 flex items-center justify-center overflow-hidden">
                              {slide.previewDataUrl ? (
                                <img
                                  src={slide.previewDataUrl}
                                  alt={slide.shortTitle}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-[10px] font-mono text-slate-400">
                                  #{String(slide.slotIndex).padStart(2, '0')}
                                </span>
                              )}
                            </div>
                            <div className="px-1 py-0.5 flex items-center justify-between gap-1 bg-white border-t border-slate-100">
                              <span className="text-[10px] font-mono text-slate-600 tabular-nums">
                                {String(slide.slotIndex).padStart(2, '0')}
                              </span>
                              <span className="flex items-center gap-0.5">
                                {slide.approved && (
                                  <Check className="w-2.5 h-2.5 text-emerald-600" />
                                )}
                                <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Card Action Bar: All 6 Required Controls */}
                  <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onOpenInEditor(mapGroupToEditorPatch(std.id, settings))}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#0052B4] bg-slate-100 hover:bg-slate-200/70 rounded-md transition-colors cursor-pointer"
                      >
                        <span>Tinh chỉnh</span>
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleGenerateGroup(std.id, false)}
                        disabled={isQueueActive}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Tạo trọn bộ</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (activeAsset) {
                            renderAndValidateAsset(std.id, activeAsset.id).catch(() => {});
                          }
                        }}
                        disabled={!activeAsset || isQueueActive}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Tạo lại ảnh chọn</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openGalleryModal(std.id, activeAsset?.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem toàn bộ</span>
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (activeAsset) {
                            openExportModal('single', [std.id], [activeAsset.id]);
                          }
                        }}
                        disabled={!activeAsset}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Tải ảnh</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openExportModal('group', [std.id])}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-md transition-colors cursor-pointer"
                      >
                        <FolderArchive className="w-3.5 h-3.5" />
                        <span>Tải trọn nhóm</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-Group Full Gallery, Reorder, Zoom, Technical Docs & Watermark Modal */}
      {galleryState.open && galleryStandard && (
        <GroupGalleryModal
          key={`gallery-${galleryState.key}`}
          open={galleryState.open}
          standard={galleryStandard}
          settings={settingsByGroup[galleryStandard.id]}
          assets={assetsByGroup[galleryStandard.id] ?? []}
          studioConfig={config}
          initialAssetId={galleryState.assetId}
          onClose={() => setGalleryState((prev) => ({ ...prev, open: false }))}
          onUpdateSettings={handleUpdateSettings}
          onUpdateAsset={handleUpdateAsset}
          onReorderAssets={handleReorderAssets}
          onRegenerateAsset={async (groupId, assetId) => {
            await renderAndValidateAsset(groupId, assetId);
          }}
          onGenerateGroup={handleGenerateGroup}
          onUploadWatermarkBatch={handleUploadWatermarkBatch}
          onRemoveWatermarkAsset={handleRemoveWatermarkAsset}
          onOpenExportForAsset={(groupId, assetId) => {
            setGalleryState((prev) => ({ ...prev, open: false }));
            openExportModal('single', [groupId], [assetId]);
          }}
          onOpenExportForGroup={(groupId) => {
            setGalleryState((prev) => ({ ...prev, open: false }));
            openExportModal('group', [groupId]);
          }}
          onEnrichOnline={() => handleEnrichOnline({ silentAuto: false })}
          onEnrichFromFile={handleEnrichFromFile}
          isEnrichingTechDocs={isEnrichingTechDocs}
          techEnrichSummary={techEnrichStatus?.summary ?? null}
        />
      )}

      {/* Smart Multi-Channel Export & ZIP / PDF Dialog */}
      {exportModalState.open && (
        <SmartExportModal
          key={`export-${exportModalState.key}`}
          open={exportModalState.open}
          initialMode={exportModalState.mode}
          initialGroupIds={exportModalState.groupIds}
          initialAssetIds={exportModalState.assetIds}
          registry={registry}
          settingsByGroup={settingsByGroup}
          assetsByGroup={assetsByGroup}
          studioConfig={config}
          onClose={() => setExportModalState((prev) => ({ ...prev, open: false }))}
        />
      )}
    </div>
  );
}
