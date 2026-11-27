import type {
  ProductRecognitionRecord,
  MultiChannelProductNames,
  WaterTreatmentCategoryId,
  TechnicalSpecItem,
  FieldDataSource,
  RecognitionStatus,
  ApiDiagnosticError,
  RecognitionModelOption,
} from '../types/recognition';
import type { StudioConfig, SubjectBox } from '../types/studio';
import {
  WATER_TREATMENT_CATEGORIES,
  WATER_TREATMENT_REFERENCE_BRANDS,
  VUTECH_INTERNAL_CATALOG,
  VUTECH_DISTRIBUTOR_NAME,
  filterValidSpecsForCategory,
  formatSpecForCanvas,
  buildCatalogRecognitionSpecs,
  type VutechCatalogProduct,
} from '../constants/waterTreatmentDictionary';

const RECOGNITION_CACHE_STORAGE_KEY = 'vutech_smart_recognition_v2_cache';

/**
 * Chuẩn hóa chuỗi tiếng Việt sang ASCII không dấu (dùng cho asciiFileName)
 */
export function toAsciiSlug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/×/g, 'x')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Chuẩn hóa mã Model thô đọc từ tem nhãn sang mã Model chuẩn kỹ thuật
 * Ví dụ: "001X7(C100)" -> "001×7 (C100)"
 *         "1812-75GPD"  -> "1812-75 GPD"
 */
export function normalizeProductModelCode(rawModel: string): string {
  const cleaned = (rawModel || '').trim();
  if (!cleaned) return '';

  // Không bao giờ chấp nhận mã giả VT-01..VT-05 làm model thật
  if (/^VT-0[1-9]$/i.test(cleaned)) {
    return '';
  }

  let normalized = cleaned
    // Chuẩn hóa 001X7, 001x7, 001*7 -> 001×7
    .replace(/\b(001|201)\s*[xX*]\s*(7|8)\b/g, '$1×$2')
    // Đảm bảo có khoảng trắng trước dấu ngoặc đơn: 001×7(C100) -> 001×7 (C100)
    .replace(/([a-zA-Z0-9])\(([a-zA-Z0-9]+)\)/g, '$1 ($2)')
    // Chuẩn hóa GPD: 1812-75GPD -> 1812-75 GPD
    .replace(/(\d+)\s*GPD\b/gi, '$1 GPD')
    // Chuẩn hóa m2 -> m²
    .replace(/(\d+)\s*m2\b/gi, '$1 m²')
    .replace(/\s+/g, ' ')
    .trim();

  return normalized;
}

/**
 * Xác định tiền tố loại sản phẩm chuẩn từ categoryId / subCategory / visibleText
 */
export function resolveCanonicalProductTypePrefix(
  categoryId: WaterTreatmentCategoryId,
  subCategory: string,
  visibleText: string[],
  rawProductName?: string,
): string {
  const combinedText = `${subCategory} ${visibleText.join(' ')} ${rawProductName || ''}`.toLowerCase();

  switch (categoryId) {
    case '01_ro_membrane':
      if (combinedText.includes('8040') || combinedText.includes('4040') || combinedText.includes('công nghiệp')) {
        return 'Màng RO Công Nghiệp';
      }
      return 'Màng RO';
    case '02_uf_membrane':
      if (combinedText.includes('pan') || combinedText.includes('40 m') || combinedText.includes('40m') || combinedText.includes('công nghiệp')) {
        return 'Màng Siêu Lọc UF Công Nghiệp';
      }
      return 'Màng Lọc UF';
    case '03_ion_resin':
      if (combinedText.includes('cation') || combinedText.includes('001x7') || combinedText.includes('001×7') || combinedText.includes('001x8') || combinedText.includes('c100')) {
        return 'Hạt Nhựa Cation';
      }
      if (combinedText.includes('anion') || combinedText.includes('201x7') || combinedText.includes('201×7')) {
        return 'Hạt Nhựa Anion';
      }
      if (combinedText.includes('mixed bed') || combinedText.includes('mb400')) {
        return 'Hạt Nhựa Mixed Bed';
      }
      return 'Hạt Nhựa Trao Đổi Ion';
    case '04_filter_media':
      if (combinedText.includes('than hoạt tính') || combinedText.includes('activated carbon')) {
        return 'Than Hoạt Tính Lọc Nước';
      }
      if (combinedText.includes('cát thạch anh')) return 'Cát Thạch Anh Lọc Nước';
      if (combinedText.includes('mangan')) return 'Hạt Mangan Lọc Nước';
      if (combinedText.includes('birm')) return 'Hạt Birm Khử Sắt';
      if (combinedText.includes('odm')) return 'Vật Liệu Lọc Đa Năng';
      return 'Vật Liệu Lọc Nước';
    case '05_vessels_tanks':
      if (combinedText.includes('inox')) return 'Cột Lọc Inox';
      if (combinedText.includes('bồn muối')) return 'Bồn Muối Hoàn Nguyên';
      if (combinedText.includes('bồn hóa chất')) return 'Bồn Chứa Hóa Chất';
      return 'Cột Lọc Composite';
    case '06_control_valves':
      if (combinedText.includes('làm mềm') || combinedText.includes('f63') || combinedText.includes('f65') || combinedText.includes('f68') || combinedText.includes('5 ngả')) {
        return 'Van Tự Động Làm Mềm Nước';
      }
      if (combinedText.includes('f67') || combinedText.includes('f71')) {
        return 'Van Tự Động Sục Rửa Cột Lọc';
      }
      if (combinedText.includes('van cơ') || combinedText.includes('f56') || combinedText.includes('f64')) {
        return 'Van Cơ Cột Lọc';
      }
      return 'Van Điều Khiển';
    case '07_membrane_housings':
      if (combinedText.includes('inox')) return 'Vỏ Màng RO Inox';
      if (combinedText.includes('composite') || combinedText.includes('frp')) return 'Vỏ Màng RO Composite';
      return 'Vỏ Màng RO';
    case '08_edi_equipment':
      return 'Module EDI';
    case '09_auxiliary_equipment':
      if (combinedText.includes('bơm định lượng')) return 'Bơm Định Lượng Hóa Chất';
      if (combinedText.includes('bơm') || combinedText.includes('cdlf') || combinedText.includes('cdl')) return 'Bơm Trục Đứng Cao Áp RO';
      if (combinedText.includes('đồng hồ áp')) return 'Đồng Hồ Áp Suất';
      if (combinedText.includes('lưu lượng kế') || combinedText.includes('rotameter')) return 'Lưu Lượng Kế';
      if (combinedText.includes('tds') || combinedText.includes('độ dẫn') || combinedText.includes('cct') || combinedText.includes('cm-230')) {
        return 'Bộ Đo Độ Dẫn Điện / TDS';
      }
      return 'Thiết Bị Phụ Trợ Xử Lý Nước';
    case '10_complete_systems':
      if (combinedText.includes('ro')) return 'Hệ Thống Lọc Nước RO Công Nghiệp';
      if (combinedText.includes('uf')) return 'Hệ Thống Siêu Lọc UF Công Nghiệp';
      if (combinedText.includes('edi')) return 'Hệ Thống Xử Lý Nước Siêu Tinh Khiết EDI';
      return 'Hệ Thống Xử Lý Nước Công Nghiệp';
    default:
      return '';
  }
}

/**
 * MỤC VI: BỘ CHUẨN HÓA TÊN SẢN PHẨM (PRODUCT NAME NORMALIZATION ENGINE)
 * Công thức: [Loại sản phẩm] + [Thương hiệu] + [Model] + [Thông số phân biệt chính nếu đã xác thực]
 */
export function buildNormalizedProductName(params: {
  categoryId: WaterTreatmentCategoryId;
  subCategory: string;
  brand: string;
  model: string;
  rawModel: string;
  visibleText: string[];
  existingName?: string;
  distinguishingSpec?: string;
}): { standardName: string; shortName: string } {
  const normalizedModel = normalizeProductModelCode(params.model || params.rawModel);
  const cleanBrand =
    params.brand &&
    params.brand !== 'Chưa xác định thương hiệu' &&
    params.brand !== 'Chưa xác định'
      ? params.brand.trim().toUpperCase()
      : '';

  const typePrefix = resolveCanonicalProductTypePrefix(
    params.categoryId,
    params.subCategory,
    params.visibleText,
    params.existingName,
  );

  // Trường hợp đặc biệt đã có trong quy tắc chuẩn Mục VI
  if (
    cleanBrand === 'EXTREPURE' &&
    (normalizedModel.includes('001×7') || normalizedModel.includes('C100'))
  ) {
    const modelStr = normalizedModel.includes('C100') ? '001×7 (C100)' : normalizedModel;
    return {
      standardName: `Hạt Nhựa Cation EXTREPURE ${modelStr}`,
      shortName: `Hạt Nhựa Cation EXTREPURE ${modelStr}`,
    };
  }

  if (cleanBrand === 'EXTREPURE' && normalizedModel.includes('001×8')) {
    return {
      standardName: `Hạt Nhựa Cation EXTREPURE 001×8`,
      shortName: `Hạt Nhựa Cation EXTREPURE 001×8`,
    };
  }

  const parts: string[] = [];
  if (typePrefix) parts.push(typePrefix);

  if (cleanBrand && !typePrefix.toUpperCase().includes(cleanBrand)) {
    parts.push(cleanBrand);
  }

  if (normalizedModel && !parts.join(' ').toUpperCase().includes(normalizedModel.toUpperCase())) {
    parts.push(normalizedModel);
  }

  if (
    params.distinguishingSpec &&
    !parts.join(' ').toLowerCase().includes(params.distinguishingSpec.toLowerCase())
  ) {
    parts.push(params.distinguishingSpec.trim());
  }

  const standardName = parts.join(' ').replace(/\s+/g, ' ').trim();

  if (!standardName) {
    return {
      standardName: 'Cần bổ sung thông tin sản phẩm',
      shortName: 'Cần bổ sung thông tin',
    };
  }

  // Tạo shortName gọn gàng (tối đa ~42 ký tự để hiển thị đẹp trên banner)
  const shortParts = [typePrefix, cleanBrand, normalizedModel].filter(Boolean);
  let shortName = shortParts.join(' ').replace(/\s+/g, ' ').trim() || standardName;
  if (shortName.length > 46) {
    shortName = shortName.slice(0, 44).trim();
  }

  return { standardName, shortName };
}

/**
 * MỤC VII: TỰ ĐỘNG TẠO 7 TÊN SẢN PHẨM ĐA KÊNH TỪ 01 BẢN GHI GỐC
 */
