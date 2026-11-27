import type {
  AspectRatioOption,
  ChannelPreset,
  PlatformStandard,
  ResolutionOption,
  SampleProduct,
  StudioConfig,
  TemplateId,
} from '../types/studio';

export const MAX_BATCH_IMAGES = 5;

export const VUTECH_LOGOS = {
  full: '/assets/aistudio/Logo_VUTEC-D_51904787.png',
  icon: '/assets/aistudio/VUTECH-V__c6d1da7e.png',
} as const;

export const ASPECT_RATIOS: Array<{
  value: AspectRatioOption;
  label: string;
  shortUse: string;
  wRatio: number;
  hRatio: number;
}> = [
  { value: '1:1', label: '1:1', shortUse: 'Shopee / Web / FB', wRatio: 1, hRatio: 1 },
  { value: '3:4', label: '3:4', shortUse: 'Shopee 3:4 / FB Feed', wRatio: 3, hRatio: 4 },
  { value: '4:3', label: '4:3', shortUse: 'Catalog / Web', wRatio: 4, hRatio: 3 },
  { value: '16:9', label: '16:9', shortUse: 'FB Cover / Banner', wRatio: 16, hRatio: 9 },
  { value: '9:16', label: '9:16', shortUse: 'Story / Reels', wRatio: 9, hRatio: 16 },
  { value: '3:2', label: '3:2', shortUse: 'Ảnh ngang chuẩn', wRatio: 3, hRatio: 2 },
  { value: '2:3', label: '2:3', shortUse: 'Poster đứng', wRatio: 2, hRatio: 3 },
  { value: '21:9', label: '21:9', shortUse: 'Web Hero Siêu rộng', wRatio: 21, hRatio: 9 },
];

export const RESOLUTIONS: Array<{
  value: ResolutionOption;
  label: string;
  longEdge: number;
  detail: string;
}> = [
  { value: '1K', label: '1K', longEdge: 1200, detail: 'Tối ưu tốc độ Web' },
  { value: '2K', label: '2K', longEdge: 2048, detail: 'Chuẩn sắc nét FB & Web' },
  { value: '4K', label: '4K', longEdge: 3840, detail: 'Siêu nét / In ấn Catalog' },
];

export function getExportDimensions(
  aspectRatio: AspectRatioOption,
  resolution: ResolutionOption
): { width: number; height: number } {
  const ratioMeta = ASPECT_RATIOS.find((r) => r.value === aspectRatio) ?? ASPECT_RATIOS[0];
  const resMeta = RESOLUTIONS.find((r) => r.value === resolution) ?? RESOLUTIONS[1];
  const { wRatio, hRatio } = ratioMeta;
  const maxDim = resMeta.longEdge;

  if (wRatio >= hRatio) {
    const width = maxDim;
    const height = Math.round((maxDim * hRatio) / wRatio);
    return { width, height };
  } else {
    const height = maxDim;
    const width = Math.round((maxDim * wRatio) / hRatio);
    return { width, height };
  }
}

