/**
 * =============================================================================
 * HAND-3D.TSX - Main volumÃ©trique 3D - VERSION 5.3
 * =============================================================================
 * 
 * VERSION 5.3: Ajout support mirroring pour camÃ©ras mobiles
 * 
 * Approche:
 * - RepÃ¨re orthonormÃ© avec palmNormal (mÃ©thode v3 originale)
 * - Filtrage des positions et rotations avec OneEuroFilter
 * - Mirroring CSS synchronisÃ© avec la vidÃ©o
 * 
 * @author TryJewel Team
 * @version 5.3.0
 */

'use client';

import { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Hand } from 'kalidokit';
import { useEdgeTrackingStore } from '@/stores/edge-tracking-store';
import { useSkeletonAdjustmentStore } from '@/stores/skeleton-adjustment-store';
import { useCameraStore } from '@/stores/camera-store';
import { Vector3OneEuroFilter, QuaternionOneEuroFilter } from '@/lib/one-euro-filter';

// =============================================================================
// TYPES
// =============================================================================

interface KalidoHandRig {
    [key: string]: { x: number; y: number; z: number } | undefined;
}

interface HandLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}

/** DonnÃ©es exportÃ©es pour chaque os - utilisables par Jewelry3D */
export interface BoneData {
    position: { x: number; y: number; z: number };
    quaternion: { x: number; y: number; z: number; w: number };
    direction: { x: number; y: number; z: number };
    length: number;
}

/** Store global pour partager les donnÃ©es des os avec Jewelry3D */
export const handBonesData: Map<string, BoneData> = new Map();

// =============================================================================
// CONSTANTES
// =============================================================================

/** ParamÃ¨tres du filtre OneEuro */
const FILTER_MIN_CUTOFF = 2.0;
const FILTER_BETA = 5;

/** Connexions entre landmarks pour les os de la main */
const BONE_CONNECTIONS = [
    // Pouce
    { start: 0, end: 1, name: 'palm_thumb', kalidoKey: null },
    { start: 1, end: 2, name: 'thumb_cmc', kalidoKey: 'ThumbProximal' },
    { start: 2, end: 3, name: 'thumb_mcp', kalidoKey: 'ThumbIntermediate' },
    { start: 3, end: 4, name: 'thumb_ip', kalidoKey: 'ThumbDistal' },

    // Index
    { start: 0, end: 5, name: 'palm_index', kalidoKey: null },
    { start: 5, end: 6, name: 'index_mcp', kalidoKey: 'IndexProximal' },
    { start: 6, end: 7, name: 'index_pip', kalidoKey: 'IndexIntermediate' },
    { start: 7, end: 8, name: 'index_dip', kalidoKey: 'IndexDistal' },

    // Majeur
    { start: 0, end: 9, name: 'palm_middle', kalidoKey: null },
    { start: 9, end: 10, name: 'middle_mcp', kalidoKey: 'MiddleProximal' },
    { start: 10, end: 11, name: 'middle_pip', kalidoKey: 'MiddleIntermediate' },
    { start: 11, end: 12, name: 'middle_dip', kalidoKey: 'MiddleDistal' },

    // Annulaire
    { start: 0, end: 13, name: 'palm_ring', kalidoKey: null },
    { start: 13, end: 14, name: 'ring_mcp', kalidoKey: 'RingProximal' },
    { start: 14, end: 15, name: 'ring_pip', kalidoKey: 'RingIntermediate' },
    { start: 15, end: 16, name: 'ring_dip', kalidoKey: 'RingDistal' },

    // Auriculaire
    { start: 0, end: 17, name: 'palm_pinky', kalidoKey: null },
    { start: 17, end: 18, name: 'pinky_mcp', kalidoKey: 'LittleProximal' },
    { start: 18, end: 19, name: 'pinky_pip', kalidoKey: 'LittleIntermediate' },
    { start: 19, end: 20, name: 'pinky_dip', kalidoKey: 'LittleDistal' },

    // Connexions transversales de la paume
    { start: 5, end: 9, name: 'palm_cross_1', kalidoKey: null },
    { start: 9, end: 13, name: 'palm_cross_2', kalidoKey: null },
    { start: 13, end: 17, name: 'palm_cross_3', kalidoKey: null },
];

/** Couleurs pour diffÃ©rentes parties */
const COLORS = {
    palm: 0x8B7355,
    thumb: 0xDEB887,
    finger: 0xD2B48C,
    joint: 0xFFE4C4,
    tip: 0xFFA07A,
};

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

interface Hand3DProps {
    color?: number;
    opacity?: number;
    showJoints?: boolean;
    wireframe?: boolean;
    visible?: boolean;
}

