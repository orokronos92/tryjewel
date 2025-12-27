"use client";

import { useRef, useEffect, useState } from "react";
import { useEdgeTrackingStore } from "@/stores/edge-tracking-store";
import { useJewelryStore } from "@/stores/jewelry-store";
import { useSkeletonAdjustmentStore } from "@/stores/skeleton-adjustment-store";
import { useRingAdjustmentStore } from "@/stores/ring-adjustment-store";
import { useCameraStore } from "@/stores/camera-store";
import * as THREE from "three";
// @ts-expect-error

import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// @ts-expect-error
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
// @ts-expect-error
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";
import { Vector3OneEuroFilter, QuaternionOneEuroFilter } from "@/lib/one-euro-filter";
import { createThickAxesHelper } from "@/lib/ar/debug-vectors";

const PERF_OPTIONS = {
    ENABLE_SKELETON_2D: true,
    ENABLE_OCCLUDERS: true,
    LOW_QUALITY_RENDERER: true,
    DISABLE_ENVIRONMENT: false,
};

interface HandLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}

interface BoneData {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    direction: THREE.Vector3;
    length: number;
}

interface OccluderConfig {
    boneName: string;
    fingerName: string;
    radiusTop: number;
    radiusBottom: number;
}

const FINGER_TO_BONE: Record<string, string> = {
    thumb: "thumb_mcp",
    index: "index_mcp",
    middle: "middle_mcp",
    ring: "ring_mcp",
    pinky: "pinky_mcp",
};

const HAND_CONNECTIONS = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],
    [0, 9],
    [9, 10],
    [10, 11],
    [11, 12],
    [0, 13],
    [13, 14],
    [14, 15],
    [15, 16],
    [0, 17],
    [17, 18],
    [18, 19],
    [19, 20],
    [5, 9],
    [9, 13],
    [13, 17],
];

const BONE_CONNECTIONS = [
    { start: 1, end: 2, name: "thumb_cmc" },
    { start: 2, end: 3, name: "thumb_mcp" },
    { start: 3, end: 4, name: "thumb_ip" },
    { start: 5, end: 6, name: "index_mcp" },
    { start: 6, end: 7, name: "index_pip" },
    { start: 7, end: 8, name: "index_dip" },
    { start: 9, end: 10, name: "middle_mcp" },
    { start: 10, end: 11, name: "middle_pip" },
    { start: 11, end: 12, name: "middle_dip" },
    { start: 13, end: 14, name: "ring_mcp" },
    { start: 14, end: 15, name: "ring_pip" },
    { start: 15, end: 16, name: "ring_dip" },
    { start: 17, end: 18, name: "pinky_mcp" },
    { start: 18, end: 19, name: "pinky_pip" },
    { start: 19, end: 20, name: "pinky_dip" },
];

const OCCLUDER_CONFIGS: OccluderConfig[] = [
    { boneName: "thumb_mcp", fingerName: "thumb", radiusTop: 0.022, radiusBottom: 0.026 },
    { boneName: "thumb_ip", fingerName: "thumb", radiusTop: 0.02, radiusBottom: 0.024 },
    { boneName: "index_mcp", fingerName: "index", radiusTop: 0.025, radiusBottom: 0.025 },
    { boneName: "index_pip", fingerName: "index", radiusTop: 0.018, radiusBottom: 0.022 },
    { boneName: "index_dip", fingerName: "index", radiusTop: 0.016, radiusBottom: 0.02 },
    { boneName: "middle_mcp", fingerName: "middle", radiusTop: 0.02, radiusBottom: 0.024 },
    { boneName: "middle_pip", fingerName: "middle", radiusTop: 0.018, radiusBottom: 0.022 },
    { boneName: "middle_dip", fingerName: "middle", radiusTop: 0.016, radiusBottom: 0.02 },
    { boneName: "ring_mcp", fingerName: "ring", radiusTop: 0.02, radiusBottom: 0.024 },
    { boneName: "ring_pip", fingerName: "ring", radiusTop: 0.018, radiusBottom: 0.022 },
    { boneName: "ring_dip", fingerName: "ring", radiusTop: 0.016, radiusBottom: 0.02 },
    { boneName: "pinky_mcp", fingerName: "pinky", radiusTop: 0.016, radiusBottom: 0.02 },
    { boneName: "pinky_pip", fingerName: "pinky", radiusTop: 0.014, radiusBottom: 0.018 },
    { boneName: "pinky_dip", fingerName: "pinky", radiusTop: 0.012, radiusBottom: 0.016 },
];

