import { useRef, useCallback, useState, useEffect } from 'react';

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
}

interface UseCardDetectionOptions {
    videoElement: HTMLVideoElement | null;
    containerWidth: number;
    containerHeight: number;
    expectedFrameWidth: number;
    expectedFrameHeight: number;
    // Tolerance for size matching (default 20%)
    sizeTolerance?: number;
    // Tolerance for position matching (default 40px)
    positionTolerance?: number;
    // Debug canvas to draw edges visualization
    debugCanvasRef?: React.RefObject<HTMLCanvasElement | null>;
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
const ASPECT_RATIO_TOLERANCE = 0.20; // ±20%

// Stability frames required for validation (15 frames @ 10fps = 1.5 sec)
const STABILITY_THRESHOLD = 15;

// Detection interval (ms)
const DETECTION_INTERVAL = 100; // 10 FPS

// Canny thresholds
const CANNY_LOW = 40;  // Lowered for better edge detection
const CANNY_HIGH = 120;

// Hough parameters
const HOUGH_THRESHOLD_BASE = 40; // Base threshold, will be scaled by image size
const HOUGH_RHO = 1; // Distance resolution in pixels
const HOUGH_THETA_STEPS = 180; // Angle resolution

// =============================================================================
// VIDEO BOUNDS CALCULATION (for object-fit alignment)
// =============================================================================

interface VideoBounds {
    // Actual video display area within container
    x: number;
    y: number;
    width: number;
    height: number;
    // Scale factors from video pixels to display pixels
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

    // Calculate aspect ratios
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth: number;
    let displayHeight: number;
    let offsetX: number;
    let offsetY: number;

    // Assume object-fit: contain (letterbox) - video fits inside container
    if (videoAspect > containerAspect) {
        // Video is wider - letterbox top/bottom
        displayWidth = containerWidth;
        displayHeight = containerWidth / videoAspect;
        offsetX = 0;
        offsetY = (containerHeight - displayHeight) / 2;
    } else {
        // Video is taller - letterbox left/right
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
// IMAGE PROCESSING - CANNY EDGE DETECTION
// =============================================================================

// Extract ONLY the frame region from video (much faster!)
function getFrameRegionImageData(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    frameX: number,  // Frame position in container coords
    frameY: number,
    frameWidth: number,
    frameHeight: number,
    videoBounds: VideoBounds
): ImageData | null {
    if (!video.videoWidth || !video.videoHeight) return null;

    // Add margin around frame for edge detection (20%)
    const margin = 0.2;
    const marginX = frameWidth * margin;
    const marginY = frameHeight * margin;

    // Frame bounds in container coords (with margin)
    const cropX = Math.max(0, frameX - marginX);
    const cropY = Math.max(0, frameY - marginY);
    const cropW = Math.min(frameWidth + marginX * 2, videoBounds.width - (cropX - videoBounds.x));
    const cropH = Math.min(frameHeight + marginY * 2, videoBounds.height - (cropY - videoBounds.y));

    // Convert to video pixel coords
    const videoX = Math.floor((cropX - videoBounds.x) / videoBounds.scaleX);
    const videoY = Math.floor((cropY - videoBounds.y) / videoBounds.scaleY);
    const videoW = Math.floor(cropW / videoBounds.scaleX);
    const videoH = Math.floor(cropH / videoBounds.scaleY);

    // Clamp to video bounds
    const srcX = Math.max(0, Math.min(videoX, video.videoWidth - 1));
    const srcY = Math.max(0, Math.min(videoY, video.videoHeight - 1));
    const srcW = Math.min(videoW, video.videoWidth - srcX);
    const srcH = Math.min(videoH, video.videoHeight - srcY);

    if (srcW <= 0 || srcH <= 0) return null;

    // Set canvas to crop size
    canvas.width = srcW;
    canvas.height = srcH;

    // Draw only the cropped region
    ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, srcW, srcH);

    return ctx.getImageData(0, 0, srcW, srcH);
}

function toGrayscale(imageData: ImageData): Float32Array {
    const gray = new Float32Array(imageData.width * imageData.height);
    const data = imageData.data;

    for (let i = 0; i < gray.length; i++) {
        const idx = i * 4;
        gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }

    return gray;
}

// Gaussian blur 5x5
function gaussianBlur(gray: Float32Array, width: number, height: number): Float32Array {
    const kernel = [
        1, 4, 6, 4, 1,
        4, 16, 24, 16, 4,
        6, 24, 36, 24, 6,
        4, 16, 24, 16, 4,
        1, 4, 6, 4, 1
    ];
    const kernelSum = 256;
    const result = new Float32Array(width * height);

    for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
            let sum = 0;
            for (let ky = -2; ky <= 2; ky++) {
                for (let kx = -2; kx <= 2; kx++) {
                    const idx = (y + ky) * width + (x + kx);
                    const ki = (ky + 2) * 5 + (kx + 2);
                    sum += gray[idx] * kernel[ki];
                }
            }
            result[y * width + x] = sum / kernelSum;
        }
    }

