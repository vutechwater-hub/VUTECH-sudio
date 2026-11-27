import type { StudioConfig } from '../types/studio';

export interface TechnicalDocEnrichmentResult {
  mode: 'online-search' | 'file-upload';
  standardizedProductName: string;
  standardizedModelCode: string;
  coreSpecs: string[];
  sourceSummary: string;
  slides: Record<string, string>;
  webSources: Array<{ title: string; uri: string }>;
  uploadedVisualDataUrl?: string;
  uploadedFileName?: string;
}

async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  if (!url) return null;
  if (url.startsWith('data:image/')) {
    const mimeMatch = url.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
    return {
      base64: url,
      mimeType: mimeMatch?.[1] || 'image/jpeg',
    };
  }
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    const mimeType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/jpeg';
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Không thể đọc ảnh'));
      reader.readAsDataURL(blob);
    });
    return { base64: dataUrl, mimeType };
  } catch {
    return null;
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc file tải lên.'));
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc nội dung văn bản của file.'));
    reader.readAsText(file, 'utf-8');
  });
}

/**
 * Priority 1: Proactive AI Online Search (Google Search Grounding + Product Photo Inspection)
 * Automatically researches and populates standardized technical documentation for each required slide.
 */
export async function enrichTechnicalDocsOnline(
  config: StudioConfig
): Promise<TechnicalDocEnrichmentResult> {
  const imgData = await imageUrlToBase64(config.sourceImageUrl);

  const response = await fetch('/api/gemini/enrich-technical-docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'online-search',
      productName: config.productName,
      modelCode: config.modelCode,
      category: config.category,
      specs: config.specs,
      productImageBase64: imgData?.base64,
      productImageMimeType: imgData?.mimeType,
    }),
  });

  const data = (await response.json()) as {
    enrichment?: TechnicalDocEnrichmentResult;
    error?: string;
  };

  if (!response.ok || !data.enrichment) {
    throw new Error(
      data.error ||
        'Không thể tra cứu tài liệu kỹ thuật trực tuyến lúc này. Vui lòng thử lại hoặc dùng Phương án 2 (Tải file tài liệu sản phẩm).'
    );
  }

  return data.enrichment;
}

/**
 * Method 2: Manual File Upload + AI Technical Data Standardization & Mapping
 * Parses an uploaded product specification file (PDF, Image of nameplate/drawing/catalog, TXT, CSV, JSON, MD)
 * and maps standardized data into every multi-channel image slide.
 */
export async function enrichTechnicalDocsFromFile(
  config: StudioConfig,
  file: File
): Promise<TechnicalDocEnrichmentResult> {
  const imgData = await imageUrlToBase64(config.sourceImageUrl);
  const lowerName = file.name.toLowerCase();
  const isImage = file.type.startsWith('image/') || /\.(png|jpe?g|webp|bmp)$/i.test(lowerName);
  const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');

  let uploadedFileBase64: string | undefined;
  let uploadedFileMimeType: string | undefined;
  let uploadedTextContent: string | undefined;
  let uploadedVisualDataUrl: string | undefined;

  if (isImage || isPdf) {
    const dataUrl = await readFileAsDataUrl(file);
    uploadedFileBase64 = dataUrl;
    uploadedFileMimeType = isPdf ? 'application/pdf' : file.type || 'image/jpeg';
    if (isImage) {
      uploadedVisualDataUrl = dataUrl;
    }
  } else {
    uploadedTextContent = await readFileAsText(file);
  }

  const response = await fetch('/api/gemini/enrich-technical-docs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'file-upload',
      productName: config.productName,
      modelCode: config.modelCode,
      category: config.category,
      specs: config.specs,
      productImageBase64: imgData?.base64,
      productImageMimeType: imgData?.mimeType,
      uploadedFileBase64,
      uploadedFileMimeType,
      uploadedFileName: file.name,
      uploadedTextContent,
    }),
  });

  const data = (await response.json()) as {
    enrichment?: TechnicalDocEnrichmentResult;
    error?: string;
  };

  if (!response.ok || !data.enrichment) {
    throw new Error(
      data.error ||
        `Không thể phân tích file "${file.name}". Vui lòng kiểm tra định dạng file (PDF, Ảnh, TXT, CSV, JSON).`
    );
  }

  return {
    ...data.enrichment,
    uploadedVisualDataUrl,
    uploadedFileName: file.name,
  };
}
