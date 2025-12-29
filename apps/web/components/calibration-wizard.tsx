"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
    useCalibrationStore,
    CREDIT_CARD_WIDTH_MM,
    CREDIT_CARD_HEIGHT_MM,
    HandMeasurements,
    FingerMeasurement,
    ellipseCircumference,
    circumferenceToRingSizes,
} from "@/stores/calibration-store";
import { useEdgeTrackingStore } from "@/stores/edge-tracking-store";
import { Button } from "@/components/ui/button";
import { Hand, Check, X, ChevronRight, Loader2 } from "lucide-react";

// Ratio profondeur/largeur pour les doigts (ellipse, doigt vu de face vs profil)
const FINGER_DEPTH_RATIO = 0.85;

// Dimensions anatomiques moyennes d'une main adulte (en mm)
// Largeur paume MCP→MCP (index à pinky) ≈ 70mm (pas 85mm qui est la paume complète)
const PALM_WIDTH_MM = 70;

// Indices des landmarks MCP (base des doigts) - MediaPipe
const MCP_LANDMARKS = {
    index: 5,
    middle: 9,
    ring: 13,
    pinky: 17,
};

// Tolérance pour la détection de distance (±5%)
const DISTANCE_TOLERANCE = 0.05;

// =============================================================================
// TYPES
// =============================================================================

interface CalibrationWizardProps {
    onClose: () => void;
    containerWidth: number;
    containerHeight: number;
    videoElement: HTMLVideoElement | null;
}

interface StepConfig {
    icon: React.ReactNode;
    title: string;
    instruction: string;
    distance: 'close' | 'far';
}

// =============================================================================
// CONSTANTES
// =============================================================================

// FOV standard assumé pour les webcams (65° est une bonne moyenne)
const ASSUMED_FOV_DEG = 65;

// Réduction du cadre de 30% pour mieux correspondre à la réalité
const FRAME_SIZE_FACTOR = 0.7;

// Calcul de la taille du cadre carte à une distance donnée
// visibleWidth = 2 × distance × tan(FOV/2)
// cardPixels = (cardWidthMM / visibleWidth) × videoWidth
function calculateCardFrameSize(distanceMm: number, videoWidth: number, fovDeg: number = ASSUMED_FOV_DEG): number {
    const fovRad = (fovDeg * Math.PI) / 180;
    const visibleWidthMm = 2 * distanceMm * Math.tan(fovRad / 2);
    return (CREDIT_CARD_WIDTH_MM / visibleWidthMm) * videoWidth * FRAME_SIZE_FACTOR;
}

const STEPS: StepConfig[] = [
    {
        icon: <Hand className="h-5 w-5" />,
        title: "Main (20cm)",
        instruction: "Placez votre main ouverte à ~20cm de la caméra dans le cadre",
        distance: 'close',
    },
    {
        icon: <Hand className="h-5 w-5" />,
        title: "Main (40cm)",
        instruction: "Reculez à ~40cm et placez votre main dans le cadre",
        distance: 'far',
    },
];


// =============================================================================
// COMPONENT
// =============================================================================

