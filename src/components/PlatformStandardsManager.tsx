import { useState } from 'react';
import { ShieldCheck, RotateCcw, Save, Check, AlertTriangle, HelpCircle } from 'lucide-react';
import { DEFAULT_PLATFORM_REGISTRY } from '../constants/platformRegistry';
import type {
  DesignGroupId,
  OutputFileFormat,
  PlatformStandardEntry,
  VerificationStatus,
} from '../types/multichannel';

interface PlatformStandardsManagerProps {
  registry: PlatformStandardEntry[];
  onUpdateRegistry: (next: PlatformStandardEntry[]) => void;
}

const ALL_FORMATS: OutputFileFormat[] = ['jpg', 'png', 'webp', 'pdf'];

function VerificationBadge({ status }: { status: VerificationStatus }) {
  if (status === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
        <ShieldCheck className="w-3.5 h-3.5" />
        Đã xác minh
      </span>
    );
  }
  if (status === 'partial') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
        <AlertTriangle className="w-3.5 h-3.5" />
        Xác minh một phần
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
      <HelpCircle className="w-3.5 h-3.5" />
      Chưa xác minh nguồn
    </span>
  );
}

export function PlatformStandardsManager({
  registry,
  onUpdateRegistry,
}: PlatformStandardsManagerProps) {
  const [selectedId, setSelectedId] = useState<DesignGroupId>(registry[0]?.id ?? '01_shopee_cover');
  const [savedToast, setSavedToast] = useState(false);

  const activeEntry = registry.find((r) => r.id === selectedId) ?? registry[0];

  const patchEntry = (patch: Partial<PlatformStandardEntry>) => {
    const updated = registry.map((entry) =>
      entry.id === activeEntry.id ? { ...entry, ...patch } : entry
    );
    onUpdateRegistry(updated);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1800);
  };

  const toggleFormat = (fmt: OutputFileFormat) => {
    const exists = activeEntry.allowedFormats.includes(fmt);
    if (exists && activeEntry.allowedFormats.length <= 1) return;
    const nextFormats = exists
      ? activeEntry.allowedFormats.filter((f) => f !== fmt)
      : [...activeEntry.allowedFormats, fmt];
    patchEntry({
      allowedFormats: nextFormats,
      defaultFormat: nextFormats.includes(activeEntry.defaultFormat)
        ? activeEntry.defaultFormat
        : nextFormats[0],
    });
  };

  const handleResetAll = () => {
    onUpdateRegistry(DEFAULT_PLATFORM_REGISTRY);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1800);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Trung Tâm Quản Lý Quy Chuẩn Nền Tảng (Platform Standards Registry)
          </h2>
          <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
            Cập nhật tập trung quy định bắt buộc của từng nền tảng (A) và tiêu chuẩn thiết kế nội bộ VUTECH (B). Mọi thay đổi được đồng bộ trực tiếp vào Validation Engine và hệ thống xuất ảnh mà không cần chỉnh sửa mã nguồn.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {savedToast && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <Check className="w-3.5 h-3.5" />
              Đã lưu quy chuẩn
            </span>
          )}
          <button
            type="button"
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:text-[#0052B4] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Khôi phục quy chuẩn gốc</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Group Selector List */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
          {registry.map((item) => {
            const active = item.id === activeEntry.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`w-full px-4 py-3.5 text-left transition-colors cursor-pointer ${
                  active ? 'bg-[#0052B4]/6' : 'bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-xs font-bold ${
                      active ? 'text-[#0052B4]' : 'text-slate-900'
                    }`}
                  >
                    {item.name}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums shrink-0">
                    {item.aspectRatios[0]}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 mt-1.5">
                  <span className="text-[11px] text-slate-500 truncate">{item.platform}</span>
                  <VerificationBadge status={item.verificationStatus} />
                </div>
              </button>
            );
          })}
        </div>

        {/* Right Detailed Standards Editor */}
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          <div className="pb-4 border-b border-slate-200 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">{activeEntry.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeEntry.platform} · {activeEntry.placement}
              </p>
            </div>
            <div className="text-right space-y-1">
              <VerificationBadge status={activeEntry.verificationStatus} />
              <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                Phiên bản: {activeEntry.standardVersion}
              </div>
            </div>
          </div>

          {/* Numeric Technical Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Số lượng ảnh mặc định
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={activeEntry.defaultCount}
                onChange={(e) =>
                  patchEntry({ defaultCount: Math.max(1, Number(e.target.value) || 1) })
                }
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Giới hạn số ảnh tối đa (0 = động)
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={activeEntry.maxCount ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  patchEntry({ maxCount: v <= 0 ? null : v });
                }}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Dung lượng tối đa (KB, 0 = không giới hạn)
              </label>
              <input
                type="number"
                min={0}
                max={30720}
                step={64}
                value={activeEntry.maxFileSizeKB ?? 0}
                onChange={(e) => {
                  const v = Number(e.target.value) || 0;
                  patchEntry({ maxFileSizeKB: v <= 0 ? null : v });
                }}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Chiều rộng tối thiểu (px)
              </label>
              <input
                type="number"
                min={100}
                max={4096}
                value={activeEntry.minDimensions.width}
                onChange={(e) =>
                  patchEntry({
                    minDimensions: {
                      ...activeEntry.minDimensions,
                      width: Math.max(100, Number(e.target.value) || 500),
                    },
                  })
                }
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Chiều cao tối thiểu (px)
              </label>
              <input
                type="number"
                min={100}
                max={4096}
                value={activeEntry.minDimensions.height}
                onChange={(e) =>
                  patchEntry({
                    minDimensions: {
                      ...activeEntry.minDimensions,
                      height: Math.max(100, Number(e.target.value) || 500),
                    },
                  })
                }
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg tabular-nums"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Trạng thái xác minh nguồn
              </label>
              <select
                value={activeEntry.verificationStatus}
                onChange={(e) =>
                  patchEntry({ verificationStatus: e.target.value as VerificationStatus })
                }
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="verified">Đã xác minh chính thức</option>
                <option value="partial">Xác minh một phần (Cần đối chiếu)</option>
                <option value="unverified">Chưa xác minh nguồn chính thức</option>
              </select>
            </div>
          </div>

          {/* Allowed Formats & Contact/Watermark Flags */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700">
                Định dạng file được phép ({activeEntry.colorSpace})
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                {ALL_FORMATS.map((fmt) => {
                  const enabled = activeEntry.allowedFormats.includes(fmt);
                  return (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => toggleFormat(fmt)}
                      className={`px-3 py-1 text-xs font-mono font-semibold uppercase rounded-md border transition-colors cursor-pointer ${
                        enabled
                          ? 'border-[#0052B4] bg-[#0052B4] text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {fmt}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs font-semibold text-slate-700">
                Quy tắc nội dung & bản quyền
              </span>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeEntry.allowExternalContact}
                    onChange={(e) => patchEntry({ allowExternalContact: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[#0052B4]"
                  />
                  <span>Cho phép hiển thị Hotline / Website / Facebook</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeEntry.allowWatermark}
                    onChange={(e) => patchEntry({ allowWatermark: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-[#0052B4]"
                  />
                  <span>Cho phép đóng dấu chìm bản quyền</span>
                </label>
              </div>
            </div>
          </div>

          {/* Separated A (Mandatory Platform) vs B (Internal VUTECH) Rules */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-900">
                A. Quy định bắt buộc của nền tảng (mỗi dòng 1 quy tắc)
              </label>
              <textarea
                rows={5}
                value={activeEntry.mandatoryPlatformRules.join('\n')}
                onChange={(e) =>
                  patchEntry({
                    mandatoryPlatformRules: e.target.value
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-900">
                B. Tiêu chuẩn thiết kế nội bộ VUTECH (mỗi dòng 1 quy tắc)
              </label>
              <textarea
                rows={5}
                value={activeEntry.internalVutechRules.join('\n')}
                onChange={(e) =>
                  patchEntry({
                    internalVutechRules: e.target.value
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg leading-relaxed"
              />
            </div>
          </div>

          {/* Safe Zone, Restricted Content, Source & Verification Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Quy tắc vùng an toàn (Safe Zone)
              </label>
              <textarea
                rows={3}
                value={activeEntry.safeZoneDescription}
                onChange={(e) => patchEntry({ safeZoneDescription: e.target.value })}
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg leading-relaxed"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Ghi chú đối chiếu nguồn chính thức
              </label>
              <textarea
                rows={3}
                value={activeEntry.verificationNote}
                onChange={(e) => patchEntry({ verificationNote: e.target.value })}
                className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-lg leading-relaxed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Nguồn tài liệu chính thức
              </label>
              <input
                type="text"
                value={activeEntry.officialSource}
                onChange={(e) => patchEntry({ officialSource: e.target.value })}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Ngày xác minh gần nhất
              </label>
              <input
                type="date"
                value={activeEntry.lastVerifiedDate}
                onChange={(e) => patchEntry({ lastVerifiedDate: e.target.value })}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Nội dung bị hạn chế: {activeEntry.restrictedContent.join(' · ')}
            </span>
            <span className="inline-flex items-center gap-1 font-semibold text-[#0052B4]">
              <Save className="w-3.5 h-3.5" />
              Tự động lưu trình duyệt
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