const FILTER_MIN_CUTOFF = 10.0;
const FILTER_BETA = 20.0;

// ⚡ FIX CANVAS: Props pour recevoir les dimensions exactes de la vidéo
interface Jewelry3DProps {
    videoWidth?: number;
    videoHeight?: number;
}

export function Jewelry3D({ videoWidth, videoHeight }: Jewelry3DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const debugCanvasRef = useRef<HTMLCanvasElement>(null);

    const ringRef = useRef<THREE.Group | null>(null);
    const ringAxesRef = useRef<THREE.Group | null>(null);  // ⚡ Axes du ring
    const boneAxesRef = useRef<THREE.Group | null>(null);
    const lastLogRef = useRef<number>(0);
    const occludersRef = useRef<Map<string, THREE.Mesh>>(new Map());
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const animationIdRef = useRef<number | null>(null);

    const debugOccluderRef = useRef<boolean>(false);
    const [debugOccluder, setDebugOccluder] = useState(false);

    // ⚡ Toggles pour debug visuel
    const [showSkeleton, setShowSkeleton] = useState(true);   // Squelette 2D + axes bone
    const [showRingAxes, setShowRingAxes] = useState(true);   // Axes du ring
    const showSkeletonRef = useRef(true);
    const showRingAxesRef = useRef(true);

    useEffect(() => {
        debugOccluderRef.current = debugOccluder;
    }, [debugOccluder]);

    // ⚡ Sync refs pour animate loop
    useEffect(() => {
        showSkeletonRef.current = showSkeleton;
    }, [showSkeleton]);

    useEffect(() => {
        showRingAxesRef.current = showRingAxes;
    }, [showRingAxes]);

    const bonesDataRef = useRef<Map<string, BoneData>>(new Map());
    const positionFiltersRef = useRef<Map<string, Vector3OneEuroFilter>>(new Map());
    const rotationFiltersRef = useRef<Map<string, QuaternionOneEuroFilter>>(new Map());

    // baseline (neutralize persisted ring adjustments)
    const sessionInitRef = useRef<{
        ready: boolean;
        offsetX: number;
        offsetY: number;
        offsetZ: number;
        t: number;
        rotX: number;
        rotY: number;
        rotZ: number;
        scale: number;
    }>({
        ready: false,
        offsetX: 0,
        offsetY: 0,
        offsetZ: 0,
        t: 0.5,
        rotX: 0,
        rotY: 0,
        rotZ: 0,
        scale: 1,
    });

    const shouldMirror = useCameraStore((state) => state.camera.shouldMirror);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        const container = containerRef.current;

        // ⚡ FIX CANVAS: Utiliser les dimensions de la vidéo si fournies
        // Sinon fallback sur le container (comportement précédent)
        const width = videoWidth || container.clientWidth || 640;
        const height = videoHeight || container.clientHeight || 480;
        const aspect = width / height;

        const scene = new THREE.Scene();

        const frustumSize = 1;
        const camera = new THREE.OrthographicCamera(
            (-frustumSize * aspect) / 2,
            (frustumSize * aspect) / 2,
            frustumSize / 2,
            -frustumSize / 2,
            0.01,
            10
        );
        camera.position.z = 1;
        cameraRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            alpha: true,
            antialias: !PERF_OPTIONS.LOW_QUALITY_RENDERER,
            powerPreference: "high-performance",
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(PERF_OPTIONS.LOW_QUALITY_RENDERER ? 1 : Math.min(window.devicePixelRatio, 2));
        rendererRef.current = renderer;

        if (!PERF_OPTIONS.DISABLE_ENVIRONMENT) {
            const pmremGenerator = new THREE.PMREMGenerator(renderer);
            scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
            pmremGenerator.dispose();
        }

        scene.add(new THREE.AmbientLight(0xffffff, 0.7));
        const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
        dirLight.position.set(2, 5, 2);
        scene.add(dirLight);

        // Occluders
        if (PERF_OPTIONS.ENABLE_OCCLUDERS) {
            OCCLUDER_CONFIGS.forEach((config) => {
                const geometry = new THREE.CylinderGeometry(config.radiusTop, config.radiusBottom, 0.12, 8);
                const material = new THREE.MeshBasicMaterial({
                    colorWrite: false,
                    depthWrite: true,
                    depthTest: true,
                    side: THREE.DoubleSide,
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.renderOrder = -1;
                mesh.name = `occluder_${config.boneName}`;
                scene.add(mesh);
                occludersRef.current.set(config.boneName, mesh);
            });
        }

        BONE_CONNECTIONS.forEach((bone) => {
            positionFiltersRef.current.set(bone.name, new Vector3OneEuroFilter(FILTER_MIN_CUTOFF, FILTER_BETA));
            rotationFiltersRef.current.set(bone.name, new QuaternionOneEuroFilter(FILTER_MIN_CUTOFF, FILTER_BETA));
        });

        // Ring group
        ringRef.current = new THREE.Group();
        ringRef.current.renderOrder = 0;
        scene.add(ringRef.current);

        const loader = new GLTFLoader();

        // ⚡ Optimisation: Support Draco Compression
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/'); // Chemin vers les décodeurs
        dracoLoader.setDecoderConfig({ type: 'js' }); // Force JS pour compatibilité max
        loader.setDRACOLoader(dracoLoader);

        loader.load("/assets/rings/gold_ring.glb", (gltf: { scene: THREE.Group }) => {
            const model = gltf.scene;

            // 1. Calculer la bounding box originale
            const boxOriginal = new THREE.Box3().setFromObject(model);
            const sizeOriginal = new THREE.Vector3();
            boxOriginal.getSize(sizeOriginal);
            const centerOriginal = new THREE.Vector3();
            boxOriginal.getCenter(centerOriginal);

            console.log('[GLB Load] 📦 Original size:', sizeOriginal.toArray().map(v => v.toFixed(4)));
            console.log('[GLB Load] 📍 Original center:', centerOriginal.toArray().map(v => v.toFixed(4)));

            // 2. Appliquer le scaling
            const maxDim = Math.max(sizeOriginal.x, sizeOriginal.y, sizeOriginal.z);
            const targetSize = 0.08;
            const scaleFactor = maxDim > 0 ? targetSize / maxDim : 1;
            model.scale.setScalar(scaleFactor);

            console.log('[GLB Load] 📏 Scale factor:', scaleFactor.toFixed(4));

            // 3. Appliquer la rotation AVANT de centrer
            // Le quaternion du doigt a Y aligné le long du doigt
            // La bague doit avoir son "trou" (axe de symétrie) aligné avec Y
            model.rotation.x = Math.PI / 2;

            // 4. Forcer la mise à jour de la matrice monde
            model.updateMatrixWorld(true);

            // 5. Recalculer la bounding box APRÈS scaling ET rotation
            const boxFinal = new THREE.Box3().setFromObject(model);
            const sizeFinal = new THREE.Vector3();
            boxFinal.getSize(sizeFinal);
            const centerFinal = new THREE.Vector3();
            boxFinal.getCenter(centerFinal);

            console.log('[GLB Load] 📦 Final size (after scale+rot):', sizeFinal.toArray().map(v => v.toFixed(4)));
            console.log('[GLB Load] 📍 Final center (after scale+rot):', centerFinal.toArray().map(v => v.toFixed(4)));

            // 6. Centrer le modèle sur l'origine du groupe APRÈS toutes les transformations
            model.position.set(-centerFinal.x, -centerFinal.y, -centerFinal.z);

            console.log('[GLB Load] ✅ Model position offset:', model.position.toArray().map(v => v.toFixed(4)));

            model.traverse((child) => {
                if ((child as THREE.Mesh).isMesh) (child as THREE.Mesh).renderOrder = 1;
            });

            ringRef.current?.add(model);
            console.log('[GLB Load] 🎉 Ring loaded and centered');
        });

        // ⚡ FIX: Créer les axes EN DEHORS du callback async pour éviter les bugs avec React StrictMode
        // Debug Axes Ring
        const ringAxes = createThickAxesHelper(1, 0.016);
        ringAxes.scale.setScalar(0.5);
        ringAxes.visible = false; // Hidden by default until tracking
        scene.add(ringAxes);
        ringAxesRef.current = ringAxes;

        // Debug Axes Bone (Phalange)
        const boneAxes = createThickAxesHelper(1, 0.016); // Same style
        boneAxes.scale.setScalar(0.5);
        boneAxes.visible = false; // Hidden by default until tracking
        scene.add(boneAxes);
        boneAxesRef.current = boneAxes;

        const storeCache = {
            tracking: useEdgeTrackingStore.getState().tracking,
            ringAdj: useRingAdjustmentStore.getState(),
            skelAdj: useSkeletonAdjustmentStore.getState(),
            selectedFinger: useJewelryStore.getState().selected.finger || "index",
        };

        const unsubTracking = useEdgeTrackingStore.subscribe((s) => (storeCache.tracking = s.tracking));
        const unsubRingAdj = useRingAdjustmentStore.subscribe((s) => (storeCache.ringAdj = s));
        const unsubSkelAdj = useSkeletonAdjustmentStore.subscribe((s) => (storeCache.skelAdj = s));
        const unsubSelected = useJewelryStore.subscribe((s) => (storeCache.selectedFinger = s.selected.finger || "index"));

        let ctx: CanvasRenderingContext2D | null = null;
        if (PERF_OPTIONS.ENABLE_SKELETON_2D && debugCanvasRef.current) {
            ctx = debugCanvasRef.current.getContext("2d");
            if (ctx) {
                debugCanvasRef.current.width = width;
                debugCanvasRef.current.height = height;
            }
        }

        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);

            if (ctx) ctx.clearRect(0, 0, width, height);

            const result = storeCache.tracking?.last_result;
            if (!result || !result.success || !result.hand_result?.landmarks) {
                if (ringRef.current) ringRef.current.visible = false;
                // ⚡ FIX: Cacher aussi les axes quand pas de tracking
                if (ringAxesRef.current) ringAxesRef.current.visible = false;
                if (boneAxesRef.current) boneAxesRef.current.visible = false;
                renderer.render(scene, camera);
                return;
            }

            const landmarks = result.hand_result.landmarks;
            const handedness = result.hand_result.handedness; // "Left" ou "Right"
            const skelAdj = storeCache.skelAdj;
            const timestamp = performance.now() / 1000;

            // ====== LOCAL SKELETON SPACE (the one that matches the video perfectly) ======
            const scaleX = skelAdj.scaleX ?? 1.0;
            const scaleY = skelAdj.scaleY ?? 1.0;
            const zFactor = 1.5;
            const centerX = landmarks.reduce((s, l) => s + l.x, 0) / landmarks.length;
            const centerY = landmarks.reduce((s, l) => s + l.y, 0) / landmarks.length;

            const positions = landmarks.map((lm) => {
                const scaledX = centerX + (lm.x - centerX) * scaleX + skelAdj.offsetX / width;
                const scaledY = centerY + (lm.y - centerY) * scaleY + skelAdj.offsetY / height;
                // âœ… Utiliser -lm.z immÃ©diatement pour Ãªtre dans le bon systÃ¨me de coordonnÃ©es visuel (+Z vers camÃ©ra)
                return new THREE.Vector3((scaledX - 0.5) * aspect, 0.5 - scaledY, -lm.z * zFactor);
            });

            // hand normal for occluders and ring orientation
            const indexMCP = positions[5];
            const pinkyMCP = positions[17];
            const wrist = positions[0];
            let handNormal = new THREE.Vector3(0, 0, 1);
            if (indexMCP && pinkyMCP && wrist) {
                const kVec = new THREE.Vector3().subVectors(pinkyMCP, indexMCP).normalize();
                const lVec = new THREE.Vector3().subVectors(indexMCP, wrist).normalize();
                handNormal.crossVectors(kVec, lVec).normalize();

                // âœ… Correction latÃ©ralitÃ© : inverser pour main gauche
                if (handedness === "Left") {
                    handNormal.negate();
                }
            }

            // update bones
            BONE_CONNECTIONS.forEach((bone) => {
                const start = positions[bone.start];
                const end = positions[bone.end];
                if (!start || !end) return;

                const rawPos = new THREE.Vector3().lerpVectors(start, end, 0.5);
                const dir = new THREE.Vector3().subVectors(end, start);
                const len = dir.length();

                const axisY = dir.clone().normalize();
                let axisZ = handNormal.clone().sub(axisY.clone().multiplyScalar(handNormal.dot(axisY))).normalize();
                if (axisZ.length() < 0.01) axisZ = new THREE.Vector3(0, 0, 1);
                const axisX = new THREE.Vector3().crossVectors(axisY, axisZ).normalize();
                axisZ = new THREE.Vector3().crossVectors(axisX, axisY).normalize();

                const rotMatrix = new THREE.Matrix4().makeBasis(axisX, axisY, axisZ);
                const rawQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

                const pf = positionFiltersRef.current.get(bone.name);
                const rf = rotationFiltersRef.current.get(bone.name);
                const fPos = pf ? pf.filter(rawPos, timestamp) : rawPos;
                const fQuat = rf ? rf.filter(rawQuat, timestamp) : rawQuat;

                bonesDataRef.current.set(bone.name, { position: fPos, quaternion: fQuat, direction: dir, length: len });
            });

            // occluders
            if (PERF_OPTIONS.ENABLE_OCCLUDERS) {
                const fingerDepths: { name: string; z: number }[] = [];
                ["thumb", "index", "middle", "ring", "pinky"].forEach((f) => {
                    const b = bonesDataRef.current.get(FINGER_TO_BONE[f]);
                    if (b) fingerDepths.push({ name: f, z: b.position.z });
                });

                fingerDepths.sort((a, b) => b.z - a.z);
                const depthOrder = new Map(fingerDepths.map((d, i) => [d.name, i]));
                const ringFingerName = storeCache.selectedFinger;
                const ringRank = depthOrder.get(ringFingerName) ?? 2;
                const isDebugOccluder = debugOccluderRef.current;

                OCCLUDER_CONFIGS.forEach((conf) => {
                    const mesh = occludersRef.current.get(conf.boneName);
                    const bd = bonesDataRef.current.get(conf.boneName);
                    if (!mesh || !bd) return;

                    mesh.position.set(bd.position.x, bd.position.y, bd.position.z);
                    mesh.quaternion.copy(bd.quaternion);
                    mesh.scale.setScalar(bd.length * 8);

                    const occRank = depthOrder.get(conf.fingerName) ?? 2;
                    const isInFront = occRank < ringRank;
                    const isSameFinger = conf.fingerName === ringFingerName;

                    const mat = mesh.material as THREE.MeshBasicMaterial;
                    mat.depthWrite = true;
                    mat.depthTest = true;

                    if (isDebugOccluder) {
                        mat.colorWrite = true;
                        mesh.visible = true;
                        mat.color = isSameFinger
                            ? new THREE.Color(0x00ff00)
                            : isInFront
                                ? new THREE.Color(0xff00ff)
                                : new THREE.Color(0x222222);
                    } else {
                        mat.colorWrite = false;
                        mesh.visible = isInFront || isSameFinger;
                    }
                });
            }

            // skeleton draw - ⚡ Conditionné au toggle
            if (PERF_OPTIONS.ENABLE_SKELETON_2D && ctx && showSkeletonRef.current) {
                const toCanvas = (lm: HandLandmark) => ({
                    x: (centerX + (lm.x - centerX) * scaleX + skelAdj.offsetX / width) * width,
                    y: (centerY + (lm.y - centerY) * scaleY + skelAdj.offsetY / height) * height,
                });

                ctx.strokeStyle = "#00ff00";
                ctx.lineWidth = 2;
                ctx.fillStyle = "#00ff00";

                HAND_CONNECTIONS.forEach(([s, e]) => {
                    const p1 = toCanvas(landmarks[s]);
                    const p2 = toCanvas(landmarks[e]);
                    ctx!.beginPath();
                    ctx!.moveTo(p1.x, p1.y);
                    ctx!.lineTo(p2.x, p2.y);
                    ctx!.stroke();
                });

                landmarks.forEach((lm) => {
                    const p = toCanvas(lm);
                    ctx!.beginPath();
                    ctx!.arc(p.x, p.y, 3, 0, 2 * Math.PI);
                    ctx!.fill();
                });
            }

            // =========================
            // âœ… RING: position LOCAL, rotation ADAPTER
            // =========================
            const jp = result.jewelry_position;
            const selectedFinger = storeCache.selectedFinger;
            const targetBoneName = FINGER_TO_BONE[selectedFinger] || "index_mcp";
            const boneData = bonesDataRef.current.get(targetBoneName);

            if (!jp || !boneData || !ringRef.current) {
                if (ringRef.current) ringRef.current.visible = false;
                if (boneAxesRef.current) boneAxesRef.current.visible = false;
                renderer.render(scene, camera);
                return;
            }

            ringRef.current.visible = true;

            const ringAdj = storeCache.ringAdj;

            // baseline (neutralize persisted values)
            if (!sessionInitRef.current.ready) {
                sessionInitRef.current = {
                    ready: true,
                    offsetX: ringAdj.offsetX || 0,
                    offsetY: ringAdj.offsetY || 0,
                    offsetZ: ringAdj.offsetZ || 0,
                    t: typeof ringAdj.t === "number" ? ringAdj.t : 0.5,
                    rotX: ringAdj.rotationX || 0,
                    rotY: ringAdj.rotationY || 0,
                    rotZ: ringAdj.rotationZ || 0,
                    scale: ringAdj.scale || 1,
                };
            }

            const init = sessionInitRef.current;
            const effOffsetX = (ringAdj.offsetX || 0) - init.offsetX;
            const effOffsetY = (ringAdj.offsetY || 0) - init.offsetY;
            const effOffsetZ = (ringAdj.offsetZ || 0) - init.offsetZ;
            const effScale = (ringAdj.scale || 1) / (init.scale || 1);
            const effRotX = (ringAdj.rotationX || 0) - init.rotX;
            const effRotY = (ringAdj.rotationY || 0) - init.rotY;
            const effRotZ = (ringAdj.rotationZ || 0) - init.rotZ;
            const effT = (typeof ringAdj.t === "number" ? ringAdj.t : 0.5) - init.t + 0.5;

            // âœ… POSITION from LOCAL boneData (Z est dÃ©jÃ  inversÃ© Ã  la source maintenant)
            const basePos = new THREE.Vector3(boneData.position.x, boneData.position.y, boneData.position.z);
            const userOffset = new THREE.Vector3(effOffsetX, effOffsetY, effOffsetZ);

            const fDir = boneData.direction.clone();
            const fDirN = fDir.length() > 1e-6 ? fDir.normalize() : new THREE.Vector3(0, 1, 0);
            const tVal = (effT - 0.5) * boneData.length;
            const tVec = fDirN.multiplyScalar(tVal);

            ringRef.current.position.copy(basePos.add(userOffset).add(tVec));

            // âœ… ROTATION: Use LOCAL boneData quaternion (same coordinate system as position)
            // This ensures ring rotation matches the visual skeleton exactly
            const targetQuat = boneData.quaternion.clone();

            // Rotations utilisateur (Slider dev)
            const uRot = new THREE.Euler((effRotX * Math.PI) / 180, (effRotY * Math.PI) / 180, (effRotZ * Math.PI) / 180);
            const uQuat = new THREE.Quaternion().setFromEuler(uRot);

            targetQuat.multiply(uQuat);

            ringRef.current.quaternion.copy(targetQuat);

            // scale (local bone length)
            const baseScale = boneData.length * 8 * effScale;
            ringRef.current.scale.setScalar(baseScale);

            // =========================
            // ✅ DEBUG BONE AXES & LOGGING
            // =========================
            if (boneAxesRef.current) {
                boneAxesRef.current.visible = showSkeletonRef.current;  // ⚡ Conditionné au toggle
                boneAxesRef.current.position.copy(basePos);
                boneAxesRef.current.quaternion.copy(boneData.quaternion);
            }

            // ⚡ Toggle axes ring + synchro position/rotation/scale
            if (ringAxesRef.current) {
                ringAxesRef.current.visible = showRingAxesRef.current;
                ringAxesRef.current.position.copy(ringRef.current.position);
                ringAxesRef.current.quaternion.copy(ringRef.current.quaternion);
                ringAxesRef.current.scale.copy(ringRef.current.scale);
            }

            // Debug logging (seulement si axes visibles)
            if (boneAxesRef.current && showSkeletonRef.current) {
                const now = Date.now();
                if (now - lastLogRef.current > 1000) {
                    lastLogRef.current = now;

                    // Récupérer l'occluder du même doigt pour comparaison
                    const occluderMesh = occludersRef.current.get(targetBoneName);

                    console.group("🔍 DEBUG RING vs OCCLUDER");

                    // Position comparison
                    console.log("%c📍 POSITIONS", "color: #FF6600; font-weight: bold");
                    console.table({
                        "Ring": {
                            x: ringRef.current.position.x.toFixed(4),
                            y: ringRef.current.position.y.toFixed(4),
                            z: ringRef.current.position.z.toFixed(4)
                        },
                        "BoneData": {
                            x: boneData.position.x.toFixed(4),
                            y: boneData.position.y.toFixed(4),
                            z: boneData.position.z.toFixed(4)
                        },
                        "Occluder": occluderMesh ? {
                            x: occluderMesh.position.x.toFixed(4),
                            y: occluderMesh.position.y.toFixed(4),
                            z: occluderMesh.position.z.toFixed(4)
                        } : "N/A"
                    });

                    // Z difference (floating issue)
                    if (occluderMesh) {
                        const zDiff = ringRef.current.position.z - occluderMesh.position.z;
                        console.log(`%c⬆️ Ring Z - Occluder Z = ${zDiff.toFixed(4)} (positif = ring devant)`,
                            zDiff > 0 ? "color: #00FF00" : "color: #FF0000");
                    }

                    // Scale comparison
                    console.log("%c📏 SCALES", "color: #FF6600; font-weight: bold");
                    console.table({
                        "Ring": { scale: ringRef.current.scale.x.toFixed(4) },
                        "Occluder": occluderMesh ? { scale: occluderMesh.scale.x.toFixed(4) } : "N/A",
                        "BoneLength": { length: boneData.length.toFixed(4) }
                    });

                    // Rotation comparison
                    const ringE = new THREE.Euler().setFromQuaternion(ringRef.current.quaternion);
                    const boneE = new THREE.Euler().setFromQuaternion(boneData.quaternion);
                    const occE = occluderMesh ? new THREE.Euler().setFromQuaternion(occluderMesh.quaternion) : null;

                    console.log("%c🔄 ROTATIONS (degrees)", "color: #FF6600; font-weight: bold");
                    console.table({
                        "Ring": {
                            x: THREE.MathUtils.radToDeg(ringE.x).toFixed(1),
                            y: THREE.MathUtils.radToDeg(ringE.y).toFixed(1),
                            z: THREE.MathUtils.radToDeg(ringE.z).toFixed(1)
                        },
                        "Bone": {
                            x: THREE.MathUtils.radToDeg(boneE.x).toFixed(1),
                            y: THREE.MathUtils.radToDeg(boneE.y).toFixed(1),
                            z: THREE.MathUtils.radToDeg(boneE.z).toFixed(1)
                        },
                        "Occluder": occE ? {
                            x: THREE.MathUtils.radToDeg(occE.x).toFixed(1),
                            y: THREE.MathUtils.radToDeg(occE.y).toFixed(1),
                            z: THREE.MathUtils.radToDeg(occE.z).toFixed(1)
                        } : "N/A"
                    });

                    // Hand normal (for orientation debugging)
                    console.log("%c🖐️ HAND NORMAL", "color: #FF6600; font-weight: bold", {
                        x: handNormal.x.toFixed(3),
                        y: handNormal.y.toFixed(3),
                        z: handNormal.z.toFixed(3),
                        "pointing": handNormal.z > 0 ? "toward camera (+Z)" : "away from camera (-Z)"
                    });

                    console.groupEnd();
                }
            }

            renderer.render(scene, camera);
        };

        animate();

        return () => {
            unsubTracking();
            unsubRingAdj();
            unsubSkelAdj();
            unsubSelected();

            if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
            if (rendererRef.current) rendererRef.current.dispose();

            occludersRef.current.clear();
            bonesDataRef.current.clear();
        };
    }, [videoWidth, videoHeight]);

    const mirrorStyle: React.CSSProperties = {
        transform: shouldMirror ? "scaleX(-1)" : "none",
        transition: "transform 0.2s ease-in-out",
    };

    // ⚡ FIX CANVAS: Style avec dimensions exactes de la vidéo
    const canvasStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: videoWidth ? `${videoWidth}px` : '100%',
        height: videoHeight ? `${videoHeight}px` : '100%',
        zIndex: 10,
        ...mirrorStyle,
    };

    const debugCanvasStyle: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: videoWidth ? `${videoWidth}px` : '100%',
        height: videoHeight ? `${videoHeight}px` : '100%',
        zIndex: 11,
        pointerEvents: 'none' as const,
        ...mirrorStyle,
    };

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none">
            {/* ⚡ FIX: Plus de className="w-full h-full", on utilise le style avec dimensions exactes */}
            <canvas ref={canvasRef} style={canvasStyle} />
            {PERF_OPTIONS.ENABLE_SKELETON_2D && (
                <canvas ref={debugCanvasRef} style={debugCanvasStyle} />
            )}

            {/* ⚡ Debug buttons */}
            <div className="absolute bottom-20 left-4 flex gap-2 pointer-events-auto z-20">
                {/* Bouton Occluders (violet) */}
                <button
                    onClick={() => setDebugOccluder(!debugOccluder)}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded text-xs"
                >
                    {debugOccluder ? "Hide Occl" : "Show Occl"}
                </button>

                {/* Bouton Squelette 2D + ses axes bone (vert) */}
                <button
                    onClick={() => setShowSkeleton(!showSkeleton)}
                    className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded text-xs"
                >
                    {showSkeleton ? "Hide Skel" : "Show Skel"}
                </button>

                {/* Bouton Axes du modèle Ring SEULEMENT (orange) - pas le modèle */}
                <button
                    onClick={() => setShowRingAxes(!showRingAxes)}
                    className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-2 rounded text-xs"
                >
                    {showRingAxes ? "Hide Ring Axes" : "Show Ring Axes"}
                </button>
            </div>
        </div>
    );
}

export default Jewelry3D;