export const PLATFORM_STANDARDS: PlatformStandard[] = [
  {
    platform: 'shopee',
    name: 'Shopee Việt Nam',
    sourceRef: 'Shopee Seller Education (Quy chuẩn đăng sản phẩm)',
    ratios: 'Ảnh bìa bắt buộc 1:1 · Ảnh phụ 1:1 hoặc 3:4 (tối đa 9 ảnh)',
    resolutionAndSize: 'Khuyến nghị 1024–1200 px (tối thiểu 500×500 px) · ≤ 2 MB · JPG/PNG',
    productOccupancy: 'Thiết bị thật chiếm 65%–75% khung hình, căn giữa trên nền trắng/sạch',
    safeZoneRule:
      'Chừa vùng an toàn ≥15%–18% cạnh đáy (tránh tem Freeship Xtra / Voucher / Mall) và góc trên phải (tránh nhãn % Giảm giá).',
    contentPolicy:
      'Không chèn SĐT, link website ngoài sàn, khung viền dày hoặc chữ quảng cáo rườm rà lên ảnh bìa để tránh giảm phân phối.',
    recommendedTemplates: ['shopee-cover', 'shopee-detail'],
  },
  {
    platform: 'facebook',
    name: 'Facebook & Fanpage',
    sourceRef: 'Meta Feed & Ads Specs (Di động & Desktop)',
    ratios: 'Bài đăng tối ưu 3:4 (dọc mobile) hoặc 1:1 · Ảnh bìa 16:9 · Story/Reels 9:16',
    resolutionAndSize: 'Khuyến nghị 1440–2048 px (2K) · sRGB · PNG/JPG ≤ 30 MB',
    productOccupancy: 'Nổi bật thiết bị + tiêu đề tương phản cao giúp tăng tỷ lệ nhấp trên điện thoại',
    safeZoneRule:
      'Chừa lề an toàn 5%–8% quanh viền tránh bị cắt khi hiển thị dạng lưới hoặc bị nút CTA che đáy.',
    contentPolicy:
      'Được phép hiển thị rõ Hotline 09.6759.6739, trang Facebook, mã Model và 3 thông số kỹ thuật cốt lõi để khách chốt tư vấn nhanh.',
    recommendedTemplates: ['facebook-promo', 'minimal-luxury', 'industrial-tech'],
  },
  {
    platform: 'website',
    name: 'Website TMĐT & Catalog',
    sourceRef: 'Chuẩn thương mại điện tử & hồ sơ kỹ thuật doanh nghiệp',
    ratios: 'Lưới sản phẩm 1:1 · Catalog/Báo giá 4:3 · Banner trang chủ 16:9 / 21:9',
    resolutionAndSize: '1K–2K cho Web tải nhanh (SEO) · 4K cho in ấn Catalog & Banner đầu trang',
    productOccupancy: 'Đồng nhất kích thước & ánh sáng giữa các mã máy trên cùng trang danh mục',
    safeZoneRule:
      'Tách biệt rõ khu vực ảnh sản phẩm và vùng thông số kỹ thuật, không che khuất đồng hồ áp suất hay tem máy.',
    contentPolicy:
      'Hiển thị đầy đủ Logo VUTECH, tên thiết bị, mã model, 3 thông số kỹ thuật và thông tin liên hệ chính thức công ty.',
    recommendedTemplates: ['web-clean', 'minimal-luxury', 'industrial-tech'],
  },
];

