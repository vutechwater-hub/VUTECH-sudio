import { getExportDimensions, VUTECH_LOGOS } from '../constants/vutech';
import type { BackdropPreset, ExportFormat, StudioConfig } from '../types/studio';

const imageCache = new Map<string, Promise<HTMLImageElement>>();
const processedLogoCache = new Map<string, HTMLCanvasElement>();

export function loadImage(src: string): Promise<HTMLImageElement> {
  if (!src) {
    return Promise.reject(new Error('Empty image URL'));
  }
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Không thể tải ảnh nguồn'));
      img.src = src;
    });
  }
  const existing = imageCache.get(src);
  if (existing) return existing;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => {
      imageCache.delete(src);
      reject(new Error(`Không thể tải ảnh: ${src}`));
    };
    img.src = src;
  });
  imageCache.set(src, promise);
  return promise;
}

/**
 * Removes pure/near-white neutral background pixels from VUTECH PNG logos
 * while preserving the rich blue/cyan gradients and smooth anti-aliased edges.
 */
function getProcessedLogo(
  img: HTMLImageElement,
  cacheKey: string,
  removeBg: boolean
): HTMLCanvasElement | HTMLImageElement {
  if (!removeBg) return img;
  const cached = processedLogoCache.get(cacheKey);
  if (cached) return cached;

  const off = document.createElement('canvas');
  off.width = img.naturalWidth || img.width;
  off.height = img.naturalHeight || img.height;
  const octx = off.getContext('2d', { willReadFrequently: true });
  if (!octx) return img;

  octx.drawImage(img, 0, 0);
  try {
    const imgData = octx.getImageData(0, 0, off.width, off.height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      if (a === 0) continue;

      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      const chroma = maxC - minC;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;

      // Pure/near-white neutral pixels become transparent with smooth edge feathering
      if (luma > 242 && chroma < 18) {
        data[i + 3] = 0;
      } else if (luma > 218 && chroma < 24) {
        const factor = Math.max(0, Math.min(1, (242 - luma) / 24));
        data[i + 3] = Math.round(a * factor * factor);
      }
    }

    octx.putImageData(imgData, 0, 0);
    processedLogoCache.set(cacheKey, off);
    return off;
  } catch {
    return img;
  }
}

function getBackdropColors(backdrop: BackdropPreset): {
  top: string;
  bottom: string;
  radial: string;
  isDark: boolean;
} {
  switch (backdrop) {
    case 'vutech-ice':
      return {
        top: '#F4F9FF',
        bottom: '#E2EFFD',
        radial: 'rgba(0, 158, 227, 0.10)',
        isDark: false,
      };
    case 'studio-gray':
      return {
        top: '#F7F8FA',
        bottom: '#E6EAF0',
        radial: 'rgba(255, 255, 255, 0.85)',
        isDark: false,
      };
    case 'deep-navy':
      return {
        top: '#0A2246',
        bottom: '#06142B',
        radial: 'rgba(0, 158, 227, 0.22)',
        isDark: true,
      };
    case 'pure-white':
    default:
      return {
        top: '#FFFFFF',
        bottom: '#F5F8FC',
        radial: 'rgba(0, 82, 180, 0.05)',
        isDark: false,
      };
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let current = words[0];

  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length === maxLines - 1) {
        // Append remaining words and truncate if needed
        const rest = words.slice(i).join(' ');
        let clipped = rest;
        while (ctx.measureText(clipped).width > maxWidth && clipped.length > 4) {
          clipped = `${clipped.slice(0, -2).trimEnd()}…`;
        }
        lines.push(clipped);
        return lines;
      }
    }
  }
  lines.push(current);
  return lines.slice(0, maxLines);
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Lightweight sharpening convolution pass for high-clarity product photography.
 */
