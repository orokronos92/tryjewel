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
    corners?: [number, number][];
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
const STABILITY_THRESHOLD = 15;
const DETECTION_INTERVAL = 100;
const CANNY_LOW = 30;
const CANNY_HIGH = 90;

// =============================================================================
// IMAGE PROCESSING
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

function toGrayscale(imageData: ImageData): Uint8Array {
    const gray = new Uint8Array(imageData.width * imageData.height);
    const data = imageData.data;
    for (let i = 0; i < gray.length; i++) {
        const idx = i * 4;
        gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    }
    return gray;
}

function gaussianBlur(gray: Uint8Array, width: number, height: number): Uint8Array {
    const kernel = [1, 4, 6, 4, 1, 4, 16, 24, 16, 4, 6, 24, 36, 24, 6, 4, 16, 24, 16, 4, 1, 4, 6, 4, 1];
    const kernelSum = 256;
    const result = new Uint8Array(width * height);
    for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
            let sum = 0;
            for (let ky = -2; ky <= 2; ky++) {
                for (let kx = -2; kx <= 2; kx++) {
                    sum += gray[(y + ky) * width + (x + kx)] * kernel[(ky + 2) * 5 + (kx + 2)];
                }
            }
            result[y * width + x] = Math.round(sum / kernelSum);
        }
    }
    return result;
}

function sobelGradients(gray: Uint8Array, width: number, height: number): { magnitude: Float32Array; direction: Float32Array } {
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const gx = -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)]
                     - 2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)]
                     - gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];
            const gy = -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)]
                     + gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];
            const idx = y * width + x;
            magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
            direction[idx] = Math.atan2(gy, gx);
        }
    }
    return { magnitude, direction };
}

function nonMaxSuppression(magnitude: Float32Array, direction: Float32Array, width: number, height: number): Float32Array {
    const result = new Float32Array(width * height);
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const mag = magnitude[idx];
            let angle = direction[idx] * 180 / Math.PI;
            if (angle < 0) angle += 180;
            let q = 255, r = 255;
            if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
                q = magnitude[y * width + (x + 1)];
                r = magnitude[y * width + (x - 1)];
            } else if (angle >= 22.5 && angle < 67.5) {
                q = magnitude[(y - 1) * width + (x + 1)];
                r = magnitude[(y + 1) * width + (x - 1)];
            } else if (angle >= 67.5 && angle < 112.5) {
                q = magnitude[(y - 1) * width + x];
                r = magnitude[(y + 1) * width + x];
            } else if (angle >= 112.5 && angle < 157.5) {
                q = magnitude[(y - 1) * width + (x - 1)];
                r = magnitude[(y + 1) * width + (x + 1)];
            }
            if (mag >= q && mag >= r) result[idx] = mag;
        }
    }
    return result;
}

function hysteresis(nms: Float32Array, width: number, height: number, low: number, high: number): Uint8Array {
    const edges = new Uint8Array(width * height);
    for (let i = 0; i < nms.length; i++) {
        if (nms[i] >= high) edges[i] = 255;
        else if (nms[i] >= low) edges[i] = 128;
    }
    let changed = true;
    while (changed) {
        changed = false;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (edges[idx] === 128) {
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (edges[(y + dy) * width + (x + dx)] === 255) {
                                edges[idx] = 255;
                                changed = true;
                                break;
                            }
                        }
                        if (edges[idx] === 255) break;
                    }
                }
            }
        }
    }
    for (let i = 0; i < edges.length; i++) {
        if (edges[i] === 128) edges[i] = 0;
    }
    return edges;
}