export const CHANNEL_PRESETS: ChannelPreset[] = [
  {
    id: 'shopee-cover',
    label: 'Shopee Ảnh Bìa',
    channel: 'Shopee · Bắt buộc 1:1',
    platform: 'shopee',
    aspectRatio: '1:1',
    recommendedResolution: '1K',
    recommendedTemplate: 'shopee-cover',
    usageNote:
      'Ảnh đại diện chuẩn Shopee & Shopee Mall: nền trắng sạch, sản phẩm chiếm ~72% chính giữa, tránh 100% tem Freeship/Giảm giá & tự ẩn SĐT ngoài sàn.',
    complianceHighlights: [
      'Tỷ lệ bắt buộc 1:1 · 1200×1200 px · Tự tối ưu dưới 2MB',
      'Vùng an toàn tránh tem Freeship Xtra (đáy) & nhãn % Giảm (góc trên phải)',
      'Tự ẩn SĐT/Website ngoài sàn theo chính sách Shopee Seller Education',
    ],
    recommendedOverrides: {
      backdrop: 'pure-white',
      backgroundBlurEnabled: true,
      extendBackground: true,
      autoFrameSubject: true,
      productScale: 1,
      productOffsetX: 0,
      productOffsetY: 0,
      showContactFooter: false,
      logoPosition: 'top-center',
    },
  },
  {
    id: 'shopee-detail',
    label: 'Shopee Ảnh Thông Số',
    channel: 'Shopee · Ảnh phụ 3:4',
    platform: 'shopee',
    aspectRatio: '3:4',
    recommendedResolution: '1K',
    recommendedTemplate: 'shopee-detail',
    usageNote:
      'Ảnh chi tiết sản phẩm trên di động Shopee: trình bày sắc nét 3 thông số kỹ thuật & bảo hành chính hãng VUTECH, không chứa thông tin điều hướng ngoài sàn.',
    complianceHighlights: [
      'Tỷ lệ 3:4 tối ưu hiển thị lớn trên app Shopee di động · ≤ 2MB',
      'Nổi bật Tên máy, Model & 3 thông số kỹ thuật rõ ràng',
      'Ẩn SĐT/Link ngoài sàn, hiển thị chứng nhận Chính hãng VUTECH',
    ],
    recommendedOverrides: {
      backdrop: 'pure-white',
      backgroundBlurEnabled: true,
      extendBackground: true,
      autoFrameSubject: true,
      productScale: 1,
      productOffsetX: 0,
      productOffsetY: 0,
      showSpecsPanel: true,
      showContactFooter: false,
      logoPosition: 'top-left',
    },
  },
  {
    id: 'web-product',
    label: 'Web Sản Phẩm',
    channel: 'Website TMĐT',
    platform: 'website',
    aspectRatio: '1:1',
    recommendedResolution: '2K',
    recommendedTemplate: 'web-clean',
    usageNote: 'Hiển thị sắc nét, đồng nhất trên danh mục sản phẩm & trang chi tiết website.',
    complianceHighlights: [
      'Khung 1:1 chuẩn lưới sản phẩm TMĐT · 2048×2048 px',
      'Đầy đủ Logo VUTECH, 3 thông số & thanh liên hệ công ty',
    ],
    recommendedOverrides: {
      backdrop: 'pure-white',
      showSpecsPanel: true,
      showContactFooter: true,
      logoPosition: 'top-left',
    },
  },
  {
    id: 'fb-post',
    label: 'Facebook Bài Đăng',
    channel: 'Facebook Feed',
    platform: 'facebook',
    aspectRatio: '3:4',
    recommendedResolution: '2K',
    recommendedTemplate: 'facebook-promo',
    usageNote: 'Tối ưu diện tích hiển thị trên bảng tin điện thoại, nổi bật nhận diện xanh VUTECH.',
    complianceHighlights: [
      'Khung dọc 3:4 chiếm tối đa màn hình bảng tin Facebook di động',
      'Hiển thị nổi bật Hotline 09.6759.6739 & thông số chốt tư vấn nhanh',
    ],
    recommendedOverrides: {
      showSpecsPanel: true,
      showContactFooter: true,
      logoPosition: 'top-left',
    },
  },
  {
    id: 'fb-cover',
    label: 'Ảnh Bìa / Banner',
    channel: 'Facebook & Web',
    platform: 'facebook',
    aspectRatio: '16:9',
    recommendedResolution: '2K',
    recommendedTemplate: 'industrial-tech',
    usageNote: 'Bố cục ngang 2 cột chuyên nghiệp cho ảnh bìa Fanpage và slide trang chủ.',
    complianceHighlights: [
      'Bố cục 2 cột 16:9 tách biệt ảnh thiết bị & thông số kỹ thuật',
      'An toàn không bị cắt mất thông tin chính trên cả mobile và desktop',
    ],
    recommendedOverrides: {
      showSpecsPanel: true,
      showContactFooter: true,
    },
  },
  {
    id: 'story-reels',
    label: 'Story / Reels',
    channel: 'Facebook / Zalo',
    platform: 'facebook',
    aspectRatio: '9:16',
    recommendedResolution: '2K',
    recommendedTemplate: 'facebook-promo',
    usageNote: 'Khung hình dọc toàn màn hình di động dành cho tin nổi bật và Zalo OA.',
    complianceHighlights: [
      'Chuẩn 9:16 toàn màn hình dọc cho Facebook Story, Reels & Zalo OA',
      'Bố cục thông số xếp dọc dễ đọc nhanh trong 3 giây',
    ],
    recommendedOverrides: {
      showSpecsPanel: true,
      showContactFooter: true,
    },
  },
  {
    id: 'web-hero',
    label: 'Banner Tối Giản',
    channel: 'Website Trang Chủ',
    platform: 'website',
    aspectRatio: '21:9',
    recommendedResolution: '4K',
    recommendedTemplate: 'minimal-luxury',
    usageNote: 'Độ phân giải 4K cho banner chính đầu trang website công ty với tương phản cao cấp.',
    complianceHighlights: [
      'Chuẩn 21:9 siêu rộng 4K · Phối màu Obsidian Navy & Vàng kim nổi bật',
      'Tôn vinh dáng máy trên nền gallery sáng tinh khiết',
    ],
    recommendedOverrides: {
      showSpecsPanel: true,
      showContactFooter: true,
    },
  },
  {
    id: 'catalog-tech',
    label: 'Catalog Kỹ Thuật',
    channel: 'Hồ sơ năng lực',
    platform: 'website',
    aspectRatio: '4:3',
    recommendedResolution: '4K',
    recommendedTemplate: 'industrial-tech',
    usageNote: 'Định dạng tiêu chuẩn cho báo giá PDF, hồ sơ thầu và tài liệu kỹ thuật.',
    complianceHighlights: [
      'Tỷ lệ 4:3 độ nét 4K chuẩn in ấn hồ sơ năng lực & báo giá',
      'Nhấn mạnh mã Model, công suất và cấu hình hệ thống lọc',
    ],
    recommendedOverrides: {
      showSpecsPanel: true,
      showContactFooter: true,
    },
  },
];

