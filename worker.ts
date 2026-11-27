/**
 * CLOUDFLARE WORKERS FULL-STACK ENTRYPOINT (`worker.ts`)
 * Phục vụ cho triển khai trực tiếp trên https://vutech-sudio.vutechwater.workers.dev/
 *
 * Chức năng:
 * 1. Đọc biến môi trường `env.GEMINI_API_KEY` từ Cloudflare Workers Secrets / Variables.
 * 2. Tự động tương thích cả model trên AI Studio (`gemini-4-hydrogen`, `gemini-3.1-flash-lite`)
 *    lẫn model Google Gemini API công khai (`gemini-2.5-flash`, `gemini-3.1-flash-lite-preview`)
 *    khi chạy trên Cloudflare Workers bằng API Key bên ngoài.
 * 3. Xử lý toàn bộ các API `/api/health`, `/api/gemini/recognize-product-v2`,
 *    `/api/gemini/analyze-product`, `/api/gemini/enrich-technical-docs`, `/api/gemini/image`.
 * 4. Phục vụ toàn bộ giao diện tĩnh React (`dist/`) thông qua binding `env.ASSETS`.
 */

export interface CloudflareWorkerEnv {
  GEMINI_API_KEY?: string;
  GEMINI_RECOGNITION_MODEL?: string;
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
}

interface DetailedGeminiError {
  httpStatus: number;
  errorCode: string;
  title: string;
  detailMessage: string;
  troubleshootingSteps: string[];
  retryAfterSeconds?: number;
}

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...CORS_HEADERS,
    },
  });
}

function getWorkerApiKey(env: CloudflareWorkerEnv): string {
  const key = (env?.GEMINI_API_KEY || '').trim();
  if (!key) {
    throw new Error('CAUSE_02_MISSING_API_KEY');
  }
  return key;
}

/**
 * Danh sách thứ tự model ưu tiên khi gọi Google Gemini REST API từ Cloudflare Workers.
 * Nếu tài khoản Google AI Studio bên ngoài chưa mở alias `gemini-4-hydrogen`,
 * Worker tự động chuyển sang model công khai `gemini-2.5-flash` hoặc `gemini-3.1-flash-lite-preview`
 * để đảm bảo không bao giờ bị lỗi 404 Model Not Found trên `*.workers.dev`.
 */
function getCandidateRecognitionModels(
  requestedModel?: string,
  envDefaultModel?: string,
): string[] {
  const candidates: string[] = [];
  if (envDefaultModel?.trim()) candidates.push(envDefaultModel.trim());

  if (requestedModel === 'gemini-3.1-flash-lite') {
    candidates.push('gemini-3.1-flash-lite-preview', 'gemini-2.5-flash', 'gemini-2.0-flash');
  } else {
    // Mặc định ưu tiên gemini-2.5-flash trên Cloudflare Workers vì tương thích 100% với mọi GEMINI_API_KEY
    candidates.push(
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite-preview',
      'gemini-2.0-flash',
    );
    if (requestedModel && !candidates.includes(requestedModel)) {
      candidates.push(requestedModel);
    }
  }
  return Array.from(new Set(candidates));
}

