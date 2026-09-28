export type AppTab = 'photo-to-pdf' | 'pdf-to-photo' | 'passport-photo' | 'id-card-print' | 'history' | 'admin';

export type Language = 'hi' | 'en';

export interface HistoryItem {
  id: string;
  timestamp: number;
  title: string;
  toolType: 'id-card-print' | 'passport-photo' | 'photo-to-pdf' | 'pdf-to-photo';
  thumbnailUrl: string;
  fullImageDataUrl?: string;
  pdfDataUrl?: string; // base64 / blob dataUrl for 1-click download
  fileSizeText: string;
  details: string;
  itemCount?: number;
}

export interface SharedCloudWork {
  id: string;
  title: string;
  toolType: 'id-card-print' | 'passport-photo' | 'photo-to-pdf' | 'pdf-to-photo';
  thumbnailUrl: string;
  fullImageDataUrl?: string;
  pdfDataUrl?: string;
  directViewUrl?: string;
  fileSizeText: string;
  details: string;
  itemCount?: number;
  createdAt: string;
  userConsent: boolean;
  clientTag?: string;
}

export interface UploadedImage {
  id: string;
  file?: File;
  name: string;
  dataUrl: string;
  originalDataUrl?: string;
  width: number;
  height: number;
  rotation: number; // 0, 90, 180, 270
  size: number;
  isCropped?: boolean;
}

export interface PdfPageImage {
  pageNumber: number;
  dataUrl: string;
  originalDataUrl?: string;
  blob: Blob;
  width: number;
  height: number;
  isCropped?: boolean;
}

export type PassportLayoutMode = 
  | 'top-6-a4'     // Default: 6 photos in 1 single horizontal row at the top of A4
  | 'top-12-a4'    // 12 photos in 2 rows of 6 at top of A4
  | 'full-a4'      // 30 photos (5 rows of 6)
  | 'photo-4x6'    // 8 photos (4x6 photo paper)
  | 'single';      // 1 single passport photo

export interface PassportSettings {
  zoom: number; // 1.0 to 3.0
  cropX: number; // offset percent -50 to 50
  cropY: number; // offset percent -50 to 50
  rotation: number; // degrees
  brightness: number; // 80 to 140
  contrast: number; // 80 to 140
  photoWidthMm: number; // standard 35mm
  photoHeightMm: number; // standard 45mm
  spacingGapMm: number; // uniform gap: left margin = photo gaps = right margin (e.g., 1.5mm)
  layout: PassportLayoutMode;
  hasBorder: boolean; // thin studio border
  borderColor: string;
  hasCuttingMarks: boolean; // dashed scissor guide lines
  hasNameDate: boolean; // Indian standard name & date badge
  personName: string;
  photoDate: string;
  backgroundColor: 'original' | '#ffffff' | '#dbeafe' | '#e2e8f0' | '#fef08a';
}

export type IdCardLayoutMode =
  | 'standard-vertical' // 1 Copy on A4: Front above center, Back below center
  | 'dual-copy'         // 2 Copies on 1 A4 (Upper half + Lower half) - Cyber Cafe dual copy
  | 'side-by-side'      // Front and Back horizontally side-by-side (Lamination fold mode)
  | 'free-custom'       // Custom Free Position on A4
  | 'front-only'        // Front side only
  | 'back-only';        // Back side only

export type CardColorMode = 'original' | 'grayscale' | 'bw_high_contrast';

export interface IdCardSideSettings {
  dataUrl: string | null;
  name: string;
  zoom: number; // 0.8 to 2.5
  cropX: number; // percent -50 to 50
  cropY: number; // percent -50 to 50
  rotation: number; // 0, 90, 180, 270
  brightness: number; // 50 to 180 (default 100)
  contrast: number; // 50 to 180 (default 100)
  colorMode: CardColorMode;
  positionXmm?: number; // Custom X offset on A4 in mm (-100 to 100)
  positionYmm?: number; // Custom Y offset on A4 in mm (-150 to 150)
}

export interface IdCardPrintSettings {
  front: IdCardSideSettings;
  back: IdCardSideSettings;
  dualCopyMode?: 'same-card' | 'different-person'; // 'same-card' = duplicate person 1; 'different-person' = customer 1 (top) + customer 2 (bottom)
  front2?: IdCardSideSettings; // Customer 2 Front side for dual-copy lower half
  back2?: IdCardSideSettings;  // Customer 2 Back side for dual-copy lower half
  layout: IdCardLayoutMode;
  cardWidthMm: number; // Standard 85.6mm
  cardHeightMm: number; // Standard 54.0mm
  scalePercent: number; // 80 to 140 (default 100%)
  verticalGapMm: number; // gap between front and back (default 16mm)
  hasBorder: boolean;
  borderColor: string;
  borderStyle: 'solid' | 'dashed';
  hasCuttingMarks: boolean;
  showMiddleDividingLine?: boolean; // Default false (middle line removed as requested)
  showCardLabels: boolean; // false to remove "FRONT / BACK" label text while keeping cutting line
  watermarkType: 'none' | 'self_attested' | 'photocopy_only' | 'custom';
  customWatermarkText: string;
  cardLabel: string; // e.g. "Aadhaar Card Copy" or empty
}

export interface ImageToPdfSettings {
  pageSize: 'a4' | 'letter' | 'fit';
  orientation: 'portrait' | 'landscape' | 'auto';
  marginMm: number; // 0, 5, 10, 15
  imageQuality: number; // 0.6 to 0.95
  title: string;
}
