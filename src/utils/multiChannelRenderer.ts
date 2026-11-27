import { VUTECH_LOGOS } from '../constants/vutech';
import type {
  DesignGroupId,
  FacebookRatioKey,
  GroupImageAsset,
  GroupRuntimeSettings,
  OutputFileFormat,
  PlatformStandardEntry,
} from '../types/multichannel';
import type { StudioConfig } from '../types/studio';
import { loadImage } from './canvasRenderer';

const processedLogoCache = new Map<string, HTMLCanvasElement>();

function stripWhiteLogoBg(
  img: HTMLImageElement,
  key: string,
  removeBg: boolean
): HTMLCanvasElement | HTMLImageElement {
  if (!removeBg) return img;
  const cached = processedLogoCache.get(key);
  if (cached) return cached;

  const off = document.createElement('canvas');
  off.width = img.naturalWidth || img.width;
  off.height = img.naturalHeight || img.height;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  if (!ctx) return img;

  ctx.drawImage(img, 0, 0);
  try {
    const imgData = ctx.getImageData(0, 0, off.width, off.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i];
      const g = d[i + 1];
      const b = d[i + 2];
      const a = d[i + 3];
      if (a === 0) continue;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      if (luma > 242 && chroma < 18) {
        d[i + 3] = 0;
      } else if (luma > 218 && chroma < 24) {
        const f = Math.max(0, Math.min(1, (242 - luma) / 24));
        d[i + 3] = Math.round(a * f * f);
      }
    }
    ctx.putImageData(imgData, 0, 0);
    processedLogoCache.set(key, off);
    return off;
  } catch {
    return img;
  }
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let cur = words[0];

  for (let i = 1; i < words.length; i++) {
    const next = `${cur} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      cur = next;
    } else {
      lines.push(cur);
      cur = words[i];
      if (lines.length === maxLines - 1) {
        let rest = words.slice(i).join(' ');
        while (ctx.measureText(rest).width > maxWidth && rest.length > 4) {
          rest = `${rest.slice(0, -2).trimEnd()}…`;
        }
        lines.push(rest);
        return lines;
      }
    }
  }
  lines.push(cur);
  return lines.slice(0, maxLines);
}

/**
 * Strips any off-platform phone numbers, URLs or email addresses when rendering Shopee text.
 */
function sanitizeShopeeText(text: string): string {
  return text
    .replace(/(?:0|\+84)[.\s-]?\d{2,3}[.\s-]?\d{3}[.\s-]?\d{3,4}/g, '')
    .replace(/https?:\/\/\S+|www\.\S+/gi, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Draws the product photo inside stageRect cleanly, preserving proportions with zero distortion.
 * Supports AI subject auto-framing, optional macro close-up crop, and studio blur extension.
 */
function drawProductInStage(params: {
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  stage: { x: number; y: number; w: number; h: number };
  studioConfig: StudioConfig;
  u: number;
  zoomBoost?: number;
  isMacro?: boolean;
  cleanWhiteMode?: boolean;
  cornerRadius?: number;
  targetOccupancy?: number;
}) {
  const {
    ctx,
    img,
    stage,
    studioConfig,
    u,
    zoomBoost = 1,
    isMacro = false,
    cleanWhiteMode = false,
    cornerRadius = 12,
    targetOccupancy = 0.86,
  } = params;

  ctx.save();
  drawRoundedRect(ctx, stage.x, stage.y, stage.w, stage.h, Math.round(cornerRadius * u));
  ctx.clip();

  const imgAspect = img.naturalWidth / Math.max(1, img.naturalHeight);
  const stageAspect = stage.w / Math.max(1, stage.h);
  const colorFilter = `brightness(${studioConfig.brightness}%) contrast(${studioConfig.contrast}%) saturate(${studioConfig.saturation}%)`;

  const shouldBlurBg = !cleanWhiteMode && (studioConfig.extendBackground || studioConfig.backgroundBlurEnabled);
  if (shouldBlurBg && !isMacro) {
    let covW = stage.w;
    let covH = stage.h;
    if (imgAspect > stageAspect) {
      covH = stage.h * 1.14;
      covW = covH * imgAspect;
    } else {
      covW = stage.w * 1.14;
      covH = covW / imgAspect;
    }
    const cx = stage.x + (stage.w - covW) / 2;
    const cy = stage.y + (stage.h - covH) / 2;
    const blurPx = Math.max(6, Math.round(studioConfig.backgroundBlurAmount * u * 1.2));
    ctx.save();
    ctx.filter = `blur(${blurPx}px) brightness(106%) contrast(94%)`;
    ctx.drawImage(img, cx, cy, covW, covH);
    ctx.filter = 'none';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.24)';
    ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
    ctx.restore();
  } else if (cleanWhiteMode) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(stage.x, stage.y, stage.w, stage.h);
  }

  const sBox = studioConfig.subjectBox ?? { x: 0.12, y: 0.08, w: 0.76, h: 0.84 };
  const safeSubjW = Math.max(0.22, Math.min(1, sBox.w));
  const safeSubjH = Math.max(0.22, Math.min(1, sBox.h));

  let drawW = stage.w;
  let drawH = stage.h;
  let drawX = stage.x;
  let drawY = stage.y;

  if (isMacro) {
    // High-clarity macro close-up focusing on the center-upper core details of the real product
    const coverScale = Math.max(
      stage.w / Math.max(1, img.naturalWidth * safeSubjW),
      stage.h / Math.max(1, img.naturalHeight * safeSubjH)
    ) * 1.38;
    drawW = img.naturalWidth * coverScale;
    drawH = img.naturalHeight * coverScale;
    const focusX = sBox.x + safeSubjW * 0.5;
    const focusY = sBox.y + safeSubjH * 0.42;
    drawX = stage.x + stage.w / 2 - focusX * drawW;
    drawY = stage.y + stage.h / 2 - focusY * drawH;
  } else if (studioConfig.autoFrameSubject) {
    const subjPxW = img.naturalWidth * safeSubjW;
    const subjPxH = img.naturalHeight * safeSubjH;
    const fitScale = Math.min(
      (stage.w * targetOccupancy) / Math.max(1, subjPxW),
      (stage.h * targetOccupancy) / Math.max(1, subjPxH)
    );
    drawW = img.naturalWidth * fitScale * studioConfig.productScale * zoomBoost;
    drawH = img.naturalHeight * fitScale * studioConfig.productScale * zoomBoost;

    const cNormX = sBox.x + safeSubjW / 2;
    const cNormY = sBox.y + safeSubjH / 2;
    const ox = (studioConfig.productOffsetX / 100) * stage.w;
    const oy = (studioConfig.productOffsetY / 100) * stage.h;
    drawX = stage.x + stage.w / 2 - cNormX * drawW + ox;
    drawY = stage.y + stage.h / 2 - cNormY * drawH + oy;
  } else {
    if (imgAspect > stageAspect) {
      drawW = stage.w * targetOccupancy;
      drawH = drawW / imgAspect;
    } else {
      drawH = stage.h * targetOccupancy;
      drawW = drawH * imgAspect;
    }
    drawW *= studioConfig.productScale * zoomBoost;
    drawH *= studioConfig.productScale * zoomBoost;
    drawX = stage.x + (stage.w - drawW) / 2 + (studioConfig.productOffsetX / 100) * stage.w;
    drawY = stage.y + (stage.h - drawH) / 2 + (studioConfig.productOffsetY / 100) * stage.h;
  }

  // Soft natural studio contact shadow under clean white placement
  if (cleanWhiteMode && !isMacro) {
    const shadowY = Math.min(stage.y + stage.h - 10 * u, drawY + drawH - 4 * u);
    const shGrad = ctx.createRadialGradient(
      stage.x + stage.w / 2,
      shadowY,
      drawW * 0.06,
      stage.x + stage.w / 2,
      shadowY,
      drawW * 0.36
    );
    shGrad.addColorStop(0, 'rgba(7, 42, 94, 0.14)');
    shGrad.addColorStop(1, 'rgba(7, 42, 94, 0)');
    ctx.fillStyle = shGrad;
    ctx.beginPath();
    ctx.ellipse(stage.x + stage.w / 2, shadowY, drawW * 0.36, Math.max(8, 14 * u), 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = colorFilter;
  ctx.drawImage(img, drawX, drawY, drawW, drawH);
  ctx.filter = 'none';
  ctx.restore();
}

function drawLogoFitted(
  ctx: CanvasRenderingContext2D,
  logo: HTMLCanvasElement | HTMLImageElement | null,
  x: number,
  y: number,
  maxW: number,
  maxH: number,
  align: 'left' | 'center' | 'right',
  onDarkPlate: boolean,
  u: number
) {
  if (!logo) return;
  const nw = logo instanceof HTMLImageElement ? logo.naturalWidth : logo.width;
  const nh = logo instanceof HTMLImageElement ? logo.naturalHeight : logo.height;
  const ratio = nw / Math.max(1, nh);
  let lw = maxW;
  let lh = lw / ratio;
  if (lh > maxH) {
    lh = maxH;
    lw = lh * ratio;
  }
  let lx = x;
  if (align === 'center') lx = x - lw / 2;
  if (align === 'right') lx = x - lw;
  const ly = y - lh / 2;

  if (onDarkPlate) {
    const px = Math.round(16 * u);
    const py = Math.round(8 * u);
    ctx.save();
    drawRoundedRect(ctx, lx - px, ly - py, lw + px * 2, lh + py * 2, Math.round(9 * u));
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }
  ctx.drawImage(logo, lx, ly, lw, lh);
}

/**
 * Pure Canvas 2D Watermark Renderer for Group 07 (Preserves original aspect ratio & resolution!)
 */
async function renderCopyrightWatermarkCanvas(
  canvas: HTMLCanvasElement,
  sourceUrl: string,
  settings: GroupRuntimeSettings,
  removeLogoBg: boolean
): Promise<{ width: number; height: number }> {
  const [img, fullLogoImg, iconLogoImg] = await Promise.all([
    loadImage(sourceUrl),
    loadImage(VUTECH_LOGOS.full).catch(() => null),
    loadImage(VUTECH_LOGOS.icon).catch(() => null),
  ]);

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return { width, height };

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  const logoSrc =
    settings.watermark.mode === 'corner'
      ? fullLogoImg ?? iconLogoImg
      : iconLogoImg ?? fullLogoImg;
  const logo = logoSrc
    ? stripWhiteLogoBg(
        logoSrc,
        settings.watermark.mode === 'corner' ? 'full-wm' : 'icon-wm',
        removeLogoBg
      )
    : null;

  if (!logo) return { width, height };

  const nw = logo instanceof HTMLImageElement ? logo.naturalWidth : logo.width;
  const nh = logo instanceof HTMLImageElement ? logo.naturalHeight : logo.height;
  const logoAspect = nw / Math.max(1, nh);
  const minSide = Math.min(width, height);
  const alpha = Math.max(0.05, Math.min(1, settings.watermark.opacityPct / 100));

  ctx.save();
  ctx.globalAlpha = alpha;

  if (settings.watermark.mode === 'corner') {
    const pad = Math.round(minSide * 0.035);
    const targetW = Math.round(minSide * (settings.watermark.logoScalePct / 100) * 1.45);
    const targetH = Math.round(targetW / logoAspect);
    let lx = pad;
    let ly = pad;
    if (settings.watermark.corner === 'top-right') {
      lx = width - targetW - pad;
      ly = pad;
    } else if (settings.watermark.corner === 'bottom-left') {
      lx = pad;
      ly = height - targetH - pad;
    } else if (settings.watermark.corner === 'bottom-right') {
      lx = width - targetW - pad;
      ly = height - targetH - pad;
    }
    // Crisp soft white pill behind corner logo if opacity > 65% so it remains legible on dark equipment
    if (alpha >= 0.65) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.88, alpha * 0.9);
      const bx = Math.round(minSide * 0.014);
      const by = Math.round(minSide * 0.008);
      drawRoundedRect(ctx, lx - bx, ly - by, targetW + bx * 2, targetH + by * 2, Math.round(minSide * 0.012));
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.restore();
    }
    ctx.drawImage(logo, lx, ly, targetW, targetH);
  } else if (settings.watermark.mode === 'center') {
    const targetW = Math.round(minSide * (settings.watermark.logoScalePct / 100) * 1.9);
    const targetH = Math.round(targetW / logoAspect);
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-16 * Math.PI) / 180);
    ctx.drawImage(logo, -targetW / 2, -targetH / 2, targetW, targetH);
  } else {
    // Tiled full-canvas repeating diagonal watermark
    const tileW = Math.max(80, Math.round(minSide * (settings.watermark.logoScalePct / 100) * 0.95));
    const tileH = Math.round(tileW / logoAspect);
    const stepX = Math.round(tileW * 1.85);
    const stepY = Math.round(tileH * 2.15);
    ctx.translate(width / 2, height / 2);
    ctx.rotate((-22 * Math.PI) / 180);
    const diag = Math.hypot(width, height);
    for (let y = -diag / 2; y < diag / 2; y += stepY) {
      const rowOffset = Math.abs(Math.round(y / stepY)) % 2 === 0 ? 0 : stepX / 2;
      for (let x = -diag / 2 - stepX; x < diag / 2 + stepX; x += stepX) {
        ctx.drawImage(logo, x + rowOffset, y, tileW, tileH);
      }
    }
  }

  ctx.restore();
  return { width, height };
}

export interface RenderGroupSlideParams {
  canvas: HTMLCanvasElement;
  groupId: DesignGroupId;
  asset: GroupImageAsset;
  standard: PlatformStandardEntry;
  settings: GroupRuntimeSettings;
  studioConfig: StudioConfig;
  overrideDimensions?: { width: number; height: number; aspectLabel?: string; ratioKey?: FacebookRatioKey };
  previewScaleMaxEdge?: number;
}

/**
 * Checks whether a slide strictly requires verified technical documentation or verified certificates
 * that haven't been supplied yet. Prevents fabricating technical drawings or certificates.
 */
export function isSlideMissingVerifiedData(asset: GroupImageAsset): boolean {
  if (asset.requiresTechnicalDoc) {
    const hasDocImage = Boolean(asset.customSourceUrl);
    const hasTechText = Boolean(asset.customTechnicalNotes && asset.customTechnicalNotes.trim().length >= 8);
    return !hasDocImage && !hasTechText;
  }
  if (asset.requiresVerifiedCert) {
    const hasCertNotes = Boolean(asset.customTechnicalNotes && asset.customTechnicalNotes.trim().length >= 6);
    const hasDocImage = Boolean(asset.customSourceUrl);
    return !hasCertNotes && !hasDocImage;
  }
  return false;
}

export async function renderGroupSlideCanvas(
  params: RenderGroupSlideParams
): Promise<{ width: number; height: number }> {
  const {
    canvas,
    groupId,
    asset,
    standard,
    settings,
    studioConfig,
    overrideDimensions,
    previewScaleMaxEdge,
  } = params;

  const sourceUrl = asset.customSourceUrl || studioConfig.sourceImageUrl;

  // Group 07: Pure Canvas Watermark preserving original resolution & ratio
  if (groupId === '07_copyright_watermark') {
    const dims = await renderCopyrightWatermarkCanvas(
      canvas,
      sourceUrl,
      settings,
      studioConfig.removeLogoBg
    );
    if (previewScaleMaxEdge && Math.max(dims.width, dims.height) > previewScaleMaxEdge) {
      const scale = previewScaleMaxEdge / Math.max(dims.width, dims.height);
      const pw = Math.round(dims.width * scale);
      const ph = Math.round(dims.height * scale);
      const tmp = document.createElement('canvas');
      tmp.width = pw;
      tmp.height = ph;
      const tctx = tmp.getContext('2d');
      if (tctx) {
        tctx.drawImage(canvas, 0, 0, pw, ph);
        canvas.width = pw;
        canvas.height = ph;
        const cctx = canvas.getContext('2d');
        cctx?.drawImage(tmp, 0, 0);
      }
    }
    return dims;
  }

  const sizeOpt =
    standard.sizeOptions.find((s) => s.id === settings.sizeId) ?? standard.sizeOptions[0];
  const fullW = overrideDimensions?.width ?? sizeOpt.width;
  const fullH = overrideDimensions?.height ?? sizeOpt.height;

  let width = fullW;
  let height = fullH;
  if (previewScaleMaxEdge && Math.max(fullW, fullH) > previewScaleMaxEdge) {
    const s = previewScaleMaxEdge / Math.max(fullW, fullH);
    width = Math.round(fullW * s);
    height = Math.round(fullH * s);
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { width: fullW, height: fullH };

  const minSide = Math.min(width, height);
  const u = minSide / 1000;
  const pad = Math.round(44 * u);
  const aspect = width / Math.max(1, height);
  const isLandscape = aspect >= 1.5;
  const isStories = aspect <= 0.62;

  const [productImg, fullLogoImg, iconLogoImg] = await Promise.all([
    loadImage(sourceUrl).catch(() => null),
    loadImage(VUTECH_LOGOS.full).catch(() => null),
    loadImage(VUTECH_LOGOS.icon).catch(() => null),
  ]);

  const fullLogo = fullLogoImg
    ? stripWhiteLogoBg(fullLogoImg, 'full', studioConfig.removeLogoBg)
    : null;
  const iconLogo = iconLogoImg
    ? stripWhiteLogoBg(iconLogoImg, 'icon', studioConfig.removeLogoBg)
    : null;

  const validSpecs = studioConfig.specs.filter((s) => s.trim().length > 0);
  const safeName = studioConfig.productName || 'Thiết Bị Lọc Nước VUTECH';
  const safeModel = studioConfig.modelCode || 'VUTECH';
  const safeCategory = studioConfig.category || 'Thiết bị xử lý nước';
  const fbLabel = studioConfig.facebookPage?.trim()
    ? /^(fb|facebook)/i.test(studioConfig.facebookPage.trim())
      ? studioConfig.facebookPage.trim()
      : `FB: ${studioConfig.facebookPage.trim()}`
    : '';
  const companyContactLine = [studioConfig.hotline, fbLabel, studioConfig.website]
    .filter(Boolean)
    .join('  ·  ');

  // =========================================================================
  // GROUP 01: SHOPEE COVER (1:1 Clean Marketplace Standard — NO Preview Badges Baked!)
  // =========================================================================
  if (groupId === '01_shopee_cover') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Subtle studio floor radial light
    const rad = ctx.createRadialGradient(width / 2, height * 0.48, minSide * 0.08, width / 2, height * 0.5, minSide * 0.58);
    rad.addColorStop(0, 'rgba(241, 246, 252, 0.45)');
    rad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = rad;
    ctx.fillRect(0, 0, width, height);

    // Compact VUTECH brand logo strictly inside top safe zone (top-center, avoiding top-left Yêu thích+ & top-right % Giảm)
    drawLogoFitted(ctx, fullLogo ?? iconLogo, width / 2, Math.round(height * 0.062), Math.round(235 * u), Math.round(52 * u), 'center', false, u);

    // Product stage occupies centered ~74% inside Shopee safe bounds (13% top .. 82.5% bottom)
    const stage = {
      x: Math.round(width * 0.08),
      y: Math.round(height * 0.125),
      w: Math.round(width * 0.84),
      h: Math.round(height * 0.695),
    };
    if (productImg) {
      drawProductInStage({
        ctx,
        img: productImg,
        stage,
        studioConfig,
        u,
        cleanWhiteMode: true,
        targetOccupancy: 0.88,
        cornerRadius: 8,
      });
    }

    // Zero external contact, zero promo text, zero baked Shopee stickers!
    return { width: fullW, height: fullH };
  }

  // =========================================================================
  // GROUP 02: SHOPEE DETAIL (08 Mobile-First Info Slides — Strictly NO Off-Platform Contact)
  // =========================================================================
  if (groupId === '02_shopee_detail') {
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    // Clean top VUTECH header bar
    const headerH = Math.round(92 * u);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, headerH);
    const topAccent = ctx.createLinearGradient(0, 0, width, 0);
    topAccent.addColorStop(0, '#0052B4');
    topAccent.addColorStop(1, '#009EE3');
    ctx.fillStyle = topAccent;
    ctx.fillRect(0, 0, width, Math.round(7 * u));
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(0, headerH - Math.max(1, 2 * u), width, Math.max(1, 2 * u));

    drawLogoFitted(ctx, fullLogo, pad, headerH / 2 + Math.round(3 * u), Math.round(220 * u), Math.round(48 * u), 'left', false, u);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(20 * u)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#0052B4';
    ctx.fillText(sanitizeShopeeText(asset.shortTitle.toUpperCase()), width - pad, headerH / 2 - Math.round(10 * u));
    ctx.font = `600 ${Math.round(17 * u)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#475569';
    ctx.fillText(`Model: ${sanitizeShopeeText(safeModel)}`, width - pad, headerH / 2 + Math.round(15 * u));

    const cleanName = sanitizeShopeeText(safeName);
    const cleanSpecs = validSpecs.map(sanitizeShopeeText).filter(Boolean);
    const userNoteLines = (asset.customTechnicalNotes ?? '')
      .split('\n')
      .map((l) => sanitizeShopeeText(l))
      .filter(Boolean);

    // Slide-specific layouts for slides 01..08
    if (asset.slotIndex === 2) {
      // 02. Structured Spec Table
      const topCard = { x: pad, y: headerH + Math.round(22 * u), w: width - pad * 2, h: Math.round((height - headerH) * 0.38) };
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, topCard.x, topCard.y, topCard.w, topCard.h, Math.round(14 * u));
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = Math.max(1, 2 * u);
      ctx.stroke();
      if (productImg) {
        drawProductInStage({ ctx, img: productImg, stage: topCard, studioConfig, u, cleanWhiteMode: true, targetOccupancy: 0.88 });
      }

      const tableY = topCard.y + topCard.h + Math.round(24 * u);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `800 ${Math.round(30 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#072A5E';
      ctx.fillText('BẢNG THÔNG SỐ KỸ THUẬT', pad, tableY);

      const rows: Array<[string, string]> = [
        ['Tên sản phẩm', cleanName],
        ['Mã Model / SKU', sanitizeShopeeText(safeModel)],
        ['Chủng loại', sanitizeShopeeText(safeCategory)],
        ...cleanSpecs.map((sp, i): [string, string] => [`Thông số ${i + 1}`, sp]),
        ...userNoteLines.slice(0, 2).map((ln, i): [string, string] => [`Chi tiết ${i + 1}`, ln]),
      ];

      let ry = tableY + Math.round(48 * u);
      const rowH = Math.round(56 * u);
      rows.slice(0, 6).forEach(([k, v], idx) => {
        ctx.fillStyle = idx % 2 === 0 ? '#FFFFFF' : '#EFF6FF';
        ctx.fillRect(pad, ry, width - pad * 2, rowH);
        ctx.strokeStyle = '#CBD5E1';
        ctx.lineWidth = Math.max(1, 1 * u);
        ctx.strokeRect(pad, ry, width - pad * 2, rowH);

        ctx.textBaseline = 'middle';
        ctx.font = `700 ${Math.round(20 * u)}px "Plus Jakarta Sans", sans-serif`;
        ctx.fillStyle = '#072A5E';
        ctx.fillText(k, pad + Math.round(18 * u), ry + rowH / 2);

        ctx.font = `600 ${Math.round(20 * u)}px "Manrope", sans-serif`;
        ctx.fillStyle = '#0F172A';
        const valText = wrapLines(ctx, v, width - pad * 2 - Math.round(260 * u), 1)[0] ?? v;
        ctx.fillText(valText, pad + Math.round(240 * u), ry + rowH / 2);
        ry += rowH;
      });
    } else {
      // Standard visual hero + mobile-readable bottom info plinth (covers 01, 03, 04, 05, 06, 07, 08)
      const bottomH = Math.round(height * (height > width ? 0.34 : 0.31));
      const stage = {
        x: pad,
        y: headerH + Math.round(20 * u),
        w: width - pad * 2,
        h: height - headerH - bottomH - Math.round(36 * u),
      };
      ctx.fillStyle = '#FFFFFF';
      drawRoundedRect(ctx, stage.x, stage.y, stage.w, stage.h, Math.round(14 * u));
      ctx.fill();
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = Math.max(1, 1.5 * u);
      ctx.stroke();

      if (productImg) {
        drawProductInStage({
          ctx,
          img: productImg,
          stage,
          studioConfig,
          u,
          isMacro: asset.slotIndex === 6,
          cleanWhiteMode: asset.slotIndex !== 7,
          targetOccupancy: 0.88,
        });
      }

      // Bottom high-contrast VUTECH Navy info block (zero off-platform contact!)
      const footY = height - bottomH;
      const fGrad = ctx.createLinearGradient(0, footY, width, height);
      fGrad.addColorStop(0, '#072A5E');
      fGrad.addColorStop(1, '#0B3B8C');
      ctx.fillStyle = fGrad;
      ctx.fillRect(0, footY, width, bottomH);
      ctx.fillStyle = '#009EE3';
      ctx.fillRect(0, footY, width, Math.round(5 * u));

      let ty = footY + Math.round(26 * u);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `800 ${Math.round(32 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      const slideHeading =
        asset.slotIndex === 1
          ? cleanName
          : `${asset.shortTitle.toUpperCase()} — ${cleanName}`;
      const headingLines = wrapLines(ctx, slideHeading, width - pad * 2, 2);
      for (const ln of headingLines) {
        ctx.fillText(ln, pad, ty);
        ty += Math.round(38 * u);
      }

      const bullets =
        userNoteLines.length > 0
          ? userNoteLines.slice(0, 3)
          : asset.slotIndex === 4
          ? cleanSpecs.length > 0
            ? cleanSpecs
            : ['Kết cấu chắc chắn, vật liệu chuyên dụng ngành xử lý nước']
          : asset.slotIndex === 7
          ? [
              `Ứng dụng: ${sanitizeShopeeText(safeCategory)}`,
              ...cleanSpecs.slice(0, 2),
            ]
          : cleanSpecs;

      ty += Math.round(8 * u);
      ctx.font = `600 ${Math.round(21 * u)}px "Manrope", sans-serif`;
      for (const item of bullets.slice(0, 3)) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(pad, ty + Math.round(9 * u), Math.round(14 * u), Math.round(4 * u));
        ctx.fillStyle = '#F8FAFC';
        const clipped = wrapLines(ctx, item, width - pad * 2 - Math.round(28 * u), 1)[0] ?? item;
        ctx.fillText(clipped, pad + Math.round(26 * u), ty);
        ty += Math.round(34 * u);
      }

      // Authentic VUTECH footer strip (NO Hotline / Website / QR per Shopee policy!)
      const barH = Math.round(44 * u);
      ctx.fillStyle = 'rgba(0, 12, 34, 0.45)';
      ctx.fillRect(0, height - barH, width, barH);
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(18 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText('CÔNG TY TNHH XNK VUTECH', pad, height - barH / 2);
      ctx.textAlign = 'right';
      ctx.font = `600 ${Math.round(17 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#7DD3FC';
      ctx.fillText('HÀNG CHÍNH HÃNG · ĐỒNG BỘ THÔNG SỐ KỸ THUẬT', width - pad, height - barH / 2);
    }

    return { width: fullW, height: fullH };
  }

  // =========================================================================
  // GROUP 03: WEB CLEAN (06 Minimalist E-Commerce Product Images)
  // =========================================================================
  if (groupId === '03_web_clean') {
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#FFFFFF');
    bg.addColorStop(1, '#F6F9FC');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    // Top thin VUTECH brand accent
    const barGrad = ctx.createLinearGradient(0, 0, width, 0);
    barGrad.addColorStop(0, '#0052B4');
    barGrad.addColorStop(1, '#009EE3');
    ctx.fillStyle = barGrad;
    ctx.fillRect(0, 0, width, Math.round(7 * u));

    const headerH = Math.round(86 * u);
    drawLogoFitted(ctx, fullLogo, pad, headerH / 2 + Math.round(4 * u), Math.round(215 * u), Math.round(46 * u), 'left', false, u);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#475569';
    ctx.fillText(`${safeModel}  ·  ${asset.shortTitle}`, width - pad, headerH / 2 + Math.round(4 * u));

    const isInfoSlide = asset.slotIndex === 5 || asset.slotIndex === 6;
    const footerH = isInfoSlide ? Math.round(210 * u) : Math.round(72 * u);
    const stage = {
      x: pad,
      y: headerH + Math.round(12 * u),
      w: width - pad * 2,
      h: height - headerH - footerH - Math.round(22 * u),
    };

    if (productImg) {
      drawProductInStage({
        ctx,
        img: productImg,
        stage,
        studioConfig,
        u,
        isMacro: asset.slotIndex === 4,
        cleanWhiteMode: asset.slotIndex !== 6,
        targetOccupancy: asset.slotIndex === 1 ? 0.88 : 0.86,
      });
    }

    if (settings.enableWatermark && iconLogo) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      const wmW = Math.round(stage.w * 0.34);
      const wmH = wmW * (iconLogo.height / Math.max(1, iconLogo.width));
      ctx.translate(stage.x + stage.w / 2, stage.y + stage.h / 2);
      ctx.rotate((-14 * Math.PI) / 180);
      ctx.drawImage(iconLogo, -wmW / 2, -wmH / 2, wmW, wmH);
      ctx.restore();
    }

    // Minimalist bottom strip or spec block
    const footY = height - footerH;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, footY, width, footerH);
    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(pad, footY, width - pad * 2, Math.max(1, 1.5 * u));

    if (isInfoSlide) {
      let y = footY + Math.round(22 * u);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `800 ${Math.round(30 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#0F172A';
      ctx.fillText(wrapLines(ctx, safeName, width - pad * 2, 1)[0] ?? safeName, pad, y);
      y += Math.round(42 * u);

      const cols = validSpecs.slice(0, 3);
      if (cols.length > 0) {
        const colW = (width - pad * 2) / cols.length;
        cols.forEach((sp, i) => {
          const cx = pad + i * colW;
          ctx.fillStyle = '#0052B4';
          ctx.fillRect(cx, y, Math.round(18 * u), Math.round(3.5 * u));
          ctx.font = `600 ${Math.round(19 * u)}px "Manrope", sans-serif`;
          ctx.fillStyle = '#1E293B';
          ctx.fillText(wrapLines(ctx, sp, colW - Math.round(16 * u), 1)[0] ?? sp, cx, y + Math.round(12 * u));
        });
      }

      const barH = Math.round(44 * u);
      ctx.fillStyle = '#072A5E';
      ctx.fillRect(0, height - barH, width, barH);
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(17 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(studioConfig.companyName || 'CÔNG TY TNHH XNK VUTECH', pad, height - barH / 2);
      ctx.textAlign = 'right';
      ctx.font = `600 ${Math.round(17 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#7DD3FC';
      ctx.fillText(companyContactLine || studioConfig.hotline, width - pad, height - barH / 2);
    } else {
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(20 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#0F172A';
      ctx.fillText(wrapLines(ctx, safeName, width * 0.62, 1)[0] ?? safeName, pad, footY + footerH / 2);
      ctx.textAlign = 'right';
      ctx.font = `600 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#0052B4';
      ctx.fillText(studioConfig.hotline || 'VUTECH', width - pad, footY + footerH / 2);
    }

    return { width: fullW, height: fullH };
  }

  // =========================================================================
  // GROUP 04: FACEBOOK ADS (05 Designs × 4 Auto-Reflowing Placements)
  // =========================================================================
  if (groupId === '04_facebook_ads') {
    const slideThemes: Record<number, { kicker: string; headlinePrefix: string }> = {
      1: { kicker: 'SẢN PHẨM CHỦ ĐẠO VUTECH', headlinePrefix: '' },
      2: { kicker: 'ƯU ĐIỂM & TÍNH NĂNG NỔI BẬT', headlinePrefix: '' },
      3: { kicker: 'HIỆU SUẤT VẬN HÀNH BỀN BỈ', headlinePrefix: '' },
      4: { kicker: 'ỨNG DỤNG THỰC TẾ & CUNG ỨNG', headlinePrefix: '' },
      5: { kicker: 'TƯ VẤN KỸ THUẬT & BÁO GIÁ', headlinePrefix: '' },
    };
    const theme = slideThemes[asset.slotIndex] ?? slideThemes[1];

    if (isLandscape) {
      // 1.91:1 (1200×628) crisp 2-column Facebook Link Ad layout
      const leftW = Math.round(width * 0.5);
      const lGrad = ctx.createLinearGradient(0, 0, leftW, height);
      lGrad.addColorStop(0, '#072A5E');
      lGrad.addColorStop(1, '#0052B4');
      ctx.fillStyle = lGrad;
      ctx.fillRect(0, 0, leftW, height);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(leftW - Math.round(5 * u), 0, Math.round(5 * u), height);

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(leftW, 0, width - leftW, height);

      const stage = { x: leftW + Math.round(24 * u), y: Math.round(24 * u), w: width - leftW - Math.round(48 * u), h: height - Math.round(48 * u) };
      if (productImg) {
        drawProductInStage({ ctx, img: productImg, stage, studioConfig, u, cleanWhiteMode: false, targetOccupancy: 0.9 });
      }

      const lp = Math.round(44 * u);
      const maxTW = leftW - lp * 2;
      drawLogoFitted(ctx, fullLogo, lp, Math.round(74 * u), Math.round(250 * u), Math.round(64 * u), 'left', true, u);

      let cy = Math.round(145 * u);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `700 ${Math.round(24 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#7DD3FC';
      ctx.fillText(theme.kicker, lp, cy);
      cy += Math.round(40 * u);

      ctx.font = `800 ${Math.round(46 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      for (const ln of wrapLines(ctx, safeName, maxTW, 2)) {
        ctx.fillText(ln, lp, cy);
        cy += Math.round(54 * u);
      }

      cy += Math.round(16 * u);
      ctx.font = `600 ${Math.round(25 * u)}px "Manrope", sans-serif`;
      for (const sp of validSpecs.slice(0, 3)) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(lp, cy + Math.round(11 * u), Math.round(14 * u), Math.round(4 * u));
        ctx.fillStyle = '#F8FAFC';
        ctx.fillText(wrapLines(ctx, sp, maxTW - Math.round(28 * u), 1)[0] ?? sp, lp + Math.round(26 * u), cy);
        cy += Math.round(42 * u);
      }

      // Configured corporate contact CTA
      const ctaY = height - Math.round(92 * u);
      ctx.fillStyle = 'rgba(0, 12, 34, 0.38)';
      ctx.fillRect(0, ctaY, leftW - Math.round(5 * u), height - ctaY);
      ctx.textBaseline = 'middle';
      ctx.font = `700 ${Math.round(23 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#7DD3FC';
      ctx.fillText(companyContactLine || studioConfig.hotline, lp, ctaY + (height - ctaY) / 2);

      return { width: fullW, height: fullH };
    }

    // Portrait / Square / Stories (4:5, 1:1, 9:16) with Meta Safe Zones
    ctx.fillStyle = '#F8FAFC';
    ctx.fillRect(0, 0, width, height);

    const topMetaSafe = isStories ? Math.round(height * 0.12) : 0;
    const bottomMetaSafe = isStories ? Math.round(height * 0.14) : 0;
    const headerH = Math.round(112 * u) + topMetaSafe;
    const footerH = Math.round((isStories ? 320 : 280) * u) + bottomMetaSafe;

    // Header gradient bar
    const hGrad = ctx.createLinearGradient(0, 0, width, 0);
    hGrad.addColorStop(0, '#072A5E');
    hGrad.addColorStop(0.6, '#0052B4');
    hGrad.addColorStop(1, '#0284C7');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, width, headerH);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(0, headerH - Math.round(5 * u), width, Math.round(5 * u));

    const headerCenterY = topMetaSafe + Math.round(56 * u);
    drawLogoFitted(ctx, fullLogo, pad, headerCenterY, Math.round(250 * u), Math.round(58 * u), 'left', true, u);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(19 * u)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#E0F2FE';
    ctx.fillText(theme.kicker, width - pad, headerCenterY - Math.round(12 * u));
    ctx.font = `600 ${Math.round(17 * u)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#93C5FD';
    ctx.fillText(`Model: ${safeModel}`, width - pad, headerCenterY + Math.round(14 * u));

    // Product Stage
    const stage = {
      x: pad,
      y: headerH + Math.round(18 * u),
      w: width - pad * 2,
      h: Math.max(height * 0.35, height - headerH - footerH - Math.round(30 * u)),
    };
    if (productImg) {
      drawProductInStage({ ctx, img: productImg, stage, studioConfig, u, cleanWhiteMode: false, targetOccupancy: 0.88 });
    }

    // Bottom Promo Info Band
    const footY = height - footerH;
    const fGrad = ctx.createLinearGradient(0, footY, width, height);
    fGrad.addColorStop(0, '#072A5E');
    fGrad.addColorStop(1, '#0B3B8C');
    ctx.fillStyle = fGrad;
    ctx.fillRect(0, footY, width, footerH);
    ctx.fillStyle = '#009EE3';
    ctx.fillRect(0, footY, width, Math.round(5 * u));

    let y = footY + Math.round(24 * u);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `800 ${Math.round(35 * u)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    for (const ln of wrapLines(ctx, safeName, width - pad * 2, 2)) {
      ctx.fillText(ln, pad, y);
      y += Math.round(42 * u);
    }

    if (studioConfig.tagline) {
      ctx.font = `500 ${Math.round(20 * u)}px "Manrope", sans-serif`;
      ctx.fillStyle = '#BAE6FD';
      ctx.fillText(wrapLines(ctx, studioConfig.tagline, width - pad * 2, 1)[0] ?? '', pad, y + Math.round(2 * u));
      y += Math.round(32 * u);
    }

    y += Math.round(6 * u);
    ctx.font = `600 ${Math.round(21 * u)}px "Manrope", sans-serif`;
    for (const sp of validSpecs.slice(0, 3)) {
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(pad, y + Math.round(9 * u), Math.round(14 * u), Math.round(4 * u));
      ctx.fillStyle = '#F8FAFC';
      ctx.fillText(wrapLines(ctx, sp, width - pad * 2 - Math.round(28 * u), 1)[0] ?? sp, pad + Math.round(26 * u), y);
      y += Math.round(34 * u);
    }

    // Contact Strip (strictly positioned above Stories bottom CTA safe zone!)
    const contactBarH = Math.round(52 * u);
    const contactBarY = height - bottomMetaSafe - contactBarH;
    ctx.fillStyle = 'rgba(0, 12, 34, 0.48)';
    ctx.fillRect(0, contactBarY, width, contactBarH);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(18 * u)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(studioConfig.companyName || 'CÔNG TY TNHH XNK VUTECH', pad, contactBarY + contactBarH / 2);
    ctx.textAlign = 'right';
    ctx.font = `600 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#7DD3FC';
    ctx.fillText(companyContactLine || studioConfig.hotline, width - pad, contactBarY + contactBarH / 2);

    return { width: fullW, height: fullH };
  }

  // =========================================================================
  // GROUP 05: INDUSTRIAL TECHNICAL (06 Engineering Blueprint Slides — 4:3 / 16:9)
  // =========================================================================
  if (groupId === '05_industrial_tech') {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
    bgGrad.addColorStop(0, '#0A2246');
    bgGrad.addColorStop(1, '#06142B');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // Subtle engineering blueprint grid
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 197, 255, 0.08)';
    ctx.lineWidth = Math.max(1, 1 * u);
    const step = Math.round(44 * u);
    for (let gx = 0; gx < width; gx += step) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, height);
      ctx.stroke();
    }
    for (let gy = 0; gy < height; gy += step) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(width, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Top Technical Title Block
    const headerH = Math.round(98 * u);
    ctx.fillStyle = 'rgba(4, 15, 34, 0.72)';
    ctx.fillRect(0, 0, width, headerH);
    ctx.fillStyle = '#009EE3';
    ctx.fillRect(0, headerH - Math.round(3 * u), width, Math.round(3 * u));

    drawLogoFitted(ctx, fullLogo, pad, headerH / 2, Math.round(240 * u), Math.round(54 * u), 'left', true, u);

    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(22 * u)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`HỒ SƠ KỸ THUẬT · ${asset.shortTitle.toUpperCase()}`, width - pad, headerH / 2 - Math.round(13 * u));
    ctx.font = `600 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#7DD3FC';
    ctx.fillText(`MODEL: ${safeModel}  |  TRANG 0${asset.slotIndex}/06`, width - pad, headerH / 2 + Math.round(15 * u));

    // Two-column technical datasheet layout: Left Engineering Specs / Right Clean Product/Drawing Frame
    const footerH = Math.round(54 * u);
    const bodyTop = headerH + Math.round(26 * u);
    const bodyH = height - bodyTop - footerH - Math.round(24 * u);
    const leftColW = Math.round((width - pad * 2) * 0.44);
    const rightColX = pad + leftColW + Math.round(28 * u);
    const rightColW = width - rightColX - pad;

    // Right bright engineering stage panel
    const stage = { x: rightColX, y: bodyTop, w: rightColW, h: bodyH };
    ctx.save();
    drawRoundedRect(ctx, stage.x, stage.y, stage.w, stage.h, Math.round(14 * u));
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)';
    ctx.lineWidth = Math.max(1.5, 2 * u);
    ctx.stroke();
    ctx.restore();

    if (productImg) {
      drawProductInStage({
        ctx,
        img: productImg,
        stage: { x: stage.x + Math.round(14 * u), y: stage.y + Math.round(14 * u), w: stage.w - Math.round(28 * u), h: stage.h - Math.round(28 * u) },
        studioConfig,
        u,
        cleanWhiteMode: true,
        targetOccupancy: 0.9,
      });
    }

    // Left engineering specifications panel
    let cy = bodyTop;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${Math.round(19 * u)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#38BDF8';
    ctx.fillText(safeCategory.toUpperCase(), pad, cy);
    cy += Math.round(32 * u);

    ctx.font = `800 ${Math.round(36 * u)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    for (const ln of wrapLines(ctx, safeName, leftColW, 3)) {
      ctx.fillText(ln, pad, cy);
      cy += Math.round(44 * u);
    }

    cy += Math.round(14 * u);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.fillRect(pad, cy, leftColW, Math.max(1.5, 2 * u));
    cy += Math.round(22 * u);

    const customLines = (asset.customTechnicalNotes ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const displayRows = customLines.length > 0 ? customLines : validSpecs;

    ctx.font = `700 ${Math.round(20 * u)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#BAE6FD';
    ctx.fillText(asset.title.toUpperCase(), pad, cy);
    cy += Math.round(36 * u);

    ctx.font = `600 ${Math.round(22 * u)}px "JetBrains Mono", monospace`;
    for (const row of displayRows.slice(0, 7)) {
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(pad, cy + Math.round(10 * u), Math.round(12 * u), Math.round(4 * u));
      ctx.fillStyle = '#F8FAFC';
      for (const wrapped of wrapLines(ctx, row, leftColW - Math.round(26 * u), 2)) {
        ctx.fillText(wrapped, pad + Math.round(22 * u), cy);
        cy += Math.round(32 * u);
      }
      cy += Math.round(8 * u);
    }

    // Bottom technical footer bar
    ctx.fillStyle = '#040F22';
    ctx.fillRect(0, height - footerH, width, footerH);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.fillRect(0, height - footerH, width, Math.max(1.5, 2 * u));
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `700 ${Math.round(18 * u)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(studioConfig.companyName || 'CÔNG TY TNHH XNK VUTECH', pad, height - footerH / 2);
    ctx.textAlign = 'right';
    ctx.font = `600 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
    ctx.fillStyle = '#7DD3FC';
    ctx.fillText(companyContactLine || studioConfig.hotline, width - pad, height - footerH / 2);

    return { width: fullW, height: fullH };
  }

  // =========================================================================
  // GROUP 06: MINIMAL LUXURY (03 High-Contrast Obsidian Navy + Champagne Gold Slides)
  // =========================================================================
  const headerH = Math.round(98 * u);
  const footerH = Math.round((aspect < 0.7 ? 290 : 242) * u);

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Top Obsidian & Gold editorial accent
  ctx.fillStyle = '#0B162C';
  ctx.fillRect(0, 0, width, Math.round(6 * u));
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(pad, headerH - Math.round(2 * u), width - pad * 2, Math.max(1.5, 2 * u));

  drawLogoFitted(ctx, fullLogo, pad, headerH / 2 + Math.round(3 * u), Math.round(250 * u), Math.round(54 * u), 'left', false, u);

  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(20 * u)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = '#0B162C';
  ctx.fillText(safeCategory, width - pad, headerH / 2 - Math.round(12 * u));
  ctx.font = `700 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = '#9A6F22';
  ctx.fillText(`Model: ${safeModel} · ${asset.shortTitle}`, width - pad, headerH / 2 + Math.round(15 * u));

  // Gallery white product frame
  const stage = {
    x: pad,
    y: headerH + Math.round(18 * u),
    w: width - pad * 2,
    h: height - headerH - footerH - Math.round(32 * u),
  };
  ctx.save();
  drawRoundedRect(ctx, stage.x, stage.y, stage.w, stage.h, Math.round(12 * u));
  const stGrad = ctx.createLinearGradient(stage.x, stage.y, stage.x, stage.y + stage.h);
  stGrad.addColorStop(0, '#FFFFFF');
  stGrad.addColorStop(1, '#F7F9FC');
  ctx.fillStyle = stGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.lineWidth = Math.max(1.5, 1.5 * u);
  ctx.stroke();
  ctx.restore();

  if (productImg) {
    drawProductInStage({
      ctx,
      img: productImg,
      stage,
      studioConfig,
      u,
      isMacro: asset.slotIndex === 3,
      cleanWhiteMode: true,
      targetOccupancy: 0.88,
    });
  }

  // Obsidian Navy + Champagne Gold high-contrast bottom plinth
  const footY = height - footerH;
  const luxGrad = ctx.createLinearGradient(0, footY, width, height);
  luxGrad.addColorStop(0, '#0B162C');
  luxGrad.addColorStop(1, '#14294A');
  ctx.fillStyle = luxGrad;
  ctx.fillRect(0, footY, width, footerH);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(0, footY, width, Math.round(4.5 * u));

  let ly = footY + Math.round(24 * u);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = `800 ${Math.round(34 * u)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  for (const ln of wrapLines(ctx, safeName, width - pad * 2, 2)) {
    ctx.fillText(ln, pad, ly);
    ly += Math.round(40 * u);
  }

  if (studioConfig.tagline) {
    ctx.font = `500 ${Math.round(20 * u)}px "Manrope", sans-serif`;
    ctx.fillStyle = '#DBEAFE';
    ctx.fillText(wrapLines(ctx, studioConfig.tagline, width - pad * 2, 1)[0] ?? '', pad, ly + Math.round(2 * u));
    ly += Math.round(30 * u);
  }

  if (validSpecs.length > 0) {
    const colW = (width - pad * 2) / validSpecs.length;
    const specY = ly + Math.round(8 * u);
    validSpecs.forEach((sp, idx) => {
      const cx = pad + idx * colW;
      if (idx > 0) {
        ctx.fillStyle = 'rgba(212, 175, 55, 0.32)';
        ctx.fillRect(cx - Math.round(10 * u), specY, Math.max(1, 1.5 * u), Math.round(36 * u));
      }
      ctx.fillStyle = '#E5C158';
      ctx.fillRect(cx, specY + Math.round(4 * u), Math.round(20 * u), Math.round(3.5 * u));
      ctx.font = `600 ${Math.round(19 * u)}px "Manrope", sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(wrapLines(ctx, sp, colW - Math.round(20 * u), 1)[0] ?? sp, cx, specY + Math.round(15 * u));
    });
  }

  const contactBarH = Math.round(48 * u);
  const barY = height - contactBarH;
  ctx.fillStyle = '#060D1C';
  ctx.fillRect(0, barY, width, contactBarH);
  ctx.fillStyle = 'rgba(212, 175, 55, 0.42)';
  ctx.fillRect(0, barY, width, Math.max(1, 1.5 * u));
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 ${Math.round(18 * u)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(studioConfig.companyName || 'CÔNG TY TNHH XNK VUTECH', pad, barY + contactBarH / 2);
  ctx.textAlign = 'right';
  ctx.font = `600 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
  ctx.fillStyle = '#F6DC8C';
  ctx.fillText(companyContactLine || studioConfig.hotline, width - pad, barY + contactBarH / 2);

  return { width: fullW, height: fullH };
}

/**
 * Single-pass encoder with clean size optimization (never re-encodes compressed output).
 */
export async function encodeCanvasWithLimit(params: {
  canvas: HTMLCanvasElement;
  format: OutputFileFormat;
  initialQuality: number;
  maxFileSizeKB: number | null;
}): Promise<{ blob: Blob; dataUrl: string; format: OutputFileFormat; mimeType: string; hitQualityFloor: boolean }> {
  const { canvas, format, initialQuality, maxFileSizeKB } = params;

  const targetFmt: OutputFileFormat = format === 'pdf' ? 'png' : format;
  const mimeMap: Record<'jpg' | 'png' | 'webp', string> = {
    jpg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  };

  const toBlobAsync = (mime: string, q?: number) =>
    new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Không thể mã hóa dữ liệu ảnh'))),
        mime,
        q
      );
    });

  const blobToDataUrl = (b: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh'));
      reader.readAsDataURL(b);
    });

  let chosenFormat = targetFmt as 'jpg' | 'png' | 'webp';
  let mime = mimeMap[chosenFormat];
  let blob = await toBlobAsync(mime, chosenFormat === 'png' ? undefined : initialQuality);
  let hitQualityFloor = false;

  if (maxFileSizeKB && blob.size > maxFileSizeKB * 1024) {
    // Switch PNG to JPEG if PNG exceeds strict platform limit (e.g. Shopee <= 2MB) while keeping full pixel dimensions
    const optFormat: 'jpg' | 'webp' = chosenFormat === 'webp' ? 'webp' : 'jpg';
    chosenFormat = optFormat;
    mime = mimeMap[optFormat];
    const qualitySteps = [Math.min(0.92, initialQuality), 0.86, 0.8, 0.74, 0.68, 0.62];
    for (const q of qualitySteps) {
      blob = await toBlobAsync(mime, q);
      if (blob.size <= maxFileSizeKB * 1024) {
        break;
      }
    }
    if (blob.size > maxFileSizeKB * 1024) {
      hitQualityFloor = true;
    }
  }

  const dataUrl = await blobToDataUrl(blob);
  return {
    blob,
    dataUrl,
    format: chosenFormat,
    mimeType: blob.type || mime,
    hitQualityFloor,
  };
}
