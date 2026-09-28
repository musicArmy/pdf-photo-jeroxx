import React, { useState, useEffect, useRef, useCallback } from 'react';
import { PassportSettings, PassportLayoutMode, Language } from '../types';
import { translations } from '../utils/i18n';
import {
  DEFAULT_PASSPORT_SETTINGS,
  renderSinglePassportCanvas,
  renderA4PrintableSheetCanvas,
  generatePassportPdf,
  downloadA4SheetImage,
  downloadSinglePhotoFile,
} from '../utils/passportGenerator';
import { downloadPdfBlob } from '../utils/imageToPdf';
import { createSamplePortraitDataUrl } from '../utils/sampleData';
import { saveToHistory } from '../utils/historyStorage';
import confetti from 'canvas-confetti';
import {
  Upload,
  UserSquare2,
  Printer,
  FileDown,
  Download,
  Sparkles,
  Sliders,
  RotateCw,
  Sun,
  Contrast,
  Crop,
  Scissors,
  CheckCircle2,
  Type,
  ZoomIn,
  ZoomOut,
  Move,
  RefreshCw,
  Maximize2,
  Grid,
  ShieldAlert,
  Wand2,
  Hand,
  ScanFace,
  Loader2
} from 'lucide-react';
import {
  detectFace,
  calculateOptimalPassportCrop,
  DetectedFace
} from '../utils/faceDetection';

interface PassportPhotoTabProps {
  language: Language;
}