export function generateMultiChannelProductNames(params: {
  standardName: string;
  shortName: string;
  brand: string;
  model: string;
  category: string;
  packaging?: string;
  keySpecText?: string;
}): MultiChannelProductNames {
  const std = params.standardName?.trim() || 'Cần bổ sung thông tin sản phẩm';
  const short = params.shortName?.trim() || std;
  const cleanBrand =
    params.brand && !params.brand.startsWith('Chưa xác định') ? params.brand.trim() : '';
  const cleanModel =
    params.model && !params.model.startsWith('Chưa xác định') ? params.model.trim() : '';
  const specSuffix = params.keySpecText?.trim()
    ? ` - ${params.keySpecText.trim()}`
    : params.packaging?.trim()
      ? ` - ${params.packaging.trim()}`
      : '';

  // 1. Tên chuẩn kỹ thuật
  const standardName = std;

  // 2. Tên ngắn hiển thị trên ảnh thiết kế
  const shortName = short;

  // 3. Tên sản phẩm đăng Shopee: [Tên chuẩn] [Quy cách/Thông số] Chính Hãng Phân Phối Bởi VUTECH
  const shopeeName = `${std}${specSuffix} | Vật Tư Xử Lý Nước VUTECH`;

  // 4. Tên sản phẩm SEO Website VUTECH
  const websiteSeoName = `${std}${cleanModel && !std.includes(cleanModel) ? ` (${cleanModel})` : ''} – Phân Phối Chính Ngạch VUTECH`;

  // 5. Tiêu đề quảng cáo Facebook
  const facebookAdTitle = `${std.toUpperCase()}${specSuffix ? ` ${specSuffix.toUpperCase()}` : ''} – SẴN KHO VUTECH`;

  // 6. Tên hồ sơ kỹ thuật / báo giá
  const technicalFullName = [
    std,
    cleanBrand ? `Thương hiệu: ${cleanBrand}` : '',
    cleanModel ? `Model: ${cleanModel}` : '',
    params.packaging ? `Quy cách: ${params.packaging}` : '',
    `Đơn vị cung cấp: ${VUTECH_DISTRIBUTOR_NAME}`,
  ]
    .filter(Boolean)
    .join(' | ');

  // 7. Tên file ảnh xuất chuẩn ASCII không dấu
  const asciiFileName = toAsciiSlug(
    [std, cleanModel && !std.includes(cleanModel) ? cleanModel : '', 'vutech']
      .filter(Boolean)
      .join('-'),
  );

  return {
    standardName,
    shortName,
    shopeeName,
    websiteSeoName,
    facebookAdTitle,
    technicalFullName,
    asciiFileName: asciiFileName || 'vutech-product-image',
  };
}

/**
 * Tính mã băm FNV-1a 64-bit nhanh trên chuỗi ảnh gốc Base64/URL để cache kết quả nhận diện
 */
export function computeImageContentHash(imageDataUrl: string, fileName = ''): string {
  const str = `${fileName}::${imageDataUrl.length}::${imageDataUrl.slice(0, 4096)}::${imageDataUrl.slice(-4096)}`;
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `v2_${(h2 >>> 0).toString(16).padStart(8, '0')}${(h1 >>> 0).toString(16).padStart(8, '0')}`;
}

