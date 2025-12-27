
import * as THREE from "three";

/**
 * Constants for hand landmarks
 */
export const LANDMARK = {
    WRIST: 0,
    THUMB_CMC: 1,
    THUMB_MCP: 2,
    THUMB_IP: 3,
    THUMB_TIP: 4,
    INDEX_MCP: 5,
    INDEX_PIP: 6,
    INDEX_DIP: 7,
    INDEX_TIP: 8,
    MIDDLE_MCP: 9,
    MIDDLE_PIP: 10,
    MIDDLE_DIP: 11,
    MIDDLE_TIP: 12,
    RING_MCP: 13,
    RING_PIP: 14,
    RING_DIP: 15,
    RING_TIP: 16,
    PINKY_MCP: 17,
    PINKY_PIP: 18,
    PINKY_DIP: 19,
    PINKY_TIP: 20,
};

// Finger to bone indices mapping
export const FINGER_TO_BONE_INDICES: Record<string, { start: number; end: number }> = {
    thumb: { start: 2, end: 3 }, // MCP -> IP
    index: { start: 5, end: 6 }, // MCP -> PIP
    middle: { start: 9, end: 10 },
    ring: { start: 13, end: 14 },
    pinky: { start: 17, end: 18 },
};

/**
 * Safe normalize function.
 * Returns fallback if vector length is close to zero.
 */
export function safeNormalize(v: THREE.Vector3, fallback: THREE.Vector3 = new THREE.Vector3(0, 1, 0)): THREE.Vector3 {
    const len = v.length();
    if (len < 1e-6) return fallback.clone();
    return v.clone().multiplyScalar(1 / len);
}

/**
 * Calculates the jewelry position and basis vectors from hand landmarks.
 */
export function calculateJewelryPose(
    landmarks: Array<{ x: number; y: number; z: number }>,
    worldLandmarks: Array<{ x: number; y: number; z: number }> | null,
    handedness: "Left" | "Right",
    finger: string
): {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    direction: THREE.Vector3;
    boneLength: number;
    basis: { x: THREE.Vector3; y: THREE.Vector3; z: THREE.Vector3 };
    palmFacing: boolean;
    rawPalmNormal: THREE.Vector3;
} | null {
    // 1. Validate finger
    const bone = FINGER_TO_BONE_INDICES[finger];
    if (!bone) return null;

    // 2. Landmarks extraction
    // Note: landmarks are expected to be projected to render space in the hook BEFORE calling likely,
    // BUT the plan says "recompute axisZ = ...".
    // Wait, let's look at how the hook does it. It projects landmarks for 'position' calculation.
    // But usage of 'worldLandmarks' is for 'rotation'.

    // We assume 'landmarks' passed here are already "projected" 3D positions for the visual ring position?
    // OR we assume we pass raw landmarks and do projection outside?
    // The hook does: positions = landmarks.map(project);
    // Then calculates rawPosition from positions.

    // Let's split responsibilities cleanly.
    // This function should probably focus on ROTATION computation from WORLD landmarks,
    // and maybe Position if provided with proper vectors.

    // Let's adapt the signature to take prepared vectors if needed, or stick to the hook's logic.
    // To stay compatible with the plan: "lib/ar/jewelry-pose.ts - buildRingBasisFromHand(...)".

    // Let's implement `buildRingBasisFromHand` which takes World Landmarks.

    return null; // Placeholder as I rethink the signature in the next tool call
}

/**
 * Builds the rotation basis (X, Y, Z) for the ring based on world landmarks.
 * 
 * axisY = Finger direction (Phalanx bone)
 * axisZ = Palm Normal projected on plane perpendicular to Y
 * axisX = Y cross Z
 */
// =============================================================================
// DEBUG CONFIGURATION (Toggles for "Rotation Protocol")
// =============================================================================
export const POSE_DEBUG_CONFIG = {
    // Mode 0: Default (Axis Z from projection)
    // Mode 1: Twist Lock (Axis X from Palm x Finger) -> prevents rolling on the side
    BASIS_MODE: 1 as 0 | 1,

    // Camera Direction
    // (0,0,-1) usually for standard WebGL/MP
    // (0,0,1) if your Z is inverted elsewhere
    CAMERA_DIR_Z: -1 as 1 | -1,

    // Order of multiplication for final quaternion
    // A: basis * flip * model (Standard - Local Correction)
    // B: model * basis * flip (Global Correction / Pre-multiply)
    // A: basis * flip * model (Standard - Local Correction)
    // B: model * basis * flip (Global Correction / Pre-multiply)
    ORDER_MODE: 'B' as 'A' | 'B',

    // Model Correction (Euler angles in radians)
    // Default: X=90 deg (PI/2) to orient a Y-up cylinder to Z-forward finger
    MODEL_CORRECTION: { x: Math.PI / 2, y: 0, z: 0 }
};

/**
 * Builds the rotation basis (X, Y, Z) for the ring based on world landmarks.
 */
