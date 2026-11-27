import type {
  AspectRatioOption,
  ResolutionOption,
  TemplateId,
  PlatformKey,
  LogoMode,
  LogoPosition,
  BackdropPreset,
  ProductFitMode,
  ExportFormat,
  WorkspaceTab,
  AiModelOption,
} from './studio';

export type {
  AspectRatioOption,
  ResolutionOption,
  TemplateId,
  PlatformKey,
  LogoMode,
  LogoPosition,
  BackdropPreset,
  ProductFitMode,
  ExportFormat,
  WorkspaceTab,
  AiModelOption,
};

export type RecognitionModelOption = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

export type RecognitionStatus = 'SUCCESS' | 'PARTIAL' | 'MANUAL_REQUIRED' | 'ERROR';

export type FieldDataSource =
  | 'IMAGE_LABEL'
  | 'PRODUCT_CATALOG'
  | 'DATASHEET'
  | 'USER_CONFIRMED'
  | 'AI_INFERRED';

export type WaterTreatmentCategoryId =
  | '01_ro_membrane'
  | '02_uf_membrane'
  | '03_ion_resin'
  | '04_filter_media'
  | '05_vessels_tanks'
  | '06_control_valves'
  | '07_membrane_housings'
  | '08_edi_equipment'
  | '09_auxiliary_equipment'
  | '10_complete_systems'
  | 'unclassified';

export interface TechnicalSpecItem {
  name: string;
  value: string;
  unit?: string;
  source: FieldDataSource;
  confidence: number; // 0 to 1
  verified: boolean;
}

export interface MultiChannelProductNames {
  /** 1. Tên chuẩn kỹ thuật / Tên sản phẩm chính */
  standardName: string;
  /** 2. Tên ngắn hiển thị trên ảnh thiết kế */
  shortName: string;
  /** 3. Tên sản phẩm đăng Shopee */
  shopeeName: string;
  /** 4. Tên sản phẩm SEO Website VUTECH */
  websiteSeoName: string;
  /** 5. Tiêu đề quảng cáo Facebook */
  facebookAdTitle: string;
  /** 6. Tên hồ sơ kỹ thuật / báo giá */
  technicalFullName: string;
  /** 7. Tên file ảnh xuất chuẩn ASCII không dấu */
  asciiFileName: string;
}

export interface ApiDiagnosticError {
  httpStatus: number;
  errorCode: string;
  title: string;
  detailMessage: string;
  troubleshootingSteps: string[];
  retryAfterSeconds?: number;
  timestamp: string;
}

export interface ProductRecognitionRecord {
  recognitionStatus: RecognitionStatus;
  productName: string;
  shortName: string;
  brand: string;
  manufacturer: string;
  importer?: string;
  distributor: string;
  model: string;
  rawModel: string;
  sku: string;
  categoryId: WaterTreatmentCategoryId;
  category: string;
  subCategory: string;
  material: string;
  origin: string;
  packaging: string;
  applications: string[];
  technicalSpecifications: TechnicalSpecItem[];
  visibleText: string[];
  confidence: number; // 0 to 1
  fieldConfidence: {
    brand: number;
    model: number;
    category: number;
    productName: number;
    specifications: number;
  };
  fieldSources: {
    brand: FieldDataSource;
    model: FieldDataSource;
    category: FieldDataSource;
    productName: FieldDataSource;
    specifications: FieldDataSource;
  };
  warnings: string[];
  missingFields: string[];
  requiresManualReview: boolean;
  recognitionModel: string;
  recognizedAt: string;
  imageHash?: string;
  channelNames: MultiChannelProductNames;
  apiError?: ApiDiagnosticError | null;
  conflictingFields?: string[];
}
