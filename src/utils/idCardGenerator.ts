import { jsPDF } from 'jspdf';
import { IdCardPrintSettings, IdCardSideSettings } from '../types';

export const DEFAULT_ID_CARD_SETTINGS: IdCardPrintSettings = {
  front: {
    dataUrl: null,
    name: 'front_card',
    zoom: 1.0,
    cropX: 0,
    cropY: 0,
    rotation: 0,
    brightness: 100,
    contrast: 100,
    colorMode: 'original',
    positionXmm: 0,
    positionYmm: 0,
  },
  back: {
    dataUrl: null,
    name: 'back_card',
    zoom: 1.0,
    cropX: 0,
    cropY: 0,
    rotation: 0,
    brightness: 100,
    contrast: 100,
    colorMode: 'original',
    positionXmm: 0,
    positionYmm: 0,
  },
  dualCopyMode: 'same-card', // 'same-card' = duplicate; 'different-person' = customer 1 (upper) + customer 2 (lower)
  front2: {
    dataUrl: null,
    name: 'front2_card',
    zoom: 1.0,
    cropX: 0,
    cropY: 0,
    rotation: 0,
    brightness: 100,
    contrast: 100,
    colorMode: 'original',
    positionXmm: 0,
    positionYmm: 0,
  },
  back2: {
    dataUrl: null,
    name: 'back2_card',
    zoom: 1.0,
    cropX: 0,
    cropY: 0,
    rotation: 0,
    brightness: 100,
    contrast: 100,
    colorMode: 'original',
    positionXmm: 0,
    positionYmm: 0,
  },
  layout: 'standard-vertical', // 1 Copy: Front above center, Back below center
  cardWidthMm: 85.6, // Standard ID Card Width in mm
  cardHeightMm: 54.0, // Standard ID Card Height in mm
  scalePercent: 100, // 100% scale
  verticalGapMm: 16, // Gap between front and back
  hasBorder: true,
  borderColor: '#000000',
  borderStyle: 'solid',
  hasCuttingMarks: true,
  showMiddleDividingLine: false, // Default false: Clean sheet without middle line as requested
  showCardLabels: false, // Default to FALSE so only clean cutting line shows, no unwanted text
  watermarkType: 'none',
  customWatermarkText: '',
  cardLabel: '',
};

export function mmToPixels(mm: number, dpi: number = 300): number {
  return Math.round((mm * dpi) / 25.4);
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

/**
 * Render a single card side (Front or Back) onto an HTML Canvas with zoom, pan, crop, rotation & filters
 */
export async function renderSingleCardCanvas(
  side: IdCardSideSettings,
  targetWidthMm: number = 85.6,
  targetHeightMm: number = 54.0,
  targetDpi: number = 300,
  watermarkText?: string
): Promise<HTMLCanvasElement> {
  const widthPx = mmToPixels(targetWidthMm, targetDpi);
  const heightPx = mmToPixels(targetHeightMm, targetDpi);

  const canvas = document.createElement('canvas');
  canvas.width = widthPx;
  canvas.height = heightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Fill crisp white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, widthPx, heightPx);

  if (!side.dataUrl) {
    // Return empty white box with placeholder text if no image
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, widthPx - 8, heightPx - 8);
    ctx.fillStyle = '#94a3b8';
    ctx.font = `bold ${Math.round(heightPx * 0.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NO CARD IMAGE', widthPx / 2, heightPx / 2);
    return canvas;
  }

  const img = await resolveImage(side.dataUrl);

  ctx.save();

  // Apply filters
  let filterStr = `brightness(${side.brightness}%) contrast(${side.contrast}%)`;
  if (side.colorMode === 'grayscale') {
    filterStr += ' grayscale(100%)';
  } else if (side.colorMode === 'bw_high_contrast') {
    // High contrast black and white photocopy xerox look
    filterStr += ` grayscale(100%) contrast(${Math.max(140, side.contrast * 1.4)}%) brightness(${side.brightness * 1.05}%)`;
  }
  ctx.filter = filterStr;

  // Center translation for rotation and zoom
  ctx.translate(widthPx / 2, heightPx / 2);

  if (side.rotation !== 0) {
    ctx.rotate((side.rotation * Math.PI) / 180);
  }

  // Calculate draw dimensions
  const isRotated90or270 = side.rotation % 180 !== 0;
  const targetW = isRotated90or270 ? heightPx : widthPx;
  const targetH = isRotated90or270 ? widthPx : heightPx;

  const imgRatio = img.width / img.height;
  const frameRatio = targetW / targetH;
  let drawW: number;
  let drawH: number;

  if (imgRatio > frameRatio) {
    drawH = targetH * side.zoom;
    drawW = drawH * imgRatio;
  } else {
    drawW = targetW * side.zoom;
    drawH = drawW / imgRatio;
  }

  const offsetX = (side.cropX / 100) * targetW;
  const offsetY = (side.cropY / 100) * targetH;

  ctx.drawImage(img, -drawW / 2 + offsetX, -drawH / 2 + offsetY, drawW, drawH);
  ctx.restore();

  // Draw Watermark if present
  if (watermarkText) {
    ctx.save();
    ctx.translate(widthPx / 2, heightPx / 2);
    ctx.rotate(-Math.PI / 6); // 30 deg angle
    ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = `bold ${Math.round(heightPx * 0.16)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = Math.max(1, targetDpi / 150);
    ctx.strokeText(watermarkText.toUpperCase(), 0, 0);
    ctx.fillText(watermarkText.toUpperCase(), 0, 0);
    ctx.restore();
  }

  return canvas;
}