export const TEMPLATES: Array<{
  id: TemplateId;
  name: string;
  description: string;
}> = [
  {
    id: 'shopee-cover',
    name: 'Ảnh Bìa Shopee (Chuẩn Sàn)',
    description: 'Nền trắng sạch, chừa vùng an toàn tem Freeship/Giảm giá, tự ẩn SĐT ngoài sàn.',
  },
  {
    id: 'shopee-detail',
    name: 'Ảnh Thông Số Shopee (Ảnh Phụ)',
    description: 'Nổi bật tên máy & 3 thông số kỹ thuật chuẩn sàn Shopee, không chứa link ngoài sàn.',
  },
  {
    id: 'web-clean',
    name: 'Chuẩn Web Sạch',
    description: 'Nền sáng tinh khiết, nổi bật sản phẩm & thông số gọn gàng cho Website TMĐT.',
  },
  {
    id: 'facebook-promo',
    name: 'Quảng Cáo Facebook',
    description: 'Nhận diện xanh VUTECH nổi bật, tối ưu thu hút tương tác & hotline chốt đơn.',
  },
  {
    id: 'industrial-tech',
    name: 'Kỹ Thuật Công Nghiệp',
    description: 'Khung xanh đậm kỹ thuật, nhấn mạnh thông số hệ thống lọc công nghiệp.',
  },
  {
    id: 'minimal-luxury',
    name: 'Tối Giản Cao Cấp',
    description: 'Nền sáng tinh tế kết hợp khối chân xanh đen Obsidian & viền vàng kim tương phản cao.',
  },
  {
    id: 'watermark-protect',
    name: 'Đóng Dấu Bản Quyền',
    description: 'Giữ nguyên toàn khung ảnh sản phẩm kèm logo & dấu chìm VUTECH.',
  },
];