function classifyGeminiWorkerError(err: unknown): DetailedGeminiError {
  const raw = err instanceof Error ? err.message : String(err);
  const upper = raw.toUpperCase();

  if (raw === 'CAUSE_02_MISSING_API_KEY' || upper.includes('MISSING_API_KEY')) {
    return {
      httpStatus: 401,
      errorCode: 'CLOUDFLARE_SECRET_MISSING_API_KEY',
      title: 'HTTP 401 – Chưa cấu hình GEMINI_API_KEY trên Cloudflare Workers',
      detailMessage:
        'Worker trên vutech-sudio.vutechwater.workers.dev chưa đọc được biến GEMINI_API_KEY trong phần Variables and Secrets.',
      troubleshootingSteps: [
        'Mở Cloudflare Dashboard -> Workers & Pages -> chọn "vutech-sudio" -> Settings -> Variables and Secrets.',
        'Nhấn "+ Add" -> Chọn loại Secret (hoặc Text) -> Đặt Variable name là GEMINI_API_KEY -> Dán mã Gemini API Key của bạn vào và nhấn Deploy.',
        'Hoặc chạy lệnh trên terminal: npx wrangler secret put GEMINI_API_KEY',
        'Trong lúc chờ cấu hình, bạn có thể nhấn nút "4. Đối chiếu danh mục" ngay bên dưới để nạp thông số chuẩn VUTECH.',
      ],
    };
  }

  if (
    upper.includes('API_KEY_INVALID') ||
    upper.includes('INVALID API KEY') ||
    upper.includes('401') ||
    upper.includes('UNAUTHENTICATED')
  ) {
    return {
      httpStatus: 401,
      errorCode: 'INVALID_API_KEY',
      title: 'HTTP 401 – Lỗi xác thực: GEMINI_API_KEY trên Cloudflare không hợp lệ',
      detailMessage:
        'Mã GEMINI_API_KEY cấu hình trong Cloudflare Worker bị sai định dạng hoặc đã bị thu hồi.',
      troubleshootingSteps: [
        'Kiểm tra lại giá trị GEMINI_API_KEY trong Cloudflare Worker -> Settings -> Variables and Secrets.',
        'Sử dụng nút "4. Đối chiếu danh mục" để chọn nhanh sản phẩm từ danh mục VUTECH.',
      ],
    };
  }

  if (
    upper.includes('INVALID_ARGUMENT') ||
    upper.includes('MIME') ||
    upper.includes('BASE64') ||
    upper.includes('PAYLOAD') ||
    upper.includes('400')
  ) {
    return {
      httpStatus: 400,
      errorCode: 'INVALID_IMAGE_OR_REQUEST_PAYLOAD',
      title: 'HTTP 400 – Dữ liệu ảnh hoặc yêu cầu gửi lên không hợp lệ',
      detailMessage:
        'Định dạng ảnh (MIME type), chuỗi Base64 hoặc dung lượng ảnh vượt giới hạn.',
      troubleshootingSteps: [
        'Hãy sử dụng ảnh JPG, PNG hoặc WEBP có dung lượng dưới 10 MB.',
        'Nhấn "1. AI nhận diện lại" để hệ thống chuẩn hóa lại ảnh nhận diện.',
      ],
    };
  }

  if (upper.includes('403') || upper.includes('PERMISSION_DENIED')) {
    return {
      httpStatus: 403,
      errorCode: 'MODEL_PERMISSION_DENIED',
      title: 'HTTP 403 – API Key không có quyền truy cập Model này',
      detailMessage: raw.slice(0, 220),
      troubleshootingSteps: [
        'Thử chuyển Model nhận diện sang "gemini-3.1-flash-lite" trong bảng Cấu hình nhận diện.',
        'Hoặc sử dụng nút "4. Đối chiếu danh mục" để lấy thông tin chuẩn VUTECH.',
      ],
    };
  }

  if (upper.includes('404') || upper.includes('NOT_FOUND')) {
    return {
      httpStatus: 404,
      errorCode: 'MODEL_NOT_FOUND',
      title: 'HTTP 404 – Model AI không tồn tại hoặc chưa khả dụng với API Key này',
      detailMessage: raw.slice(0, 220),
      troubleshootingSteps: [
        'Thử đổi Model nhận diện trong danh sách hoặc nhấn "4. Đối chiếu danh mục".',
      ],
    };
  }

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
      detailMessage: `Tài khoản Gemini API đã vượt số lượt gọi trong phút/ngày.${
        retryMatch ? ` Có thể thử lại sau ${retryAfterSeconds} giây.` : ''
      }`,
      troubleshootingSteps: [
        `Chờ khoảng ${retryAfterSeconds} giây rồi nhấn "1. AI nhận diện lại".`,
        'Hoặc sử dụng ngay nút "4. Đối chiếu danh mục" để nạp thông số sản phẩm VUTECH mà không cần chờ quota.',
      ],
      retryAfterSeconds,
    };
  }

  return {
    httpStatus: 503,
    errorCode: 'UPSTREAM_AI_SERVICE_ERROR',
    title: 'HTTP 503 – Dịch vụ AI tạm thời quá tải hoặc gián đoạn kết nối',
    detailMessage: raw.slice(0, 240),
    troubleshootingSteps: [
      'Thử nhấn "1. AI nhận diện lại" sau vài giây.',
      'Hoặc chọn sản phẩm từ "4. Đối chiếu danh mục" VUTECH.',
    ],
  };
}

