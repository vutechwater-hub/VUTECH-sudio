import { useRef, useState } from 'react';
import {
  Upload,
  Sparkles,
  RotateCcw,
  Image as ImageIcon,
  SlidersHorizontal,
  FileText,
  Frame,
  Plus,
  X,
  Loader2,
  Check,
  ZoomIn,
} from 'lucide-react';
import {
  ASPECT_RATIOS,
  CHANNEL_PRESETS,
  MAX_BATCH_IMAGES,
  PLATFORM_STANDARDS,
  RESOLUTIONS,
  SAMPLE_PRODUCTS,
  TEMPLATES,
  VUTECH_LOGOS,
} from '../constants/vutech';
import type {
  BackdropPreset,
  BatchProductItem,
  BatchRecognitionMode,
  LogoMode,
  LogoPosition,
  PlatformKey,
  RecognitionModelOption,
  StudioConfig,
} from '../types/studio';
import { SmartRecognitionPanel } from './SmartRecognitionPanel';

interface StudioSidebarProps {
  config: StudioConfig;
  batchItems: BatchProductItem[];
  activeItemId: string;
  syncBatchLayout: boolean;
  batchNotice: string | null;
  batchRecognitionMode: BatchRecognitionMode;
  onChangeBatchRecognitionMode: (mode: BatchRecognitionMode) => void;
  recognitionModel: RecognitionModelOption;
  onChangeRecognitionModel: (model: RecognitionModelOption) => void;
  onToggleSyncBatchLayout: (value: boolean) => void;
  onSelectBatchItem: (id: string) => void;
  onRemoveBatchItem: (id: string) => void;
  onClearBatch: () => void;
  onChange: (patch: Partial<StudioConfig>) => void;
  onUploadFiles: (files: File[], mode?: 'auto' | 'append' | 'replace') => void;
  onSelectSample: (sampleId: string) => void;
  onAnalyzeWithAi: (options?: {
    bypassCache?: boolean;
    mode?: 'full-recognition' | 'ocr-only';
  }) => Promise<void>;
  onAnalyzeAllBatch: () => Promise<void>;
  onApplyToAllMultiChannel: () => void;
  isAnalyzing: boolean;
  analyzingCount: number;
  analyzeMessage: string | null;
  aiJustUpdated: boolean;
  onResetAdjustments: () => void;
  onOpenAiOutpaint: () => void;
  onOpenZoomModal: () => void;
}

type InspectorTab = 'source' | 'format' | 'info' | 'brand';