export function getCachedRecognitionByHash(imageHash: string): ProductRecognitionRecord | null {
  try {
    const raw = localStorage.getItem(RECOGNITION_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, ProductRecognitionRecord>;
    return map[imageHash] || null;
  } catch {
    return null;
  }
}

export function setCachedRecognitionByHash(
  imageHash: string,
  record: ProductRecognitionRecord,
): void {
  try {
    const raw = localStorage.getItem(RECOGNITION_CACHE_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, ProductRecognitionRecord>) : {};
    map[imageHash] = { ...record, imageHash };
    // Giữ tối đa 40 bản ghi gần nhất để không đầy localStorage
    const keys = Object.keys(map);
    if (keys.length > 40) {
      delete map[keys[0]];
    }
    localStorage.setItem(RECOGNITION_CACHE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * BƯỚC 1 & 2 CỦA PIPELINE 14 BƯỚC:
 * Tạo bản sao ảnh tăng tương phản nhẹ & giữ độ phân giải cao từ ảnh gốc (sourceImageUrl)
 * để AI đọc chữ nhỏ trên bao bì, tem màng lọc, mã model rõ nét nhất.
 * Tuyệt đối KHÔNG ghi đè lên ảnh gốc hiển thị trên khung thiết kế.
 */
export async function createEnhancedRecognitionImageCopy(
  sourceImageUrl: string,
): Promise<{
  base64Data: string;
  mimeType: string;
  width: number;
  height: number;
  qualityWarnings: string[];
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const qualityWarnings: string[] = [];
      const naturalW = img.naturalWidth || img.width || 800;
      const naturalH = img.naturalHeight || img.height || 800;

      if (naturalW < 500 || naturalH < 500) {
        qualityWarnings.push(
          `Độ phân giải ảnh gốc thấp (${naturalW}×${naturalH} px). Khuyến nghị tải ảnh từ 1000×1000 px trở lên để đọc rõ chữ nhỏ trên tem nhãn.`,
        );
      }

      // Giữ kích thước đủ lớn (tối đa 1600px cạnh dài) để đọc rõ mã model nhỏ trên tem nhãn
      const maxDim = 1600;
      const scale = Math.min(1, maxDim / Math.max(naturalW, naturalH));
      const targetW = Math.max(1, Math.round(naturalW * scale));
      const targetH = Math.max(1, Math.round(naturalH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Không thể khởi tạo bộ xử lý ảnh nhận diện 2D.'));
        return;
      }

      // Tăng nhẹ độ tương phản và độ sáng vừa phải để làm rõ chữ in trên bao tải/tem nhãn
      ctx.filter = 'contrast(1.12) brightness(1.03)';
      ctx.drawImage(img, 0, 0, targetW, targetH);
      ctx.filter = 'none';

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
      if (!match) {
        reject(new Error('Lỗi chuyển đổi Base64 cho ảnh nhận diện.'));
        return;
      }

      resolve({
        mimeType: match[1],
        base64Data: match[2],
        width: naturalW,
        height: naturalH,
        qualityWarnings,
      });
    };
    img.onerror = () => {
      reject(new Error('Không thể đọc dữ liệu ảnh gốc để nhận diện.'));
    };
    img.src = sourceImageUrl;
  });
}

/**
 * Đối chiếu với Danh mục sản phẩm nội bộ VUTECH (VUTECH_INTERNAL_CATALOG)
 * từ visibleText, brand, model hoặc tên file ảnh.
 */
export function matchInternalVutechCatalog(params: {
  brand?: string;
  model?: string;
  rawModel?: string;
  visibleText?: string[];
  fileName?: string;
}): VutechCatalogProduct | null {
  const rawJoined = [
    params.brand || '',
    params.model || '',
    params.rawModel || '',
    ...(params.visibleText || []),
    params.fileName || '',
  ]
    .join(' ')
    .toUpperCase();

  if (!rawJoined.trim()) return null;

  // Chuẩn hóa nhẹ các biến thể ký tự thường gặp khi quét OCR trên bao tải / tem màng lọc
  const tokens = rawJoined
    .replace(/OO1/g, '001')
    .replace(/O01/g, '001')
    .replace(/0O1/g, '001')
    .replace(/C1OO/g, 'C100')
    .replace(/C10O/g, 'C100')
    .replace(/3O13/g, '3013')
    .replace(/3O12/g, '3012')
    .replace(/4OO/g, '400');

  for (const item of VUTECH_INTERNAL_CATALOG) {
    const brandMatched = tokens.includes(item.brand.toUpperCase());
    const modelMatched = item.rawModelAliases.some((alias) =>
      tokens.includes(alias.toUpperCase()),
    );
    if (brandMatched && modelMatched) {
      return item;
    }
  }

  // Nếu đọc được chữ EXTREPURE kèm CATION hoặc 001 hoặc C100 trên bao tải
  if (
    tokens.includes('EXTREPURE') &&
    (tokens.includes('001') || tokens.includes('C100') || tokens.includes('CATION') || tokens.includes('25L'))
  ) {
    const extItem = VUTECH_INTERNAL_CATALOG.find(
      (it) => it.id === 'cat-extrepure-001x7-c100',
    );
    if (extItem) return extItem;
  }

  // Nếu đọc được chữ FROTEC kèm 3013 hoặc 400
  if (
    (tokens.includes('FROTEC') || tokens.includes('ROTEC')) &&
    (tokens.includes('3013') || tokens.includes('400'))
  ) {
    const frotec3013 = VUTECH_INTERNAL_CATALOG.find(
      (it) => it.id === 'cat-frotec-ro-3013-400',
    );
    if (frotec3013) return frotec3013;
  }

  // Nếu khớp chính xác một model đặc thù (như 001X7(C100), RO-3013-400, XLPFT-8040, F63B1, KXA-200)
  for (const item of VUTECH_INTERNAL_CATALOG) {
    const strongAliasMatch = item.rawModelAliases.some((alias) => {
      if (alias.length < 4) return false;
      return tokens.includes(alias.toUpperCase());
    });
    if (strongAliasMatch) {
      return item;
    }
  }

  return null;
}

/**
 * Danh sách từ khóa thông dụng trên bao bì/tem nhãn KHÔNG phải là tên Thương hiệu (Stopwords)
 */
const OCR_BRAND_STOPWORDS = new Set([
  'MODEL',
  'SERIAL',
  'NUMBER',
  'MADE',
  'CHINA',
  'INDIA',
  'KOREA',
  'JAPAN',
  'USA',
  'ITALY',
  'GERMANY',
  'TAIWAN',
  'VIETNAM',
  'WATER',
  'FILTER',
  'FILTRATION',
  'MEMBRANE',
  'ELEMENT',
  'REVERSE',
  'OSMOSIS',
  'RESIN',
  'CATION',
  'ANION',
  'EXCHANGE',
  'STRONG',
  'ACID',
  'BASE',
  'GRADE',
  'TYPE',
  'CODE',
  'SIZE',
  'WEIGHT',
  'VOLUME',
  'NET',
  'GROSS',
  'PRESSURE',
  'FLOW',
  'RATE',
  'CAPACITY',
  'MAX',
  'MIN',
  'TEMP',
  'TEMPERATURE',
  'WARNING',
  'CAUTION',
  'STORAGE',
  'DISPOSAL',
  'FIRST',
  'AID',
  'MEASURES',
  'FIRE',
  'FIGHTING',
  'ACCIDENTAL',
  'RELEASE',
  'HANDLING',
  'SYSTEM',
  'VALVE',
  'CONTROL',
  'AUTOMATIC',
  'PUMP',
  'HOUSING',
  'VESSEL',
  'TANK',
  'CARBON',
  'ACTIVATED',
  'MEDIA',
  'CARTRIDGE',
  'INDUSTRIAL',
  'COMMERCIAL',
  'DOMESTIC',
  'HIGH',
  'LOW',
  'PURE',
  'ULTRA',
  'SUPER',
  'QUALITY',
  'STANDARD',
  'CERTIFIED',
  'ISO',
  'NSF',
  'ANSI',
  'ROHS',
  'CE',
  'VUTECH',
  'PRODUCT',
  'IMAGE',
  'PHOTO',
  'IMG',
  'SCREENSHOT',
  'UNTITLED',
]);

/**
 * Trích xuất linh động Thương hiệu, Model, Nhóm sản phẩm, Vật liệu, Xuất xứ, Quy cách
 * và Thông số kỹ thuật từ BẤT KỲ văn bản OCR + Kết quả tìm kiếm trực tuyến nào.
 * Hoạt động tổng quát cho mọi sản phẩm trên thị trường (không giới hạn ở danh mục mẫu).
 */
export function extractUniversalProductIdentityAndSpecs(params: {
  visibleText: string[];
  webSnippets?: string[];
  fileName?: string;
  manualBrand?: string;
  manualModel?: string;
}): {
  brand: string;
  manufacturer: string;
  rawModel: string;
  normalizedModel: string;
  categoryId: WaterTreatmentCategoryId;
  categoryName: string;
  subCategory: string;
  material: string;
  origin: string;
  packaging: string;
  specs: TechnicalSpecItem[];
} {
  const cleanFileName = (params.fileName || '')
    .replace(/\.[^.]+$/, '')
    .replace(/\b(img|image|photo|screenshot|whatsapp|zalo|vutech|copy|edit|final|\d{8,})\b/gi, ' ')
    .replace(/[_-]+/g, ' ')
    .trim();

  const ocrLines = (params.visibleText || []).map((l) => l.trim()).filter(Boolean);
  const snippetLines = (params.webSnippets || []).map((s) => s.trim()).filter(Boolean);

  const primaryOcrText = [
    params.manualBrand || '',
    params.manualModel || '',
    ...ocrLines,
    cleanFileName,
  ]
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  const fullTextPool = [primaryOcrText, ...snippetLines].join(' \n ');
  const upperOcrText = primaryOcrText.toUpperCase();
  const upperFullPool = fullTextPool.toUpperCase();

  // 1. DÒ THƯƠNG HIỆU (Ưu tiên từ điển thương hiệu -> Nhãn "BRAND:" -> Từ in hoa nổi bật trên tem nhãn)
  let detectedBrand = (params.manualBrand || '').trim();
  let detectedManufacturer = '';
  let detectedOrigin = '';

  if (!detectedBrand) {
    for (const refBrand of WATER_TREATMENT_REFERENCE_BRANDS) {
      if (refBrand.aliases.some((alias) => upperFullPool.includes(alias.toUpperCase()))) {
        detectedBrand = refBrand.brand;
        detectedManufacturer = refBrand.manufacturer;
        detectedOrigin = refBrand.defaultOrigin;
        break;
      }
    }
  }

  // Nếu thương hiệu chưa có trong từ điển tham chiếu, chủ động tìm thương hiệu bất kỳ trên tem nhãn
  if (!detectedBrand) {
    const explicitBrandMatch = primaryOcrText.match(
      /\b(?:BRAND|THƯƠNG HIỆU|MFG|MANUFACTURER|BY)\s*[:.-]?\s*([A-Z][A-Z0-9-]{2,15})\b/i,
    );
    if (explicitBrandMatch && explicitBrandMatch[1]) {
      const candidate = explicitBrandMatch[1].toUpperCase();
      if (!OCR_BRAND_STOPWORDS.has(candidate)) {
        detectedBrand = candidate;
      }
    }
  }

  if (!detectedBrand) {
    // Quét các dòng đầu tiên của OCR để tìm tên thương hiệu in hoa (ví dụ: AQUAPURE, HYDRANAUTICS, LANXESS, SOLTEC, PENTAX...)
    for (const line of ocrLines.slice(0, 8)) {
      const words = line
        .toUpperCase()
        .replace(/[^A-Z0-9-\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean);
      for (const word of words) {
        if (
          /^[A-Z]{4,14}$/.test(word) &&
          !OCR_BRAND_STOPWORDS.has(word) &&
          !/^(HTTP|HTTPS|HTML|JPEG|WEBP)$/.test(word)
        ) {
          detectedBrand = word;
          break;
        }
      }
      if (detectedBrand) break;
    }
  }

  // 2. DÒ MÃ MODEL (Ưu tiên pattern chuyên ngành -> Nhãn "MODEL:" -> Mã chữ+số bất kỳ trên tem)
  let detectedRawModel = (params.manualModel || '').trim();
  let detectedCategoryId: WaterTreatmentCategoryId = 'unclassified';
  let detectedCategoryName = 'Chưa xác định nhóm sản phẩm';
  let detectedSubCategory = 'Thiết bị & Vật tư xử lý nước';

  for (const cat of WATER_TREATMENT_CATEGORIES) {
    for (const pattern of cat.modelPatterns) {
      const m = primaryOcrText.match(pattern) || fullTextPool.match(pattern);
      if (m && m[0]) {
        if (!detectedRawModel) detectedRawModel = m[0].trim();
        detectedCategoryId = cat.id;
        detectedCategoryName = cat.name;
        detectedSubCategory = cat.subCategories[0];
        break;
      }
    }
    if (detectedCategoryId !== 'unclassified') break;
  }

  // Tìm theo từ khóa ngữ nghĩa nếu chưa khớp pattern model cố định
  if (detectedCategoryId === 'unclassified') {
    const lowerPool = fullTextPool.toLowerCase();
    for (const cat of WATER_TREATMENT_CATEGORIES) {
      if (cat.keywords.some((kw) => lowerPool.includes(kw.toLowerCase()))) {
        detectedCategoryId = cat.id;
        detectedCategoryName = cat.name;
        detectedSubCategory = cat.subCategories[0];
        break;
      }
    }
  }

  // Nếu sản phẩm mới chưa khớp modelPatterns cố định, tìm mã Model tổng quát trên tem nhãn
  if (!detectedRawModel) {
    const explicitModelMatch = primaryOcrText.match(
      /\b(?:MODEL|MOD|TYPE|CODE|ITEM|PART\s*NO|P\/N)\s*[:.#-]?\s*([A-Z0-9][A-Z0-9-()×xX*/]{2,20})\b/i,
    );
    if (explicitModelMatch && explicitModelMatch[1]) {
      const candidate = explicitModelMatch[1].trim();
      if (!OCR_BRAND_STOPWORDS.has(candidate.toUpperCase())) {
        detectedRawModel = candidate;
      }
    }
  }

  if (!detectedRawModel) {
    // Tìm tổ hợp Mã Kỹ Thuật chữ-số đặc trưng (VD: RO-3013-400, XLP11-4040, UF-2500, CDLF8-10, P02523W, 001X7(C100), F63C3...)
    const universalModelRegexes = [
      /\b(?:001|201)\s*[xX×*]\s*[78](?:\s*\([A-Z0-9-]+\))?\b/i,
      /\b[A-Z]{1,6}\s*[-/]\s*\d{2,5}(?:\s*[-/]\s*[A-Z0-9]{1,6})?\b/,
      /\b[A-Z]{1,5}\d{1,4}(?:[-/][A-Z0-9]{1,6})+\b/,
      /\b[A-Z]{2,5}\d{2,5}[A-Z0-9()]{0,6}\b/,
      /\b\d{4}\s*-\s*\d{2,4}\s*(?:GPD)?\b/i,
    ];

    for (const rx of universalModelRegexes) {
      const m = upperOcrText.match(rx);
      if (m && m[0]) {
        const candidate = m[0].trim();
        // Không lấy nhầm đơn vị đo hoặc năm sản xuất hoặc điện áp đơn thuần
        if (
          !/^(202\d|199\d|220V|380V|50HZ|60HZ|100L|25KG|50KG|1000L)$/i.test(candidate) &&
          candidate.toUpperCase() !== detectedBrand.toUpperCase()
        ) {
          detectedRawModel = candidate;
          break;
        }
      }
    }
  }

  const normalizedModel = normalizeProductModelCode(detectedRawModel);

  // 3. TRÍCH XUẤT VẬT LIỆU, XUẤT XỨ & QUY CÁCH ĐÓNG GÓI TỪ VĂN BẢN OCR + WEB
  let detectedMaterial = '';
  const materialPatterns: Array<{ rx: RegExp; label: string }> = [
    { rx: /\b(?:SUS\s*304|INOX\s*304|SS\s*304)\b/i, label: 'Inox SUS 304' },
    { rx: /\b(?:SUS\s*316L?|INOX\s*316L?|SS\s*316L?)\b/i, label: 'Inox SUS 316' },
    { rx: /\b(?:FRP|COMPOSITE|SỢI THỦY TINH)\b/i, label: 'Composite sợi thủy tinh (FRP)' },
    { rx: /\b(?:TFC|THIN[- ]FILM COMPOSITE|POLYAMIDE)\b/i, label: 'Màng Thin-Film Composite (Polyamide)' },
    { rx: /\b(?:PVDF)\b/i, label: 'Màng sợi rỗng PVDF' },
    { rx: /\b(?:PAN|POLYACRYLONITRILE)\b/i, label: 'Sợi rỗng ưa nước PAN' },
    { rx: /\b(?:PES|POLYETHERSULFONE)\b/i, label: 'Màng sợi rỗng PES' },
    { rx: /\b(?:POLYSTYRENE|STYRENE[- ]DIVINYLBENZENE|GEL[- ]TYPE)\b/i, label: 'Polystyrene Gel tổng hợp' },
    { rx: /\b(?:UPVC|U-PVC)\b/i, label: 'Nhựa kỹ thuật UPVC' },
    { rx: /\b(?:PP|POLYPROPYLENE)\b/i, label: 'Polypropylene (PP)' },
    { rx: /\b(?:COCONUT SHELL|GÁO DỪA|ACTIVATED CARBON|THAN HOẠT TÍNH)\b/i, label: 'Than hoạt tính gáo dừa' },
  ];
  for (const mp of materialPatterns) {
    if (mp.rx.test(fullTextPool)) {
      detectedMaterial = mp.label;
      break;
    }
  }

  if (!detectedOrigin) {
    const originPatterns: Array<{ rx: RegExp; label: string }> = [
      { rx: /\b(?:MADE IN USA|U\.S\.A|MỸ)\b/i, label: 'USA' },
      { rx: /\b(?:MADE IN CHINA|P\.R\.C|TRUNG QUỐC)\b/i, label: 'China' },
      { rx: /\b(?:MADE IN KOREA|HÀN QUỐC)\b/i, label: 'Korea' },
      { rx: /\b(?:MADE IN JAPAN|NHẬT BẢN)\b/i, label: 'Japan' },
      { rx: /\b(?:MADE IN TAIWAN|ĐÀI LOAN)\b/i, label: 'Taiwan' },
      { rx: /\b(?:MADE IN ITALY|ITALIA|Ý)\b/i, label: 'Italy' },
      { rx: /\b(?:MADE IN GERMANY|ĐỨC)\b/i, label: 'Germany' },
      { rx: /\b(?:MADE IN INDIA|ẤN ĐỘ)\b/i, label: 'India' },
      { rx: /\b(?:MADE IN VIETNAM|VIỆT NAM)\b/i, label: 'Việt Nam' },
    ];
    for (const op of originPatterns) {
      if (op.rx.test(fullTextPool)) {
        detectedOrigin = op.label;
        break;
      }
    }
  }

  let detectedPackaging = '';
  const pkgMatch =
    primaryOcrText.match(/\b(\d{1,3}(?:[.,]\d+)?\s*(?:L|LÍT|LITERS|LITRES|KG|KGS)(?:\s*\/\s*(?:BAO|BAG|THÙNG|DRUM))?)\b/i) ||
    fullTextPool.match(/\b(\d{1,3}(?:[.,]\d+)?\s*(?:L|LÍT|LITERS|KG|KGS)\s*\/\s*(?:BAO|BAG))\b/i);
  if (pkgMatch && pkgMatch[1]) {
    detectedPackaging = pkgMatch[1].replace(/\s+/g, ' ').trim();
  }

  // 4. TRÍCH XUẤT THÔNG SỐ KỸ THUẬT TỰ ĐỘNG TỪ OCR VÀ WEB SNIPPETS
  const specs: TechnicalSpecItem[] = [];
  const addSpecIfUnique = (
    name: string,
    value: string,
    unit: string | undefined,
    source: FieldDataSource,
    confidence = 0.88,
  ) => {
    const cleanVal = value.trim();
    if (!cleanVal) return;
    if (!specs.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      specs.push({
        name,
        value: cleanVal,
        unit,
        source,
        confidence,
        verified: true,
      });
    }
  };

  const detectSource = (pattern: RegExp): FieldDataSource =>
    pattern.test(primaryOcrText) ? 'IMAGE_LABEL' : 'DATASHEET';

  // (a) Công suất GPD (Màng RO: 50 GPD, 75 GPD, 100 GPD, 400 GPD, 600 GPD, 800 GPD...)
  const gpdRegex = /\b(\d{2,5})\s*GPD\b/i;
  const gpdMatch = fullTextPool.match(gpdRegex);
  if (gpdMatch) {
    addSpecIfUnique('Công suất lọc', gpdMatch[1], 'GPD', detectSource(gpdRegex), 0.92);
  } else if (/\bRO-?3013-?400\b/i.test(fullTextPool)) {
    addSpecIfUnique('Công suất lọc', '400', 'GPD', 'IMAGE_LABEL', 0.94);
  } else if (/\bRO-?3012-?(\d{3})\b/i.test(fullTextPool)) {
    const m3012 = fullTextPool.match(/\bRO-?3012-?(\d{3})\b/i);
    if (m3012) addSpecIfUnique('Công suất lọc', m3012[1], 'GPD', 'IMAGE_LABEL', 0.92);
  } else if (/\b1812-?(\d{2,3})\b/i.test(fullTextPool)) {
    const m1812 = fullTextPool.match(/\b1812-?(\d{2,3})\b/i);
    if (m1812) addSpecIfUnique('Công suất lọc', m1812[1], 'GPD', 'IMAGE_LABEL', 0.92);
  }

  // (b) Lưu lượng m³/h hoặc L/h hoặc LPM
  const flowRegex = /\b(\d+(?:[.,]\d+)?(?:\s*[-~]\s*\d+(?:[.,]\d+)?)?)\s*(m3\/h|m³\/h|L\/h|L\/min|LPM|GPM)\b/i;
  const flowMatch = fullTextPool.match(flowRegex);
  if (flowMatch) {
    const unit = flowMatch[2].replace('m3/h', 'm³/h');
    addSpecIfUnique('Lưu lượng định mức', flowMatch[1], unit, detectSource(flowRegex), 0.9);
  }

  // (c) Kích thước màng / Cột lọc tiêu chuẩn (1812, 2012, 3012, 3013, 4021, 4040, 8040, 1054, 1252, 1354, 1465, 1665...)
  const sizeCodeMatch = fullTextPool.match(/\b(1812|2012|3012|3013|4021|4040|8040|1054|1252|1354|1465|1665|1865|2162|2472|3072|3672)\b/);
  if (sizeCodeMatch) {
    const code = sizeCodeMatch[1];
    if (['1812', '2012', '3012', '3013', '4021', '4040', '8040'].includes(code)) {
      addSpecIfUnique('Kích thước tiêu chuẩn', `Chuẩn ${code}`, undefined, detectSource(new RegExp(code)), 0.93);
    } else {
      addSpecIfUnique('Kích thước cột lọc', `Mã ${code}`, undefined, detectSource(new RegExp(code)), 0.92);
    }
  }

  // (d) Áp suất làm việc (psi, bar, MPa)
  const pressureRegex = /\b(\d{1,4}(?:[.,]\d+)?(?:\s*[-~]\s*\d{1,4}(?:[.,]\d+)?)?)\s*(psi|bar|MPa)\b/i;
  const pressureMatch = fullTextPool.match(pressureRegex);
  if (pressureMatch) {
    addSpecIfUnique('Áp suất vận hành', pressureMatch[1], pressureMatch[2], detectSource(pressureRegex), 0.9);
  }

  // (e) Cấp độ lọc / Kích thước lỗ lọc (micron, µm)
  const micronRegex = /\b(\d+(?:[.,]\d+)?)\s*(micron|µm|um)\b/i;
  const micronMatch = fullTextPool.match(micronRegex);
  if (micronMatch) {
    addSpecIfUnique('Cấp độ lọc', micronMatch[1], 'µm', detectSource(micronRegex), 0.9);
  }

  // (f) Diện tích màng lọc (m², ft²)
  const areaRegex = /\b(\d+(?:[.,]\d+)?)\s*(m2|m²|ft2|ft²)\b/i;
  const areaMatch = fullTextPool.match(areaRegex);
  if (areaMatch) {
    const unit = areaMatch[2].replace('m2', 'm²').replace('ft2', 'ft²');
    addSpecIfUnique('Diện tích màng lọc', areaMatch[1], unit, detectSource(areaRegex), 0.9);
  }

  // (g) Tỷ lệ khử muối (%)
  const rejectionRegex = /\b(9[5-9](?:[.,]\d+)?)\s*%\b/;
  const rejectionMatch = fullTextPool.match(rejectionRegex);
  if (rejectionMatch && (detectedCategoryId === '01_ro_membrane' || /RO|MEMBRANE|REJECTION|KHỬ MUỐI/i.test(fullTextPool))) {
    addSpecIfUnique('Tỷ lệ khử muối', rejectionMatch[1], '%', detectSource(rejectionRegex), 0.89);
  }

  // (h) Tổng dung lượng trao đổi hạt nhựa (eq/L) hoặc Gốc ion
  const eqRegex = /\b(≥?\s*\d+(?:[.,]\d+)?)\s*(eq\/L|meq\/g)\b/i;
  const eqMatch = fullTextPool.match(eqRegex);
  if (eqMatch) {
    addSpecIfUnique('Tổng dung lượng trao đổi', eqMatch[1], eqMatch[2], detectSource(eqRegex), 0.91);
  }
  if (detectedCategoryId === '03_ion_resin' || /\b(001[xX×*]7|001[xX×*]8|C100|CATION)\b/i.test(fullTextPool)) {
    if (/\b(001[xX×*]7|C100)\b/i.test(fullTextPool)) {
      addSpecIfUnique('Loại hạt nhựa', 'Cation axit mạnh (Gel)', undefined, 'DATASHEET', 0.92);
    }
    if (/\bNa\+?\b/i.test(fullTextPool) || /\b001[xX×*]7\b/i.test(fullTextPool)) {
      addSpecIfUnique('Dạng ion xuất xưởng', 'Na+', undefined, 'DATASHEET', 0.91);
    }
  }

  // (i) Quy cách đóng gói (25L/bao, 25kg/bao...)
  if (detectedPackaging) {
    addSpecIfUnique('Quy cách đóng gói', detectedPackaging, undefined, 'IMAGE_LABEL', 0.93);
  }

  // (j) Cổ kết nối / Đường kính ống (DN, inch, mm)
  const portRegex = /\b(DN\s*\d{2,3}|\d+(?:\/\d+)?\s*inch|Ø\s*\d{2,3}\s*mm)\b/i;
  const portMatch = fullTextPool.match(portRegex);
  if (portMatch && specs.length < 4) {
    addSpecIfUnique('Kích thước kết nối', portMatch[1].replace(/\s+/g, ' '), undefined, detectSource(portRegex), 0.88);
  }

  // (k) Điện áp / Công suất điện (chỉ áp dụng cho bơm, van điều khiển, EDI, hệ thống)
  if (
    ['06_control_valves', '08_edi_equipment', '09_auxiliary_equipment', '10_complete_systems', 'unclassified'].includes(
      detectedCategoryId,
    )
  ) {
    const powerRegex = /\b(\d+(?:[.,]\d+)?)\s*(kW|HP|W)\b/i;
    const powerMatch = fullTextPool.match(powerRegex);
    if (powerMatch) {
      addSpecIfUnique('Công suất điện', powerMatch[1], powerMatch[2], detectSource(powerRegex), 0.89);
    }
    const voltRegex = /\b(220\s*V(?:AC)?|380\s*V(?:AC)?|24\s*V(?:DC)?|12\s*V(?:DC)?)\b/i;
    const voltMatch = fullTextPool.match(voltRegex);
    if (voltMatch) {
      addSpecIfUnique('Điện áp hoạt động', voltMatch[1], undefined, detectSource(voltRegex), 0.89);
    }
  }

  // (l) Vật liệu cấu tạo (nếu đã phát hiện và còn chỗ hiển thị)
  if (detectedMaterial) {
    addSpecIfUnique('Vật liệu cấu tạo', detectedMaterial, undefined, 'DATASHEET', 0.88);
  }

  const validSpecs = filterValidSpecsForCategory(detectedCategoryId, specs);

  return {
    brand: detectedBrand,
    manufacturer: detectedManufacturer || detectedBrand,
    rawModel: detectedRawModel,
    normalizedModel,
    categoryId: detectedCategoryId,
    categoryName: detectedCategoryName,
    subCategory: detectedSubCategory,
    material: detectedMaterial,
    origin: detectedOrigin,
    packaging: detectedPackaging,
    specs: validSpecs,
  };
}

/**
 * Truy vấn thông tin kỹ thuật trực tuyến (Open-Web Spec Search) cho bất kỳ sản phẩm nào
 * dựa trên chữ OCR đọc được từ ảnh (brand, model, visibleText).
 */
export async function fetchOpenWebProductSnippets(params: {
  brand?: string;
  model?: string;
  visibleText?: string[];
  fileName?: string;
}): Promise<string[]> {
  const queryParts = [
    params.brand && !params.brand.includes('Chưa xác định') ? params.brand : '',
    params.model && !params.model.includes('Chưa xác định') ? params.model : '',
    ...(params.visibleText || []).slice(0, 4),
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!queryParts || queryParts.length < 3) return [];

  const snippets: string[] = [];

  // 1. Gọi endpoint tìm kiếm trực tuyến của Backend / Cloudflare Worker (/api/open-web/search-product-specs)
  try {
    const res = await fetch('/api/open-web/search-product-specs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `${queryParts} water treatment specification`,
        visibleText: params.visibleText || [],
      }),
    });
    if (res.ok) {
      const data = (await res.json()) as { snippets?: string[] };
      if (Array.isArray(data.snippets)) {
        for (const s of data.snippets) {
          if (s && typeof s === 'string') snippets.push(s.trim());
        }
      }
    }
  } catch {
    // Ignore backend search error and continue with client CORS search
  }

  // 2. Dự phòng tìm kiếm trực tiếp qua Wikipedia / Wikidata Open API (CORS origin=*) ngay trên trình duyệt
  if (snippets.length === 0) {
    try {
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        `${queryParts} water filtration`,
      )}&utf8=&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl);
      if (wikiRes.ok) {
        const wikiData = (await wikiRes.json()) as {
          query?: { search?: Array<{ title?: string; snippet?: string }> };
        };
        for (const item of wikiData.query?.search?.slice(0, 3) || []) {
          const clean = `${item.title || ''}: ${(item.snippet || '').replace(/<[^>]+>/g, ' ')}`
            .replace(/\s+/g, ' ')
            .trim();
          if (clean) snippets.push(clean);
        }
      }
    } catch {
      // Ignore CORS search error
    }
  }

  return snippets;
}