/**
 * Gọi trực tiếp Google Gemini REST API từ Cloudflare Worker (Edge Runtime tương thích 100%)
 * với cơ chế tự động fallback qua danh sách model khả dụng nếu gặp lỗi 404 Model Not Found.
 */
async function callGeminiGenerateContentOnEdge(params: {
  apiKey: string;
  candidateModels: string[];
  contents: unknown[];
  generationConfig?: Record<string, unknown>;
  tools?: unknown[];
}): Promise<{ data: Record<string, unknown>; usedModel: string }> {
  let lastErrorText = 'Không thể gọi Gemini API.';

  for (const modelName of params.candidateModels) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelName,
    )}:generateContent?key=${encodeURIComponent(params.apiKey)}`;

    const bodyPayload: Record<string, unknown> = {
      contents: params.contents,
    };
    if (params.generationConfig) {
      bodyPayload.generationConfig = params.generationConfig;
    }
    if (params.tools) {
      bodyPayload.tools = params.tools;
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(bodyPayload),
    });

    if (res.ok) {
      const data = (await res.json()) as Record<string, unknown>;
      return { data, usedModel: modelName };
    }

    const errText = await res.text().catch(() => `HTTP ${res.status}`);
    lastErrorText = `HTTP ${res.status} (${modelName}): ${errText}`;

    // Nếu lỗi 404 (model chưa hỗ trợ trên tài khoản này), tự động thử model tiếp theo trong danh sách
    if (res.status === 404) {
      continue;
    }

    // Các lỗi 400, 401, 403, 429 thì dừng ngay và báo chi tiết
    throw new Error(lastErrorText);
  }

  throw new Error(lastErrorText);
}

function extractTextFromGeminiRestResponse(data: Record<string, unknown>): string {
  const candidates = (data.candidates as Array<Record<string, unknown>>) || [];
  const content = (candidates[0]?.content as Record<string, unknown>) || {};
  const parts = (content.parts as Array<Record<string, unknown>>) || [];
  let text = '';
  for (const part of parts) {
    if (typeof part.text === 'string') {
      text += part.text;
    }
  }
  return text.trim();
}

function parseJsonFromModelText(rawText: string): Record<string, unknown> {
  const firstBrace = rawText.indexOf('{');
  const lastBrace = rawText.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('JSON_PARSE_ERROR: Mô hình AI không trả về đối tượng JSON hợp lệ.');
  }
  return JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
}

export default {
  async fetch(request: Request, env: CloudflareWorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    // Xử lý CORS Preflight cho mọi route /api/*
    if (request.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 1. Health Check endpoint để kiểm tra nhanh trên Cloudflare Workers
    if (url.pathname === '/api/health') {
      const hasApiKey = Boolean(env?.GEMINI_API_KEY && env.GEMINI_API_KEY.trim().length > 0);
      return jsonResponse({
        ok: true,
        runtime: 'cloudflare-workers',
        hasApiKey,
      });
    }

    // 2. SMART PRODUCT RECOGNITION ENGINE 2.0: POST /api/gemini/recognize-product-v2
    if (url.pathname === '/api/gemini/recognize-product-v2' && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          images?: Array<{ mimeType?: string; base64Data?: string }>;
          fileNames?: string[];
          recognitionModel?: string;
          mode?: 'full-recognition' | 'ocr-only';
        };

        const images = Array.isArray(body.images) ? body.images : [];
        if (images.length === 0) {
          return jsonResponse(
            {
              errorCode: 'EMPTY_IMAGE_LIST',
              error: 'HTTP 400 – Chưa có dữ liệu ảnh gốc để nhận diện',
              detailMessage: 'Vui lòng tải lên ít nhất 01 ảnh sản phẩm gốc.',
              troubleshootingSteps: ['Tải lên ảnh sản phẩm định dạng JPG, PNG hoặc WEBP.'],
            },
            400,
          );
        }

        const apiKey = getWorkerApiKey(env);
        const parts: Array<Record<string, unknown>> = [];

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
          return jsonResponse(
            {
              errorCode: 'INVALID_BASE64_DATA',
              error: 'HTTP 400 – Dữ liệu Base64 của ảnh sản phẩm không hợp lệ',
              detailMessage: 'Không tìm thấy chuỗi dữ liệu hình ảnh hợp lệ trong yêu cầu.',
              troubleshootingSteps: ['Kiểm tra lại file ảnh tải lên và thử lại.'],
            },
            400,
          );
        }

        const isMultiAngle = parts.length > 1;
        const promptText = `Bạn là Hệ thống Smart Product Recognition Engine 2.0 chuyên ngành vật tư, thiết bị và công nghệ xử lý nước của CÔNG TY TNHH XNK VUTECH.
