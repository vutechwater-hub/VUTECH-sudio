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

const ALLOWED_RECOGNITION_MODELS = new Set([
  'gemini-4-hydrogen',
  'gemini-3.1-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.1-flash-lite-preview',
]);

function getRecognitionFallbackOrder(requestedModel?: string): string[] {
  if (requestedModel === 'gemini-3.1-flash-lite') {
    return ['gemini-3.1-flash-lite', 'gemini-3.1-flash-lite-preview', 'gemini-2.5-flash', 'gemini-4-hydrogen'];
  }
  if (requestedModel === 'gemini-2.5-flash') {
    return ['gemini-2.5-flash', 'gemini-4-hydrogen', 'gemini-3.1-flash-lite-preview'];
  }
  return ['gemini-4-hydrogen', 'gemini-2.5-flash', 'gemini-3.1-flash-lite-preview'];
}

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

function resolveServerApiKey(): string {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.API_KEY,
    process.env.VITE_GEMINI_API_KEY,
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length > 5 && val.trim() !== 'MY_GEMINI_API_KEY') {
      return val.trim();
    }
  }
  return '';
}

function getAiClient(): GoogleGenAI {
  const apiKey = resolveServerApiKey();
  if (!apiKey) {
    throw new Error('CAUSE_02_MISSING_API_KEY');
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

interface DetailedGeminiError {
  httpStatus: number;
  errorCode: string;
  title: string;
  detailMessage: string;
  troubleshootingSteps: string[];
  retryAfterSeconds?: number;
}

/**
 * MỤC II: PHÂN LOẠI 15 NGUYÊN NHÂN LỖI API THEO MÃ HTTP & NỘI DUNG PHẢN HỒI THỰC TẾ
 */
function classifyGeminiErrorV2(err: unknown): DetailedGeminiError {
  const raw = err instanceof Error ? err.message : String(err);
  const upper = raw.toUpperCase();

  // Nguyên nhân 2 & 3: API key chưa được cấu hình hoặc biến môi trường / Secrets chưa đọc được
  if (raw === 'CAUSE_02_MISSING_API_KEY' || upper.includes('MISSING_API_KEY')) {
    return {
      httpStatus: 401,
      errorCode: 'API_KEY_NOT_CONFIGURED',
      title: 'HTTP 401 – Máy chủ chưa nhận được biến GEMINI_API_KEY',
      detailMessage:
        'Biến môi trường GEMINI_API_KEY chưa được thiết lập trên máy chủ đang chạy ứng dụng (hoặc bạn vừa thêm biến trên Cloudflare nhưng chưa Redeploy / đặt ở Build variables thay vì Runtime Variables).',
      troubleshootingSteps: [
        'Nếu đang chạy trên AI Studio: Mở Settings (biểu tượng bánh răng) -> Secrets -> thêm GEMINI_API_KEY.',
        'Nếu đang chạy trên Cloudflare Workers (vutech-sudio.vutechwater.workers.dev): Vào Workers & Pages -> vutech-sudio -> Settings -> Variables and Secrets (Runtime) -> thêm GEMINI_API_KEY và bấm Deploy.',
        'Đồng thời nhớ đồng bộ/Push code mới nhất từ AI Studio sang GitHub/Cloudflare để Worker nhận file worker.ts.',
      ],
    };
  }

  // Nguyên nhân 1: API key không hợp lệ (400 / 401 API_KEY_INVALID)
  if (upper.includes('API_KEY_INVALID') || upper.includes('INVALID API KEY') || upper.includes('401') || upper.includes('UNAUTHENTICATED')) {
    return {
      httpStatus: 401,
      errorCode: 'INVALID_API_KEY',
      title: 'HTTP 401 – Lỗi xác thực: API Key không hợp lệ',
      detailMessage:
        'GEMINI_API_KEY đang cấu hình không đúng định dạng hoặc đã bị thu hồi.',
      troubleshootingSteps: [
        'Kiểm tra lại giá trị GEMINI_API_KEY trong mục Settings > Secrets (không để thừa khoảng trắng hoặc ký tự lạ).',
        'Sử dụng nút "Đối chiếu danh mục" bên dưới để nạp thông số sản phẩm VUTECH mà không bị gián đoạn công việc.',
      ],
    };
  }

  // Nguyên nhân 9, 10, 11: Lỗi định dạng ảnh, MIME type, Base64 hoặc kích thước dữ liệu quá lớn (400)
  if (
    upper.includes('INVALID_ARGUMENT') ||
    upper.includes('MIME') ||
    upper.includes('BASE64') ||
    upper.includes('PAYLOAD') ||
    upper.includes('TOO LARGE') ||
    upper.includes('400')
  ) {
    return {
      httpStatus: 400,
      errorCode: 'INVALID_IMAGE_OR_REQUEST_PAYLOAD',
      title: 'HTTP 400 – Dữ liệu ảnh hoặc yêu cầu gửi lên không hợp lệ',
      detailMessage:
        'Định dạng ảnh (MIME type), chuỗi Base64 hoặc dung lượng dữ liệu gửi tới Gemini API không hợp lệ.',
      troubleshootingSteps: [
        'Hãy sử dụng ảnh định dạng chuẩn JPG, PNG hoặc WEBP có kích thước dưới 10 MB.',
        'Nhấn "AI nhận diện lại" để hệ thống tự động chuẩn hóa lại bản sao ảnh nhận diện.',
      ],
    };
  }

  // Nguyên nhân 4 & 8: API key không có quyền truy cập model hoặc tài khoản chưa đủ điều kiện (403)
  if (upper.includes('403') || upper.includes('PERMISSION_DENIED') || upper.includes('BILLING')) {
    return {
      httpStatus: 403,
      errorCode: 'MODEL_PERMISSION_DENIED',
      title: 'HTTP 403 – Không có quyền truy cập Model AI này',
      detailMessage:
        'API Key hiện tại không có quyền gọi model được chọn hoặc tài khoản chưa bật quyền tương ứng.',
      troubleshootingSteps: [
        'Thử chuyển Model nhận diện sang "gemini-3.1-flash-lite" hoặc "gemini-4-hydrogen" trong bảng Cấu hình nhận diện.',
        'Hoặc sử dụng "Đối chiếu danh mục" để lấy thông tin chuẩn xác từ danh mục VUTECH.',
      ],
    };
  }

  // Nguyên nhân 5: Model đã ngừng hỗ trợ hoặc tên model không hợp lệ (404)
  if (upper.includes('404') || upper.includes('NOT_FOUND') || upper.includes('IS NOT FOUND')) {
    return {
      httpStatus: 404,
      errorCode: 'MODEL_NOT_FOUND',
      title: 'HTTP 404 – Model AI không tồn tại hoặc không khả dụng',
      detailMessage:
        'Tên model yêu cầu không tồn tại trên vùng máy chủ hiện tại.',
      troubleshootingSteps: [
        'Chọn model nhận diện khác ("gemini-4-hydrogen" hoặc "gemini-3.1-flash-lite") trong mục Model Nhận Diện AI.',
        'Không ảnh hưởng tới dữ liệu sản phẩm: bạn có thể chọn nhanh sản phẩm trong "Đối chiếu danh mục".',
      ],
    };
  }

  // Nguyên nhân 6 & 7: Vượt giới hạn quota hoặc giới hạn RPM/RPD (429)
  if (
    upper.includes('429') ||
    upper.includes('RESOURCE_EXHAUSTED') ||
    upper.includes('QUOTA') ||
    upper.includes('RATE_LIMIT')
  ) {
    const retryMatch = raw.match(/retry in (\d+(\.\d+)?)s/i);
    const retryAfterSeconds = retryMatch ? Math.ceil(Number(retryMatch[1])) : 15;
    return {
      httpStatus: 429,
      errorCode: 'QUOTA_OR_RATE_LIMIT_EXCEEDED',
      title: 'HTTP 429 – Vượt hạn mức Quota hoặc giới hạn tần suất gọi API (RPM/RPD)',
      detailMessage:
        `Tài khoản API đã vượt số lượt gọi cho phép trong phút/ngày. ${retryMatch ? `Có thể thử lại sau ${retryAfterSeconds} giây.` : ''}`,
      troubleshootingSteps: [
        `Chờ khoảng ${retryAfterSeconds} giây rồi nhấn "AI nhận diện lại", hoặc chuyển sang model nhẹ "gemini-3.1-flash-lite".`,
        'Sử dụng ngay tính năng "Đối chiếu danh mục" hoặc nhập Thương hiệu + Model để chuẩn hóa tự động không cần chờ quota.',
      ],
      retryAfterSeconds,
    };
  }

  // Nguyên nhân 12: Lỗi phân tích JSON trả về từ AI
  if (upper.includes('JSON') || upper.includes('SYNTAXERROR') || upper.includes('UNEXPECTED TOKEN')) {
    return {
      httpStatus: 500,
      errorCode: 'AI_JSON_PARSE_ERROR',
      title: 'HTTP 500 – Lỗi cấu trúc dữ liệu JSON trả về từ AI',
      detailMessage:
        'Phản hồi từ mô hình AI bị cắt ngang hoặc không đúng định dạng JSON Schema.',
      troubleshootingSteps: [
        'Nhấn "AI nhận diện lại" để thực hiện lại lượt trích xuất có kiểm soát Schema.',
        'Hoặc chọn sản phẩm từ "Đối chiếu danh mục" VUTECH.',
      ],
    };
  }

  // Nguyên nhân 15: Lỗi kết nối mạng hoặc timeout / 500 / 503
  return {
    httpStatus: 503,
    errorCode: 'UPSTREAM_AI_SERVICE_ERROR',
    title: 'HTTP 503 – Dịch vụ AI tạm thời quá tải hoặc gián đoạn kết nối',
    detailMessage: `Chi tiết phản hồi máy chủ: ${raw.slice(0, 220)}`,
    troubleshootingSteps: [
      'Thử nhấn "AI nhận diện lại" sau vài giây hoặc đổi sang model "gemini-3.1-flash-lite".',
      'Sử dụng nút "Đối chiếu danh mục" để tra cứu trực tiếp danh mục vật tư xử lý nước VUTECH.',
    ],
  };
}

function formatGeminiError(err: unknown): { status: number; message: string; code: string } {
  const classified = classifyGeminiErrorV2(err);
  return {
    status: classified.httpStatus,
    code: classified.errorCode,
    message: `${classified.title}: ${classified.detailMessage}`,
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '35mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, hasApiKey: Boolean(process.env.GEMINI_API_KEY) });
  });

  /**
   * SMART PRODUCT RECOGNITION ENGINE 2.0 ENDPOINT
   * Tách biệt hoàn toàn khỏi module tạo ảnh (Image Generation).
   * Hỗ trợ:
   * - Nhận diện 1 ảnh gốc (Chế độ B) hoặc kết hợp 1–5 ảnh nhiều góc chụp của cùng 1 sản phẩm (Chế độ A)
   * - Đọc nguyên văn toàn bộ chữ trên tem nhãn/bao bì (visibleText)
   * - Không bao giờ tự bịa mã VT-01, VT-02 hoặc tự gắn thương hiệu VUTECH thay cho thương hiệu gốc trên bao bì
   */
  app.post('/api/gemini/recognize-product-v2', async (req, res) => {
    try {
      const {
        images = [],
        fileNames = [],
        recognitionModel = 'gemini-4-hydrogen',
        mode = 'full-recognition',
      } = req.body as {
        images?: Array<{ mimeType?: string; base64Data?: string }>;
        fileNames?: string[];
        recognitionModel?: string;
        mode?: 'full-recognition' | 'ocr-only';
      };

      if (!Array.isArray(images) || images.length === 0) {
        res.status(400).json({
          errorCode: 'EMPTY_IMAGE_LIST',
          error: 'HTTP 400 – Chưa có dữ liệu ảnh gốc để nhận diện',
          detailMessage: 'Vui lòng tải lên ít nhất 01 ảnh sản phẩm gốc.',
          troubleshootingSteps: ['Tải lên ảnh sản phẩm định dạng JPG, PNG hoặc WEBP.'],
        });
        return;
      }

      const selectedModel = ALLOWED_RECOGNITION_MODELS.has(recognitionModel)
        ? recognitionModel
        : 'gemini-4-hydrogen';

      const ai = getAiClient();
      const parts: Array<{ text: string } | { inlineData: { data: string; mimeType: string } }> = [];

      for (const img of images.slice(0, 5)) {
        const b64 = (img.base64Data || '').trim();
        if (!b64) continue;
        const cleanBase64 = b64.includes(',') ? b64.split(',')[1] : b64;
        const safeMime =
          img.mimeType && img.mimeType.startsWith('image/') ? img.mimeType : 'image/jpeg';
        parts.push({
          inlineData: {
            mimeType: safeMime,
            data: cleanBase64,
          },
        });
      }

      if (parts.length === 0) {
        res.status(400).json({
          errorCode: 'INVALID_BASE64_DATA',
          error: 'HTTP 400 – Dữ liệu Base64 của ảnh sản phẩm không hợp lệ',
          detailMessage: 'Không tìm thấy chuỗi dữ liệu hình ảnh hợp lệ trong yêu cầu.',
          troubleshootingSteps: ['Kiểm tra lại file ảnh tải lên và thử lại.'],
        });
        return;
      }

      const isMultiAngle = parts.length > 1;
      const promptText = `Bạn là Hệ thống Smart Product Recognition Engine 2.0 kết hợp Tra cứu Trực tuyến (Google Search Grounding) chuyên ngành vật tư, thiết bị và công nghệ xử lý nước của CÔNG TY TNHH XNK VUTECH.
${isMultiAngle ? `Người dùng đang cung cấp ${parts.length} ảnh góc chụp khác nhau của CÙNG MỘT SẢN PHẨM. Hãy hợp nhất toàn bộ chữ đọc được và thông số từ tất cả các ảnh.` : 'Hãy quan sát trực tiếp ảnh gốc của sản phẩm, đọc toàn bộ chữ trên tem nhãn/bao bì/thân thiết bị và CHỦ ĐỘNG TÌM KIẾM TRÊN MẠNG (Google Search) thông tin kỹ thuật thực tế của sản phẩm đó.'}

NHIỆM VỤ BẮT BUỘC (LINH ĐỘNG VỚI BẤT KỲ SẢN PHẨM NÀO ĐƯỢC TẢI LÊN):
1. ĐỌC CHỮ TRÊN TEM NHÃN / BAO BÌ / THÂN MÁY (OCR):
   - Trích xuất NGUYÊN VĂN mọi dòng chữ, thương hiệu, mã model, thông số in trên ảnh vào mảng "visibleText".
2. CHỦ ĐỘNG TRA CỨU TRỰC TUYẾN CHO BẤT KỲ SẢN PHẨM MỚI NÀO:
   - Ngay khi đọc được Thương hiệu + Mã Model (hoặc nhìn thấy hình dáng thiết bị/vật tư bất kỳ của bất kỳ hãng nào trên thị trường), hãy chủ động dùng công cụ tìm kiếm trực tuyến để tra cứu đúng Datasheet / thông số kỹ thuật chuẩn của sản phẩm đó trên mạng.
   - Giữ đúng Thương hiệu nhà sản xuất gốc trong trường "brand" và mã model gốc trong "rawModel", mã model chuẩn hóa trong "model".
   - Tuyệt đối không tự bịa mã giả "VT-01", "VT-02".
3. PHÂN LOẠI VÀO 1 TRONG 10 NHÓM NGÀNH XỬ LÝ NƯỚC ("categoryId" và "category"):
   - "01_ro_membrane": "Màng lọc RO"
   - "02_uf_membrane": "Màng lọc UF"
   - "03_ion_resin": "Hạt nhựa trao đổi ion"
   - "04_filter_media": "Vật liệu lọc nước"
   - "05_vessels_tanks": "Cột lọc và bồn chứa"
   - "06_control_valves": "Van điều khiển"
   - "07_membrane_housings": "Vỏ màng lọc"
   - "08_edi_equipment": "Thiết bị EDI"
   - "09_auxiliary_equipment": "Thiết bị phụ trợ"
   - "10_complete_systems": "Hệ thống xử lý nước hoàn chỉnh"
4. TỰ ĐỘNG CHUẨN HÓA TÊN VÀ ĐIỀN ĐẦY ĐỦ CÁC VỊ TRÍ CẦN THIẾT:
   - "productName": [Loại sản phẩm cụ thể] + [Thương hiệu] + [Model chuẩn] + [Thông số phân biệt chính nếu có].
   - "shortName": Tên ngắn gọn súc tích để hiển thị đẹp trên banner thiết kế.
   - "technicalSpecifications": Điền đầy đủ 3 đến 6 thông số kỹ thuật thực tế chính xác nhất của sản phẩm đó (từ chữ trên ảnh kết hợp tra cứu datasheet trực tuyến trên mạng), mỗi thông số có { "name": "...", "value": "...", "unit": "...", "source": "IMAGE_LABEL" hoặc "DATASHEET", "confidence": 0.95, "verified": true }.
   - "applications": Các ứng dụng thực tế của sản phẩm.
   - "subjectBox": Tọa độ vùng sản phẩm chính trong ảnh từ 0.0 đến 1.0 ({ "x": 0.12, "y": 0.08, "w": 0.76, "h": 0.84 }).

Trả về DUY NHẤT một đối tượng JSON hợp lệ (không bọc giải thích thừa bên ngoài) theo đúng cấu trúc:
{
  "productName": "...",
  "shortName": "...",
  "brand": "...",
  "manufacturer": "...",
  "model": "...",
  "rawModel": "...",
  "sku": "...",
  "categoryId": "...",
  "category": "...",
  "subCategory": "...",
  "material": "...",
  "origin": "...",
  "packaging": "...",
  "applications": ["..."],
  "visibleText": ["..."],
  "technicalSpecifications": [
    { "name": "...", "value": "...", "unit": "...", "source": "DATASHEET", "confidence": 0.95, "verified": true }
  ],
  "confidence": 0.96,
  "fieldConfidence": {
    "brand": 0.96,
    "model": 0.96,
    "category": 0.96,
    "productName": 0.96,
    "specifications": 0.95
  },
  "warnings": [],
  "conflictingFields": [],
  "subjectBox": { "x": 0.12, "y": 0.08, "w": 0.76, "h": 0.84 }
}`;

      parts.push({ text: promptText });

      const fallbackCandidates = getRecognitionFallbackOrder(selectedModel);
      let responseText = '{}';
      let usedModelName = selectedModel;
      let lastErr: unknown = null;

      // Bước 1: Ưu tiên gọi model kết hợp Google Search Grounding để tra cứu trực tuyến bất kỳ sản phẩm nào
      for (const candidateModel of fallbackCandidates) {
        try {
          const response = await ai.models.generateContent({
            model: candidateModel,
            contents: { parts },
            config: {
              tools: [{ googleSearch: {} }],
            },
          });
          const rawCandidateText = (response.text ?? '').trim();
          const firstB = rawCandidateText.indexOf('{');
          const lastB = rawCandidateText.lastIndexOf('}');
          if (firstB !== -1 && lastB > firstB) {
            responseText = rawCandidateText.slice(firstB, lastB + 1);
            usedModelName = `${candidateModel} + Google Search`;
            lastErr = null;
            break;
          }
        } catch {
          // Nếu model/môi trường không hỗ trợ đồng thời googleSearch + multimodal, chuyển sang Bước 2 structured JSON
          continue;
        }
      }

      // Bước 2: Nếu Bước 1 chưa lấy được JSON, gọi chế độ Structured JSON Schema chuẩn
      if (responseText === '{}') {
        for (const candidateModel of fallbackCandidates) {
          try {
            const response = await ai.models.generateContent({
              model: candidateModel,
              contents: { parts },
              config: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    productName: { type: Type.STRING },
                    shortName: { type: Type.STRING },
                    brand: { type: Type.STRING },
                    manufacturer: { type: Type.STRING },
                    model: { type: Type.STRING },
                    rawModel: { type: Type.STRING },
                    sku: { type: Type.STRING },
                    categoryId: { type: Type.STRING },
                    category: { type: Type.STRING },
                    subCategory: { type: Type.STRING },
                    material: { type: Type.STRING },
                    origin: { type: Type.STRING },
                    packaging: { type: Type.STRING },
                    applications: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    visibleText: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    technicalSpecifications: {
                      type: Type.ARRAY,
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          name: { type: Type.STRING },
                          value: { type: Type.STRING },
                          unit: { type: Type.STRING },
                          source: { type: Type.STRING },
                          confidence: { type: Type.NUMBER },
                          verified: { type: Type.BOOLEAN },
                        },
                        required: ['name', 'value', 'source', 'confidence', 'verified'],
                      },
                    },
                    confidence: { type: Type.NUMBER },
                    fieldConfidence: {
                      type: Type.OBJECT,
                      properties: {
                        brand: { type: Type.NUMBER },
                        model: { type: Type.NUMBER },
                        category: { type: Type.NUMBER },
                        productName: { type: Type.NUMBER },
                        specifications: { type: Type.NUMBER },
                      },
                      required: ['brand', 'model', 'category', 'productName', 'specifications'],
                    },
                    warnings: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    conflictingFields: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
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
                    'shortName',
                    'brand',
                    'model',
                    'rawModel',
                    'categoryId',
                    'category',
                    'subCategory',
                    'visibleText',
                    'technicalSpecifications',
                    'confidence',
                    'fieldConfidence',
                    'subjectBox',
                  ],
                },
              },
            });
            responseText = (response.text ?? '{}').trim();
            usedModelName = candidateModel;
            lastErr = null;
            break;
          } catch (err) {
            lastErr = err;
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes('404') || msg.includes('NOT_FOUND')) {
              continue;
            }
            throw err;
          }
        }
      }

      if (lastErr && responseText === '{}') {
        throw lastErr;
      }

      const parsed = JSON.parse(responseText) as Record<string, unknown>;

      // Chuẩn hóa subjectBox nếu AI trả về 0..100 thay vì 0..1
      if (parsed.subjectBox && typeof parsed.subjectBox === 'object') {
        const sb = parsed.subjectBox as Record<string, number>;
        if ((sb.w ?? 0) > 1.5 || (sb.h ?? 0) > 1.5 || (sb.x ?? 0) > 1.5 || (sb.y ?? 0) > 1.5) {
          parsed.subjectBox = {
            x: Number(((sb.x || 0) / 100).toFixed(3)),
            y: Number(((sb.y || 0) / 100).toFixed(3)),
            w: Number(((sb.w || 76) / 100).toFixed(3)),
            h: Number(((sb.h || 76) / 100).toFixed(3)),
          };
        }
      }

      res.json({
        ...parsed,
        mode,
        fileNames,
        recognitionModel: usedModelName,
        recognizedAt: new Date().toISOString(),
      });
    } catch (err) {
      const classified = classifyGeminiErrorV2(err);
      res.status(classified.httpStatus).json({
        error: classified.title,
        errorCode: classified.errorCode,
        detailMessage: classified.detailMessage,
        troubleshootingSteps: classified.troubleshootingSteps,
        retryAfterSeconds: classified.retryAfterSeconds,
        apiError: {
          ...classified,
          timestamp: new Date().toISOString(),
        },
      });
    }
  });

  /**
   * ENDPOINT TRA CỨU TRỰC TUYẾN MỞ (KHÔNG CẦN API KEY):
   * Khi chưa có GEMINI_API_KEY, sau khi trình duyệt quét OCR đọc được chữ trên tem nhãn của BẤT KỲ sản phẩm nào,
   * endpoint này tự động truy vấn thông tin kỹ thuật trực tuyến trên mạng theo các cụm chữ OCR đó
   * để trích xuất thông số thực tế (Công suất, Lưu lượng, Kích thước, Áp suất, Vật liệu, Quy cách...).
   */
  app.post('/api/open-web/search-product-specs', async (req, res) => {
    try {
      const { query, visibleText = [] } = req.body as {
        query?: string;
        visibleText?: string[];
      };

      const searchTerms = (query || visibleText.slice(0, 5).join(' ')).trim();
      if (!searchTerms || searchTerms.length < 2) {
        res.json({ snippets: [] });
        return;
      }

      const searchQuery = `${searchTerms} water treatment specifications thông số kỹ thuật`;
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(searchQuery)}`;
      const response = await fetch(ddgUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      const html = await response.text();
      const snippets: string[] = [];
      const snippetRegex = /class="result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
      let match: RegExpExecArray | null;
      while ((match = snippetRegex.exec(html)) !== null && snippets.length < 8) {
        const clean = match[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/&#x27;/g, "'")
          .replace(/\s+/g, ' ')
          .trim();
        if (clean.length > 20) {
          snippets.push(clean);
        }
      }

      res.json({ query: searchTerms, snippets });
    } catch {
      res.json({ snippets: [] });
    }
  });

  // Giữ tương thích ngược cho endpoint cũ /api/gemini/analyze-product nhưng bỏ hoàn toàn prompt ép gán VUTECH / VT-xxxx
  app.post('/api/gemini/analyze-product', async (req, res) => {
    try {
      const { imageBase64, mimeType } = req.body as {
        imageBase64?: string;
        mimeType?: string;
      };

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'Vui lòng cung cấp ảnh sản phẩm để phân tích.' });
        return;
      }

      const ai = getAiClient();
      const cleanBase64 = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      const safeMime = mimeType && mimeType.startsWith('image/') ? mimeType : 'image/jpeg';

      const promptText = `Bạn là hệ thống nhận diện sản phẩm ngành xử lý nước của Công ty TNHH XNK VUTECH.
Hãy đọc chữ trên tem nhãn/bao bì trước (OCR) và nhận diện chính xác:
- Không tự bịa mã VT-01, VT-02. Nếu trên tem có model (ví dụ: 001X7(C100), F63B1, XLPFT-8040), chuẩn hóa thành modelCode (ví dụ: "001×7 (C100)"). Nếu không có chữ model trên ảnh, để modelCode = "".
- Giữ đúng thương hiệu gốc trên bao bì (ví dụ: EXTREPURE, FROTEC, RUNXIN, PUROLITE...). Không thay thương hiệu nhà sản xuất bằng VUTECH.
- Chỉ trích xuất các thông số thực sự phù hợp với đúng loại sản phẩm đó.`;

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
