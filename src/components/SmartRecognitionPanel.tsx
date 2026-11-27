import { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Database,
  Eye,
  FileSearch,
  Layers,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Unlock,
  Wand2,
} from 'lucide-react';
import type {
  FieldDataSource,
  ProductRecognitionRecord,
  RecognitionModelOption,
  TechnicalSpecItem,
  WaterTreatmentCategoryId,
} from '../types/recognition';
import type { BatchRecognitionMode, StudioConfig } from '../types/studio';
import {
  VUTECH_DISTRIBUTOR_NAME,
  VUTECH_INTERNAL_CATALOG,
  WATER_TREATMENT_CATEGORIES,
  WATER_TREATMENT_REFERENCE_BRANDS,
  formatSpecForCanvas,
  getCategoryDefById,
} from '../constants/waterTreatmentDictionary';
import {
  applyRecognitionRecordToStudioConfig,
  buildNormalizedProductName,
  buildRecognitionRecordFromCatalog,
  generateMultiChannelProductNames,
  normalizeProductModelCode,
} from '../utils/productRecognitionEngine';

interface SmartRecognitionPanelProps {
  config: StudioConfig;
  batchCount: number;
  batchRecognitionMode: BatchRecognitionMode;
  onChangeBatchRecognitionMode: (mode: BatchRecognitionMode) => void;
  recognitionModel: RecognitionModelOption;
  onChangeRecognitionModel: (model: RecognitionModelOption) => void;
  isAnalyzing: boolean;
  onChangeConfig: (patch: Partial<StudioConfig>) => void;
  onReRecognize: (options?: {
    bypassCache?: boolean;
    mode?: 'full-recognition' | 'ocr-only';
  }) => void;
  onApplyToAllMultiChannel: () => void;
}