/**
 * Nhận diện cục bộ & trực tuyến linh hoạt dựa trên phân tích từ khóa chuyên ngành + OCR + Web Snippets
 * Hoạt động tổng quát cho BẤT KỲ sản phẩm nào người dùng tải lên.
 */
export function parseWaterTreatmentTokensLocally(params: {
  fileName: string;
  visibleText?: string[];
  webSnippets?: string[];
  manualBrand?: string;
  manualModel?: string;
}): ProductRecognitionRecord {
  const rawTokens = [
    params.fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
    ...(params.visibleText || []),
    ...(params.webSnippets || []),
    params.manualBrand || '',
    params.manualModel || '',
  ].join(' ');

  // 1. Thử đối chiếu với danh mục chuẩn VUTECH nếu trùng khớp
  const catalogMatch = matchInternalVutechCatalog({
    brand: params.manualBrand,
    model: params.manualModel,
    visibleText: [rawTokens],
    fileName: params.fileName,
  });

  if (catalogMatch) {
    return buildRecognitionRecordFromCatalog(catalogMatch, params.visibleText || []);
  }

  // 2. Sử dụng Bộ Trích Xuất Tổng Quát (Universal Product Identity & Specs Extractor) cho bất kỳ sản phẩm nào
  const extracted = extractUniversalProductIdentityAndSpecs({
    visibleText: params.visibleText || [],
    webSnippets: params.webSnippets || [],
    fileName: params.fileName,
    manualBrand: params.manualBrand,
    manualModel: params.manualModel,
  });

  const hasBrand = Boolean(extracted.brand);
  const hasModel = Boolean(extracted.normalizedModel);
  const hasCategory = extracted.categoryId !== 'unclassified';
  const hasSpecs = extracted.specs.length > 0;

  const distinguishingSpec = extracted.specs[0]
    ? `${extracted.specs[0].value}${extracted.specs[0].unit ? ` ${extracted.specs[0].unit}` : ''}`
    : extracted.packaging || '';

  const { standardName, shortName } =
    hasBrand || hasModel || hasCategory
      ? buildNormalizedProductName({
          categoryId: extracted.categoryId,
          subCategory: extracted.subCategory,
          brand: extracted.brand,
          model: extracted.normalizedModel,
          rawModel: extracted.rawModel,
          visibleText: params.visibleText || [],
          distinguishingSpec:
            extracted.categoryId === '01_ro_membrane' && distinguishingSpec.includes('GPD')
              ? `(${distinguishingSpec})`
              : undefined,
        })
      : {
          standardName: 'Cần bổ sung thông tin sản phẩm',
          shortName: 'Cần bổ sung thông tin',
        };

  const keySpecText = extracted.specs[0]
    ? formatSpecForCanvas(extracted.specs[0])
    : extracted.packaging;

  const channelNames = generateMultiChannelProductNames({
    standardName,
    shortName,
    brand: extracted.brand || 'Chưa xác định thương hiệu',
    model: extracted.normalizedModel || 'Chưa xác định model',
    category: extracted.categoryName,
    packaging: extracted.packaging,
    keySpecText,
  });

  const confidence =
    hasBrand && hasModel && (hasCategory || hasSpecs)
      ? 0.91
      : hasBrand && hasModel
        ? 0.86
        : hasBrand || hasModel || hasCategory
          ? 0.74
          : 0.35;

  const missingFields: string[] = [];
  if (!hasBrand) missingFields.push('brand');
  if (!hasModel) missingFields.push('model');
  if (!hasCategory) missingFields.push('category');
  if (!hasSpecs) missingFields.push('technicalSpecifications');

  return {
    recognitionStatus:
      hasBrand && hasModel
        ? 'SUCCESS'
        : hasBrand || hasModel || hasCategory
          ? 'PARTIAL'
          : 'MANUAL_REQUIRED',
    productName: standardName,
    shortName,
    brand: hasBrand ? extracted.brand : 'Chưa xác định thương hiệu',
    manufacturer: extracted.manufacturer || (hasBrand ? extracted.brand : 'Chưa xác định'),
    distributor: VUTECH_DISTRIBUTOR_NAME,
    model: hasModel ? extracted.normalizedModel : 'Chưa xác định model',
    rawModel: extracted.rawModel,
    sku: '',
    categoryId: extracted.categoryId,
    category: extracted.categoryName,
    subCategory: extracted.subCategory,
    material: extracted.material,
    origin: extracted.origin,
    packaging: extracted.packaging,
    applications: [],
    technicalSpecifications: extracted.specs,
    visibleText: params.visibleText || [],
    confidence,
    fieldConfidence: {
      brand: hasBrand ? 0.9 : 0.25,
      model: hasModel ? 0.9 : 0.25,
      category: hasCategory ? 0.88 : 0.35,
      productName: hasBrand && hasModel ? 0.91 : hasBrand || hasModel ? 0.76 : 0.35,
      specifications: hasSpecs ? 0.88 : 0.3,
    },
    fieldSources: {
      brand: hasBrand ? 'IMAGE_LABEL' : 'AI_INFERRED',
      model: hasModel ? 'IMAGE_LABEL' : 'AI_INFERRED',
      category: hasCategory ? 'DATASHEET' : 'AI_INFERRED',
      productName: hasBrand || hasModel ? 'IMAGE_LABEL' : 'AI_INFERRED',
      specifications: hasSpecs ? 'DATASHEET' : 'AI_INFERRED',
    },
    warnings:
      hasBrand && hasModel
        ? []
        : [
            'Một số chữ trên bao bì bị khuất hoặc mờ. Bạn có thể kiểm tra và chỉnh sửa nhanh tại bảng Nhận diện AI.',
          ],
    missingFields,
    requiresManualReview: !(hasBrand && hasModel),
    recognitionModel: 'universal-ocr-web-discovery-v2',
    recognizedAt: new Date().toISOString(),
    channelNames,
  };
}

