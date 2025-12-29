import { useRef, useCallback, useState, useEffect } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface DetectedCard {
    // Bounding box in pixels
    x: number;
    y: number;
    width: number;
    height: number;
    // Center point
    centerX: number;
    centerY: number;
    // Aspect ratio (width/height)
    aspectRatio: number;
    // Detection confidence (0-1)
    confidence: number;
    // Is it matching the expected frame?
    isAligned: boolean;
}

interface UseCardDetectionOptions {
    videoElement: HTMLVideoElement | null;
    containerWidth: number;
    containerHeight: number;
    expectedFrameWidth: number;
    expectedFrameHeight: number;
    // Tolerance for size matching (default 15%)
    sizeTolerance?: number;
    // Tolerance for position matching (default 30px)
    positionTolerance?: number;
}

interface UseCardDetectionResult {
    detectedCard: DetectedCard | null;
    isDetecting: boolean;
    isCardAligned: boolean;
    stabilityCounter: number;
    startDetection: () => void;
    stopDetection: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Credit card aspect ratio (ISO 7810 ID-1)
const CREDIT_CARD_ASPECT_RATIO = 85.6 / 53.98; // ~1.586

// Tolerance for aspect ratio matching
const ASPECT_RATIO_TOLERANCE = 0.15; // ±15%

// Stability frames required for validation
const STABILITY_THRESHOLD = 15;

// Detection interval (ms)
const DETECTION_INTERVAL = 100; // 10 FPS

// Edge detection threshold
const EDGE_THRESHOLD = 50;

// Minimum contour size (percentage of frame)
const MIN_CONTOUR_SIZE = 0.05; // 5% of frame

// =============================================================================
// IMAGE PROCESSING HELPERS
// =============================================================================

function getImageData(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D
): ImageData | null {
    if (!video.videoWidth || !video.videoHeight) return null;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function toGrayscale(imageData: ImageData): Uint8ClampedArray {
    const gray = new Uint8ClampedArray(imageData.width * imageData.height);
    const data = imageData.data;

    for (let i = 0; i < gray.length; i++) {
        const idx = i * 4;
        // Luminosity method
        gray[i] = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
    }

    return gray;
}

function sobelEdgeDetection(
    gray: Uint8ClampedArray,
    width: number,
    height: number
): Uint8ClampedArray {
    const edges = new Uint8ClampedArray(width * height);

    // Sobel kernels
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let sumX = 0;
            let sumY = 0;

            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    const ki = (ky + 1) * 3 + (kx + 1);
                    sumX += gray[idx] * gx[ki];
                    sumY += gray[idx] * gy[ki];
                }
            }

            const magnitude = Math.sqrt(sumX * sumX + sumY * sumY);
            edges[y * width + x] = magnitude > EDGE_THRESHOLD ? 255 : 0;
        }
    }

    return edges;
}

interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

function findRectangles(
    edges: Uint8ClampedArray,
    width: number,
    height: number,
    minSize: number
): BoundingBox[] {
    const visited = new Uint8ClampedArray(width * height);
    const rectangles: BoundingBox[] = [];

    // Simple connected component labeling
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (edges[idx] === 255 && !visited[idx]) {
                const bbox = floodFillBounds(edges, visited, width, height, x, y);

                const bboxWidth = bbox.maxX - bbox.minX;
                const bboxHeight = bbox.maxY - bbox.minY;
                const area = bboxWidth * bboxHeight;

                // Filter by minimum size
                if (area >= minSize) {
                    rectangles.push(bbox);
                }
            }
        }
    }

    return rectangles;
}

