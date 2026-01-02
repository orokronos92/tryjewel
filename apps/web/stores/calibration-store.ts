import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Tailles de bague par région
 * EU: circonférence en mm (ex: 52mm = taille 52)
 * US: formule (circ - 36.5) / 2.55
 */
export interface RingSizes {
    circumferenceMm: number;
    eu: number;
    us: number;
    uk: string; // A-Z
}

/**
 * Mesures d'un doigt
 */
export interface FingerMeasurement {
    widthPx: number;        // Largeur en pixels (vue caméra)
    widthMm: number;        // Largeur en mm (calculée)
    depthMm: number;        // Profondeur estimée en mm (depuis worldLandmarks Z)
    circumferenceMm: number; // Tour de doigt en mm (formule ellipse)
    ringSizes: RingSizes;   // Tailles de bague correspondantes
}

/**
 * Mesures de la main complète
 */
export interface HandMeasurements {
    // Dimensions globales de la main
    handWidthPx: number;   // Largeur paume en pixels
    handHeightPx: number;  // Hauteur main en pixels

    // Tour de doigt pour chaque doigt (sauf pouce)
    index: FingerMeasurement | null;
    middle: FingerMeasurement | null;
    ring: FingerMeasurement | null;
    pinky: FingerMeasurement | null;
}

/**
 * Données de calibration pour une distance (proche ou loin)
 */
export interface DistanceCalibration {
    cardWidthPx: number;   // Largeur carte en pixels
    pixelsPerMm: number;   // Ratio calculé (cardWidthPx / 85.6)
    handMeasurements: HandMeasurements | null;
}

/**
 * État complet de la calibration
 */
interface CalibrationState {
    // Étapes de calibration
    currentStep: number; // 0 = pas commencé, 1-4 = étapes, 5 = terminé

    // Données de calibration
    closeDistance: DistanceCalibration | null;  // Étapes 1-2 (proche)
    farDistance: DistanceCalibration | null;    // Étapes 3-4 (loin)

    // Résultats finaux (moyennes ou valeurs de référence)
    finalFingerSizes: {
        index: RingSizes | null;
        middle: RingSizes | null;
        ring: RingSizes | null;
        pinky: RingSizes | null;
    };

    // Facteur d'échelle pour le squelette 3D
    skeletonScaleFactor: number;

    // Dimensions vidéo pour calcul FOV
    videoDimensions: { width: number; height: number } | null;

    // FOV calculé (en degrés)
    calculatedFOV: {
        horizontal: number;
        vertical: number;
        focalLengthPx: number;
    } | null;

    // État
    isCalibrated: boolean;
    isCalibrating: boolean;

    // Actions
    setCurrentStep: (step: number) => void;
    setCloseCardCalibration: (cardWidthPx: number) => void;
    setCloseHandMeasurements: (measurements: HandMeasurements) => void;
    setFarCardCalibration: (cardWidthPx: number) => void;
    setFarHandMeasurements: (measurements: HandMeasurements) => void;
    setVideoDimensions: (width: number, height: number) => void;
    completeCalibration: () => void;
    resetCalibration: () => void;
    setIsCalibrating: (value: boolean) => void;

    // Getters
    getFingerSize: (finger: 'index' | 'middle' | 'ring' | 'pinky') => RingSizes | null;
}

// =============================================================================
// CONSTANTES
// =============================================================================

// Dimensions carte bancaire standard ISO/IEC 7810 ID-1
const CREDIT_CARD_WIDTH_MM = 85.6;
const CREDIT_CARD_HEIGHT_MM = 53.98;

// Distances de calibration (en mm)
const CLOSE_DISTANCE_MM = 200; // 20cm
const FAR_DISTANCE_MM = 400;   // 40cm

// Conversion US ring size
const US_SIZE_OFFSET = 36.5;
const US_SIZE_DIVISOR = 2.55;

// UK sizes (approximation basée sur circonférence)
const UK_SIZES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// =============================================================================
// HELPERS
// =============================================================================

function circumferenceToRingSizes(circumferenceMm: number): RingSizes {
    const eu = Math.round(circumferenceMm);
    const us = Math.round(((circumferenceMm - US_SIZE_OFFSET) / US_SIZE_DIVISOR) * 2) / 2; // arrondi au 0.5

    // UK: approximation (commence à ~37mm pour A, +1.25mm par taille)
    const ukIndex = Math.max(0, Math.min(25, Math.round((circumferenceMm - 37) / 1.25)));
    const uk = UK_SIZES[ukIndex] || 'M';

    return {
        circumferenceMm,
        eu,
        us: Math.max(0, us),
        uk,
    };
}

/**
 * Calcule la circonférence d'une ellipse (approximation de Ramanujan)
 * C ≈ π * (3(a+b) - √((3a+b)(a+3b)))
 * où a et b sont les demi-axes
 */