    return result;
}

// Sobel gradient computation
function sobelGradients(
    gray: Float32Array,
    width: number,
    height: number
): { magnitude: Float32Array; direction: Float32Array } {
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            // Sobel X
            const gx =
                -gray[(y - 1) * width + (x - 1)] +
                gray[(y - 1) * width + (x + 1)] +
                -2 * gray[y * width + (x - 1)] +
                2 * gray[y * width + (x + 1)] +
                -gray[(y + 1) * width + (x - 1)] +
                gray[(y + 1) * width + (x + 1)];

            // Sobel Y
            const gy =
                -gray[(y - 1) * width + (x - 1)] +
                -2 * gray[(y - 1) * width + x] +
                -gray[(y - 1) * width + (x + 1)] +
                gray[(y + 1) * width + (x - 1)] +
                2 * gray[(y + 1) * width + x] +
                gray[(y + 1) * width + (x + 1)];

            const idx = y * width + x;
            magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
            direction[idx] = Math.atan2(gy, gx);
        }
    }

    return { magnitude, direction };
}

// Non-maximum suppression
function nonMaxSuppression(
    magnitude: Float32Array,
    direction: Float32Array,
    width: number,
    height: number
): Float32Array {
    const result = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;
            const mag = magnitude[idx];
            let angle = direction[idx] * 180 / Math.PI;
            if (angle < 0) angle += 180;

            let q = 255, r = 255;

            // 0 degrees
            if ((angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180)) {
                q = magnitude[y * width + (x + 1)];
                r = magnitude[y * width + (x - 1)];
            }
            // 45 degrees
            else if (angle >= 22.5 && angle < 67.5) {
                q = magnitude[(y - 1) * width + (x + 1)];
                r = magnitude[(y + 1) * width + (x - 1)];
            }
            // 90 degrees
            else if (angle >= 67.5 && angle < 112.5) {
                q = magnitude[(y - 1) * width + x];
                r = magnitude[(y + 1) * width + x];
            }
            // 135 degrees
            else if (angle >= 112.5 && angle < 157.5) {
                q = magnitude[(y - 1) * width + (x - 1)];
                r = magnitude[(y + 1) * width + (x + 1)];
            }

            if (mag >= q && mag >= r) {
                result[idx] = mag;
            }
        }
    }

    return result;
}

