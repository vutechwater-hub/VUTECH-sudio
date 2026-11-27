import type {
  GroupImageAsset,
  GroupRuntimeSettings,
  PlatformStandardEntry,
  ValidationCheckItem,
  ValidationReport,
  ValidationStatus,
} from '../types/multichannel';
import type { StudioConfig } from '../types/studio';

const PHONE_REGEX = /(?:0|\+84)[.\s-]?\d{2,3}[.\s-]?\d{3}[.\s-]?\d{3,4}/;
const URL_REGEX = /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|vn|net|org|io))/i;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const SHOPEE_PROMO_WORDS_REGEX = /(freeship\s*xtra|voucher\s*xtra|shopee\s*mall|yêu\s*thích\+)/i;

function parseAspectRatioValue(ratioStr: string): number | null {
  if (!ratioStr || !ratioStr.includes(':')) return null;
  const [wStr, hStr] = ratioStr.split(':');
  const w = Number(wStr);
  const h = Number(hStr);
  if (!Number.isFinite(w) || !Number.isFinite(h) || h <= 0) return null;
  return w / h;
}

export function createPendingValidation(reason = 'Chưa tạo ảnh để kiểm tra quy chuẩn.'): ValidationReport {
  return {
    status: 'pending',
    summary: reason,
    checks: [
      {
        code: 'PENDING',
        label: 'Trạng thái tạo ảnh',
        status: 'pending',
        detail: reason,
      },
    ],
    canExportAsPlatformCompliant: false,
    checkedAt: new Date().toISOString(),
  };
}

