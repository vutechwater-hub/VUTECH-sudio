import { useEffect, useRef, useState } from 'react';
import {
  Download,
  Layers,
  BookmarkPlus,
  Eye,
  Grid,
  Copy,
  Check,
  MessageSquareText,
  Sparkles,
  Expand,
  Loader2,
  ZoomIn,
} from 'lucide-react';
import { getExportDimensions } from '../constants/vutech';
import type { BatchProductItem, ExportFormat, StudioConfig } from '../types/studio';
import { renderStudioCanvas } from '../utils/canvasRenderer';
import { ProductZoomModal } from './ProductZoomModal';

interface CanvasStageProps {
  config: StudioConfig;
  batchItems: BatchProductItem[];
  activeItemId: string;
  onSelectBatchItem: (id: string) => void;
  onChangeConfig: (patch: Partial<StudioConfig>) => void;
  exportFormat: ExportFormat;
  onChangeExportFormat: (fmt: ExportFormat) => void;
  onExportCurrent: () => Promise<void>;
  onExportBundle: () => Promise<void>;
  onExportBatch: () => Promise<void>;
  onSaveToLibrary: () => Promise<void>;
  isExporting: boolean;
  isExportingBundle: boolean;
  batchExportProgress: string | null;
  isAnalyzing: boolean;
  analyzingCount: number;
  justSaved: boolean;
  isZoomOpen: boolean;
  onOpenZoom: () => void;
  onCloseZoom: () => void;
}

