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
