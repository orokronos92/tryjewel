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

    // État
    isCalibrated: boolean;
    isCalibrating: boolean;

    // Actions
    setCurrentStep: (step: number) => void;
    setCloseCardCalibration: (cardWidthPx: number) => void;
    setCloseHandMeasurements: (measurements: HandMeasurements) => void;
    setFarCardCalibration: (cardWidthPx: number) => void;
    setFarHandMeasurements: (measurements: HandMeasurements) => void;
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

            completeCalibration: () => {
                const { closeDistance, farDistance } = get();

                // Utiliser les mesures proches comme référence principale
                // (plus précises car plus grande dans l'image)
                const closeMeasurements = closeDistance?.handMeasurements;

                if (!closeMeasurements) {
                    console.warn('[Calibration] Pas de mesures de main disponibles');
                    return;
                }

                // Calculer le facteur d'échelle pour le squelette
                // basé sur le ratio entre les deux distances
                let scaleFactor = 1.0;
                if (closeDistance && farDistance && farDistance.cardWidthPx > 0) {
                    // Ratio entre les deux distances
                    const distanceRatio = closeDistance.cardWidthPx / farDistance.cardWidthPx;
                    // Le facteur d'échelle sera utilisé pour ajuster le squelette
                    scaleFactor = distanceRatio;
                }

                // =====================================================================
                // LOGS Z CALIBRATION - Calcul de la focal length et estimation Z
                // =====================================================================
                console.log('═══════════════════════════════════════════════════════════');
                console.log('[Z-Calibration] 📐 CALCUL DE PROFONDEUR');
                console.log('═══════════════════════════════════════════════════════════');

                if (closeDistance && farDistance) {
                    // Focal length calculée depuis chaque distance
                    // f = (cardWidthPx * distance_mm) / CREDIT_CARD_WIDTH_MM
                    const focalClose = (closeDistance.cardWidthPx * CLOSE_DISTANCE_MM) / CREDIT_CARD_WIDTH_MM;
                    const focalFar = (farDistance.cardWidthPx * FAR_DISTANCE_MM) / CREDIT_CARD_WIDTH_MM;
                    const focalAvg = (focalClose + focalFar) / 2;

                    console.log('[Z-Calibration] Carte à 20cm:', {
                        cardWidthPx: closeDistance.cardWidthPx.toFixed(1),
                        pixelsPerMm: closeDistance.pixelsPerMm.toFixed(3),
                        focalLength: focalClose.toFixed(1),
                    });

                    console.log('[Z-Calibration] Carte à 40cm:', {
                        cardWidthPx: farDistance.cardWidthPx.toFixed(1),
                        pixelsPerMm: farDistance.pixelsPerMm.toFixed(3),
                        focalLength: focalFar.toFixed(1),
                    });

                    // Vérification : le ratio devrait être ~2 (40cm / 20cm)
                    const actualRatio = closeDistance.cardWidthPx / farDistance.cardWidthPx;
                    const expectedRatio = FAR_DISTANCE_MM / CLOSE_DISTANCE_MM; // 2.0

                    console.log('[Z-Calibration] Vérification ratio:', {
                        actual: actualRatio.toFixed(3),
                        expected: expectedRatio.toFixed(1),
                        ecart: ((actualRatio - expectedRatio) / expectedRatio * 100).toFixed(1) + '%',
                    });

                    console.log('[Z-Calibration] 🎯 Focal length moyenne:', focalAvg.toFixed(1), 'pixels');

                    // Calcul du FOV horizontal estimé
                    // FOV = 2 * atan((sensorWidth / 2) / focalLength)
                    // Approximation : sensorWidth ≈ cardWidthPx à distance connue
                    const fovRadians = 2 * Math.atan((closeDistance.cardWidthPx / 2) / focalClose);
                    const fovDegrees = fovRadians * (180 / Math.PI);

                    console.log('[Z-Calibration] 📷 FOV horizontal estimé:', fovDegrees.toFixed(1) + '°');

                    // Formule pour utilisation temps réel :
                    console.log('[Z-Calibration] 💡 Formule temps réel:');
                    console.log('   Z_mm = (tailleReelleMm * ' + focalAvg.toFixed(0) + ') / taillePixels');

                    // Exemple avec la main calibrée
                    if (closeMeasurements) {
                        const handWidthMm = closeMeasurements.handWidthPx / closeDistance.pixelsPerMm;
                        console.log('[Z-Calibration] 🖐️ Main calibrée:', {
                            largeurPx: closeMeasurements.handWidthPx.toFixed(0),
                            largeurMm: handWidthMm.toFixed(1),
                            hauteurPx: closeMeasurements.handHeightPx.toFixed(0),
                        });
                    }
                }

                console.log('═══════════════════════════════════════════════════════════');

                set({
                    finalFingerSizes: {
                        index: closeMeasurements.index?.ringSizes ?? null,
                        middle: closeMeasurements.middle?.ringSizes ?? null,
                        ring: closeMeasurements.ring?.ringSizes ?? null,
                        pinky: closeMeasurements.pinky?.ringSizes ?? null,
                    },
                    skeletonScaleFactor: scaleFactor,
                    isCalibrated: true,
                    isCalibrating: false,
                    currentStep: 5,
                });

                console.log('[Calibration] ✅ Calibration terminée:', {
                    index: closeMeasurements.index?.ringSizes,
                    middle: closeMeasurements.middle?.ringSizes,
                    ring: closeMeasurements.ring?.ringSizes,
                    pinky: closeMeasurements.pinky?.ringSizes,
                    scaleFactor,
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
