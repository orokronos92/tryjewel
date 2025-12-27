/**
 * =============================================================================
 * MEDIAPIPE WEB WORKER - Détection main dans un thread séparé
 * =============================================================================
 *
 * Ce worker exécute MediaPipe HandLandmarker dans un thread séparé
 * pour ne pas bloquer l'UI principale.
 */

// Types pour la communication
interface InitMessage {
    type: 'init';
    wasmPath: string;
    modelPath: string;
    config: {
        numHands: number;
        modelComplexity: 0 | 1;
        minDetectionConfidence: number;
        minTrackingConfidence: number;
    };
}

interface DetectMessage {
    type: 'detect';
    imageBitmap: ImageBitmap;
    timestamp: number;
}

type WorkerMessage = InitMessage | DetectMessage;

interface HandLandmark {
    x: number;
    y: number;
    z: number;
}

interface DetectionResult {
    type: 'result';
    success: boolean;
    landmarks: HandLandmark[] | null;
    worldLandmarks: HandLandmark[] | null;
    handedness: string;
    handednessScore: number;
    processingTimeMs: number;
}

interface InitResult {
    type: 'init_complete';
    success: boolean;
    error?: string;
}

interface ErrorResult {
    type: 'error';
    error: string;
}

type WorkerResult = DetectionResult | InitResult | ErrorResult;

// Variables globales du worker
let handLandmarker: any = null;
let isInitialized = false;
let offscreenCanvas: OffscreenCanvas | null = null;
let offscreenCtx: OffscreenCanvasRenderingContext2D | null = null;

// Taille du canvas interne (basse résolution pour performance)
const CANVAS_WIDTH = 320;
const CANVAS_HEIGHT = 240;

/**
 * Initialise MediaPipe HandLandmarker
 */
async function initMediaPipe(msg: InitMessage): Promise<void> {
    try {
        console.log('[Worker] 🚀 Initialisation MediaPipe...');

        // Import dynamique de MediaPipe dans le worker
        const vision = await import('@mediapipe/tasks-vision');
        const { FilesetResolver, HandLandmarker } = vision;

        // Charger les fichiers WASM
        const fileset = await FilesetResolver.forVisionTasks(msg.wasmPath);

        // Créer le HandLandmarker
        // Note: modelComplexity existe à l'exécution mais pas dans les types TS
        handLandmarker = await HandLandmarker.createFromOptions(fileset, {
            baseOptions: {
                modelAssetPath: msg.modelPath,
                delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: msg.config.numHands,
            modelComplexity: msg.config.modelComplexity,
            minHandDetectionConfidence: msg.config.minDetectionConfidence,
            minHandPresenceConfidence: msg.config.minTrackingConfidence,
            minTrackingConfidence: msg.config.minTrackingConfidence,
        } as any);

        // Créer le canvas offscreen pour le traitement
        offscreenCanvas = new OffscreenCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
        offscreenCtx = offscreenCanvas.getContext('2d');

        isInitialized = true;

        const result: InitResult = {
            type: 'init_complete',
            success: true,
        };
        self.postMessage(result);

        console.log('[Worker] ✅ MediaPipe initialisé');

    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error('[Worker] ❌ Erreur init:', error);

        const result: InitResult = {
            type: 'init_complete',
            success: false,
            error,
        };
        self.postMessage(result);
    }
}

/**
 * Détecte les landmarks de la main
 */
function detectHand(msg: DetectMessage): void {
    if (!isInitialized || !handLandmarker || !offscreenCanvas || !offscreenCtx) {
        const result: ErrorResult = {
            type: 'error',
            error: 'Worker not initialized',
        };
        self.postMessage(result);
        return;
    }

    const t0 = performance.now();

    try {
        // Dessiner l'ImageBitmap sur le canvas offscreen (resize automatique)
        offscreenCtx.drawImage(msg.imageBitmap, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Libérer l'ImageBitmap
        msg.imageBitmap.close();

        // Détecter les landmarks
        const detection = handLandmarker.detectForVideo(offscreenCanvas, msg.timestamp);

        const processingTimeMs = performance.now() - t0;

        // Extraire les résultats
        const hasHand = detection.landmarks && detection.landmarks.length > 0;

        let landmarks: HandLandmark[] | null = null;
        let worldLandmarks: HandLandmark[] | null = null;
        let handedness = 'Right';
        let handednessScore = 0;

        if (hasHand) {
            landmarks = detection.landmarks[0].map((lm: any) => ({
                x: lm.x,
                y: lm.y,
                z: lm.z,
            }));

            if (detection.worldLandmarks && detection.worldLandmarks[0]) {
                worldLandmarks = detection.worldLandmarks[0].map((lm: any) => ({
                    x: lm.x,
                    y: lm.y,
                    z: lm.z,
                }));
            }

            if (detection.handedness && detection.handedness[0] && detection.handedness[0][0]) {
                handedness = detection.handedness[0][0].categoryName || 'Right';
                handednessScore = detection.handedness[0][0].score || 0;
            }
        }

        const result: DetectionResult = {
            type: 'result',
            success: hasHand,
            landmarks,
            worldLandmarks,
            handedness,
            handednessScore,
            processingTimeMs,
        };

        self.postMessage(result);

    } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        console.error('[Worker] ❌ Erreur détection:', error);

        const result: ErrorResult = {
            type: 'error',
            error,
        };
        self.postMessage(result);
    }
}

/**
 * Handler des messages entrants
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
    const msg = event.data;

    switch (msg.type) {
        case 'init':
            initMediaPipe(msg);
            break;

        case 'detect':
            detectHand(msg);
            break;

        default:
            console.warn('[Worker] Message inconnu:', msg);
    }
};

// Export vide pour TypeScript
export { };