export function CanvasStage({
  config,
  batchItems,
  activeItemId,
  onSelectBatchItem,
  onChangeConfig,
  exportFormat,
  onChangeExportFormat,
  onExportCurrent,
  onExportBundle,
  onExportBatch,
  onSaveToLibrary,
  isExporting,
  isExportingBundle,
  batchExportProgress,
  isAnalyzing,
  analyzingCount,
  justSaved,
  isZoomOpen,
  onOpenZoom,
  onCloseZoom,
}: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showSafeGuides, setShowSafeGuides] = useState(false);
  const [showCaptionDrawer, setShowCaptionDrawer] = useState(false);
  const [copiedCaption, setCopiedCaption] = useState(false);

  const exportDims = getExportDimensions(config.aspectRatio, config.resolution);

  // Render live preview at crisp ~1100px max edge for instant 60fps feedback
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;

    const previewScale = Math.min(1, 1120 / Math.max(exportDims.width, exportDims.height));
    const pw = Math.round(exportDims.width * previewScale);
    const ph = Math.round(exportDims.height * previewScale);

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      renderStudioCanvas(canvas, config, {
        targetWidth: pw,
        targetHeight: ph,
        applySharpen: config.sharpness > 0,
      }).catch(() => {});
    }, 35);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [config, exportDims.width, exportDims.height]);

  const handleCopyCaption = async () => {
    if (!config.facebookCaption) return;
    try {
      await navigator.clipboard.writeText(config.facebookCaption);
      setCopiedCaption(true);
      window.setTimeout(() => setCopiedCaption(false), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const bgEffectsActive = config.backgroundBlurEnabled || config.extendBackground;
  const hasBatch = batchItems.length > 1;
  const activeIndex = Math.max(
    0,
    batchItems.findIndex((item) => item.id === activeItemId)
  );

  return (
    <main className="flex-1 min-w-0 flex flex-col lg:h-[calc(100vh-4rem)]">
      {/* Top Stage Context Bar */}
      <div className="px-6 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs text-slate-600 min-w-0">
          {hasBatch && (
            <>
              <span className="font-mono font-bold text-[#0052B4] tabular-nums shrink-0">
                Ảnh {activeIndex + 1}/{batchItems.length}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
            </>
          )}
          <span className="font-semibold text-slate-900 truncate max-w-[220px]">
            {config.productName || 'Sản phẩm chưa đặt tên'}
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono tabular-nums text-slate-700 font-medium">
            {exportDims.width} × {exportDims.height} px
          </span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono tabular-nums text-[#0052B4] font-semibold">
            {config.aspectRatio} · {config.resolution}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() =>
              onChangeConfig({
                backgroundBlurEnabled: !bgEffectsActive,
                extendBackground: !bgEffectsActive,
              })
            }
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              bgEffectsActive
                ? 'border-[#0052B4] bg-[#0052B4]/10 text-[#0052B4]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Expand className="w-3.5 h-3.5" />
            <span>{bgEffectsActive ? 'Đang làm mờ & mở rộng nền' : 'Làm mờ & mở rộng nền'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowOriginal((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              showOriginal
                ? 'border-[#0052B4] bg-[#0052B4]/10 text-[#0052B4]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{showOriginal ? 'Đang xem ảnh gốc' : 'So sánh ảnh gốc'}</span>
          </button>

          {config.recommendedAspectRatio &&
            config.recommendedAspectRatio !== config.aspectRatio && (
              <button
                type="button"
                onClick={() =>
                  onChangeConfig({
                    aspectRatio: config.recommendedAspectRatio,
                    autoFrameSubject: true,
                    productScale: 1,
                    productOffsetX: 0,
                    productOffsetY: 0,
                  })
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-[#009EE3]/40 bg-[#009EE3]/10 text-[#0052B4] hover:bg-[#009EE3]/18 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Gợi ý khung {config.recommendedAspectRatio}</span>
              </button>
            )}

          <button
            type="button"
            onClick={onOpenZoom}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-200 bg-white text-slate-700 hover:border-[#0052B4] hover:text-[#0052B4] transition-colors whitespace-nowrap cursor-pointer"
          >
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Zoom & Căn chỉnh SP</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSafeGuides((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              showSafeGuides
                ? 'border-[#0052B4] bg-[#0052B4]/10 text-[#0052B4]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Lưới an toàn</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCaptionDrawer((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
              showCaptionDrawer
                ? 'border-[#0052B4] bg-[#0052B4]/10 text-[#0052B4]'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <MessageSquareText className="w-3.5 h-3.5" />
            <span>Bài đăng Facebook</span>
          </button>
        </div>
      </div>

      {/* Main Focal Canvas Viewport */}
      <div className="flex-1 studio-grid-bg relative overflow-auto flex items-center justify-center p-6 lg:p-8">
        {(isAnalyzing || analyzingCount > 0) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-2 px-4 py-2 bg-[#072A5E] text-white text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-[#38BDF8]" />
            <span>
              {analyzingCount > 1
                ? `AI đang tự động nhận diện đồng loạt ${analyzingCount} sản phẩm...`
                : 'AI đang nhận diện thiết bị lọc nước & cập nhật thông tin sản phẩm...'}
            </span>
          </div>
        )}

        <div className="relative max-w-full max-h-full flex items-center justify-center">
          <div
            onClick={onOpenZoom}
            title="Nhấn để mở cửa sổ Zoom & Căn chỉnh vùng ảnh sản phẩm"
            className="relative shadow-[0_20px_50px_rgba(7,42,94,0.14)] rounded-sm overflow-hidden bg-white border border-slate-300/70 cursor-zoom-in"
          >
            <canvas
              ref={canvasRef}
              className={`block ${
                hasBatch ? 'max-h-[calc(100vh-19rem)]' : 'max-h-[calc(100vh-15.5rem)]'
              } max-w-[min(860px,calc(100vw-440px))] w-auto h-auto object-contain ${
                showOriginal ? 'hidden' : 'block'
              }`}
            />

            {showOriginal && (
              <div
                className={`relative flex items-center justify-center bg-slate-100 ${
                  hasBatch ? 'max-h-[calc(100vh-19rem)]' : 'max-h-[calc(100vh-15.5rem)]'
                } max-w-[min(860px,calc(100vw-440px))]`}
              >
                <img
                  src={config.sourceImageUrl}
                  alt="Ảnh sản phẩm gốc chưa xử lý"
                  referrerPolicy="no-referrer"
                  className={`block ${
                    hasBatch ? 'max-h-[calc(100vh-19rem)]' : 'max-h-[calc(100vh-15.5rem)]'
                  } max-w-full w-auto h-auto object-contain`}
                />
              </div>
            )}

            {/* Safe Zone Overlay — Automatically switches to Shopee Badge Safe Zone on Shopee templates */}
            {showSafeGuides && !showOriginal && (
              <div className="pointer-events-none absolute inset-0">
                {config.template === 'shopee-cover' || config.template === 'shopee-detail' ? (
                  <>
                    {/* Top-left Shopee Mall / Yêu thích hazard */}
                    <div className="absolute top-0 left-0 w-[26%] h-[11%] bg-[#EE4D2D]/16 border-b border-r border-dashed border-[#EE4D2D]/70 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-[#EE4D2D] bg-white/85 px-1 rounded">
                        Tem Mall / Yêu thích
                      </span>
                    </div>
                    {/* Top-right Shopee % Discount hazard */}
                    <div className="absolute top-0 right-0 w-[18%] h-[14%] bg-[#EE4D2D]/18 border-b border-l border-dashed border-[#EE4D2D]/70 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-[#EE4D2D] bg-white/85 px-1 rounded">
                        Giảm %
                      </span>
                    </div>
                    {/* Bottom Freeship Xtra / Voucher overlay hazard */}
                    <div className="absolute bottom-0 inset-x-0 h-[16.5%] bg-[#EE4D2D]/14 border-t border-dashed border-[#EE4D2D]/75 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-[#B91C1C] bg-white/90 px-2 py-0.5 rounded">
                        Vùng tem Freeship Xtra · Voucher Xtra Shopee (Tránh đặt chi tiết quan trọng)
                      </span>
                    </div>
                    {/* Safe centered product zone */}
                    <div className="absolute top-[12%] bottom-[16.5%] left-[6%] right-[6%] border border-dashed border-[#009EE3]" />
                  </>
                ) : (
                  <>
                    <div className="absolute inset-[5%] border border-dashed border-[#009EE3]/80" />
                    <div className="absolute inset-y-0 left-1/2 w-px bg-[#009EE3]/35" />
                    <div className="absolute inset-x-0 top-1/2 h-px bg-[#009EE3]/35" />
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Optional Facebook Caption Drawer */}
        {showCaptionDrawer && (
          <div className="absolute right-6 bottom-6 w-[380px] max-w-[calc(100%-3rem)] bg-white border border-slate-200 rounded-xl shadow-xl p-4 space-y-3 z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">
                Nội dung mẫu đăng Facebook VUTECH
              </h3>
              <button
                type="button"
                onClick={handleCopyCaption}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 rounded-md cursor-pointer"
              >
                {copiedCaption ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCaption ? 'Đã sao chép' : 'Sao chép'}</span>
              </button>
            </div>
            <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed max-h-52 overflow-y-auto bg-slate-50 p-3 rounded-lg border border-slate-200">
              {config.facebookCaption ||
                'Hệ thống AI sẽ tự động viết nội dung đăng Facebook ngay khi bạn tải ảnh sản phẩm lên.'}
            </p>
          </div>
        )}
      </div>

      {/* Horizontal Batch Filmstrip Bar (Shown when 2–5 images are loaded) */}
      {hasBatch && (
        <div className="px-6 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center gap-2.5 overflow-x-auto">
          <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap shrink-0">
            Đợt xử lý ({batchItems.length}/5):
          </span>
          {batchItems.map((item, idx) => {
            const active = item.id === activeItemId;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectBatchItem(item.id)}
                className={`inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'border-[#0052B4] bg-white shadow-xs'
                    : 'border-slate-200 bg-white/70 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="relative w-7 h-7 rounded overflow-hidden bg-slate-100 shrink-0">
                  <img
                    src={item.config.sourceImageUrl}
                    alt={item.config.productName}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                  {item.status === 'analyzing' && (
                    <div className="absolute inset-0 bg-[#072A5E]/60 flex items-center justify-center">
                      <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-[11px] font-bold text-[#0052B4] tabular-nums">
                      #{idx + 1}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 max-w-[130px] truncate">
                      {item.config.productName || item.config.sourceImageName}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom Export Action Bar */}
      <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => onChangeExportFormat('png')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                exportFormat === 'png'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              PNG Sắc nét
            </button>
            <button
              type="button"
              onClick={() => onChangeExportFormat('jpeg')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                exportFormat === 'jpeg'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              JPG Tối ưu Web
            </button>
          </div>

          <button
            type="button"
            onClick={onSaveToLibrary}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            {justSaved ? (
              <Check className="w-4 h-4 text-emerald-600" />
            ) : (
              <BookmarkPlus className="w-4 h-4" />
            )}
            <span>{justSaved ? 'Đã lưu mẫu' : 'Lưu mẫu'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={onExportBundle}
            disabled={isExportingBundle || Boolean(batchExportProgress)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
          >
            <Layers className="w-4 h-4 shrink-0 text-[#0052B4]" />
            <span>
              {isExportingBundle ? 'Đang xuất 4 khung...' : 'Xuất 4 khung Web/FB/Shopee'}
            </span>
          </button>

          <button
            type="button"
            onClick={onExportCurrent}
            disabled={isExporting || Boolean(batchExportProgress)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60 ${
              hasBatch
                ? 'text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 border border-[#0052B4]/25'
                : 'text-white bg-[#0052B4] hover:bg-[#072A5E]'
            }`}
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>
              {isExporting
                ? 'Đang kết xuất...'
                : hasBatch
                ? `Tải ảnh #${activeIndex + 1}`
                : `Tải ảnh ${config.aspectRatio} · ${config.resolution}`}
            </span>
          </button>

          {hasBatch && (
            <button
              type="button"
              onClick={onExportBatch}
              disabled={Boolean(batchExportProgress) || isExporting}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-lg transition-colors whitespace-nowrap cursor-pointer disabled:opacity-60"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>
                {batchExportProgress ??
                  `Xuất cả đợt (${batchItems.length} ảnh · ${config.resolution})`}
              </span>
            </button>
          )}
        </div>
      </div>
      <ProductZoomModal
        open={isZoomOpen}
        config={config}
        onChangeConfig={onChangeConfig}
        onClose={onCloseZoom}
        onExportCurrent={onExportCurrent}
        isExporting={isExporting}
      />
    </main>
  );
}