export function StudioSidebar({
  config,
  batchItems,
  activeItemId,
  syncBatchLayout,
  batchNotice,
  batchRecognitionMode,
  onChangeBatchRecognitionMode,
  recognitionModel,
  onChangeRecognitionModel,
  onToggleSyncBatchLayout,
  onSelectBatchItem,
  onRemoveBatchItem,
  onClearBatch,
  onChange,
  onUploadFiles,
  onSelectSample,
  onAnalyzeWithAi,
  onAnalyzeAllBatch,
  onApplyToAllMultiChannel,
  isAnalyzing,
  analyzingCount,
  analyzeMessage,
  aiJustUpdated,
  onResetAdjustments,
  onOpenAiOutpaint,
  onOpenZoomModal,
}: StudioSidebarProps) {
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('source');
  const [selectedRulePlatform, setSelectedRulePlatform] = useState<PlatformKey>('shopee');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const appendInputRef = useRef<HTMLInputElement | null>(null);

  const uploadedCount = batchItems.filter((item) => !item.isSample).length;
  const remainingSlots = Math.max(0, MAX_BATCH_IMAGES - uploadedCount);

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    mode: 'auto' | 'append' | 'replace'
  ) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) {
      onUploadFiles(files, mode);
      e.target.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'));
    if (files.length > 0) {
      onUploadFiles(files, 'auto');
    }
  };

  const updateSpec = (index: 0 | 1 | 2, value: string) => {
    const next: [string, string, string] = [...config.specs] as [string, string, string];
    next[index] = value;
    onChange({ specs: next });
  };

  return (
    <aside className="w-full lg:w-[388px] xl:w-[408px] shrink-0 bg-white border-r border-slate-200 flex flex-col lg:h-[calc(100vh-4rem)]">
      {/* Segmented Inspector Tabs */}
      <div className="p-3 border-b border-slate-200 bg-slate-50/70">
        <div className="grid grid-cols-4 gap-1 p-1 bg-slate-200/70 rounded-lg">
          {(
            [
              { id: 'source', label: 'Ảnh gốc', icon: ImageIcon },
              { id: 'format', label: 'Khung/Mẫu', icon: Frame },
              { id: 'info', label: 'Thông tin', icon: FileText },
              { id: 'brand', label: 'Logo/Sắc nét', icon: SlidersHorizontal },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const active = inspectorTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setInspectorTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-1 text-[11px] font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white text-[#0052B4] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scrollable Inspector Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-6">
        {inspectorTab === 'source' && (
          <>
            {/* Upload 1 to 5 raw product images per batch */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Tải ảnh sản phẩm gốc</h2>
                <span className="font-mono text-xs font-semibold text-[#0052B4] tabular-nums">
                  {uploadedCount > 0 ? `${uploadedCount}/${MAX_BATCH_IMAGES} ảnh` : `Tối đa ${MAX_BATCH_IMAGES} ảnh/đợt`}
                </span>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors cursor-pointer ${
                  isDragOver
                    ? 'border-[#0052B4] bg-[#0052B4]/5'
                    : 'border-slate-300 hover:border-[#0052B4]/60 bg-slate-50/70'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange(e, 'auto')}
                  className="hidden"
                />
                <input
                  ref={appendInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileChange(e, 'append')}
                  className="hidden"
                />
                <div className="w-9 h-9 mx-auto mb-2 rounded-lg bg-[#0052B4]/10 text-[#0052B4] flex items-center justify-center">
                  <Upload className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold text-slate-900">
                  Chọn hoặc kéo thả 1–{MAX_BATCH_IMAGES} ảnh sản phẩm cùng lúc
                </p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Xử lý đồng loạt: tự động làm mờ nền, mở rộng khung & AI nhận diện từng sản phẩm
                </p>
              </div>

              {batchNotice && (
                <p className="text-xs px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 leading-relaxed">
                  {batchNotice}
                </p>
              )}

              {/* Batch Queue Panel (Visible whenever user uploaded 1-5 images) */}
              {uploadedCount > 0 && (
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">
                      Danh sách đợt hiện tại ({uploadedCount}/{MAX_BATCH_IMAGES})
                    </span>
                    <div className="flex items-center gap-2">
                      {remainingSlots > 0 && (
                        <button
                          type="button"
                          onClick={() => appendInputRef.current?.click()}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 rounded-md cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm ({remainingSlots})</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={onClearBatch}
                        className="text-[11px] font-semibold text-slate-500 hover:text-red-600 cursor-pointer"
                      >
                        Tạo đợt mới
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    {batchItems.map((item, idx) => {
                      const isActive = item.id === activeItemId;
                      return (
                        <div
                          key={item.id}
                          onClick={() => onSelectBatchItem(item.id)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectBatchItem(item.id);
                            }
                          }}
                          className={`flex items-center gap-2.5 p-2 rounded-lg border transition-colors cursor-pointer ${
                            isActive
                              ? 'border-[#0052B4] bg-[#0052B4]/6'
                              : 'border-slate-200 bg-white hover:border-slate-300'
                          }`}
                        >
                          <img
                            src={item.config.sourceImageUrl}
                            alt={item.config.productName}
                            referrerPolicy="no-referrer"
                            className="w-10 h-10 rounded object-cover bg-slate-100 shrink-0 border border-slate-200"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] font-bold text-[#0052B4] tabular-nums shrink-0">
                                #{idx + 1}
                              </span>
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {item.config.productName || item.config.sourceImageName}
                              </p>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] mt-0.5">
                              {item.status === 'analyzing' ? (
                                <span className="inline-flex items-center gap-1 text-[#0052B4] font-medium">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>AI đang nhận diện...</span>
                                </span>
                              ) : item.status === 'done' ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                                  <Check className="w-3 h-3" />
                                  <span>Đã cập nhật AI · {item.config.modelCode}</span>
                                </span>
                              ) : (
                                <span className="text-slate-500 truncate">
                                  {item.config.modelCode || 'Sẵn sàng chỉnh sửa'}
                                </span>
                              )}
                            </div>
                          </div>
                          {batchItems.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Xóa ảnh ${idx + 1}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveBatchItem(item.id);
                              }}
                              className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors cursor-pointer shrink-0"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {batchItems.length > 1 && (
                    <label className="flex items-center justify-between pt-1 cursor-pointer">
                      <span className="text-xs font-medium text-slate-700">
                        Đồng bộ mẫu, tỷ lệ & logo cho cả {batchItems.length} ảnh
                      </span>
                      <input
                        type="checkbox"
                        checked={syncBatchLayout}
                        onChange={(e) => onToggleSyncBatchLayout(e.target.checked)}
                        className="h-4 w-4 rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* AI Auto-Recognition Re-run Action */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void onAnalyzeWithAi({ bypassCache: true, mode: 'full-recognition' });
                  }}
                  disabled={isAnalyzing}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/14 border border-[#0052B4]/20 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                >
                  <Sparkles className={`w-3.5 h-3.5 shrink-0 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  <span>
                    {isAnalyzing
                      ? `AI đang quét${analyzingCount > 1 ? ` (${analyzingCount} ảnh)` : ''}...`
                      : 'AI nhận diện lại ảnh này'}
                  </span>
                </button>
                {batchItems.length > 1 && (
                  <button
                    type="button"
                    onClick={onAnalyzeAllBatch}
                    disabled={analyzingCount > 0}
                    className="py-2 px-3 text-xs font-semibold text-slate-700 hover:text-[#0052B4] bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
                  >
                    Quét cả {batchItems.length} ảnh
                  </button>
                )}
              </div>

              {analyzeMessage && (
                <p
                  className={`text-xs px-3 py-2 rounded-lg leading-relaxed border ${
                    aiJustUpdated
                      ? 'bg-[#0052B4]/6 border-[#0052B4]/20 text-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-600'
                  }`}
                >
                  {analyzeMessage}
                </p>
              )}
            </section>

            <hr className="border-slate-200" />

            {/* Immediate Background Blur & Adaptive Background Extension Controls */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Làm mờ & Mở rộng nền</h2>
                <span className="font-mono text-[11px] text-[#0052B4] font-semibold">
                  Khung {config.aspectRatio}
                </span>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-center justify-between cursor-pointer">
                  <div>
                    <span className="block text-xs font-semibold text-slate-800">
                      Tự động lấy khung chính theo sản phẩm AI
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Tự zoom & căn giữa đúng vùng thiết bị, bỏ phần nền thừa
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.autoFrameSubject}
                    onChange={(e) => onChange({ autoFrameSubject: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                  />
                </label>

                {config.recommendedAspectRatio && (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0052B4]/6 border border-[#0052B4]/20">
                    <div className="text-xs text-slate-800">
                      <span className="font-medium">Tỷ lệ tối ưu theo dáng SP: </span>
                      <span className="font-mono font-bold text-[#0052B4]">
                        {config.recommendedAspectRatio}
                      </span>
                    </div>
                    {config.aspectRatio === config.recommendedAspectRatio ? (
                      <span className="text-[11px] font-semibold text-emerald-700 whitespace-nowrap">
                        Đang dùng
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onChange({
                            aspectRatio: config.recommendedAspectRatio,
                            autoFrameSubject: true,
                            productScale: 1,
                            productOffsetX: 0,
                            productOffsetY: 0,
                          })
                        }
                        className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-md transition-colors whitespace-nowrap cursor-pointer"
                      >
                        Áp dụng
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={onOpenZoomModal}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-[#0052B4] bg-white hover:bg-[#0052B4]/8 border border-[#0052B4]/30 rounded-lg transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5 shrink-0" />
                  <span>Mở cửa sổ Zoom & Căn chỉnh ảnh gốc</span>
                </button>

                <label className="flex items-center justify-between pt-1 cursor-pointer">
                  <div>
                    <span className="block text-xs font-semibold text-slate-800">
                      Làm mờ nền nổi bật sản phẩm
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Giữ nét thiết bị lọc nước, xóa phông nền phía sau
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.backgroundBlurEnabled}
                    onChange={(e) => onChange({ backgroundBlurEnabled: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                  />
                </label>

                {config.backgroundBlurEnabled && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Mức độ làm mờ nền</span>
                      <span className="font-mono text-slate-700 font-semibold tabular-nums">
                        {config.backgroundBlurAmount} px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={40}
                      step={1}
                      value={config.backgroundBlurAmount}
                      onChange={(e) => onChange({ backgroundBlurAmount: Number(e.target.value) })}
                      className="w-full studio-slider"
                    />
                  </div>
                )}

                <label className="flex items-center justify-between pt-1 cursor-pointer">
                  <div>
                    <span className="block text-xs font-semibold text-slate-800">
                      Mở rộng hình nền theo kích thước mẫu
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Tự phủ liền mạch khi đổi 1:1, 3:4, 16:9, 9:16, 21:9
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={config.extendBackground}
                    onChange={(e) => onChange({ extendBackground: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                  />
                </label>

                {(config.backgroundBlurEnabled || config.extendBackground) && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">Vùng nét SP</span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {Math.round(config.focusRadiusScale * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.65}
                        max={1.35}
                        step={0.05}
                        value={config.focusRadiusScale}
                        onChange={(e) => onChange({ focusRadiusScale: Number(e.target.value) })}
                        className="w-full studio-slider"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-600">Mịn chuyển biên</span>
                        <span className="font-mono text-slate-500 tabular-nums">
                          {config.focusFeather}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={10}
                        max={60}
                        step={2}
                        value={config.focusFeather}
                        onChange={(e) => onChange({ focusFeather: Number(e.target.value) })}
                        className="w-full studio-slider"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onOpenAiOutpaint}
                  className="w-full py-1.5 px-3 text-[11px] font-semibold text-slate-700 hover:text-[#0052B4] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  Cần mở rộng bối cảnh siêu thực bằng AI? Mở Tạo & Sửa AI
                </button>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Quick Inline Editable AI Product Info */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">
                  Thông tin sản phẩm (Chỉnh sửa nhanh)
                </h2>
                <button
                  type="button"
                  onClick={() => setInspectorTab('info')}
                  className="text-xs font-semibold text-[#0052B4] hover:underline cursor-pointer"
                >
                  Đầy đủ
                </button>
              </div>

              <div className="space-y-2.5">
                <div className="space-y-1">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    Tên sản phẩm
                  </label>
                  <input
                    type="text"
                    value={config.productName}
                    onChange={(e) => onChange({ productName: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Mã Model
                    </label>
                    <input
                      type="text"
                      value={config.modelCode}
                      onChange={(e) => onChange({ modelCode: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-semibold text-slate-600">
                      Nhóm thiết bị
                    </label>
                    <input
                      type="text"
                      value={config.category}
                      onChange={(e) => onChange({ category: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[11px] font-semibold text-slate-600">
                    3 Thông số kỹ thuật hiển thị trên ảnh
                  </label>
                  {([0, 1, 2] as const).map((idx) => (
                    <input
                      key={idx}
                      type="text"
                      value={config.specs[idx]}
                      onChange={(e) => updateSpec(idx, e.target.value)}
                      placeholder={`Thông số ${idx + 1}`}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                    />
                  ))}
                </div>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Sample VUTECH products */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Sản phẩm mẫu VUTECH</h2>
                <span className="text-xs text-slate-500">Thử nhanh bố cục</span>
              </div>

              <div className="space-y-2">
                {SAMPLE_PRODUCTS.map((sample) => {
                  const selected = config.sourceImageUrl === sample.imageUrl;
                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => onSelectSample(sample.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-[#0052B4] bg-[#0052B4]/5'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <img
                        src={sample.imageUrl}
                        alt={sample.label}
                        referrerPolicy="no-referrer"
                        className="w-11 h-11 rounded-md object-cover bg-slate-100 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {sample.label}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {sample.modelCode} · {sample.category}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Uploaded Company Logo Reference Preview */}
            <section className="space-y-2.5">
              <h2 className="text-sm font-bold text-slate-900">Bộ nhận diện VUTECH đã nạp</h2>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center gap-2">
                  <img
                    src={VUTECH_LOGOS.full}
                    alt="Logo VUTECH đầy đủ"
                    referrerPolicy="no-referrer"
                    className="h-8 w-auto object-contain"
                  />
                  <span className="text-[11px] text-slate-500">Logo ngang chính</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col items-center justify-center gap-2">
                  <img
                    src={VUTECH_LOGOS.icon}
                    alt="Biểu tượng VUTECH V"
                    referrerPolicy="no-referrer"
                    className="h-8 w-auto object-contain"
                  />
                  <span className="text-[11px] text-slate-500">Biểu tượng & Watermark</span>
                </div>
              </div>
            </section>
          </>
        )}

        {inspectorTab === 'format' && (
          <>
            {/* Quick Channel Presets (Shopee · Website · Facebook) */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">
                  Quy chuẩn Web · FB · Shopee
                </h2>
                <span className="text-[11px] font-medium text-slate-500">1 chạm áp chuẩn</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {CHANNEL_PRESETS.map((preset) => {
                  const active =
                    config.aspectRatio === preset.aspectRatio &&
                    config.template === preset.recommendedTemplate;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedRulePlatform(preset.platform);
                        onChange({
                          aspectRatio: preset.aspectRatio,
                          resolution: preset.recommendedResolution,
                          template: preset.recommendedTemplate,
                          ...(preset.recommendedOverrides ?? {}),
                        });
                      }}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[#0052B4] bg-[#0052B4]/6'
                          : 'border-slate-200 hover:border-slate-300 bg-white'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {preset.label}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-[#0052B4] tabular-nums shrink-0">
                          {preset.aspectRatio}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {preset.channel} · {preset.recommendedResolution}
                      </p>
                    </button>
                  );
                })}
              </div>

              {/* Official Platform Guidelines Quick Reference */}
              {(() => {
                const activeStandard =
                  PLATFORM_STANDARDS.find((p) => p.platform === selectedRulePlatform) ??
                  PLATFORM_STANDARDS[0];
                return (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-900">
                        Quy chuẩn nền tảng đăng tải
                      </span>
                      <div className="inline-flex rounded-md bg-slate-200/75 p-0.5">
                        {(
                          [
                            { id: 'shopee', label: 'Shopee' },
                            { id: 'facebook', label: 'Facebook' },
                            { id: 'website', label: 'Website' },
                          ] as Array<{ id: PlatformKey; label: string }>
                        ).map((tab) => (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setSelectedRulePlatform(tab.id)}
                            className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors cursor-pointer ${
                              selectedRulePlatform === tab.id
                                ? 'bg-white text-[#0052B4] shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-[11px] font-medium text-[#0052B4]">
                      {activeStandard.sourceRef}
                    </p>
                    <dl className="space-y-1.5 text-[11px] leading-relaxed text-slate-700">
                      <div>
                        <dt className="inline font-semibold text-slate-900">Tỷ lệ & Kích thước: </dt>
                        <dd className="inline">
                          {activeStandard.ratios}. {activeStandard.resolutionAndSize}.
                        </dd>
                      </div>
                      <div>
                        <dt className="inline font-semibold text-slate-900">Vùng an toàn: </dt>
                        <dd className="inline">{activeStandard.safeZoneRule}</dd>
                      </div>
                      <div>
                        <dt className="inline font-semibold text-slate-900">Lưu ý kiểm duyệt: </dt>
                        <dd className="inline">{activeStandard.contentPolicy}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })()}
            </section>

            <hr className="border-slate-200" />

            {/* Aspect Ratio Selector (All 8 Ratios) */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Tỷ lệ khung hình</h2>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {config.aspectRatio}
                </span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {ASPECT_RATIOS.map((r) => {
                  const active = config.aspectRatio === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => onChange({ aspectRatio: r.value })}
                      className={`py-2 px-2 rounded-md border text-center font-mono text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                        active
                          ? 'border-[#0052B4] bg-[#0052B4] text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Resolution Selector (1K, 2K, 4K) */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Độ phân giải xuất ảnh</h2>
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {config.resolution}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {RESOLUTIONS.map((res) => {
                  const active = config.resolution === res.value;
                  return (
                    <button
                      key={res.value}
                      type="button"
                      onClick={() => onChange({ resolution: res.value })}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[#0052B4] bg-[#0052B4]/6'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                        {res.label}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">
                        {res.detail}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Commercial Layout Templates */}
            <section className="space-y-2.5">
              <h2 className="text-sm font-bold text-slate-900">Bố cục thương hiệu</h2>
              <div className="space-y-2">
                {TEMPLATES.map((tpl) => {
                  const active = config.template === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => onChange({ template: tpl.id })}
                      className={`w-full p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                        active
                          ? 'border-[#0052B4] bg-[#0052B4]/5'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="text-xs font-bold text-slate-900">{tpl.name}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {tpl.description}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </>
        )}

        {inspectorTab === 'info' && (
          <>
            {/* MỤC XIII: GIAO DIỆN KIỂM TRA VÀ XÁC NHẬN DỮ LIỆU "KẾT QUẢ NHẬN DIỆN AI 2.0" */}
            <SmartRecognitionPanel
              config={config}
              batchCount={batchItems.length}
              batchRecognitionMode={batchRecognitionMode}
              onChangeBatchRecognitionMode={onChangeBatchRecognitionMode}
              recognitionModel={recognitionModel}
              onChangeRecognitionModel={onChangeRecognitionModel}
              isAnalyzing={isAnalyzing}
              onChangeConfig={onChange}
              onReRecognize={(opts) => {
                void onAnalyzeWithAi(opts);
              }}
              onApplyToAllMultiChannel={onApplyToAllMultiChannel}
            />

            <hr className="border-slate-200" />

            <section className="space-y-3.5">
              <h2 className="text-sm font-bold text-slate-900">Thông tin hiển thị trực tiếp trên khung ảnh</h2>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Tên sản phẩm
                </label>
                <input
                  type="text"
                  value={config.productName}
                  onChange={(e) => onChange({ productName: e.target.value })}
                  placeholder="Ví dụ: Hệ Thống Lọc Nước RO 500L/h"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Mã Model</label>
                  <input
                    type="text"
                    value={config.modelCode}
                    onChange={(e) => onChange({ modelCode: e.target.value })}
                    placeholder="VT-RO500"
                    className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Nhóm thiết bị
                  </label>
                  <input
                    type="text"
                    value={config.category}
                    onChange={(e) => onChange({ category: e.target.value })}
                    placeholder="Lọc nước RO"
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Dòng mô tả ngắn (Tagline)
                </label>
                <input
                  type="text"
                  value={config.tagline}
                  onChange={(e) => onChange({ tagline: e.target.value })}
                  placeholder="Nước tinh khiết đạt chuẩn QCVN 6-1:2010/BYT"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    3 Thông số kỹ thuật nổi bật
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showSpecsPanel}
                      onChange={(e) => onChange({ showSpecsPanel: e.target.checked })}
                      className="rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                    />
                    <span>Hiển thị</span>
                  </label>
                </div>

                {([0, 1, 2] as const).map((idx) => (
                  <input
                    key={idx}
                    type="text"
                    value={config.specs[idx]}
                    onChange={(e) => updateSpec(idx, e.target.value)}
                    placeholder={`Thông số nổi bật ${idx + 1}`}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                  />
                ))}
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700">
                    Tem nhấn (Bảo hành / Ưu đãi)
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showPriceBadge}
                      onChange={(e) => onChange({ showPriceBadge: e.target.checked })}
                      className="rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                    />
                    <span>Hiển thị</span>
                  </label>
                </div>
                <input
                  type="text"
                  value={config.priceBadge}
                  onChange={(e) => onChange({ priceBadge: e.target.value })}
                  placeholder="Ví dụ: Bảo hành 24 tháng"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                />
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Company Contact Bar */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Thông tin liên hệ doanh nghiệp</h2>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.showContactFooter}
                    onChange={(e) => onChange({ showContactFooter: e.target.checked })}
                    className="rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                  />
                  <span>Hiện thanh chân</span>
                </label>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Tên công ty</label>
                <input
                  type="text"
                  value={config.companyName}
                  onChange={(e) => onChange({ companyName: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">Hotline</label>
                <input
                  type="text"
                  value={config.hotline}
                  onChange={(e) => onChange({ hotline: e.target.value })}
                  placeholder="Hotline: 09.6759.6739"
                  className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">Website</label>
                  <input
                    type="text"
                    value={config.website}
                    onChange={(e) => onChange({ website: e.target.value })}
                    placeholder="Cập nhật sau"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Trang Facebook
                  </label>
                  <input
                    type="text"
                    value={config.facebookPage}
                    onChange={(e) => onChange({ facebookPage: e.target.value })}
                    placeholder="Cập nhật sau"
                    className="w-full px-3 py-2 text-xs font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
                  />
                </div>
              </div>
            </section>
          </>
        )}

        {inspectorTab === 'brand' && (
          <>
            {/* Logo Controls */}
            <section className="space-y-3.5">
              <h2 className="text-sm font-bold text-slate-900">Logo & Watermark VUTECH</h2>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'full-and-watermark', label: 'Logo + Dấu chìm' },
                    { id: 'full', label: 'Logo ngang đầy đủ' },
                    { id: 'icon-and-watermark', label: 'Icon V + Dấu chìm' },
                    { id: 'icon', label: 'Chỉ Icon V' },
                  ] as Array<{ id: LogoMode; label: string }>
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onChange({ logoMode: item.id })}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                      config.logoMode === item.id
                        ? 'border-[#0052B4] bg-[#0052B4]/8 text-[#0052B4]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-semibold text-slate-700">Vị trí Logo</span>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'top-left', label: 'Góc trái' },
                      { id: 'top-center', label: 'Chính giữa' },
                      { id: 'top-right', label: 'Góc phải' },
                    ] as Array<{ id: LogoPosition; label: string }>
                  ).map((pos) => (
                    <button
                      key={pos.id}
                      type="button"
                      onClick={() => onChange({ logoPosition: pos.id })}
                      className={`py-1.5 px-2 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                        config.logoPosition === pos.id
                          ? 'border-[#0052B4] bg-[#0052B4] text-white'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Kích thước Logo</span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    {Math.round(config.logoScale * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.65}
                  max={1.4}
                  step={0.05}
                  value={config.logoScale}
                  onChange={(e) => onChange({ logoScale: Number(e.target.value) })}
                  className="w-full studio-slider"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">Độ rõ dấu chìm bản quyền</span>
                  <span className="font-mono text-slate-500 tabular-nums">
                    {Math.round(config.watermarkOpacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.03}
                  max={0.25}
                  step={0.01}
                  value={config.watermarkOpacity}
                  onChange={(e) => onChange({ watermarkOpacity: Number(e.target.value) })}
                  className="w-full studio-slider"
                />
              </div>

              <label className="flex items-center justify-between pt-1 cursor-pointer">
                <span className="text-xs font-semibold text-slate-700">
                  Tự động lọc trong suốt nền trắng logo
                </span>
                <input
                  type="checkbox"
                  checked={config.removeLogoBg}
                  onChange={(e) => onChange({ removeLogoBg: e.target.checked })}
                  className="rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                />
              </label>
            </section>

            <hr className="border-slate-200" />

            {/* Backdrop & Framing */}
            <section className="space-y-3.5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Nền Studio & Căn khung</h2>
                <button
                  type="button"
                  onClick={onResetAdjustments}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#0052B4] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Mặc định</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'pure-white', label: 'Trắng tinh khiết' },
                    { id: 'vutech-ice', label: 'Xanh băng VUTECH' },
                    { id: 'studio-gray', label: 'Xám Studio' },
                    { id: 'deep-navy', label: 'Xanh đậm Kỹ thuật' },
                  ] as Array<{ id: BackdropPreset; label: string }>
                ).map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => onChange({ backdrop: bg.id })}
                    className={`py-2 px-2.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                      config.backdrop === bg.id
                        ? 'border-[#0052B4] bg-[#0052B4]/8 text-[#0052B4]'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => onChange({ fitMode: 'contain' })}
                  className={`py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
                    config.fitMode === 'contain'
                      ? 'border-[#0052B4] bg-[#0052B4] text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Giữ nguyên tỷ lệ máy
                </button>
                <button
                  type="button"
                  onClick={() => onChange({ fitMode: 'cover' })}
                  className={`py-1.5 text-xs font-semibold rounded-md border cursor-pointer ${
                    config.fitMode === 'cover'
                      ? 'border-[#0052B4] bg-[#0052B4] text-white'
                      : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  Phủ đầy khung ảnh
                </button>
              </div>

              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-slate-700">Thu phóng sản phẩm</span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {Math.round(config.productScale * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.02}
                    value={config.productScale}
                    onChange={(e) => onChange({ productScale: Number(e.target.value) })}
                    className="w-full studio-slider"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Dịch ngang</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {config.productOffsetX}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      step={1}
                      value={config.productOffsetX}
                      onChange={(e) => onChange({ productOffsetX: Number(e.target.value) })}
                      className="w-full studio-slider"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Dịch dọc</span>
                      <span className="font-mono text-slate-500 tabular-nums">
                        {config.productOffsetY}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-45}
                      max={45}
                      step={1}
                      value={config.productOffsetY}
                      onChange={(e) => onChange({ productOffsetY: Number(e.target.value) })}
                      className="w-full studio-slider"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onOpenZoomModal}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/14 rounded-md transition-colors cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Kéo thả căn chỉnh trực tiếp trong cửa sổ Zoom</span>
                </button>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Crispness & Lighting */}
            <section className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900">Ánh sáng & Độ sắc nét</h2>

              {(
                [
                  { key: 'brightness', label: 'Độ sáng', min: 80, max: 130, unit: '%' },
                  { key: 'contrast', label: 'Độ tương phản', min: 80, max: 135, unit: '%' },
                  { key: 'saturation', label: 'Độ tươi màu', min: 70, max: 135, unit: '%' },
                  { key: 'sharpness', label: 'Tăng cường sắc nét', min: 0, max: 100, unit: '' },
                ] as const
              ).map((ctrl) => (
                <div key={ctrl.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-700 font-medium">{ctrl.label}</span>
                    <span className="font-mono text-slate-500 tabular-nums">
                      {config[ctrl.key]}
                      {ctrl.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={ctrl.min}
                    max={ctrl.max}
                    step={1}
                    value={config[ctrl.key]}
                    onChange={(e) => onChange({ [ctrl.key]: Number(e.target.value) })}
                    className="w-full studio-slider"
                  />
                </div>
              ))}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}