function applyUnsharpToRegion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  strength: number
) {
  if (strength <= 0 || w < 4 || h < 4) return;
  const rx = Math.max(0, Math.floor(x));
  const ry = Math.max(0, Math.floor(y));
  const rw = Math.min(ctx.canvas.width - rx, Math.floor(w));
  const rh = Math.min(ctx.canvas.height - ry, Math.floor(h));
  if (rw < 4 || rh < 4) return;

  // Keep interactive preview responsive on very large canvases
  if (rw * rh > 2200 * 2200) return;

  try {
    const src = ctx.getImageData(rx, ry, rw, rh);
    const dst = ctx.createImageData(rw, rh);
    const s = src.data;
    const d = dst.data;
    const amt = (strength / 100) * 0.55;

    for (let row = 1; row < rh - 1; row++) {
      for (let col = 1; col < rw - 1; col++) {
        const idx = (row * rw + col) * 4;
        const up = ((row - 1) * rw + col) * 4;
        const dn = ((row + 1) * rw + col) * 4;
        const lf = (row * rw + col - 1) * 4;
        const rt = (row * rw + col + 1) * 4;

        for (let c = 0; c < 3; c++) {
          const avg = (s[up + c] + s[dn + c] + s[lf + c] + s[rt + c]) * 0.25;
          const val = s[idx + c] + (s[idx + c] - avg) * amt * 2.2;
          d[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
        }
        d[idx + 3] = s[idx + 3];
      }
    }

    // Copy border pixels unchanged
    for (let col = 0; col < rw; col++) {
      const top = col * 4;
      const bot = ((rh - 1) * rw + col) * 4;
      for (let c = 0; c < 4; c++) {
        d[top + c] = s[top + c];
        d[bot + c] = s[bot + c];
      }
    }
    for (let row = 0; row < rh; row++) {
      const left = row * rw * 4;
      const right = (row * rw + rw - 1) * 4;
      for (let c = 0; c < 4; c++) {
        d[left + c] = s[left + c];
        d[right + c] = s[right + c];
      }
    }

    ctx.putImageData(dst, rx, ry);
  } catch {
    // Gracefully skip if tainted
  }
}

export interface RenderOptions {
  targetWidth?: number;
  targetHeight?: number;
  applySharpen?: boolean;
  showSubjectGuide?: boolean;
}

/**
 * Recommends the most balanced standard aspect ratio for a water filtration product
 * based on the real physical proportions of its AI-detected subject region.
 */
export function recommendAspectRatioForSubject(
  naturalWidth: number,
  naturalHeight: number,
  subjectBox: { x: number; y: number; w: number; h: number }
): StudioConfig['aspectRatio'] {
  const subjW = Math.max(1, naturalWidth * Math.max(0.15, subjectBox.w));
  const subjH = Math.max(1, naturalHeight * Math.max(0.15, subjectBox.h));
  const ratio = subjW / subjH;

  if (ratio < 0.62) return '2:3';
  if (ratio < 0.84) return '3:4';
  if (ratio <= 1.18) return '1:1';
  if (ratio <= 1.48) return '4:3';
  return '16:9';
}

export async function renderStudioCanvas(
  canvas: HTMLCanvasElement,
  config: StudioConfig,
  options: RenderOptions = {}
): Promise<{ width: number; height: number }> {
  const fullDims = getExportDimensions(config.aspectRatio, config.resolution);
  const width = options.targetWidth ?? fullDims.width;
  const height = options.targetHeight ?? fullDims.height;

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return { width, height };

  const minSide = Math.min(width, height);
  const u = minSide / 1000; // normalized design unit
  const aspect = width / height;
  const isWide = aspect >= 1.55;
  const isTall = aspect <= 0.65;

  const [productImg, fullLogoImg, iconLogoImg] = await Promise.all([
    loadImage(config.sourceImageUrl).catch(() => null),
    loadImage(VUTECH_LOGOS.full).catch(() => null),
    loadImage(VUTECH_LOGOS.icon).catch(() => null),
  ]);

  const fullLogo = fullLogoImg
    ? getProcessedLogo(fullLogoImg, 'full', config.removeLogoBg)
    : null;
  const iconLogo = iconLogoImg
    ? getProcessedLogo(iconLogoImg, 'icon', config.removeLogoBg)
    : null;

  const activeLogo =
    config.logoMode === 'icon' || config.logoMode === 'icon-and-watermark'
      ? iconLogo ?? fullLogo
      : fullLogo ?? iconLogo;

  const isShopeeCover = config.template === 'shopee-cover';
  const isShopeeDetail = config.template === 'shopee-detail';
  const isShopeeTemplate = isShopeeCover || isShopeeDetail;
  const isMinimalLuxury = config.template === 'minimal-luxury';

  const showWatermark =
    !isShopeeCover &&
    (config.logoMode === 'full-and-watermark' ||
      config.logoMode === 'icon-and-watermark' ||
      config.template === 'watermark-protect');

  // 1. Background Studio Canvas
  const effectiveBackdrop: BackdropPreset =
    config.template === 'industrial-tech'
      ? 'deep-navy'
      : isShopeeTemplate || isMinimalLuxury
      ? 'pure-white'
      : config.backdrop;
  const backdrop = getBackdropColors(effectiveBackdrop);
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, isShopeeCover ? '#FFFFFF' : backdrop.top);
  bgGrad.addColorStop(1, isShopeeCover ? '#FAFCFF' : backdrop.bottom);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle architectural radial highlight behind product stage
  const radCenterX = isWide ? width * 0.72 : width * 0.5;
  const radCenterY = isWide ? height * 0.5 : height * 0.44;
  const radGrad = ctx.createRadialGradient(
    radCenterX,
    radCenterY,
    minSide * 0.04,
    radCenterX,
    radCenterY,
    minSide * 0.65
  );
  radGrad.addColorStop(0, backdrop.radial);
  radGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = radGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle blueprint grid for industrial-tech template
  if (config.template === 'industrial-tech') {
    ctx.save();
    ctx.strokeStyle = 'rgba(148, 197, 255, 0.07)';
    ctx.lineWidth = Math.max(1, 1 * u);
    const step = Math.round(48 * u);
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
  }

  // 2. Compute Layout Zones based on Template & Aspect Ratio
  const pad = Math.round(42 * u);
  const isWatermarkOnly = config.template === 'watermark-protect';

  let stageRect = { x: 0, y: 0, w: width, h: height };
  let headerH = 0;
  let footerH = 0;

  if (isWatermarkOnly) {
    stageRect = { x: 0, y: 0, w: width, h: height };
  } else if (isShopeeCover) {
    // Official Shopee Seller Education Cover Safe Zone:
    // Top ~13% reserved for compact brand mark centered (clear of top-left Mall & top-right % discount tags),
    // Bottom ~22% keeps both the optional 1-line title (77%–82%) AND Shopee's Freeship/Voucher bar (83.5%–100%) 100% collision-free.
    const topSafe = Math.round(height * 0.13);
    const bottomSafe = config.showSpecsPanel ? Math.round(height * 0.235) : Math.round(height * 0.175);
    const sideSafe = Math.round(width * 0.065);
    stageRect = {
      x: sideSafe,
      y: topSafe,
      w: width - sideSafe * 2,
      h: Math.max(height * 0.56, height - topSafe - bottomSafe),
    };
  } else if (isWide) {
    // 2-column horizontal banner layout (16:9, 21:9)
    const infoColW = Math.round(width * (aspect > 2 ? 0.42 : 0.45));
    stageRect = {
      x: infoColW + Math.round(16 * u),
      y: Math.round(32 * u),
      w: width - infoColW - Math.round(48 * u),
      h: height - Math.round(64 * u),
    };
  } else {
    headerH =
      config.template === 'facebook-promo'
        ? Math.round(118 * u)
        : config.template === 'industrial-tech'
        ? Math.round(104 * u)
        : isShopeeDetail
        ? Math.round(98 * u)
        : isMinimalLuxury
        ? Math.round(98 * u)
        : Math.round(96 * u);

    const hasBottomInfo =
      isShopeeDetail || config.showSpecsPanel || config.showContactFooter;
    if (hasBottomInfo) {
      if (isMinimalLuxury) {
        footerH = Math.round((isTall ? 286 : 238) * u);
      } else if (isShopeeDetail) {
        footerH = Math.round((isTall ? 300 : 248) * u);
      } else if (config.template === 'facebook-promo') {
        footerH = Math.round((isTall ? 310 : 258) * u);
      } else if (config.template === 'industrial-tech') {
        footerH = Math.round((isTall ? 290 : 244) * u);
      } else {
        footerH = Math.round((isTall ? 265 : 220) * u);
      }
    } else {
      footerH = Math.round(36 * u);
    }

    stageRect = {
      x: pad,
      y: headerH + Math.round(14 * u),
      w: width - pad * 2,
      h: Math.max(height * 0.35, height - headerH - footerH - Math.round(24 * u)),
    };
  }

  // Draw architectural product stage frame on industrial-tech and minimal-luxury
  if ((config.template === 'industrial-tech' || isMinimalLuxury) && !isWatermarkOnly) {
    ctx.save();
    const radius = isMinimalLuxury ? Math.round(12 * u) : Math.round(18 * u);
    drawRoundedRect(ctx, stageRect.x, stageRect.y, stageRect.w, stageRect.h, radius);
    const stageGrad = ctx.createLinearGradient(
      stageRect.x,
      stageRect.y,
      stageRect.x,
      stageRect.y + stageRect.h
    );
    stageGrad.addColorStop(0, '#FFFFFF');
    stageGrad.addColorStop(1, isMinimalLuxury ? '#F7F9FC' : '#EEF4FB');
    ctx.fillStyle = stageGrad;
    ctx.fill();
    ctx.strokeStyle = isMinimalLuxury
      ? 'rgba(148, 163, 184, 0.42)'
      : 'rgba(0, 158, 227, 0.35)';
    ctx.lineWidth = Math.max(1.25, (isMinimalLuxury ? 1.5 : 2) * u);
    ctx.stroke();
    ctx.restore();
  }

  // 3. Draw Product Image inside stageRect with Adaptive Background Extension & Subject-Preserving Background Blur
  if (productImg) {
    ctx.save();
    if (!isWatermarkOnly) {
      drawRoundedRect(
        ctx,
        stageRect.x,
        stageRect.y,
        stageRect.w,
        stageRect.h,
        config.template === 'industrial-tech' ? Math.round(18 * u) : Math.round(12 * u)
      );
      ctx.clip();
    }

    const imgAspect = productImg.naturalWidth / Math.max(1, productImg.naturalHeight);
    const stageAspect = stageRect.w / Math.max(1, stageRect.h);
    const colorFilter = `brightness(${config.brightness}%) contrast(${config.contrast}%) saturate(${config.saturation}%)`;

    // 3A. Seamless Adaptive Background Extension (Outpaint Fill)
    // Automatically expands the photo's ambient background to fill any requested aspect ratio (1:1, 3:4, 16:9, 21:9, 9:16)
    const shouldExtendBg = config.extendBackground || config.backgroundBlurEnabled;
    if (shouldExtendBg) {
      let coverW = stageRect.w;
      let coverH = stageRect.h;
      if (imgAspect > stageAspect) {
        coverH = stageRect.h * 1.14;
        coverW = coverH * imgAspect;
      } else {
        coverW = stageRect.w * 1.14;
        coverH = coverW / imgAspect;
      }
      const coverX = stageRect.x + (stageRect.w - coverW) / 2;
      const coverY = stageRect.y + (stageRect.h - coverH) / 2;

      const effectiveBlurPx = config.backgroundBlurEnabled
        ? Math.max(4, Math.round(config.backgroundBlurAmount * u * 1.35))
        : Math.max(14, Math.round(24 * u));

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Gently lift ambient background brightness & lower contrast slightly so the sharp foreground equipment pops
      ctx.filter = `blur(${effectiveBlurPx}px) brightness(${Math.min(118, config.brightness + 4)}%) contrast(${Math.max(86, config.contrast - 6)}%) saturate(${Math.max(85, config.saturation - 6)}%)`;
      ctx.drawImage(productImg, coverX, coverY, coverW, coverH);
      ctx.filter = 'none';

      // Subtle atmospheric studio wash to unify the extended edges
      const washGrad = ctx.createRadialGradient(
        stageRect.x + stageRect.w * 0.5,
        stageRect.y + stageRect.h * 0.48,
        Math.min(stageRect.w, stageRect.h) * 0.18,
        stageRect.x + stageRect.w * 0.5,
        stageRect.y + stageRect.h * 0.5,
        Math.max(stageRect.w, stageRect.h) * 0.72
      );
      washGrad.addColorStop(0, 'rgba(255, 255, 255, 0.04)');
      washGrad.addColorStop(
        1,
        backdrop.isDark ? 'rgba(6, 20, 43, 0.34)' : 'rgba(241, 246, 252, 0.28)'
      );
      ctx.fillStyle = washGrad;
      ctx.fillRect(stageRect.x, stageRect.y, stageRect.w, stageRect.h);
      ctx.restore();
    }

    // 3B. Compute Product Placement Geometry (with AI Auto-Framing onto real subject region)
    const innerPad =
      config.fitMode === 'cover' || isWatermarkOnly
        ? 0
        : shouldExtendBg
        ? Math.round(14 * u)
        : Math.round(20 * u);
    const availW = Math.max(10, stageRect.w - innerPad * 2);
    const availH = Math.max(10, stageRect.h - innerPad * 2);
    const boxAspect = availW / availH;

    const sBox = config.subjectBox ?? { x: 0.12, y: 0.08, w: 0.76, h: 0.84 };
    const safeSubjW = Math.max(0.2, Math.min(1, sBox.w));
    const safeSubjH = Math.max(0.2, Math.min(1, sBox.h));

    let drawW = availW;
    let drawH = availH;
    let drawX = stageRect.x;
    let drawY = stageRect.y;

    if (config.autoFrameSubject && config.fitMode === 'contain') {
      // Scale the original image so the REAL detected product region fills ~88% of the hero stage
      const targetSubjMaxW = availW * 0.88;
      const targetSubjMaxH = availH * 0.88;
      const subjPixelW = productImg.naturalWidth * safeSubjW;
      const subjPixelH = productImg.naturalHeight * safeSubjH;
      const fitScale = Math.min(
        targetSubjMaxW / Math.max(1, subjPixelW),
        targetSubjMaxH / Math.max(1, subjPixelH)
      );

      drawW = productImg.naturalWidth * fitScale * config.productScale;
      drawH = productImg.naturalHeight * fitScale * config.productScale;

      // Center the detected subject center right in the middle of stageRect, plus user's fine pan offsets
      const subjCenterNormX = sBox.x + safeSubjW / 2;
      const subjCenterNormY = sBox.y + safeSubjH / 2;
      const offsetX = (config.productOffsetX / 100) * stageRect.w;
      const offsetY = (config.productOffsetY / 100) * stageRect.h;

      drawX = stageRect.x + stageRect.w / 2 - subjCenterNormX * drawW + offsetX;
      drawY = stageRect.y + stageRect.h / 2 - subjCenterNormY * drawH + offsetY;
    } else {
      if (config.fitMode === 'cover') {
        if (imgAspect > boxAspect) {
          drawH = availH;
          drawW = availH * imgAspect;
        } else {
          drawW = availW;
          drawH = availW / imgAspect;
        }
      } else {
        if (imgAspect > boxAspect) {
          drawW = availW;
          drawH = availW / imgAspect;
        } else {
          drawH = availH;
          drawW = availH * imgAspect;
        }
      }

      drawW *= config.productScale;
      drawH *= config.productScale;

      const offsetX = (config.productOffsetX / 100) * stageRect.w;
      const offsetY = (config.productOffsetY / 100) * stageRect.h;

      drawX = stageRect.x + (stageRect.w - drawW) / 2 + offsetX;
      drawY = stageRect.y + (stageRect.h - drawH) / 2 + offsetY;
    }

    // 3C. Draw Sharp Foreground Product Layer
    if (shouldExtendBg) {
      // Composite onto an offscreen canvas with soft subject-focus & edge-dissolve alpha mask
      // so the product stays razor-sharp while surrounding background smoothly melts into the blurred extended canvas
      const fgW = Math.max(2, Math.round(drawW));
      const fgH = Math.max(2, Math.round(drawH));
      const fgCanvas = document.createElement('canvas');
      fgCanvas.width = fgW;
      fgCanvas.height = fgH;
      const fctx = fgCanvas.getContext('2d');

      if (fctx) {
        fctx.imageSmoothingEnabled = true;
        fctx.imageSmoothingQuality = 'high';
        fctx.filter = colorFilter;
        fctx.drawImage(productImg, 0, 0, fgW, fgH);
        fctx.filter = 'none';

        if (options.applySharpen !== false && config.sharpness > 0) {
          applyUnsharpToRegion(fctx, 0, 0, fgW, fgH, config.sharpness);
        }

        // Apply destination-in soft alpha mask so background around the product blurs seamlessly
        // and outer photo edges dissolve smoothly into extended background with zero hard border lines
        fctx.globalCompositeOperation = 'destination-in';

        if (config.backgroundBlurEnabled && config.backgroundBlurAmount > 0) {
          const box = config.subjectBox ?? { x: 0.12, y: 0.08, w: 0.76, h: 0.84 };
          const cx = (box.x + box.w / 2) * fgW;
          const cy = (box.y + box.h / 2) * fgH;
          const rx = Math.max(fgW * 0.24, (box.w / 2) * fgW * config.focusRadiusScale);
          const ry = Math.max(fgH * 0.24, (box.h / 2) * fgH * config.focusRadiusScale);

          const featherRatio = Math.max(0.12, Math.min(0.65, config.focusFeather / 100));
          const innerStop = Math.max(0.35, 1 - featherRatio);

          fctx.save();
          fctx.translate(cx, cy);
          fctx.scale(rx, ry);
          const maskGrad = fctx.createRadialGradient(0, 0, innerStop * 0.88, 0, 0, 1.18);
          maskGrad.addColorStop(0, 'rgba(0,0,0,1)');
          maskGrad.addColorStop(innerStop, 'rgba(0,0,0,0.98)');
          maskGrad.addColorStop(Math.min(0.96, innerStop + (1 - innerStop) * 0.55), 'rgba(0,0,0,0.52)');
          maskGrad.addColorStop(1, 'rgba(0,0,0,0)');
          fctx.fillStyle = maskGrad;
          fctx.fillRect(-3, -3, 6, 6);
          fctx.restore();
        } else {
          // Pure seamless edge-feather mask when only Background Extension is active (no blur over inner photo)
          const edgeFadeX = Math.max(8, Math.round(fgW * (config.focusFeather / 240)));
          const edgeFadeY = Math.max(8, Math.round(fgH * (config.focusFeather / 240)));

          // Horizontal feather
          const hGrad = fctx.createLinearGradient(0, 0, fgW, 0);
          const hx = Math.min(0.25, edgeFadeX / fgW);
          hGrad.addColorStop(0, 'rgba(0,0,0,0)');
          hGrad.addColorStop(hx, 'rgba(0,0,0,1)');
          hGrad.addColorStop(1 - hx, 'rgba(0,0,0,1)');
          hGrad.addColorStop(1, 'rgba(0,0,0,0)');
          fctx.fillStyle = hGrad;
          fctx.fillRect(0, 0, fgW, fgH);

          // Vertical feather
          const vGrad = fctx.createLinearGradient(0, 0, 0, fgH);
          const vy = Math.min(0.25, edgeFadeY / fgH);
          vGrad.addColorStop(0, 'rgba(0,0,0,0)');
          vGrad.addColorStop(vy, 'rgba(0,0,0,1)');
          vGrad.addColorStop(1 - vy, 'rgba(0,0,0,1)');
          vGrad.addColorStop(1, 'rgba(0,0,0,0)');
          fctx.fillStyle = vGrad;
          fctx.fillRect(0, 0, fgW, fgH);
        }

        fctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(fgCanvas, drawX, drawY, drawW, drawH);
      }
    } else {
      // Clean solid studio backdrop mode (no background blur/extension)
      if (config.fitMode === 'contain' && !isWatermarkOnly) {
        const shadowY = Math.min(stageRect.y + stageRect.h - 10 * u, drawY + drawH - 4 * u);
        const shadowGrad = ctx.createRadialGradient(
          drawX + drawW / 2,
          shadowY,
          drawW * 0.05,
          drawX + drawW / 2,
          shadowY,
          drawW * 0.42
        );
        shadowGrad.addColorStop(0, 'rgba(7, 42, 94, 0.14)');
        shadowGrad.addColorStop(1, 'rgba(7, 42, 94, 0)');
        ctx.fillStyle = shadowGrad;
        ctx.beginPath();
        ctx.ellipse(drawX + drawW / 2, shadowY, drawW * 0.4, Math.max(8, 16 * u), 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.filter = colorFilter;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(productImg, drawX, drawY, drawW, drawH);
      ctx.filter = 'none';

      if (options.applySharpen !== false && config.sharpness > 0) {
        applyUnsharpToRegion(ctx, drawX, drawY, drawW, drawH, config.sharpness);
      }
    }

    // Optional dashed guide showing AI-detected physical product region (used inside Framing/Zoom Window)
    if (options.showSubjectGuide) {
      const gx = drawX + sBox.x * drawW;
      const gy = drawY + sBox.y * drawH;
      const gw = safeSubjW * drawW;
      const gh = safeSubjH * drawH;
      ctx.save();
      ctx.strokeStyle = '#009EE3';
      ctx.lineWidth = Math.max(2, 2.5 * u);
      ctx.setLineDash([Math.round(10 * u), Math.round(7 * u)]);
      ctx.strokeRect(gx, gy, gw, gh);
      ctx.setLineDash([]);
      // Corner tick markers
      const tick = Math.round(18 * u);
      ctx.strokeStyle = '#0052B4';
      ctx.lineWidth = Math.max(3, 4 * u);
      ctx.beginPath();
      // Top-left
      ctx.moveTo(gx, gy + tick);
      ctx.lineTo(gx, gy);
      ctx.lineTo(gx + tick, gy);
      // Top-right
      ctx.moveTo(gx + gw - tick, gy);
      ctx.lineTo(gx + gw, gy);
      ctx.lineTo(gx + gw, gy + tick);
      // Bottom-left
      ctx.moveTo(gx, gy + gh - tick);
      ctx.lineTo(gx, gy + gh);
      ctx.lineTo(gx + tick, gy + gh);
      // Bottom-right
      ctx.moveTo(gx + gw - tick, gy + gh);
      ctx.lineTo(gx + gw, gy + gh);
      ctx.lineTo(gx + gw, gy + gh - tick);
      ctx.stroke();
      ctx.restore();
    }

    // Optional protective watermark inside product stage
    if (showWatermark && iconLogo) {
      ctx.save();
      ctx.globalAlpha = config.watermarkOpacity;
      const wmW = Math.round(stageRect.w * (isWide ? 0.34 : 0.36));
      const wmH = wmW * (iconLogo.height / Math.max(1, iconLogo.width));
      const cx = stageRect.x + stageRect.w / 2;
      const cy = stageRect.y + stageRect.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((-14 * Math.PI) / 180);
      ctx.drawImage(iconLogo, -wmW / 2, -wmH / 2, wmW, wmH);
      ctx.restore();
    }

    ctx.restore();
  }

  // Helper to draw VUTECH logo crisply with optional white anchor plate on dark bars
  const drawLogoAt = (
    x: number,
    y: number,
    maxW: number,
    maxH: number,
    align: 'left' | 'center' | 'right',
    onDarkSurface: boolean
  ) => {
    if (!activeLogo) return;
    const natW = activeLogo instanceof HTMLImageElement ? activeLogo.naturalWidth : activeLogo.width;
    const natH = activeLogo instanceof HTMLImageElement ? activeLogo.naturalHeight : activeLogo.height;
    const logoAspect = natW / Math.max(1, natH);

    let lw = maxW * config.logoScale;
    let lh = lw / logoAspect;
    if (lh > maxH * config.logoScale) {
      lh = maxH * config.logoScale;
      lw = lh * logoAspect;
    }

    let lx = x;
    if (align === 'center') lx = x - lw / 2;
    if (align === 'right') lx = x - lw;
    const ly = y - lh / 2;

    if (onDarkSurface) {
      const platePadX = Math.round(18 * u);
      const platePadY = Math.round(10 * u);
      ctx.save();
      drawRoundedRect(
        ctx,
        lx - platePadX,
        ly - platePadY,
        lw + platePadX * 2,
        lh + platePadY * 2,
        Math.round(10 * u)
      );
      ctx.fillStyle = '#FFFFFF';
      ctx.shadowColor = 'rgba(0, 18, 46, 0.25)';
      ctx.shadowBlur = Math.round(14 * u);
      ctx.shadowOffsetY = Math.round(4 * u);
      ctx.fill();
      ctx.restore();
    }

    ctx.drawImage(activeLogo, lx, ly, lw, lh);
  };

  // 4. Render Template-Specific Brand Chrome & Typography
  if (isShopeeCover) {
    // SHOPEE OFFICIAL COVER PHOTO LAYOUT (1:1 Clean Marketplace Standard)
    // - No heavy decorative borders, no off-platform phone numbers or website URLs.
    // - Compact VUTECH brand logo safely placed top-center (or top-left inset) avoiding Shopee's top-right % discount tag.
    // - Bottom 16.5% intentionally kept clean so Shopee's Freeship Xtra / Voucher / Mall overlays never block product or text.
    const safeTopY = Math.round(height * 0.056);
    const logoAlign = config.logoPosition === 'top-left' ? 'left' : 'center';
    const logoX = logoAlign === 'left' ? Math.round(width * 0.06) : width / 2;
    drawLogoAt(
      logoX,
      safeTopY,
      Math.round(220 * u),
      Math.round(52 * u),
      logoAlign,
      false
    );

    // Optional clean model/category caption tucked safely inside top safe zone (no promo clutter)
    if (config.modelCode && logoAlign === 'center') {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `700 ${Math.round(17 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#334155';
      const topLabel = [config.category, config.modelCode].filter(Boolean).join('  ·  ');
      ctx.fillText(topLabel.slice(0, 48), width / 2, safeTopY + Math.round(32 * u));
      ctx.restore();
    } else if (config.modelCode && logoAlign === 'left') {
      ctx.save();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.font = `700 ${Math.round(17 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#334155';
      ctx.fillText(`Model: ${config.modelCode}`, Math.round(width * 0.06), safeTopY + Math.round(31 * u));
      ctx.restore();
    }

    // Concise authentic product title positioned strictly ABOVE Shopee's 16.5% bottom badge strip (ends before 82.5%)
    if (config.showSpecsPanel && config.productName) {
      const captionY = Math.round(height * 0.775);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.font = `800 ${Math.round(23 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#0F172A';
      const shortName = wrapText(ctx, config.productName, width * 0.84, 1)[0] ?? config.productName;
      ctx.fillText(shortName, width / 2, captionY);

      if (config.priceBadge.trim() && config.showPriceBadge) {
        ctx.font = `700 ${Math.round(16 * u)}px "Manrope", sans-serif`;
        ctx.fillStyle = '#0052B4';
        ctx.fillText(`Chính hãng VUTECH · ${config.priceBadge}`, width / 2, captionY + Math.round(29 * u));
      }
      ctx.restore();
    }

    return { width, height };
  }

  if (isWatermarkOnly) {
    // Crisp corner logo + clean subtle bottom attribution strip
    const logoMaxH = Math.round(74 * u);
    const logoMaxW = Math.round(280 * u);
    const logoY = Math.round(58 * u);
    const align =
      config.logoPosition === 'top-center'
        ? 'center'
        : config.logoPosition === 'top-right'
        ? 'right'
        : 'left';
    const logoX =
      align === 'center' ? width / 2 : align === 'right' ? width - pad : pad;

    // Crisp translucent white glass anchor behind logo for contrast on any raw photo
    drawLogoAt(logoX, logoY, logoMaxW, logoMaxH, align, true);

    if (config.showContactFooter) {
      const barH = Math.round(56 * u);
      const barY = height - barH;
      ctx.fillStyle = 'rgba(7, 36, 82, 0.88)';
      ctx.fillRect(0, barY, width, barH);
      ctx.fillStyle = '#009EE3';
      ctx.fillRect(0, barY, width, Math.max(2, 3 * u));

      ctx.fillStyle = '#FFFFFF';
      ctx.font = `600 ${Math.round(20 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      const leftText = [config.productName, config.modelCode].filter(Boolean).join(' · ');
      ctx.fillText(leftText.slice(0, 62), pad, barY + barH / 2);

      ctx.textAlign = 'right';
      ctx.font = `600 ${Math.round(19 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = '#BAE6FD';
      const fbLabel = config.facebookPage?.trim()
        ? /^(fb|facebook)/i.test(config.facebookPage.trim())
          ? config.facebookPage.trim()
          : `FB: ${config.facebookPage.trim()}`
        : '';
      const rightText = [config.hotline, fbLabel, config.website].filter(Boolean).join('  |  ');
      ctx.fillText(rightText, width - pad, barY + barH / 2);
    }
    return { width, height };
  }

  // WIDESCREEN 2-COLUMN COMMERCIAL BANNER LAYOUT (16:9, 21:9)
  if (isWide) {
    const infoColW = stageRect.x - Math.round(16 * u);
    const darkLeft =
      config.template === 'facebook-promo' ||
      config.template === 'industrial-tech' ||
      isMinimalLuxury ||
      isShopeeDetail;

    if (isMinimalLuxury) {
      // High-contrast Luxury Obsidian Navy + Champagne Gold accent panel
      const leftGrad = ctx.createLinearGradient(0, 0, infoColW, height);
      leftGrad.addColorStop(0, '#0B162C');
      leftGrad.addColorStop(1, '#14294A');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, infoColW, height);

      // Refined champagne-gold architectural divider
      ctx.fillStyle = '#D4AF37';
      ctx.fillRect(infoColW - Math.round(5 * u), 0, Math.round(5 * u), height);
    } else if (darkLeft) {
      const leftGrad = ctx.createLinearGradient(0, 0, infoColW, height);
      leftGrad.addColorStop(0, '#072A5E');
      leftGrad.addColorStop(1, '#0052B4');
      ctx.fillStyle = leftGrad;
      ctx.fillRect(0, 0, infoColW, height);

      // Clean accent vertical rule
      ctx.fillStyle = '#009EE3';
      ctx.fillRect(infoColW - Math.round(5 * u), 0, Math.round(5 * u), height);
    } else {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, infoColW, height);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(infoColW - Math.max(1.5, 2 * u), pad, Math.max(1.5, 2 * u), height - pad * 2);
    }

    const textPad = Math.round(48 * u);
    const textMaxW = infoColW - textPad * 2;
    let cursorY = Math.round(78 * u);

    // Logo in left column top
    drawLogoAt(
      textPad,
      cursorY,
      Math.round(Math.min(textMaxW * 0.72, 300 * u)),
      Math.round(72 * u),
      'left',
      darkLeft
    );

    cursorY += Math.round(84 * u);

    // Category + Model metadata line
    const hasVerifiedModel =
      Boolean(config.modelCode) &&
      !config.modelCode.startsWith('Chưa xác định') &&
      !/^VT-0[1-9]$/i.test(config.modelCode);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `700 ${Math.round(22 * u)}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = isMinimalLuxury ? '#F5D882' : darkLeft ? '#7DD3FC' : '#0052B4';
    const metaLine = [config.category, hasVerifiedModel ? `Model ${config.modelCode}` : '']
      .filter(Boolean)
      .join('  ·  ');
    ctx.fillText(metaLine, textPad, cursorY);

    cursorY += Math.round(38 * u);

    // Main Product Title
    const titleSize = Math.round((aspect > 2 ? 46 : 52) * u);
    ctx.font = `800 ${titleSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.fillStyle = darkLeft ? '#FFFFFF' : '#0F172A';
    const titleLines = wrapText(ctx, config.productName || 'Cần bổ sung thông tin sản phẩm', textMaxW, 3);
    for (const line of titleLines) {
      ctx.fillText(line, textPad, cursorY);
      cursorY += Math.round(titleSize * 1.18);
    }

    if (config.tagline) {
      cursorY += Math.round(8 * u);
      ctx.font = `500 ${Math.round(22 * u)}px "Manrope", sans-serif`;
      ctx.fillStyle = isMinimalLuxury ? '#DBEAFE' : darkLeft ? '#CBD5E1' : '#334155';
      const tagLines = wrapText(ctx, config.tagline, textMaxW, 2);
      for (const line of tagLines) {
        ctx.fillText(line, textPad, cursorY);
        cursorY += Math.round(30 * u);
      }
    }

    // Specs list
    if (config.showSpecsPanel) {
      cursorY += Math.round(22 * u);
      const validSpecs = config.specs.filter((s) => s.trim().length > 0);
      ctx.font = `600 ${Math.round(23 * u)}px "Manrope", sans-serif`;
      for (const spec of validSpecs) {
        ctx.fillStyle = isMinimalLuxury ? '#E5C158' : darkLeft ? '#38BDF8' : '#0052B4';
        ctx.fillRect(textPad, cursorY + Math.round(10 * u), Math.round(14 * u), Math.round(4 * u));
        ctx.fillStyle = darkLeft ? '#F8FAFC' : '#0F172A';
        ctx.fillText(spec, textPad + Math.round(24 * u), cursorY);
        cursorY += Math.round(38 * u);
      }
    }

    // Optional warranty/promo stamp
    if (config.showPriceBadge && config.priceBadge.trim()) {
      const badgeY = Math.min(cursorY + Math.round(12 * u), height - Math.round(145 * u));
      ctx.font = `700 ${Math.round(21 * u)}px "Plus Jakarta Sans", sans-serif`;
      const bw = ctx.measureText(config.priceBadge).width + Math.round(36 * u);
      const bh = Math.round(44 * u);
      drawRoundedRect(ctx, textPad, badgeY, bw, bh, Math.round(8 * u));
      if (isMinimalLuxury) {
        ctx.fillStyle = '#D4AF37';
        ctx.fill();
        ctx.fillStyle = '#091428';
      } else {
        ctx.fillStyle = darkLeft ? '#009EE3' : '#0052B4';
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
      }
      ctx.textBaseline = 'middle';
      ctx.fillText(config.priceBadge, textPad + Math.round(18 * u), badgeY + bh / 2);
    }

    // Bottom contact strip inside left column (Shopee detail omits external contact info per policy)
    if (config.showContactFooter || isShopeeDetail) {
      const footY = height - Math.round(74 * u);
      ctx.fillStyle = isMinimalLuxury
        ? 'rgba(212, 175, 55, 0.35)'
        : darkLeft
        ? 'rgba(255,255,255,0.16)'
        : '#CBD5E1';
      ctx.fillRect(textPad, footY - Math.round(16 * u), textMaxW, Math.max(1, 1.5 * u));

      ctx.textBaseline = 'top';
      ctx.font = `700 ${Math.round(20 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = darkLeft ? '#FFFFFF' : '#072A5E';
      ctx.fillText(config.companyName, textPad, footY);

      ctx.font = `600 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = isMinimalLuxury ? '#F5D882' : darkLeft ? '#BAE6FD' : '#0052B4';
      if (isShopeeDetail) {
        ctx.fillText('PHÂN PHỐI BỞI VUTECH  ·  HÀNG CHÍNH NGẠCH', textPad, footY + Math.round(28 * u));
      } else {
        const fbLabel = config.facebookPage?.trim()
          ? /^(fb|facebook)/i.test(config.facebookPage.trim())
            ? config.facebookPage.trim()
            : `FB: ${config.facebookPage.trim()}`
          : '';
        const contactLine = [config.hotline, fbLabel, config.website].filter(Boolean).join('  ·  ');
        ctx.fillText(contactLine, textPad, footY + Math.round(28 * u));
      }
    }

    return { width, height };
  }

  // STANDARD / PORTRAIT VERTICAL COMMERCIAL LAYOUTS (1:1, 4:3, 3:2, 3:4, 2:3, 9:16)

  // A. Top Brand Bar
  const isDarkHeader =
    config.template === 'facebook-promo' || config.template === 'industrial-tech';

  if (config.template === 'facebook-promo') {
    const hGrad = ctx.createLinearGradient(0, 0, width, 0);
    hGrad.addColorStop(0, '#072A5E');
    hGrad.addColorStop(0.65, '#0052B4');
    hGrad.addColorStop(1, '#0284C7');
    ctx.fillStyle = hGrad;
    ctx.fillRect(0, 0, width, headerH);
    ctx.fillStyle = '#38BDF8';
    ctx.fillRect(0, headerH - Math.round(4 * u), width, Math.round(4 * u));
  } else if (config.template === 'web-clean' || isShopeeDetail) {
    // Crisp top corporate accent stripe on clean white header
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, headerH);
    const topStrip = ctx.createLinearGradient(0, 0, width, 0);
    topStrip.addColorStop(0, '#0052B4');
    topStrip.addColorStop(1, '#009EE3');
    ctx.fillStyle = topStrip;
    ctx.fillRect(0, 0, width, Math.round(7 * u));

    ctx.fillStyle = '#E2E8F0';
    ctx.fillRect(pad, headerH, width - pad * 2, Math.max(1, 1.5 * u));
  } else if (isMinimalLuxury) {
    // High-contrast crisp editorial white header with Obsidian & Champagne Gold rule
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, headerH);
    ctx.fillStyle = '#0B162C';
    ctx.fillRect(0, 0, width, Math.round(6 * u));
    ctx.fillStyle = '#D4AF37';
    ctx.fillRect(pad, headerH - Math.round(2 * u), width - pad * 2, Math.max(1.5, 2 * u));
  }

  // Logo placement in header
  const logoAlign =
    config.logoPosition === 'top-center'
      ? 'center'
      : config.logoPosition === 'top-right'
      ? 'right'
      : 'left';
  const logoX =
    logoAlign === 'center' ? width / 2 : logoAlign === 'right' ? width - pad : pad;
  const logoY =
    config.template === 'facebook-promo'
      ? headerH / 2
      : config.template === 'web-clean' || isShopeeDetail || isMinimalLuxury
      ? headerH / 2 + Math.round(3 * u)
      : headerH / 2;

  drawLogoAt(
    logoX,
    logoY,
    Math.round(280 * u),
    Math.round(62 * u),
    logoAlign,
    isDarkHeader
  );

  // Opposite-corner metadata in header (when logo isn't centered)
  if (logoAlign !== 'center') {
    const metaX = logoAlign === 'left' ? width - pad : pad;
    const metaAlign = logoAlign === 'left' ? 'right' : 'left';
    const hasVerifiedModel =
      Boolean(config.modelCode) &&
      !config.modelCode.startsWith('Chưa xác định') &&
      !/^VT-0[1-9]$/i.test(config.modelCode);

    ctx.save();
    ctx.textAlign = metaAlign;
    ctx.textBaseline = 'middle';

    if (config.category) {
      ctx.font = `700 ${Math.round(20 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = isDarkHeader
        ? '#E0F2FE'
        : isMinimalLuxury
        ? '#0B162C'
        : '#0052B4';
      ctx.fillText(config.category, metaX, hasVerifiedModel ? logoY - Math.round(13 * u) : logoY);
    }
    if (hasVerifiedModel) {
      ctx.font = `700 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = isDarkHeader
        ? '#93C5FD'
        : isMinimalLuxury
        ? '#9A6F22'
        : '#475569';
      ctx.fillText(`Model: ${config.modelCode}`, metaX, logoY + Math.round(15 * u));
    }
    ctx.restore();
  }

  // Optional price/warranty callout stamp at top-right of product stage
  if (config.showPriceBadge && config.priceBadge.trim()) {
    ctx.save();
    ctx.font = `700 ${Math.round(20 * u)}px "Plus Jakarta Sans", sans-serif`;
    const bw = ctx.measureText(config.priceBadge).width + Math.round(34 * u);
    const bh = Math.round(42 * u);
    const bx = stageRect.x + stageRect.w - bw - Math.round(14 * u);
    const by = stageRect.y + Math.round(14 * u);
    drawRoundedRect(ctx, bx, by, bw, bh, Math.round(8 * u));
    if (isMinimalLuxury) {
      ctx.fillStyle = '#0B162C';
      ctx.shadowColor = 'rgba(11, 22, 44, 0.28)';
      ctx.shadowBlur = Math.round(12 * u);
      ctx.shadowOffsetY = Math.round(4 * u);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = Math.max(1.5, 2 * u);
      ctx.stroke();
      ctx.fillStyle = '#F6DC8C';
    } else {
      ctx.fillStyle = '#0052B4';
      ctx.shadowColor = 'rgba(0, 82, 180, 0.24)';
      ctx.shadowBlur = Math.round(12 * u);
      ctx.shadowOffsetY = Math.round(4 * u);
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#FFFFFF';
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(config.priceBadge, bx + bw / 2, by + bh / 2);
    ctx.restore();
  }

  // B. Bottom Product Specs & Corporate Contact Band
  if (isShopeeDetail || config.showSpecsPanel || config.showContactFooter) {
    const footTop = height - footerH;
    const isDarkFooter =
      config.template === 'facebook-promo' ||
      config.template === 'industrial-tech' ||
      isMinimalLuxury ||
      isShopeeDetail;

    if (isMinimalLuxury) {
      // High-contrast Editorial Obsidian Navy plinth + luminous Champagne Gold top accent rule
      const luxGrad = ctx.createLinearGradient(0, footTop, width, height);
      luxGrad.addColorStop(0, '#0B162C');
      luxGrad.addColorStop(1, '#14294A');
      ctx.fillStyle = luxGrad;
      ctx.fillRect(0, footTop, width, footerH);

      ctx.fillStyle = '#D4AF37';
      ctx.fillRect(0, footTop, width, Math.round(4.5 * u));
    } else if (config.template === 'facebook-promo' || isShopeeDetail) {
      const fGrad = ctx.createLinearGradient(0, footTop, width, height);
      fGrad.addColorStop(0, '#072A5E');
      fGrad.addColorStop(1, '#0B3B8C');
      ctx.fillStyle = fGrad;
      ctx.fillRect(0, footTop, width, footerH);
      ctx.fillStyle = '#009EE3';
      ctx.fillRect(0, footTop, width, Math.round(5 * u));
    } else if (config.template === 'industrial-tech') {
      ctx.fillStyle = '#071B38';
      ctx.fillRect(0, footTop, width, footerH);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.fillRect(pad, footTop, width - pad * 2, Math.max(1.5, 2 * u));
    } else {
      // web-clean
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, footTop, width, footerH);
      ctx.fillStyle = '#CBD5E1';
      ctx.fillRect(0, footTop, width, Math.max(1.5, 2 * u));
    }

    const innerTop = footTop + Math.round(24 * u);
    const showBottomBar = isShopeeDetail || config.showContactFooter;
    const contactBarH = showBottomBar ? Math.round(48 * u) : 0;
    const contentMaxW = width - pad * 2;
    let y = innerTop;

    if (config.showSpecsPanel || isShopeeDetail) {
      // Product Title
      const titleFontSize = Math.round((isTall ? 34 : 33) * u);
      ctx.font = `800 ${titleFontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = isDarkFooter ? '#FFFFFF' : '#0F172A';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      const titleLines = wrapText(ctx, config.productName || 'Cần bổ sung thông tin sản phẩm', contentMaxW, 2);
      for (const line of titleLines) {
        ctx.fillText(line, pad, y);
        y += Math.round(titleFontSize * 1.18);
      }

      if (config.tagline && titleLines.length === 1) {
        ctx.font = `500 ${Math.round(20 * u)}px "Manrope", sans-serif`;
        ctx.fillStyle = isMinimalLuxury
          ? '#DBEAFE'
          : isDarkFooter
          ? '#BAE6FD'
          : '#475569';
        const tagLine = wrapText(ctx, config.tagline, contentMaxW, 1)[0] ?? '';
        ctx.fillText(tagLine, pad, y + Math.round(2 * u));
        y += Math.round(30 * u);
      } else {
        y += Math.round(8 * u);
      }

      // Dynamic Verified Technical Specs (renders 1, 2, or 3 verified columns cleanly; omits row if 0)
      const validSpecs = config.specs.filter((s) => s.trim().length > 0);
      if (validSpecs.length > 0) {
        if (isTall) {
          // Stacked vertical spec rows for 9:16 / 2:3
          ctx.font = `600 ${Math.round(21 * u)}px "Manrope", sans-serif`;
          for (const spec of validSpecs) {
            ctx.fillStyle = isMinimalLuxury
              ? '#E5C158'
              : isDarkFooter
              ? '#38BDF8'
              : '#0052B4';
            ctx.fillRect(pad, y + Math.round(9 * u), Math.round(12 * u), Math.round(4 * u));
            ctx.fillStyle = isDarkFooter ? '#F8FAFC' : '#1E293B';
            ctx.fillText(spec, pad + Math.round(22 * u), y);
            y += Math.round(32 * u);
          }
        } else {
          // 1 to 3 balanced inline columns separated by crisp hairline dividers
          const colCount = validSpecs.length;
          const colW = contentMaxW / colCount;
          const specY = y + Math.round(6 * u);

          validSpecs.forEach((spec, idx) => {
            const colX = pad + idx * colW;
            if (idx > 0) {
              ctx.fillStyle = isMinimalLuxury
                ? 'rgba(212, 175, 55, 0.30)'
                : isDarkFooter
                ? 'rgba(255,255,255,0.20)'
                : 'rgba(15, 23, 42, 0.14)';
              ctx.fillRect(colX - Math.round(10 * u), specY, Math.max(1, 1.5 * u), Math.round(36 * u));
            }
            ctx.fillStyle = isMinimalLuxury
              ? '#E5C158'
              : isDarkFooter
              ? '#38BDF8'
              : '#0052B4';
            ctx.fillRect(colX, specY + Math.round(4 * u), Math.round(20 * u), Math.round(3.5 * u));

            ctx.font = `600 ${Math.round(19 * u)}px "Manrope", sans-serif`;
            ctx.fillStyle = isDarkFooter ? '#FFFFFF' : '#0F172A';
            const line = wrapText(ctx, spec, colW - Math.round(20 * u), 1)[0] ?? spec;
            ctx.fillText(line, colX, specY + Math.round(14 * u));
          });
        }
      }
    }

    // Bottom Corporate Bar (Shopee detail strictly displays authentic warranty badge instead of off-platform contacts)
    if (showBottomBar) {
      const barY = height - contactBarH;
      if (config.template === 'web-clean') {
        ctx.fillStyle = '#072A5E';
        ctx.fillRect(0, barY, width, contactBarH);
      } else if (isMinimalLuxury) {
        ctx.fillStyle = '#060D1C';
        ctx.fillRect(0, barY, width, contactBarH);
        ctx.fillStyle = 'rgba(212, 175, 55, 0.42)';
        ctx.fillRect(0, barY, width, Math.max(1, 1.5 * u));
      } else {
        ctx.fillStyle = 'rgba(0, 12, 34, 0.42)';
        ctx.fillRect(0, barY, width, contactBarH);
      }

      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';
      ctx.font = `700 ${Math.round(18 * u)}px "Plus Jakarta Sans", sans-serif`;
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(config.companyName || 'CÔNG TY TNHH XNK VUTECH', pad, barY + contactBarH / 2);

      ctx.textAlign = 'right';
      ctx.font = `600 ${Math.round(18 * u)}px "JetBrains Mono", monospace`;
      ctx.fillStyle = isMinimalLuxury ? '#F6DC8C' : '#7DD3FC';

      if (isShopeeDetail) {
        ctx.fillText(
          'PHÂN PHỐI BỞI VUTECH · HÀNG CHÍNH NGẠCH',
          width - pad,
          barY + contactBarH / 2
        );
      } else {
        const fbLabel = config.facebookPage?.trim()
          ? /^(fb|facebook)/i.test(config.facebookPage.trim())
            ? config.facebookPage.trim()
            : `FB: ${config.facebookPage.trim()}`
          : '';
        const rightContact = [config.hotline, fbLabel, config.website].filter(Boolean).join('  ·  ');
        ctx.fillText(rightContact, width - pad, barY + contactBarH / 2);
      }
    }
  }

  return { width, height };
}

export function buildExportFileName(
  config: StudioConfig,
  format: ExportFormat,
  overrideRatio?: string
): string {
  const baseSlug =
    config.channelNames?.asciiFileName ||
    (config.modelCode || config.productName || 'vutech-product')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/×/g, 'x')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
  const ratioSlug = (overrideRatio ?? config.aspectRatio).replace(':', 'x');
  const templateSlug =
    config.template === 'shopee-cover'
      ? '_ShopeeBia'
      : config.template === 'shopee-detail'
      ? '_ShopeeChiTiet'
      : '';
  return `VUTECH_${baseSlug}${templateSlug}_${ratioSlug}_${config.resolution}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}

export async function exportStudioImage(
  config: StudioConfig,
  format: ExportFormat = 'png'
): Promise<string> {
  const offscreen = document.createElement('canvas');
  await renderStudioCanvas(offscreen, config, { applySharpen: true });

  const isShopee = config.template === 'shopee-cover' || config.template === 'shopee-detail';
  let actualFormat: ExportFormat = format;
  let dataUrl = offscreen.toDataURL(
    actualFormat === 'jpeg' ? 'image/jpeg' : 'image/png',
    actualFormat === 'jpeg' ? 0.94 : 1.0
  );

  // Shopee Vietnam enforces a <= 2 MB upload ceiling per product image (~2.62M base64 chars)
  const SHOPEE_MAX_BASE64_LEN = 2_600_000;
  if (isShopee && dataUrl.length > SHOPEE_MAX_BASE64_LEN) {
    actualFormat = 'jpeg';
    for (const q of [0.9, 0.84, 0.78]) {
      dataUrl = offscreen.toDataURL('image/jpeg', q);
      if (dataUrl.length <= SHOPEE_MAX_BASE64_LEN) break;
    }
  }

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = buildExportFileName(config, actualFormat);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return dataUrl;
}

export async function renderThumbnailDataUrl(config: StudioConfig): Promise<string> {
  const dims = getExportDimensions(config.aspectRatio, '1K');
  const scale = 420 / Math.max(dims.width, dims.height);
  const offscreen = document.createElement('canvas');
  await renderStudioCanvas(offscreen, config, {
    targetWidth: Math.round(dims.width * scale),
    targetHeight: Math.round(dims.height * scale),
    applySharpen: false,
  });
  return offscreen.toDataURL('image/jpeg', 0.84);
}
