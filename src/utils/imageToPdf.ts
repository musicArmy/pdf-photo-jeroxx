import { jsPDF } from 'jspdf';
import { UploadedImage, ImageToPdfSettings } from '../types';

export async function convertImagesToPdf(
  images: UploadedImage[],
  settings: ImageToPdfSettings
): Promise<Uint8Array> {
  if (images.length === 0) {
    throw new Error('No images provided for PDF conversion.');
  }

  // Create jsPDF instance
  // Default A4 is 210mm x 297mm
  const isA4 = settings.pageSize === 'a4';
  const isLetter = settings.pageSize === 'letter';

  // Initialize with first image specs
  const firstImage = images[0];
  const firstRotated = (firstImage.rotation % 180 !== 0);
  const firstImgW = firstRotated ? firstImage.height : firstImage.width;
  const firstImgH = firstRotated ? firstImage.width : firstImage.height;

  let initialOrientation: 'p' | 'l' = 'p';
  if (settings.orientation === 'auto') {
    initialOrientation = firstImgW > firstImgH ? 'l' : 'p';
  } else if (settings.orientation === 'landscape') {
    initialOrientation = 'l';
  }

  let pdf: jsPDF;
  if (isA4) {
    pdf = new jsPDF({
      orientation: initialOrientation,
      unit: 'mm',
      format: 'a4',
      compress: true,
    });
  } else if (isLetter) {
    pdf = new jsPDF({
      orientation: initialOrientation,
      unit: 'mm',
      format: 'letter',
      compress: true,
    });
  } else {
    // Fit to image dimensions
    // Convert px to mm (approx 1px = 0.264583 mm)
    const mmW = Math.max(50, firstImgW * 0.264583);
    const mmH = Math.max(50, firstImgH * 0.264583);
    pdf = new jsPDF({
      orientation: mmW > mmH ? 'l' : 'p',
      unit: 'mm',
      format: [mmW, mmH],
      compress: true,
    });
  }

  // Helper to get oriented canvas data with maximum fidelity
  const getProcessedImageDataUrl = async (imgItem: UploadedImage): Promise<string> => {
    const isPng = imgItem.file?.type === 'image/png' || imgItem.dataUrl.startsWith('data:image/png');
    const targetMime = (isPng && (settings.imageQuality >= 0.95)) ? 'image/png' : 'image/jpeg';
    const quality = targetMime === 'image/jpeg' ? Math.max(0.92, settings.imageQuality) : undefined;

    if (imgItem.rotation === 0 && (!isPng || targetMime === 'image/png')) {
      return imgItem.dataUrl;
    }

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const rot = ((imgItem.rotation % 360) + 360) % 360;
        if (rot === 90 || rot === 270) {
          canvas.width = img.height;
          canvas.height = img.width;
        } else {
          canvas.width = img.width;
          canvas.height = img.height;
        }
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(imgItem.dataUrl);
          return;
        }
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rot * Math.PI) / 180);
        ctx.drawImage(img, -img.width / 2, -img.height / 2);
        resolve(canvas.toDataURL(targetMime, quality));
      };
      img.onerror = () => resolve(imgItem.dataUrl);
      img.src = imgItem.dataUrl;
    });
  };

  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    if (i > 0) {
      // Calculate orientation for subsequent pages
      const rotated = (item.rotation % 180 !== 0);
      const imgW = rotated ? item.height : item.width;
      const imgH = rotated ? item.width : item.height;
      let pageOrient: 'p' | 'l' = 'p';
      if (settings.orientation === 'auto') {
        pageOrient = imgW > imgH ? 'l' : 'p';
      } else if (settings.orientation === 'landscape') {
        pageOrient = 'l';
      }

      if (settings.pageSize === 'fit') {
        const mmW = Math.max(50, imgW * 0.264583);
        const mmH = Math.max(50, imgH * 0.264583);
        pdf.addPage([mmW, mmH], mmW > mmH ? 'l' : 'p');
      } else {
        pdf.addPage(settings.pageSize, pageOrient);
      }
    }

    const processedDataUrl = await getProcessedImageDataUrl(item);
    const isPng = processedDataUrl.startsWith('data:image/png');
    const imageFormat = isPng ? 'PNG' : 'JPEG';
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = settings.marginMm;

    const availableWidth = pageWidth - margin * 2;
    const availableHeight = pageHeight - margin * 2;

    const rotated = (item.rotation % 180 !== 0);
    const imgW = rotated ? item.height : item.width;
    const imgH = rotated ? item.width : item.height;
    const imgRatio = imgW / imgH;

    let targetW = availableWidth;
    let targetH = targetW / imgRatio;

    if (targetH > availableHeight) {
      targetH = availableHeight;
      targetW = targetH * imgRatio;
    }

    const posX = margin + (availableWidth - targetW) / 2;
    const posY = margin + (availableHeight - targetH) / 2;

    pdf.addImage(processedDataUrl, imageFormat, posX, posY, targetW, targetH, undefined, 'SLOW');
  }

  const pdfOutput = pdf.output('arraybuffer');
  return new Uint8Array(pdfOutput);
}

export function downloadPdfBlob(bytes: Uint8Array, fileName: string) {
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
