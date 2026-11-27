export type DesignGroupId =
  | '01_shopee_cover'
  | '02_shopee_detail'
  | '03_web_clean'
  | '04_facebook_ads'
  | '05_industrial_tech'
  | '06_minimal_luxury'
  | '07_copyright_watermark';

export type OutputFileFormat = 'jpg' | 'png' | 'webp' | 'pdf';

export type ValidationStatus = 'pass' | 'warning' | 'fail' | 'pending';

export type VerificationStatus = 'verified' | 'partial' | 'unverified';

export type AssetStageStatus =
  | 'not-generated'
  | 'missing-data'
  | 'queued'
  | 'generating'
  | 'validating'
  | 'optimizing'
  | 'ready'
  | 'error';

export type FacebookRatioKey = '4:5' | '1:1' | '9:16' | '1.91:1';

export type WatermarkPlacementMode = 'corner' | 'center' | 'tiled';

export type WatermarkCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface SizeOption {
  id: string;
  label: string;
  aspectRatio: string;
  width: number;
  height: number;
  subFolder?: string;
  ratioKey?: FacebookRatioKey;
  note?: string;
}

export interface GroupSlideBlueprint {
  slotIndex: number; // 1-based
  key: string;
  title: string;
  shortTitle: string;
  description: string;
  requiresTechnicalDoc?: boolean;
  requiresVerifiedCert?: boolean;
  isMacroOrCloseUp?: boolean;
}

export interface PlatformStandardEntry {
  id: DesignGroupId;
  order: number;
  name: string;
  shortName: string;
  folderName: string;
  fileGroupSlug: string;
  platform: 'Shopee' | 'Website' | 'Facebook' | 'B2B Kỹ thuật' | 'Thương hiệu' | 'Đa nền tảng';
  placement: string;
  defaultCount: number;
  maxCount: number | null; // null = dynamic (e.g. Group 07)
  aspectRatios: string[];
  sizeOptions: SizeOption[];
  defaultSizeId: string;
  minDimensions: { width: number; height: number };
  maxDimensions: { width: number; height: number } | null;
  maxFileSizeKB: number | null; // null = no hard limit
  targetFileSizeRangeKB?: { min: number; max: number };
  allowedFormats: OutputFileFormat[];
  defaultFormat: OutputFileFormat;
  colorSpace: 'sRGB';
  safeZoneDescription: string;
  /** A. Mandatory platform rules */
  mandatoryPlatformRules: string[];
  /** B. VUTECH internal design guidelines */
  internalVutechRules: string[];
  watermarkRules: string;
  allowWatermark: boolean;
  allowExternalContact: boolean;
  restrictedContent: string[];
  officialSource: string;
  lastVerifiedDate: string;
  standardVersion: string;
  verificationStatus: VerificationStatus;
  verificationNote: string;
  slides: GroupSlideBlueprint[];
}

export interface ValidationCheckItem {
  code: string;
  label: string;
  status: ValidationStatus;
  detail: string;
  critical?: boolean;
}

export interface ValidationReport {
  status: ValidationStatus;
  summary: string;
  checks: ValidationCheckItem[];
  canExportAsPlatformCompliant: boolean;
  checkedAt: string;
}

export interface WatermarkSettings {
  mode: WatermarkPlacementMode;
  corner: WatermarkCorner;
  logoScalePct: number; // 8 to 40 (% of min edge)
  opacityPct: number; // 5 to 100
  keepOriginalFormat: boolean;
}

export interface GroupRuntimeSettings {
  sizeId: string;
  format: OutputFileFormat;
  quality: number; // 0.6 to 1.0
  enforceMaxSizeKB: number | null;
  enableWatermark: boolean;
  /** Group 04 multi-ratio selection (default ['4:5']) */
  facebookRatios: FacebookRatioKey[];
  /** Group 01 preview-only overlay toggle (NEVER baked into exports) */
  shopeePreviewOverlay: boolean;
  /** Group 07 custom watermark parameters */
  watermark: WatermarkSettings;
}

export interface GroupImageAsset {
  id: string;
  groupId: DesignGroupId;
  slotIndex: number;
  slideKey: string;
  title: string;
  shortTitle: string;
  description: string;
  status: AssetStageStatus;
  approved: boolean;
  skipped: boolean;
  /** Optional override source image for this specific slide (e.g. side angle, blueprint, or Group 07 batch file) */
  customSourceUrl?: string;
  customSourceName?: string;
  /** Optional user-supplied verified technical text / dimensions / cert notes */
  customTechnicalNotes?: string;
  /** Cached rendered preview (data URL) */
  previewDataUrl?: string;
  renderedWidth: number;
  renderedHeight: number;
  fileSizeBytes: number;
  format: OutputFileFormat;
  mimeType: string;
  seoFileName: string;
  altText: string;
  validation: ValidationReport;
  errorMessage?: string;
  requiresTechnicalDoc?: boolean;
  requiresVerifiedCert?: boolean;
  updatedAt?: string;
}

export type ExportMode = 'single' | 'group' | 'platform-bundle' | 'all-groups';

export type PlatformBundleId =
  | 'shopee-full'
  | 'website-ecom'
  | 'fb-feed'
  | 'fb-carousel'
  | 'fb-stories'
  | 'fb-all-ratios'
  | 'industrial-docs'
  | 'luxury-brand'
  | 'copyright-watermark';

export interface SmartExportSelection {
  mode: ExportMode;
  selectedGroupIds: DesignGroupId[];
  selectedAssetIds: string[]; // empty = all eligible in selected groups
  platformBundleId: PlatformBundleId;
  includeOnlyCompliant: boolean;
  exportIndustrialAsPdf: boolean;
  includeManifestAndCsv: boolean;
  overrideFormat?: OutputFileFormat | 'group-default';
  overrideQuality?: number;
  overrideMaxSizeKB?: number | null;
  facebookRatiosOverride?: FacebookRatioKey[];
}

export type QueueStage =
  | 'idle'
  | 'waiting'
  | 'generating'
  | 'validating'
  | 'optimizing'
  | 'packaging'
  | 'completed'
  | 'paused'
  | 'cancelled'
  | 'failed';

export interface QueueProgressState {
  stage: QueueStage;
  total: number;
  completed: number;
  failed: number;
  currentLabel: string;
  concurrency: number;
  errors: string[];
}

export interface ExportManifestEntry {
  sku: string;
  productName: string;
  groupId: DesignGroupId;
  groupName: string;
  folderPath: string;
  fileName: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  fileSizeKB: number;
  format: string;
  validationStatus: ValidationStatus;
  validationSummary: string;
  standardVersion: string;
  altText: string;
}
