import type {
  WaterTreatmentCategoryId,
  TechnicalSpecItem,
  FieldDataSource,
} from '../types/recognition';

export interface WaterTreatmentCategoryDef {
  id: WaterTreatmentCategoryId;
  code: string;
  name: string;
  shortTypeLabel: string;
  subCategories: string[];
  keywords: string[];
  modelPatterns: RegExp[];
  allowedSpecFields: Array<{
    name: string;
    defaultUnit?: string;
    description: string;
  }>;
  forbiddenSpecKeywords: string[];
}

export interface ReferenceBrandDef {
  brand: string;
  aliases: string[];
  manufacturer: string;
  defaultOrigin: string;
  typicalCategories: WaterTreatmentCategoryId[];
}

export interface VutechCatalogProduct {
  id: string;
  sku: string;
  brand: string;
  manufacturer: string;
  model: string;
  rawModelAliases: string[];
  productName: string;
  shortName: string;
  categoryId: WaterTreatmentCategoryId;
  category: string;
  subCategory: string;
  material: string;
  origin: string;
  packaging: string;
  applications: string[];
  specs: Array<{
    name: string;
    value: string;
    unit?: string;
  }>;
}

export const VUTECH_DISTRIBUTOR_NAME = 'CÔNG TY TNHH XNK VUTECH';

/**
 * 10 NHÓM SẢN PHẨM CHUYÊN NGÀNH VẬT TƯ, THIẾT BỊ & CÔNG NGHỆ XỬ LÝ NƯỚC VUTECH
 */
