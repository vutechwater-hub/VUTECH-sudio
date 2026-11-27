import { useRef, useState } from 'react';
import {
  X,
  Check,
  RefreshCw,
  Download,
  Upload,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Copy,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ZoomIn,
  ZoomOut,
  Plus,
  Trash2,
} from 'lucide-react';
import { FACEBOOK_RATIO_PRESETS } from '../constants/platformRegistry';
import type {
  DesignGroupId,
  FacebookRatioKey,
  GroupImageAsset,
  GroupRuntimeSettings,
  OutputFileFormat,
  PlatformStandardEntry,
  ValidationStatus,
  WatermarkCorner,
  WatermarkPlacementMode,
} from '../types/multichannel';
import type { StudioConfig } from '../types/studio';

interface GroupGalleryModalProps {
  open: boolean;
  standard: PlatformStandardEntry | null;
  settings: GroupRuntimeSettings | null;
  assets: GroupImageAsset[];
  studioConfig: StudioConfig;
  initialAssetId?: string;
  onClose: () => void;
  onUpdateSettings: (groupId: DesignGroupId, patch: Partial<GroupRuntimeSettings>) => void;
  onUpdateAsset: (groupId: DesignGroupId, assetId: string, patch: Partial<GroupImageAsset>) => void;
  onReorderAssets: (groupId: DesignGroupId, fromIndex: number, toIndex: number) => void;
  onRegenerateAsset: (groupId: DesignGroupId, assetId: string) => Promise<void>;
  onGenerateGroup: (groupId: DesignGroupId, forceApproved?: boolean) => Promise<void>;
  onUploadWatermarkBatch: (files: File[]) => Promise<void>;
  onRemoveWatermarkAsset: (assetId: string) => void;
  onOpenExportForAsset: (groupId: DesignGroupId, assetId: string) => void;
  onOpenExportForGroup: (groupId: DesignGroupId) => void;
}

function StatusLabel({ status }: { status: ValidationStatus }) {
  if (status === 'pass') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5" />
        Đạt quy chuẩn
      </span>
    );
  }
  if (status === 'warning') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
        <AlertTriangle className="w-3.5 h-3.5" />
        Cần kiểm tra lại
      </span>
    );
  }
  if (status === 'fail') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
        <XCircle className="w-3.5 h-3.5" />
        Không đạt quy chuẩn
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
      <Clock className="w-3.5 h-3.5" />
      Chưa tạo / Thiếu dữ liệu
    </span>
  );
}

