import { useEffect, useState } from 'react';
import { AiImageStudio } from './components/AiImageStudio';
import { CanvasStage } from './components/CanvasStage';
import { LibraryView } from './components/LibraryView';
import { MultiChannelPreview } from './components/MultiChannelPreview';
import { StudioSidebar } from './components/StudioSidebar';
import { TopBar } from './components/TopBar';
import {
  DEFAULT_STUDIO_CONFIG,
  MAX_BATCH_IMAGES,
  SAMPLE_PRODUCTS,
} from './constants/vutech';
import type {
  AiGeneratedItem,
  BatchProductItem,
  ExportFormat,
  SavedDesign,
  StudioConfig,
  WorkspaceTab,
} from './types/studio';
import {
  exportStudioImage,
  loadImage,
  recommendAspectRatioForSubject,
  renderThumbnailDataUrl,
} from './utils/canvasRenderer';

const STORAGE_LIBRARY_KEY = 'vutech_brand_studio_library_v1';

// Shared visual/brand settings that automatically sync across all images in a batch when syncBatchLayout is ON
const SHARED_LAYOUT_KEYS: Array<keyof StudioConfig> = [
  'template',
  'aspectRatio',
  'resolution',
  'companyName',
  'hotline',
  'website',
  'facebookPage',
  'logoMode',
  'logoPosition',
  'logoScale',
  'removeLogoBg',
  'watermarkOpacity',
  'backdrop',
  'fitMode',
  'autoFrameSubject',
  'backgroundBlurEnabled',
  'backgroundBlurAmount',
  'extendBackground',
  'focusFeather',
  'brightness',
  'contrast',
  'saturation',
  'sharpness',
  'showSpecsPanel',
  'showContactFooter',
  'showPriceBadge',
];

function createInitialBatchItem(): BatchProductItem {
  return {
    id: 'sample-default',
    isSample: true,
    config: { ...DEFAULT_STUDIO_CONFIG, specs: [...DEFAULT_STUDIO_CONFIG.specs] as [string, string, string] },
    status: 'idle',
    statusMessage: null,
  };
}

function readFileAsDataUrl(file: File): Promise<{ dataUrl: string; cleanName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
        resolve({ dataUrl: reader.result, cleanName: cleanName || 'Sản phẩm lọc nước' });
      } else {
        reject(new Error('Không thể đọc tệp ảnh'));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh'));
    reader.readAsDataURL(file);
  });
}