${
  isMultiAngle
    ? `Người dùng đang cung cấp ${parts.length} ảnh góc chụp khác nhau của CÙNG MỘT SẢN PHẨM (mặt trước, mặt sau, tem nhãn, bao bì). Hãy hợp nhất toàn bộ chữ đọc được và thông số từ tất cả các ảnh. Nếu có thông tin mâu thuẫn giữa các ảnh, hãy ghi tên trường đó vào mảng conflictingFields.`
    : 'Hãy quan sát trực tiếp ảnh gốc của sản phẩm và tem nhãn/bao bì.'
}

QUY TẮC BẮT BUỘC (TUYỆT ĐỐI TUÂN THỦ):
1. ĐỌC CHỮ TRÊN TEM NHÃN / BAO BÌ TRƯỚC (OCR):
   - Trích xuất NGUYÊN VĂN toàn bộ các dòng chữ, thương hiệu, mã hiệu, quy cách đọc được trên bao bì/tem nhãn vào mảng "visibleText" (ví dụ: ["EXTREPURE", "001X7(C100)", "STRONG ACID CATION EXCHANGE RESIN", "25 LITERS"]).
2. KHÔNG BỊA ĐẶT THƯƠNG HIỆU HOẶC MODEL:
   - Nếu trên bao bì/tem nhãn ghi thương hiệu nhà sản xuất (ví dụ: EXTREPURE, FROTEC, RUNMO, RUNXIN, PUROLITE, DUPONT, FILMTEC, TORAY, HYDRANAUTICS, VONTRON, HONSUN, HUAMO, PENTAIR, CANATURE, CNP, GRUNDFOS, SEKO, CANPURE, IONPURE...), BẮT BUỘC giữ đúng thương hiệu đó trong trường "brand".
   - TUYỆT ĐỐI KHÔNG tự ý gắn "VUTECH" làm "brand" hoặc thay thế thương hiệu gốc trên bao bì bằng VUTECH.
   - TUYỆT ĐỐI KHÔNG tự sinh mã giả như "VT-01", "VT-02", "VT-03", "VT-xxxx".
   - Trường "rawModel" giữ nguyên văn mã in trên bao bì (ví dụ: "001X7(C100)"). Trường "model" chuẩn hóa ký hiệu (ví dụ: "001×7 (C100)", "1812-75 GPD", "XLPFT-8040", "F63B1", "KXA-200").
   - Nếu trên ảnh hoàn toàn không đọc được thương hiệu, trả về brand = "Chưa xác định thương hiệu" và fieldConfidence.brand = 0.35.
   - Nếu trên ảnh hoàn toàn không đọc được mã model, trả về model = "Chưa xác định model", rawModel = "" và fieldConfidence.model = 0.35.
3. PHÂN LOẠI CHÍNH XÁC VÀO 1 TRONG 10 NHÓM NGÀNH XỬ LÝ NƯỚC ("categoryId" và "category"):
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
4. CHUẨN HÓA TÊN SẢN PHẨM ("productName" và "shortName"):
   - Công thức: [Loại sản phẩm cụ thể] + [Thương hiệu] + [Model chuẩn].
   - Ví dụ bắt buộc: Nếu đọc được "EXTREPURE" + "001X7(C100)" -> productName = "Hạt Nhựa Cation EXTREPURE 001×7 (C100)", shortName = "Hạt Nhựa Cation EXTREPURE 001×7".
5. THÔNG SỐ KỸ THUẬT ĐỘNG THEO ĐÚNG CHỦNG LOẠI ("technicalSpecifications"):
   - Mỗi phần tử gồm: { "name": "...", "value": "...", "unit": "...", "source": "IMAGE_LABEL", "confidence": 0.95, "verified": true }.
   - TUYỆT ĐỐI KHÔNG gắn thông số điện/van tự động (như "Nguồn điện DC 12V - 1.5A", "3 chế độ lọc và sục rửa") cho bao Hạt nhựa trao đổi ion hoặc Vật liệu lọc.