export const WATER_TREATMENT_CATEGORIES: WaterTreatmentCategoryDef[] = [
  {
    id: '01_ro_membrane',
    code: 'NHÓM 01',
    name: 'Màng lọc RO',
    shortTypeLabel: 'Màng RO',
    subCategories: [
      'Màng RO dân dụng (1812 / 2012 / 2812 / 3012 / 3013)',
      'Màng RO thương mại (4021 / 4040)',
      'Màng RO công nghiệp (4040 / 8040)',
      'Màng RO áp thấp (ULP / XLP / LP)',
      'Màng RO nước lợ (BW)',
      'Màng RO nước biển (SW)',
    ],
    keywords: [
      'reverse osmosis',
      'ro membrane',
      'màng ro',
      'màng lọc ro',
      '1812',
      '2012',
      '2812',
      '3012',
      '3013',
      '4040',
      '6040',
      '8040',
      'xlpft',
      'ulp',
      'bw30',
      'sw30',
      'gpd',
      'frotec',
      'filmtec',
      'vontron',
      'toray',
      'hydranautics',
    ],
    modelPatterns: [
      /\b(1812|2012|2812|3012|3013)[-\s]?\d{2,3}\s*(GPD)?\b/i,
      /\b(XLPFT|ULP|XLP|BW30|SW30|LP|TW30|CPA|ESPA|TM)[-\s]?(4040|8040|4021|2540)\b/i,
      /\b(4040|8040)\b/i,
    ],
    allowedSpecFields: [
      { name: 'Kích thước màng', defaultUnit: 'inch', description: '1812, 3012, 4040, 8040...' },
      { name: 'Công suất lọc', defaultUnit: 'GPD / m³/ngày', description: 'Lưu lượng nước thành phẩm' },
      { name: 'Tỷ lệ khử muối', defaultUnit: '%', description: 'Khả năng loại bỏ TDS/muối hòa tan' },
      { name: 'Áp suất vận hành', defaultUnit: 'psi / bar', description: 'Áp suất làm việc tiêu chuẩn' },
      { name: 'Diện tích màng hoạt động', defaultUnit: 'ft² (m²)', description: 'Diện tích bề mặt màng' },
      { name: 'Loại nước đầu vào', description: 'Nước máy, nước lợ (BW), nước biển (SW)' },
      { name: 'Vật liệu màng', description: 'Polyamide Thin-Film Composite (TFC)' },
      { name: 'Dải pH làm việc', description: 'pH vận hành liên tục và rửa màng' },
    ],
    forbiddenSpecKeywords: ['hạt nhựa', 'dung lượng trao đổi', 'van 3 ngả', 'van 5 ngả', 'sục rửa tự động'],
  },
  {
    id: '02_uf_membrane',
    code: 'NHÓM 02',
    name: 'Màng lọc UF',
    shortTypeLabel: 'Màng UF',
    subCategories: [
      'Màng UF công nghiệp vỏ PVC/UPVC',
      'Màng UF sợi rỗng (Hollow Fiber)',
      'Màng UF PAN (Polyacrylonitrile)',
      'Màng UF PVDF',
      'Màng UF PES',
      'Màng UF dân dụng',
    ],
    keywords: [
      'ultrafiltration',
      'uf membrane',
      'màng uf',
      'màng siêu lọc',
      'sợi rỗng',
      'hollow fiber',
      'pan',
      'pvdf',
      'pes',
      '0.01 micron',
      '40m2',
      '40 m2',
      'uf-4040',
      'uf-8060',
    ],
    modelPatterns: [
      /\bUF[-\s]?(4040|8060|2500|4000|6000|8000|40M2|50M2)\b/i,
      /\b(PAN|PVDF|PES)[-\s]?\d{1,3}\s*(M2|m²)?\b/i,
    ],
    allowedSpecFields: [
      { name: 'Vật liệu sợi màng', description: 'PAN / PVDF / PES sợi rỗng' },
      { name: 'Diện tích màng', defaultUnit: 'm²', description: 'Diện tích bề mặt lọc' },
      { name: 'Kích thước lỗ lọc', defaultUnit: 'µm (Micron)', description: 'Thường 0.01 - 0.03 µm' },
      { name: 'Lưu lượng thiết kế', defaultUnit: 'm³/giờ', description: 'Công suất lọc tiêu chuẩn' },
      { name: 'Kiểu lọc', description: 'Ngoài vào trong (Out-to-In) hoặc Trong ra ngoài (In-to-Out)' },
      { name: 'Vật liệu vỏ màng', description: 'UPVC / ABS / Inox' },
      { name: 'Áp suất làm việc tối đa', defaultUnit: 'MPa / bar', description: 'Áp suất vận hành an toàn' },
    ],
    forbiddenSpecKeywords: ['dung lượng trao đổi', 'cation', 'anion', 'khử muối 99.5%'],
  },
  {
    id: '03_ion_resin',
    code: 'NHÓM 03',
    name: 'Hạt nhựa trao đổi ion',
    shortTypeLabel: 'Hạt Nhựa Trao Đổi Ion',
    subCategories: [
      'Hạt nhựa Cation axit mạnh (SAC)',
      'Hạt nhựa Cation axit yếu (WAC)',
      'Hạt nhựa Anion bazơ mạnh (SBA)',
      'Hạt nhựa Anion bazơ yếu (WBA)',
      'Hạt nhựa Mixed Bed (Khử khoáng hỗn hợp)',
      'Hạt nhựa làm mềm nước thực phẩm',
    ],
    keywords: [
      'ion exchange resin',
      'cation exchange resin',
      'anion exchange resin',
      'strong acid cation',
      'hạt nhựa',
      'hạt cation',
      'hạt anion',
      'mixed bed',
      '001x7',
      '001×7',
      '001x8',
      '001×8',
      'c100',
      'c100e',
      'extrepure',
      'purolite',
      'trao đổi ion',
      'làm mềm nước',
      '25l',
      '25 liters',
    ],
    modelPatterns: [
      /\b001\s*[xX×*]\s*7\s*(\(\s*C100E?\s*\))?/i,
      /\b001\s*[xX×*]\s*8\s*(\(\s*C100E?\s*\))?/i,
      /\b201\s*[xX×*]\s*7\b/i,
      /\b(C100E?|C100|A400|A500|MB400|S108)\b/i,
    ],
    allowedSpecFields: [
      { name: 'Loại hạt nhựa', description: 'Strong Acid Cation / Anion / Mixed Bed Exchange Resin' },
      { name: 'Cấu trúc Polymer', description: 'Gel Polystyrene liên kết ngang Divinylbenzene (DVB)' },
      { name: 'Nhóm chức năng', description: 'Sulfonic Acid (-SO₃⁻) hoặc Quaternary Ammonium' },
      { name: 'Dạng ion xuất xưởng', description: 'Na⁺ (Natri) hoặc H⁺ (Hydro) / Cl⁻' },
      { name: 'Tổng dung lượng trao đổi', defaultUnit: 'eq/L', description: 'Khả năng trao đổi ion tối thiểu' },
      { name: 'Kích thước hạt', defaultUnit: 'mm', description: 'Phân bố cỡ hạt tiêu chuẩn (0.315 - 1.25 mm)' },
      { name: 'Độ ẩm giữ nước', defaultUnit: '%', description: 'Hàm lượng ẩm tiêu chuẩn (45 - 50%)' },
      { name: 'Nhiệt độ vận hành tối đa', defaultUnit: '°C', description: 'Nhiệt độ làm việc an toàn' },
      { name: 'Quy cách đóng gói', defaultUnit: 'Lít/bao (kg/bao)', description: 'Thường 25 Lít/bao' },
    ],
    forbiddenSpecKeywords: [
      'nguồn điện',
      'dc 12v',
      '220v',
      '1.5a',
      '3 chế độ lọc',
      'sục rửa tự động',
      'công suất điện',
      'màn hình lcd',
    ],
  },
  {
    id: '04_filter_media',
    code: 'NHÓM 04',
    name: 'Vật liệu lọc nước',
    shortTypeLabel: 'Vật Liệu Lọc Nước',
    subCategories: [
      'Than hoạt tính gáo dừa / Anthracite',
      'Cát thạch anh / Sỏi đỡ kỹ thuật',
      'Cát Mangan / Quặng Mangan khử sắt',
      'Hạt Birm / Hạt Pyrolox khử sắt',
      'Hạt nâng pH Corosex / Calcite / Flomag',
      'Vật liệu lọc đa năng ODM-2F / AC',
    ],
    keywords: [
      'than hoạt tính',
      'activated carbon',
      'iodine',
      'cát thạch anh',
      'sỏi thạch anh',
      'cát mangan',
      'hạt birm',
      'corosex',
      'odm-2f',
      'anthracite',
      'filox',
      'vật liệu lọc',
    ],
    modelPatterns: [
      /\b(ODM[-\s]?2F|BIR[-\s]?100|MESH\s*\d+[xX×-]\d+|IODINE\s*\d{3,4})\b/i,
    ],
    allowedSpecFields: [
      { name: 'Chủng loại vật liệu', description: 'Than hoạt tính / Cát thạch anh / Hạt xúc tác khử sắt' },
      { name: 'Kích thước hạt (Mesh / mm)', description: 'Cỡ hạt tiêu chuẩn (ví dụ: 6×12 mesh, 8×16 mesh, 1-2 mm)' },
      { name: 'Chỉ số hấp phụ / Hoạt tính', description: 'Chỉ số Iodine (mg/g) hoặc hàm lượng hoạt chất' },
      { name: 'Tỷ trọng khối', defaultUnit: 'g/cm³ (kg/L)', description: 'Khối lượng riêng khi nạp cột' },
      { name: 'Độ ẩm tối đa', defaultUnit: '%', description: 'Độ ẩm tiêu chuẩn' },
      { name: 'Quy cách đóng gói', defaultUnit: 'kg/bao (Lít/bao)', description: 'Trọng lượng hoặc thể tích bao' },
    ],
    forbiddenSpecKeywords: ['nguồn điện', 'dc 12v', '220v', '3 chế độ lọc', 'màn hình'],
  },
  {
    id: '05_vessels_tanks',
    code: 'NHÓM 05',
    name: 'Cột lọc và bồn chứa',
    shortTypeLabel: 'Cột Lọc',
    subCategories: [
      'Cột lọc Composite / FRP dân dụng & thương mại',
      'Cột lọc Composite / FRP công nghiệp cổ Top-Mount / Side-Mount',
      'Cột lọc Inox 304 / 316',
      'Bồn muối hoàn nguyên PE',
      'Bồn chứa hóa chất định lượng',
      'Phễu lọc / Lưới chụp trên - dưới',
    ],
    keywords: [
      'frp tank',
      'composite tank',
      'cột lọc composite',
      'cột lọc frp',
      'cột lọc inox',
      'bồn muối',
      'bồn hóa chất',
      '0844',
      '1054',
      '1252',
      '1354',
      '1465',
      '1665',
      '1865',
      '2162',
      '2472',
      '3072',
      '3672',
      'pentair',
      'canature',
      'runmo',
      'huamo',
    ],
    modelPatterns: [
      /\b(FRP[-\s]?)?(0844|1054|1252|1354|1465|1665|1865|2162|2472|3072|3672|4272|4872)\b/i,
    ],
    allowedSpecFields: [
      { name: 'Mã kích thước cột', description: 'Ví dụ: 1054 (Đường kính 10 inch × Cao 54 inch)' },
      { name: 'Vật liệu chế tạo', description: 'Sợi thủy tinh FRP lót PE hoặc Inox SUS304/316' },
      { name: 'Dung tích chứa', defaultUnit: 'Lít', description: 'Thể tích tổng của cột' },
      { name: 'Cổ kết nối (Opening)', description: 'Ren 2.5" - 8NPSM hoặc 4" - 8UN / Mặt bích' },
      { name: 'Áp suất làm việc tối đa', defaultUnit: 'psi (bar)', description: 'Thường 150 psi (10.5 bar)' },
      { name: 'Nhiệt độ làm việc', defaultUnit: '°C', description: '1 - 49°C' },
    ],
    forbiddenSpecKeywords: ['nguồn điện', 'dc 12v', 'khử muối 99%', 'dung lượng trao đổi eq/l'],
  },
  {
    id: '06_control_valves',
    code: 'NHÓM 06',
    name: 'Van điều khiển',
    shortTypeLabel: 'Van Điều Khiển',
    subCategories: [
      'Van tự động sục rửa cột lọc (Auto Filter Valve)',
      'Van tự động làm mềm nước hoàn nguyên muối (Auto Softener Valve)',
      'Van cơ 3 ngả (Manual Filter Valve)',
      'Van cơ 5 ngả hút muối (Manual Softener Valve)',
      'Van điện từ / Van bướm điều khiển khí nén - điện',
    ],
    keywords: [
      'runxin',
      'autotrol',
      'clack',
      'fleck',
      'van điều khiển',
      'van tự động',
      'van cơ',
      'van 3 ngả',
      'van 5 ngả',
      'f63b1',
      'f63c3',
      'f65b1',
      'f67c1',
      'f67b1',
      'f68a1',
      'f71b1',
      'f64a',
      'f64b',
      'f56a',
      'f112a',
    ],
    modelPatterns: [
      /\bF(56|63|64|65|67|68|69|71|74|77|78|82|96|99|112)[A-Z]\d?\b/i,
    ],
    allowedSpecFields: [
      { name: 'Chức năng van', description: 'Tự động làm mềm (5 chu trình) hoặc Tự động lọc (3 chu trình)' },
      { name: 'Lưu lượng làm việc', defaultUnit: 'm³/giờ', description: 'Lưu lượng định mức qua van' },
      { name: 'Cổ kết nối cột lọc', description: '2.5"-8NPSM hoặc 4"-8UN' },
      { name: 'Đường ống vào / ra / xả', description: 'Kích thước ren kết nối (3/4", 1", 1.5", 2")' },
      { name: 'Ống trung tâm', description: 'Đường kính ống стояк (26.7 mm / 50 mm)' },
      { name: 'Nguồn điện Adapter', description: 'AC 100-240V / DC 12V-1.5A (đối với van tự động)' },
      { name: 'Áp suất nước làm việc', defaultUnit: 'MPa (bar)', description: '0.15 - 0.6 MPa' },
    ],
    forbiddenSpecKeywords: ['hạt nhựa 25l', 'khử muối 99.5%'],
  },
  {
    id: '07_membrane_housings',
    code: 'NHÓM 07',
    name: 'Vỏ màng lọc',
    shortTypeLabel: 'Vỏ Màng RO',
    subCategories: [
      'Vỏ màng RO Composite / FRP (4040 / 8040)',
      'Vỏ màng RO Inox SUS304 / SUS316L (4040 / 8040)',
      'Vỏ màng RO dân dụng (1812 / 3012 / 3013)',
      'Cốc lọc tinh 10 inch / 20 inch / Phin lọc lõi Inox',
    ],
    keywords: [
      'membrane housing',
      'ro vessel',
      'vỏ màng',
      'vỏ màng ro',
      'vỏ màng inox',
      'vỏ màng composite',
      '4040-1',
      '4040-2',
      '8040-1',
      '8040-2',
      '8040-3',
      '300psi',
      '450psi',
      '1000psi',
      'phin lọc inox',
    ],
    modelPatterns: [
      /\b(4040|8040|4021)[-\s]?[1-6](E|W|S)?\b/i,
      /\b(300|450|600|1000)\s*PSI\b/i,
    ],
    allowedSpecFields: [
      { name: 'Kích thước & Số màng chứa', description: 'Ví dụ: 4040 - 1 màng, 8040 - 2 màng...' },
      { name: 'Vật liệu thân vỏ', description: 'Inox SUS304 / SUS316L hoặc Composite FRP' },
      { name: 'Áp suất thiết kế', defaultUnit: 'psi', description: '300 psi / 450 psi / 600 psi / 1000 psi' },
      { name: 'Kiểu kết nối cổng nước', description: 'End Port (Đầu vỏ) hoặc Side Port (Hông vỏ)' },
      { name: 'Kiểu khóa nắp', description: 'Khóa cùm Clamp hoặc Vòng chặn Retaining Ring' },
    ],
    forbiddenSpecKeywords: ['nguồn điện dc 12v', 'dung lượng trao đổi eq/l'],
  },
  {
    id: '08_edi_equipment',
    code: 'NHÓM 08',
    name: 'Thiết bị EDI',
    shortTypeLabel: 'Module EDI',
    subCategories: [
      'Module khử khoáng điện tử EDI (Electrodeionization)',
      'Bộ nguồn chỉnh lưu DC cấp cho EDI',
      'Phụ kiện & lưu lượng kế cụm EDI',
    ],
    keywords: [
      'edi module',
      'electrodeionization',
      'module edi',
      'thiết bị edi',
      'kxa',
      'kxa-200',
      'canpure',
      'ionpure',
      'suez edi',
      '15 mω',
      '18 mω',
      'mω.cm',
      'nước siêu tinh khiết',
    ],
    modelPatterns: [
      /\b(KXA|EDI|LX|VNX|IP)[-\s]?\d{2,4}[A-Z]?\b/i,
    ],
    allowedSpecFields: [
      { name: 'Lưu lượng nước siêu tinh khiết', defaultUnit: 'm³/giờ (L/h)', description: 'Công suất định mức của module' },
      { name: 'Điện trở suất nước đầu ra', defaultUnit: 'MΩ·cm', description: 'Thường ≥ 15 - 18 MΩ·cm' },
      { name: 'Tỷ lệ thu hồi nước', defaultUnit: '%', description: '90 - 95%' },
      { name: 'Điện áp & Dòng điện DC làm việc', description: 'Điện áp DC và cường độ dòng định mức' },
      { name: 'Áp suất vận hành', defaultUnit: 'bar', description: 'Áp suất nước cấp cho EDI' },
    ],
    forbiddenSpecKeywords: ['bao 25 lít', 'cát thạch anh'],
  },
  {
    id: '09_auxiliary_equipment',
    code: 'NHÓM 09',
    name: 'Thiết bị phụ trợ',
    shortTypeLabel: 'Thiết Bị Phụ Trợ',
    subCategories: [
      'Bơm trục đứng cao áp RO (CNP / Grundfos)',
      'Bơm định lượng hóa chất (Seko / Prominent / Blue-White)',
      'Đồng hồ áp suất / Lưu lượng kế (Rotameter)',
      'Cảm biến & Bộ đo TDS / Độ dẫn điện (Conductivity / Resistivity)',
      'Tủ điện điều khiển PLC / Công tắc áp suất / Đèn UV diệt khuẩn',
    ],
    keywords: [
      'bơm cao áp',
      'bơm trục đứng',
      'bơm định lượng',
      'cnp',
      'cdlf',
      'cdl',
      'grundfos',
      'seko',
      'đồng hồ áp',
      'lưu lượng kế',
      'rotameter',
      'cảm biến tds',
      'độ dẫn điện',
      'conductivity',
      'cct-3320',
      'cm-230',
      'đèn uv',
      'công tắc áp',
    ],
    modelPatterns: [
      /\bCDL(F)?\s*\d+[-\s]\d+\b/i,
      /\b(CCT|CM|RM)[-\s]?\d{3,4}[A-Z]?\b/i,
      /\b(AMS|AKA|TEKNA)\s*\d{3}\b/i,
    ],
    allowedSpecFields: [
      { name: 'Thông số làm việc chính', description: 'Lưu lượng / Cột áp / Dải đo kỹ thuật' },
      { name: 'Công suất / Nguồn cấp', description: 'Điện áp hoặc áp suất vận hành' },
      { name: 'Vật liệu tiếp xúc môi chất', description: 'Inox 304 / 316 / PVDF / UPVC' },
      { name: 'Chuẩn kết nối', description: 'Mặt bích / Ren tiêu chuẩn / Tín hiệu ngõ ra' },
    ],
    forbiddenSpecKeywords: ['bao 25 lít', 'dung lượng trao đổi eq/l'],
  },
  {
    id: '10_complete_systems',
    code: 'NHÓM 10',
    name: 'Hệ thống xử lý nước hoàn chỉnh',
    shortTypeLabel: 'Hệ Thống Xử Lý Nước',
    subCategories: [
      'Hệ thống lọc nước RO công nghiệp',
      'Hệ thống siêu lọc UF công nghiệp',
      'Hệ thống xử lý nước siêu tinh khiết RO + EDI',
      'Hệ thống lọc tổng đầu nguồn biệtự / tòa nhà',
      'Hệ thống làm mềm nước nồi hơi / tháp giải nhiệt',
      'Hệ thống xử lý nước cấp dược phẩm / y tế / thực phẩm',
    ],
    keywords: [
      'hệ thống lọc nước ro',
      'hệ thống ro công nghiệp',
      'hệ thống uf',
      'hệ thống edi',
      'hệ thống lọc tổng',
      'hệ thống làm mềm',
      'dây chuyền lọc nước',
      '500 l/h',
      '1000 l/h',
      '2000 l/h',
    ],
    modelPatterns: [
      /\b(VT[-\s]?RO|RO[-\s]?SYS)[-\s]?\d{3,5}\b/i,
    ],
    allowedSpecFields: [
      { name: 'Công suất thiết kế', defaultUnit: 'L/giờ (m³/giờ)', description: 'Công suất nước thành phẩm' },
      { name: 'Cấu hình công nghệ', description: 'Tiền xử lý + RO 1 cấp/2 cấp + EDI/UV' },
      { name: 'Khung giá đỡ & Đường ống', description: 'Khung Inox SUS304, ống UPVC/Inox vi sinh' },
      { name: 'Hệ thống điều khiển', description: 'Tự động PLC / Rơ-le tích hợp giám sát độ dẫn TDS' },
      { name: 'Tiêu chuẩn nước đầu ra', description: 'QCVN 6-1:2010/BYT / Nước tinh khiết công nghiệp' },
    ],
    forbiddenSpecKeywords: ['bao 25 lít'],
  },
];

