import { useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  FolderArchive,
  Pause,
  Play,
  Square,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import {
  FACEBOOK_RATIO_PRESETS,
  PLATFORM_BUNDLE_PRESETS,
} from '../constants/platformRegistry';
import type {
  DesignGroupId,
  ExportMode,
  FacebookRatioKey,
  GroupImageAsset,
  GroupRuntimeSettings,
  OutputFileFormat,
  PlatformBundleId,
  PlatformStandardEntry,
  QueueProgressState,
  SmartExportSelection,
} from '../types/multichannel';
import type { StudioConfig } from '../types/studio';
import {
  buildExportPlan,
  buildSkuSlug,
  estimatePlanSizeKB,
  executeSmartExport,
} from '../utils/smartExportEngine';

interface SmartExportModalProps {
  open: boolean;
  initialMode: ExportMode;
  initialGroupIds: DesignGroupId[];
  initialAssetIds?: string[];
  registry: PlatformStandardEntry[];
  settingsByGroup: Record<DesignGroupId, GroupRuntimeSettings>;
  assetsByGroup: Record<DesignGroupId, GroupImageAsset[]>;
  studioConfig: StudioConfig;
  onClose: () => void;
}

export function SmartExportModal({
  open,
  initialMode,
  initialGroupIds,
  initialAssetIds = [],
  registry,
  settingsByGroup,
  assetsByGroup,
  studioConfig,
  onClose,
}: SmartExportModalProps) {
  const [mode, setMode] = useState<ExportMode>(initialMode);
  const [selectedGroupIds, setSelectedGroupIds] = useState<DesignGroupId[]>(
    initialGroupIds.length > 0 ? initialGroupIds : registry.map((r) => r.id)
  );
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(initialAssetIds);
  const [bundleId, setBundleId] = useState<PlatformBundleId>('shopee-full');
  const [overrideFormat, setOverrideFormat] = useState<OutputFileFormat | 'group-default'>('group-default');
  const [overrideQuality, setOverrideQuality] = useState<number>(0.9);
  const [overrideMaxSizeKB, setOverrideMaxSizeKB] = useState<string>('default');
  const [includeOnlyCompliant, setIncludeOnlyCompliant] = useState<boolean>(true);
  const [exportIndustrialAsPdf, setExportIndustrialAsPdf] = useState<boolean>(true);
  const [includeManifestAndCsv, setIncludeManifestAndCsv] = useState<boolean>(true);
  const [concurrency, setConcurrency] = useState<number>(2);
  const [fbRatios, setFbRatios] = useState<FacebookRatioKey[]>(
    settingsByGroup['04_facebook_ads']?.facebookRatios ?? ['4:5']
  );

  const [progress, setProgress] = useState<QueueProgressState>({
    stage: 'idle',
    total: 0,
    completed: 0,
    failed: 0,
    currentLabel: '',
    concurrency: 2,
    errors: [],
  });

  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);
  const [isPausedUi, setIsPausedUi] = useState(false);

  // Sync mode/groups when modal opens cleanly
  const effectiveSelection: SmartExportSelection = useMemo(() => {
    let groups = selectedGroupIds;
    let ratiosOverride: FacebookRatioKey[] | undefined = undefined;
    let pdfFlag = exportIndustrialAsPdf;

    if (mode === 'platform-bundle') {
      const b = PLATFORM_BUNDLE_PRESETS.find((p) => p.id === bundleId) ?? PLATFORM_BUNDLE_PRESETS[0];
      groups = b.groupIds;
      ratiosOverride = b.facebookRatios;
      if (b.exportIndustrialPdf !== undefined) pdfFlag = b.exportIndustrialPdf;
    } else if (mode === 'all-groups') {
      groups = selectedGroupIds.length > 0 ? selectedGroupIds : registry.map((r) => r.id);
      ratiosOverride = fbRatios;
    } else if (mode === 'group') {
      groups = selectedGroupIds.slice(0, 1);
      if (groups[0] === '04_facebook_ads') ratiosOverride = fbRatios;
    } else if (mode === 'single') {
      groups = selectedGroupIds.slice(0, 1);
      if (groups[0] === '04_facebook_ads') ratiosOverride = fbRatios.slice(0, 1);
    }

    const parsedMaxKB =
      overrideMaxSizeKB === 'default'
        ? undefined
        : overrideMaxSizeKB === 'none'
        ? null
        : Number(overrideMaxSizeKB);

    return {
      mode,
      selectedGroupIds: groups,
      selectedAssetIds: mode === 'single' ? selectedAssetIds : [],
      platformBundleId: bundleId,
      includeOnlyCompliant,
      exportIndustrialAsPdf: pdfFlag,
      includeManifestAndCsv,
      overrideFormat,
      overrideQuality: overrideFormat === 'group-default' ? undefined : overrideQuality,
      overrideMaxSizeKB: parsedMaxKB,
      facebookRatiosOverride: ratiosOverride,
    };
  }, [
    mode,
    selectedGroupIds,
    selectedAssetIds,
    bundleId,
    includeOnlyCompliant,
    exportIndustrialAsPdf,
    includeManifestAndCsv,
    overrideFormat,
    overrideQuality,
    overrideMaxSizeKB,
    fbRatios,
    registry,
  ]);

  const plan = useMemo(
    () =>
      buildExportPlan({
        selection: effectiveSelection,
        registry,
        settingsByGroup,
        assetsByGroup,
      }),
    [effectiveSelection, registry, settingsByGroup, assetsByGroup]
  );

  const estimatedKB = useMemo(() => estimatePlanSizeKB(plan), [plan]);
  const estimatedMB = (estimatedKB / 1024).toFixed(2);
  const sku = buildSkuSlug(studioConfig);

  const foldersPreview = useMemo(() => {
    const set = new Set<string>();
    for (const u of plan) {
      set.add(`VUTECH_${sku}/${u.folderPath}/`);
    }
    return Array.from(set);
  }, [plan, sku]);

  if (!open) return null;

  const isRunning =
    progress.stage === 'waiting' ||
    progress.stage === 'generating' ||
    progress.stage === 'validating' ||
    progress.stage === 'optimizing' ||
    progress.stage === 'packaging' ||
    progress.stage === 'paused';

  const toggleGroup = (id: DesignGroupId) => {
    if (mode === 'group' || mode === 'single') {
      setSelectedGroupIds([id]);
      const firstAsset = assetsByGroup[id]?.[0]?.id;
      if (mode === 'single' && firstAsset) setSelectedAssetIds([firstAsset]);
      return;
    }
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? (prev.length > 1 ? prev.filter((x) => x !== id) : prev) : [...prev, id]
    );
  };

  const toggleFbRatio = (key: FacebookRatioKey) => {
    setFbRatios((prev) =>
      prev.includes(key) ? (prev.length > 1 ? prev.filter((x) => x !== key) : prev) : [...prev, key]
    );
  };

  const handleStartExport = async () => {
    pausedRef.current = false;
    cancelledRef.current = false;
    setIsPausedUi(false);

    await executeSmartExport({
      selection: effectiveSelection,
      registry,
      settingsByGroup,
      assetsByGroup,
      studioConfig,
      concurrency,
      controller: {
        isPaused: () => pausedRef.current,
        isCancelled: () => cancelledRef.current,
      },
      onProgress: (st) => setProgress(st),
    });
  };

  const handleTogglePause = () => {
    pausedRef.current = !pausedRef.current;
    setIsPausedUi(pausedRef.current);
    setProgress((p) => ({
      ...p,
      stage: pausedRef.current ? 'paused' : 'generating',
      currentLabel: pausedRef.current ? 'Đã tạm dừng hàng đợi xuất ảnh...' : p.currentLabel,
    }));
  };

  const handleCancelExport = () => {
    cancelledRef.current = true;
    pausedRef.current = false;
    setIsPausedUi(false);
  };

  const singleGroupAssets =
    mode === 'single' ? assetsByGroup[effectiveSelection.selectedGroupIds[0]] ?? [] : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cấu hình xuất hình ảnh thông minh"
      className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-[940px] max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <FolderArchive className="w-5 h-5 text-[#0052B4]" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Cấu hình xuất hình ảnh thông minh
              </h2>
              <p className="text-xs text-slate-500">
                Xuất bằng Canvas 2D thuần (0 chi phí AI) · Tự động kiểm tra quy chuẩn, loại bỏ tem mô phỏng Shopee & đóng gói ZIP
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            aria-label="Đóng hộp thoại xuất ảnh"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg disabled:opacity-40 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 4 Export Modes */}
          <section className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              1. Chọn chế độ tải xuống
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {(
                [
                  { id: 'single', label: 'A. Tải ảnh đơn lẻ', desc: '1 ảnh đúng chuẩn nhóm' },
                  { id: 'group', label: 'B. Tải trọn nhóm', desc: 'Đủ bộ của 1 nhóm (ZIP)' },
                  { id: 'platform-bundle', label: 'C. Bộ theo nền tảng', desc: 'Shopee / Web / FB / B2B' },
                  { id: 'all-groups', label: 'D. Tải nhiều / 7 nhóm', desc: 'ZIP tổng phân thư mục' },
                ] as Array<{ id: ExportMode; label: string; desc: string }>
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  disabled={isRunning}
                  onClick={() => {
                    setMode(m.id);
                    if (m.id === 'all-groups') {
                      setSelectedGroupIds(registry.map((r) => r.id));
                    }
                  }}
                  className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                    mode === m.id
                      ? 'border-[#0052B4] bg-[#0052B4]/6'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="text-xs font-bold text-slate-900">{m.label}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Group / Bundle Selector */}
          {mode === 'platform-bundle' ? (
            <section className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                2. Chọn bộ ảnh theo nền tảng
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {PLATFORM_BUNDLE_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    disabled={isRunning}
                    onClick={() => setBundleId(preset.id)}
                    className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                      bundleId === preset.id
                        ? 'border-[#0052B4] bg-[#0052B4]/6'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold text-slate-900">{preset.label}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Chọn nhóm thiết kế ({effectiveSelection.selectedGroupIds.length}/7)
                </h3>
                {mode === 'all-groups' && (
                  <button
                    type="button"
                    onClick={() => setSelectedGroupIds(registry.map((r) => r.id))}
                    className="text-xs font-semibold text-[#0052B4] hover:underline cursor-pointer"
                  >
                    Chọn tất cả 7 nhóm
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {registry.map((std) => {
                  const checked = effectiveSelection.selectedGroupIds.includes(std.id);
                  const activeAssets = (assetsByGroup[std.id] ?? []).filter((a) => !a.skipped);
                  return (
                    <label
                      key={std.id}
                      className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border cursor-pointer ${
                        checked
                          ? 'border-[#0052B4] bg-[#0052B4]/5'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <input
                          type={mode === 'all-groups' ? 'checkbox' : 'radio'}
                          name="exportGroupSelect"
                          checked={checked}
                          disabled={isRunning}
                          onChange={() => toggleGroup(std.id)}
                          className="h-4 w-4 text-[#0052B4]"
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate">
                            {std.shortName}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {std.platform} · {settingsByGroup[std.id].format.toUpperCase()}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                        {activeAssets.length} ảnh
                      </span>
                    </label>
                  );
                })}
              </div>

              {/* Single image picker when Mode A is active */}
              {mode === 'single' && singleGroupAssets.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Chọn ảnh cụ thể cần xuất
                  </label>
                  <select
                    value={selectedAssetIds[0] ?? singleGroupAssets[0].id}
                    onChange={(e) => setSelectedAssetIds([e.target.value])}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    {singleGroupAssets.map((a) => (
                      <option key={a.id} value={a.id}>
                        #{String(a.slotIndex).padStart(2, '0')} · {a.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </section>
          )}

          {/* Facebook Multi-Ratio Selector whenever Group 04 is included */}
          {effectiveSelection.selectedGroupIds.includes('04_facebook_ads') &&
            mode !== 'platform-bundle' && (
              <section className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    Tỷ lệ xuất cho Nhóm 04 – Quảng Cáo Facebook (5 nội dung × {fbRatios.length} tỷ lệ ={' '}
                    {5 * fbRatios.length} file)
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FACEBOOK_RATIO_PRESETS.map((r) => {
                    const checked = fbRatios.includes(r.key);
                    return (
                      <label
                        key={r.key}
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer ${
                          checked
                            ? 'border-[#0052B4] bg-white font-semibold text-[#0052B4]'
                            : 'border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFbRatio(r.key)}
                          className="h-3.5 w-3.5 text-[#0052B4]"
                        />
                        <span>{r.key}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

          {/* Format, Compression, Size Limit, PDF & Concurrency */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">Định dạng file</label>
              <select
                value={overrideFormat}
                disabled={isRunning}
                onChange={(e) => setOverrideFormat(e.target.value as OutputFileFormat | 'group-default')}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="group-default">Theo chuẩn từng nhóm (Khuyến nghị)</option>
                <option value="jpg">Ép xuất JPG</option>
                <option value="png">Ép xuất PNG</option>
                <option value="webp">Ép xuất WebP</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Chất lượng nén ({Math.round(overrideQuality * 100)}%)
              </label>
              <input
                type="range"
                min={0.65}
                max={1}
                step={0.02}
                value={overrideQuality}
                disabled={isRunning || overrideFormat === 'group-default'}
                onChange={(e) => setOverrideQuality(Number(e.target.value))}
                className="w-full studio-slider mt-2 disabled:opacity-40"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Giới hạn dung lượng
              </label>
              <select
                value={overrideMaxSizeKB}
                disabled={isRunning}
                onChange={(e) => setOverrideMaxSizeKB(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="default">Theo quy chuẩn nền tảng</option>
                <option value="500">Tối đa 500 KB (Web siêu nhẹ)</option>
                <option value="2048">Tối đa 2 MB (Chuẩn Shopee)</option>
                <option value="none">Không giới hạn (Ưu tiên nét tối đa)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700">
                Tác vụ song song (Hàng đợi)
              </label>
              <select
                value={concurrency}
                disabled={isRunning}
                onChange={(e) => setConcurrency(Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-lg"
              >
                <option value={1}>1 tác vụ (Tiết kiệm RAM)</option>
                <option value={2}>2 tác vụ đồng thời (Mặc định)</option>
                <option value={3}>3 tác vụ đồng thời (Nhanh)</option>
              </select>
            </div>
          </section>

          {/* Compliance & Packaging Switches */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={includeOnlyCompliant}
                disabled={isRunning}
                onChange={(e) => setIncludeOnlyCompliant(e.target.checked)}
                className="h-4 w-4 mt-0.5 text-[#0052B4]"
              />
              <span className="text-xs text-slate-700 leading-snug">
                <strong className="block text-slate-900">Khóa ảnh lỗi nghiêm trọng</strong>
                Chỉ xuất ảnh đạt chuẩn nền tảng, vẫn cho tải ảnh hợp lệ còn lại
              </span>
            </label>

            <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={exportIndustrialAsPdf}
                disabled={isRunning}
                onChange={(e) => setExportIndustrialAsPdf(e.target.checked)}
                className="h-4 w-4 mt-0.5 text-[#0052B4]"
              />
              <span className="text-xs text-slate-700 leading-snug">
                <strong className="block text-slate-900">Gộp PDF Kỹ Thuật (Nhóm 05)</strong>
                Kèm 1 file PDF tổng hợp các trang kỹ thuật công nghiệp
              </span>
            </label>

            <label className="flex items-start gap-2 p-3 rounded-lg border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={includeManifestAndCsv}
                disabled={isRunning}
                onChange={(e) => setIncludeManifestAndCsv(e.target.checked)}
                className="h-4 w-4 mt-0.5 text-[#0052B4]"
              />
              <span className="text-xs text-slate-700 leading-snug">
                <strong className="block text-slate-900">Đính kèm manifest.json & CSV</strong>
                Ghi nhận SKU, kích thước, dung lượng & trạng thái kiểm tra
              </span>
            </label>
          </section>

          {/* Summary & Folder Tree Preview */}
          <section className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-900">
                Dự kiến cấu trúc thư mục & tổng số tệp
              </span>
              <span className="font-mono font-bold text-[#0052B4] tabular-nums">
                {plan.length} tệp ảnh · ~{estimatedMB} MB
              </span>
            </div>
            <div className="font-mono text-[11px] text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {foldersPreview.map((fp) => (
                <div key={fp} className="truncate">
                  {fp}
                </div>
              ))}
              {includeManifestAndCsv && plan.length > 1 && (
                <div className="text-slate-500 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  <span>VUTECH_{sku}/manifest.json & bao_cao_xuat_anh.csv</span>
                </div>
              )}
            </div>
          </section>

          {/* Live Queue Progress */}
          {progress.stage !== 'idle' && (
            <section className="p-4 rounded-xl border border-slate-200 bg-white space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  {progress.stage === 'completed' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : progress.stage === 'failed' ? (
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  ) : null}
                  <span>{progress.currentLabel}</span>
                </div>
                <span className="font-mono font-bold text-[#0052B4] tabular-nums">
                  {progress.completed}/{progress.total}
                </span>
              </div>

              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-200 ${
                    progress.stage === 'failed'
                      ? 'bg-red-500'
                      : progress.stage === 'completed'
                      ? 'bg-emerald-600'
                      : 'bg-[#0052B4]'
                  }`}
                  style={{
                    width: `${
                      progress.total > 0
                        ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
                        : 0
                    }%`,
                  }}
                />
              </div>

              {progress.errors.length > 0 && (
                <ul className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 space-y-1 max-h-28 overflow-y-auto">
                  {progress.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Mã SKU xuất: <span className="font-mono font-bold text-slate-800">{sku}</span>
          </div>

          <div className="flex items-center gap-2">
            {isRunning && (
              <>
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 cursor-pointer"
                >
                  {isPausedUi ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{isPausedUi ? 'Tiếp tục' : 'Tạm dừng'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleCancelExport}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Hủy</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={handleStartExport}
              disabled={isRunning || plan.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] disabled:opacity-50 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>
                {isRunning
                  ? 'Đang xử lý hàng đợi...'
                  : mode === 'single' && plan.length === 1
                  ? 'Tải xuống 1 tệp ảnh'
                  : `Xuất & Đóng gói ZIP (${plan.length} tệp)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