function ellipseCircumference(width: number, depth: number): number {
    const a = width / 2;
    const b = depth / 2;
    // Formule de Ramanujan (très précise pour ellipses pas trop excentriques)
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

// =============================================================================
// STORE
// =============================================================================

export const useCalibrationStore = create<CalibrationState>()(
    persist(
        (set, get) => ({
            currentStep: 0,
            closeDistance: null,
            farDistance: null,
            finalFingerSizes: {
                index: null,
                middle: null,
                ring: null,
                pinky: null,
            },
            skeletonScaleFactor: 1.0,
            videoDimensions: null,
            calculatedFOV: null,
            isCalibrated: false,
            isCalibrating: false,

            setCurrentStep: (step) => set({ currentStep: step }),

            setCloseCardCalibration: (cardWidthPx) => set({
                closeDistance: {
                    cardWidthPx,
                    pixelsPerMm: cardWidthPx / CREDIT_CARD_WIDTH_MM,
                    handMeasurements: get().closeDistance?.handMeasurements ?? null,
                },
            }),

            setCloseHandMeasurements: (measurements) => {
                const current = get().closeDistance;
                if (!current) return;

                set({
                    closeDistance: {
                        ...current,
                        handMeasurements: measurements,
                    },
                });
            },

            setFarCardCalibration: (cardWidthPx) => set({
                farDistance: {
                    cardWidthPx,
                    pixelsPerMm: cardWidthPx / CREDIT_CARD_WIDTH_MM,
                    handMeasurements: get().farDistance?.handMeasurements ?? null,
                },
            }),

            setFarHandMeasurements: (measurements) => {
                const current = get().farDistance;
                if (!current) return;

                set({
                    farDistance: {
                        ...current,
                        handMeasurements: measurements,
                    },
                });
            },

            setVideoDimensions: (width, height) => set({
                videoDimensions: { width, height },
            }),

            completeCalibration: () => {
                const { closeDistance, farDistance } = get();

                const closeMeasurements = closeDistance?.handMeasurements;
                const farMeasurements = farDistance?.handMeasurements;

                if (!closeMeasurements && !farMeasurements) {
                    return;
                }

                // Fonction helper pour moyenner les tailles de bagues
                const averageRingSizes = (
                    close: RingSizes | null | undefined,
                    far: RingSizes | null | undefined
                ): RingSizes | null => {
                    if (!close && !far) return null;
                    if (!close) return far!;
                    if (!far) return close;

                    // Moyenne des deux mesures
                    const avgCircumference = (close.circumferenceMm + far.circumferenceMm) / 2;
                    return circumferenceToRingSizes(avgCircumference);
                };

                // Calculer les tailles finales en moyennant 20cm et 40cm
                const finalSizes = {
                    index: averageRingSizes(closeMeasurements?.index?.ringSizes, farMeasurements?.index?.ringSizes),
                    middle: averageRingSizes(closeMeasurements?.middle?.ringSizes, farMeasurements?.middle?.ringSizes),
                    ring: averageRingSizes(closeMeasurements?.ring?.ringSizes, farMeasurements?.ring?.ringSizes),
                    pinky: averageRingSizes(closeMeasurements?.pinky?.ringSizes, farMeasurements?.pinky?.ringSizes),
                };

                // Calculer le facteur d'échelle pour le squelette
                let scaleFactor = 1.0;
                if (closeDistance && farDistance && farDistance.cardWidthPx > 0) {
                    const distanceRatio = closeDistance.cardWidthPx / farDistance.cardWidthPx;
                    scaleFactor = distanceRatio;
                }

                // Calcul du FOV à partir de la focal length
                let fovData: { horizontal: number; vertical: number; focalLengthPx: number } | null = null;

                if (closeDistance && farDistance) {
                    const focalClose = (closeDistance.cardWidthPx * CLOSE_DISTANCE_MM) / CREDIT_CARD_WIDTH_MM;
                    const focalFar = (farDistance.cardWidthPx * FAR_DISTANCE_MM) / CREDIT_CARD_WIDTH_MM;
                    const focalAvg = (focalClose + focalFar) / 2;

                    // Calculer le FOV si on a les dimensions vidéo
                    const videoDims = get().videoDimensions;
                    if (videoDims && focalAvg > 0) {
                        // FOV = 2 * atan((dimension / 2) / focalLength) * (180 / PI)
                        const fovHorizontal = 2 * Math.atan((videoDims.width / 2) / focalAvg) * (180 / Math.PI);
                        const fovVertical = 2 * Math.atan((videoDims.height / 2) / focalAvg) * (180 / Math.PI);

                        fovData = {
                            horizontal: Math.round(fovHorizontal * 10) / 10,
                            vertical: Math.round(fovVertical * 10) / 10,
                            focalLengthPx: Math.round(focalAvg),
                        };
                    }
                }

                set({
                    finalFingerSizes: finalSizes,
                    skeletonScaleFactor: scaleFactor,
                    calculatedFOV: fovData,
                    isCalibrated: true,
                    isCalibrating: false,
                    currentStep: 5,
                });
            },

            resetCalibration: () => set({
                currentStep: 0,
                closeDistance: null,
                farDistance: null,
                finalFingerSizes: {
                    index: null,
                    middle: null,
                    ring: null,
                    pinky: null,
                },
                skeletonScaleFactor: 1.0,
                videoDimensions: null,
                calculatedFOV: null,
                isCalibrated: false,
                isCalibrating: false,
            }),

            setIsCalibrating: (value) => set({
                isCalibrating: value,
                currentStep: value ? 1 : get().currentStep,
            }),

            getFingerSize: (finger) => {
                return get().finalFingerSizes[finger];
            },
        }),
        {
            name: 'ar-jewel-calibration-v2',
        }
    )
);

// =============================================================================
// EXPORTS UTILITAIRES
// =============================================================================

export {
    CREDIT_CARD_WIDTH_MM,
    CREDIT_CARD_HEIGHT_MM,
    ellipseCircumference,
    circumferenceToRingSizes,
};