/**
 * DANH SÁCH THƯƠNG HIỆU THAM CHIẾU TRONG NGÀNH XỬ LÝ NƯỚC
 * Chỉ dùng để đối chiếu khi có bằng chứng từ chữ đọc được (OCR) hoặc danh mục sản phẩm.
 * KHÔNG BAO GIỜ ép gán thương hiệu khi không có bằng chứng.
 */
export const WATER_TREATMENT_REFERENCE_BRANDS: ReferenceBrandDef[] = [
  {
    brand: 'EXTREPURE',
    aliases: ['EXTREPURE', 'EXTRE PURE'],
    manufacturer: 'EXTREPURE Water Treatment Co., Ltd.',
    defaultOrigin: 'Trung Quốc (Tiêu chuẩn xuất khẩu)',
    typicalCategories: ['03_ion_resin'],
  },
  {
    brand: 'FROTEC',
    aliases: ['FROTEC', 'FRO-TEC'],
    manufacturer: 'FROTEC Membrane Technology',
    defaultOrigin: 'Trung Quốc',
    typicalCategories: ['01_ro_membrane'],
  },
  {
    brand: 'RUNXIN',
    aliases: ['RUNXIN', 'RUN XIN'],
    manufacturer: 'Wenzhou Runxin Manufacturing Machine Co., Ltd.',
    defaultOrigin: 'Trung Quốc',
    typicalCategories: ['06_control_valves'],
  },
  {
    brand: 'RUNMO',
    aliases: ['RUNMO', 'RUN MO'],
    manufacturer: 'Runmo Membrane Technology',
    defaultOrigin: 'Trung Quốc',
    typicalCategories: ['01_ro_membrane', '02_uf_membrane', '07_membrane_housings'],
  },
  {
    brand: 'PUROLITE',
    aliases: ['PUROLITE', 'ECOLAB PUROLITE'],
    manufacturer: 'Purolite (An Ecolab Company)',
    defaultOrigin: 'Anh / Mỹ / Nhà máy toàn cầu',
    typicalCategories: ['03_ion_resin'],
  },
  {
    brand: 'DUPONT',
    aliases: ['DUPONT', 'FILMTEC', 'DOW', 'DOW FILMTEC'],
    manufacturer: 'DuPont Water Solutions (FilmTec)',
    defaultOrigin: 'Mỹ (USA)',
    typicalCategories: ['01_ro_membrane', '03_ion_resin'],
  },
  {
    brand: 'TORAY',
    aliases: ['TORAY', 'ROMEMBRA'],
    manufacturer: 'Toray Industries, Inc.',
    defaultOrigin: 'Nhật Bản / Hàn Quốc',
    typicalCategories: ['01_ro_membrane', '02_uf_membrane'],
  },
  {
    brand: 'HYDRANAUTICS',
    aliases: ['HYDRANAUTICS', 'NITTO HYDRANAUTICS'],
    manufacturer: 'Hydranautics - A Nitto Group Company',
    defaultOrigin: 'Mỹ (USA)',
    typicalCategories: ['01_ro_membrane'],
  },
  {
    brand: 'VONTRON',
    aliases: ['VONTRON'],
    manufacturer: 'Vontron Membrane Technology Co., Ltd.',
    defaultOrigin: 'Trung Quốc',
    typicalCategories: ['01_ro_membrane'],
  },
  {
    brand: 'HONSUN',
    aliases: ['HONSUN'],
    manufacturer: 'Honsun Water Treatment Equipment',
    defaultOrigin: 'Trung Quốc',
    typicalCategories: ['05_vessels_tanks', '07_membrane_housings'],
  },
  {
    brand: 'HUAMO',
    aliases: ['HUAMO'],
    manufacturer: 'Huamo Environmental Technology',
    defaultOrigin: 'Trung Quốc',
    typicalCategories: ['02_uf_membrane', '05_vessels_tanks'],
  },
  {
    brand: 'PENTAIR',
    aliases: ['PENTAIR', 'AUTOTROL', 'FLECK', 'STRUCTURAL'],
    manufacturer: 'Pentair Water Solutions',
    defaultOrigin: 'Mỹ / Quốc tế',
    typicalCategories: ['05_vessels_tanks', '06_control_valves'],
  },
  {
    brand: 'CANATURE',
    aliases: ['CANATURE'],
    manufacturer: 'Canature Health Technology Group Co., Ltd.',
    defaultOrigin: 'Trung Quốc',
    typicalCategories: ['05_vessels_tanks', '06_control_valves'],
  },
  {
    brand: 'CNP',
    aliases: ['CNP', 'NANFANG PUMP'],
    manufacturer: 'CNP Nanfang Pump Industry Co., Ltd.',
    defaultOrigin: 'Trung Quốc',
    typicalCategories: ['09_auxiliary_equipment'],
  },
  {
    brand: 'GRUNDFOS',
    aliases: ['GRUNDFOS'],
    manufacturer: 'Grundfos Holding A/S',
    defaultOrigin: 'Đan Mạch / Quốc tế',
    typicalCategories: ['09_auxiliary_equipment'],
  },
  {
    brand: 'SEKO',
    aliases: ['SEKO'],
    manufacturer: 'SEKO S.p.A.',
    defaultOrigin: 'Ý (Italy)',
    typicalCategories: ['09_auxiliary_equipment'],
  },
  {
    brand: 'CANPURE',
    aliases: ['CANPURE', 'KXA'],
    manufacturer: 'Canpure / KXA EDI Technology',
    defaultOrigin: 'Canada / Trung Quốc',
    typicalCategories: ['08_edi_equipment'],
  },
  {
    brand: 'IONPURE',
    aliases: ['IONPURE', 'EVOQUA'],
    manufacturer: 'Ionpure (Evoqua Water Technologies)',
    defaultOrigin: 'Mỹ (USA)',
    typicalCategories: ['08_edi_equipment'],
  },
  {
    brand: 'CLACK',
    aliases: ['CLACK', 'CLACK CORP'],
    manufacturer: 'Clack Corporation',
    defaultOrigin: 'Mỹ (USA)',
    typicalCategories: ['04_filter_media', '06_control_valves'],
  },
];

