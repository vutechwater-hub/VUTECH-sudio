import type {
  DesignGroupId,
  FacebookRatioKey,
  GroupRuntimeSettings,
  PlatformBundleId,
  PlatformStandardEntry,
} from '../types/multichannel';

export const PLATFORM_REGISTRY_STORAGE_KEY = 'vutech_platform_standards_registry_v2';
export const STANDARDS_BUNDLE_VERSION = '2026.11-VUTECH-STD-2.0';

export const FACEBOOK_RATIO_PRESETS: Array<{
  key: FacebookRatioKey;
  label: string;
  width: number;
  height: number;
  subFolder: string;
  fileSlug: string;
  placement: string;
}> = [
  {
    key: '4:5',
    label: '4:5 Feed dọc',
    width: 1080,
    height: 1350,
    subFolder: 'FEED_4x5',
    fileSlug: 'FB_FEED',
    placement: 'Facebook Feed di động (mặc định)',
  },
  {
    key: '1:1',
    label: '1:1 Vuông / Carousel',
    width: 1080,
    height: 1080,
    subFolder: 'CAROUSEL_1x1',
    fileSlug: 'FB_CAROUSEL',
    placement: 'Facebook Feed vuông & băng chuyền Carousel',
  },
  {
    key: '9:16',
    label: '9:16 Stories / Reels',
    width: 1080,
    height: 1920,
    subFolder: 'STORIES_9x16',
    fileSlug: 'FB_STORIES',
    placement: 'Facebook Stories & Reels ảnh tĩnh',
  },
  {
    key: '1.91:1',
    label: '1.91:1 Ngang Ads',
    width: 1200,
    height: 628,
    subFolder: 'LANDSCAPE',
    fileSlug: 'FB_LANDSCAPE',
    placement: 'Quảng cáo liên kết & cột phải Facebook',
  },
];