// Double threshold and hysteresis
function hysteresis(
    nms: Float32Array,
    width: number,
    height: number,
    lowThreshold: number,
    highThreshold: number
): Uint8Array {
    const edges = new Uint8Array(width * height);

    // First pass: mark strong and weak edges
    for (let i = 0; i < nms.length; i++) {
        if (nms[i] >= highThreshold) {
            edges[i] = 255; // Strong edge
        } else if (nms[i] >= lowThreshold) {
            edges[i] = 128; // Weak edge
        }
    }

    // Second pass: connect weak edges to strong edges
    let changed = true;
    while (changed) {
        changed = false;
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (edges[idx] === 128) {
                    // Check if any neighbor is a strong edge
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

    // Remove weak edges that didn't connect
    for (let i = 0; i < edges.length; i++) {
        if (edges[i] === 128) edges[i] = 0;
    }

    return edges;
}

// Full Canny edge detection
function cannyEdgeDetection(
    imageData: ImageData
): { edges: Uint8Array; width: number; height: number } {
    const { width, height } = imageData;

    const gray = toGrayscale(imageData);
    const blurred = gaussianBlur(gray, width, height);
    const { magnitude, direction } = sobelGradients(blurred, width, height);
    const nms = nonMaxSuppression(magnitude, direction, width, height);
    const edges = hysteresis(nms, width, height, CANNY_LOW, CANNY_HIGH);

    return { edges, width, height };
}

// =============================================================================
// HOUGH LINE TRANSFORM
// =============================================================================

interface HoughLine {
    rho: number;      // Distance from origin
    theta: number;    // Angle in radians
    votes: number;    // Accumulator votes
    isHorizontal: boolean;
    isVertical: boolean;
}

function houghLines(
    edges: Uint8Array,
    width: number,
    height: number,
    threshold: number
): HoughLine[] {
    const diagonal = Math.sqrt(width * width + height * height);
    const rhoMax = Math.ceil(diagonal);
    const thetaSteps = HOUGH_THETA_STEPS;

    // Accumulator
    const accumulator = new Uint32Array(2 * rhoMax * thetaSteps);

    // Precompute sin/cos
    const sinTable = new Float32Array(thetaSteps);
    const cosTable = new Float32Array(thetaSteps);
    for (let t = 0; t < thetaSteps; t++) {
        const theta = (t * Math.PI) / thetaSteps;
        sinTable[t] = Math.sin(theta);
        cosTable[t] = Math.cos(theta);
    }

    // Vote
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            if (edges[y * width + x] === 255) {
                for (let t = 0; t < thetaSteps; t++) {
                    const rho = Math.round(x * cosTable[t] + y * sinTable[t]);
                    const rhoIdx = rho + rhoMax;
                    accumulator[rhoIdx * thetaSteps + t]++;
                }
            }
        }
    }

    // Find peaks
    const lines: HoughLine[] = [];
    for (let rhoIdx = 0; rhoIdx < 2 * rhoMax; rhoIdx++) {
        for (let t = 0; t < thetaSteps; t++) {
            const votes = accumulator[rhoIdx * thetaSteps + t];
            if (votes >= threshold) {
                const rho = rhoIdx - rhoMax;
                const theta = (t * Math.PI) / thetaSteps;

                // Determine if horizontal or vertical
                const angleDeg = (theta * 180) / Math.PI;
                const isHorizontal = (angleDeg > 70 && angleDeg < 110);
                const isVertical = (angleDeg < 20 || angleDeg > 160);

                lines.push({ rho, theta, votes, isHorizontal, isVertical });
            }
        }
    }

    // Sort by votes
    lines.sort((a, b) => b.votes - a.votes);

    return lines;
}