/**
 * DANH MỤC SẢN PHẨM THAM CHIẾU NỘI BỘ VUTECH (PRODUCT_CATALOG)
 * Dùng để đối chiếu nhanh khi OCR hoặc người dùng chọn từ danh mục.
 */
export const VUTECH_INTERNAL_CATALOG: VutechCatalogProduct[] = [
  {
    id: 'cat-extrepure-001x7-c100',
    sku: 'VT-RESIN-EXT-001X7',
    brand: 'EXTREPURE',
    manufacturer: 'EXTREPURE Water Treatment Co., Ltd.',
    model: '001×7 (C100)',
    rawModelAliases: ['001X7(C100)', '001X7 (C100)', '001×7(C100)', '001*7(C100)', '001X7', 'C100'],
    productName: 'Hạt Nhựa Cation EXTREPURE 001×7 (C100)',
    shortName: 'Hạt Nhựa Cation EXTREPURE 001×7',
    categoryId: '03_ion_resin',
    category: 'Hạt nhựa trao đổi ion',
    subCategory: 'Hạt nhựa Cation axit mạnh (SAC)',
    material: 'Gel Polystyrene liên kết ngang Divinylbenzene (DVB)',
    origin: 'Nhập khẩu chính ngạch',
    packaging: 'Bao 25 Lít (~20 kg)',
    applications: [
      'Làm mềm nước cứng dân dụng và công nghiệp',
      'Khử Ca²⁺, Mg²⁺ bảo vệ màng RO và lò hơi',
      'Tiền xử lý hệ thống lọc nước tinh khiết',
    ],
    specs: [
      { name: 'Loại hạt nhựa', value: 'Strong Acid Cation Exchange Resin (Dạng Na⁺)' },
      { name: 'Tổng dung lượng trao đổi', value: '≥ 1.90', unit: 'eq/L' },
      { name: 'Quy cách đóng gói', value: '25', unit: 'Lít/bao' },
      { name: 'Kích thước hạt (0.315 - 1.25 mm)', value: '≥ 95', unit: '%' },
      { name: 'Độ ẩm giữ nước', value: '45 – 50', unit: '%' },
      { name: 'Nhiệt độ vận hành tối đa', value: '120', unit: '°C' },
    ],
  },
  {
    id: 'cat-extrepure-001x8',
    sku: 'VT-RESIN-EXT-001X8',
    brand: 'EXTREPURE',
    manufacturer: 'EXTREPURE Water Treatment Co., Ltd.',
    model: '001×8',
    rawModelAliases: ['001X8', '001×8', '001*8'],
    productName: 'Hạt Nhựa Cation EXTREPURE 001×8',
    shortName: 'Hạt Nhựa Cation EXTREPURE 001×8',
    categoryId: '03_ion_resin',
    category: 'Hạt nhựa trao đổi ion',
    subCategory: 'Hạt nhựa Cation axit mạnh (SAC - Độ liên kết ngang 8% DVB)',
    material: 'Gel Polystyrene 8% DVB',
    origin: 'Nhập khẩu chính ngạch',
    packaging: 'Bao 25 Lít',
    applications: [
      'Làm mềm nước cứng tải trọng cao cho công nghiệp',
      'Xử lý nước cấp lò hơi và hệ thống RO công nghiệp',
    ],
    specs: [
      { name: 'Loại hạt nhựa', value: 'Strong Acid Cation Exchange Resin (8% DVB - Na⁺)' },
      { name: 'Tổng dung lượng trao đổi', value: '≥ 2.00', unit: 'eq/L' },
      { name: 'Quy cách đóng gói', value: '25', unit: 'Lít/bao' },
      { name: 'Độ ẩm giữ nước', value: '43 – 48', unit: '%' },
    ],
  },
  {
    id: 'cat-frotec-1812-75',
    sku: 'VT-RO-FRT-1812-75',
    brand: 'FROTEC',
    manufacturer: 'FROTEC Membrane Technology',
    model: '1812-75 GPD',
    rawModelAliases: ['1812-75', '1812-75GPD', 'ULP1812-75'],
    productName: 'Màng RO FROTEC 1812-75 GPD',
    shortName: 'Màng RO FROTEC 1812-75 GPD',
    categoryId: '01_ro_membrane',
    category: 'Màng lọc RO',
    subCategory: 'Màng RO dân dụng (1812 / 2012 / 2812 / 3012 / 3013)',
    material: 'Polyamide Thin-Film Composite (TFC)',
    origin: 'Nhập khẩu chính ngạch',
    packaging: 'Túi hút chân không tiêu chuẩn',
    applications: [
      'Máy lọc nước RO gia đình 10 - 15 L/giờ',
      'Hệ thống lọc nước uống trực tiếp văn phòng',
    ],
    specs: [
      { name: 'Công suất lọc', value: '75', unit: 'GPD (~12 L/giờ)' },
      { name: 'Tỷ lệ khử muối', value: '97.5', unit: '%' },
      { name: 'Áp suất vận hành', value: '60', unit: 'psi' },
      { name: 'Kích thước màng', value: '1.8 × 12', unit: 'inch' },
    ],
  },
  {
    id: 'cat-frotec-xlpft-8040',
    sku: 'VT-RO-FRT-XLPFT8040',
    brand: 'FROTEC',
    manufacturer: 'FROTEC Membrane Technology',
    model: 'XLPFT-8040',
    rawModelAliases: ['XLPFT-8040', 'XLPFT8040', 'XLP-8040'],
    productName: 'Màng RO Công Nghiệp FROTEC XLPFT-8040',
    shortName: 'Màng RO FROTEC XLPFT-8040',
    categoryId: '01_ro_membrane',
    category: 'Màng lọc RO',
    subCategory: 'Màng RO công nghiệp (4040 / 8040)',
    material: 'Polyamide Thin-Film Composite (TFC)',
    origin: 'Nhập khẩu chính ngạch',
    packaging: 'Thùng carton bảo vệ chuyên dụng',
    applications: [
      'Hệ thống lọc nước RO công nghiệp áp cực thấp',
      'Dây chuyền sản xuất nước tinh khiết đóng bình, thực phẩm, dược phẩm',
    ],
    specs: [
      { name: 'Kích thước màng', value: '8.0 × 40', unit: 'inch (8040)' },
      { name: 'Công suất lọc', value: '10500', unit: 'GPD (~40 m³/ngày)' },
      { name: 'Tỷ lệ khử muối ổn định', value: '99.0', unit: '%' },
      { name: 'Áp suất vận hành áp thấp', value: '100', unit: 'psi (0.69 MPa)' },
      { name: 'Diện tích màng hoạt động', value: '400', unit: 'ft² (37.2 m²)' },
    ],
  },
  {
    id: 'cat-uf-pan-40m2',
    sku: 'VT-UF-PAN-40M2',
    brand: 'RUNMO',
    manufacturer: 'Runmo Membrane Technology',
    model: 'UF-PAN 40 m²',
    rawModelAliases: ['UF PAN 40M2', 'UF-40M2', 'PAN-40M2', 'UF-8060'],
    productName: 'Màng Siêu Lọc UF Công Nghiệp Sợi Rỗng PAN 40 m²',
    shortName: 'Màng UF Công Nghiệp PAN 40 m²',
    categoryId: '02_uf_membrane',
    category: 'Màng lọc UF',
    subCategory: 'Màng UF PAN (Polyacrylonitrile)',
    material: 'Sợi rỗng Hydrophilic PAN, vỏ UPVC chịu áp',
    origin: 'Nhập khẩu chính ngạch',
    packaging: 'Thùng gỗ / Carton công nghiệp',
    applications: [
      'Tiền xử lý hệ thống RO công nghiệp',
      'Hệ thống lọc tổng công suất lớn, xử lý nước mặt và nước ngầm',
    ],
    specs: [
      { name: 'Vật liệu sợi màng', value: 'Hydrophilic PAN (Polyacrylonitrile)' },
      { name: 'Diện tích màng lọc', value: '40', unit: 'm²' },
      { name: 'Kích thước lỗ lọc', value: '0.01', unit: 'µm' },
      { name: 'Lưu lượng thiết kế', value: '2.5 – 4.0', unit: 'm³/giờ' },
    ],
  },
  {
    id: 'cat-runxin-f63b1',
    sku: 'VT-VALVE-RX-F63B1',
    brand: 'RUNXIN',
    manufacturer: 'Wenzhou Runxin Manufacturing Machine Co., Ltd.',
    model: 'F63B1',
    rawModelAliases: ['F63B1', 'RX-F63B1', 'RUNXIN F63B1', 'F63C3'],
    productName: 'Van Tự Động Làm Mềm Nước RUNXIN F63B1',
    shortName: 'Van Tự Động RUNXIN F63B1',
    categoryId: '06_control_valves',
    category: 'Van điều khiển',
    subCategory: 'Van tự động làm mềm nước hoàn nguyên muối (Auto Softener Valve)',
    material: 'Nhựa kỹ thuật ABS/PPO cao cấp, đĩa van gốm Ceramic chống mài mòn',
    origin: 'Trung Quốc (Chính hãng RUNXIN)',
    packaging: 'Hộp carton nguyên đai kèm Adapter & bộ phụ kiện',
    applications: [
      'Điều khiển tự động 5 chu trình sục rửa và hút muối hoàn nguyên hạt Cation',
      'Lắp cho cột lọc Composite từ 1054 đến 1865',
    ],
    specs: [
      { name: 'Lưu lượng làm việc', value: '4.0', unit: 'm³/giờ' },
      { name: 'Cổ kết nối cột lọc', value: '2.5" - 8NPSM (Ống trung tâm 26.7 mm)' },
      { name: 'Chức năng van', value: 'Tự động 5 chu trình làm mềm theo lưu lượng/thời gian' },
      { name: 'Nguồn điện Adapter', value: 'DC 12V – 1.5A' },
    ],
  },
  {
    id: 'cat-edi-kxa-200',
    sku: 'VT-EDI-KXA-200',
    brand: 'CANPURE',
    manufacturer: 'Canpure / KXA EDI Technology',
    model: 'KXA-200',
    rawModelAliases: ['KXA-200', 'KXA200', 'EDI-KXA-200'],
    productName: 'Module Khử Khoáng Điện Tử EDI KXA-200',
    shortName: 'Module EDI KXA-200',
    categoryId: '08_edi_equipment',
    category: 'Thiết bị EDI',
    subCategory: 'Module khử khoáng điện tử EDI (Electrodeionization)',
    material: 'Màng trao đổi ion chuyên dụng và điện cực Titan phủ Platinum',
    origin: 'Nhập khẩu chính ngạch',
    packaging: 'Thùng gỗ bảo vệ chống sốc',
    applications: [
      'Sản xuất nước siêu tinh khiết cho ngành dược phẩm, vi điện tử, xi mạ, lò hơi áp lực cao',
    ],
    specs: [
      { name: 'Lưu lượng nước siêu tinh khiết', value: '2.0', unit: 'm³/giờ' },
      { name: 'Điện trở suất nước đầu ra', value: '≥ 15 – 18', unit: 'MΩ·cm' },
      { name: 'Tỷ lệ thu hồi nước', value: '90 – 95', unit: '%' },
    ],
  },
  {
    id: 'cat-frp-1054',
    sku: 'VT-TANK-FRP-1054',
    brand: 'CANATURE',
    manufacturer: 'Canature Health Technology Group Co., Ltd.',
    model: 'FRP 1054',
    rawModelAliases: ['1054', 'FRP-1054', 'FRP 1054'],
    productName: 'Cột Lọc Composite FRP 1054',
    shortName: 'Cột Lọc Composite 1054',
    categoryId: '05_vessels_tanks',
    category: 'Cột lọc và bồn chứa',
    subCategory: 'Cột lọc Composite / FRP dân dụng & thương mại',
    material: 'Sợi thủy tinh FRP quấn liền khối, lõi lót nhựa PE thực phẩm',
    origin: 'Nhập khẩu chính ngạch',
    packaging: 'Thùng carton độc lập',
    applications: [
      'Hệ thống lọc tổng sinh hoạt gia đình và biệt thự',
      'Cột chứa than hoạt tính, cát thạch anh, hạt Cation làm mềm nước',
    ],
    specs: [
      { name: 'Mã kích thước cột', value: '1054 (Ø250 × Cao 1390 mm)' },
      { name: 'Cổ kết nối (Opening)', value: 'Ren 2.5" - 8NPSM' },
      { name: 'Áp suất làm việc tối đa', value: '150', unit: 'psi (10.5 bar)' },
      { name: 'Dung tích chứa', value: '61.9', unit: 'Lít' },
    ],
  },
  {
    id: 'cat-system-ro-500lh',
    sku: 'VT-SYS-RO-500LH',
    brand: 'VUTECH',
    manufacturer: 'CÔNG TY TNHH XNK VUTECH',
    model: 'VT-RO500',
    rawModelAliases: ['RO-500LH', 'VT-RO500', '500L/H', '500 L/H'],
    productName: 'Hệ Thống Lọc Nước RO Công Nghiệp VUTECH 500 L/h',
    shortName: 'Hệ Thống RO Công Nghiệp 500 L/h',
    categoryId: '10_complete_systems',
    category: 'Hệ thống xử lý nước hoàn chỉnh',
    subCategory: 'Hệ thống lọc nước RO công nghiệp',
    material: 'Khung Inox SUS304, cột Composite/Inox, màng RO 4040',
    origin: 'Việt Nam (Lắp ráp & Tích hợp bởi VUTECH)',
    packaging: 'Hệ khung Skid hoàn chỉnh',
    applications: [
      'Cung cấp nước tinh khiết cho nhà máy, xưởng sản xuất, trường học, bệnh viện',
    ],
    specs: [
      { name: 'Công suất thiết kế', value: '500', unit: 'Lít/giờ' },
      { name: 'Cấu hình màng RO', value: '02 Màng RO Công Nghiệp 4040' },
      { name: 'Tỷ lệ thu hồi nước tinh khiết', value: '65 – 75', unit: '%' },
      { name: 'Khung giá đỡ & Tủ điện', value: 'Khung Inox SUS304, Điều khiển tự động' },
    ],
  },
];

