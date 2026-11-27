import { useRef, useState } from 'react';
import {
  Wand2,
  Upload,
  Download,
  ArrowRight,
  AlertCircle,
  Loader2,
  ImagePlus,
} from 'lucide-react';
import { AI_PROMPT_RECIPES, ASPECT_RATIOS, RESOLUTIONS } from '../constants/vutech';
import type {
  AiGeneratedItem,
  AiModelOption,
  AspectRatioOption,
  ResolutionOption,
} from '../types/studio';

interface AiImageStudioProps {
  currentStudioImageUrl: string;
  history: AiGeneratedItem[];
  onAddHistory: (item: AiGeneratedItem) => void;
  onApplyToBrandStudio: (imageDataUrl: string, label: string) => void;
}

async function imageUrlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  if (url.startsWith('data:')) {
    const match = url.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (match) {
      return { mimeType: match[1], base64: match[2] };
    }
  }
  const resp = await fetch(url);
  const blob = await resp.blob();
  const mimeType = blob.type || 'image/jpeg';
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({ base64, mimeType });
    };
    reader.onerror = () => reject(new Error('Không thể đọc dữ liệu ảnh nguồn'));
    reader.readAsDataURL(blob);
  });
}

export function AiImageStudio({
  currentStudioImageUrl,
  history,
  onAddHistory,
  onApplyToBrandStudio,
}: AiImageStudioProps) {
  const [mode, setMode] = useState<'edit' | 'generate'>('edit');
  const [model, setModel] = useState<AiModelOption>('gemini-nano-banana-2.1');
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('1:1');
  const [imageSize, setImageSize] = useState<ResolutionOption>('2K');
  const [prompt, setPrompt] = useState(AI_PROMPT_RECIPES[0].prompt);
  const [sourcePreviewUrl, setSourcePreviewUrl] = useState<string>(currentStudioImageUrl);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeResult, setActiveResult] = useState<AiGeneratedItem | null>(history[0] ?? null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleUploadSource = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSourcePreviewUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    setErrorMessage(null);

    try {
      let sourceImageBase64: string | undefined;
      let sourceMimeType: string | undefined;

      if (mode === 'edit' && sourcePreviewUrl) {
        const converted = await imageUrlToBase64(sourcePreviewUrl);
        sourceImageBase64 = converted.base64;
        sourceMimeType = converted.mimeType;
      }

      const response = await fetch('/api/gemini/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          prompt: prompt.trim(),
          aspectRatio,
          imageSize,
          sourceImageBase64,
          sourceMimeType,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.imageDataUrl) {
        setErrorMessage(
          data.error ||
            'Không thể khởi tạo hình ảnh AI lúc này. Vui lòng kiểm tra kết nối hoặc API key.'
        );
        return;
      }

      const newItem: AiGeneratedItem = {
        id: `ai-${Date.now()}`,
        createdAt: new Date().toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        imageDataUrl: data.imageDataUrl,
        prompt: prompt.trim(),
        model,
        aspectRatio,
        imageSize,
        mode,
      };
      setActiveResult(newItem);
      onAddHistory(newItem);
    } catch {
      setErrorMessage('Lỗi kết nối tới máy chủ xử lý ảnh AI. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadResult = (item: AiGeneratedItem) => {
    const link = document.createElement('a');
    link.href = item.imageDataUrl;
    link.download = `VUTECH_AI_${item.aspectRatio.replace(':', 'x')}_${item.imageSize}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredRecipes = AI_PROMPT_RECIPES.filter((r) =>
    mode === 'edit' ? r.forEdit : !r.forEdit
  );

  return (
    <div className="max-w-[1380px] mx-auto px-6 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Tạo & Chỉnh Sửa Ảnh Sản Phẩm Bằng AI
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Thay nền studio, dựng bối cảnh lắp đặt thực tế hoặc tạo ảnh thiết bị lọc nước sắc nét từ 1K đến 4K, sau đó đưa sang Studio để gắn logo chính thức VUTECH.
          </p>
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          Model hỗ trợ: gemini-nano-banana-2.1 · gemini-3-pro-image
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Control Form */}
        <form
          onSubmit={handleGenerate}
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          {/* Mode Switch */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setMode('edit');
                setPrompt(AI_PROMPT_RECIPES[0].prompt);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'edit'
                  ? 'bg-white text-[#0052B4] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Chỉnh sửa từ ảnh sản phẩm
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('generate');
                const genRecipe = AI_PROMPT_RECIPES.find((r) => !r.forEdit);
                if (genRecipe) setPrompt(genRecipe.prompt);
              }}
              className={`py-2 px-3 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mode === 'generate'
                  ? 'bg-white text-[#0052B4] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tạo hình ảnh mới từ mô tả
            </button>
          </div>

          {/* Source Image Picker when in Edit mode */}
          {mode === 'edit' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">Ảnh sản phẩm đầu vào</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSourcePreviewUrl(currentStudioImageUrl)}
                    className="text-xs font-semibold text-[#0052B4] hover:underline cursor-pointer"
                  >
                    Dùng ảnh đang sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-[#0052B4] cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Tải ảnh khác</span>
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadSource}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <img
                  src={sourcePreviewUrl}
                  alt="Ảnh gốc đầu vào cho AI"
                  referrerPolicy="no-referrer"
                  className="w-16 h-16 rounded-md object-cover bg-white border border-slate-200 shrink-0"
                />
                <p className="text-xs text-slate-600 leading-relaxed">
                  AI sẽ giữ nguyên hình dáng thực tế của thiết bị lọc nước và thay đổi ánh sáng, phông nền hoặc không gian theo yêu cầu bên dưới.
                </p>
              </div>
            </div>
          )}

          {/* AI Model Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">Mô hình AI hình ảnh</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setModel('gemini-nano-banana-2.1')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  model === 'gemini-nano-banana-2.1'
                    ? 'border-[#0052B4] bg-[#0052B4]/6'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">Nano Banana 2.1</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Tạo & chỉnh sửa đa năng 1K–4K
                </div>
              </button>
              <button
                type="button"
                onClick={() => setModel('gemini-3-pro-image')}
                className={`p-3 rounded-lg border text-left transition-colors cursor-pointer ${
                  model === 'gemini-3-pro-image'
                    ? 'border-[#0052B4] bg-[#0052B4]/6'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">Gemini 3 Pro Image</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Chất lượng Studio thương mại cao nhất
                </div>
              </button>
            </div>
          </div>

          {/* Aspect Ratio (8 options) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800">Tỷ lệ khung hình</label>
              <span className="font-mono text-xs text-[#0052B4] font-semibold tabular-nums">
                {aspectRatio}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {ASPECT_RATIOS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setAspectRatio(r.value)}
                  className={`py-2 px-2 rounded-md border font-mono text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                    aspectRatio === r.value
                      ? 'border-[#0052B4] bg-[#0052B4] text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution (1K, 2K, 4K) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-800">Độ phân giải đầu ra</label>
            <div className="grid grid-cols-3 gap-2">
              {RESOLUTIONS.map((res) => (
                <button
                  key={res.value}
                  type="button"
                  onClick={() => setImageSize(res.value)}
                  className={`py-2 px-3 rounded-lg border text-center transition-colors cursor-pointer ${
                    imageSize === res.value
                      ? 'border-[#0052B4] bg-[#0052B4]/8 text-[#0052B4]'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="font-mono text-sm font-bold tabular-nums">{res.label}</div>
                  <div className="text-[11px] text-slate-500">{res.detail}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Prompt textarea + Quick Recipes */}
          <div className="space-y-2">
            <label htmlFor="ai-image-prompt" className="block text-xs font-bold text-slate-800">
              Mô tả yêu cầu xử lý hình ảnh
            </label>
            <textarea
              id="ai-image-prompt"
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Mô tả phông nền, ánh sáng hoặc bối cảnh lắp đặt thiết bị lọc nước mong muốn..."
              className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4] resize-none"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {filteredRecipes.map((recipe) => (
                <button
                  key={recipe.label}
                  type="button"
                  onClick={() => setPrompt(recipe.prompt)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                >
                  {recipe.label}
                </button>
              ))}
            </div>
          </div>

          {errorMessage && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs leading-relaxed">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700" />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isGenerating || !prompt.trim()}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Đang xử lý ảnh {imageSize} ({aspectRatio})...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>
                  {mode === 'edit' ? 'Chỉnh sửa ảnh sản phẩm bằng AI' : 'Tạo ảnh sản phẩm mới bằng AI'}
                </span>
              </>
            )}
          </button>
        </form>

        {/* Right Result Preview & History */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
              <span className="text-sm font-bold text-slate-900">Kết quả hình ảnh AI</span>
              {activeResult && (
                <span className="font-mono text-xs text-slate-500 tabular-nums">
                  {activeResult.model} · {activeResult.aspectRatio} · {activeResult.imageSize}
                </span>
              )}
            </div>

            <div className="studio-grid-bg min-h-[420px] flex items-center justify-center p-6">
              {isGenerating ? (
                <div className="text-center space-y-3">
                  <Loader2 className="w-9 h-9 animate-spin text-[#0052B4] mx-auto" />
                  <p className="text-sm font-semibold text-slate-800">
                    Đang kết xuất hình ảnh chất lượng {imageSize}...
                  </p>
                  <p className="text-xs text-slate-500">
                    Quá trình tạo ảnh độ phân giải cao thường mất từ 10–25 giây.
                  </p>
                </div>
              ) : activeResult ? (
                <img
                  src={activeResult.imageDataUrl}
                  alt="Hình ảnh sản phẩm được tạo bởi AI"
                  referrerPolicy="no-referrer"
                  className="max-h-[520px] w-auto object-contain rounded-sm shadow-lg border border-slate-300/60 bg-white"
                />
              ) : (
                <div className="text-center max-w-md space-y-3 py-8">
                  <div className="w-12 h-12 mx-auto rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400">
                    <ImagePlus className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800">
                    Chưa có ảnh AI nào trong phiên này
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Chọn mẫu gợi ý bên trái hoặc nhập mô tả bối cảnh cho thiết bị lọc nước VUTECH, sau đó nhấn nút khởi tạo. Khi có kết quả, bạn có thể chuyển trực tiếp sang Studio để đóng logo chính hãng VUTECH và chèn thông số kỹ thuật.
                  </p>
                </div>
              )}
            </div>

            {activeResult && (
              <div className="px-5 py-3.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handleDownloadResult(activeResult)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải ảnh AI gốc</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    onApplyToBrandStudio(activeResult.imageDataUrl, `AI ${activeResult.aspectRatio}`)
                  }
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-lg cursor-pointer"
                >
                  <span>Chuyển sang Studio đóng logo VUTECH</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Session AI History Strip */}
          {history.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-slate-900">
                Lịch sử ảnh AI đã tạo ({history.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {history.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveResult(item)}
                    className={`group rounded-lg overflow-hidden border bg-white text-left transition-colors cursor-pointer ${
                      activeResult?.id === item.id
                        ? 'border-[#0052B4] ring-2 ring-[#0052B4]/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="aspect-square bg-slate-100 overflow-hidden">
                      <img
                        src={item.imageDataUrl}
                        alt={item.prompt.slice(0, 40)}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 flex items-center justify-between text-[11px] font-mono text-slate-500">
                      <span>{item.aspectRatio}</span>
                      <span>{item.imageSize}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