// Find the best rectangle from Hough lines - matching expected size
function findRectangle(
    lines: HoughLine[],
    width: number,
    height: number,
    expectedWidth: number,
    expectedHeight: number
): { x: number; y: number; w: number; h: number } | null {
    // Separate horizontal and vertical lines
    const horizontals = lines.filter(l => l.isHorizontal).slice(0, 20);
    const verticals = lines.filter(l => l.isVertical).slice(0, 20);

    if (horizontals.length < 2 || verticals.length < 2) {
        return null;
    }

    // Image center
    const centerX = width / 2;
    const centerY = height / 2;

    // Find ALL valid rectangle candidates and score them
    interface RectCandidate {
        x: number;
        y: number;
        w: number;
        h: number;
        score: number;
    }

    const candidates: RectCandidate[] = [];

    for (let hi = 0; hi < horizontals.length; hi++) {
        for (let hj = hi + 1; hj < horizontals.length; hj++) {
            const h1 = horizontals[hi].rho;
            const h2 = horizontals[hj].rho;
            const rectHeight = Math.abs(h2 - h1);

            // Skip if height too different from expected (±50%)
            if (rectHeight < expectedHeight * 0.5 || rectHeight > expectedHeight * 1.5) {
                continue;
            }

            for (let vi = 0; vi < verticals.length; vi++) {
                for (let vj = vi + 1; vj < verticals.length; vj++) {
                    const v1 = verticals[vi].rho;
                    const v2 = verticals[vj].rho;
                    const rectWidth = Math.abs(v2 - v1);

                    // Skip if width too different from expected (±50%)
                    if (rectWidth < expectedWidth * 0.5 || rectWidth > expectedWidth * 1.5) {
                        continue;
                    }

                    // Check aspect ratio
                    const aspectRatio = rectWidth / rectHeight;
                    const ratioMatch = aspectRatio / CREDIT_CARD_ASPECT_RATIO;
                    if (ratioMatch < 0.8 || ratioMatch > 1.2) {
                        continue;
                    }

                    const x = Math.min(v1, v2);
                    const y = Math.min(h1, h2);
                    const rectCenterX = x + rectWidth / 2;
                    const rectCenterY = y + rectHeight / 2;

                    // Score: prefer rectangles close to expected size and centered
                    const sizeMatchW = 1 - Math.abs(rectWidth - expectedWidth) / expectedWidth;
                    const sizeMatchH = 1 - Math.abs(rectHeight - expectedHeight) / expectedHeight;
                    const centerDist = Math.sqrt(
                        Math.pow(rectCenterX - centerX, 2) +
                        Math.pow(rectCenterY - centerY, 2)
                    );
                    const centerScore = 1 - centerDist / Math.sqrt(width * width + height * height);

                    const score = sizeMatchW * 0.35 + sizeMatchH * 0.35 + centerScore * 0.3;

                    candidates.push({ x, y, w: rectWidth, h: rectHeight, score });
                }
            }
        }
    }

    if (candidates.length === 0) {
        return null;
    }

    // Pick the best candidate
    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    console.log('[CardDetection] 🎯 Best rectangle candidate:', {
        ...best,
        expectedSize: `${expectedWidth.toFixed(0)}x${expectedHeight.toFixed(0)}`,
        candidates: candidates.length,
    });

    return { x: best.x, y: best.y, w: best.w, h: best.h };
}

// =============================================================================
// ALTERNATIVE: CONTOUR-BASED DETECTION (simpler, more robust)
// =============================================================================

interface BoundingBox {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    area: number;
}

function findContours(
    edges: Uint8Array,
    width: number,
    height: number
): BoundingBox[] {
    const visited = new Uint8Array(width * height);
    const contours: BoundingBox[] = [];

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (edges[idx] === 255 && !visited[idx]) {
                // BFS to find contour bounds
                const bbox = bfsContour(edges, visited, width, height, x, y);
                if (bbox.area > width * height * 0.01) { // Min 1% of image
                    contours.push(bbox);
                }
            }
        }
    }

    return contours;
}

function bfsContour(
    edges: Uint8Array,
    visited: Uint8Array,
    width: number,
    height: number,
    startX: number,
    startY: number
): BoundingBox {
    const queue: [number, number][] = [[startX, startY]];
    let minX = startX, maxX = startX;
    let minY = startY, maxY = startY;
    let area = 0;

    while (queue.length > 0) {
        const [x, y] = queue.shift()!;
        const idx = y * width + x;

        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (visited[idx] || edges[idx] !== 255) continue;

        visited[idx] = 1;
        area++;

        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);

        // 8-connectivity
        queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        queue.push([x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1]);
    }

    return { minX, maxX, minY, maxY, area };
}

