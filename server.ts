import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_IMAGE_MODELS = new Set([
  'gemini-nano-banana-2.1',
  'gemini-3-pro-image',
]);

const ALLOWED_ASPECT_RATIOS = new Set([
  '1:1',
  '2:3',
  '3:2',
  '3:4',
  '4:3',
  '9:16',
  '16:9',
  '21:9',
]);

const ALLOWED_IMAGE_SIZES = new Set(['1K', '2K', '4K']);

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('MISSING_API_KEY');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatGeminiError(err: unknown): { status: number; message: string; code: string } {
  const raw = err instanceof Error ? err.message : String(err);
  if (raw === 'MISSING_API_KEY') {
    return {
      status: 503,
      code: 'MISSING_API_KEY',
      message:
        'Chưa cấu hình GEMINI_API_KEY trên máy chủ. Bạn vẫn có thể sử dụng đầy đủ Studio chỉnh sửa & đóng dấu thương hiệu VUTECH (1K–4K) ngay lập tức.',
    };
  }
  if (raw.includes('403') || raw.includes('PERMISSION_DENIED') || raw.includes('API_KEY_INVALID')) {
    return {
      status: 403,
      code: 'API_KEY_PERMISSION',
      message:
        'Tính năng AI tạo/chỉnh sửa ảnh yêu cầu API key có bật thanh toán trong mục Settings > Secrets. Bạn vẫn có thể dùng Studio đóng dấu & xuất ảnh chuẩn Web/Facebook 1K–4K hoàn toàn miễn phí.',
    };
  }
  if (raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED') || raw.includes('quota')) {
    return {
      status: 429,
      code: 'QUOTA_EXCEEDED',
      message:
        'Hạn mức gọi mô hình AI hình ảnh đã đạt giới hạn hoặc cần API key có bật thanh toán trong Settings > Secrets.',
    };
  }
  if (raw.includes('404') || raw.includes('NOT_FOUND')) {
    return {
      status: 404,
      code: 'MODEL_NOT_FOUND',
      message:
        'Mô hình AI hình ảnh hiện chưa khả dụng với API key đang dùng. Vui lòng thử chuyển mô hình hoặc kiểm tra API key trong Settings > Secrets.',
    };
  }
  return {
    status: 500,
    code: 'AI_ERROR',
    message: `Không thể xử lý yêu cầu AI lúc này: ${raw.slice(0, 220)}`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '30mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  // Analyze uploaded product image and generate Vietnamese VUTECH specs & Facebook caption
  app.post('/api/gemini/analyze-product', async (req, res) => {
    try {
      const { imageBase64, mimeType, existingName } = req.body as {
        imageBase64?: string;
        mimeType?: string;
        existingName?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Vui lòng cung cấp ảnh sản phẩm để phân tích.' });
        return;
      }

      const ai = getAiClient();
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const safeMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

      const promptText = `Bạn là kỹ sư kỹ thuật và chuyên gia marketing ngành thiết bị lọc nước của Công ty TNHH XNK VUTECH (Việt Nam, Hotline: 09.6759.6739).
Hãy QUAN SÁT TRỰC TIẾP hình ảnh thiết bị lọc nước này để nhận diện chính xác CHỦNG LOẠI thiết bị (ví dụ: Hệ thống lọc nước RO công nghiệp, Hệ thống lọc tổng đầu nguồn cột Composite/Inox, Bộ lọc siêu lọc UF Inox 304, Máy lọc nước RO tủ đứng nóng lạnh, Máy lọc nước để gầm, Màng lọc RO công nghiệp, Lõi lọc nước, Vỏ màng lọc Inox/FRP, Bơm cao áp lọc nước, Đèn UV diệt khuẩn, Van tự động Autovalve, Bồn muối hoàn nguyên, v.v.).
TUYỆT ĐỐI KHÔNG dùng tên file ảnh vô nghĩa như IMG_xxxx, zalo_xxx, photo_xxx làm tên sản phẩm.

Trả về JSON tiếng Việt chuẩn thương mại:
- category: Chủng loại thiết bị lọc nước chính xác mà bạn nhận diện được từ ảnh (ngắn gọn dưới 30 ký tự, ví dụ: Lọc tổng đầu nguồn, Hệ thống RO công nghiệp, Máy lọc nước gia đình, Màng & Lõi lọc nước, Phụ kiện ngành lọc nước).
- productName: Tên sản phẩm thương mại PHẢI được đặt tự động khớp chính xác với đúng chủng loại & đặc điểm thực tế nhìn thấy trong ảnh kèm thương hiệu VUTECH (không quá 58 ký tự, ví dụ: "Hệ Thống Lọc Tổng Đầu Nguồn 3 Cột Composite VUTECH", "Bộ Lọc Siêu Lọc UF Inox 304 VUTECH", "Màng Lọc Nước RO Công Nghiệp 4040 VUTECH").
- modelCode: Mã model chuẩn VUTECH tương ứng đúng chủng loại (ví dụ: VT-RO500, VT-UF2000, VT-COMP3, VT-ML4040).
- specs: Đúng 3 thông số kỹ thuật nổi bật ngắn gọn (mỗi dòng dưới 28 ký tự) sát thực tế với đúng chủng loại thiết bị nhìn thấy trong ảnh.
- tagline: 1 câu cam kết/giá trị thương hiệu ngắn gọn dưới 50 ký tự phù hợp đúng chủng loại sản phẩm.
- priceBadge: Nhãn nhấn ngắn gọn dưới 22 ký tự (ví dụ: Chính hãng VUTECH / Bảo hành 24 tháng / Lắp đặt tận nơi).
- facebookCaption: Đoạn bài đăng Facebook chuyên nghiệp 4-6 dòng giới thiệu đúng sản phẩm cho Công ty TNHH XNK VUTECH kèm Hotline: 09.6759.6739 và 4 hashtag phù hợp.
- subjectBox: Khung bao SÁT CHÍNH XÁC vùng thực tế của thiết bị lọc nước chính trong ảnh gốc theo phần trăm (0 đến 100) gồm x (mép trái của máy), y (mép trên cùng của máy/đồng hồ), w (chiều rộng thực tế của máy), h (chiều cao thực tế từ đỉnh tới chân đế), loại trừ tường trống/sàn nhà thừa xung quanh để hệ thống tự động zoom lấy khung hình chính chủ đạo và làm mờ phần nền ngoài.`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: safeMime,
                data: cleanBase64,
              },
            },
            { text: promptText },
          ],
        },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING },
              modelCode: { type: Type.STRING },
              category: { type: Type.STRING },
              specs: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              tagline: { type: Type.STRING },
              priceBadge: { type: Type.STRING },
              facebookCaption: { type: Type.STRING },
              subjectBox: {
                type: Type.OBJECT,
                properties: {
                  x: { type: Type.NUMBER },
                  y: { type: Type.NUMBER },
                  w: { type: Type.NUMBER },
                  h: { type: Type.NUMBER },
                },
                required: ['x', 'y', 'w', 'h'],
              },
            },
            required: [
              'productName',
              'modelCode',
              'category',
              'specs',
              'tagline',
              'priceBadge',
              'facebookCaption',
              'subjectBox',
            ],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json({ analysis: parsed });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  // Generate or edit high-resolution product images with gemini-nano-banana-2.1 or gemini-3-pro-image
  app.post('/api/gemini/image', async (req, res) => {
    try {
      const {
        model = 'gemini-nano-banana-2.1',
        prompt,
        aspectRatio = '1:1',
        imageSize = '2K',
        sourceImageBase64,
        sourceMimeType,
      } = req.body as {
        model?: string;
        prompt?: string;
        aspectRatio?: string;
        imageSize?: string;
        sourceImageBase64?: string;
        sourceMimeType?: string;
      };

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
        res.status(400).json({ error: 'Vui lòng nhập mô tả yêu cầu tạo hoặc chỉnh sửa hình ảnh.' });
        return;
      }

      const selectedModel = ALLOWED_IMAGE_MODELS.has(model) ? model : 'gemini-nano-banana-2.1';
      const selectedRatio = ALLOWED_ASPECT_RATIOS.has(aspectRatio) ? aspectRatio : '1:1';
      const selectedSize = ALLOWED_IMAGE_SIZES.has(imageSize) ? imageSize : '2K';

      const ai = getAiClient();
      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

      if (sourceImageBase64 && typeof sourceImageBase64 === 'string') {
        const cleanBase64 = sourceImageBase64.includes(',')
          ? sourceImageBase64.split(',')[1]
          : sourceImageBase64;
        const safeMime =
          sourceMimeType && sourceMimeType.startsWith('image/') ? sourceMimeType : 'image/jpeg';
        parts.push({
          inlineData: {
            data: cleanBase64,
            mimeType: safeMime,
          },
        });
      }

      const enhancedPrompt = sourceImageBase64
        ? `Commercial product photography enhancement for VUTECH water filtration equipment. Preserve the exact physical product structure, proportions, gauges, valves, and details from the provided photo. User instructions: ${prompt.trim()}. Clean ultra-sharp 8k commercial studio lighting, crisp edges, realistic shadows, no distorted text.`
        : `Commercial product photography for VUTECH water filtration equipment (Công ty TNHH XNK VUTECH). ${prompt.trim()}. Clean crisp studio lighting, ultra-sharp commercial photography, realistic materials, balanced framing suitable for web and Facebook branding.`;

      parts.push({ text: enhancedPrompt });

      // API supports 1:1, 3:4, 4:3, 9:16, 16:9 natively across models; pass selectedRatio directly
      const response = await ai.models.generateContent({
        model: selectedModel,
        contents: { parts },
        config: {
          imageConfig: {
            aspectRatio: selectedRatio,
            imageSize: selectedSize,
          },
        },
      });

      let imageDataUrl: string | null = null;
      let modelNote = '';

      for (const part of response.candidates?.[0]?.content?.parts ?? []) {
        if (part.inlineData?.data) {
          const mime = part.inlineData.mimeType ?? 'image/png';
          imageDataUrl = `data:${mime};base64,${part.inlineData.data}`;
        } else if (part.text) {
          modelNote += part.text;
        }
      }

      if (!imageDataUrl) {
        res.status(502).json({
          error:
            modelNote.trim() ||
            'Mô hình không trả về dữ liệu hình ảnh. Vui lòng điều chỉnh mô tả cụ thể hơn và thử lại.',
        });
        return;
      }

      res.json({
        imageDataUrl,
        model: selectedModel,
        aspectRatio: selectedRatio,
        imageSize: selectedSize,
        note: modelNote.trim() || undefined,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  // Enrich multi-channel technical documentation slides:
  // - mode 'online-search' (Priority 1): Uses Google Search grounding to proactively look up and standardize technical specs, dimensions, structure & schematics for the product.
  // - mode 'file-upload' (Method 2): Parses an uploaded product file (PDF, image, TXT, CSV, JSON) + optional notes with AI and maps standardized data to each required image slide.
  app.post('/api/gemini/enrich-technical-docs', async (req, res) => {
    try {
      const {
        mode = 'online-search',
        productName = '',
        modelCode = '',
        category = '',
        specs = [],
        productImageBase64,
        productImageMimeType,
        uploadedFileBase64,
        uploadedFileMimeType,
        uploadedFileName,
        uploadedTextContent,
      } = req.body as {
        mode?: 'online-search' | 'file-upload';
        productName?: string;
        modelCode?: string;
        category?: string;
        specs?: string[];
        productImageBase64?: string;
        productImageMimeType?: string;
        uploadedFileBase64?: string;
        uploadedFileMimeType?: string;
        uploadedFileName?: string;
        uploadedTextContent?: string;
      };

      const ai = getAiClient();
      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

      // Attach product photo if available so AI visually grounds ports, stages, gauges, and housing
      if (productImageBase64 && typeof productImageBase64 === 'string') {
        const cleanImg = productImageBase64.includes(',')
          ? productImageBase64.split(',')[1]
          : productImageBase64;
        const safeMime =
          productImageMimeType && productImageMimeType.startsWith('image/')
            ? productImageMimeType
            : 'image/jpeg';
        parts.push({
          inlineData: {
            data: cleanImg,
            mimeType: safeMime,
          },
        });
      }

      // If Method 2 (file-upload), attach the uploaded binary document (PDF or image)
      if (mode === 'file-upload' && uploadedFileBase64 && typeof uploadedFileBase64 === 'string') {
        const cleanDoc = uploadedFileBase64.includes(',')
          ? uploadedFileBase64.split(',')[1]
          : uploadedFileBase64;
        const docMime =
          uploadedFileMimeType &&
          (uploadedFileMimeType.startsWith('image/') ||
            uploadedFileMimeType === 'application/pdf' ||
            uploadedFileMimeType.startsWith('text/'))
            ? uploadedFileMimeType
            : 'application/pdf';
        parts.push({
          inlineData: {
            data: cleanDoc,
            mimeType: docMime,
          },
        });
      }

      const contextSummary = [
        `Tên sản phẩm: ${productName || 'Thiết bị xử lý nước VUTECH'}`,
        `Mã Model: ${modelCode || 'VUTECH'}`,
        `Chủng loại: ${category || 'Thiết bị & vật tư xử lý nước'}`,
        `Thông số hiện tại: ${Array.isArray(specs) ? specs.filter(Boolean).join(' | ') : ''}`,
        uploadedFileName ? `Tên file tài liệu tải lên: ${uploadedFileName}` : '',
        uploadedTextContent ? `Nội dung văn bản tài liệu tải lên:\n${uploadedTextContent.slice(0, 12000)}` : '',
      ]
        .filter(Boolean)
        .join('\n');

      const prompt =
        mode === 'online-search'
          ? `Bạn là Kỹ sư Trưởng ngành xử lý nước & thiết bị lọc nước của CÔNG TY TNHH XNK VUTECH.
Nhiệm vụ (Ưu tiên 1 - Tra cứu trực tuyến chủ động):
Hãy tìm kiếm thông tin kỹ thuật trực tuyến và kết hợp quan sát hình ảnh sản phẩm để chuẩn hóa bộ dữ liệu kỹ thuật đầy đủ, chính xác theo tiêu chuẩn ngành xử lý nước cho sản phẩm sau:
${contextSummary}

Yêu cầu bắt buộc:
1. Giữ chuẩn xác các đơn vị kỹ thuật ngành nước: L/h, m³/h, GPD, PSI, MPa, bar, mm, DN, inch, µm, µS/cm, V/Hz, kW.
2. Phân bổ dữ liệu chuyên biệt để đẩy trực tiếp vào từng mục hình ảnh của Bộ Quy Chuẩn Đa Kênh:
   - Chuẩn Shopee (Nhóm 02): Ngắn gọn, súc tích, dễ đọc trên điện thoại, TUYỆT ĐỐI KHÔNG chứa số điện thoại, website, email hoặc link ngoài sàn.
   - Chuẩn Website (Nhóm 03): Chuẩn hóa thông số kích thước, vật liệu và ứng dụng thực tế rõ ràng.
   - Chuẩn Kỹ thuật Công nghiệp (Nhóm 05): Đầy đủ thông số chuyên sâu, kích thước bản vẽ (Cao × Rộng × Sâu, cỡ ống kết nối DN/mm), cấu tạo cắt lớp từng tầng/vật liệu, sơ đồ nguyên lý dòng chảy (các bước xử lý nối tiếp nhau), và điều kiện vận hành/tiêu chuẩn chất lượng nước (예: QCVN 6-1:2010/BYT, QCVN 01-1:2018/BYT, ISO 9001:2015).

Hãy trả về DUY NHẤT một đối tượng JSON hợp lệ (không thêm giải thích ngoài JSON) theo cấu trúc sau:
{
  "standardizedProductName": "Tên sản phẩm chuẩn hóa (nếu cần tinh chỉnh)",
  "standardizedModelCode": "Mã model chuẩn",
  "coreSpecs": ["Thông số chính 1 (<28 ký tự)", "Thông số chính 2 (<28 ký tự)", "Thông số chính 3 (<28 ký tự)"],
  "sourceSummary": "Tóm tắt ngắn nguồn tiêu chuẩn kỹ thuật đã đối chiếu trực tuyến",
  "slides": {
    "sp-sub-02-spec-table": "3-4 dòng thông số bảng Shopee (mỗi dòng 1 thông số, không có SĐT/Web)",
    "sp-sub-03-dimensions": "3 dòng kích thước lắp đặt chuẩn Shopee: Kích thước tổng thể (D×R×C mm), Đường ống kết nối (DN/mm), Không gian lắp đặt khuyến nghị (không có SĐT/Web)",
    "sp-sub-04-materials": "3 dòng cấu tạo & vật liệu chế tạo chính (Inox 304/Composite FRP/Màng RO...)",
    "sp-sub-08-packaging-cert": "3 dòng quy cách đóng gói, phụ kiện đi kèm & tiêu chuẩn kiểm định chất lượng nước (không có SĐT/Web)",
    "web-05-specs-size": "3 dòng thông số & kích thước chuẩn hiển thị trên Website",
    "tech-02-deep-specs": "5-6 dòng thông số kỹ thuật chuyên sâu kèm đơn vị chuẩn (Công suất, Áp suất làm việc MPa/bar, Cỡ ống DN, Vật liệu, Điện áp/Công suất, Độ tinh lọc µm/TDS)",
    "tech-03-drawing": "5 dòng bản vẽ kích thước kỹ thuật: Kích thước phủ bì H×W×D (mm), Cổng nước cấp vào (DN/mm), Cổng nước thành phẩm (DN/mm), Cổng xả thải/xả rửa (DN/mm), Trọng lượng vận hành (kg)",
    "tech-04-cutaway": "5 dòng mô hình cắt lớp & cấu tạo bên trong theo thứ tự từ ngoài vào trong hoặc từ trên xuống dưới (Lớp 1, Lớp 2, Lớp 3, Cụm van/điều khiển, Đế/Khung chịu lực)",
    "tech-05-schematic": "5 dòng sơ đồ nguyên lý hoạt động & kết nối theo luồng: Bước 1 (Nguồn cấp) -> Bước 2 (Tiền xử lý/Lọc thô) -> Bước 3 (Cụm lọc chính/Màng) -> Bước 4 (Hoàn nguyên/Xả rửa) -> Bước 5 (Nước thành phẩm đạt chuẩn)",
    "tech-06-operating": "5 dòng điều kiện vận hành (Áp lực nước cấp, Nhiệt độ làm việc, Nguồn nước đầu vào, Chu kỳ bảo trì/súc rửa, Phạm vi ứng dụng công trình)"
  }
}`
          : `Bạn là Kỹ sư Trưởng ngành xử lý nước & thiết bị lọc nước của CÔNG TY TNHH XNK VUTECH.
Nhiệm vụ (Phương án 2 - Phân tích file tài liệu sản phẩm tải lên):
Hãy phân tích kỹ toàn bộ thông tin trong file/tài liệu người dùng vừa tải lên kết hợp với thông tin sản phẩm hiện tại:
${contextSummary}

Yêu cầu bắt buộc:
1. Trích xuất và chuẩn hóa chính xác dữ liệu từ tài liệu tải lên, giữ nguyên các đơn vị kỹ thuật ngành nước (L/h, m³/h, GPD, PSI, MPa, bar, mm, DN, µm, µS/cm).
2. Phân bổ đúng thông tin đã trích xuất vào từng mục hình ảnh để phục vụ yêu cầu riêng của từng quy chuẩn:
   - Nhóm 02 (Shopee): Không chứa SĐT/Website/Email/Link ngoài sàn, trình bày 3 dòng rõ ràng trên mỗi ảnh.
   - Nhóm 03 (Website): Tóm tắt kích thước & thông số thương mại rõ nét.
   - Nhóm 05 (Kỹ thuật Công nghiệp): Đầy đủ 5-6 dòng chi tiết cho Bảng thông số chuyên sâu, Bản vẽ kích thước (H×W×D mm, cổng DN), Cấu tạo cắt lớp, Sơ đồ nguyên lý kết nối và Điều kiện vận hành.

Hãy trả về DUY NHẤT một đối tượng JSON hợp lệ (không thêm văn bản ngoài JSON) theo cấu trúc sau:
{
  "standardizedProductName": "Tên sản phẩm trích xuất từ tài liệu",
  "standardizedModelCode": "Mã model trích xuất từ tài liệu",
  "coreSpecs": ["Thông số chính 1 (<28 ký tự)", "Thông số chính 2 (<28 ký tự)", "Thông số chính 3 (<28 ký tự)"],
  "sourceSummary": "Tóm tắt dữ liệu đã trích xuất từ file tài liệu tải lên",
  "slides": {
    "sp-sub-02-spec-table": "3-4 dòng thông số bảng Shopee (mỗi dòng 1 thông số, không có SĐT/Web)",
    "sp-sub-03-dimensions": "3 dòng kích thước & quy cách lắp đặt chuẩn Shopee (không có SĐT/Web)",
    "sp-sub-04-materials": "3 dòng cấu tạo & vật liệu chế tạo chính",
    "sp-sub-08-packaging-cert": "3 dòng quy cách đóng gói & tiêu chuẩn chất lượng/chứng nhận (không có SĐT/Web)",
    "web-05-specs-size": "3 dòng thông số & kích thước chuẩn Website",
    "tech-02-deep-specs": "5-6 dòng thông số kỹ thuật chuyên sâu kèm đơn vị chuẩn",
    "tech-03-drawing": "5 dòng thông số bản vẽ kích thước kỹ thuật (H×W×D mm, các cổng DN/mm, trọng lượng)",
    "tech-04-cutaway": "5 dòng cấu tạo cắt lớp & chi tiết linh kiện bên trong",
    "tech-05-schematic": "5 dòng sơ đồ nguyên lý hoạt động & luồng kết nối đường ống",
    "tech-06-operating": "5 dòng điều kiện vận hành & phạm vi ứng dụng"
  }
}`;

      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config:
          mode === 'online-search'
            ? {
                tools: [{ googleSearch: {} }],
              }
            : {
                responseMimeType: 'application/json',
              },
      });

      const rawText = (response.text ?? '').trim();
      const firstBrace = rawText.indexOf('{');
      const lastBrace = rawText.lastIndexOf('}');
      if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
        throw new Error('Mô hình AI không trả về đúng định dạng dữ liệu kỹ thuật JSON.');
      }

      const jsonStr = rawText.slice(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonStr) as {
        standardizedProductName?: string;
        standardizedModelCode?: string;
        coreSpecs?: string[];
        sourceSummary?: string;
        slides?: Record<string, string>;
      };

      // Extract web grounding sources if Google Search was used
      const groundingChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const webSources: Array<{ title: string; uri: string }> = [];
      for (const chunk of groundingChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (uri && !webSources.some((s) => s.uri === uri)) {
          webSources.push({
            title: title || uri,
            uri,
          });
        }
      }

      res.json({
        enrichment: {
          mode,
          standardizedProductName: parsed.standardizedProductName || productName,
          standardizedModelCode: parsed.standardizedModelCode || modelCode,
          coreSpecs: Array.isArray(parsed.coreSpecs) ? parsed.coreSpecs.slice(0, 3) : [],
          sourceSummary:
            parsed.sourceSummary ||
            (mode === 'online-search'
              ? 'Đã tra cứu trực tuyến và chuẩn hóa theo tiêu chuẩn thiết bị xử lý nước VUTECH.'
              : `Đã phân tích và trích xuất chuẩn dữ liệu từ tài liệu ${uploadedFileName || 'tải lên'}.`),
          slides: parsed.slides ?? {},
          webSources: webSources.slice(0, 5),
        },
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message, code: formatted.code });
    }
  });

  // Serve Vite middleware in development or static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VUTECH Brand Studio server listening on http://localhost:${PORT}`);
  });
}

startServer();