/**
 * Render the complete A4 Xerox / Print Sheet
 * Supports:
 * - standard-vertical: 1 Copy in middle (Front slightly above center, Back slightly below center)
 * - dual-copy: 2 Copies on single A4 sheet (Upper half + Lower half)
 * - side-by-side: Front & Back next to each other
 */
export async function renderIdCardA4SheetCanvas(
  settings: IdCardPrintSettings,
  targetDpi: number = 300
): Promise<HTMLCanvasElement> {
  const a4WidthMm = 210;
  const a4HeightMm = 297;
  const a4WidthPx = mmToPixels(a4WidthMm, targetDpi);
  const a4HeightPx = mmToPixels(a4HeightMm, targetDpi);

  const canvas = document.createElement('canvas');
  canvas.width = a4WidthPx;
  canvas.height = a4HeightPx;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // Fill pure white A4 background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, a4WidthPx, a4HeightPx);

  // Scaled card size
  const scale = (settings.scalePercent || 100) / 100;
  const cardWidthMm = (settings.cardWidthMm || 85.6) * scale;
  const cardHeightMm = (settings.cardHeightMm || 54.0) * scale;

  // Determine watermark text
  let wmText = '';
  if (settings.watermarkType === 'self_attested') {
    wmText = 'SELF ATTESTED';
  } else if (settings.watermarkType === 'photocopy_only') {
    wmText = 'ONLY FOR VERIFICATION / PHOTOCOPY';
  } else if (settings.watermarkType === 'custom' && settings.customWatermarkText) {
    wmText = settings.customWatermarkText;
  }

  // Pre-render Front and Back single cards for Person 1 (Customer 1)
  const frontCanvas = await renderSingleCardCanvas(
    settings.front,
    cardWidthMm,
    cardHeightMm,
    targetDpi,
    wmText
  );

  const backCanvas = await renderSingleCardCanvas(
    settings.back,
    cardWidthMm,
    cardHeightMm,
    targetDpi,
    wmText
  );

  // Pre-render Person 2 (Customer 2) cards if available in dual-copy mode
  let front2Canvas = frontCanvas;
  let back2Canvas = backCanvas;

  const isDualPerson =
    settings.layout === 'dual-copy' &&
    settings.dualCopyMode === 'different-person' &&
    (Boolean(settings.front2?.dataUrl) || Boolean(settings.back2?.dataUrl));

  if (isDualPerson && settings.front2) {
    front2Canvas = settings.front2.dataUrl
      ? await renderSingleCardCanvas(settings.front2, cardWidthMm, cardHeightMm, targetDpi, wmText)
      : frontCanvas;
  }

  if (isDualPerson && settings.back2) {
    back2Canvas = settings.back2.dataUrl
      ? await renderSingleCardCanvas(settings.back2, cardWidthMm, cardHeightMm, targetDpi, wmText)
      : backCanvas;
  }

  const cardWidthPx = mmToPixels(cardWidthMm, targetDpi);
  const cardHeightPx = mmToPixels(cardHeightMm, targetDpi);
  const borderWidth = Math.max(1, Math.round(mmToPixels(0.35, targetDpi)));

  // Helper to draw single card with border & optional label
  const drawCardOnA4 = (
    cCanvas: HTMLCanvasElement,
    xPx: number,
    yPx: number,
    label?: string
  ) => {
    // Draw card image
    ctx.drawImage(cCanvas, xPx, yPx, cardWidthPx, cardHeightPx);

    // Draw studio black border
    if (settings.hasBorder) {
      ctx.save();
      ctx.strokeStyle = settings.borderColor || '#000000';
      ctx.lineWidth = borderWidth;
      if (settings.borderStyle === 'dashed') {
        ctx.setLineDash([mmToPixels(2, targetDpi), mmToPixels(1.5, targetDpi)]);
      }
      ctx.strokeRect(
        xPx + borderWidth / 2,
        yPx + borderWidth / 2,
        cardWidthPx - borderWidth,
        cardHeightPx - borderWidth
      );
      ctx.restore();
    }

    // Optional mini label above card (ONLY if showCardLabels is true)
    if (label && settings.showCardLabels) {
      ctx.save();
      ctx.fillStyle = '#64748b';
      ctx.font = `600 ${Math.round(mmToPixels(2.4, targetDpi))}px sans-serif`;
      ctx.textAlign = 'left';
      ctx.fillText(label, xPx, yPx - mmToPixels(1.5, targetDpi));
      ctx.restore();
    }

    // Draw scissor cutting guide marks around card (always clean line without text if showCardLabels is off)
    if (settings.hasCuttingMarks) {
      ctx.save();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = Math.max(1, Math.round(targetDpi / 300));
      ctx.setLineDash([mmToPixels(1.5, targetDpi), mmToPixels(2, targetDpi)]);
      const offsetPx = mmToPixels(3, targetDpi);

      // Light cutting rectangle slightly outside the card
      ctx.strokeRect(
        xPx - offsetPx,
        yPx - offsetPx,
        cardWidthPx + offsetPx * 2,
        cardHeightPx + offsetPx * 2
      );
      ctx.restore();
    }
  };

  // ----------------------------------------------------
  // LAYOUT EXECUTION WITH INDIVIDUAL UP/DOWN & LEFT/RIGHT OFFSETS
  // ----------------------------------------------------
  const frontOffsetXPx = mmToPixels(settings.front.positionXmm || 0, targetDpi);
  const frontOffsetYPx = mmToPixels(settings.front.positionYmm || 0, targetDpi);
  const backOffsetXPx = mmToPixels(settings.back.positionXmm || 0, targetDpi);
  const backOffsetYPx = mmToPixels(settings.back.positionYmm || 0, targetDpi);

  const front2OffsetXPx = mmToPixels(settings.front2?.positionXmm || 0, targetDpi);
  const front2OffsetYPx = mmToPixels(settings.front2?.positionYmm || 0, targetDpi);
  const back2OffsetXPx = mmToPixels(settings.back2?.positionXmm || 0, targetDpi);
  const back2OffsetYPx = mmToPixels(settings.back2?.positionYmm || 0, targetDpi);

  if (settings.layout === 'standard-vertical') {
    // 1 Copy: Front slightly above middle, Back slightly below middle
    const gapMm = Math.max(5, settings.verticalGapMm || 16);
    const gapPx = mmToPixels(gapMm, targetDpi);
    const centerXPx = Math.round((a4WidthPx - cardWidthPx) / 2);
    const centerYPx = Math.round(a4HeightPx / 2);

    // Front card top: centered above center line + individual offset
    const frontYPx = centerYPx - cardHeightPx - Math.round(gapPx / 2) + frontOffsetYPx;
    const frontXPx = centerXPx + frontOffsetXPx;

    // Back card top: centered below center line + individual offset
    const backYPx = centerYPx + Math.round(gapPx / 2) + backOffsetYPx;
    const backXPx = centerXPx + backOffsetXPx;

    // Draw Front & Back
    drawCardOnA4(frontCanvas, frontXPx, frontYPx, 'FRONT');
    drawCardOnA4(backCanvas, backXPx, backYPx, 'BACK');

    // Optional Card Title Header at top
    if (settings.cardLabel) {
      ctx.save();
      ctx.fillStyle = '#0f172a';
      ctx.font = `bold ${Math.round(mmToPixels(4.5, targetDpi))}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(settings.cardLabel.toUpperCase(), a4WidthPx / 2, mmToPixels(18, targetDpi));
      ctx.restore();
    }

    // Center divider guide line (ONLY if showMiddleDividingLine is true, default is false for clean print)
    if (settings.showMiddleDividingLine) {
      ctx.save();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.setLineDash([mmToPixels(3, targetDpi), mmToPixels(3, targetDpi)]);
      ctx.beginPath();
      ctx.moveTo(mmToPixels(15, targetDpi), centerYPx);
      ctx.lineTo(a4WidthPx - mmToPixels(15, targetDpi), centerYPx);
      ctx.stroke();
      ctx.restore();
    }
  } else if (settings.layout === 'free-custom') {
    // Free custom positioning on A4: Front and Back can be placed anywhere on A4
    const baseCenterX = Math.round((a4WidthPx - cardWidthPx) / 2);
    const baseCenterY = Math.round((a4HeightPx - cardHeightPx) / 2);

    // If offsets are 0, put Front slightly higher and Back slightly lower as initial base
    const defaultFrontY = baseCenterY - cardHeightPx / 2 - mmToPixels(10, targetDpi);
    const defaultBackY = baseCenterY + cardHeightPx / 2 + mmToPixels(10, targetDpi);

    const frontXPx = baseCenterX + frontOffsetXPx;
    const frontYPx = defaultFrontY + frontOffsetYPx;

    const backXPx = baseCenterX + backOffsetXPx;
    const backYPx = defaultBackY + backOffsetYPx;

    drawCardOnA4(frontCanvas, frontXPx, frontYPx, 'PHOTO 1 / FRONT');
    drawCardOnA4(backCanvas, backXPx, backYPx, 'PHOTO 2 / BACK');
  } else if (settings.layout === 'dual-copy') {
    // 2 Copies on 1 A4 (Cyber cafe standard paper saver):
    // Upper Half has Set 1 (Customer 1: Front & Back), Lower Half has Set 2 (Same or Customer 2: Front & Back)
    const halfHeightPx = Math.round(a4HeightPx / 2);
    const centerXPx = Math.round((a4WidthPx - cardWidthPx) / 2);
    const gapMm = Math.max(4, Math.min(12, settings.verticalGapMm * 0.5));
    const gapPx = mmToPixels(gapMm, targetDpi);

    // --- Upper Half Set (Customer 1) ---
    const upperCenterY = Math.round(halfHeightPx / 2);
    const upperFrontY = upperCenterY - cardHeightPx - Math.round(gapPx / 2) + frontOffsetYPx;
    const upperBackY = upperCenterY + Math.round(gapPx / 2) + backOffsetYPx;

    drawCardOnA4(frontCanvas, centerXPx + frontOffsetXPx, upperFrontY, isDualPerson ? 'PERSON 1 • FRONT' : 'COPY 1 • FRONT');
    drawCardOnA4(backCanvas, centerXPx + backOffsetXPx, upperBackY, isDualPerson ? 'PERSON 1 • BACK' : 'COPY 1 • BACK');

    // --- Lower Half Set (Customer 2 or Duplicate) ---
    const lowerCenterY = halfHeightPx + Math.round(halfHeightPx / 2);
    const lowerFrontOffsetXPx = isDualPerson ? front2OffsetXPx : frontOffsetXPx;
    const lowerFrontOffsetYPx = isDualPerson ? front2OffsetYPx : frontOffsetYPx;
    const lowerBackOffsetXPx = isDualPerson ? back2OffsetXPx : backOffsetXPx;
    const lowerBackOffsetYPx = isDualPerson ? back2OffsetYPx : backOffsetYPx;

    const lowerFrontY = lowerCenterY - cardHeightPx - Math.round(gapPx / 2) + lowerFrontOffsetYPx;
    const lowerBackY = lowerCenterY + Math.round(gapPx / 2) + lowerBackOffsetYPx;

    drawCardOnA4(front2Canvas, centerXPx + lowerFrontOffsetXPx, lowerFrontY, isDualPerson ? 'PERSON 2 • FRONT' : 'COPY 2 • FRONT');
    drawCardOnA4(back2Canvas, centerXPx + lowerBackOffsetXPx, lowerBackY, isDualPerson ? 'PERSON 2 • BACK' : 'COPY 2 • BACK');

    // Middle Scissor Line is REMOVED for clean printing by default! Only drawn if showMiddleDividingLine is true.
    if (settings.showMiddleDividingLine) {
      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(1, Math.round(targetDpi / 300));
      ctx.setLineDash([mmToPixels(3, targetDpi), mmToPixels(2, targetDpi)]);
      ctx.beginPath();
      ctx.moveTo(mmToPixels(5, targetDpi), halfHeightPx);
      ctx.lineTo(a4WidthPx - mmToPixels(5, targetDpi), halfHeightPx);
      ctx.stroke();

      if (settings.showCardLabels) {
        ctx.fillStyle = '#64748b';
        ctx.font = `${Math.round(mmToPixels(3, targetDpi))}px sans-serif`;
        ctx.textAlign = 'right';
        ctx.fillText('✂ CUT HERE', a4WidthPx - mmToPixels(12, targetDpi), halfHeightPx - mmToPixels(1.5, targetDpi));
      }
      ctx.restore();
    }
  } else if (settings.layout === 'side-by-side') {
    // Front & Back next to each other horizontally (Lamination card folding style)
    const gapMm = Math.max(2, settings.verticalGapMm * 0.4);
    const gapPx = mmToPixels(gapMm, targetDpi);
    const totalWidthPx = cardWidthPx * 2 + gapPx;
    const startXPx = Math.round((a4WidthPx - totalWidthPx) / 2);
    const centerYPx = Math.round((a4HeightPx - cardHeightPx) / 2);

    drawCardOnA4(frontCanvas, startXPx + frontOffsetXPx, centerYPx + frontOffsetYPx, 'FRONT');
    drawCardOnA4(backCanvas, startXPx + cardWidthPx + gapPx + backOffsetXPx, centerYPx + backOffsetYPx, 'BACK');

    // Fold line in between
    if (settings.hasCuttingMarks) {
      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = Math.max(1, Math.round(targetDpi / 300));
      ctx.setLineDash([mmToPixels(2, targetDpi), mmToPixels(2, targetDpi)]);
      const foldXPx = startXPx + cardWidthPx + Math.round(gapPx / 2);
      ctx.beginPath();
      ctx.moveTo(foldXPx, centerYPx - mmToPixels(6, targetDpi));
      ctx.lineTo(foldXPx, centerYPx + cardHeightPx + mmToPixels(6, targetDpi));
      ctx.stroke();
      ctx.restore();
    }
  } else if (settings.layout === 'front-only') {
    const centerXPx = Math.round((a4WidthPx - cardWidthPx) / 2) + frontOffsetXPx;
    const centerYPx = Math.round((a4HeightPx - cardHeightPx) / 2) + frontOffsetYPx;
    drawCardOnA4(frontCanvas, centerXPx, centerYPx, 'FRONT ONLY');
  } else if (settings.layout === 'back-only') {
    const centerXPx = Math.round((a4WidthPx - cardWidthPx) / 2) + backOffsetXPx;
    const centerYPx = Math.round((a4HeightPx - cardHeightPx) / 2) + backOffsetYPx;
    drawCardOnA4(backCanvas, centerXPx, centerYPx, 'BACK ONLY');
  }

  return canvas;
}

/**
 * Generate 300 DPI Print-Ready PDF for A4 ID Card Xerox
 */
export async function generateIdCardPdf(
  settings: IdCardPrintSettings
): Promise<Uint8Array> {
  // Render at ultra sharp 300 DPI for crystal clear printing
  const sheetCanvas = await renderIdCardA4SheetCanvas(settings, 300);
  const dataUrl = sheetCanvas.toDataURL('image/jpeg', 0.99);

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  pdf.addImage(dataUrl, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
  const buffer = pdf.output('arraybuffer');
  return new Uint8Array(buffer);
}

/**
 * Download 4K Ultra HD High-Res A4 PNG Image (300 to 450 DPI crystal clarity)
 */
export async function downloadIdCardA4Image(
  settings: IdCardPrintSettings,
  fileName: string = 'id_card_a4_xerox_4k',
  dpi: number = 350
) {
  // 350 DPI on A4 gives ~2894 x 4093 pixels (True 4K+ HD Master Quality)
  const sheetCanvas = await renderIdCardA4SheetCanvas(settings, dpi);
  const link = document.createElement('a');
  link.download = `${fileName}.png`;
  link.href = sheetCanvas.toDataURL('image/png', 1.0);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