function findBestCardContour(
    contours: BoundingBox[],
    width: number,
    height: number,
    expectedWidth: number,
    expectedHeight: number
): BoundingBox | null {
    const centerX = width / 2;
    const centerY = height / 2;

    let bestContour: BoundingBox | null = null;
    let bestScore = -Infinity;

    for (const contour of contours) {
        const cWidth = contour.maxX - contour.minX;
        const cHeight = contour.maxY - contour.minY;

        // Filter by aspect ratio
        const aspect = cWidth / cHeight;
        const ratioMatch = aspect / CREDIT_CARD_ASPECT_RATIO;
        if (ratioMatch < 0.7 || ratioMatch > 1.3) continue;

        // Filter by size (must be reasonable)
        const expectedWidthVideo = expectedWidth * (width / expectedWidth);
        if (cWidth < width * 0.10 || cWidth > width * 0.80) continue;
        if (cHeight < height * 0.10 || cHeight > height * 0.80) continue;

        // Calculate center
        const cCenterX = (contour.minX + contour.maxX) / 2;
        const cCenterY = (contour.minY + contour.maxY) / 2;

        // Distance to center
        const distToCenter = Math.sqrt(
            Math.pow(cCenterX - centerX, 2) +
            Math.pow(cCenterY - centerY, 2)
        );

        // Score: prefer centered, larger, good aspect ratio
        const aspectScore = 1 - Math.abs(1 - ratioMatch);
        const sizeScore = contour.area / (width * height);
        const centerScore = 1 - (distToCenter / Math.sqrt(width * width + height * height));

        const score = aspectScore * 0.4 + sizeScore * 0.3 + centerScore * 0.3;

        if (score > bestScore) {
            bestScore = score;
            bestContour = contour;
        }
    }

    return bestContour;
}

// =============================================================================
// DEBUG VISUALIZATION
// =============================================================================

function drawDebugVisualization(
    debugCanvas: HTMLCanvasElement,
    edges: Uint8Array,
    cropWidth: number,  // Size of the cropped region (video pixels)
    cropHeight: number,
    rect: { x: number; y: number; w: number; h: number } | null,
    // Canvas display dimensions
    canvasDisplayWidth: number,
    canvasDisplayHeight: number
): void {
    const ctx = debugCanvas.getContext('2d');
    if (!ctx) return;

    // Set canvas internal resolution to match display size for sharp rendering
    debugCanvas.width = canvasDisplayWidth;
    debugCanvas.height = canvasDisplayHeight;

    // Clear
    ctx.clearRect(0, 0, canvasDisplayWidth, canvasDisplayHeight);

    // Scale factors from video pixels to canvas display pixels
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
                    edgeImageData.data[idx] = 0;       // R
                    edgeImageData.data[idx + 1] = 255; // G
                    edgeImageData.data[idx + 2] = 0;   // B
                    edgeImageData.data[idx + 3] = 200; // A
                }
            }
        }
    }
    ctx.putImageData(edgeImageData, 0, 0);

    // Draw detected rectangle in red
    if (rect) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.strokeRect(
            rect.x * scaleX,
            rect.y * scaleY,
            rect.w * scaleX,
            rect.h * scaleY
        );

        // Draw center cross
        const cx = (rect.x + rect.w / 2) * scaleX;
        const cy = (rect.y + rect.h / 2) * scaleY;
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx, cy + 10);
        ctx.stroke();
    }

    // Draw border to show canvas bounds (cyan)
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvasDisplayWidth - 2, canvasDisplayHeight - 2);
}

// =============================================================================
// MAIN DETECTION FUNCTION
// =============================================================================

interface DetectionResult {
    card: DetectedCard | null;
    edges: Uint8Array;
    rect: { x: number; y: number; w: number; h: number } | null;
    cropWidth: number;
    cropHeight: number;
    // Where the crop region is in container coords (for debug drawing)
    drawX: number;
    drawY: number;
    drawWidth: number;
    drawHeight: number;
}