Trả về DUY NHẤT một đối tượng JSON hợp lệ có đầy đủ các trường:
productName, shortName, brand, manufacturer, model, rawModel, sku, categoryId, category, subCategory, material, origin, packaging, applications (mảng chuỗi), visibleText (mảng chuỗi), technicalSpecifications (mảng object), confidence (số 0..1), fieldConfidence ({ brand, model, category, productName, specifications }), warnings (mảng chuỗi), conflictingFields (mảng chuỗi), subjectBox ({ x, y, w, h } chuẩn hóa 0..1).`;

        parts.push({ text: promptText });

        const candidateModels = getCandidateRecognitionModels(
          body.recognitionModel,
          env.GEMINI_RECOGNITION_MODEL,
        );

        const { data, usedModel } = await callGeminiGenerateContentOnEdge({
          apiKey,
          candidateModels,
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const rawText = extractTextFromGeminiRestResponse(data);
        const parsed = parseJsonFromModelText(rawText);

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

        return jsonResponse({
          ...parsed,
          mode: body.mode || 'full-recognition',
          fileNames: body.fileNames || [],
          recognitionModel: usedModel,
          recognizedAt: new Date().toISOString(),
        });
      } catch (err) {
        const classified = classifyGeminiWorkerError(err);
        return jsonResponse(
          {
            error: classified.title,
            errorCode: classified.errorCode,
            detailMessage: classified.detailMessage,
            troubleshootingSteps: classified.troubleshootingSteps,
            retryAfterSeconds: classified.retryAfterSeconds,
            apiError: {
              ...classified,
              timestamp: new Date().toISOString(),
            },
          },
          classified.httpStatus,
        );
      }
    }

    // 3. Tương thích ngược: POST /api/gemini/analyze-product
    if (url.pathname === '/api/gemini/analyze-product' && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          imageBase64?: string;
          mimeType?: string;
        };

        if (!body.imageBase64) {
          return jsonResponse({ error: 'Vui lòng cung cấp ảnh sản phẩm.' }, 400);
        }

        const apiKey = getWorkerApiKey(env);
        const cleanBase64 = body.imageBase64.includes(',')
          ? body.imageBase64.split(',')[1]
          : body.imageBase64;
        const safeMime =
          body.mimeType && body.mimeType.startsWith('image/') ? body.mimeType : 'image/jpeg';

        const promptText = `Bạn là hệ thống nhận diện sản phẩm ngành xử lý nước của Công ty TNHH XNK VUTECH.
Đọc chữ trên tem nhãn/bao bì (OCR) và trả về JSON:
{
  "productName": "Tên chuẩn hóa theo đúng loại sản phẩm + thương hiệu gốc + model",
  "modelCode": "Mã model chuẩn trên bao bì (để trống nếu không có, không tự bịa VT-01)",
  "category": "Nhóm sản phẩm xử lý nước",
  "specs": ["Thông số xác thực 1", "Thông số xác thực 2", "Thông số xác thực 3"],
  "tagline": "Mô tả kỹ thuật ngắn",
  "priceBadge": "Thương hiệu chính hãng",
  "facebookCaption": "Nội dung giới thiệu sản phẩm",
  "subjectBox": { "x": 0.12, "y": 0.08, "w": 0.76, "h": 0.84 }
}`;

        const candidateModels = getCandidateRecognitionModels(
          undefined,
          env.GEMINI_RECOGNITION_MODEL,
        );

        const { data } = await callGeminiGenerateContentOnEdge({
          apiKey,
          candidateModels,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType: safeMime, data: cleanBase64 } },
                { text: promptText },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        });

        const parsed = parseJsonFromModelText(extractTextFromGeminiRestResponse(data));
        return jsonResponse({ analysis: parsed });
      } catch (err) {
        const classified = classifyGeminiWorkerError(err);
        return jsonResponse(
          { error: `${classified.title}: ${classified.detailMessage}`, code: classified.errorCode },
          classified.httpStatus,
        );
      }
    }

    // 4. Tra cứu & Bổ sung Tài liệu Kỹ thuật Đa kênh: POST /api/gemini/enrich-technical-docs
    if (url.pathname === '/api/gemini/enrich-technical-docs' && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as {
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

        const mode = body.mode || 'online-search';
        const apiKey = getWorkerApiKey(env);
        const parts: Array<Record<string, unknown>> = [];

        if (body.productImageBase64) {
          const cleanImg = body.productImageBase64.includes(',')
            ? body.productImageBase64.split(',')[1]
            : body.productImageBase64;
          parts.push({
            inlineData: {
              data: cleanImg,
              mimeType:
                body.productImageMimeType && body.productImageMimeType.startsWith('image/')
                  ? body.productImageMimeType
                  : 'image/jpeg',
            },
          });
        }

        if (mode === 'file-upload' && body.uploadedFileBase64) {
          const cleanDoc = body.uploadedFileBase64.includes(',')
            ? body.uploadedFileBase64.split(',')[1]
            : body.uploadedFileBase64;
          parts.push({
            inlineData: {
              data: cleanDoc,
              mimeType: body.uploadedFileMimeType || 'application/pdf',
            },
          });
        }

        const contextSummary = [
          `Tên sản phẩm: ${body.productName || ''}`,
          `Mã Model: ${body.modelCode || ''}`,
          `Chủng loại: ${body.category || ''}`,
          `Thông số hiện tại: ${Array.isArray(body.specs) ? body.specs.filter(Boolean).join(' | ') : ''}`,
          body.uploadedFileName ? `Tên file tài liệu: ${body.uploadedFileName}` : '',
          body.uploadedTextContent ? `Nội dung tài liệu:\n${body.uploadedTextContent.slice(0, 12000)}` : '',
        ]
          .filter(Boolean)
          .join('\n');

        const prompt = `Bạn là Kỹ sư Trưởng ngành xử lý nước của CÔNG TY TNHH XNK VUTECH.