export function validateGroupAsset(params: {
  asset: Pick<
    GroupImageAsset,
    | 'groupId'
    | 'slotIndex'
    | 'slideKey'
    | 'title'
    | 'status'
    | 'renderedWidth'
    | 'renderedHeight'
    | 'fileSizeBytes'
    | 'format'
    | 'mimeType'
    | 'customSourceUrl'
    | 'customTechnicalNotes'
    | 'requiresTechnicalDoc'
    | 'requiresVerifiedCert'
  >;
  standard: PlatformStandardEntry;
  settings: GroupRuntimeSettings;
  studioConfig: StudioConfig;
  totalActiveInGroup: number;
  expectedWidth?: number;
  expectedHeight?: number;
  expectedAspectRatio?: string;
}): ValidationReport {
  const {
    asset,
    standard,
    settings,
    studioConfig,
    totalActiveInGroup,
    expectedWidth,
    expectedHeight,
    expectedAspectRatio,
  } = params;

  const checkedAt = new Date().toISOString();

  if (asset.status === 'not-generated' || asset.status === 'queued' || asset.status === 'generating') {
    return createPendingValidation('Ảnh chưa được kết xuất xong.');
  }

  if (asset.status === 'missing-data') {
    return {
      status: 'pending',
      summary: 'Cần bổ sung tài liệu kỹ thuật hoặc dữ liệu xác thực trước khi xuất.',
      checks: [
        {
          code: 'MISSING_VERIFIED_DATA',
          label: 'Dữ liệu kỹ thuật xác thực',
          status: 'pending',
          detail:
            'Chưa có bản vẽ kích thước / sơ đồ cấu tạo / chứng nhận xác thực. Hệ thống không tự suy đoán bằng AI để đảm bảo tính chính xác.',
          critical: true,
        },
      ],
      canExportAsPlatformCompliant: false,
      checkedAt,
    };
  }

  if (asset.status === 'error') {
    return {
      status: 'fail',
      summary: 'Quá trình kết xuất ảnh thất bại.',
      checks: [
        {
          code: 'RENDER_ERROR',
          label: 'Kết xuất ảnh',
          status: 'fail',
          detail: 'Không thể kết xuất ảnh nguồn. Vui lòng thử tạo lại hoặc kiểm tra ảnh gốc.',
          critical: true,
        },
      ],
      canExportAsPlatformCompliant: false,
      checkedAt,
    };
  }

  const checks: ValidationCheckItem[] = [];
  const w = asset.renderedWidth;
  const h = asset.renderedHeight;
  const fileSizeKB = Math.round((asset.fileSizeBytes / 1024) * 10) / 10;

  // 1. Dimensions & Minimum resolution check
  const meetsMin = w >= standard.minDimensions.width && h >= standard.minDimensions.height;
  const meetsMax =
    !standard.maxDimensions ||
    (w <= standard.maxDimensions.width && h <= standard.maxDimensions.height);
  if (!meetsMin) {
    checks.push({
      code: 'DIMENSIONS_TOO_SMALL',
      label: 'Độ phân giải tối thiểu',
      status: 'fail',
      detail: `Kích thước thực tế ${w}×${h} px thấp hơn mức tối thiểu ${standard.minDimensions.width}×${standard.minDimensions.height} px.`,
      critical: true,
    });
  } else if (!meetsMax && standard.maxDimensions) {
    checks.push({
      code: 'DIMENSIONS_TOO_LARGE',
      label: 'Độ phân giải tối đa',
      status: 'warning',
      detail: `Kích thước ${w}×${h} px vượt khuyến nghị ${standard.maxDimensions.width}×${standard.maxDimensions.height} px.`,
    });
  } else {
    checks.push({
      code: 'DIMENSIONS_OK',
      label: 'Kích thước điểm ảnh',
      status: 'pass',
      detail: `Đạt ${w} × ${h} px (sRGB).`,
    });
  }

  // 2. Aspect Ratio Check (skip for Group 07 which intentionally preserves original ratio)
  if (standard.id !== '07_copyright_watermark') {
    const actualRatio = w / Math.max(1, h);
    const targetRatioStr = expectedAspectRatio ?? standard.aspectRatios[0];
    const targetRatio = parseAspectRatioValue(targetRatioStr);
    if (targetRatio && Math.abs(actualRatio - targetRatio) > 0.03) {
      checks.push({
        code: 'ASPECT_RATIO_MISMATCH',
        label: 'Tỷ lệ khung hình',
        status: 'fail',
        detail: `Tỷ lệ thực tế (${actualRatio.toFixed(2)}) lệch so với quy chuẩn ${targetRatioStr}.`,
        critical: true,
      });
    } else if (expectedWidth && expectedHeight && (w !== expectedWidth || h !== expectedHeight)) {
      checks.push({
        code: 'EXACT_DIM_DIFF',
        label: 'Khớp kích thước cấu hình',
        status: 'warning',
        detail: `Thực tế ${w}×${h} px (cấu hình chọn ${expectedWidth}×${expectedHeight} px).`,
      });
    } else {
      checks.push({
        code: 'ASPECT_RATIO_OK',
        label: 'Tỷ lệ khung hình',
        status: 'pass',
        detail: `Chuẩn tỷ lệ ${targetRatioStr || 'đã chọn'}, không biến dạng sản phẩm.`,
      });
    }
  } else {
    checks.push({
      code: 'ORIGINAL_RATIO_PRESERVED',
      label: 'Bảo toàn tỷ lệ ảnh gốc',
      status: 'pass',
      detail: `Giữ nguyên độ phân giải gốc ${w}×${h} px, không cắt xén.`,
    });
  }

  // 3. File Size Check
  const activeMaxKB = settings.enforceMaxSizeKB ?? standard.maxFileSizeKB;
  if (activeMaxKB && fileSizeKB > activeMaxKB) {
    checks.push({
      code: 'FILE_SIZE_EXCEEDED',
      label: 'Giới hạn dung lượng',
      status: 'fail',
      detail: `Dung lượng ${fileSizeKB} KB vượt ngưỡng tối đa ${activeMaxKB} KB.`,
      critical: true,
    });
  } else if (
    standard.targetFileSizeRangeKB &&
    fileSizeKB > standard.targetFileSizeRangeKB.max
  ) {
    checks.push({
      code: 'FILE_SIZE_ABOVE_TARGET',
      label: 'Mục tiêu dung lượng tối ưu',
      status: 'warning',
      detail: `Dung lượng ${fileSizeKB} KB cao hơn mục tiêu nội bộ (${standard.targetFileSizeRangeKB.min}–${standard.targetFileSizeRangeKB.max} KB).`,
    });
  } else {
    checks.push({
      code: 'FILE_SIZE_OK',
      label: 'Dung lượng thực tế',
      status: 'pass',
      detail: activeMaxKB
        ? `${fileSizeKB} KB (đạt chuẩn ≤ ${activeMaxKB} KB).`
        : `${fileSizeKB} KB (ưu tiên chất lượng cao).`,
    });
  }

  // 4. Format & MIME Type Check
  const expectedMime =
    asset.format === 'jpg'
      ? 'image/jpeg'
      : asset.format === 'webp'
      ? 'image/webp'
      : asset.format === 'pdf'
      ? 'application/pdf'
      : 'image/png';
  if (!standard.allowedFormats.includes(asset.format)) {
    checks.push({
      code: 'FORMAT_NOT_ALLOWED',
      label: 'Định dạng file',
      status: 'fail',
      detail: `Định dạng .${asset.format} không nằm trong danh sách cho phép (${standard.allowedFormats.join(', ')}).`,
      critical: true,
    });
  } else if (asset.mimeType && asset.mimeType !== expectedMime) {
    checks.push({
      code: 'MIME_MISMATCH',
      label: 'MIME Type',
      status: 'warning',
      detail: `Trình duyệt trả về ${asset.mimeType} thay vì ${expectedMime}.`,
    });
  } else {
    checks.push({
      code: 'FORMAT_OK',
      label: 'Định dạng & MIME',
      status: 'pass',
      detail: `${asset.format.toUpperCase()} (${expectedMime}).`,
    });
  }

  // 5. Shopee Off-Platform & Promo Badge Rules
  const isShopee = standard.id === '01_shopee_cover' || standard.id === '02_shopee_detail';
  if (isShopee) {
    const renderedTextPool = [
      studioConfig.productName,
      studioConfig.tagline,
      ...studioConfig.specs,
      asset.customTechnicalNotes ?? '',
    ].join(' ');

    const hasForbiddenContact =
      PHONE_REGEX.test(renderedTextPool) ||
      URL_REGEX.test(renderedTextPool) ||
      EMAIL_REGEX.test(renderedTextPool) ||
      /\bqr\b/i.test(renderedTextPool);

    if (hasForbiddenContact) {
      checks.push({
        code: 'SHOPEE_OFFPLATFORM_LEAK',
        label: 'Chính sách không điều hướng ngoài sàn Shopee',
        status: 'fail',
        detail:
          'Phát hiện SĐT, website, email hoặc mã QR trong nội dung sản phẩm/thông số. Cần gỡ bỏ trước khi đăng Shopee.',
        critical: true,
      });
    } else {
      checks.push({
        code: 'SHOPEE_NO_EXTERNAL_OK',
        label: 'Chính sách không điều hướng ngoài sàn Shopee',
        status: 'pass',
        detail: 'Đã tự động ẩn Hotline, Website, Facebook và không phát hiện thông tin ngoài sàn.',
      });
    }

    if (SHOPEE_PROMO_WORDS_REGEX.test(renderedTextPool)) {
      checks.push({
        code: 'SHOPEE_BAKED_BADGE_TEXT',
        label: 'Tem khuyến mãi Shopee',
        status: 'fail',
        detail: 'Không được đưa chữ Freeship Xtra / Voucher Xtra / Yêu thích+ trực tiếp vào ảnh xuất.',
        critical: true,
      });
    } else {
      checks.push({
        code: 'SHOPEE_OVERLAY_SEPARATED',
        label: 'Tách lớp Preview Overlay Shopee',
        status: 'pass',
        detail: 'Ảnh xuất sạch hoàn toàn, không ghép cứng tem khuyến mãi Shopee.',
      });
    }
  }

  // 6. Product Framing / Clipping / Stretch Check
  if (standard.id !== '07_copyright_watermark') {
    const extremeOffset =
      Math.abs(studioConfig.productOffsetX) > 32 || Math.abs(studioConfig.productOffsetY) > 32;
    const extremeScale = studioConfig.productScale > 1.75 || studioConfig.productScale < 0.65;
    if (extremeOffset || extremeScale) {
      checks.push({
        code: 'FRAMING_CLIP_RISK',
        label: 'Vùng an toàn & Cắt mất sản phẩm',
        status: 'warning',
        detail:
          'Mức thu phóng hoặc dịch chuyển ảnh gốc khá lớn — nên kiểm tra lại trong cửa sổ Zoom để tránh cắt mất chi tiết thiết bị.',
      });
    } else {
      checks.push({
        code: 'SAFE_ZONE_OK',
        label: 'Logo & Vùng an toàn',
        status: 'pass',
        detail: standard.safeZoneDescription,
      });
    }
  }

  // 7. Required Product Info / Specs Completeness & Overflow Check
  if (standard.id !== '07_copyright_watermark') {
    const validSpecs = studioConfig.specs.filter((s) => s.trim().length > 0);
    if (!studioConfig.productName.trim() || !studioConfig.modelCode.trim()) {
      checks.push({
        code: 'MISSING_PRODUCT_META',
        label: 'Tên sản phẩm & Mã SKU/Model',
        status: 'warning',
        detail: 'Thiếu tên sản phẩm hoặc mã Model — nên cập nhật đầy đủ để đồng bộ đặt tên file.',
      });
    } else if (studioConfig.productName.length > 78) {
      checks.push({
        code: 'TITLE_OVERFLOW_RISK',
        label: 'Độ dài tiêu đề trên khung',
        status: 'warning',
        detail: 'Tên sản phẩm khá dài (>78 ký tự), có thể bị rút gọn dấu "…" trên khung nhỏ.',
      });
    } else if (validSpecs.length < 3 && standard.id !== '01_shopee_cover') {
      checks.push({
        code: 'INCOMPLETE_SPECS',
        label: 'Đầy đủ 3 thông số kỹ thuật',
        status: 'warning',
        detail: `Hiện mới có ${validSpecs.length}/3 thông số kỹ thuật được nhập.`,
      });
    } else {
      checks.push({
        code: 'PRODUCT_META_OK',
        label: 'Dữ liệu sản phẩm đồng bộ',
        status: 'pass',
        detail: `${studioConfig.modelCode} · ${validSpecs.length} thông số hợp lệ.`,
      });
    }
  }

  // 8. Group Count Cap Check (e.g., Shopee max 8 sub-images + 1 cover = 9)
  if (standard.maxCount !== null && totalActiveInGroup > standard.maxCount) {
    checks.push({
      code: 'COUNT_LIMIT_EXCEEDED',
      label: 'Giới hạn số lượng ảnh nền tảng',
      status: 'fail',
      detail: `Nhóm đang có ${totalActiveInGroup} ảnh, vượt giới hạn tối đa ${standard.maxCount} ảnh.`,
      critical: true,
    });
  }

  // 9. Honest Verification Notice (Never claim 100% absolute compliance if standard is partially verified)
  if (standard.verificationStatus !== 'verified') {
    checks.push({
      code: 'MANUAL_REVIEW_ADVISORY',
      label: 'Xác minh chính sách nền tảng',
      status: 'warning',
      detail:
        'Quy chuẩn kỹ thuật đã đạt theo cấu hình hiện hành; vui lòng kiểm tra thủ công thêm các quy định ngành hàng mới nhất trên cổng người bán trước khi đăng tải.',
    });
  }

  const hasFail = checks.some((c) => c.status === 'fail');
  const hasCriticalFail = checks.some((c) => c.status === 'fail' && c.critical);
  const hasWarning = checks.some((c) => c.status === 'warning');

  const overallStatus: ValidationStatus = hasFail
    ? 'fail'
    : hasWarning
    ? 'warning'
    : 'pass';

  const summary = hasFail
    ? checks.find((c) => c.status === 'fail')?.detail ?? 'Không đạt quy chuẩn nền tảng.'
    : hasWarning
    ? checks.find((c) => c.status === 'warning')?.detail ?? 'Đạt cơ bản — cần kiểm tra lại.'
    : 'Đạt đầy đủ quy chuẩn kỹ thuật & bố cục nội bộ VUTECH.';

  return {
    status: overallStatus,
    summary,
    checks,
    canExportAsPlatformCompliant: !hasCriticalFail,
    checkedAt,
  };
}