// Morphological dilation to connect edge fragments
function dilate(edges: Uint8Array, width: number, height: number, iterations: number = 2): Uint8Array {
    let result = new Uint8Array(edges);
    for (let iter = 0; iter < iterations; iter++) {
        const temp = new Uint8Array(result);
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                if (result[y * width + x] === 255) continue;
                // Check 3x3 neighborhood
                let hasNeighbor = false;
                for (let dy = -1; dy <= 1 && !hasNeighbor; dy++) {
                    for (let dx = -1; dx <= 1 && !hasNeighbor; dx++) {
                        if (result[(y + dy) * width + (x + dx)] === 255) {
                            hasNeighbor = true;
                        }
                    }
                }
                if (hasNeighbor) temp[y * width + x] = 255;
            }
        }
        result = temp;
    }
    return result;
}

function cannyEdgeDetection(imageData: ImageData): { edges: Uint8Array; width: number; height: number } {
    const { width, height } = imageData;
    const gray = toGrayscale(imageData);
    const blurred = gaussianBlur(gray, width, height);
    const { magnitude, direction } = sobelGradients(blurred, width, height);
    const nms = nonMaxSuppression(magnitude, direction, width, height);
    const edges = hysteresis(nms, width, height, CANNY_LOW, CANNY_HIGH);
    // Dilate edges to connect fragments
    const dilatedEdges = dilate(edges, width, height, 3);
    return { edges: dilatedEdges, width, height };
}

// =============================================================================
// RECTANGLE DETECTION - Using bounding box approach
// =============================================================================

interface RectangleCandidate {
    x: number;
    y: number;
    w: number;
    h: number;
    area: number;
    aspectRatio: number;
    score: number;
}

function findRectangles(
    edges: Uint8Array,
    width: number,
    height: number,
    expectedWidth: number,
    expectedHeight: number
): { best: RectangleCandidate | null; candidates: RectangleCandidate[] } {
    // Use connected component labeling to find regions
    const labels = new Int32Array(width * height);
    let currentLabel = 0;
    const labelAreas: Map<number, { minX: number; maxX: number; minY: number; maxY: number; count: number }> = new Map();

    // Simple flood-fill labeling
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (edges[idx] === 255 && labels[idx] === 0) {
                currentLabel++;
                const stack: [number, number][] = [[x, y]];
                const bounds = { minX: x, maxX: x, minY: y, maxY: y, count: 0 };

                while (stack.length > 0) {
                    const [cx, cy] = stack.pop()!;
                    const cidx = cy * width + cx;
                    if (cx < 0 || cx >= width || cy < 0 || cy >= height) continue;
                    if (edges[cidx] !== 255 || labels[cidx] !== 0) continue;

                    labels[cidx] = currentLabel;
                    bounds.minX = Math.min(bounds.minX, cx);
                    bounds.maxX = Math.max(bounds.maxX, cx);
                    bounds.minY = Math.min(bounds.minY, cy);
                    bounds.maxY = Math.max(bounds.maxY, cy);
                    bounds.count++;

                    // 8-connected
                    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
                    stack.push([cx + 1, cy + 1], [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1]);
                }

                labelAreas.set(currentLabel, bounds);
            }
        }
    }

    console.log(`[CardDetection] Found ${labelAreas.size} connected regions`);

    // Find rectangular regions
    const candidates: RectangleCandidate[] = [];
    const centerX = width / 2;
    const centerY = height / 2;
    const minArea = expectedWidth * expectedHeight * 0.1;
    const maxArea = expectedWidth * expectedHeight * 4;

    for (const [label, bounds] of labelAreas) {
        const rectW = bounds.maxX - bounds.minX;
        const rectH = bounds.maxY - bounds.minY;
        const area = rectW * rectH;

        // Skip too small or too large
        if (area < minArea || area > maxArea) continue;
        if (rectW < 30 || rectH < 20) continue;

        const aspectRatio = rectW / rectH;

        // Check if it looks like a card (aspect ratio 1.2 - 2.2)
        if (aspectRatio < 1.0 || aspectRatio > 2.5) continue;

        // Check if it's not too close to boundaries
        if (bounds.minX < 5 || bounds.minY < 5 || bounds.maxX > width - 5 || bounds.maxY > height - 5) continue;

        // Calculate score
        const rectCenterX = bounds.minX + rectW / 2;
        const rectCenterY = bounds.minY + rectH / 2;

        const sizeMatchW = 1 - Math.min(1, Math.abs(rectW - expectedWidth) / expectedWidth);
        const sizeMatchH = 1 - Math.min(1, Math.abs(rectH - expectedHeight) / expectedHeight);
        const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
        const centerDist = Math.sqrt((rectCenterX - centerX) ** 2 + (rectCenterY - centerY) ** 2);
        const centerScore = 1 - centerDist / maxDist;
        const aspectMatch = 1 - Math.min(1, Math.abs(aspectRatio - CREDIT_CARD_ASPECT_RATIO) / CREDIT_CARD_ASPECT_RATIO);

        // Rectangularity score (how filled is the bounding box)
        const fillRatio = bounds.count / area;
        const rectangularityScore = Math.min(1, fillRatio * 5); // Edge pixels should be ~20% of area for a rectangle

        const score = sizeMatchW * 0.2 + sizeMatchH * 0.2 + centerScore * 0.2 + aspectMatch * 0.2 + rectangularityScore * 0.2;

        candidates.push({
            x: bounds.minX,
            y: bounds.minY,
            w: rectW,
            h: rectH,
            area,
            aspectRatio,
            score
        });

        console.log(`[CardDetection] Candidate: ${rectW}x${rectH} AR=${aspectRatio.toFixed(2)} score=${score.toFixed(2)}`);
    }

    if (candidates.length === 0) {
        return { best: null, candidates: [] };
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    console.log(`[CardDetection] 🎯 Best: ${best.w}x${best.h} AR=${best.aspectRatio.toFixed(2)} score=${best.score.toFixed(2)}`);

    return { best, candidates };
}