export function GroupGalleryModal({
  open,
  standard,
  settings,
  assets,
  initialAssetId,
  onClose,
  onUpdateSettings,
  onUpdateAsset,
  onReorderAssets,
  onRegenerateAsset,
  onGenerateGroup,
  onUploadWatermarkBatch,
  onRemoveWatermarkAsset,
  onOpenExportForAsset,
  onOpenExportForGroup,
}: GroupGalleryModalProps) {
  const [selectedId, setSelectedId] = useState<string>(initialAssetId || assets[0]?.id || '');
  const [zoomPct, setZoomPct] = useState(100);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [copiedAlt, setCopiedAlt] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

  const customImgInputRef = useRef<HTMLInputElement | null>(null);
  const wmBatchInputRef = useRef<HTMLInputElement | null>(null);

  if (!open || !standard || !settings) return null;

  const activeAsset = assets.find((a) => a.id === selectedId) ?? assets[0];
  if (!activeAsset) return null;

  const isShopeeCover = standard.id === '01_shopee_cover';
  const isWebGroup = standard.id === '03_web_clean';
  const isFacebookGroup = standard.id === '04_facebook_ads';
  const isWatermarkGroup = standard.id === '07_copyright_watermark';

  const handleUploadSlideSource = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        onUpdateAsset(standard.id, activeAsset.id, {
          customSourceUrl: reader.result,
          customSourceName: file.name,
        });
        setRegeneratingId(activeAsset.id);
        try {
          await onRegenerateAsset(standard.id, activeAsset.id);
        } finally {
          setRegeneratingId(null);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleUploadWmFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files).filter((f) => f.type.startsWith('image/')) : [];
    if (files.length > 0) {
      await onUploadWatermarkBatch(files);
    }
    e.target.value = '';
  };

  const toggleFacebookRatio = (ratio: FacebookRatioKey) => {
    const exists = settings.facebookRatios.includes(ratio);
    if (exists && settings.facebookRatios.length <= 1) return;
    const next = exists
      ? settings.facebookRatios.filter((r) => r !== ratio)
      : [...settings.facebookRatios, ratio];
    onUpdateSettings(standard.id, { facebookRatios: next });
  };

  const handleCopyAlt = async () => {
    try {
      await navigator.clipboard.writeText(activeAsset.altText);
      setCopiedAlt(true);
      window.setTimeout(() => setCopiedAlt(false), 1800);
    } catch {
      // ignore
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Thư viện ảnh ${standard.name}`}
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 lg:p-5"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[1380px] h-[92vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0 bg-white">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-slate-900 truncate">{standard.name}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {standard.platform} · Kéo thả danh sách bên trái để đổi thứ tự · Ảnh đã duyệt sẽ được bảo vệ không ghi đè
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            {isShopeeCover && (
              <button
                type="button"
                onClick={() =>
                  onUpdateSettings(standard.id, {
                    shopeePreviewOverlay: !settings.shopeePreviewOverlay,
                  })
                }
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  settings.shopeePreviewOverlay
                    ? 'border-[#EE4D2D]/40 bg-[#EE4D2D]/10 text-[#D03216]'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {settings.shopeePreviewOverlay ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                <span>Xem trước giao diện Shopee (Chỉ Preview)</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => void onGenerateGroup(standard.id, false)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tạo / Cập nhật nhóm</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenExportForGroup(standard.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Tải trọn nhóm</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Đóng thư viện nhóm"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3-Column Workspace: Left Slide List | Center Zoom Preview | Right Config & Validation */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left: Draggable Slide List */}
          <div className="lg:col-span-3 border-r border-slate-200 bg-slate-50/70 flex flex-col min-h-0">
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-white">
              <span className="text-xs font-bold text-slate-800">
                Danh sách ảnh ({assets.filter((a) => !a.skipped).length}/{assets.length})
              </span>
              {isWatermarkGroup && (
                <>
                  <input
                    ref={wmBatchInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleUploadWmFiles}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => wmBatchInputRef.current?.click()}
                    className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-md cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Thêm ảnh gốc</span>
                  </button>
                </>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5">
              {assets.map((asset, index) => {
                const isSelected = asset.id === activeAsset.id;
                const dotColor =
                  asset.validation.status === 'pass'
                    ? 'bg-emerald-500'
                    : asset.validation.status === 'warning'
                    ? 'bg-amber-500'
                    : asset.validation.status === 'fail'
                    ? 'bg-red-500'
                    : 'bg-slate-400';

                return (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={() => setDragIdx(index)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== index) {
                        onReorderAssets(standard.id, dragIdx, index);
                      }
                      setDragIdx(null);
                    }}
                    onClick={() => setSelectedId(asset.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(asset.id);
                      }
                    }}
                    className={`flex items-center gap-2 p-2 rounded-lg border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-[#0052B4] bg-white shadow-xs'
                        : 'border-slate-200 bg-white/80 hover:border-slate-300'
                    } ${asset.skipped ? 'opacity-50' : ''}`}
                  >
                    <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab" />
                    <div className="w-11 h-11 rounded bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {asset.previewDataUrl ? (
                        <img
                          src={asset.previewDataUrl}
                          alt={asset.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="font-mono text-[10px] text-slate-400">
                          #{String(asset.slotIndex).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`} />
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {asset.shortTitle}
                        </p>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {asset.status === 'missing-data'
                          ? 'Cần bổ sung tài liệu kỹ thuật'
                          : asset.skipped
                          ? 'Đã bỏ qua khi xuất'
                          : asset.fileSizeBytes > 0
                          ? `${asset.renderedWidth}×${asset.renderedHeight} · ${Math.round(asset.fileSizeBytes / 1024)} KB`
                          : 'Chưa tạo ảnh'}
                      </p>
                    </div>
                    {asset.approved && <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                    {isWatermarkGroup && assets.length > 1 && (
                      <button
                        type="button"
                        aria-label="Xóa ảnh khỏi nhóm đóng dấu"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveWatermarkAsset(asset.id);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Center: Zoomable Live Preview */}
          <div className="lg:col-span-5 studio-grid-bg flex flex-col min-h-0 relative overflow-hidden">
            <div className="flex-1 overflow-auto flex items-center justify-center p-6">
              {activeAsset.previewDataUrl ? (
                <div
                  style={{
                    transform: `scale(${zoomPct / 100})`,
                    transition: 'transform 140ms ease-out',
                  }}
                  className="relative origin-center shadow-xl border border-slate-300/80 bg-white"
                >
                  <img
                    src={activeAsset.previewDataUrl}
                    alt={activeAsset.altText}
                    className="block max-h-[58vh] max-w-full w-auto h-auto object-contain"
                  />

                  {/* PURE PREVIEW OVERLAY FOR SHOPEE — NEVER BAKED INTO EXPORTED FILE */}
                  {isShopeeCover && settings.shopeePreviewOverlay && (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                      <div className="absolute top-2 left-0 bg-[#EE4D2D] text-white text-[11px] font-bold px-2 py-0.5 rounded-r-xs shadow-xs">
                        Yêu thích+
                      </div>
                      <div className="absolute top-0 right-0 bg-[#FFD424] text-[#EE4D2D] text-[11px] font-extrabold px-2 py-0.5 text-center leading-tight shadow-xs">
                        <div>15%</div>
                        <div className="text-[9px] font-bold text-slate-900">GIẢM</div>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-r from-[#00BFA5] via-[#00A88F] to-[#EE4D2D] text-white text-[11px] font-bold px-3 py-1.5 flex items-center justify-between opacity-92">
                        <span>FREESHIP XTRA</span>
                        <span>VOUCHER XTRA</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-w-md text-center bg-white border border-slate-200 rounded-xl p-6 space-y-3 shadow-xs">
                  <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-900">
                    {activeAsset.status === 'missing-data'
                      ? 'Cần bổ sung tài liệu kỹ thuật xác thực'
                      : 'Chưa kết xuất ảnh cho vị trí này'}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {activeAsset.status === 'missing-data'
                      ? 'Hệ thống không tự bịa bản vẽ kích thước, sơ đồ cấu tạo hay chứng nhận bằng AI. Vui lòng tải ảnh tài liệu thật hoặc nhập thông số kỹ thuật đã xác thực ở cột bên phải.'
                      : activeAsset.description}
                  </p>
                  <button
                    type="button"
                    onClick={async () => {
                      setRegeneratingId(activeAsset.id);
                      try {
                        await onRegenerateAsset(standard.id, activeAsset.id);
                      } finally {
                        setRegeneratingId(null);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-lg cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Tạo ảnh ngay</span>
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Zoom & Quick Slide Actions */}
            <div className="px-4 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.max(50, z - 25))}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-xs font-semibold text-slate-800 w-11 text-center tabular-nums">
                  {zoomPct}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoomPct((z) => Math.min(250, z + 25))}
                  className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateAsset(standard.id, activeAsset.id, {
                      approved: !activeAsset.approved,
                    })
                  }
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md border transition-colors cursor-pointer ${
                    activeAsset.approved
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {activeAsset.approved ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                  <span>{activeAsset.approved ? 'Đã duyệt' : 'Duyệt ảnh'}</span>
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setRegeneratingId(activeAsset.id);
                    try {
                      await onRegenerateAsset(standard.id, activeAsset.id);
                    } finally {
                      setRegeneratingId(null);
                    }
                  }}
                  disabled={regeneratingId === activeAsset.id}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/15 rounded-md cursor-pointer"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      regeneratingId === activeAsset.id ? 'animate-spin' : ''
                    }`}
                  />
                  <span>Tạo lại</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenExportForAsset(standard.id, activeAsset.id)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-md cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Tải ảnh này</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Per-Group Config, Slide Data Input & Validation Engine Report */}
          <div className="lg:col-span-4 border-l border-slate-200 bg-white overflow-y-auto p-5 space-y-5">
            {/* Group Output Config */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Cấu hình riêng của nhóm
              </h3>

              {!isFacebookGroup && !isWatermarkGroup && (
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Tỷ lệ & Kích thước xuất
                  </label>
                  <select
                    value={settings.sizeId}
                    onChange={(e) => onUpdateSettings(standard.id, { sizeId: e.target.value })}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    {standard.sizeOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {isFacebookGroup && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-700">
                      Chọn tỷ lệ xuất Facebook
                    </span>
                    <span className="font-mono text-[11px] font-bold text-[#0052B4] tabular-nums">
                      {assets.filter((a) => !a.skipped).length * settings.facebookRatios.length} file
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {FACEBOOK_RATIO_PRESETS.map((r) => {
                      const checked = settings.facebookRatios.includes(r.key);
                      return (
                        <label
                          key={r.key}
                          className="flex items-center justify-between p-2 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFacebookRatio(r.key)}
                              className="h-4 w-4 rounded border-slate-300 text-[#0052B4]"
                            />
                            <span className="text-xs font-semibold text-slate-800">{r.label}</span>
                          </div>
                          <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                            {r.width}×{r.height}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Watermark Group 07 Live Controls */}
              {isWatermarkGroup && (
                <div className="space-y-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="block text-xs font-bold text-slate-900">
                    Cấu hình đóng dấu Canvas (Không tốn API AI)
                  </span>

                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'corner', label: 'Góc ảnh' },
                        { id: 'center', label: 'Chìm giữa' },
                        { id: 'tiled', label: 'Lặp toàn ảnh' },
                      ] as Array<{ id: WatermarkPlacementMode; label: string }>
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings(standard.id, {
                            watermark: { ...settings.watermark, mode: m.id },
                          })
                        }
                        className={`py-1.5 text-[11px] font-semibold rounded-md border cursor-pointer ${
                          settings.watermark.mode === m.id
                            ? 'border-[#0052B4] bg-[#0052B4] text-white'
                            : 'border-slate-200 bg-white text-slate-700'
                        }`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>

                  {settings.watermark.mode === 'corner' && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'top-left', label: 'Trên trái' },
                          { id: 'top-right', label: 'Trên phải' },
                          { id: 'bottom-left', label: 'Dưới trái' },
                          { id: 'bottom-right', label: 'Dưới phải' },
                        ] as Array<{ id: WatermarkCorner; label: string }>
                      ).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() =>
                            onUpdateSettings(standard.id, {
                              watermark: { ...settings.watermark, corner: c.id },
                            })
                          }
                          className={`py-1 text-[11px] font-medium rounded border cursor-pointer ${
                            settings.watermark.corner === c.id
                              ? 'border-[#0052B4] bg-[#0052B4]/10 text-[#0052B4]'
                              : 'border-slate-200 bg-white text-slate-600'
                          }`}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Kích thước logo</span>
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {settings.watermark.logoScalePct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={40}
                      step={1}
                      value={settings.watermark.logoScalePct}
                      onChange={(e) =>
                        onUpdateSettings(standard.id, {
                          watermark: {
                            ...settings.watermark,
                            logoScalePct: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full studio-slider"
                    />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-600">Độ rõ (5% – 100%)</span>
                      <span className="font-mono font-semibold text-slate-800 tabular-nums">
                        {settings.watermark.opacityPct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={5}
                      max={100}
                      step={5}
                      value={settings.watermark.opacityPct}
                      onChange={(e) =>
                        onUpdateSettings(standard.id, {
                          watermark: {
                            ...settings.watermark,
                            opacityPct: Number(e.target.value),
                          },
                        })
                      }
                      className="w-full studio-slider"
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">Định dạng</label>
                  <select
                    value={settings.format}
                    onChange={(e) =>
                      onUpdateSettings(standard.id, {
                        format: e.target.value as OutputFileFormat,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs font-mono uppercase bg-white border border-slate-300 rounded-lg"
                  >
                    {standard.allowedFormats.map((fmt) => (
                      <option key={fmt} value={fmt}>
                        {fmt.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Chất lượng nén ({Math.round(settings.quality * 100)}%)
                  </label>
                  <input
                    type="range"
                    min={0.65}
                    max={1}
                    step={0.02}
                    value={settings.quality}
                    onChange={(e) =>
                      onUpdateSettings(standard.id, { quality: Number(e.target.value) })
                    }
                    className="w-full studio-slider mt-2"
                  />
                </div>
              </div>
            </section>

            <hr className="border-slate-200" />

            {/* Per-Slide Data & Custom Source Replacement */}
            <section className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Dữ liệu riêng ảnh #{activeAsset.slotIndex}
                </h3>
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeAsset.skipped}
                    onChange={(e) =>
                      onUpdateAsset(standard.id, activeAsset.id, { skipped: e.target.checked })
                    }
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#0052B4]"
                  />
                  <span>Bỏ qua ảnh này</span>
                </label>
              </div>

              <p className="text-xs font-semibold text-slate-900">{activeAsset.title}</p>

              <div className="flex items-center gap-2">
                <input
                  ref={customImgInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleUploadSlideSource}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => customImgInputRef.current?.click()}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#0052B4] bg-[#0052B4]/8 hover:bg-[#0052B4]/14 rounded-lg cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>
                    {activeAsset.customSourceName
                      ? `Thay ảnh (${activeAsset.customSourceName.slice(0, 16)})`
                      : 'Nạp ảnh góc chụp / bản vẽ thật'}
                  </span>
                </button>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Thông số kỹ thuật / Kích thước / Chứng nhận xác thực
                </label>
                <textarea
                  rows={3}
                  value={activeAsset.customTechnicalNotes ?? ''}
                  onChange={(e) =>
                    onUpdateAsset(standard.id, activeAsset.id, {
                      customTechnicalNotes: e.target.value,
                    })
                  }
                  placeholder="VD: Công suất 500 L/h · Áp suất 0.6 MPa (6 bar) · Ống DN25 · Kích thước 1200×650×1650 mm · QCVN 6-1:2010/BYT"
                  className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg leading-relaxed"
                />
              </div>

              {/* SEO Filename & ALT TEXT for Website Group */}
              {isWebGroup && (
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">
                      SEO File & ALT TEXT
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAlt}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0052B4] cursor-pointer"
                    >
                      {copiedAlt ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedAlt ? 'Đã chép' : 'Chép ALT'}</span>
                    </button>
                  </div>
                  <p className="font-mono text-[10px] text-slate-600 break-all">
                    {activeAsset.seoFileName}
                  </p>
                  <p className="text-[11px] text-slate-700">{activeAsset.altText}</p>
                </div>
              )}
            </section>

            <hr className="border-slate-200" />

            {/* Independent Validation Engine Report */}
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Kiểm tra quy chuẩn (Validation)
                </h3>
                <StatusLabel status={activeAsset.validation.status} />
              </div>

              <div className="space-y-1.5">
                {activeAsset.validation.checks.map((chk) => (
                  <div
                    key={chk.code}
                    className={`p-2.5 rounded-lg border text-xs ${
                      chk.status === 'pass'
                        ? 'bg-emerald-50/50 border-emerald-200/70 text-slate-800'
                        : chk.status === 'warning'
                        ? 'bg-amber-50/70 border-amber-200 text-amber-950'
                        : chk.status === 'fail'
                        ? 'bg-red-50 border-red-200 text-red-900'
                        : 'bg-slate-50 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="font-semibold">{chk.label}</div>
                    <div className="text-[11px] opacity-90 mt-0.5 leading-relaxed">
                      {chk.detail}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