export const DEFAULT_PLATFORM_REGISTRY: PlatformStandardEntry[] = [
  {
    id: '01_shopee_cover',
    order: 1,
    name: 'Nhóm 01 – Ảnh Bìa Shopee (Chuẩn Sàn)',
    shortName: 'Ảnh Bìa Shopee',
    folderName: '01_SHOPEE_BIA',
    fileGroupSlug: 'SHOPEE_BIA',
    platform: 'Shopee',
    placement: 'Ảnh đại diện sản phẩm (Thumbnail / Cover)',
    defaultCount: 1,
    maxCount: 1,
    aspectRatios: ['1:1'],
    sizeOptions: [
      { id: '1200x1200', label: '1200 × 1200 px (Mặc định)', aspectRatio: '1:1', width: 1200, height: 1200 },
      { id: '1080x1080', label: '1080 × 1080 px', aspectRatio: '1:1', width: 1080, height: 1080 },
      { id: '800x800', label: '800 × 800 px (Nhẹ)', aspectRatio: '1:1', width: 800, height: 800 },
    ],
    defaultSizeId: '1200x1200',
    minDimensions: { width: 500, height: 500 },
    maxDimensions: { width: 2048, height: 2048 },
    maxFileSizeKB: 2048,
    allowedFormats: ['jpg', 'png'],
    defaultFormat: 'jpg',
    colorSpace: 'sRGB',
    safeZoneDescription:
      'Chừa ≥13% đỉnh trên (tránh tem Yêu thích+/Mall góc trái & nhãn % Giảm góc phải) và ≥17% cạnh đáy (tránh tem Freeship Xtra / Voucher Xtra).',
    mandatoryPlatformRules: [
      'Bắt buộc tỷ lệ 1:1 (tối thiểu 500×500 px), định dạng JPG hoặc PNG, dung lượng ≤ 2 MB.',
      'Không chèn số điện thoại, website, email, mã QR hoặc nội dung điều hướng giao dịch ngoài sàn.',
      'Không ghép cứng tem giả mạo Shopee (Yêu thích+, Mall, Freeship Xtra, Voucher Xtra, Giảm %).',
    ],
    internalVutechRules: [
      'Kích thước mặc định nội bộ 1200 × 1200 px (sRGB), nền trắng hoặc sáng sạch.',
      'Sản phẩm nằm chính giữa, chiếm khoảng 70–80% khung hình, không cắt mất bộ phận quan trọng hay biến dạng.',
      'Tem Shopee chỉ hiển thị dạng lớp Preview Overlay và tự động loại bỏ hoàn toàn khi xuất file.',
    ],
    watermarkRules: 'Không đóng dấu chìm đè sản phẩm trên ảnh bìa Shopee; chỉ đặt logo VUTECH gọn tại vùng an toàn đỉnh trên.',
    allowWatermark: false,
    allowExternalContact: false,
    restrictedContent: ['Hotline / SĐT', 'Website / Link ngoài sàn', 'Email', 'Mã QR', 'Tem Shopee ghép cứng', 'Chứng nhận chưa xác thực'],
    officialSource: 'Shopee Seller Education Việt Nam (ban hành hiện hành – cần đối chiếu định kỳ trên Kênh Người Bán)',
    lastVerifiedDate: '2026-11-26',
    standardVersion: STANDARDS_BUNDLE_VERSION,
    verificationStatus: 'partial',
    verificationNote:
      'Tỷ lệ 1:1, tối thiểu 500×500 px, tối đa 2 MB và quy tắc không điều hướng ngoài sàn đã đối chiếu tài liệu Shopee Seller Education; kích thước 1200×1200 px và tỷ lệ chủ thể 70–80% là tiêu chuẩn thiết kế nội bộ VUTECH.',
    slides: [
      {
        slotIndex: 1,
        key: 'shopee-cover-main',
        title: 'Ảnh bìa chính diện chuẩn sàn Shopee',
        shortTitle: 'Ảnh bìa chính',
        description: 'Nền trắng sáng sạch, thiết bị căn giữa 70–80%, chừa vùng an toàn tem Shopee.',
      },
    ],
  },
  {
    id: '02_shopee_detail',
    order: 2,
    name: 'Nhóm 02 – Ảnh Thông Số Shopee (Ảnh Phụ)',
    shortName: 'Ảnh Thông Số Shopee',
    folderName: '02_SHOPEE_ANH_PHU',
    fileGroupSlug: 'SHOPEE_THONGSO',
    platform: 'Shopee',
    placement: 'Bộ ảnh phụ chi tiết sản phẩm (tối đa 08 ảnh phụ + 01 ảnh bìa = 09 ảnh)',
    defaultCount: 8,
    maxCount: 8,
    aspectRatios: ['1:1', '3:4'],
    sizeOptions: [
      { id: '1200x1200', label: '1200 × 1200 px (1:1 Mặc định)', aspectRatio: '1:1', width: 1200, height: 1200 },
      { id: '900x1200', label: '900 × 1200 px (3:4 Di động)', aspectRatio: '3:4', width: 900, height: 1200 },
    ],
    defaultSizeId: '1200x1200',
    minDimensions: { width: 500, height: 500 },
    maxDimensions: { width: 2048, height: 2048 },
    maxFileSizeKB: 2048,
    allowedFormats: ['jpg', 'png'],
    defaultFormat: 'jpg',
    colorSpace: 'sRGB',
    safeZoneDescription: 'Chừa lề tối thiểu 5% quanh mép ảnh, chữ tối thiểu tương đương 16px hiển thị trên màn hình di động.',
    mandatoryPlatformRules: [
      'Tổng ảnh 1 SKU trên Shopee gồm tối đa 09 ảnh (01 ảnh bìa + 08 ảnh phụ).',
      'Định dạng JPG/PNG, dung lượng ≤ 2 MB/ảnh, tỷ lệ 1:1 hoặc 3:4 tùy vị trí ngành hàng hỗ trợ.',
      'Tuyệt đối không chứa hotline, link website, email, mã QR hoặc điều hướng giao dịch ngoài sàn.',
    ],
    internalVutechRules: [
      'Đồng nhất font chữ, bảng màu xanh VUTECH, vị trí logo và bố cục xuyên suốt 08 ảnh.',
      'Không tự suy đoán thông số hoặc bản vẽ chưa xác thực; ảnh thiếu dữ liệu đánh dấu để bỏ qua hoặc bổ sung.',
      'Hỗ trợ kéo thả thay đổi thứ tự hiển thị và duyệt từng ảnh độc lập.',
    ],
    watermarkRules: 'Chỉ gắn logo VUTECH gọn tại thanh tiêu đề, không phủ watermark dày gây khó đọc chữ trên mobile.',
    allowWatermark: false,
    allowExternalContact: false,
    restrictedContent: ['Hotline / SĐT', 'Website / Link ngoài sàn', 'Email', 'Mã QR', 'Thông số chưa xác minh', 'Chứng nhận tự tạo'],
    officialSource: 'Shopee Seller Education Việt Nam (Giới hạn 9 ảnh/SKU & quy chuẩn hiển thị di động)',
    lastVerifiedDate: '2026-11-26',
    standardVersion: STANDARDS_BUNDLE_VERSION,
    verificationStatus: 'partial',
    verificationNote:
      'Giới hạn tổng 9 ảnh/SKU, định dạng JPG/PNG ≤ 2 MB và hỗ trợ 1:1 / 3:4 đã đối chiếu Shopee Seller Education; danh mục 8 chủ đề ảnh là quy chuẩn nội bộ VUTECH.',
    slides: [
      {
        slotIndex: 1,
        key: 'sp-sub-01-hero-specs',
        title: '01. Tên sản phẩm, Model & 3 thông số nổi bật',
        shortTitle: 'Tên & 3 thông số',
        description: 'Giới thiệu nhanh tên thiết bị, mã model và 3 điểm kỹ thuật chính dễ đọc trên di động.',
      },
      {
        slotIndex: 2,
        key: 'sp-sub-02-spec-table',
        title: '02. Bảng thông số kỹ thuật chi tiết',
        shortTitle: 'Bảng thông số',
        description: 'Trình bày thông số kỹ thuật đã xác thực dưới dạng bảng rõ ràng.',
      },
      {
        slotIndex: 3,
        key: 'sp-sub-03-dimensions',
        title: '03. Kích thước & Bản vẽ kỹ thuật',
        shortTitle: 'Kích thước & Bản vẽ',
        description: 'Yêu cầu dữ liệu kích thước hoặc ảnh bản vẽ xác thực từ bộ phận kỹ thuật.',
        requiresTechnicalDoc: true,
      },
      {
        slotIndex: 4,
        key: 'sp-sub-04-materials',
        title: '04. Cấu tạo & Vật liệu sản xuất',
        shortTitle: 'Cấu tạo & Vật liệu',
        description: 'Làm rõ vật liệu vỏ, màng lọc, van điều khiển dựa trên thông số đã nhập.',
      },
      {
        slotIndex: 5,
        key: 'sp-sub-05-features',
        title: '05. Tính năng & Ưu điểm nổi bật',
        shortTitle: 'Tính năng nổi bật',
        description: 'Tóm tắt lợi ích vận hành, độ bền và chất lượng nước sau lọc.',
      },
      {
        slotIndex: 6,
        key: 'sp-sub-06-closeup',
        title: '06. Hình ảnh cận cảnh sản phẩm',
        shortTitle: 'Cận cảnh chi tiết',
        description: 'Phóng cận cảnh chi tiết vật liệu thực tế từ ảnh gốc sắc nét.',
        isMacroOrCloseUp: true,
      },
      {
        slotIndex: 7,
        key: 'sp-sub-07-installation',
        title: '07. Hướng dẫn lắp đặt & Ứng dụng thực tế',
        shortTitle: 'Lắp đặt & Ứng dụng',
        description: 'Phạm vi sử dụng phù hợp (gia đình, nhà xưởng, văn phòng) và lưu ý lắp đặt.',
      },
      {
        slotIndex: 8,
        key: 'sp-sub-08-packaging-cert',
        title: '08. Quy cách đóng gói, xuất xứ & chứng nhận xác thực',
        shortTitle: 'Đóng gói & Xuất xứ',
        description: 'Chỉ hiển thị xuất xứ, đóng gói và chứng nhận khi đã có dữ liệu xác thực.',
        requiresVerifiedCert: true,
      },
    ],
  },
  {
    id: '03_web_clean',
    order: 3,
    name: 'Nhóm 03 – Chuẩn Web Sạch',
    shortName: 'Chuẩn Web Sạch',
    folderName: '03_WEBSITE',
    fileGroupSlug: 'WEB',
    platform: 'Website',
    placement: 'Danh mục sản phẩm & trang chi tiết Website TMĐT VUTECH',
    defaultCount: 6,
    maxCount: 12,
    aspectRatios: ['1:1'],
    sizeOptions: [
      { id: '1600x1600', label: '1600 × 1600 px (Tiêu chuẩn)', aspectRatio: '1:1', width: 1600, height: 1600 },
      { id: '800x800', label: '800 × 800 px (Ảnh thu nhỏ)', aspectRatio: '1:1', width: 800, height: 800 },
      { id: '2048x2048', label: '2048 × 2048 px (Chất lượng cao)', aspectRatio: '1:1', width: 2048, height: 2048 },
    ],
    defaultSizeId: '1600x1600',
    minDimensions: { width: 800, height: 800 },
    maxDimensions: { width: 2560, height: 2560 },
    maxFileSizeKB: 500,
    targetFileSizeRangeKB: { min: 150, max: 500 },
    allowedFormats: ['webp', 'jpg', 'png'],
    defaultFormat: 'webp',
    colorSpace: 'sRGB',
    safeZoneDescription: 'Tập trung sản phẩm ở trung tâm khung 1:1 trên nền sáng tinh khiết, chừa lề đều 6–8%.',
    mandatoryPlatformRules: [
      'Định dạng ưu tiên WebP (hỗ trợ thêm JPG/PNG), không gian màu sRGB để tối ưu Core Web Vitals & tốc độ tải trang.',
      'Tên file không dấu chuẩn SEO và đi kèm nội dung ALT TEXT mô tả đúng sản phẩm.',
    ],
    internalVutechRules: [
      'Kích thước chuẩn 1600×1600 px (tùy chọn 800×800 và 2048×2048), mục tiêu dung lượng WebP 150–500 KB.',
      'Nền sáng tối giản, tuyệt đối không gắn tem khuyến mãi Shopee.',
      'Không tự tạo góc nhìn mới làm sai lệch cấu tạo thật của thiết bị; dùng ảnh chụp góc tương ứng nếu người dùng bổ sung.',
    ],
    watermarkRules: 'Cho phép gắn logo VUTECH gọn gàng và dấu chìm nhẹ 6–10% bảo vệ hình ảnh website.',
    allowWatermark: true,
    allowExternalContact: true,
    restrictedContent: ['Tem khuyến mãi Shopee', 'Góc nhìn AI bịa sai cấu tạo thật'],
    officialSource: 'Tiêu chuẩn Website TMĐT & SEO Hình ảnh nội bộ VUTECH (Google Image SEO / WebP)',
    lastVerifiedDate: '2026-11-26',
    standardVersion: STANDARDS_BUNDLE_VERSION,
    verificationStatus: 'verified',
    verificationNote: 'Cấu hình nội bộ VUTECH chuẩn hóa theo khuyến nghị ảnh WebP tối ưu tốc độ tải trang và SEO.',
    slides: [
      {
        slotIndex: 1,
        key: 'web-01-front-white',
        title: '01. Ảnh đại diện sản phẩm nền trắng',
        shortTitle: 'Chính diện nền trắng',
        description: 'Ảnh đại diện sạch sẽ, sắc nét cho danh mục sản phẩm website.',
      },
      {
        slotIndex: 2,
        key: 'web-02-angle-45',
        title: '02. Góc nhìn nghiêng 45 độ',
        shortTitle: 'Góc nghiêng 45°',
        description: 'Sử dụng ảnh chụp góc 45° thực tế (tải riêng nếu có) hoặc khung trình bày sản phẩm sạch.',
      },
      {
        slotIndex: 3,
        key: 'web-03-side-back',
        title: '03. Góc nhìn mặt bên hoặc mặt sau',
        shortTitle: 'Mặt bên / Mặt sau',
        description: 'Nên nạp ảnh thực tế mặt bên/mặt sau của thiết bị để đảm bảo chính xác cấu tạo.',
      },
      {
        slotIndex: 4,
        key: 'web-04-details',
        title: '04. Chi tiết cấu kiện, tem nhãn & vật liệu',
        shortTitle: 'Chi tiết cấu kiện',
        description: 'Phóng cận cảnh chi tiết inox, van, đồng hồ hoặc tem nhãn thật trên sản phẩm.',
        isMacroOrCloseUp: true,
      },
      {
        slotIndex: 5,
        key: 'web-05-specs-size',
        title: '05. Thông số kỹ thuật & Kích thước',
        shortTitle: 'Thông số & Kích thước',
        description: 'Trình bày thông số kỹ thuật chuẩn xác cùng mã Model VUTECH.',
      },
      {
        slotIndex: 6,
        key: 'web-06-application',
        title: '06. Hình ảnh ứng dụng sản phẩm thực tế',
        shortTitle: 'Ứng dụng thực tế',
        description: 'Minh họa bối cảnh lắp đặt thực tế và thông tin tư vấn chính thức VUTECH.',
      },
    ],
  },
  {
    id: '04_facebook_ads',
    order: 4,
    name: 'Nhóm 04 – Quảng Cáo Facebook',
    shortName: 'Quảng Cáo Facebook',
    folderName: '04_FACEBOOK',
    fileGroupSlug: 'FB',
    platform: 'Facebook',
    placement: 'Feed dọc 4:5 · Vuông/Carousel 1:1 · Stories/Reels 9:16 · Ngang 1.91:1',
    defaultCount: 5,
    maxCount: 20,
    aspectRatios: ['4:5', '1:1', '9:16', '1.91:1'],
    sizeOptions: [
      {
        id: '1080x1350',
        label: '1080 × 1350 px (4:5 Feed dọc – Mặc định)',
        aspectRatio: '4:5',
        width: 1080,
        height: 1350,
        subFolder: 'FEED_4x5',
        ratioKey: '4:5',
      },
      {
        id: '1080x1080',
        label: '1080 × 1080 px (1:1 Vuông / Carousel)',
        aspectRatio: '1:1',
        width: 1080,
        height: 1080,
        subFolder: 'CAROUSEL_1x1',
        ratioKey: '1:1',
      },
      {
        id: '1080x1920',
        label: '1080 × 1920 px (9:16 Stories / Reels)',
        aspectRatio: '9:16',
        width: 1080,
        height: 1920,
        subFolder: 'STORIES_9x16',
        ratioKey: '9:16',
      },
      {
        id: '1200x628',
        label: '1200 × 628 px (1.91:1 Quảng cáo ngang)',
        aspectRatio: '1.91:1',
        width: 1200,
        height: 628,
        subFolder: 'LANDSCAPE',
        ratioKey: '1.91:1',
      },
    ],
    defaultSizeId: '1080x1350',
    minDimensions: { width: 600, height: 315 },
    maxDimensions: null,
    maxFileSizeKB: 2048,
    targetFileSizeRangeKB: { min: 500, max: 2048 },
    allowedFormats: ['jpg', 'png'],
    defaultFormat: 'jpg',
    colorSpace: 'sRGB',
    safeZoneDescription:
      'Feed 4:5 & 1:1 chừa lề 5–8%; Stories/Reels 9:16 chừa 14% đỉnh trên & 25–35% đáy cho giao diện nút CTA của Meta.',
    mandatoryPlatformRules: [
      'Meta Ads Guide: Feed 4:5 (1080×1350), Carousel 1:1 (1080×1080), Stories 9:16 (1080×1920), Ngang 1.91:1 (1200×628).',
      'Định dạng JPG/PNG (giới hạn nền tảng 30 MB); Stories cần chừa vùng an toàn đỉnh trên & nút CTA phía dưới.',
      'Không sử dụng nội dung quảng cáo gây hiểu nhầm hoặc cam kết sai sự thật.',
    ],
    internalVutechRules: [
      'Mục tiêu dung lượng tối ưu nội bộ 0,5–2 MB/ảnh; sử dụng bảng màu xanh nhận diện VUTECH.',
      'Hiển thị Hotline, Website và Trang Facebook lấy trực tiếp từ dữ liệu công ty đã cấu hình (không tự bịa SĐT/chính sách).',
      'Tự động tái bố cục chữ, logo và thiết bị khi chọn nhiều tỷ lệ (chọn đủ 4 tỷ lệ = 20 file thành phẩm), không kéo giãn méo ảnh.',
    ],
    watermarkRules: 'Cho phép gắn logo VUTECH nổi bật ở thanh thương hiệu và dấu chìm nhẹ nếu cần.',
    allowWatermark: true,
    allowExternalContact: true,
    restrictedContent: ['SĐT/Chính sách tự bịa', 'Quảng cáo gây hiểu nhầm', 'Kéo giãn méo sản phẩm'],
    officialSource: 'Meta Ads Guide (Facebook Feed, Carousel, Stories & Link Ads Specs)',
    lastVerifiedDate: '2026-11-26',
    standardVersion: STANDARDS_BUNDLE_VERSION,
    verificationStatus: 'verified',
    verificationNote:
      'Các tỷ lệ 4:5 (1080×1350), 1:1 (1080×1080), 9:16 (1080×1920), 1.91:1 (1200×628), định dạng JPG/PNG và vùng an toàn Stories đã đối chiếu Meta Ads Guide.',
    slides: [
      {
        slotIndex: 1,
        key: 'fb-01-hero-poster',
        title: '01. Poster quảng cáo sản phẩm chủ đạo',
        shortTitle: 'Poster chủ đạo',
        description: 'Điểm nhấn nhận diện thương hiệu VUTECH, tên sản phẩm nổi bật và hotline.',
      },
      {
        slotIndex: 2,
        key: 'fb-02-advantages',
        title: '02. Ưu điểm & Tính năng nổi bật',
        shortTitle: 'Ưu điểm & Tính năng',
        description: 'Làm nổi bật 3 ưu điểm kỹ thuật cốt lõi giúp khách ra quyết định nhanh.',
      },
      {
        slotIndex: 3,
        key: 'fb-03-performance',
        title: '03. Hiệu suất & Lợi ích sử dụng',
        shortTitle: 'Hiệu suất & Lợi ích',
        description: 'Nhấn mạnh công suất lọc, độ ổn định vận hành và chất lượng nước đầu ra.',
      },
      {
        slotIndex: 4,
        key: 'fb-04-applications',
        title: '04. Ứng dụng thực tế & Năng lực cung ứng',
        shortTitle: 'Ứng dụng & Cung ứng',
        description: 'Thể hiện năng lực tư vấn, lắp đặt và cung ứng thiết bị lọc nước VUTECH.',
      },
      {
        slotIndex: 5,
        key: 'fb-05-policy-cta',
        title: '05. Chính sách bán hàng, Liên hệ & CTA',
        shortTitle: 'Liên hệ & CTA',
        description: 'Kêu gọi tư vấn kèm Hotline và thông tin công ty chính thức đã cấu hình.',
      },
    ],
  },
  {
    id: '05_industrial_tech',
    order: 5,
    name: 'Nhóm 05 – Kỹ Thuật Công Nghiệp',
    shortName: 'Kỹ Thuật Công Nghiệp',
    folderName: '05_KY_THUAT_CONG_NGHIEP',
    fileGroupSlug: 'KYTHUAT',
    platform: 'B2B Kỹ thuật',
    placement: 'Hồ sơ năng lực, Báo giá kỹ thuật, Catalogue PDF & Dự án B2B',
    defaultCount: 6,
    maxCount: 12,
    aspectRatios: ['4:3', '16:9'],
    sizeOptions: [
      { id: '1920x1440', label: '1920 × 1440 px (4:3 Tiêu chuẩn)', aspectRatio: '4:3', width: 1920, height: 1440 },
      { id: '3840x2880', label: '3840 × 2880 px (4:3 Siêu nét 4K)', aspectRatio: '4:3', width: 3840, height: 2880 },
      { id: '1920x1080', label: '1920 × 1080 px (16:9 Trình chiếu)', aspectRatio: '16:9', width: 1920, height: 1080 },
    ],
    defaultSizeId: '1920x1440',
    minDimensions: { width: 1280, height: 960 },
    maxDimensions: null,
    maxFileSizeKB: null, // No Shopee size cap!
    allowedFormats: ['png', 'jpg', 'pdf'],
    defaultFormat: 'png',
    colorSpace: 'sRGB',
    safeZoneDescription: 'Khung tài liệu kỹ thuật công nghiệp, chừa lề 4–5% cho in ấn và đóng quyển PDF.',
    mandatoryPlatformRules: [
      'Không áp dụng giới hạn dung lượng 2 MB của Shopee; ưu tiên PNG sắc nét chữ & đường kích thước, hỗ trợ xuất PDF gộp.',
      'Giữ nguyên tuyệt đối đơn vị đo chuyên ngành xử lý nước: L/h, m³/h, GPD, PSI, MPa, bar, mm, DN, µm, µS/cm.',
      'Không tự tạo bản vẽ kích thước, mô hình cắt lớp hay sơ đồ nguyên lý khi chưa có tài liệu kỹ thuật xác thực.',
    ],
    internalVutechRules: [
      'Khung xanh đậm kỹ thuật VUTECH (#071B38 / #0A2246) kết hợp bảng nền sáng tương phản cao cho sản phẩm.',
      'Chú thích hoàn toàn bằng tiếng Việt chuẩn kỹ thuật; các ảnh thiếu bản vẽ/sơ đồ chuyển trạng thái "Cần bổ sung tài liệu kỹ thuật".',
    ],
    watermarkRules: 'Đóng khung nhận diện kỹ thuật VUTECH + mã tài liệu; hỗ trợ watermark bản quyền nhẹ trên bản vẽ.',
    allowWatermark: true,
    allowExternalContact: true,
    restrictedContent: ['Thông số suy đoán bằng AI', 'Bản vẽ / Sơ đồ tự bịa không có nguồn xác thực'],
    officialSource: 'Quy chuẩn Tài liệu Kỹ thuật & Hồ sơ Dự án B2B – Công ty TNHH XNK VUTECH',
    lastVerifiedDate: '2026-11-26',
    standardVersion: STANDARDS_BUNDLE_VERSION,
    verificationStatus: 'verified',
    verificationNote: 'Tiêu chuẩn nội bộ kỹ thuật công nghiệp VUTECH; cho phép xuất 06 ảnh PNG riêng lẻ hoặc gộp thành 01 file PDF kỹ thuật.',
    slides: [
      {
        slotIndex: 1,
        key: 'tech-01-overview',
        title: '01. Tổng quan sản phẩm & Model kỹ thuật',
        shortTitle: 'Tổng quan & Model',
        description: 'Bìa hồ sơ kỹ thuật hiển thị thiết bị, mã model và công suất chính.',
      },
      {
        slotIndex: 2,
        key: 'tech-02-deep-specs',
        title: '02. Bảng thông số kỹ thuật chuyên sâu',
        shortTitle: 'Thông số chuyên sâu',
        description: 'Bảng kỹ thuật giữ nguyên đơn vị L/h, m³/h, GPD, PSI, MPa, bar, mm, DN, µm, µS/cm.',
      },
      {
        slotIndex: 3,
        key: 'tech-03-drawing',
        title: '03. Bản vẽ kích thước kỹ thuật',
        shortTitle: 'Bản vẽ kích thước',
        description: 'Cần tải lên bản vẽ kích thước thật hoặc nhập thông số kích thước xác thực.',
        requiresTechnicalDoc: true,
      },
      {
        slotIndex: 4,
        key: 'tech-04-cutaway',
        title: '04. Mô hình cắt lớp & Cấu tạo bên trong',
        shortTitle: 'Cắt lớp & Cấu tạo',
        description: 'Cần bổ sung hình cắt lớp hoặc tài liệu cấu tạo xác thực từ nhà sản xuất.',
        requiresTechnicalDoc: true,
      },
      {
        slotIndex: 5,
        key: 'tech-05-schematic',
        title: '05. Sơ đồ nguyên lý hoạt động / Sơ đồ kết nối',
        shortTitle: 'Sơ đồ nguyên lý',
        description: 'Cần bổ sung sơ đồ P&ID / sơ đồ đấu nối đường ống xác thực.',
        requiresTechnicalDoc: true,
      },
      {
        slotIndex: 6,
        key: 'tech-06-operating',
        title: '06. Điều kiện vận hành & Phạm vi ứng dụng',
        shortTitle: 'Vận hành & Ứng dụng',
        description: 'Điều kiện nguồn nước đầu vào, phạm vi công trình và thông tin kỹ sư VUTECH.',
      },
    ],
  },
  {
    id: '06_minimal_luxury',
    order: 6,
    name: 'Nhóm 06 – Tối Giản Cao Cấp',
    shortName: 'Tối Giản Cao Cấp',
    folderName: '06_TOI_GIAN_CAO_CAP',
    fileGroupSlug: 'TOIGIAN',
    platform: 'Thương hiệu',
    placement: 'Showcase Thương hiệu, Slide Website Cao cấp & Ấn phẩm Showroom',
    defaultCount: 3,
    maxCount: 6,
    aspectRatios: ['1:1', '4:5', '9:16'],
    sizeOptions: [
      { id: '2160x2160', label: '2160 × 2160 px (1:1 Tiêu chuẩn)', aspectRatio: '1:1', width: 2160, height: 2160 },
      { id: '4096x4096', label: '4096 × 4096 px (1:1 Siêu nét 4K)', aspectRatio: '1:1', width: 4096, height: 4096 },
      { id: '1728x2160', label: '1728 × 2160 px (4:5 Dọc cao cấp)', aspectRatio: '4:5', width: 1728, height: 2160 },
      { id: '1440x2560', label: '1440 × 2560 px (9:16 Dọc toàn màn)', aspectRatio: '9:16', width: 1440, height: 2560 },
    ],
    defaultSizeId: '2160x2160',
    minDimensions: { width: 1440, height: 1440 },
    maxDimensions: null,
    maxFileSizeKB: null, // Prioritize quality over file size
    allowedFormats: ['png', 'jpg', 'webp'],
    defaultFormat: 'png',
    colorSpace: 'sRGB',
    safeZoneDescription: 'Khoảng thở gallery tối thiểu 6% quanh sản phẩm, khối thông tin Obsidian Navy tương phản cao phía dưới.',
    mandatoryPlatformRules: [
      'Ưu tiên tối đa độ sắc nét và chất lượng hiển thị (2160×2160 đến 4096×4096 px), không nén gắt làm bệt chi tiết.',
      'Không chỉnh sửa sai lệch hình dáng, màu sắc, tem nhãn hoặc cấu tạo nguyên bản của sản phẩm.',
    ],
    internalVutechRules: [
      'Nền trắng sáng tinh tế + khối chân xanh đen Obsidian (#0B162C) + viền vàng kim mảnh (#D4AF37) tương phản cao.',
      'Ánh sáng studio sạch, bóng đổ tự nhiên, bố trí logo VUTECH cân bằng tinh tế.',
    ],
    watermarkRules: 'Logo VUTECH trang trọng trên thanh đầu trang; hạn chế watermark đè giữa sản phẩm.',
    allowWatermark: true,
    allowExternalContact: true,
    restrictedContent: ['Chỉnh sửa sai lệch cấu tạo sản phẩm', 'Chữ tương phản thấp khó đọc'],
    officialSource: 'Bộ nhận diện Thương hiệu Cao cấp – Công ty TNHH XNK VUTECH',
    lastVerifiedDate: '2026-11-26',
    standardVersion: STANDARDS_BUNDLE_VERSION,
    verificationStatus: 'verified',
    verificationNote: 'Tiêu chuẩn nhận diện thương hiệu nội bộ VUTECH với phối màu Obsidian Navy & Champagne Gold tương phản cao.',
    slides: [
      {
        slotIndex: 1,
        key: 'lux-01-front',
        title: '01. Ảnh sản phẩm chính diện cao cấp',
        shortTitle: 'Chính diện cao cấp',
        description: 'Góc chính diện hoàn hảo trên nền gallery sáng kết hợp chân Obsidian & viền vàng kim.',
      },
      {
        slotIndex: 2,
        key: 'lux-02-angle45',
        title: '02. Ảnh góc nghiêng 45° ánh sáng studio',
        shortTitle: 'Góc nghiêng 45°',
        description: 'Tôn vinh chiều sâu thân máy (khuyến nghị nạp thêm ảnh góc nghiêng thực tế nếu có).',
      },
      {
        slotIndex: 3,
        key: 'lux-03-macro',
        title: '03. Ảnh macro cận cảnh vật liệu & hoàn thiện',
        shortTitle: 'Macro cận cảnh',
        description: 'Cận cảnh chất liệu inox, kính cường lực hoặc đồng hồ áp suất sắc nét.',
        isMacroOrCloseUp: true,
      },
    ],
  },
  {
    id: '07_copyright_watermark',
    order: 7,
    name: 'Nhóm 07 – Đóng Dấu Bản Quyền',
    shortName: 'Đóng Dấu Bản Quyền',
    folderName: '07_DONG_DAU_BAN_QUYEN',
    fileGroupSlug: 'BANQUYEN',
    platform: 'Đa nền tảng',
    placement: 'Bảo vệ bản quyền toàn bộ ảnh chụp thực tế công trình & kho hàng (N ảnh vào → N ảnh ra)',
    defaultCount: 1,
    maxCount: null, // Dynamic N input -> N output
    aspectRatios: ['Giữ nguyên ảnh gốc'],
    sizeOptions: [
      { id: 'original', label: 'Giữ nguyên tỷ lệ & độ phân giải ảnh gốc', aspectRatio: 'Gốc', width: 0, height: 0 },
    ],
    defaultSizeId: 'original',
    minDimensions: { width: 200, height: 200 },
    maxDimensions: null,
    maxFileSizeKB: null,
    allowedFormats: ['png', 'jpg', 'webp'],
    defaultFormat: 'png',
    colorSpace: 'sRGB',
    safeZoneDescription: 'Giữ nguyên 100% bố cục, tỷ lệ và độ phân giải gốc; không cắt ghép hoặc ghi đè file gốc.',
    mandatoryPlatformRules: [
      'Số lượng ảnh đầu ra luôn bằng đúng số lượng ảnh gốc đầu vào (VD: tải 10 ảnh → xuất đúng 10 ảnh).',
      'Xử lý trực tiếp bằng Canvas 2D thuần, không gọi API AI tạo sinh để tiết kiệm 100% chi phí API.',
    ],
    internalVutechRules: [
      'Hỗ trợ đóng dấu góc (4 góc), đóng dấu chìm giữa ảnh, hoặc đóng dấu chìm lặp lại toàn khung ảnh.',
      'Tùy chỉnh kích thước logo, độ trong suốt từ 5% đến 100%, xem trước thời gian thực và áp dụng cho toàn bộ ảnh.',
      'Không ghi đè ảnh gốc; cho phép giữ định dạng gốc hoặc chuyển sang PNG, JPG, WebP.',
    ],
    watermarkRules: 'Chế độ chuyên biệt đóng dấu bản quyền VUTECH bằng Canvas.',
    allowWatermark: true,
    allowExternalContact: false,
    restrictedContent: ['Tự động cắt xén ảnh gốc', 'Gọi AI tạo sinh làm biến đổi ảnh thật'],
    officialSource: 'Quy trình Bảo vệ Hình ảnh Thực tế & Bản quyền – Công ty TNHH XNK VUTECH',
    lastVerifiedDate: '2026-11-26',
    standardVersion: STANDARDS_BUNDLE_VERSION,
    verificationStatus: 'verified',
    verificationNote: 'Xử lý hoàn toàn phía trình duyệt bằng Canvas 2D, giữ nguyên độ phân giải gốc và không phát sinh phí API.',
    slides: [
      {
        slotIndex: 1,
        key: 'wm-01',
        title: 'Ảnh đóng dấu bản quyền #01',
        shortTitle: 'Ảnh bản quyền #01',
        description: 'Giữ nguyên tỷ lệ và độ phân giải gốc, đóng dấu logo VUTECH theo cấu hình.',
      },
    ],
  },
];

