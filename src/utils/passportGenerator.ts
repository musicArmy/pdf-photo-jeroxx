import { jsPDF } from 'jspdf';
import { PassportSettings } from '../types';

export const DEFAULT_PASSPORT_SETTINGS: PassportSettings = {
  zoom: 1.15,
  cropX: 0,
  cropY: -5,
  rotation: 0,
  brightness: 100,
  contrast: 100,
  photoWidthMm: 35,
  photoHeightMm: 45,
  spacingGapMm: 1.5, // Uniform 1.5mm gap: left edge = inter-photo gap = right edge
  layout: 'top-6-a4', // Default is strictly top 6 photos in 1 line on A4
  hasBorder: true,
  borderColor: '#000000',
  hasCuttingMarks: true,
  hasNameDate: false,
  personName: '',
  photoDate: new Date().toLocaleDateString('en-GB'),
  backgroundColor: 'original',
};

// Convert mm to pixels at given DPI
export function mmToPixels(mm: number, dpi: number = 300): number {
  return Math.round((mm * dpi) / 25.4);
}

/**
 * Render a single cropped, adjusted, and framed passport photo onto an HTML Canvas
 */
export async function renderSinglePassportCanvas(
  sourceImage: HTMLImageElement | string,
  settings: PassportSettings,
  targetDpi: number = 300
): Promise<HTMLCanvasElement> {
  const img = await resolveImage(sourceImage);

  const photoWidthPx = mmToPixels(settings.photoWidthMm, targetDpi);
  const photoHeightPx = mmToPixels(settings.photoHeightMm, targetDpi);

  const canvas = document.createElement('canvas');
  canvas.width = photoWidthPx;
  canvas.height = photoHeightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Fill background
  if (settings.backgroundColor !== 'original') {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, photoWidthPx, photoHeightPx);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, photoWidthPx, photoHeightPx);
  }

  // Draw adjusted photo with zoom, crop offsets, rotation, filters
  ctx.save();

  // Apply filters
  ctx.filter = `brightness(${settings.brightness}%) contrast(${settings.contrast}%)`;

  // Translate to center of canvas for rotation & zoom
  ctx.translate(photoWidthPx / 2, photoHeightPx / 2);

  if (settings.rotation !== 0) {
    ctx.rotate((settings.rotation * Math.PI) / 180);
  }

  // Calculate base scale to cover passport frame
  const imgRatio = img.width / img.height;
  const frameRatio = photoWidthPx / photoHeightPx;
  let drawW: number;
  let drawH: number;

  if (imgRatio > frameRatio) {
    // image is wider than frame -> match height
    drawH = photoHeightPx * settings.zoom;
    drawW = drawH * imgRatio;
  } else {
    // image is taller than frame -> match width
    drawW = photoWidthPx * settings.zoom;
    drawH = drawW / imgRatio;
  }

  // Crop offsets in percent
  const offsetX = (settings.cropX / 100) * photoWidthPx;
  const offsetY = (settings.cropY / 100) * photoHeightPx;

  ctx.drawImage(img, -drawW / 2 + offsetX, -drawH / 2 + offsetY, drawW, drawH);
  ctx.restore();

  // Draw Name & Date badge if enabled
  if (settings.hasNameDate && (settings.personName || settings.photoDate)) {
    const badgeHeight = Math.round(photoHeightPx * 0.16);
    const badgeY = photoHeightPx - badgeHeight;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, badgeY, photoWidthPx, badgeHeight);

    ctx.strokeStyle = '#000000';
    ctx.lineWidth = Math.max(1, targetDpi / 150);
    ctx.beginPath();
    ctx.moveTo(0, badgeY);
    ctx.lineTo(photoWidthPx, badgeY);
    ctx.stroke();

    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fontSize = Math.round(badgeHeight * 0.36);
    ctx.font = `bold ${fontSize}px sans-serif`;

    if (settings.personName && settings.photoDate) {
      ctx.fillText(settings.personName.toUpperCase(), photoWidthPx / 2, badgeY + badgeHeight * 0.32);
      ctx.font = `600 ${Math.round(fontSize * 0.85)}px sans-serif`;
      ctx.fillText(`DOB/DOP: ${settings.photoDate}`, photoWidthPx / 2, badgeY + badgeHeight * 0.72);
    } else if (settings.personName) {
      ctx.fillText(settings.personName.toUpperCase(), photoWidthPx / 2, badgeY + badgeHeight * 0.5);
    } else {
      ctx.fillText(`DATE: ${settings.photoDate}`, photoWidthPx / 2, badgeY + badgeHeight * 0.5);
    }
  }

  // Draw Studio Border if enabled
  if (settings.hasBorder) {
    ctx.strokeStyle = settings.borderColor || '#000000';
    const borderWidth = Math.max(1, Math.round(mmToPixels(0.35, targetDpi)));
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, photoWidthPx - borderWidth, photoHeightPx - borderWidth);
  }

  return canvas;
}

