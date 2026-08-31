import React, { useState, useRef } from 'react';
import { PdfPageImage, Language } from '../types';
import { translations } from '../utils/i18n';
import {
  convertPdfToImages,
  downloadAllImagesAsZip,
  downloadSinglePageImage,
} from '../utils/pdfToImage';
import { jsPDF } from 'jspdf';
import { saveToHistory } from '../utils/historyStorage';
import confetti from 'canvas-confetti';
import {
  FileText,
  Upload,
  Download,
  Archive,
  Eye,
  Sparkles,
  Loader2,
  ZoomIn,
  CheckCircle,
  FileCheck2,
  RefreshCw
} from 'lucide-react';

interface PdfToPhotoTabProps {
  language: Language;
}

export const PdfToPhotoTab: React.FC<PdfToPhotoTabProps> = ({ language }) => {
  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string>('');
  const [pageImages, setPageImages] = useState<PdfPageImage[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dpi, setDpi] = useState<number>(300);
  const [imageFormat, setImageFormat] = useState<'png' | 'jpeg'>('png');
  const [selectedPreviewImage, setSelectedPreviewImage] = useState<PdfPageImage | null>(null);

  const handlePdfUpload = async (file: File, targetDpi: number = dpi) => {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setErrorMessage(language === 'hi' ? 'कृपया केवल वैध PDF फ़ाइल (.pdf) चुनें।' : 'Please select a valid PDF file (.pdf).');
      return;
    }
    setErrorMessage(null);
    setPdfFile(file);
    setPdfFileName(file.name);
    setPageImages([]);
    await processPdf(file, targetDpi, imageFormat);
  };

  const processPdf = async (
    fileData: File | ArrayBuffer,
    targetDpi: number,
    format: 'png' | 'jpeg'
  ) => {
    setIsProcessing(true);
    setErrorMessage(null);
    setProgress({ current: 0, total: 1 });

    try {
      const results = await convertPdfToImages(
        fileData,
        targetDpi,
        format,
        (current, total) => {
          setProgress({ current, total });
        }
      );
      if (!results || results.length === 0) {
        throw new Error('No pages could be extracted from the PDF.');
      }
      setPageImages(results);

      // Save to persistent history
      await saveToHistory({
        title: `PDF to Images (${pdfFileName || 'Document'})`,
        toolType: 'pdf-to-photo',
        thumbnailUrl: results[0]?.dataUrl || '',
        fullImageDataUrl: results[0]?.dataUrl || '',
        fileSizeText: `${targetDpi} DPI • ${results.length} Pages`,
        details: `Converted ${results.length} Pages into High-Res ${format.toUpperCase()}`,
        itemCount: results.length,
      });

      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.6 },
      });
    } catch (err: any) {
      console.error('Error rendering PDF to images:', err);
      setErrorMessage(
        err?.message?.includes('password')
          ? (language === 'hi' ? 'यह PDF पासवर्ड से सुरक्षित है। कृपया बिना पासवर्ड वाली PDF चुनें।' : 'This PDF is password protected. Please choose an unprotected PDF.')
          : (language === 'hi' ? 'PDF प्रोसेस करने में समस्या आई। कृपया फ़ाइल जांचें या पुनः प्रयास करें।' : 'Could not process PDF. Please check the file and try again.')
      );
    } finally {
      setIsProcessing(false);
      setProgress(null);
    }
  };

  const loadSamplePdf = async () => {
    setIsProcessing(true);
    // Create a 2-page sample PDF on the fly
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Page 1
    doc.setFillColor(37, 99, 235);
    doc.rect(15, 15, 180, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('PDF Sample Document - Page 1', 25, 30);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text('This is a high-resolution sample PDF document created for testing.', 20, 60);
    doc.text('Notice how every text and element is rendered sharply as an image.', 20, 70);
    
    doc.setDrawColor(203, 213, 225);
    doc.rect(20, 90, 170, 80);
    doc.setFontSize(10);
    doc.text('Photo Box / Diagram Area', 75, 135);

    // Page 2
    doc.addPage('a4', 'portrait');
    doc.setFillColor(16, 185, 129);
    doc.rect(15, 15, 180, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('Official Invoice / Certificate - Page 2', 25, 30);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text('Sample second page with table breakdown:', 20, 60);
    
    const pdfBuffer = doc.output('arraybuffer');
    setPdfFileName('sample_official_document.pdf');
    await processPdf(pdfBuffer, dpi, imageFormat);
  };

  const handleDownloadAllZip = async () => {
    if (pageImages.length === 0) return;
    await downloadAllImagesAsZip(pageImages, pdfFileName || 'document', imageFormat);
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-900/40 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-emerald-400" />
            {t.tabPdfToPhoto}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {language === 'hi'
              ? 'PDF फाइल अपलोड करें और उसके सभी पेज हाई-डेफिनिशन JPG/PNG फोटो में निकालें।'
              : 'Upload any PDF file and extract all its pages into high-resolution JPG / PNG photos.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pageImages.length === 0 && (
            <button
              id="try-sample-pdf-btn"
              onClick={loadSamplePdf}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-emerald-300" />
              <span>{language === 'hi' ? '⚡ टेस्ट सैंपल PDF लोड करें' : '⚡ Load Sample PDF'}</span>
            </button>
          )}
          {pageImages.length > 0 && (
            <button
              onClick={() => {
                setPdfFile(null);
                setPageImages([]);
                setPdfFileName('');
              }}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'नई PDF चुनें' : 'Upload New PDF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Alert Message */}
      {errorMessage && (
        <div className="bg-red-950/60 border border-red-500/40 rounded-xl p-4 text-red-200 text-sm flex items-center justify-between gap-3 animate-in fade-in">
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            className="px-2.5 py-1 bg-red-900/60 hover:bg-red-800 rounded-lg text-xs font-semibold text-white transition-colors"
          >
            {language === 'hi' ? 'हटाएं' : 'Dismiss'}
          </button>
        </div>
      )}

      {/* Upload Box */}
      {pageImages.length === 0 && !isProcessing && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
              handlePdfUpload(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700/80 bg-slate-900/50 hover:bg-slate-900/80 hover:border-emerald-500/60 rounded-2xl p-8 sm:p-14 text-center cursor-pointer transition-all"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                const file = e.target.files[0];
                handlePdfUpload(file);
              }
              // Reset so selecting the same file again triggers onChange
              e.target.value = '';
            }}
          />
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-4 shadow-inner">
            <FileText className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            {t.uploadPdf}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-5">
            {t.uploadPdfSub}
          </p>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-600/30 transition-all inline-flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {t.selectPdfBtn}
          </button>
        </div>
      )}

      {/* Loading & Processing State */}
      {isProcessing && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center space-y-4 max-w-md mx-auto">
          <Loader2 className="w-10 h-10 text-emerald-400 animate-spin mx-auto" />
          <h4 className="text-base font-bold text-white">
            {t.convertingPdf}
          </h4>
          {progress && progress.total > 0 && (
            <div className="space-y-2">
              <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-400">
                {t.pageNumber} {progress.current} / {progress.total}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Converted Pages Gallery */}
      {pageImages.length > 0 && (
        <div className="space-y-6">
          {/* Controls & Batch Action Bar */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                  {pdfFileName}
                </p>
                <p className="text-xs text-emerald-400 font-medium">
                  {t.totalPages} {pageImages.length} {language === 'hi' ? 'फोटो तैयार' : 'photos extracted'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* DPI / Quality Switcher */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                {[
                  { value: 150, label: '150 DPI' },
                  { value: 300, label: '300 DPI (HD)' },
                  { value: 400, label: '400 DPI (4K)' },
                ].map((d) => (
                  <button
                    key={d.value}
                    onClick={() => {
                      setDpi(d.value);
                      if (pdfFile) {
                        processPdf(pdfFile, d.value, imageFormat);
                      }
                    }}
                    className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
                      dpi === d.value
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Format Switcher */}
              <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  onClick={() => setImageFormat('png')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    imageFormat === 'png'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PNG (Crisp)
                </button>
                <button
                  onClick={() => setImageFormat('jpeg')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                    imageFormat === 'jpeg'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  JPG (Light)
                </button>
              </div>

              {/* Download All in ZIP */}
              <button
                id="download-all-zip-btn"
                onClick={handleDownloadAllZip}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-2 transition-all"
              >
                <Archive className="w-4 h-4" />
                <span>{t.downloadAllZip}</span>
              </button>
            </div>
          </div>

          {/* Grid of Pages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pageImages.map((page) => (
              <div
                key={page.pageNumber}
                className="bg-slate-950/90 rounded-2xl border border-slate-800 p-3 flex flex-col justify-between shadow-sm hover:border-slate-700 transition-all group"
              >
                {/* Image Canvas Box */}
                <div className="relative bg-white rounded-xl overflow-hidden aspect-[3/4] flex items-center justify-center p-1 cursor-pointer"
                     onClick={() => setSelectedPreviewImage(page)}>
                  <img
                    src={page.dataUrl}
                    alt={`Page ${page.pageNumber}`}
                    className="max-h-full max-w-full object-contain"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-1.5 border border-slate-700">
                      <ZoomIn className="w-3.5 h-3.5" />
                      {language === 'hi' ? 'बड़ा देखें' : 'View Full'}
                    </span>
                  </div>
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-[11px] font-bold text-white border border-slate-700">
                    {t.pageNumber} {page.pageNumber}
                  </div>
                </div>

                {/* Page Details & Action */}
                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="text-[10px] text-slate-400">
                    {page.width} × {page.height} px
                  </div>
                  <button
                    onClick={() => downloadSinglePageImage(page, pdfFileName, imageFormat)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-emerald-600 text-slate-200 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t.downloadPage}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Preview Modal */}
      {selectedPreviewImage && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-white text-sm">
                {pdfFileName} — {t.pageNumber} {selectedPreviewImage.pageNumber}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadSinglePageImage(selectedPreviewImage, pdfFileName, imageFormat)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{t.downloadPage}</span>
                </button>
                <button
                  onClick={() => setSelectedPreviewImage(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  {t.close}
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-950 flex-1 overflow-auto flex items-center justify-center">
              <img
                src={selectedPreviewImage.dataUrl}
                alt="Full Preview"
                className="max-h-[75vh] object-contain rounded-lg bg-white shadow-md"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
