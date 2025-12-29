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
    startDetection: () => void;
    stopDetection: () => void;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// Credit card aspect ratio (ISO 7810 ID-1)
const CREDIT_CARD_ASPECT_RATIO = 85.6 / 53.98; // ~1.586

// Tolerance for aspect ratio matching
const ASPECT_RATIO_TOLERANCE = 0.25; // ±25%

// Stability frames required for validation (15 frames @ 10fps = 1.5 sec)
const STABILITY_THRESHOLD = 15;

// Detection interval (ms)
const DETECTION_INTERVAL = 100; // 10 FPS

// Canny thresholds
const CANNY_LOW = 30;
const CANNY_HIGH = 100;

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
// FIND CONTOURS - Suzuki-Abe algorithm (from LingDong's implementation)
// =============================================================================

interface Contour {
    points: [number, number][];
    isHole: boolean;
    id: number;
    parent?: number;
}

const N_PIXEL_NEIGHBOR = 8;

function neighborIDToIndex(i: number, j: number, id: number): [number, number] | null {
    if (id === 0) return [i, j + 1];
    if (id === 1) return [i - 1, j + 1];
    if (id === 2) return [i - 1, j];
    if (id === 3) return [i - 1, j - 1];
    if (id === 4) return [i, j - 1];
    if (id === 5) return [i + 1, j - 1];
    if (id === 6) return [i + 1, j];
    if (id === 7) return [i + 1, j + 1];
    return null;
}

function neighborIndexToID(i0: number, j0: number, i: number, j: number): number {
    const di = i - i0;
    const dj = j - j0;
    if (di === 0 && dj === 1) return 0;
    if (di === -1 && dj === 1) return 1;
    if (di === -1 && dj === 0) return 2;
    if (di === -1 && dj === -1) return 3;
    if (di === 0 && dj === -1) return 4;
    if (di === 1 && dj === -1) return 5;
    if (di === 1 && dj === 0) return 6;
    if (di === 1 && dj === 1) return 7;
    return -1;
}

function ccwNon0(F: Int32Array, w: number, h: number, i0: number, j0: number, i: number, j: number, offset: number): [number, number] | null {
    const id = neighborIndexToID(i0, j0, i, j);
    for (let k = 0; k < N_PIXEL_NEIGHBOR; k++) {
        const kk = (k + id + offset + N_PIXEL_NEIGHBOR * 2) % N_PIXEL_NEIGHBOR;
        const ij = neighborIDToIndex(i0, j0, kk);
        if (ij && F[ij[0] * w + ij[1]] !== 0) {
            return ij;
        }
    }
    return null;
}

function cwNon0(F: Int32Array, w: number, h: number, i0: number, j0: number, i: number, j: number, offset: number): [number, number] | null {
    const id = neighborIndexToID(i0, j0, i, j);
    for (let k = 0; k < N_PIXEL_NEIGHBOR; k++) {
        const kk = (-k + id - offset + N_PIXEL_NEIGHBOR * 2) % N_PIXEL_NEIGHBOR;
        const ij = neighborIDToIndex(i0, j0, kk);
        if (ij && F[ij[0] * w + ij[1]] !== 0) {
            return ij;
        }
    }
    return null;
}