export function buildRingBasisFromHand(
    worldLandmarks: Array<{ x: number; y: number; z: number }>,
    handedness: "Left" | "Right",
    finger: string
) {
    const bone = FINGER_TO_BONE_INDICES[finger];
    if (!bone) return null;

    const w = (i: number) => new THREE.Vector3(worldLandmarks[i].x, worldLandmarks[i].y, -worldLandmarks[i].z);

    const wStart = w(bone.start);
    const wEnd = w(bone.end);
    const wWrist = w(LANDMARK.WRIST);
    const wIndex = w(LANDMARK.INDEX_MCP);
    const wPinky = w(LANDMARK.PINKY_MCP);

    // 1. Finger Direction (Axis Y)
    // Main axis of the cylinder/ring
    const axisY = safeNormalize(
        new THREE.Vector3().subVectors(wEnd, wStart),
        new THREE.Vector3(0, 1, 0)
    );

    // 2. Palm Normal
    const vIndex = new THREE.Vector3().subVectors(wIndex, wWrist);
    const vPinky = new THREE.Vector3().subVectors(wPinky, wWrist);

    let palmNormal = new THREE.Vector3();
    if (handedness === "Right") {
        palmNormal.crossVectors(vIndex, vPinky);
    } else {
        palmNormal.crossVectors(vPinky, vIndex);
    }
    palmNormal = safeNormalize(palmNormal, new THREE.Vector3(0, 0, 1));

    let axisX = new THREE.Vector3();
    let axisZ = new THREE.Vector3();

    if (POSE_DEBUG_CONFIG.BASIS_MODE === 1) {
        // --- MODE 1: TWIST LOCK ---
        // We construct Axis X (lateral) first using Palm Normal.
        // This "locks" the ring's lateral axis to the palm plane, preventing it from 
        // rolling around the finger axis when the hand tilts.

        // Axis X = Palm Normal x Axis Y (Right Hand rule)
        // For Left hand? Symmetry is handled by handedness of PalmNormal usually?
        // Let's stick to standard cross product and verify visual.
        axisX.crossVectors(palmNormal, axisY).normalize();

        // Then Axis Z = X x Y
        axisZ.crossVectors(axisX, axisY).normalize();

    } else {
        // --- MODE 0: LEGACY / STANDARD ---
        // We construct Axis Z (Up/Dorsal) first by projecting Palm Normal.

        axisZ = palmNormal.clone().sub(axisY.clone().multiplyScalar(palmNormal.dot(axisY)));

        if (axisZ.length() < 1e-5) {
            const fwd = new THREE.Vector3(0, 0, 1);
            axisZ = fwd.clone().sub(axisY.clone().multiplyScalar(fwd.dot(axisY)));
        }
        axisZ.normalize();

        // Axis X = Y x Z
        axisX.crossVectors(axisY, axisZ).normalize();

        // Re-orthonormalize Z
        axisZ.crossVectors(axisX, axisY).normalize();
    }

    return { axisX, axisY, axisZ, palmNormal };
}

/**
 * Determines if the palm is facing the camera.
 */
export function isPalmFacingCamera(
    palmNormal: THREE.Vector3,
    // cameraDir is now optional, used if not overridden by config
    _unusedCameraDir?: THREE.Vector3,
    currentPalmFacing: boolean | null = null
): boolean {
    const cameraDir = new THREE.Vector3(0, 0, POSE_DEBUG_CONFIG.CAMERA_DIR_Z);

    // Dot product:
    // If Z=-1 (camera looking at hand), Normal pointing to camera (Z>0) => dot < 0 ?
    // Wait.
    // If Camera is at Z=10 looking at Z=0. Direction = (0,0,-1).
    // If Palm is facing camera, its Normal is approx (0,0,1).
    // Dot = 1 * -1 = -1.
    // So dot < 0 means facing camera?
    // Let's check logic:
    // Original code: dot > 0.
    // If original code worked with dot > 0, implies PalmNormal was approx (0,0,-1) OR CameraDir was (0,0,1).
    // MP World Z is negative?

    // Let's trust usage of Config.
    const dot = palmNormal.dot(cameraDir);

    const ENTER = 0.10;
    const EXIT = 0.02;

    if (currentPalmFacing === null) {
        return dot > 0;
    }

    if (currentPalmFacing) {
        return dot > EXIT;
    } else {
        return dot > ENTER;
    }
}

/**
 * Creates the final quaternion for the jewelry.
 */
export function computeFinalQuaternion(
    basis: { axisX: THREE.Vector3; axisY: THREE.Vector3; axisZ: THREE.Vector3 },
    palmFacing: boolean
): THREE.Quaternion {
    const { axisX, axisY, axisZ } = basis;
    const rotMatrix = new THREE.Matrix4().makeBasis(axisX, axisY, axisZ);

    const basisQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

    let flipQuat = new THREE.Quaternion(); // Identity
    if (!palmFacing) {
        // Flip 180 around X
        flipQuat.setFromAxisAngle(axisX, Math.PI);
    }

    const { x, y, z } = POSE_DEBUG_CONFIG.MODEL_CORRECTION;
    const modelQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(x, y, z));

    const finalQuat = basisQuat.clone();

    // Apply multiplications based on Order Mode
    switch (POSE_DEBUG_CONFIG.ORDER_MODE) {
        case 'A': // basis * flip * model (Standard)
            finalQuat.multiply(flipQuat).multiply(modelQuat);
            break;
        case 'B': // model * (basis * flip) (Premultiply)
            // We apply flip to basis first (standard for palm/back), then apply model correction "from outside" (or as parent)
            finalQuat.multiply(flipQuat).premultiply(modelQuat);
            break;
    }

    return finalQuat;
}

/**
 * Ensures quaternion continuity to avoid 180 degree flips in representation.
 */
export function ensureQuaternionContinuity(
    current: THREE.Quaternion,
    previous: THREE.Quaternion | null
): THREE.Quaternion {
    if (!previous) return current;
    if (current.dot(previous) < 0) {
        return new THREE.Quaternion(-current.x, -current.y, -current.z, -current.w);
    }
    return current;
}
