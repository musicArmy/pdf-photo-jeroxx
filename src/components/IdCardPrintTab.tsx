import React, { useState, useEffect, useRef } from 'react';
import { IdCardPrintSettings, IdCardSideSettings, Language, CardColorMode } from '../types';
import { translations } from '../utils/i18n';
import {
  DEFAULT_ID_CARD_SETTINGS,
  renderSingleCardCanvas,
  renderIdCardA4SheetCanvas,
  generateIdCardPdf,
} from '../utils/idCardGenerator';
import { downloadPdfBlob } from '../utils/imageToPdf';
import {
  createSampleAadhaarFront,
  createSampleAadhaarBack,
  createSampleCustomer2Front,
  createSampleCustomer2Back,
} from '../utils/sampleData';
import { saveToHistory } from '../utils/historyStorage';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  Upload,
  Printer,
  FileDown,
  Download,
  Sparkles,
  RotateCw,
  Sun,
  Contrast,
  Trash2,
  ZoomIn,
  Layers,
  Palette,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Sparkle,
  Users,
  User,
  Copy,
  PlusCircle,
  Eye,
} from 'lucide-react';

interface IdCardPrintTabProps {
  language: Language;
}

type ActiveCustomer = 'customer1' | 'customer2' | 'both';

export const IdCardPrintTab: React.FC<IdCardPrintTabProps> = ({ language }) => {
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const front2InputRef = useRef<HTMLInputElement>(null);
  const back2InputRef = useRef<HTMLInputElement>(null);

  const [settings, setSettings] = useState<IdCardPrintSettings>(DEFAULT_ID_CARD_SETTINGS);
  const [a4PreviewUrl, setA4PreviewUrl] = useState<string | null>(null);
  const [frontPreviewUrl, setFrontPreviewUrl] = useState<string | null>(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null);
  const [front2PreviewUrl, setFront2PreviewUrl] = useState<string | null>(null);
  const [back2PreviewUrl, setBack2PreviewUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeCustomerTab, setActiveCustomerTab] = useState<ActiveCustomer>('customer1');

  const renderTimeoutRef = useRef<number | null>(null);

  // Fast live preview rendering with debounce
  useEffect(() => {
    let isMounted = true;
    if (renderTimeoutRef.current) {
      clearTimeout(renderTimeoutRef.current);
    }

    renderTimeoutRef.current = window.setTimeout(async () => {
      try {
        // Fast A4 preview at 100 DPI
        const a4Canvas = await renderIdCardA4SheetCanvas(settings, 100);
        if (isMounted) {
          setA4PreviewUrl(a4Canvas.toDataURL('image/jpeg', 0.85));
        }

        // Fast Customer 1 Front Card preview
        if (settings.front.dataUrl) {
          const frontCanvas = await renderSingleCardCanvas(settings.front, 85.6, 54.0, 100);
          if (isMounted) setFrontPreviewUrl(frontCanvas.toDataURL('image/jpeg', 0.85));
        } else {
          if (isMounted) setFrontPreviewUrl(null);
        }

        // Fast Customer 1 Back Card preview
        if (settings.back.dataUrl) {
          const backCanvas = await renderSingleCardCanvas(settings.back, 85.6, 54.0, 100);
          if (isMounted) setBackPreviewUrl(backCanvas.toDataURL('image/jpeg', 0.85));
        } else {
          if (isMounted) setBackPreviewUrl(null);
        }

        // Fast Customer 2 Front Card preview
        if (settings.front2?.dataUrl) {
          const front2Canvas = await renderSingleCardCanvas(settings.front2, 85.6, 54.0, 100);
          if (isMounted) setFront2PreviewUrl(front2Canvas.toDataURL('image/jpeg', 0.85));
        } else {
          if (isMounted) setFront2PreviewUrl(null);
        }

        // Fast Customer 2 Back Card preview
        if (settings.back2?.dataUrl) {
          const back2Canvas = await renderSingleCardCanvas(settings.back2, 85.6, 54.0, 100);
          if (isMounted) setBack2PreviewUrl(back2Canvas.toDataURL('image/jpeg', 0.85));
        } else {
          if (isMounted) setBack2PreviewUrl(null);
        }
      } catch (err) {
        console.error('Error generating ID card preview:', err);
      }
    }, 40);

    return () => {
      isMounted = false;
      if (renderTimeoutRef.current) {
        clearTimeout(renderTimeoutRef.current);
      }
    };
  }, [settings]);

  const handleFileUpload = (
    file: File,
    side: 'front' | 'back' | 'front2' | 'back2'
  ) => {
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setSettings((prev) => {
        const targetSide = prev[side] || {
          dataUrl: null,
          name: '',
          zoom: 1.0,
          cropX: 0,
          cropY: 0,
          rotation: 0,
          brightness: 100,
          contrast: 100,
          colorMode: 'original',
          positionXmm: 0,
          positionYmm: 0,
        };

        // If uploading for customer 2, auto-ensure dual copy mode is set to different-person
        const nextDualMode =
          (side === 'front2' || side === 'back2') && prev.layout === 'dual-copy'
            ? 'different-person'
            : prev.dualCopyMode;

        return {
          ...prev,
          dualCopyMode: nextDualMode,
          [side]: {
            ...targetSide,
            dataUrl,
            name: file.name.replace(/\.[^/.]+$/, ''),
            zoom: 1.0,
            cropX: 0,
            cropY: 0,
            rotation: 0,
            positionXmm: 0,
            positionYmm: 0,
          },
        };
      });
    };
    reader.readAsDataURL(file);
  };

  const loadSampleCustomer1 = () => {
    const frontUrl = createSampleAadhaarFront();
    const backUrl = createSampleAadhaarBack();
    setSettings((prev) => ({
      ...prev,
      front: {
        ...prev.front,
        dataUrl: frontUrl,
        name: 'Aadhaar_Front',
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
        ...prev.back,
        dataUrl: backUrl,
        name: 'Aadhaar_Back',
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
    }));
  };

  const loadSampleCustomer2 = () => {
    const front2Url = createSampleCustomer2Front();
    const back2Url = createSampleCustomer2Back();
    setSettings((prev) => ({
      ...prev,
      layout: 'dual-copy',
      dualCopyMode: 'different-person',
      front2: {
        ...(prev.front2 || DEFAULT_ID_CARD_SETTINGS.front2!),
        dataUrl: front2Url,
        name: 'Customer2_PAN_Front',
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
        ...(prev.back2 || DEFAULT_ID_CARD_SETTINGS.back2!),
        dataUrl: back2Url,
        name: 'Customer2_PAN_Back',
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
    }));
    setActiveCustomerTab('customer2');
  };

  const loadAllSamples = () => {
    loadSampleCustomer1();
    loadSampleCustomer2();
  };

  const handlePrint = async () => {
    if (!settings.front.dataUrl && !settings.back.dataUrl) return;
    setIsGenerating(true);
    try {
      const highResCanvas = await renderIdCardA4SheetCanvas(settings, 300);
      const dataUrl = highResCanvas.toDataURL('image/png');
      const printImg = document.getElementById('printable-a4-img') as HTMLImageElement;
      if (printImg) {
        printImg.src = dataUrl;
      }

      // Save to persistent history
      await saveToHistory({
        title: 'Aadhaar / ID Card A4 Sheet',
        toolType: 'id-card-print',
        thumbnailUrl: a4PreviewUrl || dataUrl,
        fullImageDataUrl: dataUrl,
        fileSizeText: '300 DPI A4',
        details: `${settings.layout === 'dual-copy' ? (settings.dualCopyMode === 'different-person' ? '2 Different Customers on 1 A4' : '2 Sets Dual Copy') : 'Standard Xerox Layout'} • High Quality Print`,
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
    if (!settings.front.dataUrl && !settings.back.dataUrl) return;
    setIsGenerating(true);
    try {
      const pdfBytes = await generateIdCardPdf(settings);
      const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfDataUrl = URL.createObjectURL(pdfBlob);

      // Save to persistent history
      await saveToHistory({
        title: 'Aadhaar / ID Card A4 Print PDF',
        toolType: 'id-card-print',
        thumbnailUrl: a4PreviewUrl || settings.front.dataUrl || '',
        pdfDataUrl: pdfDataUrl,
        fileSizeText: `${(pdfBytes.byteLength / 1024).toFixed(0)} KB PDF`,
        details: `A4 Printable Document • ${settings.layout === 'dual-copy' ? (settings.dualCopyMode === 'different-person' ? '2 Different People' : '2 Sets') : 'Single Set'}`,
      });

      downloadPdfBlob(pdfBytes, 'aadhaar_id_card_a4_print.pdf');
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch (e) {
      console.error('PDF generation error', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadImage = async (is4K: boolean = false) => {
    if (!settings.front.dataUrl && !settings.back.dataUrl) return;
    setIsGenerating(true);
    try {
      const dpi = is4K ? 350 : 300;
      const fileName = is4K ? 'aadhaar_id_card_a4_4k_ultra_hd' : 'aadhaar_id_card_a4_print';
      const canvas = await renderIdCardA4SheetCanvas(settings, dpi);
      const fullImageDataUrl = canvas.toDataURL('image/png', 0.95);

      // Save to persistent history
      await saveToHistory({
        title: is4K ? 'Aadhaar Card 4K Ultra HD A4' : 'Aadhaar Card A4 Sheet',
        toolType: 'id-card-print',
        thumbnailUrl: a4PreviewUrl || fullImageDataUrl,
        fullImageDataUrl: fullImageDataUrl,
        fileSizeText: `${dpi} DPI HD`,
        details: `${is4K ? '4K Ultra High Definition' : 'Studio Print'} • ${settings.layout === 'dual-copy' ? '2 Copies' : '1 Copy'}`,
      });

      const link = document.createElement('a');
      link.download = `${fileName}.png`;
      link.href = fullImageDataUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch (e) {
      console.error('Image download error', e);
    } finally {
      setIsGenerating(false);
    }
  };

  const updateSideSetting = (
    side: 'front' | 'back' | 'front2' | 'back2',
    key: keyof IdCardSideSettings,
    value: any
  ) => {
    setSettings((prev) => {
      const target = prev[side] || {
        dataUrl: null,
        name: '',
        zoom: 1.0,
        cropX: 0,
        cropY: 0,
        rotation: 0,
        brightness: 100,
        contrast: 100,
        colorMode: 'original',
        positionXmm: 0,
        positionYmm: 0,
      };
      return {
        ...prev,
        [side]: {
          ...target,
          [key]: value,
        },
      };
    });
  };

  const nudgeSidePosition = (
    side: 'front' | 'back' | 'front2' | 'back2',
    axis: 'positionXmm' | 'positionYmm',
    delta: number
  ) => {
    setSettings((prev) => {
      const target = prev[side] || {
        dataUrl: null,
        name: '',
        zoom: 1.0,
        cropX: 0,
        cropY: 0,
        rotation: 0,
        brightness: 100,
        contrast: 100,
        colorMode: 'original',
        positionXmm: 0,
        positionYmm: 0,
      };
      const current = target[axis] || 0;
      return {
        ...prev,
        [side]: {
          ...target,
          [axis]: current + delta,
        },
      };
    });
  };

  const rotateSide = (side: 'front' | 'back' | 'front2' | 'back2') => {
    setSettings((prev) => {
      const target = prev[side] || {
        dataUrl: null,
        name: '',
        zoom: 1.0,
        cropX: 0,
        cropY: 0,
        rotation: 0,
        brightness: 100,
        contrast: 100,
        colorMode: 'original',
        positionXmm: 0,
        positionYmm: 0,
      };
      return {
        ...prev,
        [side]: {
          ...target,
          rotation: (target.rotation + 90) % 360,
        },
      };
    });
  };

  const removeSideImage = (side: 'front' | 'back' | 'front2' | 'back2') => {
    setSettings((prev) => {
      const target = prev[side] || {
        dataUrl: null,
        name: '',
        zoom: 1.0,
        cropX: 0,
        cropY: 0,
        rotation: 0,
        brightness: 100,
        contrast: 100,
        colorMode: 'original',
        positionXmm: 0,
        positionYmm: 0,
      };
      return {
        ...prev,
        [side]: {
          ...target,
          dataUrl: null,
          zoom: 1.0,
          cropX: 0,
          cropY: 0,
          rotation: 0,
          positionXmm: 0,
          positionYmm: 0,
        },
      };
    });
  };

  const setGlobalColorMode = (mode: CardColorMode) => {
    setSettings((prev) => ({
      ...prev,
      front: { ...prev.front, colorMode: mode },
      back: { ...prev.back, colorMode: mode },
      front2: prev.front2 ? { ...prev.front2, colorMode: mode } : undefined,
      back2: prev.back2 ? { ...prev.back2, colorMode: mode } : undefined,
    }));
  };

  const hasAnyImage = Boolean(
    settings.front.dataUrl ||
    settings.back.dataUrl ||
    settings.front2?.dataUrl ||
    settings.back2?.dataUrl
  );

  const isDualCopyMode = settings.layout === 'dual-copy';
  const isDifferentPerson = isDualCopyMode && settings.dualCopyMode === 'different-person';

  // Helper render for single card editor box
  const renderCardUploadBox = (
    sideKey: 'front' | 'back' | 'front2' | 'back2',
    inputRef: React.RefObject<HTMLInputElement>,
    sideNumber: number,
    label: string,
    colorAccent: 'blue' | 'emerald' | 'purple' | 'amber',
    sideSettings?: IdCardSideSettings,
    previewUrl?: string | null
  ) => {
    const currentSide = sideSettings || {
      dataUrl: null,
      name: '',
      zoom: 1.0,
      cropX: 0,
      cropY: 0,
      rotation: 0,
      brightness: 100,
      contrast: 100,
      colorMode: 'original',
      positionXmm: 0,
      positionYmm: 0,
    };

    const colorBadgeClass = {
      blue: 'bg-blue-500/20 text-blue-400',
      emerald: 'bg-emerald-500/20 text-emerald-400',
      purple: 'bg-purple-500/20 text-purple-400',
      amber: 'bg-amber-500/20 text-amber-400',
    }[colorAccent];

    const borderColorClass = {
      blue: 'border-blue-500/40',
      emerald: 'border-emerald-500/40',
      purple: 'border-purple-500/40',
      amber: 'border-amber-500/40',
    }[colorAccent];

    const accentTextClass = {
      blue: 'text-blue-400',
      emerald: 'text-emerald-400',
      purple: 'text-purple-400',
      amber: 'text-amber-400',
    }[colorAccent];

    const accentSliderClass = {
      blue: 'accent-blue-500',
      emerald: 'accent-emerald-500',
      purple: 'accent-purple-500',
      amber: 'accent-amber-500',
    }[colorAccent];

    return (
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg ${colorBadgeClass} flex items-center justify-center font-bold text-xs`}>
              {sideNumber}
            </div>
            <span className="font-bold text-sm text-white">
              {label}
            </span>
          </div>
          {currentSide.dataUrl && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => rotateSide(sideKey)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors text-xs flex items-center gap-1"
                title="Rotate 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{currentSide.rotation}°</span>
              </button>
              <button
                onClick={() => removeSideImage(sideKey)}
                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                title="Remove"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {currentSide.dataUrl ? (
          <div className="space-y-3">
            {/* Preview Thumbnail */}
            <div className={`relative aspect-[85.6/54] bg-slate-950 rounded-xl overflow-hidden border ${borderColorClass} shadow-inner group`}>
              <img
                src={previewUrl || currentSide.dataUrl}
                alt={`${label} Preview`}
                className="w-full h-full object-contain"
              />
              <button
                onClick={() => inputRef.current?.click()}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-xs font-semibold text-white transition-opacity gap-1.5 cursor-pointer"
              >
                <Upload className="w-4 h-4" />
                <span>{language === 'hi' ? 'फोटो बदलें' : 'Change Photo'}</span>
              </button>
            </div>

            {/* Controls: Zoom, Pan inside card, and Position on A4 */}
            <div className="space-y-3 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
              {/* Zoom */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="flex items-center gap-1 font-medium">
                    <ZoomIn className={`w-3.5 h-3.5 ${accentTextClass}`} />
                    {language === 'hi' ? 'ज़ूम (Zoom)' : 'Zoom'}: {Math.round(currentSide.zoom * 100)}%
                  </span>
                  <button
                    onClick={() => updateSideSetting(sideKey, 'zoom', 1.0)}
                    className={`text-[10px] ${accentTextClass} hover:underline`}
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="2.2"
                  step="0.02"
                  value={currentSide.zoom}
                  onChange={(e) => updateSideSetting(sideKey, 'zoom', parseFloat(e.target.value))}
                  className={`w-full ${accentSliderClass} h-1.5 bg-slate-800 rounded-lg cursor-pointer`}
                />
              </div>

              {/* A4 Position Control (Up / Down & Left / Right on Sheet) */}
              <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold ${accentTextClass} flex items-center gap-1`}>
                    <Move className="w-3.5 h-3.5" />
                    {language === 'hi' ? 'A4 शीट पर ऊपर-नीचे ले जाएं' : 'Position on A4 Sheet'}
                  </span>
                  <button
                    onClick={() => {
                      updateSideSetting(sideKey, 'positionXmm', 0);
                      updateSideSetting(sideKey, 'positionYmm', 0);
                    }}
                    className={`text-[10px] ${accentTextClass} hover:underline`}
                  >
                    {language === 'hi' ? 'रीसेट' : 'Reset'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Up / Down Slider */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{language === 'hi' ? 'ऊपर / नीचे' : 'Up / Down'}</span>
                      <span className={`font-semibold ${accentTextClass}`}>
                        {(currentSide.positionYmm || 0) > 0 ? `+${currentSide.positionYmm}mm` : `${currentSide.positionYmm || 0}mm`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-80"
                      max="80"
                      step="2"
                      value={currentSide.positionYmm || 0}
                      onChange={(e) => updateSideSetting(sideKey, 'positionYmm', parseInt(e.target.value))}
                      className={`w-full ${accentSliderClass} h-1.5 bg-slate-800 rounded-lg cursor-pointer`}
                    />
                  </div>

                  {/* Left / Right Slider */}
                  <div>
                    <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                      <span>{language === 'hi' ? 'बाएं / दाएं' : 'Left / Right'}</span>
                      <span className={`font-semibold ${accentTextClass}`}>
                        {(currentSide.positionXmm || 0) > 0 ? `+${currentSide.positionXmm}mm` : `${currentSide.positionXmm || 0}mm`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="-50"
                      max="50"
                      step="2"
                      value={currentSide.positionXmm || 0}
                      onChange={(e) => updateSideSetting(sideKey, 'positionXmm', parseInt(e.target.value))}
                      className={`w-full ${accentSliderClass} h-1.5 bg-slate-800 rounded-lg cursor-pointer`}
                    />
                  </div>
                </div>

                {/* Quick Nudge Buttons */}
                <div className="flex items-center justify-center gap-1.5 pt-1">
                  <button
                    onClick={() => nudgeSidePosition(sideKey, 'positionYmm', -5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-0.5 border border-slate-700 cursor-pointer"
                    title="Move 5mm Up"
                  >
                    <ArrowUp className={`w-3 h-3 ${accentTextClass}`} />
                    <span>{language === 'hi' ? 'ऊपर' : 'Up'}</span>
                  </button>
                  <button
                    onClick={() => nudgeSidePosition(sideKey, 'positionYmm', 5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-0.5 border border-slate-700 cursor-pointer"
                    title="Move 5mm Down"
                  >
                    <ArrowDown className={`w-3 h-3 ${accentTextClass}`} />
                    <span>{language === 'hi' ? 'नीचे' : 'Down'}</span>
                  </button>
                  <button
                    onClick={() => nudgeSidePosition(sideKey, 'positionXmm', -5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-0.5 border border-slate-700 cursor-pointer"
                    title="Move 5mm Left"
                  >
                    <ArrowLeft className={`w-3 h-3 ${accentTextClass}`} />
                    <span>{language === 'hi' ? 'बाएं' : 'Left'}</span>
                  </button>
                  <button
                    onClick={() => nudgeSidePosition(sideKey, 'positionXmm', 5)}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] flex items-center gap-0.5 border border-slate-700 cursor-pointer"
                    title="Move 5mm Right"
                  >
                    <ArrowRight className={`w-3 h-3 ${accentTextClass}`} />
                    <span>{language === 'hi' ? 'दाएं' : 'Right'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-purple-500/70 bg-slate-950/50 hover:bg-purple-950/20 rounded-xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[160px]"
          >
            <div className={`w-10 h-10 rounded-xl ${colorBadgeClass} border border-slate-700 flex items-center justify-center mb-2.5`}>
              <Upload className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-200">
              {label} {language === 'hi' ? 'चुनें' : 'Upload'}
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              {language === 'hi' ? 'यहाँ क्लिक करें या फ़ाइल खींचें' : 'Click or Drag & Drop'}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Hidden file inputs */}
      <input
        ref={frontInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0], 'front');
          }
          e.target.value = '';
        }}
      />
      <input
        ref={backInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0], 'back');
          }
          e.target.value = '';
        }}
      />
      <input
        ref={front2InputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0], 'front2');
          }
          e.target.value = '';
        }}
      />
      <input
        ref={back2InputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFileUpload(e.target.files[0], 'back2');
          }
          e.target.value = '';
        }}
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-950/70 via-indigo-950/60 to-slate-900 border border-purple-800/40 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-semibold mb-2">
              <CreditCard className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'आधार व आईडी कार्ड A4 ज़ेरॉक्स' : 'Aadhaar & ID Card A4 Xerox'}</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              {language === 'hi'
                ? 'आधार / पैन / आईडी कार्ड ज़ेरॉक्स व A4 प्रिंटर'
                : 'Aadhaar / ID Card Xerox & A4 Printable Maker'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              {language === 'hi'
                ? '1 A4 पेज पर 2 अलग-अलग व्यक्तियों का कार्ड प्रिंट करें या एक ही कार्ड की 2 कॉपी निकालें। बिना किसी बीच की लाइन के साफ 4K प्रिंट!'
                : 'Print 2 different people on 1 single A4 sheet or 2 duplicate copies with clean 4K Ultra HD layout!'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="load-sample-id-card-btn"
              onClick={loadSampleCustomer1}
              className="px-3 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 border border-purple-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm hover:shadow"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>{language === 'hi' ? '⚡ ग्राहक 1 आधार' : '⚡ Sample Aadhaar'}</span>
            </button>

            <button
              id="load-sample-both-btn"
              onClick={loadAllSamples}
              className="px-3 py-2 rounded-xl bg-emerald-600/30 hover:bg-emerald-600/40 text-emerald-200 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shrink-0 cursor-pointer shadow-sm hover:shadow"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === 'hi' ? '👥 2 अलग-अलग ग्राहक लोड करें' : '👥 Load 2 Customers'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Upload & Crop Controls (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 2-COPY DUAL CUSTOMER CONTROLLER (Visible when dual-copy is selected) */}
          {isDualCopyMode && (
            <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-indigo-950/80 border border-purple-500/40 rounded-2xl p-4 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-purple-400" />
                  {language === 'hi' ? '2-कॉपी मोड: कार्ड चयन' : '2-Copy Mode Selection'}
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                  {isDifferentPerson
                    ? language === 'hi' ? '👥 2 अलग-अलग ग्राहक' : '👥 2 Different People'
                    : language === 'hi' ? '🔁 1 ही कार्ड डुप्लिकेट' : '🔁 Duplicate Copy'}
                </span>
              </div>

              {/* Mode Toggle: Duplicate vs 2 Different People */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, dualCopyMode: 'same-card' }))}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    settings.dualCopyMode !== 'different-person'
                      ? 'bg-purple-900/60 border-purple-400 text-white shadow-md shadow-purple-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Copy className="w-4 h-4 text-purple-300" />
                    <span className="text-xs font-bold">
                      {language === 'hi' ? '1 व्यक्ति (वही कार्ड 2 बार)' : '1 Person (Duplicate Copy)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {language === 'hi' ? 'ऊपर और नीचे एक ही कार्ड की 2 प्रतियां' : 'Replicate same card on top & bottom'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSettings((prev) => ({ ...prev, dualCopyMode: 'different-person' }));
                    if (!settings.front2?.dataUrl && !settings.back2?.dataUrl) {
                      setActiveCustomerTab('customer2');
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    settings.dualCopyMode === 'different-person'
                      ? 'bg-emerald-950/70 border-emerald-500 text-emerald-100 shadow-md shadow-emerald-500/10'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-300">
                      {language === 'hi' ? '2 अलग-अलग व्यक्ति (Customer 1 + 2)' : '2 Different People (Cust 1 + 2)'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {language === 'hi' ? 'ऊपर ग्राहक 1 + नीचे दूसरे व्यक्ति का कार्ड' : 'Customer 1 on top + Customer 2 on bottom'}
                  </p>
                </button>
              </div>

              {/* Sub-tabs for switching active customer when in 2-person mode */}
              {isDifferentPerson && (
                <div className="flex items-center gap-2 pt-2 border-t border-purple-900/40">
                  <span className="text-[11px] text-slate-300 font-semibold shrink-0">
                    {language === 'hi' ? 'फोटो एडिट करें:' : 'Edit Photo:'}
                  </span>
                  <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
                    <button
                      onClick={() => setActiveCustomerTab('customer1')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        activeCustomerTab === 'customer1'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>{language === 'hi' ? 'ग्राहक 1 (ऊपर वाला)' : 'Customer 1 (Top)'}</span>
                      {settings.front.dataUrl && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </button>

                    <button
                      onClick={() => setActiveCustomerTab('customer2')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        activeCustomerTab === 'customer2'
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>{language === 'hi' ? 'ग्राहक 2 (नीचे वाला)' : 'Customer 2 (Bottom)'}</span>
                      {settings.front2?.dataUrl && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                    </button>

                    <button
                      onClick={() => setActiveCustomerTab('both')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                        activeCustomerTab === 'both'
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{language === 'hi' ? 'सभी 4 फोटो' : 'View All 4'}</span>
                    </button>
                  </div>

                  <button
                    onClick={loadSampleCustomer2}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-[11px] font-semibold border border-emerald-500/30 transition-all shrink-0 cursor-pointer"
                    title="Load sample PAN card for Customer 2"
                  >
                    + {language === 'hi' ? 'ग्राहक 2 सैंपल' : 'Sample Cust 2'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CUSTOMER 1 PHOTO UPLOADS (Always shown unless customer2 tab is exclusively selected) */}
          {(!isDifferentPerson || activeCustomerTab === 'customer1' || activeCustomerTab === 'both') && (
            <div className="space-y-3">
              {isDifferentPerson && (
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <User className="w-4 h-4" />
                    {language === 'hi' ? '👤 ग्राहक 1 (शीर्ष / Top Half)' : '👤 Customer 1 (Top Half)'}
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {language === 'hi' ? 'A4 के ऊपरी हिस्से में प्रिंट होगा' : 'Prints on Upper Half of A4'}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderCardUploadBox(
                  'front',
                  frontInputRef,
                  1,
                  isDifferentPerson
                    ? (language === 'hi' ? 'ग्राहक 1 - आगे (Front)' : 'Cust 1 - Front')
                    : (language === 'hi' ? 'फोटो 1 (Front Side)' : 'Photo 1 (Front Side)'),
                  'blue',
                  settings.front,
                  frontPreviewUrl
                )}

                {renderCardUploadBox(
                  'back',
                  backInputRef,
                  2,
                  isDifferentPerson
                    ? (language === 'hi' ? 'ग्राहक 1 - पीछे (Back)' : 'Cust 1 - Back')
                    : (language === 'hi' ? 'फोटो 2 (Back Side)' : 'Photo 2 (Back Side)'),
                  'emerald',
                  settings.back,
                  backPreviewUrl
                )}
              </div>
            </div>
          )}

          {/* CUSTOMER 2 PHOTO UPLOADS (Shown in 2-person mode) */}
          {isDifferentPerson && (activeCustomerTab === 'customer2' || activeCustomerTab === 'both') && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Users className="w-4 h-4" />
                  {language === 'hi' ? '👥 ग्राहक 2 (निचला हिस्सा / Bottom Half)' : '👥 Customer 2 (Bottom Half)'}
                </span>
                <span className="text-[11px] text-slate-400">
                  {language === 'hi' ? 'A4 के निचले हिस्से (Middle se Niche) में प्रिंट होगा' : 'Prints on Bottom Half of A4'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {renderCardUploadBox(
                  'front2',
                  front2InputRef,
                  3,
                  language === 'hi' ? 'ग्राहक 2 - आगे (Front)' : 'Cust 2 - Front Side',
                  'purple',
                  settings.front2,
                  front2PreviewUrl
                )}

                {renderCardUploadBox(
                  'back2',
                  back2InputRef,
                  4,
                  language === 'hi' ? 'ग्राहक 2 - पीछे (Back)' : 'Cust 2 - Back Side',
                  'amber',
                  settings.back2,
                  back2PreviewUrl
                )}
              </div>
            </div>
          )}

          {/* Color Mode & Print Style Selector */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-4 h-4 text-purple-400" />
                {language === 'hi' ? 'प्रिंट कलर व फोटोकॉपी इफ़ेक्ट' : 'Color Mode & Xerox Style'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setGlobalColorMode('original')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  settings.front.colorMode === 'original'
                    ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-r from-red-500 via-green-500 to-blue-500 mx-auto mb-1.5" />
                <span className="text-xs font-bold block">{language === 'hi' ? 'ओरिजिनल रंगीन' : 'Original Color'}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{language === 'hi' ? 'कलर प्रिंट' : 'Color Print'}</span>
              </button>

              <button
                type="button"
                onClick={() => setGlobalColorMode('grayscale')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  settings.front.colorMode === 'grayscale'
                    ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-slate-500 mx-auto mb-1.5" />
                <span className="text-xs font-bold block">{language === 'hi' ? 'ब्लैक & व्हाइट' : 'Grayscale Xerox'}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{language === 'hi' ? 'ज़ेरॉक्स मोड' : 'Standard Xerox'}</span>
              </button>

              <button
                type="button"
                onClick={() => setGlobalColorMode('bw_high_contrast')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  settings.front.colorMode === 'bw_high_contrast'
                    ? 'bg-purple-950/60 border-purple-500 text-purple-200 shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="w-5 h-5 rounded-full bg-black border border-white mx-auto mb-1.5" />
                <span className="text-xs font-bold block">{language === 'hi' ? 'डॉक्यूमेंट क्लैरिटी' : 'High Contrast'}</span>
                <span className="text-[10px] text-slate-500 block mt-0.5">{language === 'hi' ? 'अक्षर साफ दिखें' : 'Clear Text'}</span>
              </button>
            </div>

            {/* Brightness & Contrast fine tuning */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800/80">
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    {language === 'hi' ? 'चमक (Brightness)' : 'Brightness'}
                  </span>
                  <span className="text-slate-400">{settings.front.brightness}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="150"
                  value={settings.front.brightness}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSettings((prev) => ({
                      ...prev,
                      front: { ...prev.front, brightness: val },
                      back: { ...prev.back, brightness: val },
                      front2: prev.front2 ? { ...prev.front2, brightness: val } : undefined,
                      back2: prev.back2 ? { ...prev.back2, brightness: val } : undefined,
                    }));
                  }}
                  className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs text-slate-300">
                  <span className="flex items-center gap-1">
                    <Contrast className="w-3.5 h-3.5 text-purple-400" />
                    {language === 'hi' ? 'कंट्रास्ट (Contrast)' : 'Contrast'}
                  </span>
                  <span className="text-slate-400">{settings.front.contrast}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="160"
                  value={settings.front.contrast}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    setSettings((prev) => ({
                      ...prev,
                      front: { ...prev.front, contrast: val },
                      back: { ...prev.back, contrast: val },
                      front2: prev.front2 ? { ...prev.front2, contrast: val } : undefined,
                      back2: prev.back2 ? { ...prev.back2, contrast: val } : undefined,
                    }));
                  }}
                  className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Layout & Paper Configuration */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-purple-400" />
              {language === 'hi' ? 'A4 शीट लेआउट विकल्प' : 'A4 Sheet Layout Mode'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Option 1: Standard Vertical */}
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, layout: 'standard-vertical' }))}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.layout === 'standard-vertical'
                    ? 'bg-purple-950/70 border-purple-500 text-white shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">
                    {language === 'hi' ? '🔥 मानक 1 कॉपी (A4)' : 'Standard 1 Copy'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === 'hi' ? 'ऊपर फोटो 1 व नीचे फोटो 2' : 'Photo 1 above, Photo 2 below'}
                </p>
              </button>

              {/* Option 2: Dual Copy on A4 */}
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, layout: 'dual-copy' }))}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.layout === 'dual-copy'
                    ? 'bg-purple-950/70 border-purple-500 text-white shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">
                    {language === 'hi' ? '📄 2 कॉपी / 2 ग्राहक (1 A4)' : 'Dual Copy / 2 Persons'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                    2 on 1 A4
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === 'hi' ? '1 ही या 2 अलग-अलग ग्राहक' : '1 person or 2 different customers'}
                </p>
              </button>

              {/* Option 3: Side by Side */}
              <button
                type="button"
                onClick={() => setSettings((prev) => ({ ...prev, layout: 'side-by-side' }))}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  settings.layout === 'side-by-side'
                    ? 'bg-purple-950/70 border-purple-500 text-white shadow-md shadow-purple-500/10'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold">
                    {language === 'hi' ? '💳 पास-पास (लेमिनेशन)' : 'Side by Side'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400">
                  {language === 'hi' ? 'मोड़कर कार्ड बनाने हेतु' : 'For pocket card folding'}
                </p>
              </button>
            </div>

            {/* Gap and Sizing Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-800/80 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{language === 'hi' ? 'कार्ड साइज पैमाना (Scale)' : 'Card Scale'}: {settings.scalePercent}%</span>
                  <span className="text-slate-400">
                    {(8.56 * (settings.scalePercent / 100)).toFixed(1)} × {(5.4 * (settings.scalePercent / 100)).toFixed(1)} cm
                  </span>
                </div>
                <input
                  type="range"
                  min="85"
                  max="135"
                  step="5"
                  value={settings.scalePercent}
                  onChange={(e) => setSettings((prev) => ({ ...prev, scalePercent: parseInt(e.target.value) }))}
                  className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{language === 'hi' ? 'बीच की दूरी (Vertical Gap)' : 'Gap Between Cards'}: {settings.verticalGapMm} mm</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="35"
                  step="2"
                  value={settings.verticalGapMm}
                  onChange={(e) => setSettings((prev) => ({ ...prev, verticalGapMm: parseInt(e.target.value) }))}
                  className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>

            {/* Toggles: Border, Cutting Marks, Middle Line, Clean Lines without text, Watermark */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80 text-xs">
              <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={settings.hasBorder}
                  onChange={(e) => setSettings((prev) => ({ ...prev, hasBorder: e.target.checked }))}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 bg-slate-900 border-slate-700"
                />
                <span className="font-semibold text-slate-300">
                  {language === 'hi' ? 'ब्लैक बॉर्डर लगाएं (Card Border)' : 'Card Studio Border'}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={settings.hasCuttingMarks}
                  onChange={(e) => setSettings((prev) => ({ ...prev, hasCuttingMarks: e.target.checked }))}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 bg-slate-900 border-slate-700"
                />
                <span className="font-semibold text-slate-300">
                  {language === 'hi' ? '✂ कार्ड कटिंग मार्क (Card Scissor Mark)' : 'Card Cutting Marks'}
                </span>
              </label>

              {/* Middle Dividing Line Toggle - Defaults to False (Hidden/Removed) */}
              <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(settings.showMiddleDividingLine)}
                  onChange={(e) => setSettings((prev) => ({ ...prev, showMiddleDividingLine: e.target.checked }))}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 bg-slate-900 border-slate-700"
                />
                <span className="font-semibold text-slate-300">
                  {language === 'hi' ? 'बीच की कटिंग लाइन (Middle Line)' : 'Show Middle Dividing Line'}
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 hover:border-slate-700">
                <input
                  type="checkbox"
                  checked={settings.showCardLabels}
                  onChange={(e) => setSettings((prev) => ({ ...prev, showCardLabels: e.target.checked }))}
                  className="rounded text-purple-600 focus:ring-purple-500 w-4 h-4 bg-slate-900 border-slate-700"
                />
                <span className="font-semibold text-slate-300">
                  {language === 'hi' ? 'आगे/पीछे टेक्स्ट लिखें (Show Text Labels)' : 'Show Text Labels above Cards'}
                </span>
              </label>

              <div className="bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 sm:col-span-2">
                <select
                  value={settings.watermarkType}
                  onChange={(e) => setSettings((prev) => ({ ...prev, watermarkType: e.target.value as any }))}
                  className="w-full bg-transparent text-slate-200 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="none" className="bg-slate-900">
                    {language === 'hi' ? 'वॉटरमार्क: कोई नहीं (No Watermark)' : 'Watermark: None'}
                  </option>
                  <option value="self_attested" className="bg-slate-900">
                    SELF ATTESTED
                  </option>
                  <option value="photocopy_only" className="bg-slate-900">
                    ONLY FOR PHOTOCOPY
                  </option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live A4 Sheet Preview & Direct Print Action Buttons (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 sticky top-24">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="font-bold text-sm text-white">
                  {language === 'hi' ? 'A4 प्रिंटेबल शीट लाइव प्रीव्यू' : 'Live A4 Sheet Preview'}
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/50 flex items-center gap-1">
                <Sparkle className="w-3 h-3 text-purple-400" />
                4K Ultra HD
              </span>
            </div>

            {/* A4 Sheet Interactive Preview Frame */}
            <div className="bg-slate-950 rounded-xl p-3 sm:p-4 border border-slate-800 flex items-center justify-center">
              <div className="w-full max-w-[280px] sm:max-w-[320px] aspect-[210/297] bg-white rounded shadow-2xl overflow-hidden border border-slate-300 relative">
                {a4PreviewUrl ? (
                  <img
                    src={a4PreviewUrl}
                    alt="A4 ID Card Sheet Preview"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                    <CreditCard className="w-8 h-8 text-slate-300 mb-2" />
                    <p className="text-xs font-semibold text-slate-600">
                      {language === 'hi' ? 'कार्ड की फोटो अपलोड करें' : 'Upload Card Images'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Main Action Buttons */}
            <div className="space-y-2.5 mt-4">
              <button
                id="print-id-card-a4-btn"
                onClick={handlePrint}
                disabled={!hasAnyImage || isGenerating}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Printer className="w-5 h-5" />
                <span>
                  {isGenerating
                    ? language === 'hi'
                      ? 'तैयार हो रहा है...'
                      : 'Preparing...'
                    : language === 'hi'
                    ? '🖨️ डायरेक्ट A4 प्रिंट करें (Direct Print)'
                    : '🖨️ Direct Print A4 Xerox'}
                </span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  id="download-id-card-pdf-btn"
                  onClick={handleDownloadPdf}
                  disabled={!hasAnyImage || isGenerating}
                  className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <FileDown className="w-4 h-4 text-purple-400" />
                  <span>{language === 'hi' ? '📄 A4 PDF डाउनलोड' : 'Download PDF'}</span>
                </button>

                <button
                  id="download-id-card-4k-btn"
                  onClick={() => handleDownloadImage(true)}
                  disabled={!hasAnyImage || isGenerating}
                  className="py-2.5 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{language === 'hi' ? '✨ 4K HD फोटो' : '✨ 4K Ultra HD'}</span>
                </button>
              </div>
            </div>

            {/* Quick Cyber Cafe Pro Tip */}
            <div className="mt-3.5 p-3 rounded-xl bg-purple-950/30 border border-purple-800/30 text-[11px] text-purple-200 flex items-start gap-2">
              <span className="text-base leading-none">💡</span>
              <span>
                {language === 'hi'
                  ? 'प्रिंटर सेटिंग में Paper Size को "A4" और Scale को "100% (Actual Size)" पर रखें ताकि कार्ड बिल्कुल असली आकार में निकले।'
                  : 'In printer dialog, select Paper Size: "A4" and Scale: "100% (Actual Size)" for true-to-life card dimensions.'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden container specifically rendered for window.print() */}
      <div id="printable-a4-sheet" className="hidden print:block">
        {a4PreviewUrl && (
          <img
            id="printable-a4-img"
            src={a4PreviewUrl}
            alt="Printable A4 Sheet"
            className="w-full h-full object-contain"
          />
        )}
      </div>
    </div>
  );
};