export function CalibrationWizard({
    onClose,
    containerWidth,
    containerHeight,
    videoElement,
}: CalibrationWizardProps) {
    const {
        currentStep,
        setCurrentStep,
        setCloseCardCalibration,
        setCloseHandMeasurements,
        setFarCardCalibration,
        setFarHandMeasurements,
        setVideoDimensions,
        completeCalibration,
    } = useCalibrationStore();

    // Accès aux landmarks MediaPipe
    const tracking = useEdgeTrackingStore((state) => state.tracking);
    const landmarks = tracking.last_result?.hand_result?.landmarks;

    // État pour la détection de main
    const [detectedPalmWidthPx, setDetectedPalmWidthPx] = useState<number | null>(null);
    const [isHandInFrame, setIsHandInFrame] = useState(false);
    const [capturedLandmarks, setCapturedLandmarks] = useState<typeof landmarks | null>(null);
    const [stabilityCounter, setStabilityCounter] = useState(0);

    // Fonction pour calculer la distance entre deux landmarks en pixels
    const getLandmarkDistancePx = (
        lm: typeof landmarks,
        idx1: number,
        idx2: number
    ): number => {
        if (!lm || lm.length < 21) return 0;
        const dx = (lm[idx1].x - lm[idx2].x) * containerWidth;
        const dy = (lm[idx1].y - lm[idx2].y) * containerHeight;
        return Math.sqrt(dx * dx + dy * dy);
    };

    // Fonction pour calculer les mesures d'un doigt à partir des landmarks réels
    const calculateFingerMeasurementFromLandmarks = (
        fingerName: 'index' | 'middle' | 'ring' | 'pinky',
        lm: typeof landmarks,
        pixelsPerMm: number
    ): FingerMeasurement => {
        if (!lm || lm.length < 21) {
            return {
                widthPx: 0,
                widthMm: 0,
                depthMm: 0,
                circumferenceMm: 0,
                ringSizes: { circumferenceMm: 0, eu: 0, us: 0, uk: 'M' },
            };
        }

        // Calculer la largeur du doigt basée sur l'espacement inter-MCP
        // La largeur d'un doigt ≈ distance entre son MCP et le MCP adjacent
        let widthPx: number;

        switch (fingerName) {
            case 'index':
                // Largeur index ≈ distance index-middle MCP (le doigt occupe quasi tout l'espace)
                widthPx = getLandmarkDistancePx(lm, MCP_LANDMARKS.index, MCP_LANDMARKS.middle) * 0.95;
                break;
            case 'middle':
                // Largeur middle ≈ moyenne des espaces adjacents
                widthPx = (
                    getLandmarkDistancePx(lm, MCP_LANDMARKS.index, MCP_LANDMARKS.middle) +
                    getLandmarkDistancePx(lm, MCP_LANDMARKS.middle, MCP_LANDMARKS.ring)
                ) * 0.55;
                break;
            case 'ring':
                // Largeur ring ≈ moyenne des espaces adjacents
                widthPx = (
                    getLandmarkDistancePx(lm, MCP_LANDMARKS.middle, MCP_LANDMARKS.ring) +
                    getLandmarkDistancePx(lm, MCP_LANDMARKS.ring, MCP_LANDMARKS.pinky)
                ) * 0.55;
                break;
            case 'pinky':
                // Largeur pinky ≈ distance ring-pinky MCP
                widthPx = getLandmarkDistancePx(lm, MCP_LANDMARKS.ring, MCP_LANDMARKS.pinky) * 0.85;
                break;
        }

        // Convertir en mm avec le pixelsPerMm calibré
        const widthMm = widthPx / pixelsPerMm;
        const depthMm = widthMm * FINGER_DEPTH_RATIO;
        const circumferenceMm = ellipseCircumference(widthMm, depthMm);
        const ringSizes = circumferenceToRingSizes(circumferenceMm);

        console.log(`[Calibration] 📐 ${fingerName}:`, {
            widthPx: widthPx.toFixed(1),
            widthMm: widthMm.toFixed(1),
            depthMm: depthMm.toFixed(1),
            circumferenceMm: circumferenceMm.toFixed(1),
            euSize: ringSizes.eu,
        });

        return {
            widthPx,
            widthMm,
            depthMm,
            circumferenceMm,
            ringSizes,
        };
    };

    // Index de l'étape (0 ou 1 pour les 2 étapes)
    const stepIndex = Math.max(0, Math.min(1, currentStep - 1));
    const step = STEPS[stepIndex];

    // Debug log
    console.log('[CalibrationWizard] 🎯 Render:', { currentStep, stepIndex, stepTitle: step.title });

    // ==========================================================================
    // CALCUL DU CADRE DE RÉFÉRENCE (basé sur FOV assumé)
    // Le cadre représente la taille d'une carte bancaire à la distance donnée
    // ==========================================================================
    const distanceMm = step.distance === 'close' ? 200 : 400; // 20cm ou 40cm

    const referenceFrameWidth = useMemo(() => {
        const videoWidth = videoElement?.videoWidth || containerWidth;
        return calculateCardFrameSize(distanceMm, videoWidth, ASSUMED_FOV_DEG);
    }, [distanceMm, videoElement?.videoWidth, containerWidth]);

    const referenceFrameHeight = useMemo(() => {
        return referenceFrameWidth / (CREDIT_CARD_WIDTH_MM / CREDIT_CARD_HEIGHT_MM);
    }, [referenceFrameWidth]);

    // pixelsPerMm calculé depuis le cadre de référence
    // Le cadre représente CREDIT_CARD_WIDTH_MM (85.6mm)
    const currentPixelsPerMm = referenceFrameWidth / CREDIT_CARD_WIDTH_MM;

    // ⚡ FIX: Synchroniser le store si currentStep est invalide
    useEffect(() => {
        if (currentStep < 1) {
            console.log('[CalibrationWizard] ⚠️ currentStep invalide, correction à 1');
            setCurrentStep(1);
        }
    }, [currentStep, setCurrentStep]);

    // 📷 Stocker les dimensions vidéo pour le calcul du FOV
    useEffect(() => {
        if (videoElement && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
            setVideoDimensions(videoElement.videoWidth, videoElement.videoHeight);
            console.log('[Calibration] 📹 Dimensions vidéo enregistrées:', `${videoElement.videoWidth}x${videoElement.videoHeight}`);
        }
    }, [videoElement, setVideoDimensions]);

    // Taille attendue de la paume à cette distance
    // Paume ≈ 70mm, cadre représente 85.6mm de carte
    const expectedPalmWidthPx = PALM_WIDTH_MM * currentPixelsPerMm;

    // ==========================================================================
    // DÉTECTION MEDIAPIPE - Vérification que la main est dans le cadre (±20%)
    // ==========================================================================
    useEffect(() => {
        if (!landmarks || landmarks.length < 21) {
            setDetectedPalmWidthPx(null);
            setIsHandInFrame(false);
            return;
        }

        // Largeur paume = distance entre index MCP (5) et pinky MCP (17)
        const indexMcp = landmarks[5];
        const pinkyMcp = landmarks[17];

        const dx = (indexMcp.x - pinkyMcp.x) * containerWidth;
        const dy = (indexMcp.y - pinkyMcp.y) * containerHeight;
        const palmWidth = Math.sqrt(dx * dx + dy * dy);

        setDetectedPalmWidthPx(palmWidth);

        // Vérifier si la main est à la bonne distance (±5%)
        const ratio = palmWidth / expectedPalmWidthPx;
        const isInFrame = ratio >= (1 - DISTANCE_TOLERANCE) && ratio <= (1 + DISTANCE_TOLERANCE);

        console.log('[Calibration] 📏 Main détectée:', {
            palmWidthPx: palmWidth.toFixed(1),
            expectedPx: expectedPalmWidthPx.toFixed(1),
            ratio: ratio.toFixed(3),
            tolerance: `±${DISTANCE_TOLERANCE * 100}%`,
            isInFrame,
        });

        if (isInFrame) {
            // Incrémenter le compteur de stabilité
            setStabilityCounter(prev => Math.min(prev + 1, 20));
        } else {
            // Réduire si hors zone
            setStabilityCounter(prev => Math.max(prev - 2, 0));
        }

        // Valider après 10 frames stables (~0.8 sec)
        if (stabilityCounter >= 10) {
            setIsHandInFrame(true);

            // Capturer les landmarks quand stable
            if (!capturedLandmarks) {
                setCapturedLandmarks([...landmarks]);
                console.log('[Calibration] ✅ Main capturée!', {
                    palmWidthPx: palmWidth.toFixed(1),
                    pixelsPerMm: currentPixelsPerMm.toFixed(3),
                    palmWidthMm: (palmWidth / currentPixelsPerMm).toFixed(1),
                });
            }
        } else {
            setIsHandInFrame(false);
        }
    }, [landmarks, expectedPalmWidthPx, containerWidth, containerHeight, stabilityCounter, capturedLandmarks, currentPixelsPerMm]);

    // Reset quand on change d'étape
    useEffect(() => {
        setDetectedPalmWidthPx(null);
        setIsHandInFrame(false);
        setCapturedLandmarks(null);
        setStabilityCounter(0);
    }, [currentStep]);

    // Confirmer l'étape actuelle
    const handleConfirm = () => {
        // Utiliser les landmarks capturés par MediaPipe
        if (!capturedLandmarks || !detectedPalmWidthPx) {
            console.warn('[Calibration] ⚠️ Pas de landmarks capturés');
            return;
        }

        // D'abord, enregistrer la calibration "carte" basée sur le cadre de référence
        // Cela permet de maintenir la compatibilité avec le store existant
        if (step.distance === 'close') {
            setCloseCardCalibration(referenceFrameWidth);
        } else {
            setFarCardCalibration(referenceFrameWidth);
        }

        // Calculer la hauteur de main approximative
        const wrist = capturedLandmarks[0];
        const middleTip = capturedLandmarks[12];
        const handHeightPx = Math.sqrt(
            Math.pow((middleTip.x - wrist.x) * containerWidth, 2) +
            Math.pow((middleTip.y - wrist.y) * containerHeight, 2)
        );

        // La largeur de paume détectée par MediaPipe, convertie en mm
        // pixelsPerMm est calculé depuis le cadre de référence
        const palmWidthMm = detectedPalmWidthPx / currentPixelsPerMm;

        console.log('[Calibration] 📏 Mesures main:', {
            distance: step.distance,
            referenceFrameWidthPx: referenceFrameWidth.toFixed(1),
            pixelsPerMm: currentPixelsPerMm.toFixed(3),
            palmWidthPx: detectedPalmWidthPx.toFixed(1),
            palmWidthMm: palmWidthMm.toFixed(1),
            handHeightPx: handHeightPx.toFixed(1),
        });

        // Calculer les mesures de chaque doigt à partir des VRAIS landmarks
        const handMeasurements: HandMeasurements = {
            handWidthPx: detectedPalmWidthPx,
            handHeightPx,
            index: calculateFingerMeasurementFromLandmarks('index', capturedLandmarks, currentPixelsPerMm),
            middle: calculateFingerMeasurementFromLandmarks('middle', capturedLandmarks, currentPixelsPerMm),
            ring: calculateFingerMeasurementFromLandmarks('ring', capturedLandmarks, currentPixelsPerMm),
            pinky: calculateFingerMeasurementFromLandmarks('pinky', capturedLandmarks, currentPixelsPerMm),
        };

        console.log('[Calibration] 💍 Tailles bagues:', {
            index: handMeasurements.index?.ringSizes.eu,
            middle: handMeasurements.middle?.ringSizes.eu,
            ring: handMeasurements.ring?.ringSizes.eu,
            pinky: handMeasurements.pinky?.ringSizes.eu,
        });

        if (step.distance === 'close') {
            setCloseHandMeasurements(handMeasurements);
        } else {
            setFarHandMeasurements(handMeasurements);
        }

        // Passer à l'étape suivante ou terminer (2 étapes maintenant)
        if (currentStep < 2) {
            setCurrentStep(currentStep + 1);
        } else {
            // Calculer et logger le FOV réel avant de terminer
            if (videoElement?.videoWidth) {
                const visibleWidthMm = (videoElement.videoWidth / referenceFrameWidth) * CREDIT_CARD_WIDTH_MM;
                const calculatedFov = 2 * Math.atan(visibleWidthMm / (2 * distanceMm)) * (180 / Math.PI);
                console.log('[Calibration] 📐 FOV calculé:', {
                    assumedFov: ASSUMED_FOV_DEG,
                    calculatedFov: calculatedFov.toFixed(1),
                    visibleWidthMm: visibleWidthMm.toFixed(1),
                    distanceMm,
                });
            }
            completeCalibration();
            onClose();
        }
    };

    // Rendu des indicateurs de progression
    const renderStepIndicators = () => (
        <div className="flex items-center justify-center gap-2 mb-4">
            {STEPS.map((s, idx) => {
                const isCompleted = idx < stepIndex;
                const isCurrent = idx === stepIndex;

                return (
                    <div key={idx} className="flex items-center">
                        <div
                            className={`
                                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                                transition-all duration-200
                                ${isCompleted ? 'bg-green-500 text-white' : ''}
                                ${isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-300' : ''}
                                ${!isCompleted && !isCurrent ? 'bg-gray-600 text-gray-400' : ''}
                            `}
                        >
                            {isCompleted ? <Check className="h-4 w-4" /> : s.icon}
                        </div>
                        {idx < STEPS.length - 1 && (
                            <div className={`w-8 h-0.5 mx-1 ${isCompleted ? 'bg-green-500' : 'bg-gray-600'}`} />
                        )}
                    </div>
                );
            })}
        </div>
    );

    // Rendu du contenu - Main avec cadre de référence
    const renderStepContent = () => {
        if (!step) return null;

        const isDetecting = !!landmarks && landmarks.length >= 21;

        // Cercle guide autour du cadre (légèrement plus grand)
        const circleSize = Math.max(referenceFrameWidth, referenceFrameHeight) * 1.4;

        // Ratio détecté vs attendu
        const distanceRatio = detectedPalmWidthPx && expectedPalmWidthPx
            ? detectedPalmWidthPx / expectedPalmWidthPx
            : null;

        // Couleur selon l'état
        const getCircleColor = () => {
            if (isHandInFrame) return 'rgb(34, 197, 94)'; // green-500
            if (distanceRatio && distanceRatio >= (1 - DISTANCE_TOLERANCE) && distanceRatio <= (1 + DISTANCE_TOLERANCE)) {
                return 'rgb(234, 179, 8)'; // yellow-500 (dans la zone, stabilisation)
            }
            if (isDetecting) return 'rgb(239, 68, 68)'; // red-500 (hors zone)
            return 'rgb(59, 130, 246)'; // blue-500
        };

        // Message de guidance
        const getGuidanceMessage = () => {
            if (!isDetecting) return null;
            if (isHandInFrame) return null;
            if (!distanceRatio) return null;

            if (distanceRatio < (1 - DISTANCE_TOLERANCE)) {
                return { text: 'Rapprochez-vous', color: 'text-red-400' };
            } else if (distanceRatio > (1 + DISTANCE_TOLERANCE)) {
                return { text: 'Éloignez-vous', color: 'text-red-400' };
            } else {
                return { text: 'Maintenez...', color: 'text-yellow-400' };
            }
        };

        const guidance = getGuidanceMessage();

        return (
            <div className="relative w-full h-full flex flex-col">
                {/* Zone centrale */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden">
                    {/* Cercle guide (autour du cadre carte) */}
                    <div
                        className="absolute rounded-full border-4 border-dashed transition-all duration-300"
                        style={{
                            width: circleSize,
                            height: circleSize,
                            borderColor: getCircleColor(),
                            opacity: 0.6,
                        }}
                    />

                    {/* Cadre de référence (représente une carte à cette distance) */}
                    <div
                        className="border-2 border-dashed border-cyan-400/60 bg-cyan-500/10 relative rounded-lg"
                        style={{
                            width: referenceFrameWidth,
                            height: referenceFrameHeight,
                        }}
                    >
                        {/* Label: taille de référence */}
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black/70 px-2 py-0.5 rounded text-xs font-mono text-cyan-400">
                            {CREDIT_CARD_WIDTH_MM}mm @ {step.distance === 'close' ? '20' : '40'}cm
                        </div>

                        {/* Coins décoratifs */}
                        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-cyan-400/60 rounded-tl" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-cyan-400/60 rounded-tr" />
                        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-cyan-400/60 rounded-bl" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-cyan-400/60 rounded-br" />
                    </div>

                    {/* Indicateur d'état au-dessus */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg">
                        {!isDetecting ? (
                            <div className="flex items-center gap-2">
                                <Hand className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-400 text-sm">Montrez votre main ouverte</span>
                            </div>
                        ) : isHandInFrame ? (
                            <div className="flex items-center gap-2">
                                <Check className="w-5 h-5 text-green-500" />
                                <span className="text-green-400 text-sm">Main capturée!</span>
                            </div>
                        ) : guidance ? (
                            <div className="flex flex-col items-center gap-1">
                                <div className="flex items-center gap-2">
                                    <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                                    <span className={`text-sm font-medium ${guidance.color}`}>{guidance.text}</span>
                                </div>
                                {distanceRatio && (
                                    <span className="text-xs text-gray-500">
                                        {(distanceRatio * 100).toFixed(0)}% (cible: {((1 - DISTANCE_TOLERANCE) * 100).toFixed(0)}-{((1 + DISTANCE_TOLERANCE) * 100).toFixed(0)}%)
                                    </span>
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                                <span className="text-yellow-400 text-sm">Détection...</span>
                            </div>
                        )}
                    </div>

                    {/* Barre de progression de stabilité */}
                    {isDetecting && !isHandInFrame && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-48">
                            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-green-500 h-full transition-all duration-100"
                                    style={{ width: `${(stabilityCounter / 10) * 100}%` }}
                                />
                            </div>
                            <p className="text-xs text-center text-gray-400 mt-1">
                                Maintenez la position...
                            </p>
                        </div>
                    )}
                </div>

                {/* Instructions en bas */}
                <div className="bg-black/70 p-4 rounded-t-lg">
                    <p className="text-center text-gray-300">
                        {step.distance === 'close'
                            ? "Placez votre main ouverte à ~20cm de la caméra"
                            : "Reculez à ~40cm et placez votre main ouverte"
                        }
                    </p>
                    <p className="text-center text-xs text-gray-500 mt-1">
                        Le cadre cyan représente {CREDIT_CARD_WIDTH_MM}mm à cette distance
                    </p>
                </div>
            </div>
        );
    };

    if (!step) return null;

    return (
        <div className="absolute inset-0 z-50 flex flex-col text-white">
            {/* Header - fond semi-transparent */}
            <div className="p-4 flex items-center justify-between bg-black/70">
                <div className="flex items-center gap-2">
                    {step.icon}
                    <span className="text-sm text-gray-300">Calibration</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-white hover:bg-white/20 rounded-full"
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Titre de l'étape - fond semi-transparent */}
            <div className="px-4 py-2 bg-black/70">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    {step.icon}
                    Étape {currentStep}/2 : {step.title}
                </h2>
                <p className="text-sm text-gray-300 mt-1">
                    {step.instruction}
                </p>
                {/* Indicateurs de progression */}
                <div className="mt-3">
                    {renderStepIndicators()}
                </div>
            </div>

            {/* Contenu principal - TRANSPARENT pour voir la caméra */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
                {renderStepContent()}
            </div>

            {/* Footer avec bouton - fond semi-transparent */}
            <div className="bg-black/70 p-4 space-y-2">
                {/* Infos caméra */}
                <div className="text-xs text-gray-400 flex gap-4 justify-center">
                    <span>{videoElement?.videoWidth || 0}×{videoElement?.videoHeight || 0}</span>
                    <span>•</span>
                    <span>Caméra frontale</span>
                </div>

                {/* Bouton confirmer */}
                {(() => {
                    const isDisabled = !isHandInFrame;
                    const waitingMessage = 'En attente de la main...';

                    return (
                        <Button
                            onClick={handleConfirm}
                            disabled={isDisabled}
                            className={`w-full py-5 text-lg ${
                                isDisabled
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 hover:bg-green-700 text-white'
                            }`}
                        >
                            {isDisabled ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    {waitingMessage}
                                </>
                            ) : (
                                <>
                                    Confirmer
                                    <ChevronRight className="ml-2 h-5 w-5" />
                                </>
                            )}
                        </Button>
                    );
                })()}
            </div>
        </div>
    );
}