export function createDefaultGroupSettings(
  registry: PlatformStandardEntry[]
): Record<DesignGroupId, GroupRuntimeSettings> {
  const result = {} as Record<DesignGroupId, GroupRuntimeSettings>;
  for (const entry of registry) {
    result[entry.id] = {
      sizeId: entry.defaultSizeId,
      format: entry.defaultFormat,
      quality: entry.defaultFormat === 'webp' ? 0.86 : 0.92,
      enforceMaxSizeKB: entry.maxFileSizeKB,
      enableWatermark: entry.id === '07_copyright_watermark',
      facebookRatios: ['4:5'],
      shopeePreviewOverlay: entry.id === '01_shopee_cover',
      watermark: {
        mode: 'corner',
        corner: 'bottom-right',
        logoScalePct: 18,
        opacityPct: 45,
        keepOriginalFormat: true,
      },
    };
  }
  return result;
}

export function loadPlatformRegistry(): PlatformStandardEntry[] {
  try {
    const raw = window.localStorage.getItem(PLATFORM_REGISTRY_STORAGE_KEY);
    if (!raw) return DEFAULT_PLATFORM_REGISTRY;
    const parsed = JSON.parse(raw) as PlatformStandardEntry[];
    if (!Array.isArray(parsed) || parsed.length !== DEFAULT_PLATFORM_REGISTRY.length) {
      return DEFAULT_PLATFORM_REGISTRY;
    }
    // Ensure slide blueprints & required fields always stay intact
    return DEFAULT_PLATFORM_REGISTRY.map((def) => {
      const saved = parsed.find((p) => p.id === def.id);
      if (!saved) return def;
      return {
        ...def,
        ...saved,
        slides: def.slides,
        sizeOptions: def.sizeOptions,
      };
    });
  } catch {
    return DEFAULT_PLATFORM_REGISTRY;
  }
}