export function getCategoryDefById(id: WaterTreatmentCategoryId): WaterTreatmentCategoryDef {
  return (
    WATER_TREATMENT_CATEGORIES.find((cat) => cat.id === id) ||
    WATER_TREATMENT_CATEGORIES[0]
  );
}

/**
 * Kiểm tra một thông số có hợp lệ với nhóm sản phẩm hiện tại hay không.
 * Ngăn chặn triệt để tình trạng thông số van tự động (Nguồn điện DC 12V, 3 chế độ sục rửa)
 * xuất hiện trên bao hạt nhựa Cation hoặc màng RO.
 */
export function filterValidSpecsForCategory(
  categoryId: WaterTreatmentCategoryId,
  specs: TechnicalSpecItem[],
): TechnicalSpecItem[] {
  const categoryDef = WATER_TREATMENT_CATEGORIES.find((cat) => cat.id === categoryId);
  if (!categoryDef) return specs.filter((s) => s.name && s.value);

  return specs.filter((spec) => {
    if (!spec.name?.trim() || !spec.value?.trim()) return false;
    const combined = `${spec.name} ${spec.value} ${spec.unit || ''}`.toLowerCase();
    const isForbidden = categoryDef.forbiddenSpecKeywords.some((kw) =>
      combined.includes(kw.toLowerCase()),
    );
    return !isForbidden;
  });
}

export function formatSpecForCanvas(spec: TechnicalSpecItem): string {
  const name = spec.name.trim();
  const value = spec.value.trim();
  const unit = spec.unit?.trim();
  const valueWithUnit =
    unit && !value.toLowerCase().includes(unit.toLowerCase())
      ? `${value} ${unit}`
      : value;
  return `${name}: ${valueWithUnit}`;
}

export function buildCatalogRecognitionSpecs(
  catalogItem: VutechCatalogProduct,
  source: FieldDataSource = 'PRODUCT_CATALOG',
): TechnicalSpecItem[] {
  return catalogItem.specs.map((s) => ({
    name: s.name,
    value: s.value,
    unit: s.unit,
    source,
    confidence: 0.96,
    verified: true,
  }));
}
