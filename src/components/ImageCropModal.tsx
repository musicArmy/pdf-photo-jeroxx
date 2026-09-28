import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  X,
  Download,
  Sparkles,
  Layers
} from 'lucide-react';
import { Language } from '../types';

export interface CropResult {
  dataUrl: string;
  width: number;
  height: number;
  format: 'png' | 'jpeg';
}

interface ImageCropModalProps {
  isOpen: boolean;
  imageUrl: string;
  imageTitle?: string;
  language: Language;
  onClose: () => void;
  onApplyCrop: (result: CropResult) => void;
  // If true, shows a "Direct Download 4K" button
  allowDirectDownload?: boolean;
}

type AspectRatioOption = 'free' | '1:1' | '4:3' | '3:4' | '16:9' | 'a4_p' | 'a4_l';

interface DragHandle {
  type: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 's' | 'e' | 'w';
  startX: number;
  startY: number;
  startCrop: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageUrl,
  imageTitle = 'Photo',
  language,
  onClose,
  onApplyCrop,
  allowDirectDownload = true,
}) => {
  if (!isOpen || !imageUrl) return null;

  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('free');
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Natural image dimensions
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  // Displayed image layout inside container
  const [displayedSize, setDisplayedSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  // Crop box in display coordinates (pixels within container)
  const [cropBox, setCropBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0,
    y: 0,
    w: 0,
    h: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const activeDragRef = useRef<DragHandle | null>(null);

  // Initialize crop box to 90% centered whenever image loads or container size changes
  const resetCropBox = useCallback((imgW: number, imgH: number, ratio: AspectRatioOption = aspectRatio) => {
    if (imgW <= 0 || imgH <= 0) return;

    let targetW = imgW * 0.9;
    let targetH = imgH * 0.9;

    let targetRatio: number | null = null;
    if (ratio === '1:1') targetRatio = 1;
    else if (ratio === '4:3') targetRatio = 4 / 3;
    else if (ratio === '3:4') targetRatio = 3 / 4;
    else if (ratio === '16:9') targetRatio = 16 / 9;
    else if (ratio === 'a4_p') targetRatio = 210 / 297;
    else if (ratio === 'a4_l') targetRatio = 297 / 210;

    if (targetRatio !== null) {
      if (targetW / targetH > targetRatio) {
        targetW = targetH * targetRatio;
      } else {
        targetH = targetW / targetRatio;
      }
    }

    const x = Math.max(0, (imgW - targetW) / 2);
    const y = Math.max(0, (imgH - targetH) / 2);

    setCropBox({
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(targetW),
      h: Math.round(targetH),
    });
  }, [aspectRatio]);

  // Load natural image dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // Measure display size once image renders in DOM
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setDisplayedSize({ width: w, height: h });
    resetCropBox(w, h, aspectRatio);
  };

  // When aspect ratio changes, re-adjust crop box
  const handleAspectChange = (newRatio: AspectRatioOption) => {
    setAspectRatio(newRatio);
    if (displayedSize.width > 0 && displayedSize.height > 0) {
      resetCropBox(displayedSize.width, displayedSize.height, newRatio);
    }
  };

  // Pointer / Touch Handlers for Dragging and Resizing
  const handleStartDrag = (
    e: React.MouseEvent | React.TouchEvent,
    type: DragHandle['type']
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    activeDragRef.current = {
      type,
      startX: clientX,
      startY: clientY,
      startCrop: { ...cropBox },
    };

    const handlePointerMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!activeDragRef.current) return;
      const curX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : (moveEvt as MouseEvent).clientX;
      const curY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : (moveEvt as MouseEvent).clientY;

      const deltaX = curX - activeDragRef.current.startX;
      const deltaY = curY - activeDragRef.current.startY;
      const { type: dragType, startCrop } = activeDragRef.current;

      const maxW = displayedSize.width;
      const maxH = displayedSize.height;
      const minBoxSize = 25;

      let newX = startCrop.x;
      let newY = startCrop.y;
      let newW = startCrop.w;
      let newH = startCrop.h;

      // Handle aspect ratio constraint if not 'free'
      let ratioVal: number | null = null;
      if (aspectRatio === '1:1') ratioVal = 1;
      else if (aspectRatio === '4:3') ratioVal = 4 / 3;
      else if (aspectRatio === '3:4') ratioVal = 3 / 4;
      else if (aspectRatio === '16:9') ratioVal = 16 / 9;
      else if (aspectRatio === 'a4_p') ratioVal = 210 / 297;
      else if (aspectRatio === 'a4_l') ratioVal = 297 / 210;

      if (dragType === 'move') {
        newX = Math.min(Math.max(0, startCrop.x + deltaX), maxW - startCrop.w);
        newY = Math.min(Math.max(0, startCrop.y + deltaY), maxH - startCrop.h);
      } else {
        // Corner & Edge Resizing
        if (dragType.includes('e')) {
          newW = Math.max(minBoxSize, Math.min(startCrop.w + deltaX, maxW - startCrop.x));
        }
        if (dragType.includes('s')) {
          newH = Math.max(minBoxSize, Math.min(startCrop.h + deltaY, maxH - startCrop.y));
        }
        if (dragType.includes('w')) {
          const possibleW = Math.max(minBoxSize, startCrop.w - deltaX);
          const rightEdge = startCrop.x + startCrop.w;
          newX = Math.max(0, Math.min(rightEdge - minBoxSize, startCrop.x + deltaX));
          newW = rightEdge - newX;
        }
        if (dragType.includes('n')) {
          const bottomEdge = startCrop.y + startCrop.h;
          newY = Math.max(0, Math.min(bottomEdge - minBoxSize, startCrop.y + deltaY));
          newH = bottomEdge - newY;
        }

        // Apply aspect ratio constraints if enabled
        if (ratioVal !== null) {
          if (dragType === 'e' || dragType === 'w') {
            newH = newW / ratioVal;
            if (newY + newH > maxH) {
              newH = maxH - newY;
              newW = newH * ratioVal;
            }
          } else if (dragType === 's' || dragType === 'n') {
            newW = newH * ratioVal;
            if (newX + newW > maxW) {
              newW = maxW - newX;
              newH = newW / ratioVal;
            }
          } else {
            // Diagonal corners (nw, ne, se, sw)
            const currentRatio = newW / newH;
            if (currentRatio > ratioVal) {
              newW = newH * ratioVal;
            } else {
              newH = newW / ratioVal;
            }
          }
        }
      }

      setCropBox({
        x: Math.round(newX),
        y: Math.round(newY),
        w: Math.round(newW),
        h: Math.round(newH),
      });
    };

    const handlePointerUp = () => {
      activeDragRef.current = null;
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchmove', handlePointerMove);
      window.removeEventListener('touchend', handlePointerUp);
    };

    window.addEventListener('mousemove', handlePointerMove, { passive: false });
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchmove', handlePointerMove, { passive: false });
    window.addEventListener('touchend', handlePointerUp);
  };

  // Calculate actual pixel dimensions in the full-resolution (4K) original image
  const getOutputDimensions = () => {
    if (displayedSize.width === 0 || displayedSize.height === 0 || naturalSize.width === 0) {
      return { width: 0, height: 0 };
    }
    const scaleX = naturalSize.width / displayedSize.width;
    const scaleY = naturalSize.height / displayedSize.height;
    return {
      width: Math.round(cropBox.w * scaleX),
      height: Math.round(cropBox.h * scaleY),
    };
  };

  const outputDim = getOutputDimensions();
  const is4K = outputDim.width >= 3000 || outputDim.height >= 3000 || (outputDim.width * outputDim.height >= 6000000);

  // Render high-resolution canvas with full 4K preservation
  const generateCroppedCanvas = async (): Promise<HTMLCanvasElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          if (displayedSize.width === 0 || displayedSize.height === 0) {
            throw new Error('Image dimensions not initialized.');
          }

          const scaleX = naturalSize.width / displayedSize.width;
          const scaleY = naturalSize.height / displayedSize.height;

          const sourceCropX = Math.max(0, cropBox.x * scaleX);
          const sourceCropY = Math.max(0, cropBox.y * scaleY);
          const sourceCropW = Math.min(naturalSize.width - sourceCropX, cropBox.w * scaleX);
          const sourceCropH = Math.min(naturalSize.height - sourceCropY, cropBox.h * scaleY);

          // If rotation is applied, swap width and height accordingly
          const normRot = ((rotation % 360) + 360) % 360;
          const isRot90or270 = normRot === 90 || normRot === 270;

          const finalWidth = Math.round(isRot90or270 ? sourceCropH : sourceCropW);
          const finalHeight = Math.round(isRot90or270 ? sourceCropW : sourceCropH);

          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, finalWidth);
          canvas.height = Math.max(1, finalHeight);

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) throw new Error('Could not get 2D canvas context.');

          // Enable maximum interpolation fidelity for 4K crisp output
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Background white in case of transparency
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // Apply transformations (rotation & flips) centered on the canvas
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);

          if (normRot !== 0) {
            ctx.rotate((normRot * Math.PI) / 180);
          }
          if (flipH) {
            ctx.scale(-1, 1);
          }

          const drawW = isRot90or270 ? canvas.height : canvas.width;
          const drawH = isRot90or270 ? canvas.width : canvas.height;

          // Draw slice from the source image
          ctx.drawImage(
            img,
            sourceCropX,
            sourceCropY,
            sourceCropW,
            sourceCropH,
            -drawW / 2,
            -drawH / 2,
            drawW,
            drawH
          );

          ctx.restore();
          resolve(canvas);
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image for cropping.'));
      img.src = imageUrl;
    });
  };

  const handleApply = async () => {
    setIsProcessing(true);
    try {
      const canvas = await generateCroppedCanvas();
      const mime = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
      const quality = exportFormat === 'jpeg' ? 0.96 : undefined;
      const dataUrl = canvas.toDataURL(mime, quality);

      onApplyCrop({
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        format: exportFormat,
      });
      onClose();
    } catch (err) {
      console.error('Error applying crop:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDirectDownload = async () => {
    setIsProcessing(true);
    try {
      const canvas = await generateCroppedCanvas();
      const mime = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
      const ext = exportFormat === 'jpeg' ? 'jpg' : 'png';
      const quality = exportFormat === 'jpeg' ? 0.96 : undefined;
      const dataUrl = canvas.toDataURL(mime, quality);

      const link = document.createElement('a');
      link.href = dataUrl;
      const safeTitle = (imageTitle || 'cropped_photo').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `${safeTitle}_cropped_4k.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading cropped image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Bar */}
        <div className="px-4 py-3 sm:py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <Crop className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                <span>{language === 'hi' ? 'लचीला फोटो क्रॉप टूल' : 'Flexible Photo Crop Tool'}</span>
                {is4K ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                    4K Ultra HD
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    HD Crisp
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {language === 'hi'
                  ? 'चारों कोनों या किनारों को खींचकर कहीं से भी मनचाहा भाग काटें'
                  : 'Drag corners or edges freely to cut any part of the image'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Toolbar & Aspect Ratio Selector */}
        <div className="px-3 sm:px-4 py-2.5 bg-slate-950/70 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Aspect Ratio Options */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            <span className="text-[11px] font-medium text-slate-400 mr-1 hidden sm:inline">
              {language === 'hi' ? 'अनुपात:' : 'Ratio:'}
            </span>
            {[
              { id: 'free', label: language === 'hi' ? '✨ लचीला / फ्री' : '✨ Freeform' },
              { id: '1:1', label: '1:1 Square' },
              { id: '4:3', label: '4:3' },
              { id: '3:4', label: '3:4' },
              { id: '16:9', label: '16:9' },
              { id: 'a4_p', label: 'A4 Portrait' },
              { id: 'a4_l', label: 'A4 Landscape' },
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => handleAspectChange(opt.id as AspectRatioOption)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  aspectRatio === opt.id
                    ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Transform Controls (Rotate & Reset) */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              title={language === 'hi' ? '90° घुमाएं' : 'Rotate 90°'}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">90°</span>
            </button>
            <button
              onClick={() => setFlipH((f) => !f)}
              title={language === 'hi' ? 'दर्पण (Flip Horizontal)' : 'Flip Horizontal'}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${
                flipH ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setRotation(0);
                setFlipH(false);
                if (displayedSize.width > 0 && displayedSize.height > 0) {
                  resetCropBox(displayedSize.width, displayedSize.height, aspectRatio);
                }
              }}
              title={language === 'hi' ? 'रीसेट करें' : 'Reset Full Image'}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'रीसेट' : 'Reset'}</span>
            </button>
          </div>
        </div>

        {/* Cropper Canvas Workspace */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-slate-950 p-2 sm:p-6 overflow-hidden flex items-center justify-center select-none min-h-[300px] sm:min-h-[420px]"
        >
          {/* Inner relative container matching the exact displayed image size */}
          <div
            className="relative inline-block max-w-full max-h-[62vh]"
            style={{ touchAction: 'none' }}
          >
            <img
              ref={imgRef}
              src={imageUrl}
              alt="Source"
              onLoad={handleImageLoad}
              style={{
                transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
                maxHeight: '60vh',
                maxWidth: '100%',
                objectFit: 'contain',
                display: 'block',
              }}
              className="rounded-lg shadow-md transition-transform duration-150 pointer-events-none select-none"
            />

            {/* Dark Mask Overlay outside the Crop Box */}
            {displayedSize.width > 0 && displayedSize.height > 0 && (
              <div
                className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg"
                style={{
                  width: displayedSize.width,
                  height: displayedSize.height,
                }}
              >
                {/* SVG Cutout Mask */}
                <svg
                  className="w-full h-full"
                  viewBox={`0 0 ${displayedSize.width} ${displayedSize.height}`}
                >
                  <defs>
                    <mask id="crop-cutout-mask">
                      <rect
                        width={displayedSize.width}
                        height={displayedSize.height}
                        fill="white"
                      />
                      <rect
                        x={cropBox.x}
                        y={cropBox.y}
                        width={cropBox.w}
                        height={cropBox.h}
                        fill="black"
                      />
                    </mask>
                  </defs>
                  <rect
                    width={displayedSize.width}
                    height={displayedSize.height}
                    fill="rgba(0, 0, 0, 0.65)"
                    mask="url(#crop-cutout-mask)"
                  />
                </svg>
              </div>
            )}

            {/* Interactive Crop Box & Handles */}
            {displayedSize.width > 0 && displayedSize.height > 0 && (
              <div
                style={{
                  left: `${cropBox.x}px`,
                  top: `${cropBox.y}px`,
                  width: `${cropBox.w}px`,
                  height: `${cropBox.h}px`,
                }}
                className="absolute border-2 border-emerald-400 shadow-2xl cursor-move touch-none"
                onMouseDown={(e) => handleStartDrag(e, 'move')}
                onTouchStart={(e) => handleStartDrag(e, 'move')}
              >
                {/* Rule of Thirds Guide Grid */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                  <div className="border-r border-b border-emerald-300/50"></div>
                  <div className="border-r border-b border-emerald-300/50"></div>
                  <div className="border-b border-emerald-300/50"></div>
                  <div className="border-r border-b border-emerald-300/50"></div>
                  <div className="border-r border-b border-emerald-300/50"></div>
                  <div className="border-b border-emerald-300/50"></div>
                  <div className="border-r border-emerald-300/50"></div>
                  <div className="border-r border-emerald-300/50"></div>
                  <div></div>
                </div>

                {/* Dimension Tag */}
                <div className="absolute top-1 left-1.5 pointer-events-none px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-md text-[10px] font-bold text-white border border-emerald-500/40">
                  {outputDim.width} × {outputDim.height} px
                </div>

                {/* 4 Corner Handles (NW, NE, SE, SW) */}
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'nw')}
                  onTouchStart={(e) => handleStartDrag(e, 'nw')}
                  className="absolute -top-2 -left-2 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                />
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'ne')}
                  onTouchStart={(e) => handleStartDrag(e, 'ne')}
                  className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                />
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'se')}
                  onTouchStart={(e) => handleStartDrag(e, 'se')}
                  className="absolute -bottom-2 -right-2 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nwse-resize shadow-md hover:scale-125 transition-transform"
                />
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'sw')}
                  onTouchStart={(e) => handleStartDrag(e, 'sw')}
                  className="absolute -bottom-2 -left-2 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nesw-resize shadow-md hover:scale-125 transition-transform"
                />

                {/* 4 Edge Handles (N, S, E, W) for truly flexible freeform trimming */}
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'n')}
                  onTouchStart={(e) => handleStartDrag(e, 'n')}
                  className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-ns-resize shadow hover:scale-110 transition-transform"
                />
                <div
                  onMouseDown={(e) => handleStartDrag(e, 's')}
                  onTouchStart={(e) => handleStartDrag(e, 's')}
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-3 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-ns-resize shadow hover:scale-110 transition-transform"
                />
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'w')}
                  onTouchStart={(e) => handleStartDrag(e, 'w')}
                  className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-6 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-ew-resize shadow hover:scale-110 transition-transform"
                />
                <div
                  onMouseDown={(e) => handleStartDrag(e, 'e')}
                  onTouchStart={(e) => handleStartDrag(e, 'e')}
                  className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-6 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-ew-resize shadow hover:scale-110 transition-transform"
                />
              </div>
            )}
          </div>
        </div>

        {/* Footer Bar & Action Buttons */}
        <div className="px-4 py-3 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Quality Indicator & Format Selector */}
          <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="font-semibold text-white">
                {outputDim.width} × {outputDim.height} px
              </span>
              <span className="text-slate-500">•</span>
              <span className={is4K ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                {is4K ? '✨ 4K Ultra HD' : 'HD Ready'}
              </span>
            </div>

            {/* Output Format */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[11px]">
              <button
                onClick={() => setExportFormat('png')}
                className={`px-2 py-1 rounded font-semibold ${
                  exportFormat === 'png' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                PNG (Lossless)
              </button>
              <button
                onClick={() => setExportFormat('jpeg')}
                className={`px-2 py-1 rounded font-semibold ${
                  exportFormat === 'jpeg' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                JPG (Light)
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {allowDirectDownload && (
              <button
                onClick={handleDirectDownload}
                disabled={isProcessing}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-700 disabled:opacity-50"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>{language === 'hi' ? '4K फोटो डाउनलोड' : 'Download 4K'}</span>
              </button>
            )}

            <button
              onClick={onClose}
              disabled={isProcessing}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              {language === 'hi' ? 'रद्द करें' : 'Cancel'}
            </button>

            <button
              onClick={handleApply}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {isProcessing
                  ? (language === 'hi' ? 'क्रॉप हो रहा है...' : 'Applying...')
                  : (language === 'hi' ? 'क्रॉप लागू करें (Apply Crop)' : 'Apply Crop')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