function findContoursFromBinary(binaryImage: Uint8Array, w: number, h: number): Contour[] {
    // Copy to Int32Array for the algorithm (it modifies the array)
    const F = new Int32Array(w * h);
    for (let i = 0; i < binaryImage.length; i++) {
        F[i] = binaryImage[i] > 0 ? 1 : 0;
    }

    let nbd = 1;
    let lnbd = 1;
    const contours: Contour[] = [];

    // Clear borders
    for (let i = 1; i < h - 1; i++) {
        F[i * w] = 0;
        F[i * w + w - 1] = 0;
    }
    for (let i = 0; i < w; i++) {
        F[i] = 0;
        F[w * h - 1 - i] = 0;
    }

    for (let i = 1; i < h - 1; i++) {
        lnbd = 1;
        for (let j = 1; j < w - 1; j++) {
            let i2 = 0, j2 = 0;

            if (F[i * w + j] === 0) continue;

            if (F[i * w + j] === 1 && F[i * w + (j - 1)] === 0) {
                nbd++;
                i2 = i;
                j2 = j - 1;
            } else if (F[i * w + j] >= 1 && F[i * w + j + 1] === 0) {
                nbd++;
                i2 = i;
                j2 = j + 1;
                if (F[i * w + j] > 1) {
                    lnbd = F[i * w + j];
                }
            } else {
                if (F[i * w + j] !== 1) lnbd = Math.abs(F[i * w + j]);
                continue;
            }

            const B: Contour = {
                points: [[j, i]],
                isHole: j2 === j + 1,
                id: nbd,
            };
            contours.push(B);

            let B0: Contour | undefined;
            for (const c of contours) {
                if (c.id === lnbd) {
                    B0 = c;
                    break;
                }
            }

            if (B0) {
                if (B0.isHole) {
                    B.parent = B.isHole ? B0.parent : lnbd;
                } else {
                    B.parent = B.isHole ? lnbd : B0.parent;
                }
            }

            const i1j1 = cwNon0(F, w, h, i, j, i2, j2, 0);
            if (!i1j1) {
                F[i * w + j] = -nbd;
                if (F[i * w + j] !== 1) lnbd = Math.abs(F[i * w + j]);
                continue;
            }

            let i1 = i1j1[0], j1 = i1j1[1];
            i2 = i1;
            j2 = j1;
            let i3 = i, j3 = j;

            while (true) {
                const i4j4 = ccwNon0(F, w, h, i3, j3, i2, j2, 1);
                if (!i4j4) break;

                const i4 = i4j4[0], j4 = i4j4[1];
                contours[contours.length - 1].points.push([j4, i4]);

                if (F[i3 * w + j3 + 1] === 0) {
                    F[i3 * w + j3] = -nbd;
                } else if (F[i3 * w + j3] === 1) {
                    F[i3 * w + j3] = nbd;
                }

                if (i4 === i && j4 === j && i3 === i1 && j3 === j1) {
                    if (F[i * w + j] !== 1) lnbd = Math.abs(F[i * w + j]);
                    break;
                } else {
                    i2 = i3;
                    j2 = j3;
                    i3 = i4;
                    j3 = j4;
                }
            }
        }
    }

    return contours;
}

// =============================================================================
// APPROX POLY DP - Douglas-Peucker algorithm
// =============================================================================

function pointDistanceToSegment(p: [number, number], p0: [number, number], p1: [number, number]): number {
    const x = p[0], y = p[1];
    const x1 = p0[0], y1 = p0[1];
    const x2 = p1[0], y2 = p1[1];
    const A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) param = dot / len_sq;

    let xx: number, yy: number;
    if (param < 0) {
        xx = x1; yy = y1;
    } else if (param > 1) {
        xx = x2; yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    return Math.sqrt((x - xx) ** 2 + (y - yy) ** 2);
}

function approxPolyDP(polyline: [number, number][], epsilon: number): [number, number][] {
    if (polyline.length <= 2) return polyline;

    let dmax = 0;
    let argmax = -1;

    for (let i = 1; i < polyline.length - 1; i++) {
        const d = pointDistanceToSegment(polyline[i], polyline[0], polyline[polyline.length - 1]);
        if (d > dmax) {
            dmax = d;
            argmax = i;
        }
    }

    if (dmax > epsilon) {
        const L = approxPolyDP(polyline.slice(0, argmax + 1), epsilon);
        const R = approxPolyDP(polyline.slice(argmax), epsilon);
        return [...L.slice(0, -1), ...R];
    } else {
        return [[...polyline[0]] as [number, number], [...polyline[polyline.length - 1]] as [number, number]];
    }
}

// =============================================================================
// IMAGE PROCESSING - CANNY EDGE DETECTION
// =============================================================================

