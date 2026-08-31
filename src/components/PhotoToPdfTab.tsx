import React, { useState, useRef } from 'react';
import { UploadedImage, ImageToPdfSettings, Language } from '../types';
import { translations } from '../utils/i18n';
import { convertImagesToPdf, downloadPdfBlob } from '../utils/imageToPdf';
import { createSampleDocumentImage } from '../utils/sampleData';
import { saveToHistory } from '../utils/historyStorage';
import confetti from 'canvas-confetti';
import {
  Upload,
  Plus,
  Trash2,
  RotateCw,
  ArrowLeft,
  ArrowRight,
  Download,
  FileDown,
  Settings,
  Eye,
  CheckCircle2,
  Sparkles,
  Loader2,
  Printer
} from 'lucide-react';

interface PhotoToPdfTabProps {
  language: Language;
}

export const PhotoToPdfTab: React.FC<PhotoToPdfTabProps> = ({ language }) => {
  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const [images, setImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);

  const [settings, setSettings] = useState<ImageToPdfSettings>({
    pageSize: 'a4',
    orientation: 'portrait',
    marginMm: 5,
    imageQuality: 0.92,
    title: 'my_photos_document',
  });

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;

    fileArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const img = new Image();
        img.onload = () => {
          const newImage: UploadedImage = {
            id: Math.random().toString(36).substring(2, 9),
            file,
            name: file.name,
            dataUrl,
            width: img.width,
            height: img.height,
            rotation: 0,
            size: file.size,
          };
          setImages((prev) => [...prev, newImage]);
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const loadSamplePhotos = () => {
    const sample1 = createSampleDocumentImage('A4 Photo Document', 1);
    const sample2 = createSampleDocumentImage('Attached Receipt / Image', 2);

    const img1: UploadedImage = {
      id: 'sample-1',
      name: 'Document_Photo_1.jpg',
      dataUrl: sample1,
      width: 800,
      height: 1100,
      rotation: 0,
      size: 145000,
    };
    const img2: UploadedImage = {
      id: 'sample-2',
      name: 'Document_Photo_2.jpg',
      dataUrl: sample2,
      width: 800,
      height: 1100,
      rotation: 0,
      size: 138000,
    };
    setImages([img1, img2]);
  };

  const rotateImage = (id: string) => {
    setImages((prev) =>
      prev.map((img) =>
        img.id === id ? { ...img, rotation: (img.rotation + 90) % 360 } : img
      )
    );
  };

  const deleteImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    const newIndex = direction === 'left' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= images.length) return;
    const updated = [...images];
    const temp = updated[index];
    updated[index] = updated[newIndex];
    updated[newIndex] = temp;
    setImages(updated);
  };

  const handleGeneratePdf = async (download: boolean = true) => {
    if (images.length === 0) return;
    setIsProcessing(true);

    try {
      const pdfBytes = await convertImagesToPdf(images, settings);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      // Save to persistent history
      await saveToHistory({
        title: settings.title || 'Photos to PDF Document',
        toolType: 'photo-to-pdf',
        thumbnailUrl: images[0]?.dataUrl || '',
        pdfDataUrl: url,
        fileSizeText: `${(pdfBytes.byteLength / 1024).toFixed(0)} KB PDF`,
        details: `${images.length} Images merged to ${settings.pageSize.toUpperCase()} PDF`,
        itemCount: images.length,
      });
      
      if (download) {
        downloadPdfBlob(pdfBytes, settings.title || 'document.pdf');
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
        });
      } else {
        setPreviewPdfUrl(url);
      }
    } catch (err) {
      console.error('Error generating PDF:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Header Banner */}
      <div className="bg-gradient-to-r from-blue-950/60 via-slate-900 to-indigo-950/60 border border-blue-900/40 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Upload className="w-6 h-6 text-blue-400" />
            {t.tabPhotoToPdf}
          </h2>
          <p className="text-sm text-slate-300 mt-1">
            {language === 'hi'
              ? 'अपनी सिंगल या मल्टीपल फोटो चुनें, उनका क्रम सेट करें और हाई-क्वालिटी PDF में डाउनलोड करें।'
              : 'Convert single or multiple images into a professional high-resolution PDF document.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {images.length === 0 && (
            <button
              id="try-sample-photos-btn"
              onClick={loadSamplePhotos}
              className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors"
            >
              <Sparkles className="w-4 h-4 text-cyan-300" />
              <span>{language === 'hi' ? '⚡ टेस्ट सैंपल फोटो लोड करें' : '⚡ Load Sample Photos'}</span>
            </button>
          )}
          {images.length > 0 && (
            <button
              id="clear-all-photos-btn"
              onClick={() => setImages([])}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-950/40 text-slate-300 hover:text-red-300 border border-slate-700 text-xs font-medium transition-colors"
            >
              {t.clearAll}
            </button>
          )}
        </div>
      </div>

      {/* Upload Zone */}
      {images.length === 0 ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all ${
            isDragging
              ? 'border-blue-500 bg-blue-500/10 scale-[1.01]'
              : 'border-slate-700/80 bg-slate-900/50 hover:bg-slate-900/80 hover:border-slate-600'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4 shadow-inner">
            <Upload className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <h3 className="text-base sm:text-lg font-bold text-white mb-1">
            {t.uploadPhotos}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-5">
            {t.uploadPhotosSub}
          </p>
          <button
            type="button"
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-600/30 transition-all inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t.selectPhotosBtn}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Photos Grid & Management */}
          <div className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between bg-slate-900/80 px-4 py-3 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">
                  {t.totalImages} <span className="text-blue-400">{images.length}</span>
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">
                  • {t.dragToReorder}
                </span>
              </div>
              <div>
                <input
                  ref={addMoreInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFiles(e.target.files)}
                />
                <button
                  id="add-more-photos-btn"
                  onClick={() => addMoreInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t.addMorePhotos}
                </button>
              </div>
            </div>

            {/* Thumbnail cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {images.map((img, index) => (
                <div
                  key={img.id}
                  className="group relative bg-slate-950/90 rounded-xl border border-slate-800/90 p-2 overflow-hidden flex flex-col shadow-sm hover:border-slate-600 transition-all"
                >
                  {/* Page Badge */}
                  <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-md bg-slate-900/80 backdrop-blur-md text-[10px] font-bold text-white border border-slate-700">
                    #{index + 1}
                  </div>

                  {/* Thumbnail Image Container */}
                  <div className="w-full aspect-[3/4] bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center relative">
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      style={{
                        transform: `rotate(${img.rotation}deg)`,
                      }}
                      className="max-h-full max-w-full object-contain transition-transform duration-200"
                    />
                  </div>

                  {/* Info */}
                  <div className="mt-2 text-center">
                    <p className="text-[11px] font-medium text-slate-300 truncate" title={img.name}>
                      {img.name}
                    </p>
                    <p className="text-[9px] text-slate-500">
                      {Math.round(img.size / 1024)} KB
                    </p>
                  </div>

                  {/* Actions Toolbar */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center gap-1">
                      <button
                        title="Move Left"
                        disabled={index === 0}
                        onClick={() => moveImage(index, 'left')}
                        className="p-1 rounded bg-slate-800/80 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
                      >
                        <ArrowLeft className="w-3 h-3" />
                      </button>
                      <button
                        title="Move Right"
                        disabled={index === images.length - 1}
                        onClick={() => moveImage(index, 'right')}
                        className="p-1 rounded bg-slate-800/80 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:text-slate-400"
                      >
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        title={t.rotate}
                        onClick={() => rotateImage(img.id)}
                        className="p-1 rounded bg-slate-800/80 text-slate-400 hover:text-blue-400"
                      >
                        <RotateCw className="w-3 h-3" />
                      </button>
                      <button
                        title={t.delete}
                        onClick={() => deleteImage(img.id)}
                        className="p-1 rounded bg-slate-800/80 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Settings & PDF Export Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold pb-3 border-b border-slate-800">
                <Settings className="w-4 h-4 text-blue-400" />
                <span>{language === 'hi' ? 'PDF सेटिंग्स (Settings)' : 'PDF Settings'}</span>
              </div>

              {/* PDF File Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.pdfName}
                </label>
                <div className="flex items-center rounded-xl bg-slate-950 border border-slate-700/80 px-3 py-2">
                  <input
                    type="text"
                    value={settings.title}
                    onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                    placeholder="my_document"
                    className="bg-transparent text-sm text-white w-full outline-none"
                  />
                  <span className="text-xs text-slate-500 font-mono">.pdf</span>
                </div>
              </div>

              {/* Page Size */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.pageSize}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['a4', 'letter', 'fit'] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setSettings({ ...settings, pageSize: size })}
                      className={`py-2 px-1 text-xs font-semibold rounded-lg border text-center transition-all ${
                        settings.pageSize === size
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {size === 'a4' ? 'A4 (210×297)' : size === 'letter' ? 'Letter' : 'Auto Fit'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Orientation */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.orientation}
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['portrait', 'landscape', 'auto'] as const).map((ori) => (
                    <button
                      key={ori}
                      type="button"
                      onClick={() => setSettings({ ...settings, orientation: ori })}
                      className={`py-2 px-1 text-xs font-semibold rounded-lg border text-center transition-all ${
                        settings.orientation === ori
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {ori === 'portrait' ? t.portrait : ori === 'landscape' ? t.landscape : t.autoFit}
                    </button>
                  ))}
                </div>
              </div>

              {/* Margin */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.margins}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([0, 5, 10, 15] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSettings({ ...settings, marginMm: m })}
                      className={`py-1.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                        settings.marginMm === m
                          ? 'bg-blue-600 text-white border-blue-500'
                          : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {m === 0 ? '0 mm' : `${m} mm`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 space-y-2">
                <button
                  id="convert-and-download-pdf-btn"
                  disabled={isProcessing}
                  onClick={() => handleGeneratePdf(true)}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{t.processing}</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      <span>{t.convertAndDownloadPdf}</span>
                    </>
                  )}
                </button>

                <button
                  id="preview-pdf-btn"
                  disabled={isProcessing}
                  onClick={() => handleGeneratePdf(false)}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors border border-slate-700"
                >
                  <Eye className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{language === 'hi' ? 'PDF प्रीव्यू देखें' : 'Preview PDF'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF Live Preview Modal */}
      {previewPdfUrl && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-white text-sm flex items-center gap-2">
                <FileDown className="w-4 h-4 text-blue-400" />
                {settings.title}.pdf — {t.preview}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={previewPdfUrl}
                  download={`${settings.title}.pdf`}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{language === 'hi' ? 'डाउनलोड' : 'Download'}</span>
                </a>
                <button
                  onClick={() => setPreviewPdfUrl(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  {t.close}
                </button>
              </div>
            </div>
            <div className="flex-1 bg-slate-950 p-2">
              <iframe
                src={previewPdfUrl}
                title="PDF Preview"
                className="w-full h-full rounded-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
