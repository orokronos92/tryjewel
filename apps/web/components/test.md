/**
 * =============================================================================
 * JEWELRY-3D.TSX - VERSION 12.2 - HYBRIDE ORIGINAL + KALIDOKIT
 * =============================================================================
 * 
 * Repart des calculs originaux v11.3 (maison avec axes/palmNormal), qui marchaient bien sauf un axe.
 * Ajoute multiply par Kalidokit quaternion pour fixer l'axe problématique (e.g., Z/roll via wrist/finger).
 * 
 * - Hybride: quaternionMaison.multiply(kalidoQuat)
 * - Slerp frame-to-frame pour smoothing (fixe sauts)
 * - Logs pour debug axes (Euler/Quat)
 * - Option modes A-H pour tester axes originaux
 * 
 * @author TryJewel Team + Grok Suggestions
 * @version 12.2.0 - HYBRID FIX
 */

"use client";

import { useRef, useEffect, useState } from "react";
import { useEdgeTrackingStore } from "@/stores/edge-tracking-store";
import { useJewelryStore } from "@/stores/jewelry-store";
import { useSkeletonAdjustmentStore } from "@/stores/skeleton-adjustment-store";
import { useRingAdjustmentStore } from "@/stores/ring-adjustment-store";
import { useCameraStore } from "@/stores/camera-store";
import * as THREE from "three";
// @ts-expect-error - GLTFLoader types
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
// @ts-expect-error - RoomEnvironment types
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment";
import { Vector3OneEuroFilter, QuaternionOneEuroFilter } from "@/lib/one-euro-filter";

// OPTIONS DE PERFORMANCE (comme original)
const PERF_OPTIONS = {
    ENABLE_SKELETON_2D: true,
    ENABLE_OCCLUDERS: true,
    ENABLE_DEBUG_INFO: false,
    ENABLE_DEBUG_BUTTON: false,
    LOW_QUALITY_RENDERER: true,
    DISABLE_ENVIRONMENT: false,
};

// TYPES et CONSTANTES (comme original + FINGER_LANDMARKS pour Kalidokit)
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

const FINGER_TO_BONE: Record<string, string> = {
    thumb: 'thumb_mcp',
    index: 'index_mcp',
    middle: 'middle_mcp',
    ring: 'ring_mcp',
    pinky: 'pinky_mcp',
};

const FINGER_LANDMARKS: Record<string, { proximal: string; intermediate: string }> = {
    thumb: { proximal: 'ThumbProximal', intermediate: 'ThumbIntermediate' },
    index: { proximal: 'IndexProximal', intermediate: 'IndexIntermediate' },
    middle: { proximal: 'MiddleProximal', intermediate: 'MiddleIntermediate' },
    ring: { proximal: 'RingProximal', intermediate: 'RingIntermediate' },
    pinky: { proximal: 'PinkyProximal', intermediate: 'PinkyIntermediate' },
};

// ... (gardez HAND_CONNECTIONS, BONE_CONNECTIONS, OCCLUDER_CONFIGS, FILTER_MIN_CUTOFF, FILTER_BETA comme original)

const FILTER_MIN_CUTOFF = 2.0;
const FILTER_BETA = 5;

// NOUVELLE FONCTION KALIDOKIT (simplifiée, avec intermediate pour plus de précision)
function getQuaternionFromKalidokitRig(
    kalidokitRig: Record<string, { x: number; y: number; z: number }>,
    handedness: string,
    fingerName: string
): THREE.Quaternion | null {
    const kalidoSide = handedness === 'Left' ? 'Right' : 'Left';
    const fingerData = FINGER_LANDMARKS[fingerName];
    if (!fingerData) return null;

    const wristKey = `${kalidoSide}Wrist`;
    const proximalKey = `${kalidoSide}${fingerData.proximal}`;
    const intermediateKey = `${kalidoSide}${fingerData.intermediate}`;

    const wristRot = kalidokitRig[wristKey];
    const proximalRot = kalidokitRig[proximalKey];
    const intermediateRot = kalidokitRig[intermediateKey] || { x: 0, y: 0, z: 0 };  // Ajout intermediate

    if (!wristRot || !proximalRot) return null;

    // Euler to Quat
    const wristQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(wristRot.x, wristRot.y, wristRot.z, 'XYZ'));
    const proximalQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(proximalRot.x, proximalRot.y, proximalRot.z, 'XYZ'));
    const intQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(intermediateRot.x, intermediateRot.y, intermediateRot.z, 'XYZ'));

    // Combine + slerp modéré (moins agressif que Claude : 0.9/0.7 pour garder amplitude)
    const combined = wristQuat.multiply(proximalQuat).multiply(intQuat);
    const identity = new THREE.Quaternion();
    return combined.slerp(identity, 0.3);  // Léger atténuation (ajustez à 0.2 si trop fort)
}