function getFrameRegionImageData(
    video: HTMLVideoElement,
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    frameX: number,
    frameY: number,
    frameWidth: number,
    frameHeight: number,
    videoBounds: VideoBounds
): ImageData | null {
    if (!video.videoWidth || !video.videoHeight) return null;

    const margin = 0.2;
    const marginX = frameWidth * margin;
    const marginY = frameHeight * margin;

    const cropX = Math.max(0, frameX - marginX);
    const cropY = Math.max(0, frameY - marginY);
    const cropW = Math.min(frameWidth + marginX * 2, videoBounds.width - (cropX - videoBounds.x));
    const cropH = Math.min(frameHeight + marginY * 2, videoBounds.height - (cropY - videoBounds.y));

    const videoX = Math.floor((cropX - videoBounds.x) / videoBounds.scaleX);
    const videoY = Math.floor((cropY - videoBounds.y) / videoBounds.scaleY);
    const videoW = Math.floor(cropW / videoBounds.scaleX);
    const videoH = Math.floor(cropH / videoBounds.scaleY);

    const srcX = Math.max(0, Math.min(videoX, video.videoWidth - 1));
    const srcY = Math.max(0, Math.min(videoY, video.videoHeight - 1));
    const srcW = Math.min(videoW, video.videoWidth - srcX);
    const srcH = Math.min(videoH, video.videoHeight - srcY);

    if (srcW <= 0 || srcH <= 0) return null;

    canvas.width = srcW;
    canvas.height = srcH;
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

function gaussianBlur(gray: Float32Array, width: number, height: number): Float32Array {
    const kernel = [1, 4, 6, 4, 1, 4, 16, 24, 16, 4, 6, 24, 36, 24, 6, 4, 16, 24, 16, 4, 1, 4, 6, 4, 1];
    const kernelSum = 256;
    const result = new Float32Array(width * height);

    for (let y = 2; y < height - 2; y++) {
        for (let x = 2; x < width - 2; x++) {
            let sum = 0;
            for (let ky = -2; ky <= 2; ky++) {
                for (let kx = -2; kx <= 2; kx++) {
                    sum += gray[(y + ky) * width + (x + kx)] * kernel[(ky + 2) * 5 + (kx + 2)];
                }
            }
            result[y * width + x] = sum / kernelSum;
        }
    }

    return result;
}

function sobelGradients(gray: Float32Array, width: number, height: number): { magnitude: Float32Array; direction: Float32Array } {
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

function cannyEdgeDetection(imageData: ImageData): { edges: Uint8Array; width: number; height: number } {
    const { width, height } = imageData;
    const gray = toGrayscale(imageData);
    const blurred = gaussianBlur(gray, width, height);
    const { magnitude, direction } = sobelGradients(blurred, width, height);
    const nms = nonMaxSuppression(magnitude, direction, width, height);
    const edges = hysteresis(nms, width, height, CANNY_LOW, CANNY_HIGH);
    return { edges, width, height };
}

// =============================================================================
// RECTANGLE DETECTION FROM CONTOURS
// =============================================================================

interface RectangleCandidate {
    x: number;
    y: number;
    w: number;
    h: number;
    points: [number, number][];
    score: number;
}

function findRectanglesFromContours(
    contours: Contour[],
    width: number,
    height: number,
    expectedWidth: number,
    expectedHeight: number
): RectangleCandidate | null {
    const candidates: RectangleCandidate[] = [];
    const centerX = width / 2;
    const centerY = height / 2;

    // Margin to reject rectangles too close to crop boundary
    const boundaryMargin = 10;

    for (const contour of contours) {
        // Skip small contours
        if (contour.points.length < 20) continue;

        // Calculate perimeter for epsilon
        let perimeter = 0;
        for (let i = 0; i < contour.points.length; i++) {
            const p1 = contour.points[i];
            const p2 = contour.points[(i + 1) % contour.points.length];
            perimeter += Math.sqrt((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2);
        }

        // Approximate to polygon
        const epsilon = perimeter * 0.02;
        const approx = approxPolyDP(contour.points, epsilon);

        // We want quadrilaterals (4 points)
        if (approx.length !== 4 && approx.length !== 5) continue;

        // Use first 4 points if we got 5 (closed polygon)
        const pts = approx.slice(0, 4);

        // Get bounding rect
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const p of pts) {
            minX = Math.min(minX, p[0]);
            minY = Math.min(minY, p[1]);
            maxX = Math.max(maxX, p[0]);
            maxY = Math.max(maxY, p[1]);
        }

        const rectW = maxX - minX;
        const rectH = maxY - minY;

        // IMPORTANT: Skip rectangles too close to the crop boundary (likely the boundary itself!)
        if (minX < boundaryMargin || minY < boundaryMargin ||
            maxX > width - boundaryMargin || maxY > height - boundaryMargin) {
            continue;
        }

        // Skip if too small or too large
        if (rectW < expectedWidth * 0.5 || rectW > expectedWidth * 1.5) continue;
        if (rectH < expectedHeight * 0.5 || rectH > expectedHeight * 1.5) continue;

        // Check aspect ratio
        const aspectRatio = rectW / rectH;
        const ratioMatch = aspectRatio / CREDIT_CARD_ASPECT_RATIO;
        if (ratioMatch < (1 - ASPECT_RATIO_TOLERANCE) || ratioMatch > (1 + ASPECT_RATIO_TOLERANCE)) continue;

        // Calculate scores
        const rectCenterX = minX + rectW / 2;
        const rectCenterY = minY + rectH / 2;

        const sizeMatchW = 1 - Math.abs(rectW - expectedWidth) / expectedWidth;
        const sizeMatchH = 1 - Math.abs(rectH - expectedHeight) / expectedHeight;
        const centerDist = Math.sqrt((rectCenterX - centerX) ** 2 + (rectCenterY - centerY) ** 2);
        const maxDist = Math.sqrt(width ** 2 + height ** 2) / 2;
        const centerScore = 1 - centerDist / maxDist;
        const aspectScore = 1 - Math.abs(ratioMatch - 1);

        const score = sizeMatchW * 0.25 + sizeMatchH * 0.25 + centerScore * 0.25 + aspectScore * 0.25;

        candidates.push({
            x: minX,
            y: minY,
            w: rectW,
            h: rectH,
            points: pts,
            score
        });
    }

    if (candidates.length === 0) return null;

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];

    console.log('[CardDetection] 🎯 Best rectangle:', {
        pos: `${best.x.toFixed(0)},${best.y.toFixed(0)}`,
        size: `${best.w.toFixed(0)}x${best.h.toFixed(0)}`,
        aspect: (best.w / best.h).toFixed(2),
        score: best.score.toFixed(2),
        candidates: candidates.length,
    });

    return best;
}

// =============================================================================
// DEBUG VISUALIZATION
// =============================================================================

function drawDebugVisualization(
    debugCanvas: HTMLCanvasElement,
    edges: Uint8Array,
    cropWidth: number,
    cropHeight: number,
    rect: RectangleCandidate | null,
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
                    edgeImageData.data[idx + 1] = 255;
                    edgeImageData.data[idx + 2] = 0;
                    edgeImageData.data[idx + 3] = 200;
                }
            }
        }
    }
    ctx.putImageData(edgeImageData, 0, 0);

    // Draw detected rectangle
    if (rect) {
        // Draw polygon outline in red
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (rect.points && rect.points.length >= 4) {
            ctx.moveTo(rect.points[0][0] * scaleX, rect.points[0][1] * scaleY);
            for (let i = 1; i < rect.points.length; i++) {
                ctx.lineTo(rect.points[i][0] * scaleX, rect.points[i][1] * scaleY);
            }
            ctx.closePath();
        } else {
            ctx.rect(rect.x * scaleX, rect.y * scaleY, rect.w * scaleX, rect.h * scaleY);
        }
        ctx.stroke();

        // Draw corner points
        ctx.fillStyle = 'yellow';
        if (rect.points) {
            for (const p of rect.points) {
                ctx.beginPath();
                ctx.arc(p[0] * scaleX, p[1] * scaleY, 5, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Draw center cross
        const cx = (rect.x + rect.w / 2) * scaleX;
        const cy = (rect.y + rect.h / 2) * scaleY;
        ctx.strokeStyle = 'red';
        ctx.beginPath();
        ctx.moveTo(cx - 10, cy);
        ctx.lineTo(cx + 10, cy);
        ctx.moveTo(cx, cy - 10);
        ctx.lineTo(cx, cy + 10);
        ctx.stroke();
    }

    // Draw border
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
    rect: RectangleCandidate | null;
    cropWidth: number;
    cropHeight: number;
}

function detectCardInCropRegion(
    imageData: ImageData,
    frameX: number,
    frameY: number,
    frameWidth: number,
    frameHeight: number,
    containerWidth: number,
    containerHeight: number,
    sizeTolerance: number,
    positionTolerance: number,
    drawX: number,
    drawY: number,
    drawWidth: number,
    drawHeight: number
): DetectionResult {
    const { width, height } = imageData;

    // Step 1: Canny edge detection
    const { edges } = cannyEdgeDetection(imageData);

    const baseResult = {
        edges,
        cropWidth: width,
        cropHeight: height,
    };

    // Expected card size in crop region (~70% because of 20% margin on each side)
    const expectedWidthInCrop = width * (1 / 1.4);
    const expectedHeightInCrop = height * (1 / 1.4);

    // Step 2: Find contours from edges
    const contours = findContoursFromBinary(edges, width, height);

    console.log('[CardDetection] 🔍 Contours found:', contours.length,
        'Expected size:', `${expectedWidthInCrop.toFixed(0)}x${expectedHeightInCrop.toFixed(0)}`);

    // Step 3: Find rectangles from contours
    const rect = findRectanglesFromContours(contours, width, height, expectedWidthInCrop, expectedHeightInCrop);

    if (!rect) {
        return { ...baseResult, card: null, rect: null };
    }

    // Check alignment
    const rectCenterX = rect.x + rect.w / 2;
    const rectCenterY = rect.y + rect.h / 2;
    const cropCenterX = width / 2;
    const cropCenterY = height / 2;

    const posToleranceCrop = Math.min(width, height) * 0.25;
    const offsetX = Math.abs(rectCenterX - cropCenterX);
    const offsetY = Math.abs(rectCenterY - cropCenterY);

    const sizeRatioW = rect.w / expectedWidthInCrop;
    const sizeRatioH = rect.h / expectedHeightInCrop;

    const isSizeMatch = sizeRatioW >= (1 - sizeTolerance) && sizeRatioW <= (1 + sizeTolerance) &&
                        sizeRatioH >= (1 - sizeTolerance) && sizeRatioH <= (1 + sizeTolerance);
    const isPositionMatch = offsetX <= posToleranceCrop && offsetY <= posToleranceCrop;
    const isAligned = isSizeMatch && isPositionMatch;

    const aspectRatio = rect.w / rect.h;
    const confidence = rect.score;

    // Convert to container coordinates
    const scaleToContainer = drawWidth / width;
    const cardX = drawX + rect.x * scaleToContainer;
    const cardY = drawY + rect.y * scaleToContainer;
    const cardWidth = rect.w * scaleToContainer;
    const cardHeight = rect.h * scaleToContainer;

    console.log('[CardDetection] 📊 Result:', {
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
    sizeTolerance = 0.25,
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

        const imageData = getFrameRegionImageData(
            videoElement, canvasRef.current, ctxRef.current,
            frameX, frameY, expectedFrameWidth, expectedFrameHeight, videoBounds
        );
        if (!imageData) return;

        const result = detectCardInCropRegion(
            imageData, frameX, frameY, expectedFrameWidth, expectedFrameHeight,
            containerWidth, containerHeight, sizeTolerance, positionTolerance,
            drawX, drawY, drawWidth, drawHeight
        );

        if (debugCanvasRef?.current) {
            const canvasDisplayWidth = expectedFrameWidth * 1.4;
            const canvasDisplayHeight = expectedFrameHeight * 1.4;
            drawDebugVisualization(
                debugCanvasRef.current, result.edges, result.cropWidth, result.cropHeight,
                result.rect, canvasDisplayWidth, canvasDisplayHeight
            );
        }

        const card = result.card;
        setDetectedCard(card);

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
    }, [videoElement, containerWidth, containerHeight, expectedFrameWidth, expectedFrameHeight, sizeTolerance, positionTolerance, debugCanvasRef]);

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

    return { detectedCard, isDetecting, isCardAligned, stabilityCounter, startDetection, stopDetection };
}
