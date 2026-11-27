export type AspectRatioOption =
  | '1:1'
  | '2:3'
  | '3:2'
  | '3:4'
  | '4:3'
  | '9:16'
  | '16:9'
  | '21:9';

export type ResolutionOption = '1K' | '2K' | '4K';

export type TemplateId =
  | 'web-clean'
  | 'facebook-promo'
  | 'industrial-tech'
  | 'minimal-luxury'
  | 'shopee-cover'
  | 'shopee-detail'
  | 'watermark-protect';

export type PlatformKey = 'shopee' | 'facebook' | 'website';

export type LogoMode = 'full' | 'icon' | 'full-and-watermark' | 'icon-and-watermark';

export type LogoPosition = 'top-left' | 'top-right' | 'top-center';

export type BackdropPreset = 'pure-white' | 'vutech-ice' | 'studio-gray' | 'deep-navy';

export type ProductFitMode = 'contain' | 'cover';

export type ExportFormat = 'png' | 'jpeg';

export type WorkspaceTab = 'studio' | 'ai' | 'channels' | 'library';

export type AiModelOption = 'gemini-nano-banana-2.1' | 'gemini-3-pro-image';

export interface SubjectBox {
  /** Normalized 0..1 coordinates of the main product inside the source image */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StudioConfig {
  sourceImageUrl: string;
  sourceImageName: string;
  template: TemplateId;
  aspectRatio: AspectRatioOption;
  resolution: ResolutionOption;
  productName: string;
  modelCode: string;
  category: string;
  tagline: string;
  specs: [string, string, string];
  priceBadge: string;
  showPriceBadge: boolean;
  companyName: string;
  hotline: string;
  website: string;
  facebookPage: string;
  logoMode: LogoMode;
  logoPosition: LogoPosition;
  logoScale: number; // 0.6 to 1.5
  removeLogoBg: boolean;
  watermarkOpacity: number; // 0.04 to 0.25
  backdrop: BackdropPreset;
  fitMode: ProductFitMode;
  productScale: number; // 0.65 to 1.35
  productOffsetX: number; // -20 to 20 (%)
  productOffsetY: number; // -20 to 20 (%)
  backgroundBlurEnabled: boolean;
  backgroundBlurAmount: number; // 0 to 40 px
  extendBackground: boolean;
  autoFrameSubject: boolean;
  recommendedAspectRatio?: AspectRatioOption;
  focusRadiusScale: number; // 0.6 to 1.35
  focusFeather: number; // 10 to 60 (%)
  subjectBox: SubjectBox;
  brightness: number; // 80 to 130
  contrast: number; // 80 to 135
  saturation: number; // 70 to 135
  sharpness: number; // 0 to 100
  showSpecsPanel: boolean;
  showContactFooter: boolean;
  facebookCaption: string;
}

export interface SampleProduct {
  id: string;
  label: string;
  imageUrl: string;
  productName: string;
  modelCode: string;
  category: string;
  tagline: string;
  specs: [string, string, string];
  priceBadge: string;
  recommendedTemplate: TemplateId;
  facebookCaption: string;
}

export interface ChannelPreset {
  id: string;
  label: string;
  channel: string;
  platform: PlatformKey;
  aspectRatio: AspectRatioOption;
  recommendedResolution: ResolutionOption;
  recommendedTemplate: TemplateId;
  usageNote: string;
  complianceHighlights: string[];
  recommendedOverrides?: Partial<StudioConfig>;
}

export interface PlatformStandard {
  platform: PlatformKey;
  name: string;
  sourceRef: string;
  ratios: string;
  resolutionAndSize: string;
  productOccupancy: string;
  safeZoneRule: string;
  contentPolicy: string;
  recommendedTemplates: TemplateId[];
}

export interface SavedDesign {
  id: string;
  savedAt: string;
  thumbnailDataUrl: string;
  config: StudioConfig;
}

export interface AiGeneratedItem {
  id: string;
  createdAt: string;
  imageDataUrl: string;
  prompt: string;
  model: AiModelOption;
  aspectRatio: AspectRatioOption;
  imageSize: ResolutionOption;
  mode: 'generate' | 'edit';
}

export type BatchAnalysisStatus = 'idle' | 'analyzing' | 'done' | 'error';

export interface BatchProductItem {
  id: string;
  isSample?: boolean;
  config: StudioConfig;
  status: BatchAnalysisStatus;
  statusMessage: string | null;
}