// COMPOSANT (reprenez de v11.3, avec ajouts)
export function Jewelry3D() {
    // ... (tous les refs/useEffect comme original)

    const [rotationMode, setRotationMode] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'>('A');  // Optionnel pour debug axes originaux

    // Dans animate (reprenez boucle originale, mais modifiez quaternion calc)
    // ... (positions, palmNormal, bones calc comme original)

    // 🎯 ROTATION HYBRIDE : Original Maison + Kalidokit Multiply
    const fingerName = currentSelected.finger || 'index';
    const boneName = FINGER_TO_BONE[fingerName];
    const boneData = bonesDataRef.current.get(boneName);

    if (!boneData || !ringRef.current) {
        renderer.render(scene, camera);
        return;
    }

    // Position (comme original)
    // ... (targetPos calc)

    // Quaternion Maison (comme v11.3, avec modes optionnels pour debug l'axe problématique)
    let maisonQuat = new THREE.Quaternion();  // Init
    const direction = boneData.direction.clone().normalize();
    const axisY = direction.clone();
    const palmNormalLocal = palmDataRef.current.palmNormal.clone();
    const zRaw = palmNormalLocal.sub(axisY.clone().multiplyScalar(palmNormalLocal.dot(axisY)));
    const zLen = zRaw.length();
    let axisZ = zLen > 0.1 ? zRaw.normalize() : new THREE.Vector3(0, 0, 1);

    // Modes pour debug (comme Claude v12.0, optionnel – cyclez pour tester axes)
    switch (rotationMode) {
        case 'A': // Original-like: pinky→index 2D + normal Z
            axisZ = new THREE.Vector3(0, 0, 1);  // Simplifié pour test
            break;
        case 'B': axisZ.negate(); break;
        // ... (ajoutez C-H comme v12.0 si besoin pour debug)
        default: break;
    }

    const axisX = new THREE.Vector3().crossVectors(axisY, axisZ).normalize();
    const finalAxisZ = new THREE.Vector3().crossVectors(axisX, axisY).normalize();
    const rotMatrix = new THREE.Matrix4().makeBasis(axisX, axisY, finalAxisZ);
    maisonQuat.setFromRotationMatrix(rotMatrix);

    // Ajoutez Kalidokit si disponible (multiply pour hybride)
    const kalidokitRig = currentTracking.last_result?.kalidokit_rig;
    if (kalidokitRig) {
        const kalidoQuat = getQuaternionFromKalidokitRig(kalidokitRig, handedness, fingerName);
        if (kalidoQuat) {
            maisonQuat.multiply(kalidoQuat);  // Hybride : Original + Kalidokit (fixe l'axe problématique)
        }
    }

    // Corrections originales + user
    maisonQuat.conjugate();  // Comme original
    maisonQuat.z = -maisonQuat.z;  // Inversion Z
    const modelCorrectionQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0));
    const userRotOffset = new THREE.Quaternion().setFromEuler(new THREE.Euler(userRotX, userRotY, userRotZ));
    const targetQuat = maisonQuat.multiply(modelCorrectionQuat).multiply(userRotOffset);

    // Slerp frame-to-frame (ajout pour smoothing)
    const prevQuatRef = useRef(new THREE.Quaternion());  // Ajoutez ce ref en haut
    targetQuat.normalize();
    ringRef.current.quaternion.slerp(targetQuat, 0.8);
    prevQuatRef.current.copy(targetQuat);

    // ... (scale, occluders, render comme original)

    // LOGS pour debug axes (ajoutez après targetQuat)
    if (frameCount % 60 === 0) {
        const euler = new THREE.Euler().setFromQuaternion(targetQuat, 'XYZ');
        console.log('[Hybrid Debug] Euler (deg):', 
            { x: (euler.x * 180 / Math.PI).toFixed(1), y: (euler.y * 180 / Math.PI).toFixed(1), z: (euler.z * 180 / Math.PI).toFixed(1) });
        console.log('[Hybrid Debug] Source:', kalidokitRig ? 'Maison + Kalidokit' : 'Maison Only');
        // Ajoutez plus si besoin (comme ma suggestion précédente)
    }
}

// RENDER (ajoutez bouton cycle modes comme v12.0 pour debug)
return (
    // ... (comme original, avec bouton cycle si voulu)
);