function floodFillBounds(
    edges: Uint8ClampedArray,
    visited: Uint8ClampedArray,
    width: number,
    height: number,
    startX: number,
    startY: number
): BoundingBox {
    const stack: [number, number][] = [[startX, startY]];
    const bbox: BoundingBox = {
        minX: startX,
        minY: startY,
        maxX: startX,
        maxY: startY,
    };

    while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;

        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (visited[idx] || edges[idx] !== 255) continue;

        visited[idx] = 1;

        bbox.minX = Math.min(bbox.minX, x);
        bbox.minY = Math.min(bbox.minY, y);
        bbox.maxX = Math.max(bbox.maxX, x);
        bbox.maxY = Math.max(bbox.maxY, y);

        // 4-connectivity
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    return bbox;
}

function filterByAspectRatio(
    rectangles: BoundingBox[],
    targetAspect: number,
    tolerance: number
): BoundingBox[] {
    return rectangles.filter(bbox => {
        const width = bbox.maxX - bbox.minX;
        const height = bbox.maxY - bbox.minY;
        if (height === 0) return false;

        const aspect = width / height;
        const ratio = aspect / targetAspect;

        return ratio >= (1 - tolerance) && ratio <= (1 + tolerance);
    });
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
    sizeTolerance = 0.15,
    positionTolerance = 30,
}: UseCardDetectionOptions): UseCardDetectionResult {
    const [detectedCard, setDetectedCard] = useState<DetectedCard | null>(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isCardAligned, setIsCardAligned] = useState(false);
    const [stabilityCounter, setStabilityCounter] = useState(0);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const lastAlignedRef = useRef(false);

    // Initialize canvas
    useEffect(() => {
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
            ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
        }
    }, []);

    // Main detection function
    const detectCard = useCallback(() => {
        if (!videoElement || !canvasRef.current || !ctxRef.current) {
            return;
        }

        const imageData = getImageData(videoElement, canvasRef.current, ctxRef.current);
        if (!imageData) return;

        const { width, height } = imageData;

        // Convert to grayscale
        const gray = toGrayscale(imageData);

        // Edge detection
        const edges = sobelEdgeDetection(gray, width, height);

        // Find rectangles
        const minSize = width * height * MIN_CONTOUR_SIZE;
        const rectangles = findRectangles(edges, width, height, minSize);

        // Filter by credit card aspect ratio
        const creditCardRects = filterByAspectRatio(
            rectangles,
            CREDIT_CARD_ASPECT_RATIO,
            ASPECT_RATIO_TOLERANCE
        );

        if (creditCardRects.length === 0) {
            setDetectedCard(null);
            setStabilityCounter(0);
            lastAlignedRef.current = false;
            return;
        }

        // Find the best candidate - must be close to center and reasonable size
        const centerX = width / 2;
        const centerY = height / 2;

        // Expected card size in video coordinates (reverse the container scaling)
        const expectedWidthInVideo = expectedFrameWidth * (width / containerWidth);
        const expectedHeightInVideo = expectedFrameHeight * (height / containerHeight);
        const minExpectedWidth = expectedWidthInVideo * 0.5;
        const maxExpectedWidth = expectedWidthInVideo * 2.0;

        let bestRect: BoundingBox | null = null;
        let bestScore = -Infinity;

        for (const rect of creditCardRects) {
            const rectWidth = rect.maxX - rect.minX;
            const rectHeight = rect.maxY - rect.minY;
            const rectCenterX = rect.minX + rectWidth / 2;
            const rectCenterY = rect.minY + rectHeight / 2;

            // Filter by size - must be within reasonable range of expected size
            if (rectWidth < minExpectedWidth || rectWidth > maxExpectedWidth) {
                continue;
            }

            // Filter by position - must be in the center region (middle 60% of the screen)
            const centerRegionX = width * 0.2;
            const centerRegionY = height * 0.2;
            if (rectCenterX < centerRegionX || rectCenterX > width - centerRegionX ||
                rectCenterY < centerRegionY || rectCenterY > height - centerRegionY) {
                continue;
            }

            const distToCenter = Math.sqrt(
                Math.pow(rectCenterX - centerX, 2) +
                Math.pow(rectCenterY - centerY, 2)
            );

            // Score: prioritize center proximity heavily, then size match
            const sizeDiff = Math.abs(rectWidth - expectedWidthInVideo) / expectedWidthInVideo;
            const score = 1000 - distToCenter - sizeDiff * 500;

            if (score > bestScore) {
                bestScore = score;
                bestRect = rect;
            }
        }

        if (!bestRect) {
            setDetectedCard(null);
            setStabilityCounter(0);
            lastAlignedRef.current = false;
            return;
        }

        // Convert to container coordinates
        const scaleX = containerWidth / width;
        const scaleY = containerHeight / height;

        const cardWidth = (bestRect.maxX - bestRect.minX) * scaleX;
        const cardHeight = (bestRect.maxY - bestRect.minY) * scaleY;
        const cardX = bestRect.minX * scaleX;
        const cardY = bestRect.minY * scaleY;
        const cardCenterX = cardX + cardWidth / 2;
        const cardCenterY = cardY + cardHeight / 2;

        // Expected frame center
        const frameCenterX = containerWidth / 2;
        const frameCenterY = containerHeight / 2;

        // Check alignment
        const sizeRatioW = cardWidth / expectedFrameWidth;
        const sizeRatioH = cardHeight / expectedFrameHeight;
        const positionOffsetX = Math.abs(cardCenterX - frameCenterX);
        const positionOffsetY = Math.abs(cardCenterY - frameCenterY);

        const isSizeMatch =
            sizeRatioW >= (1 - sizeTolerance) && sizeRatioW <= (1 + sizeTolerance) &&
            sizeRatioH >= (1 - sizeTolerance) && sizeRatioH <= (1 + sizeTolerance);

        const isPositionMatch =
            positionOffsetX <= positionTolerance &&
            positionOffsetY <= positionTolerance;

        const isAligned = isSizeMatch && isPositionMatch;

        // Calculate confidence based on aspect ratio match and size match
        const aspectRatio = cardWidth / cardHeight;
        const aspectConfidence = 1 - Math.abs(aspectRatio - CREDIT_CARD_ASPECT_RATIO) / CREDIT_CARD_ASPECT_RATIO;
        const sizeConfidence = Math.min(sizeRatioW, 1 / sizeRatioW) * Math.min(sizeRatioH, 1 / sizeRatioH);
        const confidence = (aspectConfidence + sizeConfidence) / 2;

        const card: DetectedCard = {
            x: cardX,
            y: cardY,
            width: cardWidth,
            height: cardHeight,
            centerX: cardCenterX,
            centerY: cardCenterY,
            aspectRatio,
            confidence,
            isAligned,
        };

        setDetectedCard(card);

        // Update stability counter
        if (isAligned) {
            if (lastAlignedRef.current) {
                setStabilityCounter(prev => Math.min(prev + 1, STABILITY_THRESHOLD * 2));
            } else {
                setStabilityCounter(1);
            }
            lastAlignedRef.current = true;

            // Mark as aligned after stability threshold
            if (stabilityCounter >= STABILITY_THRESHOLD) {
                setIsCardAligned(true);
            }
        } else {
            setStabilityCounter(prev => Math.max(prev - 2, 0));
            lastAlignedRef.current = false;
            setIsCardAligned(false);
        }

    }, [
        videoElement,
        containerWidth,
        containerHeight,
        expectedFrameWidth,
        expectedFrameHeight,
        sizeTolerance,
        positionTolerance,
        stabilityCounter,
    ]);

    // Start detection loop
    const startDetection = useCallback(() => {
        if (intervalRef.current) return;

        setIsDetecting(true);
        setDetectedCard(null);
        setIsCardAligned(false);
        setStabilityCounter(0);

        intervalRef.current = setInterval(detectCard, DETECTION_INTERVAL);
    }, [detectCard]);

    // Stop detection loop
    const stopDetection = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        setIsDetecting(false);
    }, []);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, []);

    // Auto-start when video is available
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
        startDetection,
        stopDetection,
    };
}