/**
 * Tạo bản ghi ProductRecognitionRecord chuẩn từ một sản phẩm trong VUTECH_INTERNAL_CATALOG
 */
export function buildRecognitionRecordFromCatalog(
  catalogItem: VutechCatalogProduct,
  visibleText: string[] = [],
  source: FieldDataSource = 'PRODUCT_CATALOG',
): ProductRecognitionRecord {
  const specs = buildCatalogRecognitionSpecs(catalogItem, source);
  const keySpec = specs[0] ? formatSpecForCanvas(specs[0]) : catalogItem.packaging;
  const channelNames = generateMultiChannelProductNames({
    standardName: catalogItem.productName,
    shortName: catalogItem.shortName,
    brand: catalogItem.brand,
    model: catalogItem.model,
    category: catalogItem.category,
    packaging: catalogItem.packaging,
    keySpecText: keySpec,
  });

  return {
    recognitionStatus: 'SUCCESS',
    productName: catalogItem.productName,
    shortName: catalogItem.shortName,
    brand: catalogItem.brand,
    manufacturer: catalogItem.manufacturer,
    distributor: VUTECH_DISTRIBUTOR_NAME,
    model: catalogItem.model,
    rawModel: catalogItem.rawModelAliases[0] || catalogItem.model,
    sku: catalogItem.sku,
    categoryId: catalogItem.categoryId,
    category: catalogItem.category,
    subCategory: catalogItem.subCategory,
    material: catalogItem.material,
    origin: catalogItem.origin,
    packaging: catalogItem.packaging,
    applications: [...catalogItem.applications],
    technicalSpecifications: specs,
    visibleText:
      visibleText.length > 0
        ? visibleText
        : [catalogItem.brand, catalogItem.rawModelAliases[0] || catalogItem.model, catalogItem.packaging].filter(Boolean),
    confidence: 0.97,
    fieldConfidence: {
      brand: 0.98,
      model: 0.98,
      category: 0.98,
      productName: 0.97,
      specifications: 0.96,
    },
    fieldSources: {
      brand: source,
      model: source,
      category: source,
      productName: source,
      specifications: source,
    },
    warnings: [],
    missingFields: [],
    requiresManualReview: false,
    recognitionModel: 'vutech-catalog-verified',
    recognizedAt: new Date().toISOString(),
    channelNames,
  };
}

/**
 * Hậu xử lý, kiểm chứng chéo & chuẩn hóa dữ liệu thô trả về từ Gemini API (Bước 6 đến Bước 12).
 * Kết hợp Bộ Trích Xuất Tổng Quát (extractUniversalProductIdentityAndSpecs) để đảm bảo
 * BẤT KỲ sản phẩm mới nào (ngoài danh mục mẫu) đều được tự động điền đầy đủ Tên, Thương hiệu, Model và Thông số.
 */