function detectCardInCropRegion(
    imageData: ImageData,
    // Frame position in container coords
    frameX: number,
    frameY: number,
    frameWidth: number,
    frameHeight: number,
    // For alignment check
    containerWidth: number,
    containerHeight: number,
    sizeTolerance: number,
    positionTolerance: number,
    // Crop region info for debug
    drawX: number,
    drawY: number,
    drawWidth: number,
    drawHeight: number
): DetectionResult {
    const { width, height } = imageData;

    // Step 1: Canny edge detection on the cropped region
    const { edges } = cannyEdgeDetection(imageData);

    // Default result
    const baseResult = {
        edges,
        cropWidth: width,
        cropHeight: height,
        drawX,
        drawY,
        drawWidth,
        drawHeight
    };

    // Expected card size in crop region pixels
    // The frame should roughly fill the crop region (since we added 20% margin each side)
    const expectedWidthInCrop = width * (1 / 1.4);  // ~70% of crop width
    const expectedHeightInCrop = height * (1 / 1.4);

    // Adaptive Hough threshold based on image size
    // Smaller images have fewer edge pixels, so need lower threshold
    const imageSize = Math.sqrt(width * height);
    const houghThreshold = Math.max(20, Math.min(60, HOUGH_THRESHOLD_BASE * (imageSize / 300)));

    // Step 2: Try Hough line detection
    const lines = houghLines(edges, width, height, houghThreshold);

    console.log('[CardDetection] 🔍 Crop region:', `${width}x${height}`,
        'Expected card:', `${expectedWidthInCrop.toFixed(0)}x${expectedHeightInCrop.toFixed(0)}`,
        'Lines:', lines.length, 'Hough threshold:', houghThreshold.toFixed(0));

    let rect = findRectangle(lines, width, height, expectedWidthInCrop, expectedHeightInCrop);

    // Step 3: If Hough fails, try contour detection
    if (!rect) {
        const contours = findContours(edges, width, height);
        const bestContour = findBestCardContour(contours, width, height, expectedWidthInCrop, expectedHeightInCrop);

        if (bestContour) {
            rect = {
                x: bestContour.minX,
                y: bestContour.minY,
                w: bestContour.maxX - bestContour.minX,
                h: bestContour.maxY - bestContour.minY
            };
        }
    }

    if (!rect) {
        return { ...baseResult, card: null, rect: null };
    }

    // Check if rectangle is roughly centered in the crop region
    const rectCenterX = rect.x + rect.w / 2;
    const rectCenterY = rect.y + rect.h / 2;
    const cropCenterX = width / 2;
    const cropCenterY = height / 2;

    // Position tolerance in crop pixels (20% of crop size - more forgiving)
    const posToleranceCrop = Math.min(width, height) * 0.20;

    const offsetX = Math.abs(rectCenterX - cropCenterX);
    const offsetY = Math.abs(rectCenterY - cropCenterY);

    // Size check - rectangle should be close to expected size
    const sizeRatioW = rect.w / expectedWidthInCrop;
    const sizeRatioH = rect.h / expectedHeightInCrop;

    const isSizeMatch =
        sizeRatioW >= (1 - sizeTolerance) && sizeRatioW <= (1 + sizeTolerance) &&
        sizeRatioH >= (1 - sizeTolerance) && sizeRatioH <= (1 + sizeTolerance);

    const isPositionMatch = offsetX <= posToleranceCrop && offsetY <= posToleranceCrop;
    const isAligned = isSizeMatch && isPositionMatch;

    // Calculate confidence
    const aspectRatio = rect.w / rect.h;
    const aspectConfidence = 1 - Math.abs(aspectRatio - CREDIT_CARD_ASPECT_RATIO) / CREDIT_CARD_ASPECT_RATIO;
    const sizeConfidence = Math.min(sizeRatioW, 1 / sizeRatioW) * Math.min(sizeRatioH, 1 / sizeRatioH);
    const confidence = Math.min(1, Math.max(0, (aspectConfidence + sizeConfidence) / 2));

    // Convert rectangle to container coordinates
    const scaleToContainer = drawWidth / width;
    const cardX = drawX + rect.x * scaleToContainer;
    const cardY = drawY + rect.y * scaleToContainer;
    const cardWidth = rect.w * scaleToContainer;
    const cardHeight = rect.h * scaleToContainer;

    console.log('[CardDetection] 📊 Result:', {
        rectInCrop: `${rect.x.toFixed(0)},${rect.y.toFixed(0)} ${rect.w.toFixed(0)}x${rect.h.toFixed(0)}`,
        cardInContainer: `${cardX.toFixed(0)},${cardY.toFixed(0)} ${cardWidth.toFixed(0)}x${cardHeight.toFixed(0)}`,
        sizeRatio: `W:${sizeRatioW.toFixed(2)} H:${sizeRatioH.toFixed(2)}`,
        posOffset: `X:${offsetX.toFixed(0)} Y:${offsetY.toFixed(0)}`,
        isSizeMatch,
        isPositionMatch,
        isAligned,
    });

    const card: DetectedCard = {
        x: cardX,
        y: cardY,
        width: cardWidth,
        height: cardHeight,
        centerX: cardX + cardWidth / 2,
        centerY: cardY + cardHeight / 2,
        aspectRatio,
        confidence,
        isAligned,
    };

    return { ...baseResult, card, rect };
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
    sizeTolerance = 0.20,
    positionTolerance = 40,
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

        // Calculate video display bounds (accounting for object-fit)
        const videoBounds = getVideoBounds(videoElement, containerWidth, containerHeight);

        // Calculate frame position (centered in container)
        const frameX = (containerWidth - expectedFrameWidth) / 2;
        const frameY = (containerHeight - expectedFrameHeight) / 2;

        // Calculate the crop region with margin
        const margin = 0.2;
        const marginX = expectedFrameWidth * margin;
        const marginY = expectedFrameHeight * margin;
        const drawX = Math.max(videoBounds.x, frameX - marginX);
        const drawY = Math.max(videoBounds.y, frameY - marginY);
        const drawWidth = Math.min(expectedFrameWidth + marginX * 2, videoBounds.width);
        const drawHeight = Math.min(expectedFrameHeight + marginY * 2, videoBounds.height);

        // Extract only the frame region from video
        const imageData = getFrameRegionImageData(
            videoElement,
            canvasRef.current,
            ctxRef.current,
            frameX,
            frameY,
            expectedFrameWidth,
            expectedFrameHeight,
            videoBounds
        );
        if (!imageData) return;

        // Detect card in the cropped region
        const result = detectCardInCropRegion(
            imageData,
            frameX,
            frameY,
            expectedFrameWidth,
            expectedFrameHeight,
            containerWidth,
            containerHeight,
            sizeTolerance,
            positionTolerance,
            drawX,
            drawY,
            drawWidth,
            drawHeight
        );

        // Draw debug visualization if canvas provided
        // Canvas covers frame area + 20% margin on each side (= 1.4x frame size)
        if (debugCanvasRef?.current) {
            const canvasDisplayWidth = expectedFrameWidth * 1.4;
            const canvasDisplayHeight = expectedFrameHeight * 1.4;
            drawDebugVisualization(
                debugCanvasRef.current,
                result.edges,
                result.cropWidth,
                result.cropHeight,
                result.rect,
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
            // Card detected but not aligned - partial stability
            stableCountRef.current = Math.max(stableCountRef.current - 1, 0);
            setStabilityCounter(stableCountRef.current);
            setIsCardAligned(false);
        } else {
            // No card detected
            stableCountRef.current = Math.max(stableCountRef.current - 2, 0);
            setStabilityCounter(stableCountRef.current);
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
        debugCanvasRef,
    ]);

    // Start detection loop
    const startDetection = useCallback(() => {
        if (intervalRef.current) return;

        setIsDetecting(true);
        setDetectedCard(null);
        setIsCardAligned(false);
        setStabilityCounter(0);
        stableCountRef.current = 0;

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