export const SAMPLE_PRODUCTS: SampleProduct[] = [
  {
    id: 'ro-industrial',
    label: 'Hệ thống RO Công nghiệp 500L/h',
    imageUrl: '/src/assets/images/sample_ro_industrial_1795753094937.jpg',
    productName: 'Hệ Thống Lọc Nước RO Công Nghiệp 500L/h',
    modelCode: 'VT-RO500-PRO',
    category: 'Lọc nước công nghiệp RO',
    tagline: 'Nước tinh khiết đạt chuẩn QCVN 6-1:2010/BYT',
    specs: ['Công suất 500 Lít/giờ', 'Khung Inox 304 · Màng RO Mỹ', 'Tủ điều khiển tự động sục rửa'],
    priceBadge: 'Bảo hành 24 tháng',
    recommendedTemplate: 'industrial-tech',
    facebookCaption:
      'HỆ THỐNG LỌC NƯỚC RO CÔNG NGHIỆP VUTECH 500L/H — GIẢI PHÁP NƯỚC TINH KHIẾT CHO NHÀ XƯỞNG & DOANH NGHIỆP\n\n• Công suất ổn định 500 Lít/giờ, vận hành liên tục bền bỉ\n• Khung giá đỡ Inox 304 chống gỉ kết hợp 3 cột lọc áp lực cao\n• Chất lượng nước sau lọc đạt tiêu chuẩn nước uống trực tiếp QCVN 6-1:2010/BYT\n• Tủ điện điều khiển thông minh, tự động sục rửa màng RO nâng cao tuổi thọ\n\nLiên hệ Công ty TNHH XNK VUTECH — Hotline: 09.6759.6739 để được khảo sát nguồn nước và nhận báo giá chi tiết!\n#VUTECH #LocNuocCongNghiep #HeThongRO #ThietBiLocNuoc',
  },
  {
    id: 'ro-cabinet',
    label: 'Máy lọc nước RO Nóng Lạnh VUTECH',
    imageUrl: '/src/assets/images/sample_ro_cabinet_1795753094975.jpg',
    productName: 'Máy Lọc Nước RO Nóng Lạnh Cao Cấp VUTECH',
    modelCode: 'VT-HC90-LUX',
    category: 'Máy lọc nước gia đình',
    tagline: '3 chế độ Nóng · Lạnh · Nguội tiện nghi chuẩn tinh khiết',
    specs: ['Màng RO 100 GPD · 10 cấp lọc', 'Làm lạnh Block sâu 6–10°C', 'Mặt kính cường lực hiển thị LED'],
    priceBadge: 'Miễn phí lắp đặt',
    recommendedTemplate: 'web-clean',
    facebookCaption:
      'MÁY LỌC NƯỚC RO NÓNG LẠNH VUTECH VT-HC90-LUX — NÂNG TẦM KHÔNG GIAN SỐNG HIỆN ĐẠI\n\n• Thiết kế tủ đứng mặt kính cường lực sang trọng, màn hình LED hiển thị nhiệt độ\n• 3 chế độ nước Nóng – Lạnh – Nguội sẵn sàng phục vụ cả gia đình & văn phòng\n• Hệ thống 10 cấp lọc RO diệt khuẩn tối ưu, bổ sung khoáng chất có lợi\n\nSản phẩm chính hãng từ Công ty TNHH XNK VUTECH — Hotline tư vấn & lắp đặt: 09.6759.6739!\n#VUTECH #MayLocNuocRO #LocNuocNongLanh #NuocSachGiaDinh',
  },
  {
    id: 'uf-filter',
    label: 'Bộ lọc tổng đầu nguồn UF Inox 304',
    imageUrl: '/src/assets/images/sample_uf_filter_1795753094793.jpg',
    productName: 'Hệ Thống Lọc Tổng Đầu Nguồn UF Inox 304',
    modelCode: 'VT-UF2000-SS',
    category: 'Lọc tổng đầu nguồn UF',
    tagline: 'Lọc siêu sạch 0.01 micron · Bảo vệ thiết bị vệ sinh toàn nhà',
    specs: ['Lưu lượng lọc 2.000 Lít/giờ', 'Vỏ Inox 304 dày chịu áp lực', 'Không dùng điện · Không nước thải'],
    priceBadge: 'Chính hãng VUTECH',
    recommendedTemplate: 'facebook-promo',
    facebookCaption:
      'BỘ LỌC TỔNG ĐẦU NGUỒN UF INOX 304 VUTECH — BẢO VỆ NGUỒN NƯỚC SINH HOẠT TOÀN NGÔI NHÀ\n\n• Công suất lớn 2.000 Lít/giờ, đáp ứng thoải mái cho biệt thự, nhà phố, căn hộ\n• Màng siêu lọc UF 0.01 micron loại bỏ cặn bẩn, rỉ sét, vi khuẩn giữ nguyên khoáng tự nhiên\n• Thân vỏ Inox 304 siêu bền kèm đồng hồ áp suất và van xả rửa tiện lợi\n• Không tiêu thụ điện năng, không phát sinh nước thải\n\nLiên hệ ngay Công ty TNHH XNK VUTECH — Hotline: 09.6759.6739 để được kỹ sư tư vấn cấu hình phù hợp!\n#VUTECH #LocTongDauNguon #MangLocUF #Inox304',
  },
];