export function Hand3D({
    color = 0xDEB887,
    opacity = 0.8,
    showJoints = true,
    wireframe = false,
    visible = true,
}: Hand3DProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const visibleRef = useRef(visible);

    // âš¡ Lire shouldMirror depuis le store
    const shouldMirror = useCameraStore((state) => state.camera.shouldMirror);

    useEffect(() => {
        visibleRef.current = visible;
    }, [visible]);

    // Refs Three.js
    const sceneRef = useRef<THREE.Scene | null>(null);
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
    const handGroupRef = useRef<THREE.Group | null>(null);
    const bonesRef = useRef<Map<string, THREE.Mesh>>(new Map());
    const jointsRef = useRef<THREE.Mesh[]>([]);
    const animationIdRef = useRef<number | null>(null);

    // Filtres OneEuro pour chaque os
    const positionFiltersRef = useRef<Map<string, Vector3OneEuroFilter>>(new Map());
    const rotationFiltersRef = useRef<Map<string, QuaternionOneEuroFilter>>(new Map());

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth || 640;
        const height = container.clientHeight || 480;
        const aspect = width / height;

        // Scene
        const scene = new THREE.Scene();
        sceneRef.current = scene;

        // Camera orthographique
        const frustumSize = 1;
        const camera = new THREE.OrthographicCamera(
            -frustumSize * aspect / 2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            -frustumSize / 2,
            0.01,
            10
        );
        camera.position.z = 1;
        cameraRef.current = camera;

        // Renderer
        const renderer = new THREE.WebGLRenderer({
            canvas: canvasRef.current,
            alpha: true,
            antialias: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererRef.current = renderer;

        // LumiÃ¨res
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(0, 1, 2);
        scene.add(dirLight);

        const backLight = new THREE.DirectionalLight(0x888888, 0.4);
        backLight.position.set(0, 0, -1);
        scene.add(backLight);

        // Groupe pour la main
        const handGroup = new THREE.Group();
        handGroupRef.current = handGroup;
        scene.add(handGroup);

        // MatÃ©riau de base
        const boneMaterial = new THREE.MeshPhongMaterial({
            color: color,
            transparent: true,
            opacity: opacity,
            wireframe: wireframe,
        });

        // CrÃ©er les os (cylindres Ã©pais)
        BONE_CONNECTIONS.forEach((bone) => {
            let radiusTop = 0.025;
            let radiusBottom = 0.020;

            if (bone.name.includes('palm')) {
                radiusTop = 0.035;
                radiusBottom = 0.030;
            } else if (bone.name.includes('thumb')) {
                radiusTop = 0.022;
                radiusBottom = 0.018;
            } else if (bone.name.includes('_mcp')) {
                radiusTop = 0.022;
                radiusBottom = 0.020;
            } else if (bone.name.includes('_pip')) {
                radiusTop = 0.020;
                radiusBottom = 0.016;
            } else if (bone.name.includes('_dip') || bone.name.includes('_ip')) {
                radiusTop = 0.016;
                radiusBottom = 0.012;
            }

            const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, 0.1, 8);
            const mesh = new THREE.Mesh(geometry, boneMaterial.clone());
            mesh.name = bone.name;

            if (bone.name.includes('palm')) {
                (mesh.material as THREE.MeshPhongMaterial).color.setHex(COLORS.palm);
            } else if (bone.name.includes('thumb')) {
                (mesh.material as THREE.MeshPhongMaterial).color.setHex(COLORS.thumb);
            }

            handGroup.add(mesh);
            bonesRef.current.set(bone.name, mesh);

            // CrÃ©er les filtres pour cet os
            positionFiltersRef.current.set(bone.name, new Vector3OneEuroFilter(FILTER_MIN_CUTOFF, FILTER_BETA));
            rotationFiltersRef.current.set(bone.name, new QuaternionOneEuroFilter(FILTER_MIN_CUTOFF, FILTER_BETA));
        });

        // CrÃ©er les articulations (sphÃ¨res)
        if (showJoints) {
            const jointMaterial = new THREE.MeshPhongMaterial({
                color: COLORS.joint,
                transparent: true,
                opacity: opacity,
            });

            for (let i = 0; i < 21; i++) {
                const radius = i === 0 ? 0.040 :
                    [1, 5, 9, 13, 17].includes(i) ? 0.030 :
                        [2, 6, 10, 14, 18].includes(i) ? 0.025 :
                            [3, 7, 11, 15, 19].includes(i) ? 0.020 :
                                [4, 8, 12, 16, 20].includes(i) ? 0.018 :
                                    0.022;

                const geometry = new THREE.SphereGeometry(radius, 8, 8);
                const mesh = new THREE.Mesh(geometry, jointMaterial.clone());

                if ([4, 8, 12, 16, 20].includes(i)) {
                    (mesh.material as THREE.MeshPhongMaterial).color.setHex(COLORS.tip);
                }

                handGroup.add(mesh);
                jointsRef.current.push(mesh);
            }
        }

        // =====================================================================
        // BOUCLE D'ANIMATION
        // =====================================================================

        // ⚡ CACHE DES STORES - Évite d'appeler getState() 60x/seconde
        const storeCache = {
            tracking: useEdgeTrackingStore.getState().tracking,
            adjustment: useSkeletonAdjustmentStore.getState(),
        };

        const unsubTracking = useEdgeTrackingStore.subscribe(
            (state) => { storeCache.tracking = state.tracking; }
        );
        const unsubAdjustment = useSkeletonAdjustmentStore.subscribe(
            (state) => { storeCache.adjustment = state; }
        );

        const animate = () => {
            animationIdRef.current = requestAnimationFrame(animate);

            // ⚡ Utiliser le cache au lieu de getState()
            const currentTracking = storeCache.tracking;
            const adjustment = storeCache.adjustment;

            if (!currentTracking.last_result?.hand_result?.landmarks) {
                if (handGroupRef.current) {
                    handGroupRef.current.visible = false;
                }
                renderer.render(scene, camera);
                return;
            }

            const landmarks = currentTracking.last_result.hand_result.landmarks as HandLandmark[];
            const handedness = currentTracking.last_result.hand_result.handedness;

            if (landmarks.length < 21) {
                renderer.render(scene, camera);
                return;
            }

            if (handGroupRef.current) {
                handGroupRef.current.visible = visibleRef.current;
            }

            // ================================================================
            // KALIDOKIT - Obtenir les rotations
            // ================================================================

            const landmarkArray = landmarks.map((lm) => ({
                x: lm.x, y: lm.y, z: lm.z
            }));

            const kalidoSide: 'Left' | 'Right' = handedness === 'Left' ? 'Right' : 'Left';

            let handRig: KalidoHandRig = {};
            try {
                handRig = Hand.solve(landmarkArray, kalidoSide) as KalidoHandRig;
            } catch {
                // Continuer sans rotations KalidoKit
            }

            // ================================================================
            // CONVERTIR LANDMARKS EN POSITIONS 3D
            // ================================================================

            let centerX = 0.5, centerY = 0.5;
            try {
                centerX = landmarks.reduce((sum, lm) => sum + lm.x, 0) / landmarks.length;
                centerY = landmarks.reduce((sum, lm) => sum + lm.y, 0) / landmarks.length;
            } catch {
                // Utiliser les valeurs par dÃ©faut
            }

            // ================================================================
            // CALCULER LA NORMALE 3D DE LA PAUME
            // ================================================================

            const wrist = landmarks[0];
            const indexMcp = landmarks[5];
            const pinkyMcp = landmarks[17];

            const v1 = new THREE.Vector3(
                indexMcp.x - wrist.x,
                indexMcp.y - wrist.y,
                (indexMcp.z - wrist.z)
            );
            const v2 = new THREE.Vector3(
                pinkyMcp.x - wrist.x,
                pinkyMcp.y - wrist.y,
                (pinkyMcp.z - wrist.z)
            );

            const palmNormal = new THREE.Vector3().crossVectors(v1, v2).normalize();

            const isRightHandInImage = handedness === 'Right';
            if (isRightHandInImage) {
                palmNormal.negate();
            }

            const palmAngle = Math.max(-1, Math.min(1, palmNormal.z * 2));
            const HYSTERESIS = 0.15;
            const isPalmFacing = palmAngle > HYSTERESIS;

            const zFactor = 1.5;
            const scaleX = adjustment.scaleX ?? 1.0;
            const scaleY = adjustment.scaleY ?? 1.0;

            const positions: THREE.Vector3[] = landmarks.map((lm) => {
                const scaledX = centerX + (lm.x - centerX) * scaleX + (adjustment.offsetX / width);
                const scaledY = centerY + (lm.y - centerY) * scaleY + (adjustment.offsetY / height);

                return new THREE.Vector3(
                    (scaledX - 0.5) * aspect,
                    (0.5 - scaledY),
                    lm.z * zFactor
                );
            });

            // Exporter l'info paume/dos
            handBonesData.set('_palmFacing', {
                position: { x: isPalmFacing ? 1 : 0, y: palmAngle, z: 0 },
                quaternion: { x: palmNormal.x, y: palmNormal.y, z: palmNormal.z, w: 0 },
                direction: { x: 0, y: 0, z: 0 },
                length: 0
            });

            const isLeftHandReal = handedness === 'Right';
            handBonesData.set('_handedness', {
                position: { x: isLeftHandReal ? 1 : 0, y: 0, z: 0 },
                quaternion: { x: 0, y: 0, z: 0, w: 1 },
                direction: { x: 0, y: 0, z: 0 },
                length: 0
            });

            const timestamp = performance.now() / 1000;

            // ================================================================
            // METTRE Ã€ JOUR LES OS
            // ================================================================

            BONE_CONNECTIONS.forEach((bone) => {
                const mesh = bonesRef.current.get(bone.name);
                if (!mesh) return;

                const startPos = positions[bone.start];
                const endPos = positions[bone.end];

                if (!startPos || !endPos) return;

                const rawPosition = new THREE.Vector3().lerpVectors(startPos, endPos, 0.5);
                const direction = new THREE.Vector3().subVectors(endPos, startPos);
                const length = direction.length();

                mesh.scale.set(1, length / 0.1, 1);

                const dirNorm = direction.clone().normalize();
                const finalQuat = new THREE.Quaternion();

                const axisY = dirNorm.clone();
                const palmNormalLocal = palmNormal.clone();
                const zRaw = palmNormalLocal.sub(
                    axisY.clone().multiplyScalar(palmNormalLocal.dot(axisY))
                );

                const zLen = zRaw.length();
                let axisZ: THREE.Vector3;
                if (zLen > 0.1) {
                    axisZ = zRaw.normalize();
                } else {
                    axisZ = new THREE.Vector3(0, 0, 1);
                }

                const axisX = new THREE.Vector3().crossVectors(axisY, axisZ).normalize();
                axisZ = new THREE.Vector3().crossVectors(axisX, axisY).normalize();

                const rotMatrix = new THREE.Matrix4();
                rotMatrix.makeBasis(axisX, axisY, axisZ);
                finalQuat.setFromRotationMatrix(rotMatrix);

                // Ajouter la rotation KalidoKit pour la flexion
                if (bone.kalidoKey && handRig) {
                    const fullKey = `${kalidoSide}${bone.kalidoKey}`;
                    const kalidoRot = handRig[fullKey];

                    if (kalidoRot) {
                        const kalidoQuat = new THREE.Quaternion().setFromEuler(
                            new THREE.Euler(
                                kalidoRot.x * 0.3,
                                kalidoRot.y * 0.3,
                                0
                            )
                        );
                        finalQuat.multiply(kalidoQuat);
                    }
                }

                // Appliquer le filtrage
                const posFilter = positionFiltersRef.current.get(bone.name);
                const rotFilter = rotationFiltersRef.current.get(bone.name);

                let filteredPosition = rawPosition;
                let filteredQuat = finalQuat;

                if (posFilter) {
                    filteredPosition = posFilter.filter(rawPosition, timestamp);
                }

                if (rotFilter) {
                    filteredQuat = rotFilter.filter(finalQuat, timestamp);
                }

                mesh.position.copy(filteredPosition);
                mesh.quaternion.copy(filteredQuat);

                // Exporter pour Jewelry3D
                handBonesData.set(bone.name, {
                    position: {
                        x: filteredPosition.x,
                        y: filteredPosition.y,
                        z: filteredPosition.z
                    },
                    quaternion: {
                        x: filteredQuat.x,
                        y: filteredQuat.y,
                        z: filteredQuat.z,
                        w: filteredQuat.w
                    },
                    direction: {
                        x: direction.x,
                        y: direction.y,
                        z: direction.z
                    },
                    length: length
                });
            });

            // Mettre Ã  jour les articulations
            if (showJoints) {
                positions.forEach((pos, index) => {
                    if (jointsRef.current[index]) {
                        jointsRef.current[index].position.copy(pos);
                    }
                });
            }

            renderer.render(scene, camera);
        };

        animate();

        // =====================================================================
        // CLEANUP
        // =====================================================================

        // Capturer les refs pour le cleanup
        const currentBones = bonesRef.current;
        const currentJoints = jointsRef.current;
        const currentPosFilters = positionFiltersRef.current;
        const currentRotFilters = rotationFiltersRef.current;

        return () => {
            // ⚡ Cleanup subscriptions
            unsubTracking();
            unsubAdjustment();

            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
            if (rendererRef.current) {
                rendererRef.current.dispose();
            }
            currentBones.clear();
            currentJoints.length = 0;
            currentPosFilters.clear();
            currentRotFilters.clear();
        };
    }, [color, opacity, showJoints, wireframe]);

    // =========================================================================
    // RENDER - avec mirroring CSS
    // =========================================================================

    return (
        <div ref={containerRef} className="absolute inset-0 pointer-events-none">
            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full"
                style={{
                    zIndex: 12,
                    transform: shouldMirror ? 'scaleX(-1)' : 'none',
                    transition: 'transform 0.2s ease-in-out',
                }}
            />
        </div>
    );
}

export default Hand3D;