// =============================================================================
// DEBUG VISUALIZATION
// =============================================================================

function drawDebugVisualization(
    debugCanvas: HTMLCanvasElement,
    edges: Uint8Array,
    cropWidth: number,
    cropHeight: number,
    best: RectangleCandidate | null,
    candidates: RectangleCandidate[],
    canvasDisplayWidth: number,
    canvasDisplayHeight: number
): void {
    const ctx = debugCanvas.getContext('2d');
    if (!ctx) return;

    debugCanvas.width = canvasDisplayWidth;
    debugCanvas.height = canvasDisplayHeight;
    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);

    const scaleX = canvasDisplayWidth / cropWidth;
    const scaleY = canvasDisplayHeight / cropHeight;

    // Draw edges in green
    const edgeImageData = ctx.createImageData(canvasDisplayWidth, canvasDisplayHeight);
    for (let y = 0; y < cropHeight; y++) {
        for (let x = 0; x < cropWidth; x++) {
            if (edges[y * cropWidth + x] === 255) {
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

    // Draw all candidates in orange
    for (const c of candidates) {
        if (c === best) continue;
        ctx.strokeStyle = 'orange';
        ctx.lineWidth = 1;
        ctx.strokeRect(c.x * scaleX, c.y * scaleY, c.w * scaleX, c.h * scaleY);
    }

    // Draw best in red
    if (best) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.strokeRect(best.x * scaleX, best.y * scaleY, best.w * scaleX, best.h * scaleY);

        // Draw center cross
        const cx = (best.x + best.w / 2) * scaleX;
        const cy = (best.y + best.h / 2) * scaleY;
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy);
        ctx.lineTo(cx + 15, cy);
        ctx.moveTo(cx, cy - 15);
        ctx.lineTo(cx, cy + 15);
        ctx.stroke();
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
    positionTolerance = 50,
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

        const margin = 0.2;
        const marginX = expectedFrameWidth * margin;
        const marginY = expectedFrameHeight * margin;
        const drawX = Math.max(videoBounds.x, frameX - marginX);
        const drawY = Math.max(videoBounds.y, frameY - marginY);
        const drawWidth = Math.min(expectedFrameWidth + marginX * 2, videoBounds.width);
        const drawHeight = Math.min(expectedFrameHeight + marginY * 2, videoBounds.height);

        const videoX = Math.floor((drawX - videoBounds.x) / videoBounds.scaleX);
        const videoY = Math.floor((drawY - videoBounds.y) / videoBounds.scaleY);
        const videoW = Math.floor(drawWidth / videoBounds.scaleX);
        const videoH = Math.floor(drawHeight / videoBounds.scaleY);

        const srcX = Math.max(0, Math.min(videoX, videoElement.videoWidth - 1));
        const srcY = Math.max(0, Math.min(videoY, videoElement.videoHeight - 1));
        const srcW = Math.min(videoW, videoElement.videoWidth - srcX);
        const srcH = Math.min(videoH, videoElement.videoHeight - srcY);

        if (srcW <= 0 || srcH <= 0) return;

        canvasRef.current.width = srcW;
        canvasRef.current.height = srcH;
        ctxRef.current.drawImage(videoElement, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

        const imageData = ctxRef.current.getImageData(0, 0, srcW, srcH);

        // Run detection
        const { edges, width, height } = cannyEdgeDetection(imageData);
        const expectedWidthInCrop = srcW * (1 / 1.4);
        const expectedHeightInCrop = srcH * (1 / 1.4);

        const { best, candidates } = findRectangles(edges, width, height, expectedWidthInCrop, expectedHeightInCrop);

        // Debug visualization
        if (debugCanvasRef?.current) {
            const canvasDisplayWidth = expectedFrameWidth * 1.4;
            const canvasDisplayHeight = expectedFrameHeight * 1.4;
            drawDebugVisualization(debugCanvasRef.current, edges, width, height, best, candidates, canvasDisplayWidth, canvasDisplayHeight);
        }

        if (!best) {
            setDetectedCard(null);
            stableCountRef.current = Math.max(stableCountRef.current - 2, 0);
            setStabilityCounter(stableCountRef.current);
            setIsCardAligned(false);
            return;
        }

        // Check alignment
        const rectCenterX = best.x + best.w / 2;
        const rectCenterY = best.y + best.h / 2;
        const cropCenterX = width / 2;
        const cropCenterY = height / 2;

        const posToleranceCrop = Math.min(width, height) * 0.25;
        const offsetX = Math.abs(rectCenterX - cropCenterX);
        const offsetY = Math.abs(rectCenterY - cropCenterY);

        const sizeRatioW = best.w / expectedWidthInCrop;
        const sizeRatioH = best.h / expectedHeightInCrop;

        const isSizeMatch = sizeRatioW >= (1 - sizeTolerance) && sizeRatioW <= (1 + sizeTolerance) &&
                            sizeRatioH >= (1 - sizeTolerance) && sizeRatioH <= (1 + sizeTolerance);
        const isPositionMatch = offsetX <= posToleranceCrop && offsetY <= posToleranceCrop;
        const isAligned = isSizeMatch && isPositionMatch;

        // Convert to container coordinates
        const scaleToContainer = drawWidth / srcW;
        const cardX = drawX + best.x * scaleToContainer;
        const cardY = drawY + best.y * scaleToContainer;
        const cardWidth = best.w * scaleToContainer;
        const cardHeight = best.h * scaleToContainer;

        const card: DetectedCard = {
            x: cardX,
            y: cardY,
            width: cardWidth,
            height: cardHeight,
            centerX: cardX + cardWidth / 2,
            centerY: cardY + cardHeight / 2,
            aspectRatio: best.aspectRatio,
            confidence: best.score,
            isAligned,
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
        isLoading: false, // No loading needed for custom implementation
        startDetection,
        stopDetection,
    };
}