async function imageUrlToDataUrl(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) return { mimeType: match[1], base64: match[2] };
  }
  const res = await fetch(url);
  const blob = await res.blob();
  const mimeType = blob.type || 'image/jpeg';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const str = String(reader.result || '');
      resolve({
        mimeType,
        base64: str.includes(',') ? str.split(',')[1] : str,
      });
    };
    reader.onerror = () => reject(new Error('Không thể đọc ảnh'));
    reader.readAsDataURL(blob);
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('studio');
  const [batchItems, setBatchItems] = useState<BatchProductItem[]>(() => [createInitialBatchItem()]);
  const [activeItemId, setActiveItemId] = useState<string>('sample-default');
  const [syncBatchLayout, setSyncBatchLayout] = useState<boolean>(true);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingBundle, setIsExportingBundle] = useState(false);
  const [batchExportProgress, setBatchExportProgress] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [isZoomModalOpen, setIsZoomModalOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState<AiGeneratedItem[]>([]);
  const [savedDesigns, setSavedDesigns] = useState<SavedDesign[]>(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_LIBRARY_KEY);
      return raw ? (JSON.parse(raw) as SavedDesign[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(savedDesigns));
    } catch {
      // Ignore storage quota issues on large uploaded photos
    }
  }, [savedDesigns]);

  const activeItem =
    batchItems.find((item) => item.id === activeItemId) ?? batchItems[0];
  const config = activeItem.config;
  const analyzingCount = batchItems.filter((item) => item.status === 'analyzing').length;

  const updateConfig = (patch: Partial<StudioConfig>) => {
    const sharedPatch: Partial<StudioConfig> = {};
    let hasSharedKeys = false;
    for (const key of SHARED_LAYOUT_KEYS) {
      if (key in patch) {
        (sharedPatch as Record<string, unknown>)[key] = patch[key];
        hasSharedKeys = true;
      }
    }

    setBatchItems((prev) =>
      prev.map((item) => {
        if (item.id === activeItem.id) {
          return { ...item, config: { ...item.config, ...patch } };
        }
        if (syncBatchLayout && hasSharedKeys) {
          return { ...item, config: { ...item.config, ...sharedPatch } };
        }
        return item;
      })
    );
  };

  const runProductAnalysisForItem = async (
    itemId: string,
    imageUrl: string,
    existingName: string
  ) => {
    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              status: 'analyzing',
              statusMessage:
                'AI đang chủ động nhận diện thiết bị lọc nước, định vị chủ thể làm mờ nền và tự động cập nhật thông tin...',
            }
          : item
      )
    );

    try {
      const { base64, mimeType } = await imageUrlToDataUrl(imageUrl);
      const response = await fetch('/api/gemini/analyze-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          existingName,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.analysis) {
        setBatchItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  status: 'error',
                  statusMessage:
                    data.error ||
                    'Đã bật sẵn làm mờ nền & mở rộng khung. Bạn có thể tự chỉnh sửa thông tin sản phẩm ngay bên dưới.',
                  config: {
                    ...item.config,
                    productName:
                      item.config.productName === 'Đang nhận diện chủng loại thiết bị...'
                        ? 'Thiết Bị Lọc Nước VUTECH'
                        : item.config.productName,
                  },
                }
              : item
          )
        );
        return;
      }

      const a = data.analysis as {
        productName?: string;
        modelCode?: string;
        category?: string;
        specs?: string[];
        tagline?: string;
        priceBadge?: string;
        facebookCaption?: string;
        subjectBox?: { x?: number; y?: number; w?: number; h?: number };
      };
      const specsList = Array.isArray(a.specs) ? a.specs : [];

      let nextSubjectBox = { x: 0.12, y: 0.08, w: 0.76, h: 0.84 };
      if (a.subjectBox) {
        const rawX = Number(a.subjectBox.x ?? 12);
        const rawY = Number(a.subjectBox.y ?? 8);
        const rawW = Number(a.subjectBox.w ?? 76);
        const rawH = Number(a.subjectBox.h ?? 84);
        const nx = Math.max(0, Math.min(0.65, rawX > 1 ? rawX / 100 : rawX));
        const ny = Math.max(0, Math.min(0.65, rawY > 1 ? rawY / 100 : rawY));
        const nw = Math.max(0.28, Math.min(1 - nx, rawW > 1 ? rawW / 100 : rawW));
        const nh = Math.max(0.28, Math.min(1 - ny, rawH > 1 ? rawH / 100 : rawH));
        nextSubjectBox = { x: nx, y: ny, w: nw, h: nh };
      }

      const detectedCategory = a.category?.trim();
      const detectedProductName =
        a.productName?.trim() ||
        (detectedCategory ? `${detectedCategory} VUTECH` : '');

      const loadedImg = await loadImage(imageUrl).catch(() => null);
      const recommendedAspectRatio = loadedImg
        ? recommendAspectRatioForSubject(
            loadedImg.naturalWidth,
            loadedImg.naturalHeight,
            nextSubjectBox
          )
        : undefined;

      setBatchItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: 'done',
                statusMessage: `AI đã nhận diện "${detectedCategory || 'Thiết bị lọc nước'}", tự động căn khung chính vào vùng sản phẩm thực tế${
                  recommendedAspectRatio
                    ? ` (gợi ý tỷ lệ ${recommendedAspectRatio})`
                    : ''
                }. Bạn có thể mở cửa sổ Zoom để tinh chỉnh vị trí hoặc đổi kích thước.`,
                config: {
                  ...item.config,
                  productName: detectedProductName || item.config.productName,
                  modelCode: a.modelCode?.trim() || item.config.modelCode,
                  category: detectedCategory || item.config.category,
                  tagline: a.tagline?.trim() || item.config.tagline,
                  priceBadge: a.priceBadge?.trim() || item.config.priceBadge,
                  specs: [
                    specsList[0] || item.config.specs[0],
                    specsList[1] || item.config.specs[1],
                    specsList[2] || item.config.specs[2],
                  ],
                  facebookCaption: a.facebookCaption || item.config.facebookCaption,
                  subjectBox: nextSubjectBox,
                  autoFrameSubject: true,
                  recommendedAspectRatio,
                  productScale: 1,
                  productOffsetX: 0,
                  productOffsetY: 0,
                },
              }
            : item
        )
      );
    } catch {
      setBatchItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: 'error',
                statusMessage:
                  'Đã tự động bật làm mờ nền & mở rộng khung. Không thể kết nối AI nhận diện lúc này — bạn vẫn có thể chỉnh sửa thông tin trực tiếp bên dưới.',
                config: {
                  ...item.config,
                  productName:
                    item.config.productName === 'Đang nhận diện chủng loại thiết bị...'
                      ? 'Thiết Bị Lọc Nước VUTECH'
                      : item.config.productName,
                },
              }
            : item
        )
      );
    }
  };

  const handleUploadFiles = async (
    files: File[],
    mode: 'auto' | 'append' | 'replace' = 'auto'
  ) => {
    const validImages = files.filter((f) => f.type.startsWith('image/'));
    if (validImages.length === 0) return;

    const existingUploaded = batchItems.filter((item) => !item.isSample);
    const shouldAppend =
      mode === 'append' ||
      (mode === 'auto' && existingUploaded.length > 0 && existingUploaded.length < MAX_BATCH_IMAGES);

    const availableSlots = shouldAppend
      ? MAX_BATCH_IMAGES - existingUploaded.length
      : MAX_BATCH_IMAGES;

    if (availableSlots <= 0) {
      setBatchNotice(
        `Đợt hiện tại đã đủ tối đa ${MAX_BATCH_IMAGES} ảnh. Nhấn "Tạo đợt mới" hoặc xóa bớt ảnh để tải thêm.`
      );
      return;
    }

    const acceptedFiles = validImages.slice(0, availableSlots);
    if (validImages.length > acceptedFiles.length) {
      setBatchNotice(
        `Đã nạp ${acceptedFiles.length}/${validImages.length} ảnh (giới hạn tối đa ${MAX_BATCH_IMAGES} ảnh cùng xử lý trong một đợt).`
      );
    } else {
      setBatchNotice(null);
    }

    const readResults = await Promise.all(
      acceptedFiles.map((file) => readFileAsDataUrl(file).catch(() => null))
    );
    const loaded = readResults.filter(
      (r): r is { dataUrl: string; cleanName: string } => r !== null
    );
    if (loaded.length === 0) return;

    // Inherit active brand styling & immediately enable background blur + adaptive background extension
    const baseStyle = activeItem.config;
    const timestamp = Date.now();
    const createdItems: BatchProductItem[] = loaded.map((entry, idx) => ({
      id: `batch-${timestamp}-${idx}`,
      isSample: false,
      status: 'analyzing',
      statusMessage:
        'AI đang chủ động nhận diện thiết bị lọc nước, định vị chủ thể làm mờ nền và tự động cập nhật thông tin...',
      config: {
        ...baseStyle,
        sourceImageUrl: entry.dataUrl,
        sourceImageName: entry.cleanName,
        productName: 'Đang nhận diện chủng loại thiết bị...',
        category: 'Thiết bị lọc nước VUTECH',
        modelCode: `VT-${String(idx + 1).padStart(2, '0')}`,
        specs: [...baseStyle.specs] as [string, string, string],
        productOffsetX: 0,
        productOffsetY: 0,
        productScale: 1,
        autoFrameSubject: true,
        recommendedAspectRatio: undefined,
        backgroundBlurEnabled: true,
        backgroundBlurAmount: 18,
        extendBackground: true,
        focusRadiusScale: 1.0,
        focusFeather: 28,
        subjectBox: { x: 0.12, y: 0.08, w: 0.76, h: 0.84 },
      },
    }));

    if (shouldAppend) {
      setBatchItems([...existingUploaded, ...createdItems]);
    } else {
      setBatchItems(createdItems);
    }
    setActiveItemId(createdItems[0].id);

    // Proactively run AI product recognition across all newly uploaded images in parallel
    createdItems.forEach((item) => {
      void runProductAnalysisForItem(
        item.id,
        item.config.sourceImageUrl,
        item.config.sourceImageName
      );
    });
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchItems((prev) => {
      const remaining = prev.filter((item) => item.id !== id);
      if (remaining.length === 0) {
        const fallback = createInitialBatchItem();
        setActiveItemId(fallback.id);
        return [fallback];
      }
      if (activeItemId === id) {
        setActiveItemId(remaining[0].id);
      }
      return remaining;
    });
    setBatchNotice(null);
  };

  const handleClearBatch = () => {
    const fresh = createInitialBatchItem();
    setBatchItems([fresh]);
    setActiveItemId(fresh.id);
    setBatchNotice(null);
  };

  const handleSelectSample = (sampleId: string) => {
    const found = SAMPLE_PRODUCTS.find((s) => s.id === sampleId);
    if (!found) return;
    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === activeItem.id
          ? {
              ...item,
              status: 'idle',
              statusMessage: null,
              config: {
                ...item.config,
                sourceImageUrl: found.imageUrl,
                sourceImageName: found.label,
                productName: found.productName,
                modelCode: found.modelCode,
                category: found.category,
                tagline: found.tagline,
                specs: [...found.specs] as [string, string, string],
                priceBadge: found.priceBadge,
                template: found.recommendedTemplate,
                facebookCaption: found.facebookCaption,
                productOffsetX: 0,
                productOffsetY: 0,
                productScale: 1,
                autoFrameSubject: true,
                recommendedAspectRatio: undefined,
                backgroundBlurEnabled: true,
                backgroundBlurAmount: 16,
                extendBackground: true,
                subjectBox: { x: 0.12, y: 0.08, w: 0.76, h: 0.84 },
              },
            }
          : item
      )
    );
  };

  const handleResetAdjustments = () => {
    updateConfig({
      productScale: 1,
      productOffsetX: 0,
      productOffsetY: 0,
      autoFrameSubject: true,
      backgroundBlurEnabled: true,
      backgroundBlurAmount: 16,
      extendBackground: true,
      focusRadiusScale: 1.0,
      focusFeather: 28,
      brightness: 102,
      contrast: 104,
      saturation: 104,
      sharpness: 18,
      logoScale: 1,
      watermarkOpacity: 0.08,
      backdrop: 'pure-white',
      fitMode: 'contain',
    });
  };

  const handleAnalyzeWithAi = async () => {
    await runProductAnalysisForItem(
      activeItem.id,
      activeItem.config.sourceImageUrl,
      activeItem.config.sourceImageName
    );
  };

  const handleAnalyzeAllBatch = async () => {
    await Promise.all(
      batchItems.map((item) =>
        runProductAnalysisForItem(
          item.id,
          item.config.sourceImageUrl,
          item.config.sourceImageName
        )
      )
    );
  };

  const handleExportCurrent = async () => {
    setIsExporting(true);
    try {
      await exportStudioImage(config, exportFormat);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportBatch = async () => {
    if (batchItems.length === 0) return;
    try {
      for (let i = 0; i < batchItems.length; i++) {
        setBatchExportProgress(`Đang xuất ${i + 1}/${batchItems.length} ảnh...`);
        await exportStudioImage(batchItems[i].config, exportFormat);
        await new Promise((r) => window.setTimeout(r, 280));
      }
    } finally {
      setBatchExportProgress(null);
    }
  };

  const handleExportBundle = async () => {
    setIsExportingBundle(true);
    try {
      const bundleSpecs: Array<{
        aspectRatio: StudioConfig['aspectRatio'];
        template: StudioConfig['template'];
        resolution?: StudioConfig['resolution'];
        overrides?: Partial<StudioConfig>;
      }> = [
        { aspectRatio: '1:1', template: 'web-clean' },
        { aspectRatio: '3:4', template: 'facebook-promo' },
        { aspectRatio: '16:9', template: 'industrial-tech' },
        {
          aspectRatio: '1:1',
          template: 'shopee-cover',
          resolution: '1K',
          overrides: {
            backdrop: 'pure-white',
            showContactFooter: false,
            logoPosition: 'top-center',
          },
        },
      ];

      for (const spec of bundleSpecs) {
        await exportStudioImage(
          {
            ...config,
            ...(spec.overrides ?? {}),
            aspectRatio: spec.aspectRatio,
            template: spec.template,
            resolution: spec.resolution ?? config.resolution,
          },
          exportFormat
        );
        await new Promise((r) => window.setTimeout(r, 250));
      }
    } finally {
      setIsExportingBundle(false);
    }
  };

  const handleSaveToLibrary = async () => {
    const thumb = await renderThumbnailDataUrl(config);
    const entry: SavedDesign = {
      id: `design-${Date.now()}`,
      savedAt: new Date().toLocaleString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
      }),
      thumbnailDataUrl: thumb,
      config: { ...config, specs: [...config.specs] as [string, string, string] },
    };
    setSavedDesigns((prev) => [entry, ...prev].slice(0, 24));
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2200);
  };

  const handleApplyAiToStudio = (imageDataUrl: string, label: string) => {
    updateConfig({
      sourceImageUrl: imageDataUrl,
      sourceImageName: label,
      productOffsetX: 0,
      productOffsetY: 0,
      productScale: 1,
      autoFrameSubject: true,
      recommendedAspectRatio: undefined,
      backgroundBlurEnabled: true,
      backgroundBlurAmount: 14,
      extendBackground: true,
    });
    setActiveTab('studio');
  };

  const handleQuickExportTopBar = () => {
    if (batchItems.length > 1) {
      void handleExportBatch();
    } else {
      void handleExportCurrent();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F4F7FA] text-slate-900">
      <TopBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onQuickExport={handleQuickExportTopBar}
        isExporting={isExporting || Boolean(batchExportProgress)}
        savedCount={savedDesigns.length}
        batchCount={batchItems.length}
      />

      {activeTab === 'studio' && (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0">
          <StudioSidebar
            config={config}
            batchItems={batchItems}
            activeItemId={activeItem.id}
            syncBatchLayout={syncBatchLayout}
            batchNotice={batchNotice}
            onToggleSyncBatchLayout={setSyncBatchLayout}
            onSelectBatchItem={setActiveItemId}
            onRemoveBatchItem={handleRemoveBatchItem}
            onClearBatch={handleClearBatch}
            onChange={updateConfig}
            onUploadFiles={handleUploadFiles}
            onSelectSample={handleSelectSample}
            onAnalyzeWithAi={handleAnalyzeWithAi}
            onAnalyzeAllBatch={handleAnalyzeAllBatch}
            isAnalyzing={activeItem.status === 'analyzing'}
            analyzingCount={analyzingCount}
            analyzeMessage={activeItem.statusMessage}
            aiJustUpdated={activeItem.status === 'done'}
            onResetAdjustments={handleResetAdjustments}
            onOpenAiOutpaint={() => setActiveTab('ai')}
            onOpenZoomModal={() => setIsZoomModalOpen(true)}
          />
          <CanvasStage
            config={config}
            batchItems={batchItems}
            activeItemId={activeItem.id}
            onSelectBatchItem={setActiveItemId}
            onChangeConfig={updateConfig}
            exportFormat={exportFormat}
            onChangeExportFormat={setExportFormat}
            onExportCurrent={handleExportCurrent}
            onExportBundle={handleExportBundle}
            onExportBatch={handleExportBatch}
            onSaveToLibrary={handleSaveToLibrary}
            isExporting={isExporting}
            isExportingBundle={isExportingBundle}
            batchExportProgress={batchExportProgress}
            isAnalyzing={activeItem.status === 'analyzing'}
            analyzingCount={analyzingCount}
            justSaved={justSaved}
            isZoomOpen={isZoomModalOpen}
            onOpenZoom={() => setIsZoomModalOpen(true)}
            onCloseZoom={() => setIsZoomModalOpen(false)}
          />
        </div>
      )}

      {activeTab === 'ai' && (
        <AiImageStudio
          currentStudioImageUrl={config.sourceImageUrl}
          history={aiHistory}
          onAddHistory={(item) => setAiHistory((prev) => [item, ...prev].slice(0, 12))}
          onApplyToBrandStudio={handleApplyAiToStudio}
        />
      )}

      {activeTab === 'channels' && (
        <MultiChannelPreview
          config={config}
          batchItems={batchItems}
          activeItemId={activeItem.id}
          onSelectBatchItem={setActiveItemId}
          exportFormat={exportFormat}
          onUpdateConfig={updateConfig}
          onOpenInEditor={(patch) => {
            updateConfig(patch);
            setActiveTab('studio');
          }}
        />
      )}

      {activeTab === 'library' && (
        <LibraryView
          designs={savedDesigns}
          exportFormat={exportFormat}
          onLoadDesign={(loaded) => {
            updateConfig({ ...DEFAULT_STUDIO_CONFIG, ...loaded });
            setActiveTab('studio');
          }}
          onDeleteDesign={(id) =>
            setSavedDesigns((prev) => prev.filter((item) => item.id !== id))
          }
          onGoToStudio={() => setActiveTab('studio')}
        />
      )}
    </div>
  );
}
