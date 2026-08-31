import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
// @ts-expect-error - Vite ?raw import
import workerRaw from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw';
import JSZip from 'jszip';
import { PdfPageImage } from '../types';

let cachedWorkerBlobUrl: string | null = null;

function getWorkerUrl(): string {
  if (cachedWorkerBlobUrl) return cachedWorkerBlobUrl;
  try {
    if (workerRaw && typeof window !== 'undefined') {
      const blob = new Blob([workerRaw], { type: 'text/javascript' });
      cachedWorkerBlobUrl = URL.createObjectURL(blob);
      return cachedWorkerBlobUrl;
    }
  } catch (e) {
    console.warn('Could not create inline blob worker:', e);
  }
  return `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/legacy/build/pdf.worker.min.mjs`;
}

function setupWorker() {
  if (typeof window === 'undefined') return;
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = getWorkerUrl();
  } catch (e) {
    console.warn('Worker configuration notice:', e);
  }
}

setupWorker();

export async function convertPdfToImages(
  file: File | ArrayBuffer,
  dpi: number = 200,
  imageFormat: 'png' | 'jpeg' = 'png',
  onProgress?: (current: number, total: number) => void
): Promise<PdfPageImage[]> {
  setupWorker();

  let arrayBuffer: ArrayBuffer;
  if (file instanceof File) {
    arrayBuffer = await file.arrayBuffer();
  } else {
    arrayBuffer = file;
  }

  const uint8Data = new Uint8Array(arrayBuffer);
  let pdfDoc;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: uint8Data,
      cMapUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/cmaps/`,
      cMapPacked: true,
      standardFontDataUrl: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/standard_fonts/`,
    });
    pdfDoc = await loadingTask.promise;
  } catch (initErr: any) {
    console.warn('Initial PDF loading failed, attempting fallback loading:', initErr);
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
      const fallbackTask = pdfjsLib.getDocument({
        data: uint8Data,
      });
      pdfDoc = await fallbackTask.promise;
    } catch (fallbackErr: any) {
      console.error('All PDF loaders failed:', fallbackErr);
      throw new Error(fallbackErr?.message || initErr?.message || 'Could not parse PDF document.');
    }
  }

  const numPages = pdfDoc.numPages;
  const pageImages: PdfPageImage[] = [];

  // 72 DPI is standard base PDF scale. 
  // For 150 DPI -> scale = 150/72 ≈ 2.083
  // For 300 DPI -> scale = 300/72 ≈ 4.166
  const scale = Math.max(1, dpi / 72);

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    if (onProgress) {
      onProgress(pageNum, numPages);
    }

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      continue;
    }

    // Fill white background (PDF pages can be transparent)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    await page.render(renderContext).promise;

    const mimeType = imageFormat === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = imageFormat === 'jpeg' ? 0.95 : undefined;

    const dataUrl = canvas.toDataURL(mimeType, quality);
    const blob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((b) => resolve(b || new Blob()), mimeType, quality);
    });

    pageImages.push({
      pageNumber: pageNum,
      dataUrl,
      blob,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return pageImages;
}

export async function downloadAllImagesAsZip(
  pageImages: PdfPageImage[],
  baseFileName: string,
  imageFormat: 'png' | 'jpeg' = 'png'
) {
  const zip = new JSZip();
  const ext = imageFormat === 'jpeg' ? 'jpg' : 'png';
  const cleanName = baseFileName.replace(/\.pdf$/i, '');

  pageImages.forEach((img) => {
    const filename = `${cleanName}_page_${String(img.pageNumber).padStart(2, '0')}.${ext}`;
    zip.file(filename, img.blob);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${cleanName}_all_pages.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function downloadSinglePageImage(
  image: PdfPageImage,
  baseFileName: string,
  imageFormat: 'png' | 'jpeg' = 'png'
) {
  const ext = imageFormat === 'jpeg' ? 'jpg' : 'png';
  const cleanName = baseFileName.replace(/\.pdf$/i, '');
  const link = document.createElement('a');
  link.href = image.dataUrl;
  link.download = `${cleanName}_page_${image.pageNumber}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
