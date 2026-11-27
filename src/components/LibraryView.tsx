import { useState } from 'react';
import { Trash2, FolderOpen, Download, Search, Bookmark } from 'lucide-react';
import type { ExportFormat, SavedDesign, StudioConfig } from '../types/studio';
import { exportStudioImage } from '../utils/canvasRenderer';

interface LibraryViewProps {
  designs: SavedDesign[];
  exportFormat: ExportFormat;
  onLoadDesign: (config: StudioConfig) => void;
  onDeleteDesign: (id: string) => void;
  onGoToStudio: () => void;
}

export function LibraryView({
  designs,
  exportFormat,
  onLoadDesign,
  onDeleteDesign,
  onGoToStudio,
}: LibraryViewProps) {
  const [query, setQuery] = useState('');
  const [exportingId, setExportingId] = useState<string | null>(null);

  const filtered = designs.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      item.config.productName.toLowerCase().includes(q) ||
      item.config.modelCode.toLowerCase().includes(q) ||
      item.config.category.toLowerCase().includes(q)
    );
  });

  const handleReExport = async (item: SavedDesign) => {
    setExportingId(item.id);
    try {
      await exportStudioImage(item.config, exportFormat);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="max-w-[1380px] mx-auto px-6 py-8">
      <div className="mb-6 pb-5 border-b border-slate-200 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
            Thư Viện Mẫu Sản Phẩm VUTECH
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Lưu trữ cấu hình sản phẩm đã thiết kế để nhanh chóng thay ảnh gốc hoặc xuất lại nhiều kích thước khi cần.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên sản phẩm, mã model..."
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0052B4]/25 focus:border-[#0052B4]"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center max-w-xl mx-auto">
          <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center">
            <Bookmark className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            {designs.length === 0
              ? 'Chưa có mẫu sản phẩm nào được lưu'
              : 'Không tìm thấy mẫu phù hợp'}
          </h2>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
            {designs.length === 0
              ? 'Sau khi hoàn thiện thông tin và bố cục cho một thiết bị lọc nước, hãy nhấn "Lưu mẫu sản phẩm" để tái sử dụng cho các đợt đăng bài sau.'
              : 'Thử từ khóa khác hoặc xóa bộ lọc tìm kiếm hiện tại.'}
          </p>
          <button
            type="button"
            onClick={onGoToStudio}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-lg cursor-pointer"
          >
            <span>Quay lại Studio thiết kế</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
            >
              <div className="studio-grid-bg h-56 p-4 flex items-center justify-center border-b border-slate-200">
                <img
                  src={item.thumbnailDataUrl}
                  alt={item.config.productName}
                  referrerPolicy="no-referrer"
                  className="max-h-full max-w-full object-contain rounded-xs shadow-sm bg-white"
                />
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2">
                    {item.config.productName}
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-mono tabular-nums">
                    <span>{item.config.modelCode || 'VUTECH'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.config.aspectRatio}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.config.resolution}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">Lưu lúc {item.savedAt}</p>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => onLoadDesign(item.config)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] rounded-lg cursor-pointer"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Mở chỉnh sửa</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReExport(item)}
                    disabled={exportingId === item.id}
                    aria-label="Tải ảnh"
                    className="p-2 text-slate-700 hover:text-[#0052B4] bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDesign(item.id)}
                    aria-label="Xóa mẫu"
                    className="p-2 text-slate-500 hover:text-red-600 bg-slate-50 hover:bg-red-50 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
