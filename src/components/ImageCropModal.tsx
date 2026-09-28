import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Crop,
  FileText,
  RotateCw,
  RotateCcw,
  FlipHorizontal,
  Maximize2,
  Check,
  X,
  Download,
  Sparkles,
  Eye,
  Wand2,
  Sliders,
  FileCheck,
  RefreshCw,
  ZoomIn,
  ScanFace,
  Loader2
} from 'lucide-react';
import { Language } from '../types';
import { detectFace, suggestRectPassportCrop } from '../utils/faceDetection';

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
  allowDirectDownload?: boolean;
}

type CropMode = 'perspective' | 'rect';
type AspectRatioOption = 'free' | '1:1' | '4:3' | '3:4' | '16:9' | 'a4_p' | 'a4_l';
type DocFilter = 'original' | 'magic' | 'bw' | 'sharp';

interface Point {
  x: number;
  y: number;
}

interface CornerPoints {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

interface RectBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

type ActiveHandle =
  | 'tl'
  | 'tr'
  | 'br'
  | 'bl'
  | 'edge_top'
  | 'edge_right'
  | 'edge_bottom'
  | 'edge_left'
  | 'rect_move'
  | 'rect_nw'
  | 'rect_ne'
  | 'rect_se'
  | 'rect_sw'
  | 'rect_n'
  | 'rect_s'
  | 'rect_e'
  | 'rect_w';

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  imageUrl,
  imageTitle = 'Document',
  language,
  onClose,
  onApplyCrop,
  allowDirectDownload = true,
}) => {
  if (!isOpen || !imageUrl) return null;

  // Primary mode: 'perspective' (CamScanner-style 4-corner document warp) or 'rect' (standard bounding box)
  const [cropMode, setCropMode] = useState<CropMode>('perspective');
  const [docFilter, setDocFilter] = useState<DocFilter>('original');
  const [bwThreshold, setBwThreshold] = useState<number>(110); // Adjustable B&W ink threshold (45 to 200)
  const [bwSubMode, setBwSubMode] = useState<'smooth' | 'adaptive'>('smooth'); // 'smooth' (no bleach) or 'adaptive' (xerox)
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption>('free');
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);
  const [livePreviewUrl, setLivePreviewUrl] = useState<string | null>(null);

  // Natural image dimensions
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  // Displayed image size inside DOM container
  const [displayedSize, setDisplayedSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // 4 Corner points for Document Perspective Crop (in displayed pixel coordinates)
  const [corners, setCorners] = useState<CornerPoints>({
    tl: { x: 0, y: 0 },
    tr: { x: 0, y: 0 },
    br: { x: 0, y: 0 },
    bl: { x: 0, y: 0 },
  });

  // Standard Rectangular Crop Box
  const [rectBox, setRectBox] = useState<RectBox>({ x: 0, y: 0, w: 0, h: 0 });

  // Auto Face Detection state for passport crop
  const [isDetectingFace, setIsDetectingFace] = useState<boolean>(false);
  const [faceAlert, setFaceAlert] = useState<string | null>(null);

  const handleAutoPassportFaceCrop = async () => {
    if (!imageUrl || displayedSize.width <= 0 || naturalSize.width <= 0) return;
    setIsDetectingFace(true);
    setFaceAlert(language === 'hi' ? 'चेहरे का पता लगाया जा रहा है...' : 'Detecting face area...');
    try {
      const face = await detectFace(imageUrl);
      if (face) {
        const scaleX = displayedSize.width / naturalSize.width;
        const scaleY = displayedSize.height / naturalSize.height;
        const crop = suggestRectPassportCrop(naturalSize.width, naturalSize.height, face, 35 / 45);

        setCropMode('rect');
        setAspectRatio('free');
        setRectBox({
          x: Math.round(crop.x * scaleX),
          y: Math.round(crop.y * scaleY),
          w: Math.round(crop.w * scaleX),
          h: Math.round(crop.h * scaleY),
        });

        setFaceAlert(
          language === 'hi'
            ? '🎯 चेहरा पहचाना गया! 35×45mm पासपोर्ट अनुपात पर ऑप्टिमल क्रॉप सेट हुआ।'
            : '🎯 Face detected! Optimal 35×45mm passport crop applied.'
        );
        setTimeout(() => setFaceAlert(null), 3500);
      } else {
        setFaceAlert(
          language === 'hi'
            ? 'चेहरा नहीं मिला। मैन्युअल रूप से बॉक्स सेट करें।'
            : 'No face detected. Please adjust crop box manually.'
        );
        setTimeout(() => setFaceAlert(null), 3000);
      }
    } catch (err) {
      console.error('Error auto-cropping face in modal:', err);
    } finally {
      setIsDetectingFace(false);
    }
  };

  // Currently dragged handle and pointer tracking for Magnifier Loupe
  const [activeHandle, setActiveHandle] = useState<ActiveHandle | null>(null);
  const [pointerPos, setPointerPos] = useState<{ clientX: number; clientY: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragStartRef = useRef<{
    handle: ActiveHandle;
    startX: number;
    startY: number;
    startCorners: CornerPoints;
    startRect: RectBox;
  } | null>(null);

  // Initialize Corners to CamScanner-style smart document margin
  const initDocumentCorners = useCallback((w: number, h: number, style: 'smart' | 'full' | 'a4' | 'card' = 'smart') => {
    if (w <= 0 || h <= 0) return;

    if (style === 'full') {
      setCorners({
        tl: { x: 0, y: 0 },
        tr: { x: w, y: 0 },
        br: { x: w, y: h },
        bl: { x: 0, y: h },
      });
      return;
    }

    if (style === 'a4') {
      // Standard A4 aspect (1 : 1.414) centered
      const a4Ratio = 210 / 297;
      let targetW = w * 0.88;
      let targetH = targetW / a4Ratio;
      if (targetH > h * 0.9) {
        targetH = h * 0.9;
        targetW = targetH * a4Ratio;
      }
      const cx = (w - targetW) / 2;
      const cy = (h - targetH) / 2;
      setCorners({
        tl: { x: Math.round(cx), y: Math.round(cy) },
        tr: { x: Math.round(cx + targetW), y: Math.round(cy) },
        br: { x: Math.round(cx + targetW), y: Math.round(cy + targetH) },
        bl: { x: Math.round(cx), y: Math.round(cy + targetH) },
      });
      return;
    }

    if (style === 'card') {
      // Standard ID card ratio (85.6 : 53.98 ~ 1.586)
      const cardRatio = 85.6 / 53.98;
      let targetW = w * 0.85;
      let targetH = targetW / cardRatio;
      if (targetH > h * 0.85) {
        targetH = h * 0.85;
        targetW = targetH * cardRatio;
      }
      const cx = (w - targetW) / 2;
      const cy = (h - targetH) / 2;
      setCorners({
        tl: { x: Math.round(cx), y: Math.round(cy) },
        tr: { x: Math.round(cx + targetW), y: Math.round(cy) },
        br: { x: Math.round(cx + targetW), y: Math.round(cy + targetH) },
        bl: { x: Math.round(cx), y: Math.round(cy + targetH) },
      });
      return;
    }

    // Default 'smart' document margin: ~6% margin with natural perspective quad
    const mx = Math.round(w * 0.06);
    const my = Math.round(h * 0.06);
    setCorners({
      tl: { x: mx, y: my },
      tr: { x: w - mx, y: my },
      br: { x: w - mx, y: h - my },
      bl: { x: mx, y: h - my },
    });
  }, []);

  // Initialize Rectangular Crop Box
  const initRectBox = useCallback((w: number, h: number, ratio: AspectRatioOption = aspectRatio) => {
    if (w <= 0 || h <= 0) return;
    let targetW = w * 0.9;
    let targetH = h * 0.9;

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

    const x = Math.max(0, (w - targetW) / 2);
    const y = Math.max(0, (h - targetH) / 2);
    setRectBox({
      x: Math.round(x),
      y: Math.round(y),
      w: Math.round(targetW),
      h: Math.round(targetH),
    });
  }, [aspectRatio]);

  // Load natural dimensions
  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = imageUrl;
  }, [imageUrl]);

  // On image load in DOM
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    setDisplayedSize({ width: w, height: h });
    initDocumentCorners(w, h, 'smart');
    initRectBox(w, h, aspectRatio);
  };

  // Magnifier Loupe: update whenever activeHandle or pointerPos changes
  useEffect(() => {
    if (!activeHandle || !loupeCanvasRef.current || !imgRef.current) return;
    const canvas = loupeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;
    const cw = canvas.width;
    const ch = canvas.height;

    // Determine current point
    let targetPoint: Point | null = null;
    if (activeHandle === 'tl') targetPoint = corners.tl;
    else if (activeHandle === 'tr') targetPoint = corners.tr;
    else if (activeHandle === 'br') targetPoint = corners.br;
    else if (activeHandle === 'bl') targetPoint = corners.bl;
    else if (activeHandle === 'rect_nw') targetPoint = { x: rectBox.x, y: rectBox.y };
    else if (activeHandle === 'rect_ne') targetPoint = { x: rectBox.x + rectBox.w, y: rectBox.y };
    else if (activeHandle === 'rect_se') targetPoint = { x: rectBox.x + rectBox.w, y: rectBox.y + rectBox.h };
    else if (activeHandle === 'rect_sw') targetPoint = { x: rectBox.x, y: rectBox.y + rectBox.h };

    if (!targetPoint || displayedSize.width === 0 || displayedSize.height === 0) return;

    ctx.clearRect(0, 0, cw, ch);

    // Zoom factor 2.8x
    const zoom = 2.8;
    const srcRadiusW = (cw / (2 * zoom)) * (img.naturalWidth / displayedSize.width);
    const srcRadiusH = (ch / (2 * zoom)) * (img.naturalHeight / displayedSize.height);

    const normSrcX = targetPoint.x * (img.naturalWidth / displayedSize.width);
    const normSrcY = targetPoint.y * (img.naturalHeight / displayedSize.height);

    ctx.save();
    // Circle clipping mask
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, cw / 2 - 2, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(
      img,
      normSrcX - srcRadiusW,
      normSrcY - srcRadiusH,
      srcRadiusW * 2,
      srcRadiusH * 2,
      0,
      0,
      cw,
      ch
    );

    // Crosshair lines
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Horizontal
    ctx.moveTo(cw / 2 - 14, ch / 2);
    ctx.lineTo(cw / 2 + 14, ch / 2);
    // Vertical
    ctx.moveTo(cw / 2, ch / 2 - 14);
    ctx.lineTo(cw / 2, ch / 2 + 14);
    ctx.stroke();

    // Center dot
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(cw / 2, ch / 2, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [activeHandle, corners, rectBox, displayedSize]);

  // Pointer / Drag Event Handler
  const handleStartDrag = (
    e: React.MouseEvent | React.TouchEvent,
    handle: ActiveHandle
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setActiveHandle(handle);
    setPointerPos({ clientX, clientY });

    dragStartRef.current = {
      handle,
      startX: clientX,
      startY: clientY,
      startCorners: { ...corners },
      startRect: { ...rectBox },
    };

    const handlePointerMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (!dragStartRef.current) return;
      const curX = 'touches' in moveEvt ? moveEvt.touches[0].clientX : (moveEvt as MouseEvent).clientX;
      const curY = 'touches' in moveEvt ? moveEvt.touches[0].clientY : (moveEvt as MouseEvent).clientY;

      setPointerPos({ clientX: curX, clientY: curY });

      const deltaX = curX - dragStartRef.current.startX;
      const deltaY = curY - dragStartRef.current.startY;
      const { handle: dragType, startCorners, startRect } = dragStartRef.current;
      const maxW = displayedSize.width;
      const maxH = displayedSize.height;

      // 1. Perspective Crop Mode (CamScanner 4 Corner Pins)
      if (cropMode === 'perspective') {
        const clamp = (val: number, maxVal: number) => Math.max(0, Math.min(maxVal, val));

        if (dragType === 'tl') {
          setCorners((prev) => ({
            ...prev,
            tl: { x: clamp(startCorners.tl.x + deltaX, maxW), y: clamp(startCorners.tl.y + deltaY, maxH) },
          }));
        } else if (dragType === 'tr') {
          setCorners((prev) => ({
            ...prev,
            tr: { x: clamp(startCorners.tr.x + deltaX, maxW), y: clamp(startCorners.tr.y + deltaY, maxH) },
          }));
        } else if (dragType === 'br') {
          setCorners((prev) => ({
            ...prev,
            br: { x: clamp(startCorners.br.x + deltaX, maxW), y: clamp(startCorners.br.y + deltaY, maxH) },
          }));
        } else if (dragType === 'bl') {
          setCorners((prev) => ({
            ...prev,
            bl: { x: clamp(startCorners.bl.x + deltaX, maxW), y: clamp(startCorners.bl.y + deltaY, maxH) },
          }));
        } else if (dragType === 'edge_top') {
          // Drag top edge (moves both TL and TR together)
          setCorners((prev) => ({
            ...prev,
            tl: { x: clamp(startCorners.tl.x + deltaX, maxW), y: clamp(startCorners.tl.y + deltaY, maxH) },
            tr: { x: clamp(startCorners.tr.x + deltaX, maxW), y: clamp(startCorners.tr.y + deltaY, maxH) },
          }));
        } else if (dragType === 'edge_bottom') {
          // Drag bottom edge (moves both BL and BR together)
          setCorners((prev) => ({
            ...prev,
            bl: { x: clamp(startCorners.bl.x + deltaX, maxW), y: clamp(startCorners.bl.y + deltaY, maxH) },
            br: { x: clamp(startCorners.br.x + deltaX, maxW), y: clamp(startCorners.br.y + deltaY, maxH) },
          }));
        } else if (dragType === 'edge_left') {
          // Drag left edge (moves both TL and BL together)
          setCorners((prev) => ({
            ...prev,
            tl: { x: clamp(startCorners.tl.x + deltaX, maxW), y: clamp(startCorners.tl.y + deltaY, maxH) },
            bl: { x: clamp(startCorners.bl.x + deltaX, maxW), y: clamp(startCorners.bl.y + deltaY, maxH) },
          }));
        } else if (dragType === 'edge_right') {
          // Drag right edge (moves both TR and BR together)
          setCorners((prev) => ({
            ...prev,
            tr: { x: clamp(startCorners.tr.x + deltaX, maxW), y: clamp(startCorners.tr.y + deltaY, maxH) },
            br: { x: clamp(startCorners.br.x + deltaX, maxW), y: clamp(startCorners.br.y + deltaY, maxH) },
          }));
        }
        return;
      }

      // 2. Rectangular Crop Mode
      const minBoxSize = 30;
      let newX = startRect.x;
      let newY = startRect.y;
      let newW = startRect.w;
      let newH = startRect.h;

      if (dragType === 'rect_move') {
        newX = Math.min(Math.max(0, startRect.x + deltaX), maxW - startRect.w);
        newY = Math.min(Math.max(0, startRect.y + deltaY), maxH - startRect.h);
      } else {
        if (dragType.includes('e')) newW = Math.max(minBoxSize, Math.min(startRect.w + deltaX, maxW - startRect.x));
        if (dragType.includes('s')) newH = Math.max(minBoxSize, Math.min(startRect.h + deltaY, maxH - startRect.y));
        if (dragType.includes('w')) {
          const right = startRect.x + startRect.w;
          newX = Math.max(0, Math.min(right - minBoxSize, startRect.x + deltaX));
          newW = right - newX;
        }
        if (dragType.includes('n')) {
          const bottom = startRect.y + startRect.h;
          newY = Math.max(0, Math.min(bottom - minBoxSize, startRect.y + deltaY));
          newH = bottom - newY;
        }
      }

      setRectBox({
        x: Math.round(newX),
        y: Math.round(newY),
        w: Math.round(newW),
        h: Math.round(newH),
      });
    };

    const handlePointerUp = () => {
      setActiveHandle(null);
      setPointerPos(null);
      dragStartRef.current = null;
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

  // Midpoint edge handles calculation for CamScanner quad
  const midTop = { x: (corners.tl.x + corners.tr.x) / 2, y: (corners.tl.y + corners.tr.y) / 2 };
  const midRight = { x: (corners.tr.x + corners.br.x) / 2, y: (corners.tr.y + corners.br.y) / 2 };
  const midBottom = { x: (corners.bl.x + corners.br.x) / 2, y: (corners.bl.y + corners.br.y) / 2 };
  const midLeft = { x: (corners.tl.x + corners.bl.x) / 2, y: (corners.tl.y + corners.bl.y) / 2 };

  // Calculate estimated output dimensions in 4K original image resolution
  const getCalculatedOutputSize = () => {
    if (displayedSize.width === 0 || displayedSize.height === 0 || naturalSize.width === 0) {
      return { width: 0, height: 0 };
    }
    const scaleX = naturalSize.width / displayedSize.width;
    const scaleY = naturalSize.height / displayedSize.height;

    if (cropMode === 'perspective') {
      const pTL = { x: corners.tl.x * scaleX, y: corners.tl.y * scaleY };
      const pTR = { x: corners.tr.x * scaleX, y: corners.tr.y * scaleY };
      const pBR = { x: corners.br.x * scaleX, y: corners.br.y * scaleY };
      const pBL = { x: corners.bl.x * scaleX, y: corners.bl.y * scaleY };

      const topW = Math.hypot(pTR.x - pTL.x, pTR.y - pTL.y);
      const bottomW = Math.hypot(pBR.x - pBL.x, pBR.y - pBL.y);
      const leftH = Math.hypot(pBL.x - pTL.x, pBL.y - pTL.y);
      const rightH = Math.hypot(pBR.x - pTR.x, pBR.y - pTR.y);

      return {
        width: Math.round(Math.max(topW, bottomW)),
        height: Math.round(Math.max(leftH, rightH)),
      };
    } else {
      return {
        width: Math.round(rectBox.w * scaleX),
        height: Math.round(rectBox.h * scaleY),
      };
    }
  };

  const outputDim = getCalculatedOutputSize();
  const is4K = outputDim.width >= 3000 || outputDim.height >= 3000 || (outputDim.width * outputDim.height >= 6000000);

  // Document Filters: Magic Color, B&W Xerox, Sharpen
  const applyDocFilter = (
    pixels: Uint8ClampedArray,
    w: number,
    h: number,
    filter: DocFilter,
    threshold: number = bwThreshold,
    subMode: 'smooth' | 'adaptive' = bwSubMode
  ) => {
    if (filter === 'original') return;

    const len = w * h * 4;

    if (filter === 'magic') {
      // CamScanner Magic Color: whitens paper background, sharpens text, preserves vibrant colors
      for (let i = 0; i < len; i += 4) {
        let r = pixels[i];
        let g = pixels[i + 1];
        let b = pixels[i + 2];

        // S-curve contrast boost
        r = Math.min(255, Math.max(0, Math.round((r - 128) * 1.32 + 152)));
        g = Math.min(255, Math.max(0, Math.round((g - 128) * 1.32 + 152)));
        b = Math.min(255, Math.max(0, Math.round((b - 128) * 1.32 + 152)));

        // Keep colored stamps/seals vivid
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = Math.min(255, Math.max(0, Math.round(gray + 1.2 * (r - gray))));
        g = Math.min(255, Math.max(0, Math.round(gray + 1.2 * (g - gray))));
        b = Math.min(255, Math.max(0, Math.round(gray + 1.2 * (b - gray))));

        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
      }
    } else if (filter === 'bw') {
      // High-quality B&W Document / Xerox with adjustable threshold & smooth knee transition
      // Prevents text, handwriting, or pencil marks from bleaching to pure white
      if (subMode === 'smooth') {
        // Continuous-tone high contrast grayscale (never bleaches out light text/pencil)
        for (let i = 0; i < len; i += 4) {
          const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          const norm = (lum - threshold) / 52;
          const sig = 1 / (1 + Math.exp(-norm));
          const val = Math.min(255, Math.max(0, Math.round(sig * 220 + lum * 0.14)));
          pixels[i] = val;
          pixels[i + 1] = val;
          pixels[i + 2] = val;
        }
      } else {
        // Biometric Xerox / Clean Document Scan with adjustable threshold & smooth transition knee
        const knee = 30;
        const lower = Math.max(10, threshold - knee);
        const upper = Math.min(250, threshold + knee);
        const range = upper - lower;

        for (let i = 0; i < len; i += 4) {
          const lum = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          let val: number;
          if (lum <= lower) {
            val = Math.max(0, Math.round((lum / lower) * 35));
          } else if (lum >= upper) {
            val = 255;
          } else {
            const factor = (lum - lower) / range;
            val = Math.round(35 + factor * 220);
          }
          pixels[i] = val;
          pixels[i + 1] = val;
          pixels[i + 2] = val;
        }
      }
    } else if (filter === 'sharp') {
      // Ultra sharp document text
      for (let i = 0; i < len; i += 4) {
        let r = pixels[i];
        let g = pixels[i + 1];
        let b = pixels[i + 2];
        r = Math.min(255, Math.max(0, Math.round((r - 128) * 1.22 + 132)));
        g = Math.min(255, Math.max(0, Math.round((g - 128) * 1.22 + 132)));
        b = Math.min(255, Math.max(0, Math.round((b - 128) * 1.22 + 132)));
        pixels[i] = r;
        pixels[i + 1] = g;
        pixels[i + 2] = b;
      }
    }
  };

  // Perform Homography Perspective Warp (OpenCV warpPerspective algorithm in pure Canvas)
  const generateProcessedCanvas = async (): Promise<HTMLCanvasElement> => {
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

          // 1. Perspective Crop Mode (Doc Scanner Warp & Deskew)
          if (cropMode === 'perspective') {
            const pTL = { x: corners.tl.x * scaleX, y: corners.tl.y * scaleY };
            const pTR = { x: corners.tr.x * scaleX, y: corners.tr.y * scaleY };
            const pBR = { x: corners.br.x * scaleX, y: corners.br.y * scaleY };
            const pBL = { x: corners.bl.x * scaleX, y: corners.bl.y * scaleY };

            const topW = Math.hypot(pTR.x - pTL.x, pTR.y - pTL.y);
            const bottomW = Math.hypot(pBR.x - pBL.x, pBR.y - pBL.y);
            const leftH = Math.hypot(pBL.x - pTL.x, pBL.y - pTL.y);
            const rightH = Math.hypot(pBR.x - pTR.x, pBR.y - pTR.y);

            let destW = Math.max(10, Math.round(Math.max(topW, bottomW)));
            let destH = Math.max(10, Math.round(Math.max(leftH, rightH)));

            // Swap dimensions if rotated 90 or 270 deg
            const normRot = ((rotation % 360) + 360) % 360;
            const isRot90or270 = normRot === 90 || normRot === 270;

            // Source offscreen canvas to sample pixels
            const srcCanvas = document.createElement('canvas');
            srcCanvas.width = naturalSize.width;
            srcCanvas.height = naturalSize.height;
            const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
            if (!srcCtx) throw new Error('Canvas 2D context error');
            srcCtx.drawImage(img, 0, 0);

            const srcData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
            const srcPixels = srcData.data;
            const srcW = srcCanvas.width;
            const srcH = srcCanvas.height;

            // Destination warp canvas
            const destCanvas = document.createElement('canvas');
            destCanvas.width = destW;
            destCanvas.height = destH;
            const destCtx = destCanvas.getContext('2d', { willReadFrequently: true });
            if (!destCtx) throw new Error('Canvas 2D context error');

            const destData = destCtx.createImageData(destW, destH);
            const destPixels = destData.data;

            // Solve Homography Projective Matrix mapping (u, v) in [0, 1]^2 to quadrilateral (pTL, pTR, pBR, pBL)
            const x0 = pTL.x, y0 = pTL.y;
            const x1 = pTR.x, y1 = pTR.y;
            const x2 = pBR.x, y2 = pBR.y;
            const x3 = pBL.x, y3 = pBL.y;

            const dx1 = x1 - x2;
            const dx2 = x3 - x2;
            const sx = x0 - x1 + x2 - x3;

            const dy1 = y1 - y2;
            const dy2 = y3 - y2;
            const sy = y0 - y1 + y2 - y3;

            let a = 0, b = 0, c = 0, d = 0, e = 0, f = 0, g = 0, h = 0;

            if (Math.abs(sx) < 1e-4 && Math.abs(sy) < 1e-4) {
              a = x1 - x0; b = x3 - x0; c = x0;
              d = y1 - y0; e = y3 - y0; f = y0;
              g = 0; h = 0;
            } else {
              const det = dx1 * dy2 - dx2 * dy1;
              if (Math.abs(det) < 1e-7) {
                a = x1 - x0; b = x3 - x0; c = x0;
                d = y1 - y0; e = y3 - y0; f = y0;
              } else {
                g = (sx * dy2 - sy * dx2) / det;
                h = (dx1 * sy - dy1 * sx) / det;
                a = x1 - x0 + g * x1;
                b = x3 - x0 + h * x3;
                c = x0;
                d = y1 - y0 + g * y1;
                e = y3 - y0 + h * y3;
                f = y0;
              }
            }

            const invDestW = 1 / destW;
            const invDestH = 1 / destH;

            // Bilinear sampling warp loop
            for (let y = 0; y < destH; y++) {
              const v = y * invDestH;
              const rowOffset = y * destW * 4;

              for (let x = 0; x < destW; x++) {
                const u = x * invDestW;
                const denom = g * u + h * v + 1;
                const srcX = (a * u + b * v + c) / denom;
                const srcY = (d * u + e * v + f) / denom;
                const idx = rowOffset + x * 4;

                if (srcX < 0 || srcX >= srcW - 1 || srcY < 0 || srcY >= srcH - 1) {
                  const cx = Math.max(0, Math.min(srcW - 1, Math.round(srcX)));
                  const cy = Math.max(0, Math.min(srcH - 1, Math.round(srcY)));
                  const sIdx = (cy * srcW + cx) * 4;
                  destPixels[idx] = srcPixels[sIdx];
                  destPixels[idx + 1] = srcPixels[sIdx + 1];
                  destPixels[idx + 2] = srcPixels[sIdx + 2];
                  destPixels[idx + 3] = 255;
                  continue;
                }

                const x0i = srcX | 0;
                const y0i = srcY | 0;
                const fx = srcX - x0i;
                const fy = srcY - y0i;
                const fx1 = 1 - fx;
                const fy1 = 1 - fy;

                const w00 = fx1 * fy1;
                const w10 = fx * fy1;
                const w01 = fx1 * fy;
                const w11 = fx * fy;

                const s00 = (y0i * srcW + x0i) * 4;
                const s10 = s00 + 4;
                const s01 = ((y0i + 1) * srcW + x0i) * 4;
                const s11 = s01 + 4;

                destPixels[idx] = (srcPixels[s00] * w00 + srcPixels[s10] * w10 + srcPixels[s01] * w01 + srcPixels[s11] * w11) | 0;
                destPixels[idx + 1] = (srcPixels[s00 + 1] * w00 + srcPixels[s10 + 1] * w10 + srcPixels[s01 + 1] * w01 + srcPixels[s11 + 1] * w11) | 0;
                destPixels[idx + 2] = (srcPixels[s00 + 2] * w00 + srcPixels[s10 + 2] * w10 + srcPixels[s01 + 2] * w01 + srcPixels[s11 + 2] * w11) | 0;
                destPixels[idx + 3] = 255;
              }
            }

            // Apply Document Filter (Magic Color / B&W / Sharp)
            applyDocFilter(destPixels, destW, destH, docFilter, bwThreshold, bwSubMode);
            destCtx.putImageData(destData, 0, 0);

            // Apply rotation and flip if specified
            if (normRot !== 0 || flipH) {
              const rotCanvas = document.createElement('canvas');
              rotCanvas.width = isRot90or270 ? destH : destW;
              rotCanvas.height = isRot90or270 ? destW : destH;
              const rotCtx = rotCanvas.getContext('2d')!;
              rotCtx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
              if (normRot !== 0) rotCtx.rotate((normRot * Math.PI) / 180);
              if (flipH) rotCtx.scale(-1, 1);
              rotCtx.drawImage(destCanvas, -destW / 2, -destH / 2);
              resolve(rotCanvas);
            } else {
              resolve(destCanvas);
            }
          } else {
            // 2. Rectangular Crop Mode
            const sourceCropX = Math.max(0, rectBox.x * scaleX);
            const sourceCropY = Math.max(0, rectBox.y * scaleY);
            const sourceCropW = Math.min(naturalSize.width - sourceCropX, rectBox.w * scaleX);
            const sourceCropH = Math.min(naturalSize.height - sourceCropY, rectBox.h * scaleY);

            const normRot = ((rotation % 360) + 360) % 360;
            const isRot90or270 = normRot === 90 || normRot === 270;

            const finalW = Math.round(isRot90or270 ? sourceCropH : sourceCropW);
            const finalH = Math.round(isRot90or270 ? sourceCropW : sourceCropH);

            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, finalW);
            canvas.height = Math.max(1, finalH);
            const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            if (normRot !== 0) ctx.rotate((normRot * Math.PI) / 180);
            if (flipH) ctx.scale(-1, 1);

            const drawW = isRot90or270 ? canvas.height : canvas.width;
            const drawH = isRot90or270 ? canvas.width : canvas.height;

            ctx.drawImage(img, sourceCropX, sourceCropY, sourceCropW, sourceCropH, -drawW / 2, -drawH / 2, drawW, drawH);
            ctx.restore();

            // Apply filter
            if (docFilter !== 'original') {
              const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              applyDocFilter(imgData.data, canvas.width, canvas.height, docFilter, bwThreshold, bwSubMode);
              ctx.putImageData(imgData, 0, 0);
            }

            resolve(canvas);
          }
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error('Failed to load image.'));
      img.src = imageUrl;
    });
  };

  // Live CSS filter for instant workspace feedback as user adjusts sliders
  const getDisplayFilterStyle = () => {
    if (docFilter === 'original') return undefined;
    if (docFilter === 'magic') {
      return 'contrast(125%) brightness(108%) saturate(115%)';
    }
    if (docFilter === 'sharp') {
      return 'contrast(125%) brightness(102%)';
    }
    if (docFilter === 'bw') {
      if (bwSubMode === 'smooth') {
        const contrast = Math.round(110 + (bwThreshold - 90) * 0.45);
        const brightness = Math.round(100 + (110 - bwThreshold) * 0.2);
        return `grayscale(100%) contrast(${contrast}%) brightness(${brightness}%)`;
      } else {
        const contrast = Math.round(140 + (bwThreshold - 90) * 0.65);
        const brightness = Math.round(100 + (110 - bwThreshold) * 0.25);
        return `grayscale(100%) contrast(${contrast}%) brightness(${brightness}%)`;
      }
    }
    return undefined;
  };

  // Re-render live flattened preview if user changes B/W threshold or mode while in preview
  useEffect(() => {
    if (showLivePreview) {
      let isSubscribed = true;
      generateProcessedCanvas()
        .then((canvas) => {
          if (isSubscribed) {
            setLivePreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
          }
        })
        .catch(console.error);
      return () => {
        isSubscribed = false;
      };
    }
  }, [bwThreshold, bwSubMode, docFilter]);

  // Live Deskew Preview Toggle
  const handleToggleLivePreview = async () => {
    if (showLivePreview) {
      setShowLivePreview(false);
      return;
    }
    setIsProcessing(true);
    try {
      const canvas = await generateProcessedCanvas();
      setLivePreviewUrl(canvas.toDataURL('image/jpeg', 0.9));
      setShowLivePreview(true);
    } catch (err) {
      console.error('Error generating preview:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Apply Crop and close modal
  const handleApply = async () => {
    setIsProcessing(true);
    try {
      const canvas = await generateProcessedCanvas();
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

  // Direct 4K Download
  const handleDirectDownload = async () => {
    setIsProcessing(true);
    try {
      const canvas = await generateProcessedCanvas();
      const mime = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
      const ext = exportFormat === 'jpeg' ? 'jpg' : 'png';
      const quality = exportFormat === 'jpeg' ? 0.96 : undefined;
      const dataUrl = canvas.toDataURL(mime, quality);

      const link = document.createElement('a');
      link.href = dataUrl;
      const safeTitle = (imageTitle || 'scanned_doc').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `${safeTitle}_doc_scan_4k.${ext}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error downloading:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[96vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
              <FileCheck className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-white truncate flex items-center gap-2">
                <span>
                  {language === 'hi' ? 'दस्तावेज़ स्कैनर क्रॉप (Doc Scanner Crop)' : 'Document Scanner & Perspective Crop'}
                </span>
                {is4K ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                    4K Ultra HD
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                    HD Deskew
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {language === 'hi'
                  ? 'चारों कोनों को खींचकर तिरछे दस्तावेज़ को सीधा और सपाट करें'
                  : 'Drag the 4 corner pins to deskew and straighten angled paper'}
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

        {/* Mode Selector Tabs (Doc Perspective vs Box Crop) & Document Filters */}
        <div className="px-3 sm:px-4 py-2 bg-slate-950/80 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Crop Mode Switcher */}
          <div className="flex items-center bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => {
                setCropMode('perspective');
                setShowLivePreview(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                cropMode === 'perspective'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'दस्तावेज़ (4 कोने)' : 'Doc Scanner (4-Pins)'}</span>
            </button>
            <button
              onClick={() => {
                setCropMode('rect');
                setShowLivePreview(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                cropMode === 'rect'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              <span>{language === 'hi' ? 'साधारण बॉक्स' : 'Box Crop'}</span>
            </button>
          </div>

          {/* Quick Fit Presets (Perspective Mode) */}
          {cropMode === 'perspective' && !showLivePreview && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[11px] text-slate-400 mr-1 hidden md:inline">
                {language === 'hi' ? 'फिटिंग:' : 'Presets:'}
              </span>
              <button
                onClick={() => initDocumentCorners(displayedSize.width, displayedSize.height, 'smart')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors"
                title={language === 'hi' ? 'दस्तावेज़ मार्जिन पर ऑटो फिट' : 'Auto fit doc margins'}
              >
                {language === 'hi' ? '✨ ऑटो फिट' : '✨ Auto Fit'}
              </button>
              <button
                onClick={() => initDocumentCorners(displayedSize.width, displayedSize.height, 'a4')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors"
              >
                A4 Paper
              </button>
              <button
                onClick={() => initDocumentCorners(displayedSize.width, displayedSize.height, 'card')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors"
              >
                ID Card
              </button>
              <button
                onClick={() => initDocumentCorners(displayedSize.width, displayedSize.height, 'full')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-medium transition-colors"
              >
                Full Image
              </button>
              <button
                onClick={handleAutoPassportFaceCrop}
                disabled={isDetectingFace}
                className="px-2 py-1 rounded-lg bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-300 text-[11px] font-bold border border-amber-500/40 flex items-center gap-1 shadow-sm transition-all"
                title="Auto detect face area and crop to passport size"
              >
                {isDetectingFace ? (
                  <Loader2 className="w-3 h-3 text-amber-300 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-amber-400" />
                )}
                <span>{language === 'hi' ? '✨ पासपोर्ट फेस' : '✨ Passport Face'}</span>
              </button>
            </div>
          )}

          {/* Aspect Ratios (Rect Mode) */}
          {cropMode === 'rect' && !showLivePreview && (
            <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={handleAutoPassportFaceCrop}
                disabled={isDetectingFace}
                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600/30 to-orange-600/30 hover:from-amber-600/50 hover:to-orange-600/50 text-amber-300 text-[11px] font-bold border border-amber-500/40 flex items-center gap-1 shadow-sm transition-all mr-1"
                title="Auto detect face area and crop to passport size"
              >
                {isDetectingFace ? (
                  <Loader2 className="w-3 h-3 text-amber-300 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3 text-amber-400" />
                )}
                <span>{language === 'hi' ? '✨ पासपोर्ट फेस क्रॉप' : '✨ Passport Face'}</span>
              </button>
              {[
                { id: 'free', label: 'Free' },
                { id: '1:1', label: '1:1' },
                { id: '4:3', label: '4:3' },
                { id: '3:4', label: '3:4' },
                { id: '16:9', label: '16:9' },
                { id: 'a4_p', label: 'A4' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setAspectRatio(opt.id as AspectRatioOption);
                    initRectBox(displayedSize.width, displayedSize.height, opt.id as AspectRatioOption);
                  }}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    aspectRatio === opt.id
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800/80 text-slate-300 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* Document Filters (CamScanner style) */}
          <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 px-1 hidden lg:inline">
              {language === 'hi' ? 'फ़िल्टर:' : 'Filter:'}
            </span>
            <button
              onClick={() => setDocFilter('original')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                docFilter === 'original' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {language === 'hi' ? 'मूल' : 'Original'}
            </button>
            <button
              onClick={() => setDocFilter('magic')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all ${
                docFilter === 'magic'
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              <Wand2 className="w-3 h-3" />
              <span>{language === 'hi' ? 'मैजिक कलर' : 'Magic Color'}</span>
            </button>
            <button
              onClick={() => setDocFilter('bw')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                docFilter === 'bw' ? 'bg-slate-200 text-slate-900' : 'text-slate-400 hover:text-white'
              }`}
            >
              {language === 'hi' ? 'B&W ज़ेरॉक्स' : 'B&W Xerox'}
            </button>
            <button
              onClick={() => setDocFilter('sharp')}
              className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                docFilter === 'sharp' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {language === 'hi' ? 'सुपर शार्प' : 'Sharp'}
            </button>
          </div>

          {/* Rotate & Live Preview Buttons */}
          <div className="flex items-center gap-1.5 ml-auto">
            <button
              onClick={handleToggleLivePreview}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all border ${
                showLivePreview
                  ? 'bg-cyan-600 text-white border-cyan-500 shadow-sm'
                  : 'bg-slate-800 hover:bg-slate-700 text-cyan-300 border-slate-700'
              }`}
              title={language === 'hi' ? 'सीधा किया हुआ दस्तावेज़ देखें' : 'Preview straightened document'}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{showLivePreview ? (language === 'hi' ? 'कोने संपादित करें' : 'Edit Pins') : (language === 'hi' ? 'फ्लैट पूर्वावलोकन' : 'Preview')}</span>
            </button>

            <button
              onClick={() => setRotation((r) => (r + 90) % 360)}
              title={language === 'hi' ? '90° घुमाएं' : 'Rotate 90°'}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs flex items-center gap-1"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setFlipH((f) => !f)}
              title="Flip Horizontal"
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 ${
                flipH ? 'bg-emerald-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
              }`}
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dedicated B/W Ink & Contrast Control Drawer */}
        {docFilter === 'bw' && (
          <div className="px-3 sm:px-4 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2.5 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
            {/* Mode: Soft Grayscale (No text bleach) vs Sharp Xerox */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                {language === 'hi' ? 'B/W स्तर:' : 'B/W Level:'}
              </span>
              <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 text-[10px]">
                <button
                  type="button"
                  onClick={() => setBwSubMode('smooth')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                    bwSubMode === 'smooth'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={language === 'hi' ? 'सॉफ्ट ग्रेस्केल: हल्का टेक्स्ट या पेंसिल कभी गायब नहीं होगी' : 'Soft Grayscale: light text & pencil never get bleached'}
                >
                  <FileText className="w-3 h-3" />
                  <span>{language === 'hi' ? 'सॉफ्ट ग्रेस्केल (सुरक्षित टेक्स्ट)' : 'Soft Grayscale'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setBwSubMode('adaptive')}
                  className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                    bwSubMode === 'adaptive'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title={language === 'hi' ? 'शार्प ज़ेरॉक्स: एडजस्टेबल ब्लैक एंड व्हाइट' : 'Sharp Xerox with adjustable threshold'}
                >
                  <FileCheck className="w-3 h-3" />
                  <span>{language === 'hi' ? 'शार्प ज़ेरॉक्स' : 'Sharp Xerox'}</span>
                </button>
              </div>
            </div>

            {/* Slider: Ink Darkness / Threshold */}
            <div className="flex items-center gap-2.5 flex-1 min-w-[260px] max-w-lg bg-slate-900/90 px-3 py-1.5 rounded-xl border border-slate-800">
              <span className="text-[10px] text-slate-400 font-medium shrink-0">
                {language === 'hi' ? 'गहरी स्याही (Dark)' : 'Dark Ink'}
              </span>
              <input
                type="range"
                min="45"
                max="200"
                step="2"
                value={bwThreshold}
                onChange={(e) => setBwThreshold(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400 hover:accent-emerald-300"
                title={language === 'hi' ? 'कम करने पर हल्का टेक्स्ट भी साफ दिखेगा, ज्यादा करने पर बैकग्राउंड सफेद होगा' : 'Lower = darker text preserved; Higher = whiter background'}
              />
              <span className="text-[10px] text-slate-400 font-medium shrink-0">
                {language === 'hi' ? 'सफेद बैकग्राउंड (White)' : 'White Paper'}
              </span>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 shrink-0 min-w-[36px] text-center">
                {bwThreshold}
              </span>
            </div>

            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => {
                  setBwThreshold(70);
                  setBwSubMode('smooth');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                  bwThreshold === 70 && bwSubMode === 'smooth'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
                title={language === 'hi' ? 'हल्का लिखा हुआ, पेंसिल या धुंधला टेक्स्ट बचाएं' : 'Preserve faint handwriting & light pencil'}
              >
                ✍️ {language === 'hi' ? 'हल्का टेक्स्ट बचाएं' : 'Faint Text'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setBwThreshold(110);
                  setBwSubMode('smooth');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                  bwThreshold === 110 && bwSubMode === 'smooth'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                ⚖️ {language === 'hi' ? 'संतुलित' : 'Balanced'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setBwThreshold(155);
                  setBwSubMode('adaptive');
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-colors ${
                  bwThreshold === 155 && bwSubMode === 'adaptive'
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50'
                    : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
                }`}
              >
                🖨️ {language === 'hi' ? 'डार्क ज़ेरॉक्स' : 'Dark Xerox'}
              </button>
            </div>
          </div>
        )}

        {/* Cropper Canvas Workspace */}
        <div
          ref={containerRef}
          className="relative flex-1 bg-slate-950 p-2 sm:p-6 overflow-hidden flex items-center justify-center select-none min-h-[320px] sm:min-h-[440px]"
        >
          {/* Face Detection Alert Toast */}
          {faceAlert && (
            <div className="absolute top-4 inset-x-4 z-40 flex justify-center pointer-events-none">
              <div className="bg-slate-900/95 border border-amber-500/50 text-amber-200 px-3.5 py-1.5 rounded-full text-xs font-semibold shadow-2xl backdrop-blur-md flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-150">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{faceAlert}</span>
              </div>
            </div>
          )}

          {/* Live Preview Mode (Showing the flattened document) */}
          {showLivePreview && livePreviewUrl ? (
            <div className="flex flex-col items-center justify-center max-w-full max-h-[62vh] animate-in fade-in zoom-in-95 duration-150">
              <div className="relative border border-emerald-500/50 rounded-lg shadow-2xl overflow-hidden bg-white">
                <img
                  src={livePreviewUrl}
                  alt="Flattened Preview"
                  className="max-h-[58vh] max-w-full object-contain block"
                />
                <div className="absolute top-2 left-2 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded text-[11px] font-bold text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <Check className="w-3 h-3 text-emerald-400" />
                  {language === 'hi' ? 'सीधा व सपाट दस्तावेज़' : 'Deskewed & Straightened'}
                </div>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                {language === 'hi'
                  ? 'अगर यह सही है तो नीचे "क्रॉप लागू करें" पर क्लिक करें, या कोने बदलने के लिए "कोने संपादित करें" दबाएं।'
                  : 'Looks straight? Click "Apply Crop" below or "Edit Pins" to refine.'}
              </p>
            </div>
          ) : (
            /* Interactive Workspace with 4 Corner Pins & Loupe */
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
                  filter: getDisplayFilterStyle(),
                  maxHeight: '60vh',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  display: 'block',
                }}
                className="rounded-lg shadow-md transition-transform duration-150 pointer-events-none select-none"
              />

              {/* 1. DOCUMENT PERSPECTIVE CROP OVERLAY (4 Corner Pins & Quad Polygon) */}
              {cropMode === 'perspective' && displayedSize.width > 0 && displayedSize.height > 0 && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  viewBox={`0 0 ${displayedSize.width} ${displayedSize.height}`}
                >
                  <defs>
                    <mask id="doc-quad-cutout">
                      <rect width={displayedSize.width} height={displayedSize.height} fill="white" />
                      <polygon
                        points={`${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${corners.br.x},${corners.br.y} ${corners.bl.x},${corners.bl.y}`}
                        fill="black"
                      />
                    </mask>
                  </defs>

                  {/* Dark mask outside quadrilateral */}
                  <rect
                    width={displayedSize.width}
                    height={displayedSize.height}
                    fill="rgba(2, 6, 23, 0.70)"
                    mask="url(#doc-quad-cutout)"
                  />

                  {/* Quad boundary lines */}
                  <polygon
                    points={`${corners.tl.x},${corners.tl.y} ${corners.tr.x},${corners.tr.y} ${corners.br.x},${corners.br.y} ${corners.bl.x},${corners.bl.y}`}
                    fill="rgba(16, 185, 129, 0.08)"
                    stroke="#10b981"
                    strokeWidth="2.5"
                    strokeDasharray="none"
                  />

                  {/* Perspective grid lines for document alignment */}
                  <line
                    x1={(corners.tl.x * 2 + corners.bl.x) / 3}
                    y1={(corners.tl.y * 2 + corners.bl.y) / 3}
                    x2={(corners.tr.x * 2 + corners.br.x) / 3}
                    y2={(corners.tr.y * 2 + corners.br.y) / 3}
                    stroke="rgba(52, 211, 153, 0.35)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={(corners.tl.x + corners.bl.x * 2) / 3}
                    y1={(corners.tl.y + corners.bl.y * 2) / 3}
                    x2={(corners.tr.x + corners.br.x * 2) / 3}
                    y2={(corners.tr.y + corners.br.y * 2) / 3}
                    stroke="rgba(52, 211, 153, 0.35)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={(corners.tl.x * 2 + corners.tr.x) / 3}
                    y1={(corners.tl.y * 2 + corners.tr.y) / 3}
                    x2={(corners.bl.x * 2 + corners.br.x) / 3}
                    y2={(corners.bl.y * 2 + corners.br.y) / 3}
                    stroke="rgba(52, 211, 153, 0.35)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={(corners.tl.x + corners.tr.x * 2) / 3}
                    y1={(corners.tl.y + corners.tr.y * 2) / 3}
                    x2={(corners.bl.x + corners.br.x * 2) / 3}
                    y2={(corners.bl.y + corners.br.y * 2) / 3}
                    stroke="rgba(52, 211, 153, 0.35)"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                </svg>
              )}

              {/* 4 Corner Pin Handles & Midpoint Handles */}
              {cropMode === 'perspective' && displayedSize.width > 0 && displayedSize.height > 0 && (
                <>
                  {/* Top-Left Corner Pin */}
                  <div
                    style={{ left: `${corners.tl.x}px`, top: `${corners.tl.y}px` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-move touch-none z-30 group"
                    onMouseDown={(e) => handleStartDrag(e, 'tl')}
                    onTouchStart={(e) => handleStartDrag(e, 'tl')}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-lg shadow-emerald-500/50 flex items-center justify-center group-hover:scale-125 transition-transform">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                    </div>
                  </div>

                  {/* Top-Right Corner Pin */}
                  <div
                    style={{ left: `${corners.tr.x}px`, top: `${corners.tr.y}px` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-move touch-none z-30 group"
                    onMouseDown={(e) => handleStartDrag(e, 'tr')}
                    onTouchStart={(e) => handleStartDrag(e, 'tr')}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-lg shadow-emerald-500/50 flex items-center justify-center group-hover:scale-125 transition-transform">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                    </div>
                  </div>

                  {/* Bottom-Right Corner Pin */}
                  <div
                    style={{ left: `${corners.br.x}px`, top: `${corners.br.y}px` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-move touch-none z-30 group"
                    onMouseDown={(e) => handleStartDrag(e, 'br')}
                    onTouchStart={(e) => handleStartDrag(e, 'br')}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-lg shadow-emerald-500/50 flex items-center justify-center group-hover:scale-125 transition-transform">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                    </div>
                  </div>

                  {/* Bottom-Left Corner Pin */}
                  <div
                    style={{ left: `${corners.bl.x}px`, top: `${corners.bl.y}px` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-move touch-none z-30 group"
                    onMouseDown={(e) => handleStartDrag(e, 'bl')}
                    onTouchStart={(e) => handleStartDrag(e, 'bl')}
                  >
                    <div className="w-5 h-5 rounded-full bg-emerald-400 border-2 border-slate-950 shadow-lg shadow-emerald-500/50 flex items-center justify-center group-hover:scale-125 transition-transform">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-950" />
                    </div>
                  </div>

                  {/* 4 Midpoint Edge Handles (Drag entire edge) */}
                  <div
                    style={{ left: `${midTop.x}px`, top: `${midTop.y}px` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-ns-resize touch-none z-20"
                    onMouseDown={(e) => handleStartDrag(e, 'edge_top')}
                    onTouchStart={(e) => handleStartDrag(e, 'edge_top')}
                  >
                    <div className="w-5 h-2 rounded bg-emerald-400/90 border border-slate-900 shadow hover:scale-110" />
                  </div>
                  <div
                    style={{ left: `${midRight.x}px`, top: `${midRight.y}px` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-ew-resize touch-none z-20"
                    onMouseDown={(e) => handleStartDrag(e, 'edge_right')}
                    onTouchStart={(e) => handleStartDrag(e, 'edge_right')}
                  >
                    <div className="w-2 h-5 rounded bg-emerald-400/90 border border-slate-900 shadow hover:scale-110" />
                  </div>
                  <div
                    style={{ left: `${midBottom.x}px`, top: `${midBottom.y}px` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-ns-resize touch-none z-20"
                    onMouseDown={(e) => handleStartDrag(e, 'edge_bottom')}
                    onTouchStart={(e) => handleStartDrag(e, 'edge_bottom')}
                  >
                    <div className="w-5 h-2 rounded bg-emerald-400/90 border border-slate-900 shadow hover:scale-110" />
                  </div>
                  <div
                    style={{ left: `${midLeft.x}px`, top: `${midLeft.y}px` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-ew-resize touch-none z-20"
                    onMouseDown={(e) => handleStartDrag(e, 'edge_left')}
                    onTouchStart={(e) => handleStartDrag(e, 'edge_left')}
                  >
                    <div className="w-2 h-5 rounded bg-emerald-400/90 border border-slate-900 shadow hover:scale-110" />
                  </div>
                </>
              )}

              {/* 2. RECTANGULAR CROP OVERLAY (For Standard Mode) */}
              {cropMode === 'rect' && displayedSize.width > 0 && displayedSize.height > 0 && (
                <>
                  <svg
                    className="absolute inset-0 w-full h-full pointer-events-none"
                    viewBox={`0 0 ${displayedSize.width} ${displayedSize.height}`}
                  >
                    <defs>
                      <mask id="rect-crop-cutout">
                        <rect width={displayedSize.width} height={displayedSize.height} fill="white" />
                        <rect x={rectBox.x} y={rectBox.y} width={rectBox.w} height={rectBox.h} fill="black" />
                      </mask>
                    </defs>
                    <rect
                      width={displayedSize.width}
                      height={displayedSize.height}
                      fill="rgba(2, 6, 23, 0.70)"
                      mask="url(#rect-crop-cutout)"
                    />
                  </svg>

                  <div
                    style={{
                      left: `${rectBox.x}px`,
                      top: `${rectBox.y}px`,
                      width: `${rectBox.w}px`,
                      height: `${rectBox.h}px`,
                    }}
                    className="absolute border-2 border-emerald-400 shadow-2xl cursor-move touch-none z-30"
                    onMouseDown={(e) => handleStartDrag(e, 'rect_move')}
                    onTouchStart={(e) => handleStartDrag(e, 'rect_move')}
                  >
                    {/* Rule of thirds grid */}
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
                      <div className="border-r border-b border-emerald-300/50" />
                      <div className="border-r border-b border-emerald-300/50" />
                      <div className="border-b border-emerald-300/50" />
                      <div className="border-r border-b border-emerald-300/50" />
                      <div className="border-r border-b border-emerald-300/50" />
                      <div className="border-b border-emerald-300/50" />
                      <div className="border-r border-b border-emerald-300/50" />
                      <div className="border-r border-b border-emerald-300/50" />
                      <div />
                    </div>

                    {/* Rect Handles */}
                    <div
                      onMouseDown={(e) => handleStartDrag(e, 'rect_nw')}
                      onTouchStart={(e) => handleStartDrag(e, 'rect_nw')}
                      className="absolute -top-2 -left-2 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nwse-resize shadow"
                    />
                    <div
                      onMouseDown={(e) => handleStartDrag(e, 'rect_ne')}
                      onTouchStart={(e) => handleStartDrag(e, 'rect_ne')}
                      className="absolute -top-2 -right-2 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nesw-resize shadow"
                    />
                    <div
                      onMouseDown={(e) => handleStartDrag(e, 'rect_se')}
                      onTouchStart={(e) => handleStartDrag(e, 'rect_se')}
                      className="absolute -bottom-2 -right-2 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nwse-resize shadow"
                    />
                    <div
                      onMouseDown={(e) => handleStartDrag(e, 'rect_sw')}
                      onTouchStart={(e) => handleStartDrag(e, 'rect_sw')}
                      className="absolute -bottom-2 -left-2 w-4 h-4 bg-emerald-400 border-2 border-slate-900 rounded-sm cursor-nesw-resize shadow"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* CamScanner-Style Magnifier Loupe Floating on Active Drag */}
          {activeHandle && (
            <div
              className="absolute top-4 left-4 z-50 pointer-events-none flex flex-col items-center bg-slate-950/90 border border-emerald-500/50 p-1.5 rounded-full shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-75 duration-100"
            >
              <canvas
                ref={loupeCanvasRef}
                width={110}
                height={110}
                className="w-[100px] h-[100px] rounded-full border border-emerald-400/80 bg-black block"
              />
              <span className="text-[9px] font-bold text-emerald-300 mt-1 uppercase tracking-wider">
                {activeHandle.startsWith('rect') ? 'Corner' : activeHandle.toUpperCase()}
              </span>
            </div>
          )}
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
              <span className={is4K ? 'text-amber-400 font-bold flex items-center gap-1' : 'text-emerald-400 font-semibold'}>
                {is4K ? <Sparkles className="w-3 h-3 text-amber-300" /> : null}
                {is4K ? '4K Ultra HD' : 'HD Ready'}
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
                PNG
              </button>
              <button
                onClick={() => setExportFormat('jpeg')}
                className={`px-2 py-1 rounded font-semibold ${
                  exportFormat === 'jpeg' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                JPG
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
                <span>{language === 'hi' ? '4K डाउनलोड' : 'Download 4K'}</span>
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
                  ? (language === 'hi' ? 'क्रॉप हो रहा है...' : 'Processing 4K...')
                  : (language === 'hi' ? 'दस्तावेज़ क्रॉप लागू करें' : 'Apply Crop')}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