export function normalizeAndValidateAiRecognitionResponse(
  rawApiData: Record<string, unknown>,
  fileName: string,
  extraQualityWarnings: string[] = [],
  webSnippets: string[] = [],
): {
  record: ProductRecognitionRecord;
  subjectBox?: SubjectBox;
  recommendedTemplate?: string;
} {
  const visibleText: string[] = Array.isArray(rawApiData.visibleText)
    ? rawApiData.visibleText.map((t) => String(t).trim()).filter(Boolean)
    : [];

  const rawBrand = String(rawApiData.brand || '').trim();
  const rawModelInput = String(rawApiData.rawModel || rawApiData.model || '').trim();
  const rawCategoryInput = String(rawApiData.categoryId || rawApiData.category || '').trim();
  const rawSubCategory = String(rawApiData.subCategory || '').trim();

  // Chạy bộ trích xuất tổng quát từ visibleText + webSnippets làm nguồn bổ trợ động cho mọi sản phẩm
  const dynamicExtracted = extractUniversalProductIdentityAndSpecs({
    visibleText,
    webSnippets,
    fileName,
    manualBrand:
      rawBrand && !rawBrand.toLowerCase().includes('chưa xác định') && rawBrand.toLowerCase() !== 'unknown'
        ? rawBrand
        : undefined,
    manualModel:
      rawModelInput && !rawModelInput.toLowerCase().includes('chưa xác định') && rawModelInput.toLowerCase() !== 'unknown'
        ? rawModelInput
        : undefined,
  });

  // Kiểm tra đối chiếu với Danh mục nội bộ VUTECH (nếu là sản phẩm có trong kho VUTECH)
  const catalogMatch = matchInternalVutechCatalog({
    brand: rawBrand || dynamicExtracted.brand,
    model: String(rawApiData.model || dynamicExtracted.normalizedModel),
    rawModel: rawModelInput || dynamicExtracted.rawModel,
    visibleText,
    fileName,
  });

  // Xác định CategoryId chuẩn trong 10 nhóm ngành nước
  let categoryId: WaterTreatmentCategoryId = 'unclassified';
  let categoryName = 'Chưa xác định nhóm sản phẩm';
  let subCategory = rawSubCategory || dynamicExtracted.subCategory || 'Thiết bị & Vật tư xử lý nước';

  if (catalogMatch) {
    categoryId = catalogMatch.categoryId;
    categoryName = catalogMatch.category;
    subCategory = catalogMatch.subCategory;
  } else {
    const matchedCatById = WATER_TREATMENT_CATEGORIES.find(
      (c) =>
        c.id === rawCategoryInput ||
        c.name.toLowerCase() === rawCategoryInput.toLowerCase(),
    );
    if (matchedCatById) {
      categoryId = matchedCatById.id;
      categoryName = matchedCatById.name;
      if (!rawSubCategory) subCategory = matchedCatById.subCategories[0];
    } else if (dynamicExtracted.categoryId !== 'unclassified') {
      categoryId = dynamicExtracted.categoryId;
      categoryName = dynamicExtracted.categoryName;
      if (!rawSubCategory) subCategory = dynamicExtracted.subCategory;
    } else if (rawCategoryInput && !rawCategoryInput.toLowerCase().includes('chưa xác định') && rawCategoryInput !== 'unclassified') {
      // Nếu sản phẩm thuộc phân nhóm mở rộng do AI phát hiện trên mạng
      categoryName = rawCategoryInput;
    }
  }

  const rawFieldConf = (rawApiData.fieldConfidence || {}) as Record<string, number>;
  let brandConfidence = Number(rawFieldConf.brand ?? rawApiData.confidence ?? 0.85);
  let modelConfidence = Number(rawFieldConf.model ?? rawApiData.confidence ?? 0.85);
  let categoryConfidence = Number(rawFieldConf.category ?? rawApiData.confidence ?? 0.85);
  let specsConfidence = Number(rawFieldConf.specifications ?? 0.85);

  // Xác thực Thương hiệu (hỗ trợ MỌI thương hiệu trên thị trường, không giới hạn trong từ điển mẫu)
  let verifiedBrand = rawBrand;
  let verifiedBrandSource: FieldDataSource = 'IMAGE_LABEL';

  if (catalogMatch) {
    verifiedBrand = catalogMatch.brand;
    brandConfidence = Math.max(brandConfidence, 0.96);
    verifiedBrandSource = visibleText.some((t) =>
      t.toUpperCase().includes(catalogMatch.brand.toUpperCase()),
    )
      ? 'IMAGE_LABEL'
      : 'PRODUCT_CATALOG';
  } else if (
    verifiedBrand &&
    !verifiedBrand.toLowerCase().includes('chưa xác định') &&
    verifiedBrand.toLowerCase() !== 'unknown' &&
    verifiedBrand.toUpperCase() !== 'VUTECH'
  ) {
    verifiedBrand = verifiedBrand.toUpperCase();
    brandConfidence = Math.max(brandConfidence, 0.85);
    verifiedBrandSource = 'IMAGE_LABEL';
  } else if (dynamicExtracted.brand) {
    verifiedBrand = dynamicExtracted.brand.toUpperCase();
    brandConfidence = 0.88;
    verifiedBrandSource = 'IMAGE_LABEL';
  } else {
    verifiedBrand = 'Chưa xác định thương hiệu';
    brandConfidence = Math.min(brandConfidence, 0.45);
    verifiedBrandSource = 'AI_INFERRED';
  }

  // Xác thực & Chuẩn hóa Model cho MỌI sản phẩm (Tuyệt đối cấm sinh VT-01, VT-02...)
  let verifiedRawModel = rawModelInput || dynamicExtracted.rawModel;
  let verifiedModel = normalizeProductModelCode(
    String(rawApiData.model || rawModelInput || dynamicExtracted.normalizedModel),
  );
  let verifiedModelSource: FieldDataSource = 'IMAGE_LABEL';

  if (catalogMatch) {
    verifiedModel = catalogMatch.model;
    if (!verifiedRawModel) {
      verifiedRawModel = catalogMatch.rawModelAliases[0] || catalogMatch.model;
    }
    modelConfidence = Math.max(modelConfidence, 0.96);
    verifiedModelSource = visibleText.length > 0 ? 'IMAGE_LABEL' : 'PRODUCT_CATALOG';
  } else if (
    verifiedModel &&
    !verifiedModel.toLowerCase().includes('chưa xác định') &&
    verifiedModel.toLowerCase() !== 'unknown' &&
    !/^VT-0[1-9]$/i.test(verifiedModel)
  ) {
    modelConfidence = Math.max(modelConfidence, 0.85);
    verifiedModelSource = 'IMAGE_LABEL';
  } else if (dynamicExtracted.normalizedModel) {
    verifiedModel = dynamicExtracted.normalizedModel;
    verifiedRawModel = dynamicExtracted.rawModel;
    modelConfidence = 0.88;
    verifiedModelSource = 'IMAGE_LABEL';
  } else {
    verifiedModel = 'Chưa xác định model';
    verifiedRawModel = '';
    modelConfidence = Math.min(modelConfidence, 0.45);
    verifiedModelSource = 'AI_INFERRED';
  }

  // Trích xuất và lọc Thông số kỹ thuật hợp lệ (kết hợp AI + Google Search + Bộ Trích Xuất Tổng Quát)
  const rawSpecsArray = Array.isArray(rawApiData.technicalSpecifications)
    ? rawApiData.technicalSpecifications
    : [];

  let parsedSpecs: TechnicalSpecItem[] = rawSpecsArray
    .map((item: unknown) => {
      const obj = (item || {}) as Record<string, unknown>;
      const conf = Number(obj.confidence ?? 0.86);
      const srcRaw = String(obj.source || 'DATASHEET').toUpperCase();
      const source: FieldDataSource =
        srcRaw === 'PRODUCT_CATALOG' ||
        srcRaw === 'DATASHEET' ||
        srcRaw === 'USER_CONFIRMED' ||
        srcRaw === 'IMAGE_LABEL'
          ? (srcRaw as FieldDataSource)
          : 'DATASHEET';

      return {
        name: String(obj.name || '').trim(),
        value: String(obj.value || '').trim(),
        unit: obj.unit ? String(obj.unit).trim() : undefined,
        source,
        confidence: Math.max(conf, 0.82),
        verified: true,
      };
    })
    .filter((s) => s.name && s.value);

  // Bổ sung thông số thực tế trích xuất từ OCR & Web Snippets cho bất kỳ sản phẩm nào
  for (const dSpec of dynamicExtracted.specs) {
    const exists = parsedSpecs.some(
      (ps) => ps.name.toLowerCase() === dSpec.name.toLowerCase(),
    );
    if (!exists) {
      parsedSpecs.push(dSpec);
    }
  }

  // Loại bỏ thông số không phù hợp với chủng loại
  parsedSpecs = filterValidSpecsForCategory(categoryId, parsedSpecs);

  // Nếu khớp sản phẩm trong danh mục VUTECH, bổ sung thông số chuẩn nếu thiếu
  if (catalogMatch) {
    const catalogSpecs = buildCatalogRecognitionSpecs(catalogMatch, 'PRODUCT_CATALOG');
    for (const cSpec of catalogSpecs) {
      const exists = parsedSpecs.some(
        (ps) => ps.name.toLowerCase() === cSpec.name.toLowerCase(),
      );
      if (!exists) {
        parsedSpecs.push(cSpec);
      }
    }
    specsConfidence = Math.max(specsConfidence, 0.95);
  }

  const verifiedSpecsOnly = parsedSpecs.filter((s) => s.verified && s.confidence >= 0.7);
  const packaging =
    String(rawApiData.packaging || '').trim() ||
    dynamicExtracted.packaging ||
    catalogMatch?.packaging ||
    '';

  // Chuẩn hóa tên sản phẩm theo công thức Mục VI (hoặc sử dụng tên chuẩn AI tìm được trên mạng nếu sản phẩm thuộc nhóm mới)
  let standardName = '';
  let shortName = '';
  let productNameConfidence = Number(rawFieldConf.productName ?? 0.88);
  let productNameSource: FieldDataSource = 'IMAGE_LABEL';

  if (catalogMatch) {
    standardName = catalogMatch.productName;
    shortName = catalogMatch.shortName;
    productNameConfidence = 0.97;
    productNameSource = 'PRODUCT_CATALOG';
  } else {
    const hasValidBrand = verifiedBrand !== 'Chưa xác định thương hiệu';
    const hasValidModel = verifiedModel !== 'Chưa xác định model';
    const hasValidCategory = categoryId !== 'unclassified';
    const rawAiName = String(rawApiData.productName || '').trim();

    if (hasValidBrand || hasValidModel || hasValidCategory) {
      const built = buildNormalizedProductName({
        categoryId,
        subCategory,
        brand: hasValidBrand ? verifiedBrand : '',
        model: hasValidModel ? verifiedModel : '',
        rawModel: verifiedRawModel,
        visibleText,
        existingName: rawAiName,
      });
      // Nếu sản phẩm chưa thuộc 10 nhóm cố định nhưng AI đã nhận diện được tên loại sản phẩm cụ thể
      if (
        categoryId === 'unclassified' &&
        rawAiName &&
        !rawAiName.toLowerCase().includes('cần bổ sung') &&
        !rawAiName.toLowerCase().includes('thiết bị lọc nước vutech')
      ) {
        standardName = rawAiName;
        shortName = rawAiName.length > 44 ? rawAiName.slice(0, 44).trim() : rawAiName;
      } else {
        standardName = built.standardName;
        shortName = built.shortName;
      }
      productNameConfidence =
        hasValidBrand && hasValidModel
          ? Math.max(0.92, (brandConfidence + modelConfidence) / 2)
          : 0.8;
    } else if (
      rawAiName &&
      !rawAiName.toLowerCase().includes('cần bổ sung') &&
      !rawAiName.toLowerCase().includes('thiết bị lọc nước vutech')
    ) {
      standardName = rawAiName;
      shortName = rawAiName.length > 44 ? rawAiName.slice(0, 44).trim() : rawAiName;
      productNameConfidence = 0.78;
    } else {
      standardName = 'Cần bổ sung thông tin sản phẩm';
      shortName = 'Cần bổ sung thông tin';
      productNameConfidence = 0.4;
    }
  }

  const keySpecText = verifiedSpecsOnly[0]
    ? formatSpecForCanvas(verifiedSpecsOnly[0])
    : packaging;

  const channelNames = generateMultiChannelProductNames({
    standardName,
    shortName,
    brand: verifiedBrand,
    model: verifiedModel,
    category: categoryName,
    packaging,
    keySpecText,
  });

  const missingFields: string[] = [];
  if (verifiedBrand === 'Chưa xác định thương hiệu') missingFields.push('brand');
  if (verifiedModel === 'Chưa xác định model') missingFields.push('model');
  if (categoryId === 'unclassified' && categoryName === 'Chưa xác định nhóm sản phẩm') {
    missingFields.push('category');
  }
  if (verifiedSpecsOnly.length === 0) missingFields.push('technicalSpecifications');

  const apiWarnings = Array.isArray(rawApiData.warnings)
    ? rawApiData.warnings.map((w) => String(w).trim()).filter(Boolean)
    : [];
  const warnings = [...extraQualityWarnings, ...apiWarnings];

  const overallConfidence = Number(
    (
      brandConfidence * 0.25 +
      modelConfidence * 0.25 +
      categoryConfidence * 0.2 +
      productNameConfidence * 0.15 +
      (verifiedSpecsOnly.length > 0 ? specsConfidence : 0.45) * 0.15
    ).toFixed(2),
  );

  const requiresManualReview =
    overallConfidence < 0.85 ||
    missingFields.includes('brand') ||
    missingFields.includes('model');

  const recognitionStatus: RecognitionStatus =
    !missingFields.includes('brand') && !missingFields.includes('model')
      ? 'SUCCESS'
      : overallConfidence >= 0.65 || standardName !== 'Cần bổ sung thông tin sản phẩm'
        ? 'PARTIAL'
        : 'MANUAL_REQUIRED';

  const record: ProductRecognitionRecord = {
    recognitionStatus,
    productName: standardName,
    shortName,
    brand: verifiedBrand,
    manufacturer:
      String(rawApiData.manufacturer || '').trim() ||
      dynamicExtracted.manufacturer ||
      catalogMatch?.manufacturer ||
      (verifiedBrand !== 'Chưa xác định thương hiệu' ? verifiedBrand : 'Chưa xác định'),
    distributor: VUTECH_DISTRIBUTOR_NAME,
    model: verifiedModel,
    rawModel: verifiedRawModel,
    sku: String(rawApiData.sku || '').trim() || catalogMatch?.sku || '',
    categoryId,
    category: categoryName,
    subCategory,
    material:
      String(rawApiData.material || '').trim() ||
      dynamicExtracted.material ||
      catalogMatch?.material ||
      '',
    origin:
      String(rawApiData.origin || '').trim() ||
      dynamicExtracted.origin ||
      catalogMatch?.origin ||
      '',
    packaging,
    applications:
      Array.isArray(rawApiData.applications) && rawApiData.applications.length > 0
        ? rawApiData.applications.map((a) => String(a).trim()).filter(Boolean)
        : catalogMatch?.applications || [],
    technicalSpecifications: parsedSpecs,
    visibleText,
    confidence: overallConfidence,
    fieldConfidence: {
      brand: Number(brandConfidence.toFixed(2)),
      model: Number(modelConfidence.toFixed(2)),
      category: Number(categoryConfidence.toFixed(2)),
      productName: Number(productNameConfidence.toFixed(2)),
      specifications: Number((verifiedSpecsOnly.length > 0 ? specsConfidence : 0.35).toFixed(2)),
    },
    fieldSources: {
      brand: verifiedBrandSource,
      model: verifiedModelSource,
      category: catalogMatch ? 'PRODUCT_CATALOG' : 'DATASHEET',
      productName: productNameSource,
      specifications: catalogMatch
        ? 'PRODUCT_CATALOG'
        : verifiedSpecsOnly.length > 0
          ? 'DATASHEET'
          : 'AI_INFERRED',
    },
    warnings,
    missingFields,
    requiresManualReview,
    recognitionModel: String(rawApiData.recognitionModel || 'gemini-4-hydrogen'),
    recognizedAt: String(rawApiData.recognizedAt || new Date().toISOString()),
    channelNames,
  };

  let subjectBox: SubjectBox | undefined;
  if (rawApiData.subjectBox && typeof rawApiData.subjectBox === 'object') {
    const sb = rawApiData.subjectBox as Record<string, number>;
    if (typeof sb.x === 'number' && typeof sb.y === 'number') {
      subjectBox = {
        x: Math.min(0.85, Math.max(0, sb.x)),
        y: Math.min(0.85, Math.max(0, sb.y)),
        w: Math.min(1, Math.max(0.15, sb.w || 0.76)),
        h: Math.min(1, Math.max(0.15, sb.h || 0.76)),
      };
    }
  }

  return {
    record,
    subjectBox,
    recommendedTemplate: rawApiData.recommendedTemplate
      ? String(rawApiData.recommendedTemplate)
      : undefined,
  };
}

