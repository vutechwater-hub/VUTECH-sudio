import { Download } from 'lucide-react';
import { VUTECH_LOGOS } from '../constants/vutech';
import type { WorkspaceTab } from '../types/studio';

interface TopBarProps {
  activeTab: WorkspaceTab;
  onSelectTab: (tab: WorkspaceTab) => void;
  onQuickExport: () => void;
  isExporting: boolean;
  savedCount: number;
  batchCount: number;
}

const NAV_ITEMS: Array<{ id: WorkspaceTab; label: string }> = [
  { id: 'studio', label: 'Thiết kế ảnh' },
  { id: 'ai', label: 'Tạo & Sửa AI' },
  { id: 'channels', label: 'Quy chuẩn Đa kênh' },
  { id: 'library', label: 'Thư viện mẫu' },
];

export function TopBar({
  activeTab,
  onSelectTab,
  onQuickExport,
  isExporting,
  savedCount,
  batchCount,
}: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between gap-8">
      {/* Zone 1: Single-line Brand Wordmark */}
      <button
        type="button"
        onClick={() => onSelectTab('studio')}
        className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052B4] rounded-md"
      >
        <img
          src={VUTECH_LOGOS.icon}
          alt="Logo VUTECH"
          referrerPolicy="no-referrer"
          className="h-7 w-auto object-contain"
        />
        <span className="font-display text-lg font-bold tracking-tight text-slate-900">
          VUTECH Studio
        </span>
      </button>

      {/* Zone 2: 4 Clean Single-Line Nav Links */}
      <nav aria-label="Điều hướng chính" className="flex items-center gap-6 overflow-x-auto">
        {NAV_ITEMS.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`relative py-5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0052B4] ${
                active ? 'text-[#0052B4]' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
              {item.id === 'library' && savedCount > 0 ? ` (${savedCount})` : ''}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#0052B4]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: Single Primary Action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onQuickExport}
          disabled={isExporting}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0052B4] hover:bg-[#072A5E] disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0052B4]"
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>
            {isExporting
              ? 'Đang xuất...'
              : batchCount > 1
              ? `Xuất cả đợt (${batchCount} ảnh)`
              : 'Xuất ảnh 2K/4K'}
          </span>
        </button>
      </div>
    </header>
  );
}
