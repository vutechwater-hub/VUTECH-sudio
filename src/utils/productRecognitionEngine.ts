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
  const tokens = [
    params.brand || '',
    params.model || '',
    params.rawModel || '',
    ...(params.visibleText || []),
    params.fileName || '',
  ]
    .join(' ')
    .toUpperCase();

  if (!tokens.trim()) return null;

  for (const item of VUTECH_INTERNAL_CATALOG) {
    const brandMatched = tokens.includes(item.brand.toUpperCase());
    const modelMatched = item.rawModelAliases.some((alias) =>
      tokens.includes(alias.toUpperCase()),
    );
    if (brandMatched && modelMatched) {
      return item;
    }
  }

  // Nếu khớp chính xác một model đặc thù (như 001X7(C100), XLPFT-8040, F63B1, KXA-200)
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
 * Nhận diện cục bộ dựa trên phân tích từ khóa chuyên ngành từ văn bản/tên file/OCR
 * (Cơ chế dự phòng tầng 2 & 3 khi API gặp lỗi hoặc hết quota)
 */
export function parseWaterTreatmentTokensLocally(params: {
  fileName: string;
  visibleText?: string[];
  manualBrand?: string;
  manualModel?: string;
}): ProductRecognitionRecord {
  const rawTokens = [
    params.fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' '),
    ...(params.visibleText || []),
    params.manualBrand || '',
    params.manualModel || '',
  ].join(' ');

  // 1. Thử đối chiếu với danh mục nội bộ VUTECH trước
  const catalogMatch = matchInternalVutechCatalog({
    brand: params.manualBrand,
    model: params.manualModel,
    visibleText: [rawTokens],
    fileName: params.fileName,
  });

  if (catalogMatch) {
    return buildRecognitionRecordFromCatalog(catalogMatch, params.visibleText || []);
  }

  const upperTokens = rawTokens.toUpperCase();

  // 2. Dò thương hiệu từ từ điển thương hiệu tham chiếu
  let detectedBrand = params.manualBrand?.trim() || '';
  let detectedManufacturer = '';
  let detectedOrigin = '';
  if (!detectedBrand) {
    for (const refBrand of WATER_TREATMENT_REFERENCE_BRANDS) {
      if (refBrand.aliases.some((alias) => upperTokens.includes(alias.toUpperCase()))) {
        detectedBrand = refBrand.brand;
        detectedManufacturer = refBrand.manufacturer;
        detectedOrigin = refBrand.defaultOrigin;
        break;
      }
    }
  }

  // 3. Dò nhóm sản phẩm & mã model theo pattern của 10 nhóm ngành nước
  let detectedCategoryId: WaterTreatmentCategoryId = 'unclassified';
  let detectedCategoryName = 'Chưa xác định nhóm sản phẩm';
  let detectedSubCategory = 'Cần kiểm tra & phân loại thủ công';
  let detectedRawModel = params.manualModel?.trim() || '';

  for (const cat of WATER_TREATMENT_CATEGORIES) {
    for (const pattern of cat.modelPatterns) {
      const m = rawTokens.match(pattern);
      if (m && m[0]) {
        if (!detectedRawModel) detectedRawModel = m[0].trim();
        detectedCategoryId = cat.id;
        detectedCategoryName = cat.name;
        detectedSubCategory = cat.subCategories[0];
        break;
      }
    }
    if (detectedCategoryId !== 'unclassified') break;

    if (cat.keywords.some((kw) => rawTokens.toLowerCase().includes(kw.toLowerCase()))) {
      detectedCategoryId = cat.id;
      detectedCategoryName = cat.name;
      detectedSubCategory = cat.subCategories[0];
    }
  }

  const normalizedModel = normalizeProductModelCode(detectedRawModel);
  const hasBrand = Boolean(detectedBrand);
  const hasModel = Boolean(normalizedModel);
  const hasCategory = detectedCategoryId !== 'unclassified';

  const { standardName, shortName } =
    hasBrand || hasModel || hasCategory
      ? buildNormalizedProductName({
          categoryId: detectedCategoryId,
          subCategory: detectedSubCategory,
          brand: detectedBrand,
          model: normalizedModel,
          rawModel: detectedRawModel,
          visibleText: params.visibleText || [],
        })
      : {
          standardName: 'Cần bổ sung thông tin sản phẩm',
          shortName: 'Cần bổ sung thông tin',
        };

  const channelNames = generateMultiChannelProductNames({
    standardName,
    shortName,
    brand: detectedBrand || 'Chưa xác định thương hiệu',
    model: normalizedModel || 'Chưa xác định model',
    category: detectedCategoryName,
  });

  const confidence =
    hasBrand && hasModel && hasCategory
      ? 0.85
      : hasBrand || hasModel
        ? 0.68
        : 0.35;

  const missingFields: string[] = [];
  if (!hasBrand) missingFields.push('brand');
  if (!hasModel) missingFields.push('model');
  if (!hasCategory) missingFields.push('category');
  missingFields.push('technicalSpecifications');

  return {
    recognitionStatus: hasBrand && hasModel ? 'PARTIAL' : 'MANUAL_REQUIRED',
    productName: standardName,
    shortName,
    brand: hasBrand ? detectedBrand : 'Chưa xác định thương hiệu',
    manufacturer: detectedManufacturer || (hasBrand ? detectedBrand : 'Chưa xác định'),
    distributor: VUTECH_DISTRIBUTOR_NAME,
    model: hasModel ? normalizedModel : 'Chưa xác định model',
    rawModel: detectedRawModel,
    sku: '',
    categoryId: detectedCategoryId,
    category: detectedCategoryName,
    subCategory: detectedSubCategory,
    material: '',
    origin: detectedOrigin,
    packaging: '',
    applications: [],
    technicalSpecifications: [],
    visibleText: params.visibleText || [],
    confidence,
    fieldConfidence: {
      brand: hasBrand ? 0.88 : 0.2,
      model: hasModel ? 0.88 : 0.2,
      category: hasCategory ? 0.82 : 0.25,
      productName: hasBrand && hasModel ? 0.86 : 0.35,
      specifications: 0,
    },
    fieldSources: {
      brand: hasBrand ? 'IMAGE_LABEL' : 'AI_INFERRED',
      model: hasModel ? 'IMAGE_LABEL' : 'AI_INFERRED',
      category: hasCategory ? 'PRODUCT_CATALOG' : 'AI_INFERRED',
      productName: 'PRODUCT_CATALOG',
      specifications: 'AI_INFERRED',
    },
    warnings: [
      'Đang sử dụng bộ phân tích từ điển ngành nước cục bộ. Vui lòng kiểm tra hoặc chọn Đối chiếu danh mục để xác thực đầy đủ thông số.',
    ],
    missingFields,
    requiresManualReview: true,
    recognitionModel: 'local-water-treatment-parser',
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
 * Hậu xử lý, kiểm chứng chéo & chuẩn hóa dữ liệu thô trả về từ Gemini API (Bước 6 đến Bước 12)
 */
export function normalizeAndValidateAiRecognitionResponse(
  rawApiData: Record<string, unknown>,
  fileName: string,
  extraQualityWarnings: string[] = [],
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

  // Kiểm tra đối chiếu với Danh mục nội bộ VUTECH (Bước 8)
  const catalogMatch = matchInternalVutechCatalog({
    brand: rawBrand,
    model: String(rawApiData.model || ''),
    rawModel: rawModelInput,
    visibleText,
    fileName,
  });

  // Xác định CategoryId chuẩn trong 10 nhóm ngành nước
  let categoryId: WaterTreatmentCategoryId = 'unclassified';
  let categoryName = 'Chưa xác định nhóm sản phẩm';
  let subCategory = rawSubCategory || 'Chưa phân loại chi tiết';

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
    } else {
      const searchPool = `${rawCategoryInput} ${rawSubCategory} ${rawBrand} ${rawModelInput} ${visibleText.join(' ')}`.toLowerCase();
      for (const cat of WATER_TREATMENT_CATEGORIES) {
        if (cat.keywords.some((kw) => searchPool.includes(kw.toLowerCase()))) {
          categoryId = cat.id;
          categoryName = cat.name;
          if (!rawSubCategory) subCategory = cat.subCategories[0];
          break;
        }
      }
    }
  }

  // Xác thực Brand (không bao giờ ép VUTECH làm brand nếu trên bao bì có thương hiệu nhà sản xuất khác)
  const rawFieldConf = (rawApiData.fieldConfidence || {}) as Record<string, number>;
  let brandConfidence = Number(rawFieldConf.brand ?? rawApiData.confidence ?? 0.75);
  let modelConfidence = Number(rawFieldConf.model ?? rawApiData.confidence ?? 0.75);
  let categoryConfidence = Number(rawFieldConf.category ?? rawApiData.confidence ?? 0.8);
  let specsConfidence = Number(rawFieldConf.specifications ?? 0.75);

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
    !verifiedBrand ||
    verifiedBrand.toLowerCase().includes('chưa xác định') ||
    verifiedBrand.toLowerCase() === 'unknown' ||
    brandConfidence < 0.7
  ) {
    // Thử dò trong visibleText xem có thương hiệu tham chiếu nào không
    const joinedVisible = visibleText.join(' ').toUpperCase();
    const refBrand = WATER_TREATMENT_REFERENCE_BRANDS.find((b) =>
      b.aliases.some((a) => joinedVisible.includes(a.toUpperCase())),
    );
    if (refBrand) {
      verifiedBrand = refBrand.brand;
      brandConfidence = 0.92;
      verifiedBrandSource = 'IMAGE_LABEL';
    } else {
      verifiedBrand = 'Chưa xác định thương hiệu';
      brandConfidence = Math.min(brandConfidence, 0.45);
      verifiedBrandSource = 'AI_INFERRED';
    }
  }

  // Xác thực & Chuẩn hóa Model (Tuyệt đối cấm sinh VT-01, VT-02...)
  let verifiedRawModel = rawModelInput;
  let verifiedModel = normalizeProductModelCode(String(rawApiData.model || rawModelInput));
  let verifiedModelSource: FieldDataSource = 'IMAGE_LABEL';

  if (catalogMatch) {
    verifiedModel = catalogMatch.model;
    if (!verifiedRawModel) {
      verifiedRawModel = catalogMatch.rawModelAliases[0] || catalogMatch.model;
    }
    modelConfidence = Math.max(modelConfidence, 0.96);
    verifiedModelSource = visibleText.length > 0 ? 'IMAGE_LABEL' : 'PRODUCT_CATALOG';
  } else if (
    !verifiedModel ||
    verifiedModel.toLowerCase().includes('chưa xác định') ||
    verifiedModel.toLowerCase() === 'unknown' ||
    /^VT-0[1-9]$/i.test(verifiedModel) ||
    modelConfidence < 0.7
  ) {
    verifiedModel = 'Chưa xác định model';
    verifiedRawModel = '';
    modelConfidence = Math.min(modelConfidence, 0.45);
    verifiedModelSource = 'AI_INFERRED';
  }

  // Chuẩn hóa tên sản phẩm theo công thức Mục VI
  let standardName = '';
  let shortName = '';
  let productNameConfidence = Number(rawFieldConf.productName ?? 0.85);
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

    if (hasValidBrand || hasValidModel || hasValidCategory) {
      const built = buildNormalizedProductName({
        categoryId,
        subCategory,
        brand: hasValidBrand ? verifiedBrand : '',
        model: hasValidModel ? verifiedModel : '',
        rawModel: verifiedRawModel,
        visibleText,
        existingName: String(rawApiData.productName || ''),
      });
      standardName = built.standardName;
      shortName = built.shortName;
      productNameConfidence =
        hasValidBrand && hasValidModel
          ? Math.max(0.91, (brandConfidence + modelConfidence) / 2)
          : 0.76;
    } else {
      standardName = 'Cần bổ sung thông tin sản phẩm';
      shortName = 'Cần bổ sung thông tin';
      productNameConfidence = 0.4;
    }
  }

  // Trích xuất và lọc Thông số kỹ thuật hợp lệ theo đúng chủng loại sản phẩm (Mục IX)
  const rawSpecsArray = Array.isArray(rawApiData.technicalSpecifications)
    ? rawApiData.technicalSpecifications
    : [];

  let parsedSpecs: TechnicalSpecItem[] = rawSpecsArray
    .map((item: unknown) => {
      const obj = (item || {}) as Record<string, unknown>;
      const conf = Number(obj.confidence ?? 0.85);
      const srcRaw = String(obj.source || 'IMAGE_LABEL').toUpperCase();
      const source: FieldDataSource =
        srcRaw === 'PRODUCT_CATALOG' ||
        srcRaw === 'DATASHEET' ||
        srcRaw === 'USER_CONFIRMED' ||
        srcRaw === 'AI_INFERRED'
          ? (srcRaw as FieldDataSource)
          : 'IMAGE_LABEL';

      return {
        name: String(obj.name || '').trim(),
        value: String(obj.value || '').trim(),
        unit: obj.unit ? String(obj.unit).trim() : undefined,
        source,
        confidence: conf,
        // Chỉ cho phép verified = true nếu độ tin cậy >= 0.70 và không phải suy đoán mơ hồ
        verified: Boolean(obj.verified ?? conf >= 0.75) && source !== 'AI_INFERRED',
      };
    })
    .filter((s) => s.name && s.value);

  // Loại bỏ mọi thông số bị cấm đối với nhóm sản phẩm (ví dụ: Nguồn điện DC 12V trên bao hạt nhựa)
  parsedSpecs = filterValidSpecsForCategory(categoryId, parsedSpecs);

  // Nếu khớp với sản phẩm trong danh mục VUTECH mà trên bao bì ít chữ thông số, bổ sung thông số chuẩn từ PRODUCT_CATALOG
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
    catalogMatch?.packaging ||
    '';

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
  if (categoryId === 'unclassified') missingFields.push('category');
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
      (verifiedSpecsOnly.length > 0 ? specsConfidence : 0.4) * 0.15
    ).toFixed(2),
  );

  const requiresManualReview =
    overallConfidence < 0.9 ||
    missingFields.includes('brand') ||
    missingFields.includes('model') ||
    missingFields.includes('category');

  const recognitionStatus: RecognitionStatus =
    overallConfidence >= 0.88 && !missingFields.includes('brand') && !missingFields.includes('model')
      ? 'SUCCESS'
      : overallConfidence >= 0.65
        ? 'PARTIAL'
        : 'MANUAL_REQUIRED';

  const record: ProductRecognitionRecord = {
    recognitionStatus,
    productName: standardName,
    shortName,
    brand: verifiedBrand,
    manufacturer:
      String(rawApiData.manufacturer || '').trim() ||
      catalogMatch?.manufacturer ||
      (verifiedBrand !== 'Chưa xác định thương hiệu' ? verifiedBrand : 'Chưa xác định'),
    distributor: VUTECH_DISTRIBUTOR_NAME,
    model: verifiedModel,
    rawModel: verifiedRawModel,
    sku: String(rawApiData.sku || '').trim() || catalogMatch?.sku || '',
    categoryId,
    category: categoryName,
    subCategory,
    material: String(rawApiData.material || '').trim() || catalogMatch?.material || '',
    origin: String(rawApiData.origin || '').trim() || catalogMatch?.origin || '',
    packaging,
    applications: Array.isArray(rawApiData.applications) && rawApiData.applications.length > 0
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
      category: catalogMatch ? 'PRODUCT_CATALOG' : 'IMAGE_LABEL',
      productName: productNameSource,
      specifications: catalogMatch
        ? 'PRODUCT_CATALOG'
        : verifiedSpecsOnly.length > 0
          ? 'IMAGE_LABEL'
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

/**
 * Gọi API Smart Product Recognition Engine 2.0 với cơ chế:
 * - Luôn lấy ảnh gốc (sourceImageUrl) tạo bản sao tăng tương phản phục vụ OCR
 * - Kiểm tra Cache theo mã hash ảnh trước khi gọi API
 * - Hỗ trợ Retry với Exponential Backoff khi gặp HTTP 429
 * - Phân loại lỗi chi tiết HTTP 400 / 401 / 403 / 404 / 429 / 500 / 503
 * - Hỗ trợ cả Chế độ A (nhiều góc chụp của cùng 1 sản phẩm) và Chế độ B (từng ảnh sản phẩm riêng)
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

  // Gọi endpoint /api/gemini/recognize-product-v2 với cơ chế retry tối đa 2 lần nếu 429
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
          detailMessage: String(payload.detailMessage || payload.error || 'Không thể hoàn tất yêu cầu nhận diện AI.'),
          troubleshootingSteps: Array.isArray(payload.troubleshootingSteps)
            ? (payload.troubleshootingSteps as string[])
            : ['Kiểm tra lại cấu hình GEMINI_API_KEY hoặc thử đối chiếu Danh mục VUTECH.'],
          retryAfterSeconds: typeof payload.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : undefined,
          timestamp: new Date().toISOString(),
        };

        // Nếu HTTP 429 và còn lượt thử, chờ backoff ngắn rồi thử lại
        if (response.status === 429 && attempt < maxAttempts) {
          const waitMs = Math.min(4000, (apiError.retryAfterSeconds || 2) * 1000);
          await new Promise((r) => setTimeout(r, waitMs));
          continue;
        }

        // Kích hoạt Cơ chế Dự phòng Đa tầng (Mục XI) khi API lỗi
        const cachedFallback = getCachedRecognitionByHash(imageHash);
        if (cachedFallback) {
          return {
            record: {
              ...cachedFallback,
              apiError,
              warnings: [
                ...cachedFallback.warnings,
                `API tạm thời gián đoạn (${apiError.httpStatus}). Đã khôi phục kết quả nhận diện từ bộ nhớ đệm.`,
              ],
            },
            fromCache: true,
          };
        }

        const localFallback = parseWaterTreatmentTokensLocally({
          fileName: params.fileNames.join(' '),
        });
        localFallback.apiError = apiError;
        localFallback.recognitionStatus =
          localFallback.recognitionStatus === 'SUCCESS' ? 'PARTIAL' : 'ERROR';
        localFallback.warnings = [
          `${apiError.title}: ${apiError.detailMessage}`,
          ...localFallback.warnings,
        ];

        return {
          record: localFallback,
          fromCache: false,
        };
      }

      const { record, subjectBox, recommendedTemplate } =
        normalizeAndValidateAiRecognitionResponse(
          payload,
          primaryFileName,
          allQualityWarnings,
        );

      // Bảo toàn danh sách trường xung đột nếu ở Chế độ A (nhiều góc chụp)
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
      const apiError: ApiDiagnosticError = {
        httpStatus: 503,
        errorCode: 'NETWORK_OR_TIMEOUT_ERROR',
        title: 'Lỗi kết nối mạng hoặc Timeout khi gọi dịch vụ nhận diện',
        detailMessage:
          networkErr instanceof Error ? networkErr.message : 'Không thể kết nối tới máy chủ xử lý AI.',
        troubleshootingSteps: [
          'Kiểm tra kết nối mạng hoặc trạng thái máy chủ VUTECH Studio.',
          'Sử dụng nút "Đối chiếu danh mục" để chọn nhanh sản phẩm từ cơ sở dữ liệu VUTECH.',
          'Hoặc nhập Thương hiệu & Model để hệ thống tự động chuẩn hóa tên và thông số.',
        ],
        timestamp: new Date().toISOString(),
      };

      const localFallback = parseWaterTreatmentTokensLocally({
        fileName: params.fileNames.join(' '),
      });
      localFallback.apiError = apiError;
      localFallback.recognitionStatus =
        localFallback.recognitionStatus === 'SUCCESS' ? 'PARTIAL' : 'ERROR';

      return {
        record: localFallback,
        fromCache: false,
      };
    }
  }

  const finalFallback = parseWaterTreatmentTokensLocally({
    fileName: params.fileNames.join(' '),
  });
  return { record: finalFallback, fromCache: false };
}
