import { useRef, useCallback, useState, useEffect } from 'react';
import { loadOpenCV, type OpenCVModule } from '../lib/opencv-loader';

// =============================================================================
// TYPES
// =============================================================================

export interface DetectedCard {
    // Bounding box in pixels (container coordinates)
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
    // Corner points (for visualization)
    corners?: [number, number][];
}

interface UseCardDetectionOptions {
    videoElement: HTMLVideoElement | null;
    containerWidth: number;
    containerHeight: number;
    expectedFrameWidth: number;
    expectedFrameHeight: number;
    // Tolerance for size matching (default 25%)
    sizeTolerance?: number;
    // Tolerance for position matching (default 50px)
    positionTolerance?: number;
    // Debug canvas to draw edges visualization
    debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

interface UseCardDetectionResult {
    detectedCard: DetectedCard | null;
    isDetecting: boolean;
    isCardAligned: boolean;
    stabilityCounter: number;
    isLoading: boolean; // OpenCV loading state
    startDetection: () => void;
    stopDetection: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Credit card aspect ratio (ISO 7810 ID-1)
const CREDIT_CARD_ASPECT_RATIO = 85.6 / 53.98; // ~1.586

// Stability frames required for validation (15 frames @ 10fps = 1.5 sec)
const STABILITY_THRESHOLD = 15;

// Detection interval (ms)
const DETECTION_INTERVAL = 100; // 10 FPS

// =============================================================================
// VIDEO BOUNDS CALCULATION (for object-fit alignment)
// =============================================================================

interface VideoBounds {
    x: number;
    y: number;
    width: number;
    height: number;
    scaleX: number;
    scaleY: number;
}

function getVideoBounds(
    video: HTMLVideoElement,
    containerWidth: number,
    containerHeight: number
): VideoBounds {
    const videoWidth = video.videoWidth;
    const videoHeight = video.videoHeight;

    if (!videoWidth || !videoHeight) {
        return { x: 0, y: 0, width: containerWidth, height: containerHeight, scaleX: 1, scaleY: 1 };
    }

    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth: number;
    let displayHeight: number;
    let offsetX: number;
    let offsetY: number;

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

    return {
        x: offsetX,
        y: offsetY,
        width: displayWidth,
        height: displayHeight,
        scaleX: displayWidth / videoWidth,
        scaleY: displayHeight / videoHeight,
    };
}

// =============================================================================
// OPENCV CARD DETECTION
// =============================================================================

interface RectangleCandidate {
    x: number;
    y: number;
    w: number;
    h: number;
    corners: [number, number][];
    area: number;
    aspectRatio: number;
    score: number;
}

interface DetectionResult {
    card: DetectedCard | null;
    candidates: RectangleCandidate[];
    bestCandidate: RectangleCandidate | null;
    debugImage?: ImageData;
}

function detectCardWithOpenCV(
    cv: OpenCVModule,
    imageData: ImageData,
    expectedWidth: number,
    expectedHeight: number,
    cropOffsetX: number,
    cropOffsetY: number,
    scaleToContainer: number
): DetectionResult {
    const result: DetectionResult = {
        card: null,
        candidates: [],
        bestCandidate: null,
    };

    // Create OpenCV Mat from ImageData
    const src = cv.matFromImageData(imageData);
    const gray = new cv.Mat();
    const blurred = new cv.Mat();
    const edges = new cv.Mat();
    const dilated = new cv.Mat();
    const hierarchy = new cv.Mat();
    const contours = new cv.MatVector();

    try {
        // Convert to grayscale
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Apply Gaussian blur to reduce noise
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        // Apply Canny edge detection
        cv.Canny(blurred, edges, 50, 150);

        // Dilate edges to close gaps
        const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
        cv.dilate(edges, dilated, kernel);
        kernel.delete();

        // Find contours
        cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        const centerX = imageData.width / 2;
        const centerY = imageData.height / 2;
        const minArea = expectedWidth * expectedHeight * 0.1; // At least 10% of expected area
        const maxArea = expectedWidth * expectedHeight * 4;   // At most 400% of expected area

        console.log(`[CardDetection] OpenCV: ${contours.size()} contours, expected: ${expectedWidth.toFixed(0)}x${expectedHeight.toFixed(0)}`);

        // Process each contour
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);

            // Skip small contours
            if (area < minArea || area > maxArea) {
                contour.delete();
                continue;
            }

            // Approximate polygon
            const perimeter = cv.arcLength(contour, true);
            const epsilon = 0.02 * perimeter;
            const approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, epsilon, true);

