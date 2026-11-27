import { useEffect, useRef, useState } from 'react';
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
  BatchRecognitionMode,
  ExportFormat,
  RecognitionModelOption,
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
import {
  applyRecognitionRecordToStudioConfig,
  runSmartProductRecognitionPipeline,
} from './utils/productRecognitionEngine';

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
        resolve({ dataUrl: reader.result, cleanName: cleanName || 'Ảnh sản phẩm gốc' });
      } else {
        reject(new Error('Không thể đọc tệp ảnh'));
      }
    };
    reader.onerror = () => reject(new Error('Không thể đọc tệp ảnh'));
    reader.readAsDataURL(file);
  });
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('studio');
  const [batchItems, setBatchItems] = useState<BatchProductItem[]>(() => [createInitialBatchItem()]);
  const [activeItemId, setActiveItemId] = useState<string>('sample-default');
  const [syncBatchLayout, setSyncBatchLayout] = useState<boolean>(true);
  const [batchRecognitionMode, setBatchRecognitionMode] =
    useState<BatchRecognitionMode>('independent');
  const [recognitionModel, setRecognitionModel] =
    useState<RecognitionModelOption>('gemini-4-hydrogen');
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

  // Track latest requestId per itemId so async recognition results never cross-contaminate
  const activeRequestMapRef = useRef<Record<string, string>>({});

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

  /**
   * SMART PRODUCT RECOGNITION ENGINE 2.0 – Xử lý nhận diện cho 01 ảnh sản phẩm (Chế độ B)
   * hoặc gộp nhiều góc chụp của cùng 01 sản phẩm (Chế độ A).
   * Luôn đọc trực tiếp từ ảnh gốc (sourceImageUrl), có khóa requestId chống ghi đè chéo.
   */
  const runProductAnalysisForItem = async (
    itemId: string,
    imageUrl: string,
    existingName: string,
    options?: {
      bypassCache?: boolean;
      mode?: 'full-recognition' | 'ocr-only';
      multiAngleUrls?: string[];
      multiAngleNames?: string[];
    }
  ) => {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    activeRequestMapRef.current[itemId] = requestId;

    setBatchItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              requestId,
              status: 'analyzing',
              statusMessage:
                options?.mode === 'ocr-only'
                  ? 'Smart Recognition 2.0 đang quét OCR chữ trên tem nhãn và bao bì từ ảnh gốc...'
                  : 'Smart Recognition 2.0 đang đọc chữ trên tem nhãn, đối chiếu từ điển ngành nước & chuẩn hóa tên sản phẩm...',
              config: {
                ...item.config,
                // Lưu snapshot trước khi nhận diện lại để người dùng có thể Khôi phục nếu cần
                previousSnapshot:
                  item.config.productName &&
                  !item.config.productName.startsWith('Đang nhận diện')
                    ? {
                        productName: item.config.productName,
                        modelCode: item.config.modelCode,
                        category: item.config.category,
                        tagline: item.config.tagline,
                        specs: [...item.config.specs] as [string, string, string],
                        priceBadge: item.config.priceBadge,
                        facebookCaption: item.config.facebookCaption,
                        recognitionRecord: item.config.recognitionRecord,
                      }
                    : item.config.previousSnapshot,
              },
            }
          : item
      )
    );

    const urlsToAnalyze =
      options?.multiAngleUrls && options.multiAngleUrls.length > 0
        ? options.multiAngleUrls
        : [imageUrl];
    const namesToAnalyze =
      options?.multiAngleNames && options.multiAngleNames.length > 0
        ? options.multiAngleNames
        : [existingName];

    const result = await runSmartProductRecognitionPipeline({
      sourceImageUrls: urlsToAnalyze,
      fileNames: namesToAnalyze,
      recognitionModel,
      mode: options?.mode || 'full-recognition',
      bypassCache: options?.bypassCache ?? false,
    });

    // Kiểm tra requestId để đảm bảo kết quả bất đồng bộ không ghi đè sai ảnh nếu người dùng đổi ảnh khác
    if (activeRequestMapRef.current[itemId] !== requestId) {
      return;
    }

    const { record, subjectBox, fromCache } = result;
    const nextSubjectBox = subjectBox || { x: 0.12, y: 0.08, w: 0.76, h: 0.84 };

    const loadedImg = await loadImage(imageUrl).catch(() => null);
    const recommendedAspectRatio = loadedImg
      ? recommendAspectRatioForSubject(
          loadedImg.naturalWidth,
          loadedImg.naturalHeight,
          nextSubjectBox
        )
      : undefined;

    const isErrorStatus = record.recognitionStatus === 'ERROR' || Boolean(record.apiError);
    const confidencePct = Math.round(record.confidence * 100);

    const statusMessage = isErrorStatus
      ? `${record.apiError?.title || 'Cảnh báo kết nối API'} — Hệ thống đã kích hoạt bộ phân tích dự phòng. Bạn có thể chọn "Đối chiếu danh mục" bên dưới để nạp thông số chuẩn VUTECH.`
      : `Đã nhận diện [${record.category}] → "${record.productName}" (Độ tin cậy: ${confidencePct}%${fromCache ? ' · Từ bộ nhớ đệm' : ''}).`;

    setBatchItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const updatedConfig = applyRecognitionRecordToStudioConfig(item.config, record, {
          respectLocks: true,
          subjectBox: nextSubjectBox,
        });
        return {
          ...item,
          status: isErrorStatus ? 'error' : 'done',
          statusMessage,
          config: {
            ...updatedConfig,
            autoFrameSubject: true,
            recommendedAspectRatio,
          },
        };
      })
    );
  };

  /**
   * Chế độ A: Hợp nhất thông tin từ tất cả các ảnh góc chụp trong đợt thành 01 hồ sơ sản phẩm thống nhất
   * và đồng bộ sang toàn bộ các ảnh trong đợt.
   */
  const runMultiAngleSingleProductAnalysis = async (itemsToMerge: BatchProductItem[]) => {
    if (itemsToMerge.length === 0) return;
    const primaryItem = itemsToMerge[0];
    const allUrls = itemsToMerge.map((it) => it.config.sourceImageUrl);
    const allNames = itemsToMerge.map((it) => it.config.sourceImageName);

    setBatchItems((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'analyzing',
        statusMessage: `Chế độ A: Đang hợp nhất thông tin từ ${itemsToMerge.length} góc chụp của cùng 1 sản phẩm...`,
      }))
    );

    const result = await runSmartProductRecognitionPipeline({
      sourceImageUrls: allUrls,
      fileNames: allNames,
      recognitionModel,
      mode: 'full-recognition',
      bypassCache: true,
    });

    const { record, subjectBox } = result;
    const isErrorStatus = record.recognitionStatus === 'ERROR' || Boolean(record.apiError);
    const confidencePct = Math.round(record.confidence * 100);

    setBatchItems((prev) =>
      prev.map((item) => {
        const updatedConfig = applyRecognitionRecordToStudioConfig(item.config, record, {
          respectLocks: true,
          subjectBox: item.id === primaryItem.id && subjectBox ? subjectBox : item.config.subjectBox,
        });
        return {
          ...item,
          status: isErrorStatus ? 'error' : 'done',
          statusMessage: isErrorStatus
            ? `${record.apiError?.title || 'Lỗi API'} — Vui lòng kiểm tra hoặc chọn Đối chiếu danh mục.`
            : `Chế độ A (${itemsToMerge.length} góc chụp): Đã hợp nhất hồ sơ "${record.productName}" (Độ tin cậy ${confidencePct}%).`,
          config: updatedConfig,
        };
      })
    );
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

    // Kế thừa cấu hình bố cục & thương hiệu NHƯNG TUYỆT ĐỐI KHÔNG kế thừa tên sản phẩm mẫu,
    // KHÔNG tự gán VT-01..VT-05 và KHÔNG kế thừa 3 thông số của sản phẩm trước đó!
    const baseStyle = activeItem.config;
    const timestamp = Date.now();
    const createdItems: BatchProductItem[] = loaded.map((entry, idx) => ({
      id: `batch-${timestamp}-${idx}`,
      isSample: false,
      status: 'analyzing',
      statusMessage:
        'Smart Recognition 2.0 đang đọc chữ trên tem nhãn từ ảnh gốc và chuẩn hóa dữ liệu sản phẩm...',
      config: {
        ...baseStyle,
        sourceImageUrl: entry.dataUrl,
        sourceImageName: entry.cleanName,
        productName: 'Đang nhận diện sản phẩm...',
        category: 'ĐANG PHÂN LOẠI...',
        modelCode: '',
        tagline: '',
        specs: ['', '', ''],
        priceBadge: '',
        showPriceBadge: false,
        showSpecsPanel: false,
        facebookCaption: '',
        recognitionRecord: undefined,
        channelNames: undefined,
        lockedFields: {},
        previousSnapshot: undefined,
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

    const nextBatchList = shouldAppend
      ? [...existingUploaded, ...createdItems]
      : createdItems;

    setBatchItems(nextBatchList);
    setActiveItemId(createdItems[0].id);

    // Nếu đang ở Chế độ A (Nhiều góc chụp của cùng 1 sản phẩm) và có >1 ảnh: hợp nhất hồ sơ
    if (batchRecognitionMode === 'multi-angle-single-product' && nextBatchList.length > 1) {
      void runMultiAngleSingleProductAnalysis(nextBatchList);
    } else {
      // Chế độ B: Nhận diện độc lập từng ảnh theo itemId riêng biệt
      createdItems.forEach((item) => {
        void runProductAnalysisForItem(
          item.id,
          item.config.sourceImageUrl,
          item.config.sourceImageName
        );
      });
    }
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
                showPriceBadge: Boolean(found.priceBadge),
                showSpecsPanel: true,
                template: found.recommendedTemplate,
                facebookCaption: found.facebookCaption,
                recognitionRecord: found.recognitionRecord,
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

  const handleAnalyzeWithAi = async (options?: {
    bypassCache?: boolean;
    mode?: 'full-recognition' | 'ocr-only';
  }) => {
    if (batchRecognitionMode === 'multi-angle-single-product' && batchItems.length > 1) {
      await runMultiAngleSingleProductAnalysis(batchItems);
      return;
    }
    await runProductAnalysisForItem(
      activeItem.id,
      activeItem.config.sourceImageUrl,
      activeItem.config.sourceImageName,
      {
        bypassCache: options?.bypassCache ?? true,
        mode: options?.mode || 'full-recognition',
      }
    );
  };

  const handleAnalyzeAllBatch = async () => {
    if (batchRecognitionMode === 'multi-angle-single-product' && batchItems.length > 1) {
      await runMultiAngleSingleProductAnalysis(batchItems);
      return;
    }
    await Promise.all(
      batchItems.map((item) =>
        runProductAnalysisForItem(
          item.id,
          item.config.sourceImageUrl,
          item.config.sourceImageName,
          { bypassCache: true }
        )
      )
    );
  };

  /**
   * Đồng bộ hồ sơ sản phẩm đã xác nhận sang toàn bộ ảnh trong đợt và chuyển tới Quy chuẩn Đa kênh nếu yêu cầu
   */
  const handleSyncVerifiedProductToAllChannels = (navigateToChannels = false) => {
    const verifiedConfig = activeItem.config;
    setBatchItems((prev) =>
      prev.map((item) => ({
        ...item,
        config: {
          ...item.config,
          productName: verifiedConfig.productName,
          modelCode: verifiedConfig.modelCode,
          category: verifiedConfig.category,
          tagline: verifiedConfig.tagline,
          specs: [...verifiedConfig.specs] as [string, string, string],
          priceBadge: verifiedConfig.priceBadge,
          showPriceBadge: verifiedConfig.showPriceBadge,
          showSpecsPanel: verifiedConfig.showSpecsPanel,
          facebookCaption: verifiedConfig.facebookCaption,
          recognitionRecord: verifiedConfig.recognitionRecord,
          channelNames: verifiedConfig.channelNames,
          lockedFields: verifiedConfig.lockedFields,
        },
      }))
    );
    if (navigateToChannels) {
      setActiveTab('channels');
    }
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
            batchRecognitionMode={batchRecognitionMode}
            onChangeBatchRecognitionMode={setBatchRecognitionMode}
            recognitionModel={recognitionModel}
            onChangeRecognitionModel={setRecognitionModel}
            onToggleSyncBatchLayout={setSyncBatchLayout}
            onSelectBatchItem={setActiveItemId}
            onRemoveBatchItem={handleRemoveBatchItem}
            onClearBatch={handleClearBatch}
            onChange={updateConfig}
            onUploadFiles={handleUploadFiles}
            onSelectSample={handleSelectSample}
            onAnalyzeWithAi={handleAnalyzeWithAi}
            onAnalyzeAllBatch={handleAnalyzeAllBatch}
            onApplyToAllMultiChannel={() => handleSyncVerifiedProductToAllChannels(true)}
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