export const DEFAULT_STUDIO_CONFIG: StudioConfig = {
  sourceImageUrl: SAMPLE_PRODUCTS[0].imageUrl,
  sourceImageName: SAMPLE_PRODUCTS[0].label,
  template: 'web-clean',
  aspectRatio: '1:1',
  resolution: '2K',
  productName: SAMPLE_PRODUCTS[0].productName,
  modelCode: SAMPLE_PRODUCTS[0].modelCode,
  category: SAMPLE_PRODUCTS[0].category,
  tagline: SAMPLE_PRODUCTS[0].tagline,
  specs: [...SAMPLE_PRODUCTS[0].specs] as [string, string, string],
  priceBadge: SAMPLE_PRODUCTS[0].priceBadge,
  showPriceBadge: true,
  companyName: 'CÔNG TY TNHH XNK VUTECH',
  hotline: 'Hotline: 09.6759.6739',
  website: '',
  facebookPage: '',
  logoMode: 'full-and-watermark',
  logoPosition: 'top-left',
  logoScale: 1,
  removeLogoBg: true,
  watermarkOpacity: 0.08,
  backdrop: 'pure-white',
  fitMode: 'contain',
  productScale: 1.0,
  productOffsetX: 0,
  productOffsetY: 0,
  backgroundBlurEnabled: true,
  backgroundBlurAmount: 16,
  extendBackground: true,
  autoFrameSubject: true,
  focusRadiusScale: 1.0,
  focusFeather: 28,
  subjectBox: { x: 0.12, y: 0.08, w: 0.76, h: 0.84 },
  brightness: 102,
  contrast: 104,
  saturation: 104,
  sharpness: 18,
  showSpecsPanel: true,
  showContactFooter: true,
  facebookCaption: SAMPLE_PRODUCTS[0].facebookCaption,
};

export const AI_PROMPT_RECIPES: Array<{ label: string; prompt: string; forEdit: boolean }> = [
  {
    label: 'Làm mờ nền & Mở rộng khung hình',
    prompt:
      'Giữ nguyên tuyệt đối thiết bị lọc nước sắc nét ở trung tâm, tự nhiên mở rộng phần nền xung quanh ra toàn bộ khung hình theo tỷ lệ đã chọn và làm mờ hậu cảnh xóa phông chuyên nghiệp kiểu ống kính studio f/1.8, ánh sáng thương mại sáng sạch.',
    forEdit: true,
  },
  {
    label: 'Tách nền & Studio sáng sạch',
    prompt:
      'Đặt thiết bị lọc nước này vào bối cảnh phòng chụp studio thương mại sáng tinh khiết, nền trắng chuyển sắc xanh băng nhẹ, bóng đổ mềm tự nhiên dưới chân máy, tăng độ sắc nét chi tiết inox và đồng hồ áp suất.',
    forEdit: true,
  },
  {
    label: 'Không gian bếp hiện đại',
    prompt:
      'Đặt sản phẩm máy lọc nước này trong không gian phòng bếp biệt thự hiện đại tối giản, mặt bàn đá thạch anh trắng, ánh sáng tự nhiên dịu nhẹ từ cửa sổ, phong cách ảnh quảng cáo thương hiệu cao cấp.',
    forEdit: true,
  },
  {
    label: 'Nhà máy xử lý nước chuẩn ISO',
    prompt:
      'Đặt hệ thống lọc nước công nghiệp này trong phòng kỹ thuật xử lý nước sạch đạt chuẩn ISO, sàn epoxy xám sáng sạch sẽ, ánh sáng studio chuyên nghiệp làm nổi bật kết cấu inox 304 và cột lọc.',
    forEdit: true,
  },
  {
    label: 'Hiệu ứng giọt nước tinh khiết',
    prompt:
      'Tạo ảnh quảng cáo thương mại cho thiết bị lọc nước này trên bệ đá sáng tối giản với làn sóng nước trong suốt tinh khiết nhẹ nhàng phía sau, tông màu xanh dương doanh nghiệp sang trọng và sắc nét.',
    forEdit: true,
  },
  {
    label: 'Tạo ảnh hệ lọc RO mới',
    prompt:
      'Ảnh chụp studio thương mại hệ thống lọc nước RO công nghiệp công suất lớn bằng inox 304 sáng bóng với 3 cột lọc composite xanh dương, đồng hồ đo áp suất và tủ điện điều khiển, nền studio trắng xám tinh tế, ánh sáng sắc nét 8K.',
    forEdit: false,
  },
  {
    label: 'Tạo ảnh máy lọc gia đình mới',
    prompt:
      'Ảnh chụp sản phẩm thương mại máy lọc nước RO tủ đứng nóng lạnh cao cấp mặt kính trắng kết hợp xanh dương đậm, vòi inox tinh xảo đặt cạnh ly nước trong suốt, không gian studio tối giản sang trọng.',
    forEdit: false,
  },
];
