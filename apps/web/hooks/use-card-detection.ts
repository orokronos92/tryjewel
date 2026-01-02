import { useRef, useCallback, useState, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface DetectedCard {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    aspectRatio: number;
    confidence: number;
    isAligned: boolean;
    corners: [number, number][];
}

interface UseCardDetectionOptions {
    videoElement: HTMLVideoElement | null;
    containerWidth: number;
    containerHeight: number;
    expectedFrameWidth: number;
    expectedFrameHeight: number;
    sizeTolerance?: number;
    positionTolerance?: number;
    debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

interface UseCardDetectionResult {
    detectedCard: DetectedCard | null;
    isDetecting: boolean;
    isCardAligned: boolean;
    stabilityCounter: number;
    isLoading: boolean;
    startDetection: () => void;
    stopDetection: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CREDIT_CARD_ASPECT_RATIO = 85.6 / 53.98; // ~1.586
const STABILITY_THRESHOLD = 5; // Reduced from 15 for faster validation
const DETECTION_INTERVAL = 80; // Faster detection
const DOWNSCALE_WIDTH = 256; // Process at low resolution for speed

// =============================================================================
// LIGHTWEIGHT CARD DETECTION (Sobel + Histogram peaks)
// =============================================================================

type Pt = { x: number; y: number };
type CardQuad = [Pt, Pt, Pt, Pt]; // TL, TR, BR, BL

function dist(a: Pt, b: Pt) { return Math.hypot(a.x - b.x, a.y - b.y); }

function orderCorners(pts: Pt[]): CardQuad {
    const sum = pts.map(p => p.x + p.y);
    const diff = pts.map(p => p.x - p.y);
    const tl = pts[sum.indexOf(Math.min(...sum))];
    const br = pts[sum.indexOf(Math.max(...sum))];
    const tr = pts[diff.indexOf(Math.max(...diff))];
    const bl = pts[diff.indexOf(Math.min(...diff))];
    return [tl, tr, br, bl];
}

function quadRatio(q: CardQuad) {
    const [tl, tr, br, bl] = q;
    const w = (dist(tl, tr) + dist(bl, br)) * 0.5;
    const h = (dist(tl, bl) + dist(tr, br)) * 0.5;
    return w / (h || 1);
}

function quadArea(q: CardQuad) {
    const [tl, tr, br, bl] = q;
    const w = (dist(tl, tr) + dist(bl, br)) * 0.5;
    const h = (dist(tl, bl) + dist(tr, br)) * 0.5;
    return w * h;
}

/**
 * Downscale frame to small grayscale buffer
 */
function downscaleGray(
    srcCanvas: HTMLCanvasElement,
    targetW: number
): { gray: Uint8Array; w: number; h: number; scale: number } {
    const sw = srcCanvas.width;
    const sh = srcCanvas.height;
    const scale = targetW / sw;
    const tw = targetW;
    const th = Math.max(1, Math.round(sh * scale));

    const tmp = document.createElement("canvas");
    tmp.width = tw;
    tmp.height = th;
    const tctx = tmp.getContext("2d", { willReadFrequently: true })!;
    tctx.drawImage(srcCanvas, 0, 0, tw, th);

    const img = tctx.getImageData(0, 0, tw, th).data;
    const gray = new Uint8Array(tw * th);
    for (let i = 0; i < tw * th; i++) {
        const r = img[i * 4 + 0];
        const g = img[i * 4 + 1];
        const b = img[i * 4 + 2];
        gray[i] = (0.299 * r + 0.587 * g + 0.114 * b) | 0;
    }
    return { gray, w: tw, h: th, scale };
}

/**
 * Sobel magnitude (edges)
 */
function sobelMag(gray: Uint8Array, w: number, h: number): Uint16Array {
    const out = new Uint16Array(w * h);
    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            const i = y * w + x;

            const a00 = gray[i - w - 1], a01 = gray[i - w], a02 = gray[i - w + 1];
            const a10 = gray[i - 1], a12 = gray[i + 1];
            const a20 = gray[i + w - 1], a21 = gray[i + w], a22 = gray[i + w + 1];

            const gx = (-a00 + a02) + (-2 * a10 + 2 * a12) + (-a20 + a22);
            const gy = (-a00 - 2 * a01 - a02) + (a20 + 2 * a21 + a22);

            out[i] = Math.min(65535, Math.abs(gx) + Math.abs(gy));
        }
    }
    return out;
}

/**
 * Threshold to binary edge map
 */
function thresholdEdges(mag: Uint16Array, w: number, h: number): Uint8Array {
    let max = 0;
    for (let i = 0; i < mag.length; i++) max = Math.max(max, mag[i]);
    const thr = Math.max(40, Math.round(max * 0.25));
    const out = new Uint8Array(w * h);
    for (let i = 0; i < mag.length; i++) out[i] = mag[i] > thr ? 1 : 0;
    return out;
}

/**
 * Pick two strongest peaks in histogram with minimum gap
 */
function pickTwoPeaks(hist: Uint32Array, minGap: number): [number, number] | null {
    let best1 = -1, best2 = -1;

    // Find first peak
    for (let i = 0; i < hist.length; i++) {
        if (best1 === -1 || hist[i] > hist[best1]) best1 = i;
    }
    if (best1 === -1) return null;

    // Find second peak with minimum gap
    for (let i = 0; i < hist.length; i++) {
        if (Math.abs(i - best1) < minGap) continue;
        if (best2 === -1 || hist[i] > hist[best2]) best2 = i;
    }
    if (best2 === -1) return null;

    return best1 < best2 ? [best1, best2] : [best2, best1];
}

interface DetectionResult {
    quad: CardQuad | null;
    edges: Uint8Array;
    w: number;
    h: number;
    histX: Uint32Array;
    histY: Uint32Array;
    vLines: [number, number] | null;
    hLines: [number, number] | null;
}

/**
 * Main detection function: Sobel + Histogram peaks with center weighting
 */
function detectCardQuadLite(
    srcCanvas: HTMLCanvasElement,
    targetW: number = DOWNSCALE_WIDTH
): DetectionResult {
    const { gray, w, h, scale } = downscaleGray(srcCanvas, targetW);
    const mag = sobelMag(gray, w, h);
    const edges = thresholdEdges(mag, w, h);

    // Build histograms with center weighting
    // Edges near the center of the frame get higher weight
    const histX = new Uint32Array(w);
    const histY = new Uint32Array(h);
    const cx = w / 2;
    const cy = h / 2;

    for (let y = 0; y < h; y++) {
        const row = y * w;
        // Weight based on vertical distance from center (1.0 at center, 0.3 at edges)
        const wy = 0.3 + 0.7 * (1 - Math.abs(y - cy) / cy);
        for (let x = 0; x < w; x++) {
            if (edges[row + x]) {
                // Weight based on horizontal distance from center
                const wx = 0.3 + 0.7 * (1 - Math.abs(x - cx) / cx);
                // For vertical lines (histX), weight by vertical position
                // For horizontal lines (histY), weight by horizontal position
                histX[x] += Math.round(wy * 10);
                histY[y] += Math.round(wx * 10);
            }
        }
    }

    // Pick two vertical borders and two horizontal borders
    // Minimum gap between peaks: expect card to be at least 25% of frame
    const vLines = pickTwoPeaks(histX, Math.round(w * 0.20));
    const hLines = pickTwoPeaks(histY, Math.round(h * 0.20));

    if (!vLines || !hLines) {
        return { quad: null, edges, w, h, histX, histY, vLines, hLines };
    }

    const [xL, xR] = vLines;
    const [yT, yB] = hLines;

    // Form quad in small space
    const quadSmall: CardQuad = orderCorners([
        { x: xL, y: yT },
        { x: xR, y: yT },
        { x: xR, y: yB },
        { x: xL, y: yB },
    ]) as CardQuad;

    // Ratio check
    const r = quadRatio(quadSmall);
    const err = Math.abs(r - CREDIT_CARD_ASPECT_RATIO);
    if (err > 0.6) {
        return { quad: null, edges, w, h, histX, histY, vLines, hLines };
    }

    // Upscale back to source canvas coordinates
    const invScale = 1 / scale;
    const quadSrc: CardQuad = quadSmall.map(p => ({
        x: p.x * invScale,
        y: p.y * invScale,
    })) as CardQuad;

    return { quad: quadSrc, edges, w, h, histX, histY, vLines, hLines };
}

// =============================================================================
// VIDEO BOUNDS
// =============================================================================

function getVideoBounds(video: HTMLVideoElement, containerWidth: number, containerHeight: number) {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;
    if (!videoWidth || !videoHeight) {
        return { x: 0, y: 0, width: containerWidth, height: containerHeight, scaleX: 1, scaleY: 1 };
    }
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;
    let displayWidth: number, displayHeight: number, offsetX: number, offsetY: number;
    if (videoAspect > containerAspect) {
        displayWidth = containerWidth;
        displayHeight = containerWidth / videoAspect;
        offsetX = 0;
        offsetY = (containerHeight - displayHeight) / 2;
    } else {
        displayHeight = containerHeight;
        displayWidth = containerHeight * videoAspect;
        offsetX = (containerWidth - displayWidth) / 2;
        offsetY = 0;
    }
    return { x: offsetX, y: offsetY, width: displayWidth, height: displayHeight, scaleX: displayWidth / videoWidth, scaleY: displayHeight / videoHeight };
}

// =============================================================================
// DEBUG VISUALIZATION
// =============================================================================

function drawDebugVisualization(
    debugCanvas: HTMLCanvasElement,
    result: DetectionResult,
    canvasDisplayWidth: number,
    canvasDisplayHeight: number
): void {
    const ctx = debugCanvas.getContext('2d');
    if (!ctx) return;

    debugCanvas.width = canvasDisplayWidth;
    debugCanvas.height = canvasDisplayHeight;
    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);

    const scaleX = canvasDisplayWidth / result.w;
    const scaleY = canvasDisplayHeight / result.h;

    // Draw edges in green
    const edgeImageData = ctx.createImageData(canvasDisplayWidth, canvasDisplayHeight);
    for (let y = 0; y < result.h; y++) {
        for (let x = 0; x < result.w; x++) {
            if (result.edges[y * result.w + x]) {
                const cx = Math.floor(x * scaleX);
                const cy = Math.floor(y * scaleY);
                if (cx >= 0 && cx < canvasDisplayWidth && cy >= 0 && cy < canvasDisplayHeight) {
                    const idx = (cy * canvasDisplayWidth + cx) * 4;
                    edgeImageData.data[idx] = 0;
                    edgeImageData.data[idx + 1] = 200;
                    edgeImageData.data[idx + 2] = 0;
                    edgeImageData.data[idx + 3] = 150;
                }
            }
        }
    }
    ctx.putImageData(edgeImageData, 0, 0);

    // Draw detected vertical lines (blue)
    if (result.vLines) {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(result.vLines[0] * scaleX, 0);
        ctx.lineTo(result.vLines[0] * scaleX, canvasDisplayHeight);
        ctx.moveTo(result.vLines[1] * scaleX, 0);
        ctx.lineTo(result.vLines[1] * scaleX, canvasDisplayHeight);
        ctx.stroke();
    }

    // Draw detected horizontal lines (blue)
    if (result.hLines) {
        ctx.strokeStyle = 'blue';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, result.hLines[0] * scaleY);
        ctx.lineTo(canvasDisplayWidth, result.hLines[0] * scaleY);
        ctx.moveTo(0, result.hLines[1] * scaleY);
        ctx.lineTo(canvasDisplayWidth, result.hLines[1] * scaleY);
        ctx.stroke();
    }

    // Draw quad in red if detected
    if (result.quad) {
        const invScaleX = result.w / canvasDisplayWidth;
        const invScaleY = result.h / canvasDisplayHeight;

        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.beginPath();

        // Scale quad back to debug canvas coordinates
        const q = result.quad.map(p => ({
            x: (p.x * invScaleX) * scaleX,
            y: (p.y * invScaleY) * scaleY
        }));

        ctx.moveTo(q[0].x, q[0].y);
        ctx.lineTo(q[1].x, q[1].y);
        ctx.lineTo(q[2].x, q[2].y);
        ctx.lineTo(q[3].x, q[3].y);
        ctx.closePath();
        ctx.stroke();

        // Draw corner points
        ctx.fillStyle = 'yellow';
        for (const p of q) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Draw border
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvasDisplayWidth - 2, canvasDisplayHeight - 2);
}

