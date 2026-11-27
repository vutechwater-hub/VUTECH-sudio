import { useEffect, useRef, useState } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Eye,
  Move,
  Crosshair,
  Sparkles,
  Search,
} from 'lucide-react';
import { ASPECT_RATIOS, getExportDimensions } from '../constants/vutech';
import type { AspectRatioOption, StudioConfig } from '../types/studio';
import { renderStudioCanvas } from '../utils/canvasRenderer';

interface ProductZoomModalProps {
  open: boolean;
  config: StudioConfig;
  onChangeConfig: (patch: Partial<StudioConfig>) => void;
  onClose: () => void;
  onExportCurrent: () => Promise<void>;
  isExporting: boolean;
}

const INSPECT_ZOOM_PRESETS = [
  { label: 'Vừa khung', value: 1 },
  { label: '125%', value: 1.25 },
  { label: '150%', value: 1.5 },
  { label: '200%', value: 2 },
  { label: '300%', value: 3 },
];

type ModalMode = 'frame' | 'inspect';

export function ProductZoomModal({
  open,
  config,
  onChangeConfig,
  onClose,
  onExportCurrent,
  isExporting,
}: ProductZoomModalProps) {
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inspectCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [modalMode, setModalMode] = useState<ModalMode>('frame');
  const [showSubjectGuide, setShowSubjectGuide] = useState(true);

  // Frame drag state (adjusts config.productOffsetX / productOffsetY directly)
  const [isFramingDrag, setIsFramingDrag] = useState(false);
  const frameDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    startOffsetX: number;
    startOffsetY: number;
    canvasW: number;
    canvasH: number;
  } | null>(null);

  // Inspect zoom/pan state (magnifies rendered output without changing config)
  const [inspectZoom, setInspectZoom] = useState(1.25);
  const [inspectPan, setInspectPan] = useState({ x: 0, y: 0 });
  const [isInspectDrag, setIsInspectDrag] = useState(false);
  const [inspectDragOrigin, setInspectDragOrigin] = useState({ x: 0, y: 0 });
  const [inspectSource, setInspectSource] = useState<'branded' | 'original'>('branded');

  const exportDims = getExportDimensions(config.aspectRatio, config.resolution);

  // Reset modal transient states whenever opened
  useEffect(() => {
    if (!open) return;
    setModalMode('frame');
    setShowSubjectGuide(true);
    setInspectZoom(1.25);
    setInspectPan({ x: 0, y: 0 });
    setInspectSource('branded');
  }, [open]);

  // Escape key closes modal
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Render live interactive canvas in Frame mode (snappy ~1280px max edge)
  useEffect(() => {
    if (!open || modalMode !== 'frame') return;
    const canvas = frameCanvasRef.current;
    if (!canvas) return;

    const maxEdge = Math.min(1280, Math.max(exportDims.width, exportDims.height));
    const scale = maxEdge / Math.max(exportDims.width, exportDims.height);
    renderStudioCanvas(canvas, config, {
      targetWidth: Math.round(exportDims.width * scale),
      targetHeight: Math.round(exportDims.height * scale),
      applySharpen: config.sharpness > 0 && !isFramingDrag,
      showSubjectGuide,
    }).catch(() => {});
  }, [
    open,
    modalMode,
    config,
    exportDims.width,
    exportDims.height,
    showSubjectGuide,
    isFramingDrag,
  ]);

  // Render high-detail canvas up to 2048px in Inspect mode
  useEffect(() => {
    if (!open || modalMode !== 'inspect' || inspectSource !== 'branded') return;
    const canvas = inspectCanvasRef.current;
    if (!canvas) return;

    const maxEdge = Math.min(2048, Math.max(exportDims.width, exportDims.height));
    const scale = maxEdge / Math.max(exportDims.width, exportDims.height);
    renderStudioCanvas(canvas, config, {
      targetWidth: Math.round(exportDims.width * scale),
      targetHeight: Math.round(exportDims.height * scale),
      applySharpen: config.sharpness > 0,
    }).catch(() => {});
  }, [open, modalMode, inspectSource, config, exportDims.width, exportDims.height]);

  if (!open) return null;

  const clampProductScale = (val: number) => Math.max(0.5, Math.min(2.5, Number(val.toFixed(2))));
  const clampProductOffset = (val: number) => Math.max(-45, Math.min(45, Math.round(val)));
  const clampInspectZoom = (val: number) => Math.max(0.5, Math.min(3.5, Number(val.toFixed(2))));

  // --- Frame mode interactions (edits real product scale & offset) ---
  const handleFrameWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.06 : -0.06;
    onChangeConfig({ productScale: clampProductScale(config.productScale + delta) });
  };

  const handleFramePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const canvasRect = frameCanvasRef.current?.getBoundingClientRect();
    if (!canvasRect || canvasRect.width === 0 || canvasRect.height === 0) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    setIsFramingDrag(true);
    frameDragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startOffsetX: config.productOffsetX,
      startOffsetY: config.productOffsetY,
      canvasW: canvasRect.width,
      canvasH: canvasRect.height,
    };
  };

  const handleFramePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isFramingDrag || !frameDragStartRef.current) return;
    const start = frameDragStartRef.current;
    // Canvas offsetX/offsetY maps 100% -> 100% of stage width/height (~80% of canvas width/height)
    const dxPct = ((e.clientX - start.clientX) / (start.canvasW * 0.85)) * 100;
    const dyPct = ((e.clientY - start.clientY) / (start.canvasH * 0.85)) * 100;
    onChangeConfig({
      productOffsetX: clampProductOffset(start.startOffsetX + dxPct),
      productOffsetY: clampProductOffset(start.startOffsetY + dyPct),
    });
  };

  const handleFramePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isFramingDrag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsFramingDrag(false);
    frameDragStartRef.current = null;
  };

  const handleResetFraming = () => {
    onChangeConfig({
      autoFrameSubject: true,
      productScale: 1,
      productOffsetX: 0,
      productOffsetY: 0,
    });
  };

  const handleApplyAspectRatio = (ratio: AspectRatioOption) => {
    onChangeConfig({ aspectRatio: ratio });
  };

  const handleApplyRecommendedRatio = () => {
    if (!config.recommendedAspectRatio) return;
    onChangeConfig({
      aspectRatio: config.recommendedAspectRatio,
      autoFrameSubject: true,
      productScale: 1,
      productOffsetX: 0,
      productOffsetY: 0,
    });
  };

  // --- Inspect mode interactions (magnifier zoom/pan only) ---
  const handleInspectWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setInspectZoom((prev) => clampInspectZoom(prev + delta));
  };

  const handleInspectPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsInspectDrag(true);
    setInspectDragOrigin({ x: e.clientX - inspectPan.x, y: e.clientY - inspectPan.y });
  };

  const handleInspectPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInspectDrag) return;
    setInspectPan({
      x: e.clientX - inspectDragOrigin.x,
      y: e.clientY - inspectDragOrigin.y,
    });
  };

  const handleInspectPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isInspectDrag) return;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsInspectDrag(false);
  };

  const resetInspectView = () => {
    setInspectZoom(1);
    setInspectPan({ x: 0, y: 0 });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cửa sổ Zoom và Căn chỉnh vùng ảnh sản phẩm"
      className="fixed inset-0 z-50 bg-slate-950/82 backdrop-blur-xs flex flex-col"
    >
      {/* Top Modal Header */}
      <div className="h-14 px-5 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <h2 className="text-sm font-bold text-slate-900 truncate max-w-[260px]">
            {config.productName || 'Zoom & Căn chỉnh sản phẩm'}
          </h2>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
          <span className="font-mono text-xs text-slate-500 tabular-nums whitespace-nowrap">
            {exportDims.width} × {exportDims.height} px · {config.aspectRatio} · {config.resolution}
          </span>
        </div>

        {/* Mode Switcher: Interactive Product Framing vs Detail Inspection */}
        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setModalMode('frame')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              modalMode === 'frame'
                ? 'bg-white text-[#0052B4] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Move className="w-3.5 h-3.5" />
            <span>Căn chỉnh & Zoom ảnh gốc</span>
          </button>
          <button
            type="button"
            onClick={() => setModalMode('inspect')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              modalMode === 'inspect'
                ? 'bg-white text-[#0052B4] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Soi chi tiết 100%–350%</span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {modalMode === 'inspect' && (
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setInspectSource('branded')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  inspectSource === 'branded'
                    ? 'bg-white text-[#0052B4] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Thành phẩm
              </button>
              <button
                type="button"
                onClick={() => setInspectSource('original')}
                className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  inspectSource === 'original'
                    ? 'bg-white text-[#0052B4] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Ảnh gốc</span>
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={onExportCurrent}
            disabled={isExporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Đang xuất...' : 'Tải ảnh'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng cửa sổ zoom"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Viewport Area */}
      {modalMode === 'frame' ? (
        <>
          {/* Live Interactive Product Framing Stage */}
          <div
            onWheel={handleFrameWheel}
            onPointerDown={handleFramePointerDown}
            onPointerMove={handleFramePointerMove}
            onPointerUp={handleFramePointerUp}
            onPointerCancel={handleFramePointerUp}
            className={`flex-1 overflow-hidden relative flex items-center justify-center p-5 select-none studio-grid-bg ${
              isFramingDrag ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div className="relative shadow-[0_24px_70px_rgba(0,0,0,0.34)] bg-white border border-slate-300/80">
              <canvas
                ref={frameCanvasRef}
                className="block max-h-[calc(100vh-16.5rem)] max-w-[calc(100vw-4rem)] w-auto h-auto object-contain pointer-events-none"
              />
            </div>

            {/* Subtle top-left live readout */}
            <div className="pointer-events-none absolute top-3.5 left-4 px-3 py-1.5 rounded-lg bg-slate-900/78 text-white text-[11px] font-medium flex items-center gap-2 backdrop-blur-xs">
              <span>Kéo ảnh để chỉnh vị trí sản phẩm · Cuộn chuột để Zoom ảnh gốc</span>
              <span aria-hidden="true" className="text-slate-400">
                ·
              </span>
              <span className="font-mono tabular-nums text-[#38BDF8]">
                Zoom {Math.round(config.productScale * 100)}% · X {config.productOffsetX > 0 ? '+' : ''}
                {config.productOffsetX}% · Y {config.productOffsetY > 0 ? '+' : ''}
                {config.productOffsetY}%
              </span>
            </div>
          </div>

          {/* Bottom Framing & Aspect Ratio Selection Panel */}
          <div className="px-5 py-3 bg-white border-t border-slate-200 space-y-2.5 shrink-0">
            {/* Row 1: Aspect Ratio Switcher + AI Recommended Ratio */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-800 whitespace-nowrap">
                  Chọn khung kích thước phù hợp:
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {ASPECT_RATIOS.map((ratio) => {
                    const active = config.aspectRatio === ratio.value;
                    const isRecommended = config.recommendedAspectRatio === ratio.value;
                    return (
                      <button
                        key={ratio.value}
                        type="button"
                        onClick={() => handleApplyAspectRatio(ratio.value)}
                        title={ratio.shortUse}
                        className={`px-2.5 py-1 text-xs font-mono font-semibold rounded-md border transition-colors cursor-pointer ${
                          active
                            ? 'border-[#0052B4] bg-[#0052B4] text-white'
                            : isRecommended
                            ? 'border-[#009EE3] bg-[#009EE3]/10 text-[#0052B4] hover:bg-[#009EE3]/20'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {ratio.value}
                        {isRecommended && !active ? ' ★' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>

              {config.recommendedAspectRatio && (
                <button
                  type="button"
                  onClick={handleApplyRecommendedRatio}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border transition-colors whitespace-nowrap cursor-pointer ${
                    config.aspectRatio === config.recommendedAspectRatio
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-[#0052B4]/30 bg-[#0052B4]/8 text-[#0052B4] hover:bg-[#0052B4]/15'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Tỷ lệ tối ưu theo dáng SP: {config.recommendedAspectRatio}
                    {config.aspectRatio === config.recommendedAspectRatio ? ' (Đang dùng)' : ' — Áp dụng'}
                  </span>
                </button>
              )}
            </div>

            {/* Row 2: Product Zoom, Position Sliders, Auto-Frame & Subject Guide Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
              <div className="flex items-center gap-4 flex-wrap">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.autoFrameSubject}
                    onChange={(e) => onChangeConfig({ autoFrameSubject: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                  />
                  <span>Tự động lấy khung theo sản phẩm AI</span>
                </label>

                <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showSubjectGuide}
                    onChange={(e) => setShowSubjectGuide(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#0052B4] focus:ring-[#0052B4]"
                  />
                  <span>Hiện khung nhận diện sản phẩm</span>
                </label>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                {/* Product Scale */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                    Zoom SP
                  </span>
                  <button
                    type="button"
                    aria-label="Thu nhỏ sản phẩm"
                    onClick={() =>
                      onChangeConfig({ productScale: clampProductScale(config.productScale - 0.1) })
                    }
                    className="p-1 text-slate-700 hover:text-[#0052B4] bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.02}
                    value={config.productScale}
                    onChange={(e) => onChangeConfig({ productScale: Number(e.target.value) })}
                    aria-label="Mức zoom sản phẩm"
                    className="w-24 studio-slider"
                  />
                  <button
                    type="button"
                    aria-label="Phóng to sản phẩm"
                    onClick={() =>
                      onChangeConfig({ productScale: clampProductScale(config.productScale + 0.1) })
                    }
                    className="p-1 text-slate-700 hover:text-[#0052B4] bg-slate-100 hover:bg-slate-200 rounded cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono text-xs font-bold text-slate-800 w-10 text-right tabular-nums">
                    {Math.round(config.productScale * 100)}%
                  </span>
                </div>

                {/* Horizontal Position */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 whitespace-nowrap">Ngang</span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={config.productOffsetX}
                    onChange={(e) => onChangeConfig({ productOffsetX: Number(e.target.value) })}
                    aria-label="Dịch ngang sản phẩm"
                    className="w-20 studio-slider"
                  />
                  <span className="font-mono text-xs text-slate-600 w-9 text-right tabular-nums">
                    {config.productOffsetX}%
                  </span>
                </div>

                {/* Vertical Position */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-600 whitespace-nowrap">Dọc</span>
                  <input
                    type="range"
                    min={-45}
                    max={45}
                    step={1}
                    value={config.productOffsetY}
                    onChange={(e) => onChangeConfig({ productOffsetY: Number(e.target.value) })}
                    aria-label="Dịch dọc sản phẩm"
                    className="w-20 studio-slider"
                  />
                  <span className="font-mono text-xs text-slate-600 w-9 text-right tabular-nums">
                    {config.productOffsetY}%
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleResetFraming}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 rounded-md cursor-pointer whitespace-nowrap"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>Căn giữa tự động</span>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* High-Detail Magnifier Viewport */}
          <div
            onWheel={handleInspectWheel}
            onPointerDown={handleInspectPointerDown}
            onPointerMove={handleInspectPointerMove}
            onPointerUp={handleInspectPointerUp}
            onPointerCancel={handleInspectPointerUp}
            className={`flex-1 overflow-hidden relative flex items-center justify-center select-none studio-grid-bg ${
              isInspectDrag ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          >
            <div
              style={{
                transform: `translate3d(${inspectPan.x}px, ${inspectPan.y}px, 0) scale(${inspectZoom})`,
                transition: isInspectDrag
                  ? 'none'
                  : 'transform 120ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              className="origin-center shadow-[0_24px_70px_rgba(0,0,0,0.32)] bg-white border border-slate-300/80"
            >
              {inspectSource === 'branded' ? (
                <canvas
                  ref={inspectCanvasRef}
                  className="block max-h-[calc(100vh-11rem)] max-w-[calc(100vw-6rem)] w-auto h-auto object-contain pointer-events-none"
                />
              ) : (
                <img
                  src={config.sourceImageUrl}
                  alt="Ảnh sản phẩm gốc phóng to"
                  referrerPolicy="no-referrer"
                  className="block max-h-[calc(100vh-11rem)] max-w-[calc(100vw-6rem)] w-auto h-auto object-contain pointer-events-none"
                />
              )}
            </div>
          </div>

          {/* Bottom Inspect Zoom Controls Bar */}
          <div className="px-5 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-4 shrink-0">
            <span className="text-xs text-slate-500">
              Chế độ kiểm tra độ nét · Cuộn chuột để phóng to/thu nhỏ · Kéo để di chuyển vùng soi
            </span>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1">
                {INSPECT_ZOOM_PRESETS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setInspectZoom(preset.value);
                      if (preset.value === 1) setInspectPan({ x: 0, y: 0 });
                    }}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                      Math.abs(inspectZoom - preset.value) < 0.03
                        ? 'border-[#0052B4] bg-[#0052B4]/10 text-[#0052B4]'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-label="Thu nhỏ"
                  onClick={() => setInspectZoom((z) => clampInspectZoom(z - 0.25))}
                  className="p-1.5 text-slate-700 hover:text-[#0052B4] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>

                <input
                  type="range"
                  min={0.5}
                  max={3.5}
                  step={0.05}
                  value={inspectZoom}
                  onChange={(e) => setInspectZoom(Number(e.target.value))}
                  aria-label="Mức phóng to soi chi tiết"
                  className="w-28 studio-slider"
                />

                <button
                  type="button"
                  aria-label="Phóng to"
                  onClick={() => setInspectZoom((z) => clampInspectZoom(z + 0.25))}
                  className="p-1.5 text-slate-700 hover:text-[#0052B4] bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>

                <span className="font-mono text-xs font-bold text-slate-800 w-11 text-right tabular-nums">
                  {Math.round(inspectZoom * 100)}%
                </span>

                <button
                  type="button"
                  onClick={resetInspectView}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Đặt lại</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