const SOURCE_LABELS: Record<FieldDataSource, { label: string; colorClass: string }> = {
  IMAGE_LABEL: {
    label: 'IMAGE_LABEL (Tem nhãn ảnh gốc)',
    colorClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  PRODUCT_CATALOG: {
    label: 'PRODUCT_CATALOG (Danh mục VUTECH)',
    colorClass: 'bg-sky-50 text-sky-800 border-sky-200',
  },
  DATASHEET: {
    label: 'DATASHEET (Tài liệu kỹ thuật)',
    colorClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  },
  USER_CONFIRMED: {
    label: 'USER_CONFIRMED (Người dùng xác nhận)',
    colorClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  AI_INFERRED: {
    label: 'AI_INFERRED (Suy luận AI - Cần kiểm tra)',
    colorClass: 'bg-slate-100 text-slate-700 border-slate-300',
  },
};

function getConfidenceBadge(confidence: number): {
  label: string;
  tierText: string;
  className: string;
} {
  const pct = Math.round(confidence * 100);
  if (pct >= 90) {
    return {
      label: `${pct}%`,
      tierText: 'Cao (≥ 90%)',
      className: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    };
  }
  if (pct >= 70) {
    return {
      label: `${pct}%`,
      tierText: 'Cần kiểm tra (70–89%)',
      className: 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }
  return {
    label: `${pct}%`,
    tierText: 'Thấp (< 70% - Cần xác nhận)',
    className: 'bg-rose-100 text-rose-800 border-rose-300',
  };
}

function buildDefaultRecordFromConfig(config: StudioConfig): ProductRecognitionRecord {
  if (config.recognitionRecord) return config.recognitionRecord;

  const cleanModel =
    config.modelCode && !/^VT-0[1-9]$/i.test(config.modelCode)
      ? config.modelCode
      : 'Chưa xác định model';

  const specs: TechnicalSpecItem[] = config.specs
    .filter((s) => s && s.trim().length > 0)
    .map((line) => {
      const idx = line.indexOf(':');
      if (idx > 0) {
        return {
          name: line.slice(0, idx).trim(),
          value: line.slice(idx + 1).trim(),
          source: 'USER_CONFIRMED' as FieldDataSource,
          confidence: 0.92,
          verified: true,
        };
      }
      return {
        name: 'Thông số kỹ thuật',
        value: line.trim(),
        source: 'USER_CONFIRMED' as FieldDataSource,
        confidence: 0.9,
        verified: true,
      };
    });

  const channelNames =
    config.channelNames ||
    generateMultiChannelProductNames({
      standardName: config.productName || 'Cần bổ sung thông tin sản phẩm',
      shortName: config.productName || 'Cần bổ sung thông tin',
      brand: 'Chưa xác định thương hiệu',
      model: cleanModel,
      category: config.category || 'Chưa xác định nhóm sản phẩm',
      keySpecText: config.specs[0] || '',
    });

  return {
    recognitionStatus: 'PARTIAL',
    productName: config.productName || 'Cần bổ sung thông tin sản phẩm',
    shortName: config.productName || 'Cần bổ sung thông tin',
    brand: 'Chưa xác định thương hiệu',
    manufacturer: 'Chưa xác định',
    distributor: VUTECH_DISTRIBUTOR_NAME,
    model: cleanModel,
    rawModel: cleanModel !== 'Chưa xác định model' ? cleanModel : '',
    sku: '',
    categoryId: '10_complete_systems',
    category: config.category || 'Hệ thống xử lý nước hoàn chỉnh',
    subCategory: 'Thiết bị & vật tư xử lý nước',
    material: '',
    origin: '',
    packaging: '',
    applications: [],
    technicalSpecifications: specs,
    visibleText: [],
    confidence: 0.85,
    fieldConfidence: {
      brand: 0.75,
      model: 0.85,
      category: 0.88,
      productName: 0.88,
      specifications: specs.length > 0 ? 0.88 : 0.4,
    },
    fieldSources: {
      brand: 'USER_CONFIRMED',
      model: 'USER_CONFIRMED',
      category: 'USER_CONFIRMED',
      productName: 'USER_CONFIRMED',
      specifications: 'USER_CONFIRMED',
    },
    warnings: [],
    missingFields: [],
    requiresManualReview: false,
    recognitionModel: 'gemini-4-hydrogen',
    recognizedAt: new Date().toISOString(),
    channelNames,
  };
}

export function SmartRecognitionPanel({
  config,
  batchCount,
  batchRecognitionMode,
  onChangeBatchRecognitionMode,
  recognitionModel,
  onChangeRecognitionModel,
  isAnalyzing,
  onChangeConfig,
  onReRecognize,
  onApplyToAllMultiChannel,
}: SmartRecognitionPanelProps) {
  const record = buildDefaultRecordFromConfig(config);
  const lockedFields = config.lockedFields || {};

  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [showChannelNames, setShowChannelNames] = useState(false);
  const [newSpecName, setNewSpecName] = useState('');
  const [newSpecValue, setNewSpecValue] = useState('');
  const [newSpecUnit, setNewSpecUnit] = useState('');
  const [newVisibleToken, setNewVisibleToken] = useState('');
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [copiedChannelKey, setCopiedChannelKey] = useState<string | null>(null);

  const overallConfBadge = getConfidenceBadge(record.confidence);
  const currentCategoryDef = getCategoryDefById(record.categoryId);

  const flashFeedback = (msg: string) => {
    setActionFeedback(msg);
    window.setTimeout(() => setActionFeedback(null), 3500);
  };

  const toggleFieldLock = (fieldKey: string) => {
    const nextLocks = {
      ...lockedFields,
      [fieldKey]: !lockedFields[fieldKey],
    };
    onChangeConfig({ lockedFields: nextLocks });
  };

  const updateRecordAndSync = (
    patch: Partial<ProductRecognitionRecord>,
    syncToCanvas = true,
  ) => {
    const merged: ProductRecognitionRecord = {
      ...record,
      ...patch,
      recognizedAt: new Date().toISOString(),
    };

    const verifiedSpecs = merged.technicalSpecifications.filter(
      (s) => s.verified && s.confidence >= 0.7,
    );
    const keySpec = verifiedSpecs[0]
      ? formatSpecForCanvas(verifiedSpecs[0])
      : merged.packaging;

    merged.channelNames = generateMultiChannelProductNames({
      standardName: merged.productName,
      shortName: merged.shortName || merged.productName,
      brand: merged.brand,
      model: merged.model,
      category: merged.category,
      packaging: merged.packaging,
      keySpecText: keySpec,
    });

    if (syncToCanvas) {
      const updatedStudioConfig = applyRecognitionRecordToStudioConfig(
        { ...config, recognitionRecord: merged },
        merged,
        { respectLocks: false },
      );
      onChangeConfig(updatedStudioConfig);
    } else {
      onChangeConfig({
        recognitionRecord: merged,
        channelNames: merged.channelNames,
      });
    }
  };

  /**
   * Nút 3: Chuẩn hóa tên sản phẩm theo công thức Mục VI:
   * [Loại sản phẩm] + [Thương hiệu] + [Model] + [Thông số phân biệt chính nếu đã xác thực]
   */
  const handleNormalizeProductName = () => {
    const normalizedModel = normalizeProductModelCode(record.model || record.rawModel);
    const verifiedSpecs = record.technicalSpecifications.filter(
      (s) => s.verified && s.confidence >= 0.7,
    );
    const distinguishingSpec =
      record.packaging && !record.model.includes(record.packaging)
        ? ''
        : verifiedSpecs[0]?.unit &&
            (record.categoryId === '01_ro_membrane' ||
              record.categoryId === '02_uf_membrane' ||
              record.categoryId === '10_complete_systems')
          ? `${verifiedSpecs[0].value} ${verifiedSpecs[0].unit}`
          : '';

    const { standardName, shortName } = buildNormalizedProductName({
      categoryId: record.categoryId,
      subCategory: record.subCategory,
      brand: record.brand,
      model: normalizedModel || record.model,
      rawModel: record.rawModel,
      visibleText: record.visibleText,
      existingName: record.productName,
      distinguishingSpec,
    });

    updateRecordAndSync({
      productName: standardName,
      shortName,
      model: normalizedModel || record.model,
      fieldSources: {
        ...record.fieldSources,
        productName: 'USER_CONFIRMED',
        model: 'USER_CONFIRMED',
      },
      fieldConfidence: {
        ...record.fieldConfidence,
        productName: 0.98,
      },
    });
    flashFeedback(`Đã chuẩn hóa tên sản phẩm: "${standardName}"`);
  };

  /**
   * Nút 4: Chọn sản phẩm từ Danh mục nội bộ VUTECH (Đối chiếu danh mục)
   */
  const handleApplyCatalogProduct = (catId: string) => {
    const found = VUTECH_INTERNAL_CATALOG.find((item) => item.id === catId);
    if (!found) return;
    const catRecord = buildRecognitionRecordFromCatalog(
      found,
      record.visibleText,
      'PRODUCT_CATALOG',
    );
    const updatedConfig = applyRecognitionRecordToStudioConfig(config, catRecord, {
      respectLocks: false,
    });
    onChangeConfig(updatedConfig);
    setShowCatalogModal(false);
    flashFeedback(`Đã đối chiếu & nạp chuẩn danh mục: "${found.productName}"`);
  };

  /**
   * Nút 5: Bổ sung thông số kỹ thuật theo đúng chủng loại sản phẩm
   */
  const handleAddSpecItem = () => {
    const name = newSpecName.trim();
    const value = newSpecValue.trim();
    if (!name || !value) return;

    const nextSpecs: TechnicalSpecItem[] = [
      ...record.technicalSpecifications,
      {
        name,
        value,
        unit: newSpecUnit.trim() || undefined,
        source: 'USER_CONFIRMED',
        confidence: 1.0,
        verified: true,
      },
    ];

    updateRecordAndSync({
      technicalSpecifications: nextSpecs,
      fieldSources: {
        ...record.fieldSources,
        specifications: 'USER_CONFIRMED',
      },
      fieldConfidence: {
        ...record.fieldConfidence,
        specifications: 0.98,
      },
    });

    setNewSpecName('');
    setNewSpecValue('');
    setNewSpecUnit('');
    flashFeedback(`Đã bổ sung thông số "${name}: ${value} ${newSpecUnit}".`);
  };

  const handleToggleSpecVerified = (index: number) => {
    const nextSpecs = record.technicalSpecifications.map((item, idx) =>
      idx === index
        ? {
            ...item,
            verified: !item.verified,
            source: 'USER_CONFIRMED' as FieldDataSource,
            confidence: !item.verified ? Math.max(0.92, item.confidence) : item.confidence,
          }
        : item,
    );
    updateRecordAndSync({ technicalSpecifications: nextSpecs });
  };

  const handleDeleteSpecItem = (index: number) => {
    const nextSpecs = record.technicalSpecifications.filter((_, idx) => idx !== index);
    updateRecordAndSync({ technicalSpecifications: nextSpecs });
  };

  /**
   * Nút 6: Xác nhận thông tin (Chuyển toàn bộ trạng thái sang SUCCESS & USER_CONFIRMED)
   */
  const handleConfirmAllInfo = () => {
    updateRecordAndSync({
      recognitionStatus: 'SUCCESS',
      confidence: 0.99,
      requiresManualReview: false,
      apiError: null,
      fieldConfidence: {
        brand: 0.99,
        model: 0.99,
        category: 0.99,
        productName: 0.99,
        specifications: 0.99,
      },
      fieldSources: {
        brand: 'USER_CONFIRMED',
        model: 'USER_CONFIRMED',
        category: 'USER_CONFIRMED',
        productName: 'USER_CONFIRMED',
        specifications: 'USER_CONFIRMED',
      },
    });
    flashFeedback('Đã xác nhận toàn bộ thông tin nhận diện sản phẩm (Độ tin cậy 99%).');
  };

  /**
   * Nút 7: Khóa / Mở khóa toàn bộ dữ liệu đã xác nhận
   */
  const allLocked =
    Boolean(lockedFields.productName) &&
    Boolean(lockedFields.modelCode) &&
    Boolean(lockedFields.category) &&
    Boolean(lockedFields.specs);

  const handleToggleLockAll = () => {
    const target = !allLocked;
    onChangeConfig({
      lockedFields: {
        productName: target,
        modelCode: target,
        category: target,
        tagline: target,
        specs: target,
        priceBadge: target,
        facebookCaption: target,
      },
    });
    flashFeedback(
      target
        ? 'Đã KHÓA toàn bộ dữ liệu đã xác nhận. AI nhận diện lại sẽ không bao giờ ghi đè các trường này.'
        : 'Đã MỞ KHÓA dữ liệu để cho phép AI cập nhật khi nhận diện lại.',
    );
  };

  /**
   * Nút 8: Khôi phục dữ liệu trước khi nhận diện lại
   */
  const handleRestorePreviousSnapshot = () => {
    if (!config.previousSnapshot) return;
    const snap = config.previousSnapshot;
    onChangeConfig({
      productName: snap.productName,
      modelCode: snap.modelCode,
      category: snap.category,
      tagline: snap.tagline,
      specs: [...snap.specs] as [string, string, string],
      priceBadge: snap.priceBadge,
      facebookCaption: snap.facebookCaption,
      recognitionRecord: snap.recognitionRecord,
    });
    flashFeedback('Đã khôi phục dữ liệu sản phẩm trước khi nhận diện lại.');
  };

  /**
   * Nút 9: Áp dụng vào thiết kế hiện tại
   */
  const handleApplyToCurrentDesign = () => {
    const updated = applyRecognitionRecordToStudioConfig(config, record, {
      respectLocks: false,
    });
    onChangeConfig(updated);
    flashFeedback('Đã đồng bộ hồ sơ nhận diện AI vào khung thiết kế hiện tại.');
  };

  const handleCopyText = async (key: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedChannelKey(key);
    window.setTimeout(() => setCopiedChannelKey(null), 1800);
  };

  return (
    <div className="rounded-xl border border-[#0052B4]/25 bg-gradient-to-b from-[#F0F7FF] via-white to-slate-50/90 p-3.5 shadow-sm space-y-3.5">
      {/* Header: Smart Product Recognition Engine 2.0 */}
      <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#072A5E] text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#072A5E]">
                Kết quả nhận diện AI 2.0
              </span>
              <span
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${overallConfBadge.className}`}
              >
                <ShieldCheck className="w-3 h-3" />
                {overallConfBadge.label} · {overallConfBadge.tierText}
              </span>
            </div>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Smart Product Recognition Engine 2.0 · Chuyên ngành xử lý nước VUTECH
            </p>
          </div>
        </div>
      </div>

      {/* Tách riêng Cấu hình Model Nhận diện vs Chế độ nhận diện nhiều ảnh (Mục III & Mục XII) */}
      <div className="rounded-lg bg-slate-100/90 border border-slate-200/90 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Model Nhận Diện (Độc lập với Tạo ảnh)
          </label>
          <select
            value={recognitionModel}
            onChange={(e) =>
              onChangeRecognitionModel(e.target.value as RecognitionModelOption)
            }
            className="px-2 py-1 rounded border border-slate-300 bg-white text-[11px] font-bold text-[#072A5E] focus:outline-none focus:border-[#0052B4]"
          >
            <option value="gemini-4-hydrogen">gemini-4-hydrogen (AI Studio / Tự động Fallback)</option>
            <option value="gemini-2.5-flash">gemini-2.5-flash (Chuẩn Cloudflare Workers / API Key ngoài)</option>
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Tốc độ cao / Tiết kiệm Quota)</option>
          </select>
        </div>

        {batchCount > 1 && (
          <div className="pt-1.5 border-t border-slate-200/80 space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-600 block">
              Chế độ nhận diện đợt {batchCount} ảnh (Mục XII)
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onChangeBatchRecognitionMode('independent')}
                className={`px-2 py-1.5 rounded text-[10px] font-bold text-left border transition-all ${
                  batchRecognitionMode === 'independent'
                    ? 'bg-[#072A5E] text-white border-[#072A5E]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Chế độ B: Nhiều sản phẩm khác nhau (Độc lập từng ảnh)
              </button>
              <button
                type="button"
                onClick={() => onChangeBatchRecognitionMode('multi-angle-single-product')}
                className={`px-2 py-1.5 rounded text-[10px] font-bold text-left border transition-all ${
                  batchRecognitionMode === 'multi-angle-single-product'
                    ? 'bg-[#0052B4] text-white border-[#0052B4]'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                Chế độ A: Nhiều góc chụp cùng 1 sản phẩm (Hợp nhất)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MỤC II: HIỂN THỊ CHẨN ĐOÁN LỖI API THEO MÃ HTTP THỰC TẾ (400 / 401 / 403 / 404 / 429 / 500 / 503) */}
      {record.apiError && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/95 p-2.5 text-xs text-amber-950 space-y-1.5">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-amber-900">
                  {record.apiError.title}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-900 font-mono text-[10px] font-bold">
                  HTTP {record.apiError.httpStatus} · {record.apiError.errorCode}
                </span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {record.apiError.detailMessage}
              </p>
              {record.apiError.troubleshootingSteps.length > 0 && (
                <ul className="list-disc list-inside text-[11px] text-amber-900 space-y-0.5 pt-0.5">
                  {record.apiError.troubleshootingSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              )}
              <div className="pt-1 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowCatalogModal(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#0052B4] text-white text-[11px] font-bold hover:bg-[#072A5E]"
                >
                  <Database className="w-3.5 h-3.5" />
                  Chọn nhanh từ Danh mục VUTECH
                </button>
                <button
                  type="button"
                  onClick={() => onReRecognize({ bypassCache: true })}
                  disabled={isAnalyzing}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white border border-amber-400 text-amber-900 text-[11px] font-bold hover:bg-amber-100"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  Thử kết nối lại
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cảnh báo chất lượng ảnh hoặc trường xung đột giữa nhiều ảnh */}
      {(record.warnings.length > 0 ||
        (record.conflictingFields && record.conflictingFields.length > 0)) && (
        <div className="rounded-lg border border-sky-200 bg-sky-50/80 p-2 text-[11px] text-sky-900 space-y-1">
          {record.conflictingFields && record.conflictingFields.length > 0 && (
            <p className="font-bold text-amber-800">
              ⚠️ Phát hiện thông tin khác nhau giữa các góc chụp tại trường:{' '}
              {record.conflictingFields.join(', ')}. Vui lòng kiểm tra và xác nhận.
            </p>
          )}
          {record.warnings.map((w, idx) => (
            <p key={idx} className="leading-snug">
              • {w}
            </p>
          ))}
        </div>
      )}

      {/* Thông báo phản hồi thao tác */}
      {actionFeedback && (
        <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-[11px] font-bold text-emerald-900 flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionFeedback}</span>
        </div>
      )}

      {/* 1. Ảnh gốc đã tải lên & Nguồn dữ liệu */}
      <div className="flex items-center gap-3 p-2 rounded-lg bg-white border border-slate-200">
        <img
          src={config.sourceImageUrl}
          alt={config.sourceImageName}
          className="w-14 h-14 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-100"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              1. Ảnh sản phẩm gốc (Raw Input)
            </span>
            <span className="text-[10px] font-mono text-slate-500">
              Model AI: {record.recognitionModel}
            </span>
          </div>
          <p className="text-xs font-bold text-slate-800 truncate">
            {config.sourceImageName}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                SOURCE_LABELS[record.fieldSources.productName]?.colorClass ||
                SOURCE_LABELS.IMAGE_LABEL.colorClass
              }`}
            >
              Nguồn: {record.fieldSources.productName}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Chữ đọc được trên bao bì / tem nhãn (visibleText OCR) */}
      <div className="rounded-lg bg-white border border-slate-200 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <FileSearch className="w-3.5 h-3.5 text-[#0052B4]" />
            2. Chữ đọc được trên tem nhãn / bao bì (OCR)
          </span>
          <button
            type="button"
            onClick={() => onReRecognize({ bypassCache: true, mode: 'ocr-only' })}
            disabled={isAnalyzing}
            className="text-[10px] font-bold text-[#0052B4] hover:underline flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            Quét lại chữ tem nhãn
          </button>
        </div>

        {record.visibleText.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {record.visibleText.map((token, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-300 text-[11px] font-mono font-semibold text-slate-800"
              >
                {token}
                <button
                  type="button"
                  onClick={() => {
                    const next = record.visibleText.filter((_, i) => i !== idx);
                    updateRecordAndSync({ visibleText: next }, false);
                  }}
                  className="text-slate-400 hover:text-rose-600 ml-0.5"
                  title="Xóa cụm chữ này"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-slate-500 italic">
            Chưa trích xuất được chữ trên tem nhãn hoặc bao bì không có chữ rõ nét. Bạn có thể nhập cụm chữ nhìn thấy trên bao bì vào ô dưới để hệ thống tự động chuẩn hóa:
          </p>
        )}

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={newVisibleToken}
            onChange={(e) => setNewVisibleToken(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newVisibleToken.trim()) {
                e.preventDefault();
                const next = [...record.visibleText, newVisibleToken.trim()];
                setNewVisibleToken('');
                updateRecordAndSync({ visibleText: next }, false);
              }
            }}
            placeholder="Nhập chữ trên bao bì (VD: EXTREPURE, 001X7(C100), 25L)..."
            className="flex-1 px-2.5 py-1 rounded border border-slate-200 text-xs focus:outline-none focus:border-[#0052B4]"
          />
          <button
            type="button"
            onClick={() => {
              if (!newVisibleToken.trim()) return;
              const next = [...record.visibleText, newVisibleToken.trim()];
              setNewVisibleToken('');
              updateRecordAndSync({ visibleText: next }, false);
            }}
            className="px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
          >
            + Thêm chữ
          </button>
        </div>
      </div>

      {/* 3, 4, 5, 6, 7: Thương hiệu, Mã Model gốc, Mã Model chuẩn hóa, Nhóm sản phẩm, Phân nhóm chi tiết */}
      <div className="rounded-lg bg-white border border-slate-200 p-2.5 space-y-2.5">
        <div className="grid grid-cols-2 gap-2">
          {/* 3. Thương hiệu (Brand) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                3. Thương hiệu gốc
              </label>
              <span className="text-[10px] font-bold text-emerald-700">
                {Math.round(record.fieldConfidence.brand * 100)}%
              </span>
            </div>
            <input
              type="text"
              list="vutech-reference-brands"
              value={record.brand}
              onChange={(e) =>
                updateRecordAndSync({
                  brand: e.target.value,
                  fieldSources: { ...record.fieldSources, brand: 'USER_CONFIRMED' },
                  fieldConfidence: { ...record.fieldConfidence, brand: 0.99 },
                })
              }
              placeholder="VD: EXTREPURE, FROTEC, RUNXIN..."
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#0052B4]"
            />
            <datalist id="vutech-reference-brands">
              {WATER_TREATMENT_REFERENCE_BRANDS.map((b) => (
                <option key={b.brand} value={b.brand}>
                  {b.manufacturer}
                </option>
              ))}
              <option value="VUTECH">CÔNG TY TNHH XNK VUTECH</option>
            </datalist>
          </div>

          {/* 4. Mã Model gốc trên tem (rawModel) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                4. Mã Model gốc (Tem)
              </label>
              <span className="text-[10px] font-mono text-slate-400">Raw OCR</span>
            </div>
            <input
              type="text"
              value={record.rawModel}
              onChange={(e) => {
                const rawVal = e.target.value;
                const normVal = normalizeProductModelCode(rawVal);
                updateRecordAndSync({
                  rawModel: rawVal,
                  model: normVal || record.model,
                  fieldSources: { ...record.fieldSources, model: 'USER_CONFIRMED' },
                  fieldConfidence: { ...record.fieldConfidence, model: 0.99 },
                });
              }}
              placeholder="VD: 001X7(C100)"
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs font-mono text-slate-700 focus:outline-none focus:border-[#0052B4]"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* 5. Mã Model chuẩn hóa */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                5. Mã Model chuẩn hóa
              </label>
              <button
                type="button"
                onClick={() => toggleFieldLock('modelCode')}
                className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                  lockedFields.modelCode ? 'text-amber-700' : 'text-slate-400 hover:text-slate-600'
                }`}
                title="Khóa trường Mã Model"
              >
                {lockedFields.modelCode ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </button>
            </div>
            <input
              type="text"
              value={record.model}
              onChange={(e) =>
                updateRecordAndSync({
                  model: e.target.value,
                  fieldSources: { ...record.fieldSources, model: 'USER_CONFIRMED' },
                  fieldConfidence: { ...record.fieldConfidence, model: 0.99 },
                })
              }
              placeholder="VD: 001×7 (C100)"
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs font-mono font-bold text-[#072A5E] focus:outline-none focus:border-[#0052B4]"
            />
          </div>

          {/* Mã SKU nội bộ VUTECH */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                Mã SKU nội bộ VUTECH
              </label>
              <span className="text-[10px] text-slate-400">Tùy chọn</span>
            </div>
            <input
              type="text"
              value={record.sku}
              onChange={(e) => updateRecordAndSync({ sku: e.target.value }, false)}
              placeholder="VD: VT-RESIN-EXT-001X7"
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs font-mono text-slate-700 focus:outline-none focus:border-[#0052B4]"
            />
          </div>
        </div>

        {/* 6. Nhóm sản phẩm (10 Nhóm chuẩn ngành xử lý nước Mục V) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold uppercase text-slate-500">
                6. Nhóm sản phẩm (10 nhóm)
              </label>
              <button
                type="button"
                onClick={() => toggleFieldLock('category')}
                className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                  lockedFields.category ? 'text-amber-700' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {lockedFields.category ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </button>
            </div>
            <select
              value={record.categoryId}
              onChange={(e) => {
                const nextId = e.target.value as WaterTreatmentCategoryId;
                const catDef = getCategoryDefById(nextId);
                updateRecordAndSync({
                  categoryId: nextId,
                  category: catDef.name,
                  subCategory: catDef.subCategories[0] || '',
                  fieldSources: { ...record.fieldSources, category: 'USER_CONFIRMED' },
                  fieldConfidence: { ...record.fieldConfidence, category: 0.99 },
                });
              }}
              className="w-full px-2 py-1.5 rounded border border-slate-200 text-xs font-bold text-slate-800 bg-white focus:outline-none focus:border-[#0052B4]"
            >
              {WATER_TREATMENT_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.code}: {cat.name}
                </option>
              ))}
              {record.categoryId === 'unclassified' && (
                <option value="unclassified">Chưa xác định nhóm sản phẩm</option>
              )}
            </select>
          </div>

          {/* 7. Phân nhóm chi tiết (subCategory) */}
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              7. Phân nhóm chi tiết
            </label>
            <input
              type="text"
              list="vutech-subcategories-list"
              value={record.subCategory}
              onChange={(e) =>
                updateRecordAndSync({ subCategory: e.target.value })
              }
              className="w-full px-2.5 py-1.5 rounded border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0052B4]"
            />
            <datalist id="vutech-subcategories-list">
              {currentCategoryDef.subCategories.map((sub) => (
                <option key={sub} value={sub} />
              ))}
            </datalist>
          </div>
        </div>
      </div>

      {/* 8, 9, 10, 11, 12: Tên sản phẩm chuẩn hóa, Tên ngắn, Nhà sản xuất, Đơn vị phân phối, Quy cách, Xuất xứ */}
      <div className="rounded-lg bg-white border border-slate-200 p-2.5 space-y-2">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-bold uppercase text-slate-500">
              8. Tên sản phẩm chuẩn hóa (Hiển thị chính)
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleNormalizeProductName}
                className="text-[10px] font-bold text-[#0052B4] hover:underline flex items-center gap-0.5"
              >
                <Wand2 className="w-3 h-3" />
                Tự ghép theo công thức chuẩn
              </button>
              <button
                type="button"
                onClick={() => toggleFieldLock('productName')}
                className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
                  lockedFields.productName ? 'text-amber-700' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {lockedFields.productName ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
              </button>
            </div>
          </div>
          <input
            type="text"
            value={record.productName}
            onChange={(e) =>
              updateRecordAndSync({
                productName: e.target.value,
                fieldSources: { ...record.fieldSources, productName: 'USER_CONFIRMED' },
                fieldConfidence: { ...record.fieldConfidence, productName: 0.99 },
              })
            }
            className="w-full px-2.5 py-1.5 rounded border border-[#0052B4]/40 bg-[#F8FBFF] text-xs font-extrabold text-[#072A5E] focus:outline-none focus:border-[#0052B4]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              9. Tên ngắn trên ảnh thiết kế
            </label>
            <input
              type="text"
              value={record.shortName}
              onChange={(e) =>
                updateRecordAndSync({ shortName: e.target.value }, false)
              }
              className="w-full px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold text-slate-800"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              12. Quy cách đóng gói / Kích thước
            </label>
            <input
              type="text"
              value={record.packaging}
              onChange={(e) =>
                updateRecordAndSync({ packaging: e.target.value })
              }
              placeholder="VD: Bao 25 Lít (~20 kg)"
              className="w-full px-2.5 py-1 rounded border border-slate-200 text-xs text-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              10. Nhà sản xuất (Manufacturer)
            </label>
            <input
              type="text"
              value={record.manufacturer}
              onChange={(e) =>
                updateRecordAndSync({ manufacturer: e.target.value }, false)
              }
              className="w-full px-2.5 py-1 rounded border border-slate-200 text-[11px] text-slate-700"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              11. Đơn vị phân phối (Distributor)
            </label>
            <input
              type="text"
              value={record.distributor}
              onChange={(e) =>
                updateRecordAndSync({ distributor: e.target.value }, false)
              }
              className="w-full px-2.5 py-1 rounded border border-slate-200 text-[11px] font-bold text-[#072A5E] bg-slate-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              13. Vật liệu / Cấu trúc
            </label>
            <input
              type="text"
              value={record.material}
              onChange={(e) =>
                updateRecordAndSync({ material: e.target.value }, false)
              }
              placeholder="VD: Gel Polystyrene DVB / Polyamide TFC"
              className="w-full px-2.5 py-1 rounded border border-slate-200 text-[11px] text-slate-700"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">
              Xuất xứ (Origin)
            </label>
            <input
              type="text"
              value={record.origin}
              onChange={(e) =>
                updateRecordAndSync({ origin: e.target.value }, false)
              }
              placeholder="VD: Nhập khẩu chính ngạch"
              className="w-full px-2.5 py-1 rounded border border-slate-200 text-[11px] text-slate-700"
            />
          </div>
        </div>
      </div>

      {/* 15. Danh sách thông số kỹ thuật động theo chủng loại sản phẩm (Mục IX) */}
      <div className="rounded-lg bg-white border border-slate-200 p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold text-slate-800 block">
              15. Thông số kỹ thuật theo chủng loại ({currentCategoryDef.name})
            </span>
            <span className="text-[10px] text-slate-500">
              Chỉ các thông số đã xác thực (tick xanh) mới được hiển thị lên ảnh thiết kế.
            </span>
          </div>
          <button
            type="button"
            onClick={() => toggleFieldLock('specs')}
            className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
              lockedFields.specs ? 'text-amber-700' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            {lockedFields.specs ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
        </div>

        {record.technicalSpecifications.length > 0 ? (
          <div className="space-y-1.5">
            {record.technicalSpecifications.map((spec, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-1.5 p-1.5 rounded border text-xs ${
                  spec.verified
                    ? 'bg-emerald-50/40 border-emerald-200'
                    : 'bg-slate-50 border-slate-200 opacity-75'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggleSpecVerified(idx)}
                  className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border ${
                    spec.verified
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-slate-300 text-transparent'
                  }`}
                  title={
                    spec.verified
                      ? 'Đã xác thực (Được phép đưa lên ảnh thiết kế)'
                      : 'Chưa xác thực (Không đưa lên ảnh thiết kế)'
                  }
                >
                  <Check className="w-3 h-3" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-slate-800">{spec.name}:</span>
                    <span className="font-semibold text-[#0052B4]">
                      {spec.value} {spec.unit || ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                    <span>Nguồn: {spec.source}</span>
                    <span>·</span>
                    <span>Tin cậy: {Math.round(spec.confidence * 100)}%</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteSpecItem(idx)}
                  className="p-1 text-slate-400 hover:text-rose-600"
                  title="Xóa thông số này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-2 text-[11px] text-slate-500 text-center">
            Chưa có thông số đã xác thực. Hệ thống tự động ẩn hàng thông số trên ảnh để không chèn dữ liệu giả.
          </div>
        )}

        {/* Form Bổ sung thông số theo gợi ý chuẩn của nhóm sản phẩm */}
        <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
          <span className="text-[10px] font-bold uppercase text-slate-500 block">
            + Bổ sung thông số chuẩn ngành ({currentCategoryDef.name})
          </span>
          <div className="grid grid-cols-12 gap-1">
            <input
              type="text"
              list="category-allowed-specs"
              value={newSpecName}
              onChange={(e) => {
                const val = e.target.value;
                setNewSpecName(val);
                const matchedField = currentCategoryDef.allowedSpecFields.find(
                  (f) => f.name.toLowerCase() === val.toLowerCase(),
                );
                if (matchedField?.defaultUnit && !newSpecUnit) {
                  setNewSpecUnit(matchedField.defaultUnit);
                }
              }}
              placeholder="Tên thông số"
              className="col-span-5 px-2 py-1 rounded border border-slate-200 text-[11px]"
            />
            <datalist id="category-allowed-specs">
              {currentCategoryDef.allowedSpecFields.map((field) => (
                <option key={field.name} value={field.name}>
                  {field.description}
                </option>
              ))}
            </datalist>
            <input
              type="text"
              value={newSpecValue}
              onChange={(e) => setNewSpecValue(e.target.value)}
              placeholder="Giá trị (VD: 25)"
              className="col-span-4 px-2 py-1 rounded border border-slate-200 text-[11px]"
            />
            <input
              type="text"
              value={newSpecUnit}
              onChange={(e) => setNewSpecUnit(e.target.value)}
              placeholder="Đơn vị (Lít)"
              className="col-span-3 px-2 py-1 rounded border border-slate-200 text-[11px]"
            />
          </div>
          <button
            type="button"
            onClick={handleAddSpecItem}
            className="w-full py-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold flex items-center justify-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Bổ sung thông số đã xác nhận
          </button>
        </div>
      </div>

      {/* MỤC VII: 7 Tên sản phẩm đa kênh tự động tạo từ bản ghi chuẩn */}
      <div className="rounded-lg bg-white border border-slate-200 p-2.5 space-y-2">
        <button
          type="button"
          onClick={() => setShowChannelNames(!showChannelNames)}
          className="w-full flex items-center justify-between text-left"
        >
          <span className="text-[11px] font-bold text-[#072A5E] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-[#0052B4]" />
            7 Tên sản phẩm đa kênh tự động (Shopee / Web SEO / FB / Báo giá / ASCII)
          </span>
          <span className="text-[10px] font-bold text-[#0052B4]">
            {showChannelNames ? 'Thu gọn' : 'Xem 7 tên'}
          </span>
        </button>

        {showChannelNames && (
          <div className="space-y-1.5 pt-1.5 border-t border-slate-100 text-[11px]">
            {(
              [
                ['1. Tên chuẩn kỹ thuật', record.channelNames.standardName],
                ['2. Tên ngắn trên ảnh', record.channelNames.shortName],
                ['3. Tên chuẩn Shopee', record.channelNames.shopeeName],
                ['4. Tên SEO Website', record.channelNames.websiteSeoName],
                ['5. Tiêu đề QC Facebook', record.channelNames.facebookAdTitle],
                ['6. Tên hồ sơ / Báo giá', record.channelNames.technicalFullName],
                ['7. Tên file ảnh xuất ASCII', record.channelNames.asciiFileName],
              ] as const
            ).map(([label, val]) => (
              <div
                key={label}
                className="p-1.5 rounded bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-2"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-bold text-slate-500 block">
                    {label}
                  </span>
                  <p className="font-semibold text-slate-800 break-words">{val}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyText(label, val)}
                  className="px-1.5 py-1 rounded bg-white border border-slate-200 text-slate-600 hover:text-[#0052B4] shrink-0"
                  title="Sao chép"
                >
                  {copiedChannelKey === label ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MỤC XIII: ĐẦY ĐỦ 10 NÚT THAO TÁC BẮT BUỘC */}
      <div className="space-y-1.5 pt-1 border-t border-slate-200/80">
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
          Bộ điều khiển Smart Recognition 2.0 (10 tác vụ)
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {/* 1. AI nhận diện lại */}
          <button
            type="button"
            onClick={() => onReRecognize({ bypassCache: true, mode: 'full-recognition' })}
            disabled={isAnalyzing}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#0052B4] hover:bg-[#072A5E] disabled:opacity-60 text-white text-[11px] font-bold shadow-sm transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isAnalyzing ? 'animate-spin' : ''}`} />
            1. AI nhận diện lại
          </button>

          {/* 2. Đọc chữ trên tem nhãn */}
          <button
            type="button"
            onClick={() => onReRecognize({ bypassCache: true, mode: 'ocr-only' })}
            disabled={isAnalyzing}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-[#0052B4]/30 text-[#072A5E] text-[11px] font-bold transition-colors"
          >
            <FileSearch className="w-3.5 h-3.5 text-[#0052B4]" />
            2. Đọc chữ tem nhãn
          </button>

          {/* 3. Chuẩn hóa tên sản phẩm */}
          <button
            type="button"
            onClick={handleNormalizeProductName}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold transition-colors"
          >
            <Wand2 className="w-3.5 h-3.5 text-[#0052B4]" />
            3. Chuẩn hóa tên SP
          </button>

          {/* 4. Đối chiếu danh mục */}
          <button
            type="button"
            onClick={() => setShowCatalogModal(true)}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-300 text-[#072A5E] text-[11px] font-bold transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#0052B4]" />
            4. Đối chiếu danh mục
          </button>

          {/* 5. Xác nhận thông tin */}
          <button
            type="button"
            onClick={handleConfirmAllInfo}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            5. Xác nhận thông tin
          </button>

          {/* 6. Khóa dữ liệu đã xác nhận */}
          <button
            type="button"
            onClick={handleToggleLockAll}
            className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-[11px] font-bold transition-colors ${
              allLocked
                ? 'bg-amber-100 border-amber-400 text-amber-900'
                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
            }`}
          >
            {allLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            6. {allLocked ? 'Đã khóa dữ liệu' : 'Khóa dữ liệu'}
          </button>

          {/* 7. Khôi phục dữ liệu trước khi nhận diện lại */}
          <button
            type="button"
            onClick={handleRestorePreviousSnapshot}
            disabled={!config.previousSnapshot}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-white hover:bg-slate-50 disabled:opacity-40 border border-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            7. Khôi phục trước đó
          </button>

          {/* 8. Áp dụng vào thiết kế */}
          <button
            type="button"
            onClick={handleApplyToCurrentDesign}
            className="flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-[#072A5E] hover:bg-[#0052B4] text-white text-[11px] font-bold transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            8. Áp dụng vào thiết kế
          </button>
        </div>

        {/* 9. Áp dụng vào toàn bộ nhóm Quy chuẩn Đa kênh */}
        <button
          type="button"
          onClick={onApplyToAllMultiChannel}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg bg-gradient-to-r from-[#072A5E] to-[#0052B4] hover:from-[#0052B4] hover:to-[#0284C7] text-white text-xs font-extrabold shadow-sm transition-all"
        >
          <Layers className="w-4 h-4 text-[#38BDF8]" />
          Áp dụng đồng bộ vào toàn bộ 7 nhóm Quy chuẩn Đa kênh
        </button>
      </div>

      {/* Modal Đối chiếu Danh mục sản phẩm chuẩn VUTECH (Mục XI - Dự phòng & Tra cứu chuẩn) */}
      {showCatalogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-[#072A5E] text-white flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider">
                  Danh mục vật tư & thiết bị xử lý nước chuẩn VUTECH
                </h3>
                <p className="text-xs text-sky-200 mt-0.5">
                  Chọn sản phẩm để đối chiếu và nạp đầy đủ Thương hiệu, Model chuẩn, Phân loại & Thông số đã xác thực
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCatalogModal(false)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold"
              >
                Đóng
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 divide-y divide-slate-100">
              {VUTECH_INTERNAL_CATALOG.map((catItem) => (
                <div
                  key={catItem.id}
                  className="pt-2.5 first:pt-0 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-sky-100 text-[#0052B4] text-[10px] font-extrabold">
                        {catItem.category}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-700">
                        Thương hiệu: {catItem.brand} · Model: {catItem.model}
                      </span>
                    </div>
                    <h4 className="text-sm font-extrabold text-[#072A5E]">
                      {catItem.productName}
                    </h4>
                    <p className="text-xs text-slate-600">
                      {catItem.subCategory} · Quy cách: {catItem.packaging}
                    </p>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {catItem.specs.slice(0, 3).map((s, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium"
                        >
                          {s.name}: {s.value} {s.unit || ''}
                        </span>
                      ))}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyCatalogProduct(catItem.id)}
                    className="px-3 py-2 rounded-xl bg-[#0052B4] hover:bg-[#072A5E] text-white text-xs font-bold shrink-0 shadow-xs"
                  >
                    Áp dụng chuẩn này
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