/**
 * Ánh xạ từ ProductRecognitionRecord sang các trường hiển thị của StudioConfig
 * đồng thời TÔN TRỌNG các trường đã bị người dùng khóa (lockedFields).
 * Tuyệt đối không chèn thông số giả nếu sản phẩm có ít hơn 3 thông số đã xác thực.
 */
export function applyRecognitionRecordToStudioConfig(
  currentConfig: StudioConfig,
  record: ProductRecognitionRecord,
  options?: {
    respectLocks?: boolean;
    subjectBox?: SubjectBox;
  },
): StudioConfig {
  const respectLocks = options?.respectLocks ?? true;
  const locks = respectLocks ? currentConfig.lockedFields || {} : {};

  // Chỉ lấy các thông số ĐÃ XÁC THỰC (verified && confidence >= 0.7) để đưa lên ảnh thiết kế
  const verifiedSpecs = filterValidSpecsForCategory(
    record.categoryId,
    record.technicalSpecifications,
  ).filter((s) => s.verified && s.confidence >= 0.7);

  const formattedSpecs: [string, string, string] = [
    verifiedSpecs[0] ? formatSpecForCanvas(verifiedSpecs[0]) : '',
    verifiedSpecs[1] ? formatSpecForCanvas(verifiedSpecs[1]) : '',
    verifiedSpecs[2] ? formatSpecForCanvas(verifiedSpecs[2]) : '',
  ];

  const cleanModelForCanvas =
    record.model &&
    record.model !== 'Chưa xác định model' &&
    !/^VT-0[1-9]$/i.test(record.model)
      ? record.model
      : '';

  const cleanBrand =
    record.brand && record.brand !== 'Chưa xác định thương hiệu' ? record.brand : '';

  const autoTagline = [
    record.subCategory && !record.subCategory.includes('Chưa') ? record.subCategory : record.category,
    record.packaging ? `Quy cách: ${record.packaging}` : '',
    record.applications[0] || '',
  ]
    .filter(Boolean)
    .join(' • ');

  const autoPriceBadge = cleanBrand
    ? `Thương hiệu ${cleanBrand}`
    : '';

  const autoFacebookCaption = [
    `💧 ${record.channelNames.facebookAdTitle}`,
    cleanBrand ? `✔️ Thương hiệu: ${cleanBrand}${cleanModelForCanvas ? ` | Model: ${cleanModelForCanvas}` : ''}` : '',
    record.packaging ? `✔️ Quy cách: ${record.packaging}` : '',
    ...verifiedSpecs.slice(0, 3).map((s) => `🔹 ${formatSpecForCanvas(s)}`),
    `📞 Liên hệ ${VUTECH_DISTRIBUTOR_NAME} – Hotline: ${currentConfig.hotline} để nhận báo giá & COA/CQ kỹ thuật!`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    ...currentConfig,
    productName: locks.productName ? currentConfig.productName : record.productName,
    modelCode: locks.modelCode ? currentConfig.modelCode : cleanModelForCanvas,
    category: locks.category ? currentConfig.category : record.category.toUpperCase(),
    tagline: locks.tagline ? currentConfig.tagline : autoTagline || currentConfig.tagline,
    specs: locks.specs ? currentConfig.specs : formattedSpecs,
    priceBadge: locks.priceBadge ? currentConfig.priceBadge : autoPriceBadge,
    showPriceBadge: locks.priceBadge
      ? currentConfig.showPriceBadge
      : Boolean(autoPriceBadge),
    showSpecsPanel: verifiedSpecs.length > 0,
    facebookCaption: locks.facebookCaption ? currentConfig.facebookCaption : autoFacebookCaption,
    subjectBox: options?.subjectBox || currentConfig.subjectBox,
    recognitionRecord: record,
    channelNames: record.channelNames,
  };
}

const CLOUDFLARE_DIRECT_KEY_STORAGE = 'vutech_cf_worker_gemini_key_v1';

export function getSavedCloudflareFallbackKey(): string {
  try {
    return (localStorage.getItem(CLOUDFLARE_DIRECT_KEY_STORAGE) || '').trim();
  } catch {
    return '';
  }
}

export function setSavedCloudflareFallbackKey(key: string): void {
  try {
    const clean = key.trim();
    if (clean) {
      localStorage.setItem(CLOUDFLARE_DIRECT_KEY_STORAGE, clean);
    } else {
      localStorage.removeItem(CLOUDFLARE_DIRECT_KEY_STORAGE);
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Tạo ảnh xoay góc (0°, 90°, 270°) để OCR đọc được cả chữ in ngang trên bao hạt nhựa
 * lẫn chữ in dọc trên thân màng lọc RO (như FROTEC RO-3013-400).
 */
async function createRotatedDataUrlForOcr(
  sourceImageUrl: string,
  angleDeg: 0 | 90 | 270,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const natW = img.naturalWidth || img.width || 800;
      const natH = img.naturalHeight || img.height || 800;
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(natW, natH));
      const w = Math.max(1, Math.round(natW * scale));
      const h = Math.max(1, Math.round(natH * scale));

      const canvas = document.createElement('canvas');
      if (angleDeg === 90 || angleDeg === 270) {
        canvas.width = h;
        canvas.height = w;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No 2d context'));
        return;
      }

      ctx.filter = 'contrast(1.35) grayscale(1)';
      ctx.save();
      if (angleDeg === 90) {
        ctx.translate(h, 0);
        ctx.rotate(Math.PI / 2);
      } else if (angleDeg === 270) {
        ctx.translate(0, w);
        ctx.rotate(-Math.PI / 2);
      }
      ctx.drawImage(img, 0, 0, w, h);
      ctx.restore();

      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => reject(new Error('Image load failed'));
    img.src = sourceImageUrl;
  });
}

/**
 * BỘ QUÉT OCR TRỰC TIẾP TRÊN TRÌNH DUYỆT (CLIENT-SIDE VISION OCR ENGINE)
 * Hoạt động tự động 100% cho BẤT KỲ sản phẩm nào ngay cả khi Cloudflare Workers chưa cấu hình GEMINI_API_KEY.
 * Hỗ trợ đọc chữ in ngang (0°) và chữ in xoay dọc (270°, 90°) trên mọi bao bì, thân bồn, vỏ màng, tem nhãn thiết bị.
 */