export function savePlatformRegistry(entries: PlatformStandardEntry[]): void {
  try {
    window.localStorage.setItem(PLATFORM_REGISTRY_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage quota errors
  }
}

export interface PlatformBundlePreset {
  id: PlatformBundleId;
  label: string;
  description: string;
  groupIds: DesignGroupId[];
  facebookRatios?: FacebookRatioKey[];
  exportIndustrialPdf?: boolean;
}

export const PLATFORM_BUNDLE_PRESETS: PlatformBundlePreset[] = [
  {
    id: 'shopee-full',
    label: 'Bộ Shopee hoàn chỉnh',
    description: '01 ảnh bìa chuẩn sàn + 08 ảnh phụ thông số (tối ưu ≤ 2 MB, không tem mô phỏng)',
    groupIds: ['01_shopee_cover', '02_shopee_detail'],
  },
  {
    id: 'website-ecom',
    label: 'Bộ Website thương mại điện tử',
    description: '06 ảnh chuẩn WebP 1600×1600 px kèm tên file SEO & ALT TEXT',
    groupIds: ['03_web_clean'],
  },
  {
    id: 'fb-feed',
    label: 'Bộ Facebook Feed (4:5)',
    description: '05 thiết kế quảng cáo tỷ lệ 4:5 (1080×1350 px)',
    groupIds: ['04_facebook_ads'],
    facebookRatios: ['4:5'],
  },
  {
    id: 'fb-carousel',
    label: 'Bộ Facebook Carousel (1:1)',
    description: '05 thiết kế vuông 1:1 (1080×1080 px) cho băng chuyền Carousel',
    groupIds: ['04_facebook_ads'],
    facebookRatios: ['1:1'],
  },
  {
    id: 'fb-stories',
    label: 'Bộ Facebook Stories / Reels (9:16)',
    description: '05 thiết kế dọc 9:16 (1080×1920 px) chừa vùng an toàn UI Meta',
    groupIds: ['04_facebook_ads'],
    facebookRatios: ['9:16'],
  },
  {
    id: 'fb-all-ratios',
    label: 'Bộ Facebook tất cả 4 tỷ lệ (20 file)',
    description: '05 nội dung × 4 tỷ lệ (4:5, 1:1, 9:16, 1.91:1) phân chia sẵn 4 thư mục con',
    groupIds: ['04_facebook_ads'],
    facebookRatios: ['4:5', '1:1', '9:16', '1.91:1'],
  },
  {
    id: 'industrial-docs',
    label: 'Bộ tài liệu kỹ thuật công nghiệp',
    description: '06 ảnh PNG 1920×1440 px + tùy chọn gộp tài liệu PDF kỹ thuật',
    groupIds: ['05_industrial_tech'],
    exportIndustrialPdf: true,
  },
  {
    id: 'luxury-brand',
    label: 'Bộ hình ảnh thương hiệu cao cấp',
    description: '03 ảnh Tối Giản Cao Cấp 2160×2160 px phối Obsidian Navy & Vàng kim',
    groupIds: ['06_minimal_luxury'],
  },
  {
    id: 'copyright-watermark',
    label: 'Bộ ảnh đóng dấu bản quyền',
    description: 'Toàn bộ N ảnh gốc đã đóng dấu logo VUTECH, giữ nguyên độ phân giải gốc',
    groupIds: ['07_copyright_watermark'],
  },
];
