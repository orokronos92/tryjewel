/**
 * =============================================================================
 * use-edge-ar-tracking.ts — MediaPipe Tasks adapter (ring pose + palm flip)
 * =============================================================================
 *
 * Fixes:
 * - Position sur le BON doigt: finger = useJewelryStore.selected.finger (fallback options)
 * - Paume/dos: calc palmNormal via worldLandmarks + flip 180° autour axe doigt
 * - jewelry-3d.tsx ne fait plus de "bidouilles" (conjugate / auto-flip)
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";

import { useCameraStore } from "@/stores/camera-store";
import { useSkeletonAdjustmentStore } from "@/stores/skeleton-adjustment-store";
import { useJewelryStore } from "@/stores/jewelry-store";
import { Vector3OneEuroFilter, QuaternionOneEuroFilter } from "@/lib/one-euro-filter";
import {
    buildRingBasisFromHand,
    isPalmFacingCamera,
    computeFinalQuaternion,
    ensureQuaternionContinuity,
    POSE_DEBUG_CONFIG
} from "@/lib/ar/jewelry-pose";

// =============================================================================
// TYPES (compat projet)
// =============================================================================

interface HandLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}

interface HandResult {
    handedness: string;
    handedness_score: number;
    landmarks: HandLandmark[]; // image space (0..1)
    world_landmarks: HandLandmark[]; // world space (meters, hand centered)
}

export interface JewelryPosition {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number }; // Euler (deg) debug
    quaternion: { x: number; y: number; z: number; w: number };
    direction: { x: number; y: number; z: number }; // finger direction (render space)
    boneLength: number; // render length (for scaling)
    scale: number;
    confidence: number;
}

export interface TrackingResult {
    success: boolean;
    hand_result: HandResult | null;
    jewelry_position: JewelryPosition | null;
    confidence: number;
    processing_time_ms: number;
    frame_id?: string;
    timestamp?: number;
}

export interface UseEdgeARTrackingOptions {
    jewelryType?: "ring" | "bracelet" | "necklace" | "earring";
    finger?: "thumb" | "index" | "middle" | "ring" | "pinky";
    hand?: "left" | "right";
    modelComplexity?: 0 | 1;
    minDetectionConfidence?: number;
    minTrackingConfidence?: number;
    onResult?: (result: TrackingResult) => void;
    frameSkip?: number;
    canvasWidth?: number;
    canvasHeight?: number;
}

// Tasks-vision
type HandednessLabel = "Left" | "Right";

type TasksHandLandmarkerResult = {
    landmarks?: Array<Array<{ x: number; y: number; z: number }>>;
    worldLandmarks?: Array<Array<{ x: number; y: number; z: number }>>;
    handedness?: Array<Array<{ categoryName: HandednessLabel; score: number }>>;
};

// =============================================================================
// CONSTANTES
// =============================================================================

const FINGER_TO_BONE_INDICES: Record<string, { start: number; end: number }> = {
    thumb: { start: 2, end: 3 }, // MCP -> IP
    index: { start: 5, end: 6 }, // MCP -> PIP
    middle: { start: 9, end: 10 },
    ring: { start: 13, end: 14 },
    pinky: { start: 17, end: 18 },
};

// palm plane refs (world)
const WRIST = 0;
const INDEX_MCP = 5;
const PINKY_MCP = 17;

const FILTER_MIN_CUTOFF = 10.0;
const FILTER_BETA = 20.0;

// ⚡ PERF: Résolution réduite pour MediaPipe (landmarks sont normalisés 0-1, pas besoin de haute résolution)
const MEDIAPIPE_INPUT_WIDTH = 320;
const MEDIAPIPE_INPUT_HEIGHT = 240;

// ⚡ WEB WORKER: Activer/désactiver le mode worker
// Temporairement désactivé pour diagnostiquer le problème d'init
const USE_WEB_WORKER = false;
const WASM_PATH = "/mediapipe/wasm";
const MODEL_PATH = "/mediapipe/models/hand_landmarker.task";

// =============================================================================
// WEB WORKER SINGLETON
// =============================================================================

type WorkerState = "idle" | "loading" | "ready" | "error";

interface WorkerSingleton {
    state: WorkerState;
    instance: Worker | null;
    error: Error | null;
    waiters: Array<{ resolve: (w: Worker) => void; reject: (err: Error) => void }>;
}

const workerSingleton: WorkerSingleton = {
    state: "idle",
    instance: null,
    error: null,
    waiters: [],
};

async function getWorkerSingleton(config: {
    numHands: number;
    modelComplexity: 0 | 1;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
}): Promise<Worker> {
    if (workerSingleton.state === "ready" && workerSingleton.instance) {
        return workerSingleton.instance;
    }

    if (workerSingleton.state === "loading") {
        return await new Promise<Worker>((resolve, reject) => {
            workerSingleton.waiters.push({ resolve, reject });
        });
    }

    if (workerSingleton.state === "error") {
        throw workerSingleton.error ?? new Error("Worker en erreur");
    }

    workerSingleton.state = "loading";

    try {
        // Créer le worker
        const worker = new Worker(
            new URL('../workers/mediapipe.worker.ts', import.meta.url),
            { type: 'module' }
        );

        // Attendre l'initialisation
        await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error("Worker init timeout"));
            }, 30000);

            worker.onmessage = (e) => {
                if (e.data.type === 'init_complete') {
                    clearTimeout(timeout);
                    if (e.data.success) {
                        resolve();
                    } else {
                        reject(new Error(e.data.error || "Worker init failed"));
                    }
                }
            };

            worker.onerror = (err) => {
                clearTimeout(timeout);
                reject(new Error(err.message));
            };

            // Envoyer le message d'init
            worker.postMessage({
                type: 'init',
                wasmPath: WASM_PATH,
                modelPath: MODEL_PATH,
                config: {
                    numHands: config.numHands,
                    modelComplexity: config.modelComplexity,
                    minDetectionConfidence: config.minDetectionConfidence,
                    minTrackingConfidence: config.minTrackingConfidence,
                },
            });
        });

        workerSingleton.instance = worker;
        workerSingleton.state = "ready";

        const waiters = [...workerSingleton.waiters];
        workerSingleton.waiters = [];
        waiters.forEach((w) => w.resolve(worker));

        console.log("%c[WebWorker] ✅ MediaPipe Worker prêt", "color:#00ff00;font-weight:bold");
        return worker;

    } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        workerSingleton.error = error;
        workerSingleton.state = "error";

        const waiters = [...workerSingleton.waiters];
        workerSingleton.waiters = [];
        waiters.forEach((w) => w.reject(error));

        console.error("[WebWorker] ❌ Init Worker failed", error);
        throw error;
    }
}

function isWorkerReady(): boolean {
    return workerSingleton.state === "ready" && !!workerSingleton.instance;
}

// =============================================================================
// SINGLETON / MUTEX (avoid multi instances)
// =============================================================================

type MutexState = "idle" | "loading" | "ready" | "error";

type HandLandmarkerSingleton = {
    state: MutexState;
    instance: any | null;
    error: Error | null;
    waiters: Array<{ resolve: (inst: any) => void; reject: (err: Error) => void }>;
};

const landmarkerMutex: HandLandmarkerSingleton = {
    state: "idle",
    instance: null,
    error: null,
    waiters: [],
};

const TASKS_WASM_BASE_PATH = "/mediapipe/wasm";
const HAND_LANDMARKER_MODEL_PATH = "/mediapipe/models/hand_landmarker.task";

async function getHandLandmarkerSingleton(options: {
    minDetectionConfidence: number;
    minTrackingConfidence: number;
    numHands: number;
    modelComplexity?: number; // ⚡ Nouveau: support du niveau de qualité
}) {
    if (landmarkerMutex.state === "ready" && landmarkerMutex.instance) return landmarkerMutex.instance;

    if (landmarkerMutex.state === "loading") {
        return await new Promise<any>((resolve, reject) => {
            landmarkerMutex.waiters.push({ resolve, reject });
        });
    }

    if (landmarkerMutex.state === "error") {
        throw landmarkerMutex.error ?? new Error("HandLandmarker en erreur");
    }

    landmarkerMutex.state = "loading";

    try {
        const vision = await import("@mediapipe/tasks-vision");
        const { FilesetResolver, HandLandmarker } = vision as any;
        const fileset = await FilesetResolver.forVisionTasks(TASKS_WASM_BASE_PATH);

        const landmarker = await HandLandmarker.createFromOptions(fileset, {
            baseOptions: {
                modelAssetPath: HAND_LANDMARKER_MODEL_PATH,
                delegate: "GPU", // ⚡ Force GPU pour max performance
            },
            runningMode: "VIDEO",
            numHands: options.numHands,
            // ⚡ PERF: Default to Lite model (0) for better mobile performance
            // Full model (1) gives ~10% better accuracy but 2x slower
            modelComplexity: options.modelComplexity ?? 0,
            minHandDetectionConfidence: options.minDetectionConfidence,
            minHandPresenceConfidence: options.minTrackingConfidence,
            minTrackingConfidence: options.minTrackingConfidence,
        });

        landmarkerMutex.instance = landmarker;
        landmarkerMutex.state = "ready";

        const waiters = [...landmarkerMutex.waiters];
        landmarkerMutex.waiters = [];
        waiters.forEach((w) => w.resolve(landmarker));

        console.log("%c[MediaPipe Tasks] ✅ HandLandmarker prêt", "color:#00ff00;font-weight:bold");
        return landmarker;
    } catch (err: any) {
        const error = err instanceof Error ? err : new Error(String(err));
        landmarkerMutex.error = error;
        landmarkerMutex.state = "error";

        const waiters = [...landmarkerMutex.waiters];
        landmarkerMutex.waiters = [];
        waiters.forEach((w) => w.reject(error));

        console.error("[MediaPipe Tasks] ❌ Init HandLandmarker failed", error);
        throw error;
    }
}

function isLandmarkerReady(): boolean {
    return landmarkerMutex.state === "ready" && !!landmarkerMutex.instance;
}

// =============================================================================
// HELPERS
// =============================================================================

function pickBestHandedness(result: TasksHandLandmarkerResult): { label: HandednessLabel; score: number } {
    const first = result.handedness?.[0]?.[0];
    if (!first) return { label: "Right", score: 0 };
    return { label: first.categoryName, score: first.score ?? 0 };
}

function toHandLandmarks(list?: Array<{ x: number; y: number; z: number }>): HandLandmark[] {
    if (!list) return [];
    return list.map((lm) => ({ x: lm.x, y: lm.y, z: lm.z }));
}

function quatDot(a: THREE.Quaternion, b: THREE.Quaternion) {
    return a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w;
}

function safeNormalize(v: THREE.Vector3, fallback: THREE.Vector3) {
    const len = v.length();
    if (len < 1e-6) return fallback.clone();
    return v.clone().multiplyScalar(1 / len);
}

// =============================================================================
// HOOK
// =============================================================================

export function useEdgeARTracking(videoElement: HTMLVideoElement | null, options: UseEdgeARTrackingOptions = {}) {
    const {
        jewelryType = "ring",
        finger = "index", // fallback only (real source = jewelry store)
        minDetectionConfidence = 0.5,
        minTrackingConfidence = 0.5,
        onResult,
        frameSkip = 1,
    } = options;

    const [isInitialized, setIsInitialized] = useState(false);
    const [isTracking, setIsTracking] = useState(false);
    const [lastResult, setLastResult] = useState<TrackingResult | null>(null);
    const [fps, setFps] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const videoElementRef = useRef<HTMLVideoElement | null>(videoElement);
    const onResultRef = useRef(onResult);
    const frameSkipRef = useRef(frameSkip);
    const frameCountRef = useRef(0);
    const isTrackingRef = useRef(false);

    const fpsCounterRef = useRef({ frames: 0, lastTime: performance.now() });
    const processingTimesRef = useRef<number[]>([]);

    const optionsRef = useRef<{ jewelryType: string; finger: string }>({ jewelryType, finger });

    // OneEuro (pose ring)
    const posFilterRef = useRef(new Vector3OneEuroFilter(FILTER_MIN_CUTOFF, FILTER_BETA));
    const rotFilterRef = useRef(new QuaternionOneEuroFilter(FILTER_MIN_CUTOFF, FILTER_BETA));

    // stability
    const lastRawQuatRef = useRef<THREE.Quaternion | null>(null);
    const palmFacingRef = useRef<boolean | null>(null); // hysteresis
    const lastLogRef = useRef(0);

    // ⚡ PERF: Canvas offscreen pour réduire la résolution envoyée à MediaPipe
    const offscreenCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const offscreenCtxRef = useRef<CanvasRenderingContext2D | null>(null);

    useEffect(() => {
        videoElementRef.current = videoElement;
    }, [videoElement]);

    useEffect(() => {
        onResultRef.current = onResult;
    }, [onResult]);

    useEffect(() => {
        optionsRef.current = { jewelryType, finger };
    }, [jewelryType, finger]);

    useEffect(() => {
        frameSkipRef.current = frameSkip;
    }, [frameSkip]);

    // ⚡ PERF: Initialiser le canvas offscreen pour la réduction de résolution
    useEffect(() => {
        const canvas = document.createElement('canvas');
        canvas.width = MEDIAPIPE_INPUT_WIDTH;
        canvas.height = MEDIAPIPE_INPUT_HEIGHT;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        offscreenCanvasRef.current = canvas;
        offscreenCtxRef.current = ctx;

        console.log(`[MediaPipe] 📐 Offscreen canvas créé: ${MEDIAPIPE_INPUT_WIDTH}x${MEDIAPIPE_INPUT_HEIGHT}`);

        return () => {
            offscreenCanvasRef.current = null;
            offscreenCtxRef.current = null;
        };
    }, []);

    // init landmarker (mode worker ou direct)
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                setError(null);

                if (USE_WEB_WORKER) {
                    // ⚡ Mode Web Worker - détection dans un thread séparé
                    console.log("[AR] 🔧 Initialisation en mode Web Worker...");
                    await getWorkerSingleton({
                        numHands: 1,
                        modelComplexity: (options.modelComplexity ?? 0) as 0 | 1,
                        minDetectionConfidence,
                        minTrackingConfidence,
                    });
                } else {
                    // Mode classique - détection sur thread principal
                    console.log("[AR] 🔧 Initialisation en mode direct...");
                    await getHandLandmarkerSingleton({
                        minDetectionConfidence,
                        minTrackingConfidence,
                        numHands: 1,
                        modelComplexity: options.modelComplexity ?? 0,
                    });
                }

                if (!cancelled) setIsInitialized(true);
            } catch (err) {
                console.error("[AR] Init error:", err);
                if (!cancelled) {
                    setIsInitialized(false);
                    setError("Votre appareil/navigateur ne supporte pas le tracking AR.");
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [minDetectionConfidence, minTrackingConfidence]);

    // =========================================================================
    // CORE CALC
    // =========================================================================

    const calculateJewelryTransform = useCallback(
        (
            landmarks: HandLandmark[],
            worldLandmarks: HandLandmark[] | null,
            handedness: "Left" | "Right",
            containerWidth: number,
            containerHeight: number
        ): JewelryPosition | null => {
            const skelAdj = useSkeletonAdjustmentStore.getState();
            // @ts-ignore - Handle migration from old 'scale'
            const scaleX = skelAdj.scaleX ?? skelAdj.scale ?? 1.0;
            // @ts-ignore
            const scaleY = skelAdj.scaleY ?? skelAdj.scale ?? 1.0;
            const aspect = containerWidth / containerHeight;

            // IMPORTANT: use the same center calc as your visual pipeline
            const centerX = landmarks.reduce((sum, l) => sum + l.x, 0) / landmarks.length;
            const centerY = landmarks.reduce((sum, l) => sum + l.y, 0) / landmarks.length;

            const project = (lm: HandLandmark) => {
                const scaledX = centerX + (lm.x - centerX) * scaleX + skelAdj.offsetX / containerWidth;
                const scaledY = centerY + (lm.y - centerY) * scaleY + skelAdj.offsetY / containerHeight;

                const zFactor = 1.5;
                return new THREE.Vector3((scaledX - 0.5) * aspect, 0.5 - scaledY, lm.z * zFactor);
            };

            const positions = landmarks.map(project);

            // ✅ REAL finger source = jewelry store (fix coord mismatch)
            const storeFinger = useJewelryStore.getState().selected.finger;
            const fingerName = storeFinger || optionsRef.current.finger || "index";

            const bone = FINGER_TO_BONE_INDICES[fingerName];
            if (!bone) return null;

            const startPos = positions[bone.start];
            const endPos = positions[bone.end];
            if (!startPos || !endPos) return null;

            // render-space anchor + scaling length
            const rawPosition = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5);
            const renderDir = new THREE.Vector3().subVectors(endPos, startPos);
            const renderLen = renderDir.length();
            if (renderLen < 1e-6) return null;

            // world-space helpers (for palm normal + axis stability)
            const hasWorld = !!worldLandmarks && worldLandmarks.length >= 21;

            let targetQuat = new THREE.Quaternion();

            if (hasWorld) {
                const basis = buildRingBasisFromHand(worldLandmarks!, handedness, fingerName);
                if (basis) {
                    // Camera dir is now handled via POSE_DEBUG_CONFIG in jewelry-pose.ts
                    // We pass nothing to use the config's Z dir.
                    const palmFacing = isPalmFacingCamera(basis.palmNormal, undefined, palmFacingRef.current);
                    palmFacingRef.current = palmFacing;

                    let q = computeFinalQuaternion(basis, palmFacing);
                    q = ensureQuaternionContinuity(q, lastRawQuatRef.current);

                    // 1) & 2) Debug Logs : Drift & Palm
                    const now = performance.now();
                    if (now - lastLogRef.current > 1000) {
                        const camDir = new THREE.Vector3(0, 0, POSE_DEBUG_CONFIG.CAMERA_DIR_Z);
                        const dot = basis.palmNormal.dot(camDir);

                        // Calculate Drift
                        const ringY = new THREE.Vector3(0, 1, 0).applyQuaternion(q).normalize();
                        const boneY = basis.axisY.clone().normalize();
                        const driftAngle = (ringY.angleTo(boneY) * 180) / Math.PI;

                        // Calculate "Atomic" Correction (Bone * Inv(Ring))
                        const rotMatrix = new THREE.Matrix4().makeBasis(basis.axisX, basis.axisY, basis.axisZ);
                        const basisQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);
                        const qDiff = basisQuat.clone().multiply(q.clone().invert());
                        const eDiff = new THREE.Euler().setFromQuaternion(qDiff);

                        console.log(`[AR Debug] Mode=${POSE_DEBUG_CONFIG.ORDER_MODE}, palm=${palmFacing}, dot=${dot.toFixed(2)}, drift=${driftAngle.toFixed(1)}°, FixOffset=(${eDiff.x.toFixed(2)}, ${eDiff.y.toFixed(2)}, ${eDiff.z.toFixed(2)})`);
                        lastLogRef.current = now;
                    }

                    targetQuat = q;
                    lastRawQuatRef.current = targetQuat.clone();
                }
            }

            // OneEuro filter
            const t = performance.now() / 1000;
            const filteredPos = posFilterRef.current.filter(rawPosition, t);
            const filteredQuat = rotFilterRef.current.filter(targetQuat, t);

            const euler = new THREE.Euler().setFromQuaternion(filteredQuat);

            return {
                position: { x: filteredPos.x, y: filteredPos.y, z: filteredPos.z },
                rotation: {
                    x: (euler.x * 180) / Math.PI,
                    y: (euler.y * 180) / Math.PI,
                    z: (euler.z * 180) / Math.PI,
                },
                quaternion: { x: filteredQuat.x, y: filteredQuat.y, z: filteredQuat.z, w: filteredQuat.w },
                direction: { x: renderDir.x, y: renderDir.y, z: renderDir.z }, // for t-offset in render space
                boneLength: renderLen, // keep old scale behaviour
                scale: 1,
                confidence: 1,
            };
        },
        []
    );

    // =========================================================================
    // CONTROL
    // =========================================================================

    const startTracking = useCallback(() => {
        if (!videoElementRef.current) return;

        // Vérifier que le bon mode est prêt
        if (USE_WEB_WORKER) {
            if (!isWorkerReady()) return;
        } else {
            if (!isLandmarkerReady()) return;
        }

        isTrackingRef.current = true;
        setIsTracking(true);
        setError(null);

        fpsCounterRef.current = { frames: 0, lastTime: performance.now() };
        processingTimesRef.current = [];
        frameCountRef.current = 0;

        posFilterRef.current = new Vector3OneEuroFilter(FILTER_MIN_CUTOFF, FILTER_BETA);
        rotFilterRef.current = new QuaternionOneEuroFilter(FILTER_MIN_CUTOFF, FILTER_BETA);

        lastRawQuatRef.current = null;
        palmFacingRef.current = null;
    }, []);

    const stopTracking = useCallback(() => {
        isTrackingRef.current = false;
        setIsTracking(false);
    }, []);

    // =========================================================================
    // LOOP
    // =========================================================================

    const processFrame = useCallback(async () => {
        const video = videoElementRef.current;
        if (!video || !isTrackingRef.current) return;

        // Vérifier le bon mode
        if (USE_WEB_WORKER) {
            if (!isWorkerReady()) return;
        } else {
            if (!isLandmarkerReady()) return;
        }

        frameCountRef.current += 1;
        const skip = Math.max(1, frameSkipRef.current || 1);
        if (frameCountRef.current % skip !== 0) return;

        const t0 = performance.now();

        try {
            const nowMs = performance.now();

            if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return;

            let landmarks: HandLandmark[] | null = null;
            let worldLandmarks: HandLandmark[] | null = null;
            let handedness: string = "Right";
            let handednessScore: number = 0;

            if (USE_WEB_WORKER) {
                // ⚡ MODE WORKER: Envoyer l'image au worker pour traitement
                const worker = workerSingleton.instance!;

                // Créer un ImageBitmap à partir de la vidéo (transférable au worker)
                const imageBitmap = await createImageBitmap(video, {
                    resizeWidth: MEDIAPIPE_INPUT_WIDTH,
                    resizeHeight: MEDIAPIPE_INPUT_HEIGHT,
                });

                // Envoyer au worker et attendre la réponse
                const workerResult = await new Promise<{
                    success: boolean;
                    landmarks: HandLandmark[] | null;
                    worldLandmarks: HandLandmark[] | null;
                    handedness: string;
                    handednessScore: number;
                    processingTimeMs: number;
                }>((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error("Worker detection timeout"));
                    }, 5000);

                    const handler = (e: MessageEvent) => {
                        if (e.data.type === 'result') {
                            clearTimeout(timeout);
                            worker.removeEventListener('message', handler);
                            resolve(e.data);
                        } else if (e.data.type === 'error') {
                            clearTimeout(timeout);
                            worker.removeEventListener('message', handler);
                            reject(new Error(e.data.error));
                        }
                    };

                    worker.addEventListener('message', handler);

                    // Envoyer l'image au worker (transfert de propriété de l'ImageBitmap)
                    worker.postMessage(
                        {
                            type: 'detect',
                            imageBitmap,
                            timestamp: nowMs,
                        },
                        [imageBitmap] // Transferable - évite la copie mémoire
                    );
                });

                landmarks = workerResult.landmarks;
                worldLandmarks = workerResult.worldLandmarks;
                handedness = workerResult.handedness;
                handednessScore = workerResult.handednessScore;

            } else {
                // MODE DIRECT: Détection sur le thread principal
                const landmarker = landmarkerMutex.instance;

                // ⚡ PERF: Dessiner la vidéo sur le canvas offscreen en basse résolution
                const offscreenCanvas = offscreenCanvasRef.current;
                const offscreenCtx = offscreenCtxRef.current;

                let inputSource: HTMLVideoElement | HTMLCanvasElement = video;

                if (offscreenCanvas && offscreenCtx) {
                    offscreenCtx.drawImage(video, 0, 0, MEDIAPIPE_INPUT_WIDTH, MEDIAPIPE_INPUT_HEIGHT);
                    inputSource = offscreenCanvas;
                }

                let result: TasksHandLandmarkerResult;
                try {
                    result = landmarker.detectForVideo(inputSource, nowMs) as TasksHandLandmarkerResult;
                } catch (err) {
                    console.warn("[MediaPipe] Detect error:", err);
                    return;
                }

                const handed = pickBestHandedness(result);
                handedness = handed.label;
                handednessScore = handed.score;
                landmarks = toHandLandmarks(result.landmarks?.[0]);
                worldLandmarks = toHandLandmarks(result.worldLandmarks?.[0]);
            }

            // Traitement commun des résultats
            let jewelryPos: JewelryPosition | null = null;
            let handResult: HandResult | null = null;

            if (landmarks && landmarks.length >= 21) {
                handResult = {
                    handedness,
                    handedness_score: handednessScore,
                    landmarks,
                    world_landmarks: worldLandmarks ?? landmarks,
                };

                jewelryPos = calculateJewelryTransform(
                    handResult.landmarks,
                    handResult.world_landmarks,
                    handedness as "Left" | "Right",
                    video.clientWidth || video.videoWidth || 640,
                    video.clientHeight || video.videoHeight || 480
                );
            }

            const trackingResult: TrackingResult = {
                success: !!handResult,
                hand_result: handResult,
                jewelry_position: jewelryPos,
                confidence: handResult ? handednessScore : 0,
                processing_time_ms: performance.now() - t0,
                timestamp: Date.now(),
            };

            setLastResult(trackingResult);
            onResultRef.current?.(trackingResult);

            // FPS
            const fpsCounter = fpsCounterRef.current;
            fpsCounter.frames += 1;
            const elapsed = nowMs - fpsCounter.lastTime;
            if (elapsed >= 1000) {
                setFps(Math.round((fpsCounter.frames * 1000) / elapsed));
                fpsCounter.frames = 0;
                fpsCounter.lastTime = nowMs;
            }

            processingTimesRef.current.push(trackingResult.processing_time_ms);
            if (processingTimesRef.current.length > 60) processingTimesRef.current.shift();
        } catch (e: any) {
            console.warn("[AR] processFrame error", e);
        }
    }, [calculateJewelryTransform]);

    useEffect(() => {
        if (!isTracking) return;

        let raf = 0;
        let isProcessing = false;  // ⚡ PERF: Prevent overlapping frames

        const loop = () => {
            // ⚡ PERF: Don't await - let detection run async while RAF continues
            // This prevents detection time from blocking the render loop
            if (!isProcessing) {
                isProcessing = true;
                processFrame().finally(() => {
                    isProcessing = false;
                });
            }
            raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(raf);
    }, [isTracking, processFrame]);

    useEffect(() => {
        return () => stopTracking();
    }, [stopTracking]);

    const averageProcessingTime =
        processingTimesRef.current.length > 0
            ? processingTimesRef.current.reduce((a, b) => a + b, 0) / processingTimesRef.current.length
            : 0;

    return {
        isInitialized,
        isTracking,
        lastResult,
        fps,
        error,
        averageProcessingTime,
        startTracking,
        stopTracking,
    };
}

export default useEdgeARTracking;