// =============================================================================
// HOOK
// =============================================================================

export function useCardDetection({
    videoElement,
    containerWidth,
    containerHeight,
    expectedFrameWidth,
    expectedFrameHeight,
    sizeTolerance = 0.35,
    debugCanvasRef,
}: UseCardDetectionOptions): UseCardDetectionResult {
    const [detectedCard, setDetectedCard] = useState<DetectedCard | null>(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isCardAligned, setIsCardAligned] = useState(false);
    const [stabilityCounter, setStabilityCounter] = useState(0);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stableCountRef = useRef(0);

    useEffect(() => {
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
            ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
        }
    }, []);

    const detectCard = useCallback(() => {
        if (!videoElement || !canvasRef.current || !ctxRef.current) return;

        const videoBounds = getVideoBounds(videoElement, containerWidth, containerHeight);
        const frameX = (containerWidth - expectedFrameWidth) / 2;
        const frameY = (containerHeight - expectedFrameHeight) / 2;

        // Crop region with margin
        const margin = 0.2;
        const marginX = expectedFrameWidth * margin;
        const marginY = expectedFrameHeight * margin;
        const drawX = Math.max(videoBounds.x, frameX - marginX);
        const drawY = Math.max(videoBounds.y, frameY - marginY);
        const drawWidth = Math.min(expectedFrameWidth + marginX * 2, videoBounds.width);
        const drawHeight = Math.min(expectedFrameHeight + marginY * 2, videoBounds.height);

        // Video source coordinates
        const videoX = Math.floor((drawX - videoBounds.x) / videoBounds.scaleX);
        const videoY = Math.floor((drawY - videoBounds.y) / videoBounds.scaleY);
        const videoW = Math.floor(drawWidth / videoBounds.scaleX);
        const videoH = Math.floor(drawHeight / videoBounds.scaleY);

        const srcX = Math.max(0, Math.min(videoX, videoElement.videoWidth - 1));
        const srcY = Math.max(0, Math.min(videoY, videoElement.videoHeight - 1));
        const srcW = Math.min(videoW, videoElement.videoWidth - srcX);
        const srcH = Math.min(videoH, videoElement.videoHeight - srcY);

        if (srcW <= 0 || srcH <= 0) return;

        // Draw video frame to canvas
        canvasRef.current.width = srcW;
        canvasRef.current.height = srcH;
        ctxRef.current.drawImage(videoElement, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

        // Detect card
        const result = detectCardQuadLite(canvasRef.current, DOWNSCALE_WIDTH);

        // Debug visualization
        if (debugCanvasRef?.current) {
            const canvasDisplayWidth = expectedFrameWidth * 1.4;
            const canvasDisplayHeight = expectedFrameHeight * 1.4;
            drawDebugVisualization(debugCanvasRef.current, result, canvasDisplayWidth, canvasDisplayHeight);
        }

        if (!result.quad) {
            setDetectedCard(null);
            stableCountRef.current = Math.max(stableCountRef.current - 2, 0);
            setStabilityCounter(stableCountRef.current);
            setIsCardAligned(false);
            return;
        }

        // Calculate bounding box from quad
        const xs = result.quad.map(p => p.x);
        const ys = result.quad.map(p => p.y);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const minY = Math.min(...ys);
        const maxY = Math.max(...ys);
        const rectW = maxX - minX;
        const rectH = maxY - minY;

        // Check alignment - relaxed criteria for faster validation
        const expectedWidthInCrop = srcW * (1 / 1.4);
        const expectedHeightInCrop = srcH * (1 / 1.4);
        const cropCenterX = srcW / 2;
        const cropCenterY = srcH / 2;
        const rectCenterX = minX + rectW / 2;
        const rectCenterY = minY + rectH / 2;

        // Relaxed position tolerance: 35% of dimension
        const posToleranceCrop = Math.min(srcW, srcH) * 0.35;
        const offsetX = Math.abs(rectCenterX - cropCenterX);
        const offsetY = Math.abs(rectCenterY - cropCenterY);

        const sizeRatioW = rectW / expectedWidthInCrop;
        const sizeRatioH = rectH / expectedHeightInCrop;

        // Relaxed size tolerance: 50%
        const actualSizeTolerance = Math.max(sizeTolerance, 0.5);
        const isSizeMatch = sizeRatioW >= (1 - actualSizeTolerance) && sizeRatioW <= (1 + actualSizeTolerance) &&
                            sizeRatioH >= (1 - actualSizeTolerance) && sizeRatioH <= (1 + actualSizeTolerance);
        const isPositionMatch = offsetX <= posToleranceCrop && offsetY <= posToleranceCrop;
        const isAligned = isSizeMatch && isPositionMatch;

        // Convert to container coordinates
        const scaleToContainer = drawWidth / srcW;
        const cardX = drawX + minX * scaleToContainer;
        const cardY = drawY + minY * scaleToContainer;
        const cardWidth = rectW * scaleToContainer;
        const cardHeight = rectH * scaleToContainer;

        // Convert corners to container coordinates
        const containerCorners = result.quad.map(p => [
            drawX + p.x * scaleToContainer,
            drawY + p.y * scaleToContainer
        ] as [number, number]);

        const card: DetectedCard = {
            x: cardX,
            y: cardY,
            width: cardWidth,
            height: cardHeight,
            centerX: cardX + cardWidth / 2,
            centerY: cardY + cardHeight / 2,
            aspectRatio: rectW / rectH,
            confidence: 0.8, // Fixed confidence for now
            isAligned,
            corners: containerCorners,
        };

        setDetectedCard(card);

        if (card.isAligned) {
            stableCountRef.current = Math.min(stableCountRef.current + 1, STABILITY_THRESHOLD * 2);
            setStabilityCounter(stableCountRef.current);
            if (stableCountRef.current >= STABILITY_THRESHOLD) {
                setIsCardAligned(true);
            }
        } else {
            stableCountRef.current = Math.max(stableCountRef.current - 1, 0);
            setStabilityCounter(stableCountRef.current);
            setIsCardAligned(false);
        }
    }, [videoElement, containerWidth, containerHeight, expectedFrameWidth, expectedFrameHeight, sizeTolerance, debugCanvasRef]);

    const startDetection = useCallback(() => {
        if (intervalRef.current) return;
        setIsDetecting(true);
        setDetectedCard(null);
        setIsCardAligned(false);
        setStabilityCounter(0);
        stableCountRef.current = 0;
        intervalRef.current = setInterval(detectCard, DETECTION_INTERVAL);
    }, [detectCard]);

    const stopDetection = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsDetecting(false);
    }, []);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    useEffect(() => {
        if (videoElement && videoElement.videoWidth > 0) {
            startDetection();
        }
        return stopDetection;
    }, [videoElement, startDetection, stopDetection]);

    return {
        detectedCard,
        isDetecting,
        isCardAligned,
        stabilityCounter,
        isLoading: false,
        startDetection,
        stopDetection,
    };
}