Hãy chuẩn hóa bộ dữ liệu kỹ thuật đầy đủ theo tiêu chuẩn ngành xử lý nước cho sản phẩm sau:
${contextSummary}

Trả về DUY NHẤT một đối tượng JSON hợp lệ theo cấu trúc:
{
  "standardizedProductName": "Tên sản phẩm chuẩn hóa",
  "standardizedModelCode": "Mã model chuẩn",
  "coreSpecs": ["Thông số chính 1", "Thông số chính 2", "Thông số chính 3"],
  "sourceSummary": "Tóm tắt nguồn tiêu chuẩn kỹ thuật đã đối chiếu",
  "slides": {
    "sp-sub-02-spec-table": "3-4 dòng thông số bảng Shopee (không có SĐT/Web)",
    "sp-sub-03-dimensions": "3 dòng kích thước lắp đặt chuẩn Shopee (không có SĐT/Web)",
    "sp-sub-04-materials": "3 dòng cấu tạo & vật liệu chế tạo chính",
    "sp-sub-08-packaging-cert": "3 dòng quy cách đóng gói & tiêu chuẩn chất lượng (không có SĐT/Web)",
    "web-05-specs-size": "3 dòng thông số & kích thước chuẩn Website",
    "tech-02-deep-specs": "5-6 dòng thông số kỹ thuật chuyên sâu kèm đơn vị chuẩn",
    "tech-03-drawing": "5 dòng bản vẽ kích thước kỹ thuật (H×W×D mm, các cổng DN/mm, trọng lượng)",
    "tech-04-cutaway": "5 dòng mô hình cắt lớp & cấu tạo bên trong",
    "tech-05-schematic": "5 dòng sơ đồ nguyên lý hoạt động & kết nối",
    "tech-06-operating": "5 dòng điều kiện vận hành & phạm vi ứng dụng"
  }
}`;

        parts.push({ text: prompt });

        const candidateModels = getCandidateRecognitionModels(
          undefined,
          env.GEMINI_RECOGNITION_MODEL,
        );

        const { data } = await callGeminiGenerateContentOnEdge({
          apiKey,
          candidateModels,
          contents: [{ role: 'user', parts }],
          generationConfig:
            mode === 'online-search'
              ? { temperature: 0.2 }
              : { responseMimeType: 'application/json', temperature: 0.1 },
          tools: mode === 'online-search' ? [{ googleSearch: {} }] : undefined,
        });

        const parsed = parseJsonFromModelText(extractTextFromGeminiRestResponse(data));

        return jsonResponse({
          enrichment: {
            mode,
            standardizedProductName: parsed.standardizedProductName || body.productName,
            standardizedModelCode: parsed.standardizedModelCode || body.modelCode,
            coreSpecs: Array.isArray(parsed.coreSpecs) ? parsed.coreSpecs.slice(0, 3) : [],
            sourceSummary:
              parsed.sourceSummary ||
              'Đã tra cứu và chuẩn hóa dữ liệu kỹ thuật theo tiêu chuẩn VUTECH.',
            slides: (parsed.slides as Record<string, string>) || {},
            webSources: [],
          },
        });
      } catch (err) {
        const classified = classifyGeminiWorkerError(err);
        return jsonResponse(
          { error: `${classified.title}: ${classified.detailMessage}`, code: classified.errorCode },
          classified.httpStatus,
        );
      }
    }

    // 5. Tạo & Chỉnh sửa ảnh AI: POST /api/gemini/image
    if (url.pathname === '/api/gemini/image' && request.method === 'POST') {
      try {
        const body = (await request.json().catch(() => ({}))) as {
          model?: string;
          prompt?: string;
          aspectRatio?: string;
          imageSize?: string;
          sourceImageBase64?: string;
          sourceMimeType?: string;
        };

        if (!body.prompt || body.prompt.trim().length < 3) {
          return jsonResponse(
            { error: 'Vui lòng nhập mô tả yêu cầu tạo hoặc chỉnh sửa hình ảnh.' },
            400,
          );
        }

        const apiKey = getWorkerApiKey(env);
        const parts: Array<Record<string, unknown>> = [];

        if (body.sourceImageBase64) {
          const cleanBase64 = body.sourceImageBase64.includes(',')
            ? body.sourceImageBase64.split(',')[1]
            : body.sourceImageBase64;
          parts.push({
            inlineData: {
              data: cleanBase64,
              mimeType:
                body.sourceMimeType && body.sourceMimeType.startsWith('image/')
                  ? body.sourceMimeType
                  : 'image/jpeg',
            },
          });
        }

        parts.push({
          text: `Commercial product photography for VUTECH water filtration equipment. ${body.prompt.trim()}`,
        });

        const candidateImageModels = [
          body.model || 'gemini-2.5-flash-image-preview',
          'gemini-2.0-flash-exp-image-generation',
        ];

        const { data, usedModel } = await callGeminiGenerateContentOnEdge({
          apiKey,
          candidateModels: candidateImageModels,
          contents: [{ role: 'user', parts }],
        });

        const candidates = (data.candidates as Array<Record<string, unknown>>) || [];
        const content = (candidates[0]?.content as Record<string, unknown>) || {};
        const resParts = (content.parts as Array<Record<string, unknown>>) || [];

        let imageDataUrl: string | null = null;
        let modelNote = '';

        for (const part of resParts) {
          const inline = part.inlineData as { data?: string; mimeType?: string } | undefined;
          if (inline?.data) {
            imageDataUrl = `data:${inline.mimeType || 'image/png'};base64,${inline.data}`;
          } else if (typeof part.text === 'string') {
            modelNote += part.text;
          }
        }

        if (!imageDataUrl) {
          return jsonResponse(
            {
              error:
                modelNote.trim() ||
                'Mô hình không trả về dữ liệu hình ảnh. Vui lòng kiểm tra quyền tạo ảnh của API Key.',
            },
            502,
          );
        }

        return jsonResponse({
          imageDataUrl,
          model: usedModel,
          aspectRatio: body.aspectRatio || '1:1',
          imageSize: body.imageSize || '2K',
          note: modelNote.trim() || undefined,
        });
      } catch (err) {
        const classified = classifyGeminiWorkerError(err);
        return jsonResponse(
          { error: `${classified.title}: ${classified.detailMessage}`, code: classified.errorCode },
          classified.httpStatus,
        );
      }
    }

    // 6. Phục vụ file tĩnh React SPA (dist/) từ Cloudflare Workers Assets Binding
    if (env?.ASSETS && typeof env.ASSETS.fetch === 'function') {
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status !== 404) {
        return assetRes;
      }
      // Fallback về index.html cho SPA routing
      const indexUrl = new URL('/index.html', request.url);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    return new Response(
      'VUTECH Studio Worker đang hoạt động. Hãy đảm bảo đã build thư mục dist (npm run build) khi deploy lên Cloudflare Workers.',
      { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  },
};