export const PassportPhotoTab: React.FC<PassportPhotoTabProps> = ({ language }) => {
  const t = translations[language];
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);

  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [sourceImageName, setSourceImageName] = useState<string>('photo');
  const [settings, setSettings] = useState<PassportSettings>(DEFAULT_PASSPORT_SETTINGS);
  const [showFaceGuide, setShowFaceGuide] = useState<boolean>(true);

  // Auto Face Detection state
  const [isDetectingFace, setIsDetectingFace] = useState<boolean>(false);
  const [detectedFace, setDetectedFace] = useState<DetectedFace | null>(null);
  const [faceDetectionStatus, setFaceDetectionStatus] = useState<{
    type: 'success' | 'none' | 'detecting';
    message: string;
    details?: string;
  } | null>(null);

  // Previews
  const [singlePreviewUrl, setSinglePreviewUrl] = useState<string | null>(null);
  const [a4SheetPreviewUrl, setA4SheetPreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeFilterPreset, setActiveFilterPreset] = useState<'normal' | 'enhanced' | 'warm' | 'bw'>('normal');

  // Interactive slide & drag state
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; cropX: number; cropY: number } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartZoomRef = useRef<number>(1.0);

  const renderTimeoutRef = useRef<number | null>(null);

  // Fast debounced preview updater
  useEffect(() => {
    if (!sourceImage) return;

    let isMounted = true;
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = window.setTimeout(async () => {
      try {
        // Fast single preview at 120 DPI
        const singleCanvas = await renderSinglePassportCanvas(sourceImage, settings, 120);
        if (isMounted) {
          setSinglePreviewUrl(singleCanvas.toDataURL('image/jpeg', 0.85));
        }

        // Fast sheet preview at 100 DPI
        const a4Canvas = await renderA4PrintableSheetCanvas(sourceImage, settings, 100);
        if (isMounted) {
          setA4SheetPreviewUrl(a4Canvas.toDataURL('image/jpeg', 0.85));
        }
      } catch (err) {
        console.error('Error generating preview:', err);
      }
    }, 40);

    return () => {
      isMounted = false;
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [sourceImage, settings]);

  const runAutoFaceCrop = useCallback(async (imageSrc: string) => {
    setIsDetectingFace(true);
    setFaceDetectionStatus({
      type: 'detecting',
      message: language === 'hi' ? 'चेहरे का पता लगाया जा रहा है...' : 'Detecting face area for optimal passport crop...',
    });

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load image.'));
        img.src = imageSrc;
      });

      const face = await detectFace(img);
      if (face) {
        setDetectedFace(face);
        const suggestion = calculateOptimalPassportCrop(
          img.naturalWidth,
          img.naturalHeight,
          face,
          settings.photoWidthMm,
          settings.photoHeightMm
        );

        setSettings((prev) => ({
          ...prev,
          zoom: suggestion.zoom,
          cropX: suggestion.cropX,
          cropY: suggestion.cropY,
        }));

        const sourceLabel = face.source === 'ai' ? 'AI' : face.source === 'native' ? 'Biometric' : 'Smart CV';
        setFaceDetectionStatus({
          type: 'success',
          message:
            language === 'hi'
              ? `चेहरा पहचाना गया (${sourceLabel})! 70% बायोमेट्रिक पासपोर्ट क्रॉप सेट हुआ।`
              : `Face detected (${sourceLabel})! Optimal 70% ICAO passport crop applied.`,
          details: `Head Size: ~70% • Eye-line aligned • Zoom: ${Math.round(suggestion.zoom * 100)}%`,
        });
      } else {
        setDetectedFace(null);
        setFaceDetectionStatus({
          type: 'none',
          message:
            language === 'hi'
              ? 'चेहरा स्पष्ट नहीं मिला, मानक सेंटर पासपोर्ट क्रॉप रखा गया।'
              : 'Face not clearly detected. Standard centered crop retained.',
        });
      }
    } catch (err) {
      console.error('Error in face detection:', err);
      setFaceDetectionStatus({
        type: 'none',
        message:
          language === 'hi'
            ? 'ऑटो डिटेक्ट पूरा नहीं हो सका। आप स्लाइड करके पोजीशन सेट कर सकते हैं।'
            : 'Could not auto-detect. You can drag and zoom manually.',
      });
    } finally {
      setIsDetectingFace(false);
    }
  }, [language, settings.photoWidthMm, settings.photoHeightMm]);

  const handleFileUpload = (file: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    setSourceImageName(file.name.replace(/\.[^/.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSourceImage(dataUrl);
      // Automatically detect face area and suggest optimal passport crop
      runAutoFaceCrop(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const loadSamplePhoto = () => {
    const sample = createSamplePortraitDataUrl();
    setSourceImage(sample);
    setSourceImageName('Sample_Portrait');
    setSettings((prev) => ({
      ...prev,
      personName: 'AMAN CHAUHAN',
      photoDate: new Date().toLocaleDateString('en-GB'),
    }));
    runAutoFaceCrop(sample);
  };

  const handlePrint = async () => {
    if (!sourceImage) return;
    setIsGenerating(true);
    try {
      // Create high-res 300 DPI A4 canvas for studio-perfect printing
      const highResCanvas = await renderA4PrintableSheetCanvas(sourceImage, settings, 300);
      const dataUrl = highResCanvas.toDataURL('image/png');
      const printImg = document.getElementById('printable-a4-img') as HTMLImageElement;
      if (printImg) {
        printImg.src = dataUrl;
      }

      await saveToHistory({
        title: '6 Passport Photos on A4 (Print)',
        toolType: 'passport-photo',
        thumbnailUrl: a4SheetPreviewUrl || dataUrl,
        fullImageDataUrl: dataUrl,
        fileSizeText: '300 DPI A4 Sheet',
        details: 'Top 1 Row (6 Photos) • Ready for Studio Printing',
        itemCount: 6,
      });

      setTimeout(() => {
        window.print();
        setIsGenerating(false);
      }, 250);
    } catch (e) {
      console.error('Print failed', e);
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!sourceImage) return;
    setIsGenerating(true);
    try {
      const pdfBytes = await generatePassportPdf(sourceImage, settings);
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfDataUrl = URL.createObjectURL(pdfBlob);

      await saveToHistory({
        title: '6 Passport Photos A4 PDF',
        toolType: 'passport-photo',
        thumbnailUrl: a4SheetPreviewUrl || singlePreviewUrl || '',
        pdfDataUrl: pdfDataUrl,
        fileSizeText: `${(pdfBytes.byteLength / 1024).toFixed(0)} KB PDF`,
        details: '35×45mm Passport Photos • Top 1 Row on A4',
        itemCount: 6,
      });

      downloadPdfBlob(pdfBytes, `${sourceImageName}_6_passport_a4.pdf`);
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadA4Image = async () => {
    if (!sourceImage) return;
    setIsGenerating(true);
    try {
      const canvas = await renderA4PrintableSheetCanvas(sourceImage, settings, 300);
      const fullImageDataUrl = canvas.toDataURL('image/png', 0.95);

      await saveToHistory({
        title: '6 Passport Photos A4 HD Image',
        toolType: 'passport-photo',
        thumbnailUrl: a4SheetPreviewUrl || fullImageDataUrl,
        fullImageDataUrl: fullImageDataUrl,
        fileSizeText: '300 DPI HD Image',
        details: '6 Passport Photos on A4 with Cutting Marks',
        itemCount: 6,
      });

      await downloadA4SheetImage(sourceImage, settings, `${sourceImageName}_6_passport_a4`);
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadSingle = async () => {
    if (!sourceImage) return;
    if (singlePreviewUrl) {
      await saveToHistory({
        title: 'Single Passport Photo (35×45mm)',
        toolType: 'passport-photo',
        thumbnailUrl: singlePreviewUrl,
        fullImageDataUrl: singlePreviewUrl,
        fileSizeText: '35×45 mm',
        details: '1 Individual Studio Passport Photo',
        itemCount: 1,
      });
    }
    await downloadSinglePhotoFile(sourceImage, settings, `${sourceImageName}_single_passport`);
  };

  const resetAdjustments = () => {
    setSettings((prev) => ({
      ...prev,
      zoom: 1.15,
      cropX: 0,
      cropY: -5,
      rotation: 0,
      brightness: 100,
      contrast: 100,
      spacingGapMm: 1.5,
    }));
    setActiveFilterPreset('normal');
  };

  const applyFilterPreset = (preset: 'normal' | 'enhanced' | 'warm' | 'bw') => {
    setActiveFilterPreset(preset);
    if (preset === 'normal') {
      setSettings((prev) => ({ ...prev, brightness: 100, contrast: 100 }));
    } else if (preset === 'enhanced') {
      setSettings((prev) => ({ ...prev, brightness: 106, contrast: 112 }));
    } else if (preset === 'warm') {
      setSettings((prev) => ({ ...prev, brightness: 104, contrast: 105 }));
    } else if (preset === 'bw') {
      setSettings((prev) => ({ ...prev, brightness: 102, contrast: 120 }));
    }
  };

  // Direct Interactive Pan & Slide Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {}
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cropX: settings.cropX,
      cropY: settings.cropY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    // Fluid sensitivity: dragging slides photo smoothly
    const newX = Math.min(40, Math.max(-40, Math.round(dragStartRef.current.cropX + dx * 0.35)));
    const newY = Math.min(40, Math.max(-40, Math.round(dragStartRef.current.cropY + dy * 0.35)));
    setSettings((prev) => ({ ...prev, cropX: newX, cropY: newY }));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDragging(false);
    dragStartRef.current = null;
  };

  // Multi-touch Pinch to Zoom
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchStartDistRef.current = dist;
      pinchStartZoomRef.current = settings.zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      if (e.cancelable) e.preventDefault();
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const scale = dist / pinchStartDistRef.current;
      const newZoom = Math.min(3.0, Math.max(0.8, Number((pinchStartZoomRef.current * scale).toFixed(2))));
      setSettings((prev) => ({ ...prev, zoom: newZoom }));
    }
  };

  const handleTouchEnd = () => {
    pinchStartDistRef.current = null;
  };

  // Mouse Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.05 : -0.05;
    const newZoom = Math.min(3.0, Math.max(0.8, Number((settings.zoom + delta).toFixed(2))));
    setSettings((prev) => ({ ...prev, zoom: newZoom }));
  };

  // Step Zoom helpers
  const handleZoomStep = (delta: number) => {
    const newZoom = Math.min(3.0, Math.max(0.8, Number((settings.zoom + delta).toFixed(2))));
    setSettings((prev) => ({ ...prev, zoom: newZoom }));
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Notice */}
      <div className="bg-gradient-to-r from-amber-950/70 via-slate-900 to-orange-950/70 border border-amber-500/30 rounded-2xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold border border-amber-500/30 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              {language === 'hi' ? 'टॉप 6 फोटो 1 लाइन (समान गैप + कैंची कट्स)' : 'Top 6 in 1 Row (Equal Gaps + Scissor Marks)'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white mt-1 flex items-center gap-2">
            <UserSquare2 className="w-6 h-6 text-amber-400" />
            {t.tabPassportPhoto}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            {language === 'hi'
              ? 'A4 साइज पेज के सबसे ऊपर 6 पासपोर्ट फोटो बिल्कुल बराबर गैप और साफ़ कटिंग मार्क्स के साथ। नीचे का पूरा पेज खाली और सुरक्षित रहेगा!'
              : '6 passport photos aligned seamlessly across the top of A4 with identical edge and inter-photo spacing. The rest of the page remains 100% clean.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!sourceImage && (
            <button
              id="try-sample-passport-btn"
              onClick={loadSamplePhoto}
              className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs sm:text-sm font-bold flex items-center gap-2 transition-all shadow-md hover:scale-[1.02]"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>{language === 'hi' ? '⚡ टेस्ट सैंपल फोटो लोड करें' : '⚡ Load Sample Photo'}</span>
            </button>
          )}
          {sourceImage && (
            <button
              onClick={() => {
                setSourceImage(null);
                setSinglePreviewUrl(null);
                setA4SheetPreviewUrl(null);
              }}
              className="px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors flex items-center gap-1.5 shadow"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
              <span>{language === 'hi' ? 'दूसरी फोटो चुनें' : 'Change Photo'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Upload Box (When no photo chosen) */}
      {!sourceImage && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
              handleFileUpload(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-slate-700/80 bg-slate-900/50 hover:bg-slate-900/80 hover:border-amber-500/60 rounded-3xl p-8 sm:p-14 text-center cursor-pointer transition-all shadow-2xl group"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
          <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-2xl bg-amber-600/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4 shadow-inner group-hover:scale-105 transition-transform">
            <UserSquare2 className="w-8 h-8 sm:w-10 sm:h-10" />
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mb-1">
            {t.uploadPassportPhoto}
          </h3>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto mb-5">
            {t.uploadPassportPhotoSub}
          </p>
          <button
            type="button"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white text-sm font-extrabold shadow-lg shadow-amber-600/30 transition-all inline-flex items-center gap-2 group-hover:shadow-amber-600/50"
          >
            <Upload className="w-4 h-4" />
            {t.selectPassportPhotoBtn}
          </button>
        </div>
      )}

      {/* Editor & A4 Sheet Preview */}
      {sourceImage && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Adjustments & Controls */}
          <div className="lg:col-span-5 space-y-4">
            {/* Single Photo Studio Crop Box */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl backdrop-blur-sm">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Crop className="w-4 h-4 text-amber-400 shrink-0" />
                  <span className="font-bold text-white text-sm truncate">
                    {language === 'hi' ? 'सिंगल पासपोर्ट फोटो प्रीव्यू (3.5 × 4.5 cm)' : 'Single Passport Preview (3.5 × 4.5 cm)'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => sourceImage && runAutoFaceCrop(sourceImage)}
                    disabled={isDetectingFace}
                    className="text-xs px-2.5 py-1 rounded-lg border font-bold transition-all bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-200 border-amber-500/40 flex items-center gap-1.5 shadow-sm disabled:opacity-50 hover:scale-105 active:scale-95"
                    title={language === 'hi' ? 'चेहरे को ऑटो-डिटेक्ट कर पासपोर्ट साइज के लिए ऑप्टिमल क्रॉप सेट करें' : 'Automatically detect face area and crop to optimal passport size'}
                  >
                    {isDetectingFace ? (
                      <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    )}
                    <span>{isDetectingFace ? (language === 'hi' ? 'डिटेक्ट हो रहा...' : 'Detecting...') : (language === 'hi' ? '✨ ऑटो फेस क्रॉप' : '✨ Auto Face Crop')}</span>
                  </button>

                  <button
                    onClick={() => setShowFaceGuide(!showFaceGuide)}
                    className={`text-xs px-2.5 py-1 rounded-lg border font-semibold transition-colors ${
                      showFaceGuide
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                    title="Toggle Face Alignment Oval"
                  >
                    {showFaceGuide ? '🎯 गाइड चालू' : 'गाइड बंद'}
                  </button>
                </div>
              </div>

              {/* Crop Frame Box with Direct Touch & Mouse Slide Gestures */}
              <div className="space-y-2">
                <div
                  ref={cropBoxRef}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerCancel={handlePointerUp}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onWheel={handleWheel}
                  className={`relative w-48 sm:w-56 aspect-[3.5/4.5] mx-auto bg-slate-950 rounded-xl overflow-hidden border-2 shadow-2xl flex items-center justify-center select-none touch-none transition-shadow ${
                    isDragging
                      ? 'cursor-grabbing border-amber-400 ring-4 ring-amber-500/30'
                      : 'cursor-grab border-amber-500/70 hover:border-amber-400'
                  }`}
                  title={language === 'hi' ? 'फोटो पर उंगली/माउस से स्लाइड करके पोजीशन बदलें, पिंच या स्क्रॉल से ज़ूम करें' : 'Slide/drag photo to reposition, pinch or scroll to zoom'}
                >
                  {singlePreviewUrl ? (
                    <img
                      src={singlePreviewUrl}
                      alt="Passport Preview"
                      draggable={false}
                      className="w-full h-full object-contain pointer-events-none select-none"
                    />
                  ) : (
                    <div className="text-xs text-slate-500">Generating...</div>
                  )}

                  {/* Face scanning radar overlay */}
                  {isDetectingFace && (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-20 pointer-events-none">
                      <div className="relative w-24 h-28 rounded-3xl border-2 border-dashed border-amber-400/80 flex items-center justify-center animate-pulse">
                        <ScanFace className="w-10 h-10 text-amber-400/90" />
                        <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-amber-300 to-transparent top-1/2 -translate-y-1/2 animate-bounce" />
                      </div>
                      <span className="text-[10px] font-bold text-amber-300 bg-slate-950/90 px-2 py-0.5 rounded-full border border-amber-500/40">
                        {language === 'hi' ? 'चेहरे का पता लगाया जा रहा है...' : 'Scanning face area...'}
                      </span>
                    </div>
                  )}

                  {/* Face Guidelines Overlay */}
                  {showFaceGuide && (
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center p-2">
                      {/* Head Oval Guide */}
                      <div className="w-[64%] h-[70%] -mt-3 rounded-full border-2 border-dashed border-amber-400/80 shadow-sm relative">
                        {/* Eye level line */}
                        <div className="absolute top-[48%] left-0 right-0 border-t border-dashed border-cyan-400/80" />
                        {/* Vertical center */}
                        <div className="absolute left-[50%] top-0 bottom-0 border-l border-dashed border-cyan-400/50" />
                      </div>
                    </div>
                  )}

                  {/* Interactive Floating Quick Zoom Buttons */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleZoomStep(0.1);
                      }}
                      className="w-7 h-7 rounded-lg bg-slate-900/85 hover:bg-amber-600 text-white border border-slate-700/80 shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 text-xs font-bold"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleZoomStep(-0.1);
                      }}
                      className="w-7 h-7 rounded-lg bg-slate-900/85 hover:bg-amber-600 text-white border border-slate-700/80 shadow-md flex items-center justify-center transition-all hover:scale-110 active:scale-95 text-xs font-bold"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Live Drag/Slide Status Pill */}
                  <div className="absolute bottom-2 inset-x-2 flex items-center justify-center pointer-events-none">
                    <span className="px-2 py-0.5 rounded-full bg-slate-950/85 backdrop-blur-md text-[10px] text-amber-300 font-semibold border border-amber-500/30 shadow-lg flex items-center gap-1">
                      <Hand className="w-3 h-3 text-amber-400 animate-pulse" />
                      {isDragging
                        ? `X: ${settings.cropX > 0 ? '+' : ''}${settings.cropX}% | Y: ${settings.cropY > 0 ? '+' : ''}${settings.cropY}%`
                        : language === 'hi'
                        ? 'स्लाइड करके एडजस्ट करें'
                        : 'Slide to reposition'}
                    </span>
                  </div>
                </div>

                {/* Face Detection Status Banner */}
                {faceDetectionStatus && (
                  <div
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 transition-all ${
                      faceDetectionStatus.type === 'success'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : faceDetectionStatus.type === 'detecting'
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                        : 'bg-slate-900 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {faceDetectionStatus.type === 'success' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : faceDetectionStatus.type === 'detecting' ? (
                        <Loader2 className="w-4 h-4 text-amber-400 animate-spin shrink-0" />
                      ) : (
                        <ScanFace className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="font-semibold text-[11px] truncate leading-tight">
                          {faceDetectionStatus.message}
                        </p>
                        {faceDetectionStatus.details && (
                          <p className="text-[10px] text-emerald-300/80 truncate">
                            {faceDetectionStatus.details}
                          </p>
                        )}
                      </div>
                    </div>

                    {faceDetectionStatus.type === 'success' && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-300" />
                        ICAO 70%
                      </span>
                    )}
                  </div>
                )}

                {/* Direct Slide-to-Zoom Bar */}
                <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <ZoomIn className="w-3.5 h-3.5" />
                      {language === 'hi' ? 'स्लाइड से ज़ूम इन / ज़ूम आउट' : 'Slide to Zoom In / Out'}
                    </span>
                    <span className="text-amber-400 font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      {Math.round(settings.zoom * 100)}%
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleZoomStep(-0.05)}
                      className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:text-white transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>

                    <input
                      type="range"
                      min="0.8"
                      max="3.0"
                      step="0.02"
                      value={settings.zoom}
                      onChange={(e) =>
                        setSettings({ ...settings, zoom: parseFloat(e.target.value) })
                      }
                      className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500 transition-all hover:bg-slate-700"
                    />

                    <button
                      type="button"
                      onClick={() => handleZoomStep(0.05)}
                      className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 hover:text-white transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span>{language === 'hi' ? 'ज़ूम आउट (80%)' : 'Zoom Out (80%)'}</span>
                    <span className="text-slate-500">{language === 'hi' ? '• माउस स्क्रॉल या पिंच भी काम करता है •' : '• Pinch & Scroll also work •'}</span>
                    <span>{language === 'hi' ? 'ज़ूम इन (300%)' : 'Zoom In (300%)'}</span>
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-300 text-center bg-slate-950/80 p-2 rounded-lg border border-slate-800">
                {t.faceGuideTip}
              </p>

              {/* Quick Studio Filter Presets */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Wand2 className="w-3 h-3 text-amber-400" />
                  {language === 'hi' ? 'स्टूडियो फ़िल्टर' : 'Studio Enhancements'}
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { id: 'normal', label: language === 'hi' ? 'सामान्य' : 'Normal' },
                    { id: 'enhanced', label: language === 'hi' ? 'ब्राइट' : 'Bright' },
                    { id: 'warm', label: language === 'hi' ? 'वॉर्म' : 'Warm' },
                    { id: 'bw', label: language === 'hi' ? 'B & W' : 'B&W' },
                  ].map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyFilterPreset(preset.id as any)}
                      className={`py-1 px-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        activeFilterPreset === preset.id
                          ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders Accordion */}
              <div className="space-y-3 pt-1">
                {/* Zoom */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <ZoomIn className="w-3.5 h-3.5 text-amber-400" />
                      {t.zoom}
                    </span>
                    <span className="text-amber-400 font-mono">
                      {Math.round(settings.zoom * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.8"
                    max="3.0"
                    step="0.05"
                    value={settings.zoom}
                    onChange={(e) =>
                      setSettings({ ...settings, zoom: parseFloat(e.target.value) })
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                </div>

                {/* Move Left / Right (X) */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Move className="w-3.5 h-3.5 text-blue-400" />
                      {t.moveLeftRight}
                    </span>
                    <span className="text-slate-400 font-mono">{settings.cropX}%</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={settings.cropX}
                    onChange={(e) =>
                      setSettings({ ...settings, cropX: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                </div>

                {/* Move Up / Down (Y) */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <Move className="w-3.5 h-3.5 text-cyan-400" />
                      {t.moveUpDown}
                    </span>
                    <span className="text-slate-400 font-mono">{settings.cropY}%</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    step="1"
                    value={settings.cropY}
                    onChange={(e) =>
                      setSettings({ ...settings, cropY: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                </div>

                {/* Rotation */}
                <div>
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
                    <span className="flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-emerald-400" />
                      {t.rotate}
                    </span>
                    <span className="text-slate-400 font-mono">{settings.rotation}°</span>
                  </div>
                  <input
                    type="range"
                    min="-45"
                    max="45"
                    step="1"
                    value={settings.rotation}
                    onChange={(e) =>
                      setSettings({ ...settings, rotation: parseInt(e.target.value, 10) })
                    }
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                  />
                </div>

                {/* Brightness & Contrast 2-col */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span className="flex items-center gap-1">
                        <Sun className="w-3 h-3 text-amber-400" />
                        {t.brightness}
                      </span>
                      <span className="text-slate-400">{settings.brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="140"
                      step="2"
                      value={settings.brightness}
                      onChange={(e) =>
                        setSettings({ ...settings, brightness: parseInt(e.target.value, 10) })
                      }
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-300 mb-1">
                      <span className="flex items-center gap-1">
                        <Contrast className="w-3 h-3 text-indigo-400" />
                        {t.contrast}
                      </span>
                      <span className="text-slate-400">{settings.contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min="70"
                      max="140"
                      step="2"
                      value={settings.contrast}
                      onChange={(e) =>
                        setSettings({ ...settings, contrast: parseInt(e.target.value, 10) })
                      }
                      className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                    />
                  </div>
                </div>

                {/* Reset button */}
                <div className="pt-1">
                  <button
                    onClick={resetAdjustments}
                    className="w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold transition-colors"
                  >
                    {language === 'hi' ? 'एडजस्टमेंट रीसेट करें' : 'Reset Sliders'}
                  </button>
                </div>
              </div>
            </div>

            {/* Studio Options (Equal Spacing, Borders, Name & Date) */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 font-bold text-white text-sm pb-2 border-b border-slate-800">
                <Sliders className="w-4 h-4 text-amber-400" />
                <span>{language === 'hi' ? 'स्पेसिंग व प्रिंट ऑप्शन्स' : 'Spacing & Print Options'}</span>
              </div>

              {/* Uniform Equal Gap Slider Control */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Grid className="w-3.5 h-3.5 text-amber-400" />
                    {language === 'hi' ? 'समान गैप (Equal Gap: First = Middle = Last)' : 'Uniform Spacing Gap'}
                  </span>
                  <span className="text-amber-400 font-mono font-bold">
                    {settings.spacingGapMm?.toFixed(1) || '1.5'} mm
                  </span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="3.0"
                  step="0.1"
                  value={settings.spacingGapMm ?? 1.5}
                  onChange={(e) =>
                    setSettings({ ...settings, spacingGapMm: parseFloat(e.target.value) })
                  }
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span>{language === 'hi' ? 'तंग (0.8mm)' : 'Compact (0.8mm)'}</span>
                  <span className="text-amber-300 font-medium">{language === 'hi' ? '✓ तीनों जगह 100% समान' : '✓ 100% Equal Gaps'}</span>
                  <span>{language === 'hi' ? 'खुला (3.0mm)' : 'Spaced (3.0mm)'}</span>
                </div>
              </div>

              {/* Border Toggle */}
              <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700">
                <span className="text-xs font-semibold text-slate-200">
                  {t.borderOption}
                </span>
                <input
                  type="checkbox"
                  checked={settings.hasBorder}
                  onChange={(e) => setSettings({ ...settings, hasBorder: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-600 bg-slate-900 border-slate-700 focus:ring-amber-500"
                />
              </label>

              {/* Scissor Cutting Marks */}
              <label className="flex items-center justify-between cursor-pointer p-2.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700">
                <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Scissors className="w-3.5 h-3.5 text-amber-400" />
                  {t.cuttingMarks}
                </span>
                <input
                  type="checkbox"
                  checked={settings.hasCuttingMarks}
                  onChange={(e) =>
                    setSettings({ ...settings, hasCuttingMarks: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-amber-600 bg-slate-900 border-slate-700 focus:ring-amber-500"
                />
              </label>

              {/* Name & Date Badge */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                    <Type className="w-3.5 h-3.5 text-cyan-400" />
                    {t.addNameDate}
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.hasNameDate}
                    onChange={(e) =>
                      setSettings({ ...settings, hasNameDate: e.target.checked })
                    }
                    className="w-4 h-4 rounded text-amber-600 bg-slate-900 border-slate-700 focus:ring-amber-500"
                  />
                </label>

                {settings.hasNameDate && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        {language === 'hi' ? 'नाम (Name)' : 'Name'}
                      </label>
                      <input
                        type="text"
                        value={settings.personName}
                        onChange={(e) =>
                          setSettings({ ...settings, personName: e.target.value })
                        }
                        placeholder={t.personNamePlaceholder}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white uppercase outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-400 mb-1">
                        {language === 'hi' ? 'तारीख (Date)' : 'Date'}
                      </label>
                      <input
                        type="text"
                        value={settings.photoDate}
                        onChange={(e) =>
                          setSettings({ ...settings, photoDate: e.target.value })
                        }
                        placeholder={t.photoDatePlaceholder}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Layout Mode Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  {t.layoutMode}
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'top-6-a4', label: t.layoutTop6, desc: '6 Photos across Top row of A4' },
                    { id: 'top-12-a4', label: t.layoutTop12, desc: '12 Photos (2 rows of 6)' },
                    { id: 'full-a4', label: t.layoutFull30, desc: '30 Photos on full A4 sheet' },
                    { id: 'photo-4x6', label: t.layout4x6, desc: '8 Photos on 4x6" photo card' },
                    { id: 'single', label: t.layoutSingle, desc: '1 Single photo (3.5x4.5cm)' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          layout: item.id as PassportLayoutMode,
                        })
                      }
                      className={`w-full p-2.5 rounded-xl text-left border flex items-center justify-between transition-all ${
                        settings.layout === item.id
                          ? 'bg-amber-600/20 border-amber-500 text-white shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        <p className="text-xs font-bold">{item.label}</p>
                        <p className="text-[10px] text-slate-400">{item.desc}</p>
                      </div>
                      {settings.layout === item.id && (
                        <CheckCircle2 className="w-4 h-4 text-amber-400" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Live A4 Printable Sheet Preview & Action Bar */}
          <div className="lg:col-span-7 space-y-4">
            {/* Top Action Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <h3 className="font-extrabold text-white text-base sm:text-lg flex items-center gap-2">
                    <Printer className="w-5 h-5 text-amber-400" />
                    {t.previewA4Sheet}
                  </h3>
                  <p className="text-xs text-amber-300 font-semibold mt-0.5">
                    {language === 'hi'
                      ? '✓ 6 पासपोर्ट फोटो टॉप लाइन में तैयार हैं (समान गैप + 100% ट्रू स्केल 3.5×4.5cm)'
                      : '✓ Top 6 Passport Photos in 1 row ready on A4 (Equal Gaps + 100% Scale 3.5×4.5cm)'}
                  </p>
                </div>

                {/* Direct Print Button */}
                <button
                  id="direct-print-passport-btn"
                  onClick={handlePrint}
                  disabled={isGenerating}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-500 hover:to-orange-500 text-white font-black text-sm shadow-xl shadow-amber-600/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50 hover:scale-[1.02]"
                >
                  <Printer className="w-4 h-4" />
                  <span>{t.printDirectBtn}</span>
                </button>
              </div>

              {/* Download Buttons Group */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-3.5">
                <button
                  id="download-a4-pdf-btn"
                  onClick={handleDownloadPdf}
                  disabled={isGenerating}
                  className="p-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 hover:border-blue-400"
                >
                  <FileDown className="w-4 h-4 text-blue-400" />
                  <span>{t.downloadA4Pdf}</span>
                </button>

                <button
                  id="download-a4-image-btn"
                  onClick={handleDownloadA4Image}
                  disabled={isGenerating}
                  className="p-3 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 hover:border-emerald-400"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>{t.downloadA4Image}</span>
                </button>

                <button
                  id="download-single-photo-btn"
                  onClick={handleDownloadSingle}
                  disabled={isGenerating}
                  className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 hover:border-slate-500"
                >
                  <UserSquare2 className="w-4 h-4 text-amber-400" />
                  <span>{t.downloadSinglePhoto}</span>
                </button>
              </div>
            </div>

            {/* A4 Paper Virtual Preview Canvas Frame */}
            <div className="bg-slate-950 border border-slate-800/90 rounded-2xl p-4 sm:p-6 flex flex-col items-center justify-center shadow-2xl overflow-hidden">
              <div className="w-full max-w-[480px] bg-white rounded-lg shadow-2xl overflow-hidden aspect-[210/297] relative border border-slate-300 flex items-center justify-center">
                {a4SheetPreviewUrl ? (
                  <img
                    src={a4SheetPreviewUrl}
                    alt="A4 Live Sheet"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="text-xs text-slate-400 animate-pulse">
                    Rendering A4 Preview...
                  </div>
                )}
              </div>

              <div className="mt-3 text-center text-xs text-slate-400 max-w-md">
                <span>{language === 'hi' ? '📄 स्टैंडर्ड A4 पेपर (210 × 297 mm) • प्रिंटिंग के समय "Fit to Page" के बजाय "100% / Actual Size" चुनें।' : '📄 Standard A4 Paper (210 × 297 mm) • Choose "100% / Actual Size" in print settings for exact 3.5×4.5cm photos.'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden container specifically rendered for window.print() */}
      <div id="printable-a4-sheet" className="hidden print:block">
        {a4SheetPreviewUrl && (
          <img
            id="printable-a4-img"
            src={a4SheetPreviewUrl}
            alt="Printable A4 Sheet"
            className="w-full h-full object-contain"
          />
        )}
      </div>
    </div>
  );
};