            // We want quadrilaterals (4 corners)
            if (approx.rows === 4) {
                // Extract corner points
                const corners: [number, number][] = [];
                for (let j = 0; j < 4; j++) {
                    const x = approx.data32S[j * 2];
                    const y = approx.data32S[j * 2 + 1];
                    corners.push([x, y]);
                }

                // Calculate bounding rect
                const xs = corners.map(c => c[0]);
                const ys = corners.map(c => c[1]);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const rectW = maxX - minX;
                const rectH = maxY - minY;
                const aspectRatio = rectW / rectH;

                // Check if it looks like a credit card (aspect ratio between 1.2 and 2.0)
                if (aspectRatio >= 1.2 && aspectRatio <= 2.2) {
                    // Calculate score
                    const rectCenterX = minX + rectW / 2;
                    const rectCenterY = minY + rectH / 2;

                    // Size match score
                    const sizeMatchW = 1 - Math.abs(rectW - expectedWidth) / expectedWidth;
                    const sizeMatchH = 1 - Math.abs(rectH - expectedHeight) / expectedHeight;

                    // Center score (how close to center of frame)
                    const maxDist = Math.sqrt(centerX ** 2 + centerY ** 2);
                    const centerDist = Math.sqrt((rectCenterX - centerX) ** 2 + (rectCenterY - centerY) ** 2);
                    const centerScore = 1 - centerDist / maxDist;

                    // Aspect ratio match score
                    const aspectMatch = 1 - Math.abs(aspectRatio - CREDIT_CARD_ASPECT_RATIO) / CREDIT_CARD_ASPECT_RATIO;

                    // Combined score
                    const score = (sizeMatchW * 0.25 + sizeMatchH * 0.25 + centerScore * 0.25 + aspectMatch * 0.25);

                    result.candidates.push({
                        x: minX,
                        y: minY,
                        w: rectW,
                        h: rectH,
                        corners,
                        area,
                        aspectRatio,
                        score: Math.max(0, score),
                    });

                    console.log(`[CardDetection] ✅ Quad: ${rectW.toFixed(0)}x${rectH.toFixed(0)} AR=${aspectRatio.toFixed(2)} score=${score.toFixed(2)}`);
                }
            }

            approx.delete();
            contour.delete();
        }

        // Sort by score and get best candidate
        if (result.candidates.length > 0) {
            result.candidates.sort((a, b) => b.score - a.score);
            result.bestCandidate = result.candidates[0];

            const best = result.bestCandidate;
            console.log(`[CardDetection] 🎯 Best: ${best.w.toFixed(0)}x${best.h.toFixed(0)} AR=${best.aspectRatio.toFixed(2)} score=${best.score.toFixed(2)}`);

            // Check alignment
            const rectCenterX = best.x + best.w / 2;
            const rectCenterY = best.y + best.h / 2;
            const posToleranceCrop = Math.min(imageData.width, imageData.height) * 0.25;
            const offsetX = Math.abs(rectCenterX - centerX);
            const offsetY = Math.abs(rectCenterY - centerY);

            const sizeRatioW = best.w / expectedWidth;
            const sizeRatioH = best.h / expectedHeight;
            const sizeTolerance = 0.35;

            const isSizeMatch = sizeRatioW >= (1 - sizeTolerance) && sizeRatioW <= (1 + sizeTolerance) &&
                                sizeRatioH >= (1 - sizeTolerance) && sizeRatioH <= (1 + sizeTolerance);
            const isPositionMatch = offsetX <= posToleranceCrop && offsetY <= posToleranceCrop;
            const isAligned = isSizeMatch && isPositionMatch;

            // Convert to container coordinates
            const cardX = cropOffsetX + best.x * scaleToContainer;
            const cardY = cropOffsetY + best.y * scaleToContainer;
            const cardWidth = best.w * scaleToContainer;
            const cardHeight = best.h * scaleToContainer;

            // Convert corners to container coordinates
            const containerCorners = best.corners.map(([cx, cy]): [number, number] => [
                cropOffsetX + cx * scaleToContainer,
                cropOffsetY + cy * scaleToContainer,
            ]);

            result.card = {
                x: cardX,
                y: cardY,
                width: cardWidth,
                height: cardHeight,
                centerX: cardX + cardWidth / 2,
                centerY: cardY + cardHeight / 2,
                aspectRatio: best.aspectRatio,
                confidence: best.score,
                isAligned,
                corners: containerCorners,
            };

            console.log(`[CardDetection] 📊 Aligned: ${isAligned} (size: ${isSizeMatch}, pos: ${isPositionMatch})`);
        } else {
            console.log('[CardDetection] ❌ No valid card-shaped quadrilaterals found');
        }

    } finally {
        // Clean up OpenCV Mats
        src.delete();
        gray.delete();
        blurred.delete();
        edges.delete();
        dilated.delete();
        hierarchy.delete();
        contours.delete();
    }

    return result;
}

// =============================================================================
// DEBUG VISUALIZATION
// =============================================================================