export async function extractVisibleTextWithBrowserOcr(
  sourceImageUrl: string,
): Promise<string[]> {
  try {
    const Tesseract = await import('tesseract.js');
    const recognizeFn = Tesseract.recognize || Tesseract.default?.recognize;
    if (!recognizeFn) return [];

    const extractedLines: string[] = [];

    // 1. Quét góc 0° (chữ ngang chuẩn trên bao bì, tem nhãn,銘판 thiết bị...)
    const img0 = await createRotatedDataUrlForOcr(sourceImageUrl, 0);
    const res0 = await recognizeFn(img0, 'eng');
    const text0 = res0?.data?.text || '';
    for (const line of text0.split(/\r?\n/)) {
      const cleaned = line.replace(/[^a-zA-Z0-9()×*.,/+-:\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (cleaned.length >= 3) extractedLines.push(cleaned);
    }

    // Kiểm tra xem ở góc 0° đã bắt được cả Thương hiệu & Mã Model (bất kỳ sản phẩm nào) chưa
    const initialExtract = extractUniversalProductIdentityAndSpecs({
      visibleText: extractedLines,
    });
    const hasCompleteIdentityAt0 =
      Boolean(initialExtract.brand && initialExtract.normalizedModel) ||
      Boolean(matchInternalVutechCatalog({ visibleText: extractedLines }));

    // 2. Nếu chưa đủ Thương hiệu + Model (ví dụ tem dán dọc trên thân màng lọc, lõi lọc, bơm trục đứng),
    // tự động quét thêm góc xoay 270° và 90°
    if (!hasCompleteIdentityAt0) {
      for (const angle of [270, 90] as const) {
        const rotatedImg = await createRotatedDataUrlForOcr(sourceImageUrl, angle);
        const resRot = await recognizeFn(rotatedImg, 'eng');
        const textRot = resRot?.data?.text || '';
        for (const line of textRot.split(/\r?\n/)) {
          const cleaned = line
            .replace(/[^a-zA-Z0-9()×*.,/+-:\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (cleaned.length >= 3) extractedLines.push(cleaned);
        }
        const rotExtract = extractUniversalProductIdentityAndSpecs({
          visibleText: extractedLines,
        });
        if (
          (rotExtract.brand && rotExtract.normalizedModel) ||
          matchInternalVutechCatalog({ visibleText: extractedLines })
        ) {
          break;
        }
      }
    }

    return Array.from(new Set(extractedLines)).slice(0, 30);
  } catch {
    return [];
  }
}

/**
 * Gọi trực tiếp Google Gemini REST API từ trình duyệt với Google Search Grounding chủ động
 * để tra cứu thông tin trực tuyến cho BẤT KỲ sản phẩm nào được tải lên.
 */
async function callDirectBrowserGeminiFallback(params: {
  apiKey: string;
  preparedImages: Array<{ mimeType: string; base64Data: string }>;
  fileNames: string[];
}): Promise<Record<string, unknown> | null> {
  const cleanKey = params.apiKey.trim();
  if (!cleanKey) return null;

  const parts: Array<Record<string, unknown>> = params.preparedImages.map((img) => ({
    inlineData: {
      mimeType: img.mimeType,
      data: img.base64Data,
    },
  }));

  parts.push({
    text: `Bạn là Hệ thống Smart Product Recognition Engine 2.0 của CÔNG TY TNHH XNK VUTECH.
NHIỆM VỤ QUAN TRỌNG:
1. Đọc toàn bộ chữ, ký hiệu, mã số, thông số in trên tem nhãn/bao bì sản phẩm trong ảnh (bất kể chữ in ngang hay xoay dọc) vào mảng visibleText.
2. Nhận diện chính xác Thương hiệu (brand) và Mã Model (rawModel & model) của BẤT KỲ sản phẩm nào trong ảnh.
3. Chủ động tìm kiếm trên mạng (Google Search) theo Thương hiệu + Mã Model vừa đọc được để lấy đúng loại sản phẩm, công dụng và tối thiểu 3 thông số kỹ thuật chuẩn xác của nhà sản xuất (technicalSpecifications: [{name, value, unit, source: "DATASHEET", confidence: 0.92, verified: true}]).
4. Đặt tên chuẩn tiếng Việt (productName) theo công thức: [Loại sản phẩm] + [Thương hiệu] + [Model] + [Thông số chính nếu có].
Trả về DUY NHẤT 1 đối tượng JSON hợp lệ gồm: productName, shortName, brand, manufacturer, model, rawModel, sku, categoryId, category, subCategory, material, origin, packaging, applications, visibleText, technicalSpecifications, confidence, fieldConfidence ({brand, model, category, productName, specifications}), warnings, subjectBox ({x, y, w, h} từ 0..1).`,
  });

  for (const modelName of ['gemini-2.5-flash', 'gemini-2.0-flash']) {
    // Thử lần 1: Bật Google Search Grounding để AI tự tra cứu thông số sản phẩm trên mạng
    // Thử lần 2: JSON thuần nếu API key không hỗ trợ grounding tool
    for (const useSearchGrounding of [true, false]) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${encodeURIComponent(cleanKey)}`;
        const bodyPayload: Record<string, unknown> = {
          contents: [{ role: 'user', parts }],
          generationConfig: useSearchGrounding
            ? { temperature: 0.1 }
            : { responseMimeType: 'application/json', temperature: 0.1 },
        };
        if (useSearchGrounding) {
          bodyPayload.tools = [{ googleSearch: {} }];
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });
        if (!res.ok) continue;
        const data = (await res.json()) as Record<string, unknown>;
        const candidates = (data.candidates as Array<Record<string, unknown>>) || [];
        const content = (candidates[0]?.content as Record<string, unknown>) || {};
        const resParts = (content.parts as Array<Record<string, unknown>>) || [];
        let rawText = '';
        for (const p of resParts) {
          if (typeof p.text === 'string') rawText += p.text;
        }
        const firstBrace = rawText.indexOf('{');
        const lastBrace = rawText.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
          const parsed = JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
          parsed.recognitionModel = `${modelName}${useSearchGrounding ? ' + Google Search' : ''}`;
          return parsed;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

/**
 * Quy trình tự động kết hợp Quét OCR Đa Góc + Tìm Kiếm Thông Số Trực Tuyến (Open-Web Spec Discovery)
 * cho BẤT KỲ bức ảnh sản phẩm nào được tải lên.
 */
async function runUniversalOcrAndOpenWebDiscovery(params: {
  primaryUrl: string;
  fileNames: string[];
}): Promise<ProductRecognitionRecord> {
  const joinedFileName = params.fileNames.join(' ');
  const ocrVisibleLines = await extractVisibleTextWithBrowserOcr(params.primaryUrl);

  // Phân tích sơ bộ từ OCR để lấy Brand / Model làm từ khóa tìm kiếm trên mạng
  const initialIdentity = extractUniversalProductIdentityAndSpecs({
    visibleText: ocrVisibleLines,
    fileName: joinedFileName,
  });

  // Chủ động tìm kiếm thông tin & datasheet của sản phẩm trên mạng dựa trên chữ OCR vừa đọc được
  const webSnippets = await fetchOpenWebProductSnippets({
    brand: initialIdentity.brand,
    model: initialIdentity.normalizedModel || initialIdentity.rawModel,
    visibleText: ocrVisibleLines,
    fileName: joinedFileName,
  });

  // Tổng hợp dữ liệu OCR + Dữ liệu tìm kiếm trên mạng để điền đầy đủ thông tin sản phẩm
  return parseWaterTreatmentTokensLocally({
    fileName: joinedFileName,
    visibleText: ocrVisibleLines,
    webSnippets,
    manualBrand: initialIdentity.brand || undefined,
    manualModel: initialIdentity.rawModel || undefined,
  });
}

/**
 * Gọi API Smart Product Recognition Engine 2.0 với cơ chế chủ động & linh hoạt cho MỌI sản phẩm:
 * - Tầng 1: Kiểm tra Cache theo mã hash ảnh.
 * - Tầng 2: Gọi Backend `/api/gemini/recognize-product-v2` (đã tích hợp Google Search Grounding chủ động).
 *   Nếu sản phẩm mới trên mạng thiếu thông số trên bao bì, tự động truy vấn bổ sung qua Open-Web Spec Search.
 * - Tầng 3: Nếu Cloudflare Worker trả về lỗi 401/404/503, tự động chạy Gemini Direct + Google Search (nếu có key)
 *   HOẶC tự động chạy `runUniversalOcrAndOpenWebDiscovery` (Quét OCR Đa Góc + Tra cứu thông số trực tuyến)
 *   để nhận diện và tự động điền thông tin cho BẤT KỲ sản phẩm nào!
 */
export async function runSmartProductRecognitionPipeline(params: {
  sourceImageUrls: string[];
  fileNames: string[];
  recognitionModel?: RecognitionModelOption;
  mode?: 'full-recognition' | 'ocr-only';
  bypassCache?: boolean;
}): Promise<{
  record: ProductRecognitionRecord;
  subjectBox?: SubjectBox;
  recommendedTemplate?: string;
  fromCache: boolean;
}> {
  const primaryUrl = params.sourceImageUrls[0];
  const primaryFileName = params.fileNames[0] || 'product.jpg';
  const isSingleImage = params.sourceImageUrls.length === 1;
  const imageHash = computeImageContentHash(primaryUrl, primaryFileName);

  // Kiểm tra cache nếu nhận diện 1 ảnh và không yêu cầu bypassCache
  if (isSingleImage && !params.bypassCache && params.mode !== 'ocr-only') {
    const cached = getCachedRecognitionByHash(imageHash);
    if (cached && cached.recognitionStatus === 'SUCCESS') {
      return {
        record: cached,
        fromCache: true,
      };
    }
  }

  // Bước 1 & 2: Tạo bản sao ảnh tăng tương phản từ các ảnh gốc
  const preparedImages: Array<{ mimeType: string; base64Data: string }> = [];
  const allQualityWarnings: string[] = [];

  for (const url of params.sourceImageUrls.slice(0, 5)) {
    const enhanced = await createEnhancedRecognitionImageCopy(url);
    preparedImages.push({
      mimeType: enhanced.mimeType,
      base64Data: enhanced.base64Data,
    });
    for (const w of enhanced.qualityWarnings) {
      if (!allQualityWarnings.includes(w)) allQualityWarnings.push(w);
    }
  }

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const response = await fetch('/api/gemini/recognize-product-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: preparedImages,
          fileNames: params.fileNames,
          recognitionModel: params.recognitionModel || 'gemini-4-hydrogen',
          mode: params.mode || 'full-recognition',
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

      if (!response.ok) {
        const apiError: ApiDiagnosticError = (payload.apiError as ApiDiagnosticError) || {
          httpStatus: response.status,
          errorCode: String(payload.errorCode || `HTTP_${response.status}`),
          title: String(payload.error || `Lỗi kết nối AI (HTTP ${response.status})`),
          detailMessage: String(
            payload.detailMessage ||
              payload.error ||
              'Không thể hoàn tất yêu cầu nhận diện AI từ máy chủ.',
          ),
          troubleshootingSteps: Array.isArray(payload.troubleshootingSteps)
            ? (payload.troubleshootingSteps as string[])
            : ['Đang kích hoạt Bộ Quét OCR Đa Góc & Tìm Kiếm Thông Số Trực Tuyến tự động.'],
          retryAfterSeconds:
            typeof payload.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : undefined,
          timestamp: new Date().toISOString(),
        };

        if (response.status === 429 && attempt < maxAttempts) {
          const waitMs = Math.min(4000, (apiError.retryAfterSeconds || 2) * 1000);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        // TẦNG DỰ PHÒNG 1: Nếu người dùng đã nhập Gemini API Key trực tiếp trên trình duyệt cho Cloudflare
        const directKey = getSavedCloudflareFallbackKey();
        if (directKey) {
          const directPayload = await callDirectBrowserGeminiFallback({
            apiKey: directKey,
            preparedImages,
            fileNames: params.fileNames,
          });
          if (directPayload) {
            const directVisible = Array.isArray(directPayload.visibleText)
              ? directPayload.visibleText.map((t) => String(t))
              : [];
            const webSnippets = await fetchOpenWebProductSnippets({
              brand: String(directPayload.brand || ''),
              model: String(directPayload.model || directPayload.rawModel || ''),
              visibleText: directVisible,
              fileName: primaryFileName,
            });
            const { record, subjectBox, recommendedTemplate } =
              normalizeAndValidateAiRecognitionResponse(
                directPayload,
                primaryFileName,
                allQualityWarnings,
                webSnippets,
              );
            record.imageHash = imageHash;
            if (isSingleImage) setCachedRecognitionByHash(imageHash, record);
            return { record, subjectBox, recommendedTemplate, fromCache: false };
          }
        }

        // TẦNG DỰ PHÒNG 2: Kiểm tra Cache theo Hash ảnh
        const cachedFallback = getCachedRecognitionByHash(imageHash);
        if (cachedFallback && cachedFallback.recognitionStatus === 'SUCCESS') {
          return {
            record: cachedFallback,
            fromCache: true,
          };
        }

        // TẦNG DỰ PHÒNG 3 (CHỦ ĐỘNG CHO MỌI SẢN PHẨM):
        // Quét OCR đa góc trên ảnh + Tự động tìm kiếm thông số sản phẩm trên mạng!
        const universalOcrRecord = await runUniversalOcrAndOpenWebDiscovery({
          primaryUrl,
          fileNames: params.fileNames,
        });

        if (
          universalOcrRecord.recognitionStatus === 'SUCCESS' ||
          universalOcrRecord.recognitionStatus === 'PARTIAL'
        ) {
          universalOcrRecord.apiError = null;
          universalOcrRecord.imageHash = imageHash;
          if (isSingleImage && universalOcrRecord.recognitionStatus === 'SUCCESS') {
            setCachedRecognitionByHash(imageHash, universalOcrRecord);
          }
          return {
            record: universalOcrRecord,
            fromCache: false,
          };
        }

        universalOcrRecord.apiError = apiError;
        universalOcrRecord.recognitionStatus = 'ERROR';
        return {
          record: universalOcrRecord,
          fromCache: false,
        };
      }

      // Khi Backend Gemini API trả về thành công:
      // Nếu trên bao bì sản phẩm có ít thông số kỹ thuật, chủ động gọi thêm Open-Web Search để làm giàu thông số
      const apiVisibleText = Array.isArray(payload.visibleText)
        ? payload.visibleText.map((t) => String(t))
        : [];
      const apiSpecs = Array.isArray(payload.technicalSpecifications)
        ? payload.technicalSpecifications
        : [];
      let extraWebSnippets: string[] = [];
      if (apiSpecs.length < 2) {
        extraWebSnippets = await fetchOpenWebProductSnippets({
          brand: String(payload.brand || ''),
          model: String(payload.model || payload.rawModel || ''),
          visibleText: apiVisibleText,
          fileName: primaryFileName,
        });
      }

      const { record, subjectBox, recommendedTemplate } =
        normalizeAndValidateAiRecognitionResponse(
          payload,
          primaryFileName,
          allQualityWarnings,
          extraWebSnippets,
        );

      if (Array.isArray(payload.conflictingFields) && payload.conflictingFields.length > 0) {
        record.conflictingFields = payload.conflictingFields.map((f) => String(f));
        record.requiresManualReview = true;
      }

      record.imageHash = imageHash;
      if (isSingleImage) {
        setCachedRecognitionByHash(imageHash, record);
      }

      return {
        record,
        subjectBox,
        recommendedTemplate,
        fromCache: false,
      };
    } catch (networkErr) {
      // Khi mất kết nối máy chủ hoặc Cloudflare Pages tĩnh chưa có Worker:
      // Tự động chạy OCR đa góc + Tìm kiếm trực tuyến!
      const universalOcrRecord = await runUniversalOcrAndOpenWebDiscovery({
        primaryUrl,
        fileNames: params.fileNames,
      });

      if (
        universalOcrRecord.recognitionStatus === 'SUCCESS' ||
        universalOcrRecord.recognitionStatus === 'PARTIAL'
      ) {
        universalOcrRecord.apiError = null;
        return {
          record: universalOcrRecord,
          fromCache: false,
        };
      }

      const apiError: ApiDiagnosticError = {
        httpStatus: 503,
        errorCode: 'NETWORK_OR_TIMEOUT_ERROR',
        title: 'Lỗi kết nối mạng hoặc Timeout khi gọi dịch vụ nhận diện',
        detailMessage:
          networkErr instanceof Error
            ? networkErr.message
            : 'Không thể kết nối tới máy chủ xử lý AI.',
        troubleshootingSteps: [
          'Sử dụng nút "4. Đối chiếu danh mục" để chọn nhanh sản phẩm từ cơ sở dữ liệu VUTECH.',
          'Hoặc nhập Thương hiệu & Model để hệ thống tự động tìm kiếm và chuẩn hóa thông số.',
        ],
        timestamp: new Date().toISOString(),
      };

      universalOcrRecord.apiError = apiError;
      universalOcrRecord.recognitionStatus = 'ERROR';

      return {
        record: universalOcrRecord,
        fromCache: false,
      };
    }
  }

  const finalFallback = await runUniversalOcrAndOpenWebDiscovery({
    primaryUrl,
    fileNames: params.fileNames,
  });
  return { record: finalFallback, fromCache: false };
}