/**
 * Render the full A4 Printable Sheet (Default: Top 6 photos in 1 horizontal line)
 * - Uniform equal spacing: left margin == gap between photos == right margin
 * - Standard passport aspect ratio (3.5 x 4.5 cm)
 * - Clean top alignment so minimal paper is used
 * - Precise dashed scissor cutting guides
 * - No unwanted header or footer text taking up paper space
 */
export async function renderA4PrintableSheetCanvas(
  sourceImage: HTMLImageElement | string,
  settings: PassportSettings,
  targetDpi: number = 300
): Promise<HTMLCanvasElement> {
  const singlePhotoCanvas = await renderSinglePassportCanvas(sourceImage, settings, targetDpi);

  // A4 dimensions: 210mm x 297mm
  const a4WidthMm = 210;
  const a4HeightMm = 297;
  const a4WidthPx = mmToPixels(a4WidthMm, targetDpi);
  const a4HeightPx = mmToPixels(a4HeightMm, targetDpi);

  const canvas = document.createElement('canvas');
  canvas.width = a4WidthPx;
  canvas.height = a4HeightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Fill crisp white A4 background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, a4WidthPx, a4HeightPx);

  // Layout calculations
  let cols = 6;
  let rows = 1;
  
  // Uniform gap: exactly equal before first photo, between each photo, and after last photo
  let uniformGapMm = typeof settings.spacingGapMm === 'number' ? settings.spacingGapMm : 1.5;
  if (uniformGapMm < 0.5) uniformGapMm = 0.5;
  if (uniformGapMm > 4.0) uniformGapMm = 4.0;

  // Top margin is set strictly equal to uniformGapMm so top space == left == right == inter-photo gap!
  let topMarginMm = uniformGapMm;

  if (settings.layout === 'top-6-a4') {
    cols = 6;
    rows = 1;
    topMarginMm = uniformGapMm;
  } else if (settings.layout === 'top-12-a4') {
    cols = 6;
    rows = 2;
    topMarginMm = uniformGapMm;
  } else if (settings.layout === 'full-a4') {
    cols = 6;
    rows = 6;
    topMarginMm = uniformGapMm;
  } else if (settings.layout === 'photo-4x6') {
    // 4x6 inch photo paper (101.6 x 152.4 mm)
    cols = 4;
    rows = 2;
    topMarginMm = uniformGapMm;
  } else if (settings.layout === 'single') {
    cols = 1;
    rows = 1;
    topMarginMm = uniformGapMm * 3;
  }

  // Standard Indian passport size ratio: 35mm width x 45mm height (35:45 = 7:9)
  // Calculate photo dimensions with equal gap before first photo, between each, and after last photo:
  // Total width: 210mm = (cols * fittedPhotoWidthMm) + ((cols + 1) * uniformGapMm)
  const totalGapsCount = cols + 1;
  const totalGapsMm = totalGapsCount * uniformGapMm;
  const fittedPhotoWidthMm = (a4WidthMm - totalGapsMm) / cols;
  
  // Strict standard Indian passport proportion (35mm x 45mm)
  const photoAspectRatio = (settings.photoWidthMm || 35) / (settings.photoHeightMm || 45);
  const fittedPhotoHeightMm = fittedPhotoWidthMm / photoAspectRatio;

  const photoWidthPx = mmToPixels(fittedPhotoWidthMm, targetDpi);
  const photoHeightPx = mmToPixels(fittedPhotoHeightMm, targetDpi);
  const gapXPx = mmToPixels(uniformGapMm, targetDpi);
  const gapYPx = mmToPixels(uniformGapMm, targetDpi);
  const topMarginPx = mmToPixels(topMarginMm, targetDpi);

  // Draw cutting line guides (dashed lines) for easy scissor trimming
  if (settings.hasCuttingMarks) {
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = Math.max(1, Math.round(targetDpi / 300));
    ctx.setLineDash([mmToPixels(1.5, targetDpi), mmToPixels(1.5, targetDpi)]);

    // Top horizontal cutting guide placed right at top margin
    const topCutY = Math.max(0, topMarginPx - Math.round(gapYPx / 2));
    const totalGridHeightPx = (rows * photoHeightPx) + ((rows - 1) * gapYPx);
    const bottomCutY = topMarginPx + totalGridHeightPx + Math.round(gapYPx / 2);

    const firstPhotoXPx = gapXPx;
    const lastPhotoEndXPx = gapXPx + cols * photoWidthPx + (cols - 1) * gapXPx;

    const cutLineStartXPx = Math.max(0, Math.round(gapXPx / 2));
    const cutLineEndXPx = Math.min(a4WidthPx, lastPhotoEndXPx + Math.round(gapXPx / 2));

    // Top horizontal cutting guide
    ctx.beginPath();
    ctx.moveTo(cutLineStartXPx, topCutY);
    ctx.lineTo(cutLineEndXPx, topCutY);
    ctx.stroke();

    // Bottom horizontal cutting guide
    ctx.beginPath();
    ctx.moveTo(cutLineStartXPx, bottomCutY);
    ctx.lineTo(cutLineEndXPx, bottomCutY);
    ctx.stroke();

    // Outer left vertical guide
    ctx.beginPath();
    ctx.moveTo(cutLineStartXPx, topCutY);
    ctx.lineTo(cutLineStartXPx, bottomCutY);
    ctx.stroke();

    // Outer right vertical guide
    ctx.beginPath();
    ctx.moveTo(cutLineEndXPx, topCutY);
    ctx.lineTo(cutLineEndXPx, bottomCutY);
    ctx.stroke();

    // Internal vertical cut lines between photos (precisely in the middle of each gap)
    for (let c = 1; c < cols; c++) {
      const lineX = Math.round(gapXPx + c * photoWidthPx + (c - 0.5) * gapXPx);
      ctx.beginPath();
      ctx.moveTo(lineX, topCutY);
      ctx.lineTo(lineX, bottomCutY);
      ctx.stroke();
    }

    // Horizontal cut lines between rows if rows > 1
    for (let r = 1; r < rows; r++) {
      const lineY = Math.round(topMarginPx + r * photoHeightPx + (r - 0.5) * gapYPx);
      ctx.beginPath();
      ctx.moveTo(cutLineStartXPx, lineY);
      ctx.lineTo(cutLineEndXPx, lineY);
      ctx.stroke();
    }

    ctx.restore();
  }

  // Draw the grid of photos:
  // Each photo c starts at: gapXPx + c * (photoWidthPx + gapXPx)
  for (let r = 0; r < rows; r++) {
    const y = Math.round(topMarginPx + r * (photoHeightPx + gapYPx));
    for (let c = 0; c < cols; c++) {
      const x = Math.round(gapXPx + c * (photoWidthPx + gapXPx));
      ctx.drawImage(singlePhotoCanvas, x, y, photoWidthPx, photoHeightPx);
    }
  }

  return canvas;
}