function drawDebugVisualization(
    debugCanvas: HTMLCanvasElement,
    candidates: RectangleCandidate[],
    bestCandidate: RectangleCandidate | null,
    cropWidth: number,
    cropHeight: number,
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

    // Draw all candidates in orange
    for (const candidate of candidates) {
        if (candidate === bestCandidate) continue; // Draw best one separately

        ctx.strokeStyle = 'orange';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const corners = candidate.corners;
        ctx.moveTo(corners[0][0] * scaleX, corners[0][1] * scaleY);
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i][0] * scaleX, corners[i][1] * scaleY);
        }
        ctx.closePath();
        ctx.stroke();
    }

    // Draw best candidate in red (thick)
    if (bestCandidate) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.beginPath();
        const corners = bestCandidate.corners;
        ctx.moveTo(corners[0][0] * scaleX, corners[0][1] * scaleY);
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i][0] * scaleX, corners[i][1] * scaleY);
        }
        ctx.closePath();
        ctx.stroke();

        // Draw corner points in yellow
        ctx.fillStyle = 'yellow';
        for (const corner of corners) {
            ctx.beginPath();
            ctx.arc(corner[0] * scaleX, corner[1] * scaleY, 6, 0, Math.PI * 2);
            ctx.fill();
        }

        // Draw center cross
        const cx = (bestCandidate.x + bestCandidate.w / 2) * scaleX;
        const cy = (bestCandidate.y + bestCandidate.h / 2) * scaleY;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(cx - 15, cy);
        ctx.lineTo(cx + 15, cy);
        ctx.moveTo(cx, cy - 15);
        ctx.lineTo(cx, cy + 15);
        ctx.stroke();
    }

    // Draw border cyan
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
    sizeTolerance = 0.25,
    positionTolerance = 50,
    debugCanvasRef,
}: UseCardDetectionOptions): UseCardDetectionResult {
    const [detectedCard, setDetectedCard] = useState<DetectedCard | null>(null);
    const [isDetecting, setIsDetecting] = useState(false);
    const [isCardAligned, setIsCardAligned] = useState(false);
    const [stabilityCounter, setStabilityCounter] = useState(0);
    const [isLoading, setIsLoading] = useState(false);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const stableCountRef = useRef(0);
    const cvRef = useRef<OpenCVModule | null>(null);

    // Initialize canvas
    useEffect(() => {
        if (!canvasRef.current) {
            canvasRef.current = document.createElement('canvas');
            ctxRef.current = canvasRef.current.getContext('2d', { willReadFrequently: true });
        }
    }, []);

    // Load OpenCV when detection starts
    const ensureOpenCVLoaded = useCallback(async () => {
        if (cvRef.current) return true;

        setIsLoading(true);
        try {
            cvRef.current = await loadOpenCV();
            setIsLoading(false);
            return true;
        } catch (error) {
            console.error('[CardDetection] Failed to load OpenCV:', error);
            setIsLoading(false);
            return false;
        }
    }, []);

    const detectCard = useCallback(() => {
        if (!videoElement || !canvasRef.current || !ctxRef.current || !cvRef.current) return;

        const cv = cvRef.current;
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

        // Calculate video source coordinates
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

        const imageData = ctxRef.current.getImageData(0, 0, srcW, srcH);

        // Expected card size in crop region
        const expectedWidthInCrop = srcW * (1 / 1.4);
        const expectedHeightInCrop = srcH * (1 / 1.4);
        const scaleToContainer = drawWidth / srcW;

        // Detect card with OpenCV
        const result = detectCardWithOpenCV(
            cv,
            imageData,
            expectedWidthInCrop,
            expectedHeightInCrop,
            drawX,
            drawY,
            scaleToContainer
        );

        // Draw debug visualization
        if (debugCanvasRef?.current) {
            const canvasDisplayWidth = expectedFrameWidth * 1.4;
            const canvasDisplayHeight = expectedFrameHeight * 1.4;
            drawDebugVisualization(
                debugCanvasRef.current,
                result.candidates,
                result.bestCandidate,
                srcW,
                srcH,
                canvasDisplayWidth,
                canvasDisplayHeight
            );
        }

        const card = result.card;
        setDetectedCard(card);

        // Update stability counter
        if (card && card.isAligned) {
            stableCountRef.current = Math.min(stableCountRef.current + 1, STABILITY_THRESHOLD * 2);
            setStabilityCounter(stableCountRef.current);
            if (stableCountRef.current >= STABILITY_THRESHOLD) {
                setIsCardAligned(true);
            }
        } else if (card) {
            stableCountRef.current = Math.max(stableCountRef.current - 1, 0);
            setStabilityCounter(stableCountRef.current);
            setIsCardAligned(false);
        } else {
            stableCountRef.current = Math.max(stableCountRef.current - 2, 0);
            setStabilityCounter(stableCountRef.current);
            setIsCardAligned(false);
        }
    }, [videoElement, containerWidth, containerHeight, expectedFrameWidth, expectedFrameHeight, debugCanvasRef]);

    const startDetection = useCallback(async () => {
        if (intervalRef.current) return;

        // Ensure OpenCV is loaded
        const loaded = await ensureOpenCVLoaded();
        if (!loaded) return;

        setIsDetecting(true);
        setDetectedCard(null);
        setIsCardAligned(false);
        setStabilityCounter(0);
        stableCountRef.current = 0;
        intervalRef.current = setInterval(detectCard, DETECTION_INTERVAL);
    }, [detectCard, ensureOpenCVLoaded]);

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
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    // Auto-start detection when video is ready
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
        isLoading,
        startDetection,
        stopDetection,
    };
}
