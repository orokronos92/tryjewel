"use client";

import { useState, useEffect, useCallback } from "react";
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
import { CreditCard, Hand, Check, X, ChevronRight, Loader2 } from "lucide-react";

// Ratio profondeur/largeur pour les doigts (ellipse, doigt vu de face vs profil)
const FINGER_DEPTH_RATIO = 0.85;

// Dimensions anatomiques moyennes d'une main adulte (en mm)
// Largeur paume (entre index MCP et pinky MCP) ≈ 85mm
const PALM_WIDTH_MM = 85;

// Indices des landmarks MCP (base des doigts) - MediaPipe
const MCP_LANDMARKS = {
    index: 5,
    middle: 9,
    ring: 13,
    pinky: 17,
};

// Tolérance pour la détection de distance (±15%)
const DISTANCE_TOLERANCE = 0.15;

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
    type: 'card' | 'hand';
    distance: 'close' | 'far';
}

// =============================================================================
// CONSTANTES
// =============================================================================

const STEPS: StepConfig[] = [
    {
        icon: <CreditCard className="h-5 w-5" />,
        title: "Carte (20cm)",
        instruction: "Placez une carte bancaire à 20cm de la caméra et ajustez le cadre",
        type: 'card',
        distance: 'close',
    },
    {
        icon: <Hand className="h-5 w-5" />,
        title: "Main (20cm)",
        instruction: "Gardez la même distance (20cm) et ajustez le contour à votre main",
        type: 'hand',
        distance: 'close',
    },
    {
        icon: <CreditCard className="h-5 w-5" />,
        title: "Carte (40cm)",
        instruction: "Reculez à 40cm et ajustez le cadre à la carte",
        type: 'card',
        distance: 'far',
    },
    {
        icon: <Hand className="h-5 w-5" />,
        title: "Main (40cm)",
        instruction: "Gardez la distance (40cm) et ajustez le contour à votre main",
        type: 'hand',
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
        closeDistance,
        farDistance,
        setCloseCardCalibration,
        setCloseHandMeasurements,
        setFarCardCalibration,
        setFarHandMeasurements,
        completeCalibration,
    } = useCalibrationStore();

    // Accès aux landmarks MediaPipe
    const tracking = useEdgeTrackingStore((state) => state.tracking);
    const landmarks = tracking.last_result?.hand_result?.landmarks;

    // État pour la détection de main
    const [detectedPalmWidthPx, setDetectedPalmWidthPx] = useState<number | null>(null);
    const [isHandAtCorrectDistance, setIsHandAtCorrectDistance] = useState(false);
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

    // ⚡ FIX: Toujours utiliser un index valide (0-3)
    // Si currentStep est 0 ou invalide, on force l'affichage de l'étape 1
    const stepIndex = Math.max(0, Math.min(3, currentStep - 1));
    const step = STEPS[stepIndex];

    // Debug log
    console.log('[CalibrationWizard] 🎯 Render:', { currentStep, stepIndex, stepTitle: step.title });

    // ⚡ FIX: Synchroniser le store si currentStep est invalide
    useEffect(() => {
        if (currentStep < 1) {
            console.log('[CalibrationWizard] ⚠️ currentStep invalide, correction à 1');
            setCurrentStep(1);
        }
    }, [currentStep, setCurrentStep]);

    // Récupérer le pixelsPerMm de la carte pour cette distance
    const currentPixelsPerMm = step.distance === 'close'
        ? closeDistance?.pixelsPerMm
        : farDistance?.pixelsPerMm;

    // Taille attendue du cercle cible (paume à la bonne distance)
    // Paume ≈ 85mm, donc cercle = 85mm × pixelsPerMm
    const expectedPalmWidthPx = currentPixelsPerMm ? PALM_WIDTH_MM * currentPixelsPerMm : null;

    // ==========================================================================
    // DÉTECTION MEDIAPIPE - Capture quand main détectée et stable
    // ==========================================================================
    useEffect(() => {
        if (step.type !== 'hand' || !landmarks || landmarks.length < 21) {
            setDetectedPalmWidthPx(null);
            setIsHandAtCorrectDistance(false);
            return;
        }

        // Largeur paume = distance entre index MCP (5) et pinky MCP (17)
        const indexMcp = landmarks[5];
        const pinkyMcp = landmarks[17];

        const dx = (indexMcp.x - pinkyMcp.x) * containerWidth;
        const dy = (indexMcp.y - pinkyMcp.y) * containerHeight;
        const palmWidth = Math.sqrt(dx * dx + dy * dy);

        setDetectedPalmWidthPx(palmWidth);

        // Main détectée → incrémenter stabilité (pas de vérification de taille)
        setStabilityCounter(prev => Math.min(prev + 1, 30));

        // Valider après 15 frames stables (~0.5 sec)
        if (stabilityCounter >= 15) {
            setIsHandAtCorrectDistance(true);

            // Capturer les landmarks quand stable
            if (!capturedLandmarks) {
                setCapturedLandmarks([...landmarks]);
                console.log('[Calibration] ✅ Main capturée!', {
                    palmWidthPx: palmWidth.toFixed(1),
                    stabilityFrames: stabilityCounter,
                });
            }
        }
    }, [landmarks, step.type, containerWidth, containerHeight, stabilityCounter, capturedLandmarks]);

    // Reset quand on change d'étape
    useEffect(() => {
        setDetectedPalmWidthPx(null);
        setIsHandAtCorrectDistance(false);
        setCapturedLandmarks(null);
        setStabilityCounter(0);
    }, [currentStep]);

    // Confirmer l'étape actuelle
    const handleConfirm = () => {
        if (step.type === 'card') {
            // Sauvegarder la calibration carte (taille FIXE)
            const fixedCardWidth = step.distance === 'close' ? containerWidth * 0.40 : containerWidth * 0.20;
            if (step.distance === 'close') {
                setCloseCardCalibration(fixedCardWidth);
            } else {
                setFarCardCalibration(fixedCardWidth);
            }
        } else {
            // Utiliser les landmarks capturés par MediaPipe
            if (!capturedLandmarks || !detectedPalmWidthPx || !currentPixelsPerMm) {
                console.warn('[Calibration] ⚠️ Pas de landmarks capturés');
                return;
            }

            // Calculer la hauteur de main approximative
            const wrist = capturedLandmarks[0];
            const middleTip = capturedLandmarks[12];
            const handHeightPx = Math.sqrt(
                Math.pow((middleTip.x - wrist.x) * containerWidth, 2) +
                Math.pow((middleTip.y - wrist.y) * containerHeight, 2)
            );

            // La largeur de paume détectée par MediaPipe, convertie en mm
            const palmWidthMm = detectedPalmWidthPx / currentPixelsPerMm;

            console.log('[Calibration] 📏 MediaPipe - Mesures paume:', {
                palmWidthPx: detectedPalmWidthPx.toFixed(1),
                palmWidthMm: palmWidthMm.toFixed(1),
                handHeightPx: handHeightPx.toFixed(1),
                pixelsPerMm: currentPixelsPerMm.toFixed(3),
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

            console.log('[Calibration] 💍 Tailles bagues (depuis landmarks réels):', {
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
        }

        // Passer à l'étape suivante ou terminer
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
        } else {
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

    // Rendu du contenu selon le type d'étape
    const renderStepContent = () => {
        if (!step) return null;

        if (step.type === 'card') {
            // Taille FIXE du cadre carte (pas de slider)
            // À 20cm: carte plus grande (~40% container), à 40cm: ~20% (ratio 2x)
            const fixedCardWidth = step.distance === 'close' ? containerWidth * 0.40 : containerWidth * 0.20;
            const fixedCardHeight = fixedCardWidth / (CREDIT_CARD_WIDTH_MM / CREDIT_CARD_HEIGHT_MM);

            return (
                <div className="relative w-full h-full flex flex-col">
                    {/* Zone centrale - cadre de la carte FIXE */}
                    <div className="flex-1 flex items-center justify-center">
                        <div
                            className="border-2 border-blue-500 bg-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.5)] relative rounded-lg"
                            style={{
                                width: fixedCardWidth,
                                height: fixedCardHeight,
                            }}
                        >
                            {/* Coins décoratifs */}
                            <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                            <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                            <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                            <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-blue-400 rounded-br" />

                            {/* Label dimensions */}
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/70 px-2 py-0.5 rounded text-sm font-mono text-cyan-400">
                                {CREDIT_CARD_WIDTH_MM} mm
                            </div>
                            <div className="absolute top-1/2 -right-14 -translate-y-1/2 bg-black/70 px-2 py-0.5 rounded text-sm font-mono text-cyan-400">
                                {CREDIT_CARD_HEIGHT_MM.toFixed(0)} mm
                            </div>
                        </div>
                    </div>

                    {/* Instruction en bas (pas de slider) */}
                    <div className="bg-black/70 p-4 rounded-t-lg text-center">
                        <p className="text-gray-300">
                            {step.distance === 'close'
                                ? "Placez votre carte dans le cadre à ~20cm"
                                : "Reculez à ~40cm et placez la carte dans le cadre"
                            }
                        </p>
                    </div>
                </div>
            );
        }

        // Type = hand - Cadre carte en référence + cercle autour
        const isDetecting = !!landmarks && landmarks.length >= 21;

        // Taille du cadre carte de référence (même taille que l'étape carte précédente)
        const referenceCardWidth = step.distance === 'close'
            ? containerWidth * 0.40
            : containerWidth * 0.20;
        const referenceCardHeight = referenceCardWidth / (CREDIT_CARD_WIDTH_MM / CREDIT_CARD_HEIGHT_MM);

        // Cercle autour du cadre carte (légèrement plus grand)
        const circleSize = Math.max(referenceCardWidth, referenceCardHeight) * 1.3;

        // Couleur selon l'état
        const getCircleColor = () => {
            if (isHandAtCorrectDistance) return 'rgb(34, 197, 94)'; // green-500
            if (isDetecting) return 'rgb(234, 179, 8)'; // yellow-500
            return 'rgb(59, 130, 246)'; // blue-500
        };

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

                    {/* Cadre carte de référence (fantôme) */}
                    <div
                        className="border-2 border-dashed border-gray-400/50 bg-gray-500/10 relative rounded-lg"
                        style={{
                            width: referenceCardWidth,
                            height: referenceCardHeight,
                        }}
                    >
                        {/* Icône carte fantôme */}
                        <CreditCard className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-gray-500/50" />

                        {/* Coins décoratifs */}
                        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-gray-400/50 rounded-tl" />
                        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-gray-400/50 rounded-tr" />
                        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-gray-400/50 rounded-bl" />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-gray-400/50 rounded-br" />
                    </div>

                    {/* Indicateur d'état au-dessus */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/80 px-4 py-2 rounded-lg">
                        {!isDetecting ? (
                            <div className="flex items-center gap-2">
                                <Hand className="w-5 h-5 text-gray-400" />
                                <span className="text-gray-400 text-sm">Montrez votre main</span>
                            </div>
                        ) : isHandAtCorrectDistance ? (
                            <div className="flex items-center gap-2">
                                <Check className="w-5 h-5 text-green-500" />
                                <span className="text-green-400 text-sm">Main capturée!</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Loader2 className="w-5 h-5 text-yellow-500 animate-spin" />
                                <span className="text-yellow-400 text-sm">Stabilisation...</span>
                            </div>
                        )}
                    </div>

                    {/* Barre de progression de stabilité */}
                    {isDetecting && !isHandAtCorrectDistance && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-48">
                            <div className="bg-gray-700 rounded-full h-2 overflow-hidden">
                                <div
                                    className="bg-green-500 h-full transition-all duration-100"
                                    style={{ width: `${(stabilityCounter / 15) * 100}%` }}
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
                            ? "Placez votre main à la même distance que la carte (~20cm)"
                            : "Placez votre main à la même distance que la carte (~40cm)"
                        }
                    </p>
                    <p className="text-center text-xs text-gray-500 mt-1">
                        Le cadre indique où était la carte - gardez la même distance
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
                    Étape {currentStep}/4 : {step.title}
                </h2>
                <p className="text-sm text-gray-300 mt-1">{step.instruction}</p>
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
                <Button
                    onClick={handleConfirm}
                    disabled={step.type === 'hand' && !isHandAtCorrectDistance}
                    className={`w-full py-5 text-lg ${
                        step.type === 'hand' && !isHandAtCorrectDistance
                            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                            : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                >
                    {step.type === 'hand' && !isHandAtCorrectDistance ? (
                        <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            En attente de détection...
                        </>
                    ) : (
                        <>
                            Confirmer
                            <ChevronRight className="ml-2 h-5 w-5" />
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
}