/**
 * Generate PDF for Passport Sheet ready for printing at 100% Scale
 */
export async function generatePassportPdf(
  sourceImage: HTMLImageElement | string,
  settings: PassportSettings
): Promise<Uint8Array> {
  const sheetCanvas = await renderA4PrintableSheetCanvas(sourceImage, settings, 300);
  const dataUrl = sheetCanvas.toDataURL('image/jpeg', 0.98);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  // A4 size in mm is exactly 210 x 297
  pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  const buffer = pdf.output('arraybuffer');
  return new Uint8Array(buffer);
}

/**
 * Download High-Res A4 PNG / JPEG Image
 */
export async function downloadA4SheetImage(
  sourceImage: HTMLImageElement | string,
  settings: PassportSettings,
  fileName: string = '6_passport_photos_a4'
) {
  const sheetCanvas = await renderA4PrintableSheetCanvas(sourceImage, settings, 300);
  const link = document.createElement('a');
  link.download = `${fileName}.png`;
  link.href = sheetCanvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Download Single 3.5x4.5cm Passport Photo
 */
export async function downloadSinglePhotoFile(
  sourceImage: HTMLImageElement | string,
  settings: PassportSettings,
  fileName: string = 'passport_photo_35x45mm'
) {
  const singleCanvas = await renderSinglePassportCanvas(sourceImage, settings, 300);
  const link = document.createElement('a');
  link.download = `${fileName}.jpg`;
  link.href = singleCanvas.toDataURL('image/jpeg', 0.98);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function resolveImage(source: HTMLImageElement | string): Promise<HTMLImageElement> {
  if (typeof source !== 'string') {
    return Promise.resolve(source);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = source;
  });
}
