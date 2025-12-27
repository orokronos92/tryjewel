"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    useCalibrationStore,
    CREDIT_CARD_WIDTH_MM,
    CREDIT_CARD_HEIGHT_MM,
    ellipseCircumference,
    circumferenceToRingSizes,
    HandMeasurements,
    FingerMeasurement,
} from "@/stores/calibration-store";
import { Button } from "@/components/ui/button";
import { CreditCard, Hand, Check, X, ChevronRight } from "lucide-react";

// =============================================================================
// TYPES
// =============================================================================

interface CalibrationWizardProps {
    onClose: () => void;
    containerWidth: number;
    containerHeight: number;
    videoElement: HTMLVideoElement | null;
    // Landmarks MediaPipe (fournis par le parent quand disponibles)
    landmarks: Array<{ x: number; y: number; z: number }> | null;
    worldLandmarks: Array<{ x: number; y: number; z: number }> | null;
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
        title: "Carte (30cm)",
        instruction: "Placez une carte bancaire à 30cm de la caméra et ajustez le cadre",
        type: 'card',
        distance: 'close',
    },
    {
        icon: <Hand className="h-5 w-5" />,
        title: "Main (30cm)",
        instruction: "Gardez la même distance (30cm) et ajustez le contour à votre main",
        type: 'hand',
        distance: 'close',
    },
    {
        icon: <CreditCard className="h-5 w-5" />,
        title: "Carte (50cm)",
        instruction: "Reculez à 50cm et ajustez le cadre à la carte",
        type: 'card',
        distance: 'far',
    },
    {
        icon: <Hand className="h-5 w-5" />,
        title: "Main (50cm)",
        instruction: "Gardez la distance (50cm) et ajustez le contour à votre main",
        type: 'hand',
        distance: 'far',
    },
];

// Indices des landmarks MediaPipe pour les doigts
const FINGER_LANDMARKS = {
    index: { mcp: 5, pip: 6, dip: 7, tip: 8 },
    middle: { mcp: 9, pip: 10, dip: 11, tip: 12 },
    ring: { mcp: 13, pip: 14, dip: 15, tip: 16 },
    pinky: { mcp: 17, pip: 18, dip: 19, tip: 20 },
};

// Pour mesurer la largeur de la paume
const PALM_LANDMARKS = {
    indexMcp: 5,
    pinkyMcp: 17,
    wrist: 0,
    middleMcp: 9,
};

// Connexions pour dessiner le squelette de la main
const HAND_CONNECTIONS = [
    // Pouce
    [0, 1], [1, 2], [2, 3], [3, 4],
    // Index
    [0, 5], [5, 6], [6, 7], [7, 8],
    // Majeur
    [0, 9], [9, 10], [10, 11], [11, 12],
    // Annulaire
    [0, 13], [13, 14], [14, 15], [15, 16],
    // Auriculaire
    [0, 17], [17, 18], [18, 19], [19, 20],
    // Paume
    [5, 9], [9, 13], [13, 17],
];

// Ratios anatomiques pour la largeur des doigts par rapport à la largeur de la paume
// Source: études anthropométriques moyennes
const FINGER_WIDTH_RATIOS = {
    index: 0.22,   // ~22% de la largeur paume
    middle: 0.23,  // ~23% de la largeur paume (le plus large)
    ring: 0.21,    // ~21% de la largeur paume
    pinky: 0.18,   // ~18% de la largeur paume (le plus fin)
};

// =============================================================================
// COMPONENT
// =============================================================================

export function CalibrationWizard({
    onClose,
    containerWidth,
    containerHeight,
    videoElement,
    landmarks,
    worldLandmarks,
}: CalibrationWizardProps) {
    const {
        currentStep,
        setCurrentStep,
        closeDistance,
        setCloseCardCalibration,
        setCloseHandMeasurements,
        setFarCardCalibration,
        setFarHandMeasurements,
        completeCalibration,
    } = useCalibrationStore();

    // État local
    const [sliderValue, setSliderValue] = useState(50);
    const [handWidthSlider, setHandWidthSlider] = useState(50);
    const [handHeightSlider, setHandHeightSlider] = useState(50);
    const [handDetected, setHandDetected] = useState(false);
    const [calculatedMeasurements, setCalculatedMeasurements] = useState<HandMeasurements | null>(null);

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

    // Conversion slider vers pixels pour la carte
    const getCardWidthPx = (val: number) => {
        const min = containerWidth * 0.15;
        const max = containerWidth * 0.85;
        return min + (val / 100) * (max - min);
    };

    // Conversion slider vers pixels pour la main
    const getHandWidthPx = (val: number) => {
        const min = containerWidth * 0.1;
        const max = containerWidth * 0.7;
        return min + (val / 100) * (max - min);
    };

    const getHandHeightPx = (val: number) => {
        const min = containerHeight * 0.15;
        const max = containerHeight * 0.8;
        return min + (val / 100) * (max - min);
    };

    const cardWidthPx = getCardWidthPx(sliderValue);
    const cardAspectRatio = CREDIT_CARD_WIDTH_MM / CREDIT_CARD_HEIGHT_MM;
    const cardHeightPx = cardWidthPx / cardAspectRatio;

    const handWidthPx = getHandWidthPx(handWidthSlider);
    const handHeightPx = getHandHeightPx(handHeightSlider);

    // Calcul automatique des mesures de doigt depuis landmarks
    const calculateFingerMeasurements = useCallback(() => {
        if (!landmarks || landmarks.length < 21 || !closeDistance) {
            return null;
        }

        const pixelsPerMm = closeDistance.pixelsPerMm;
        if (pixelsPerMm <= 0) return null;

        const videoWidth = videoElement?.videoWidth || containerWidth;
        const videoHeight = videoElement?.videoHeight || containerHeight;

        // Fonction pour convertir landmark normalisé en pixels
        const toPixels = (lm: { x: number; y: number; z: number }) => ({
            x: lm.x * videoWidth,
            y: lm.y * videoHeight,
            z: lm.z,
        });

        // Calculer la largeur de la paume (INDEX_MCP à PINKY_MCP)
        const indexMcp = toPixels(landmarks[PALM_LANDMARKS.indexMcp]);
        const pinkyMcp = toPixels(landmarks[PALM_LANDMARKS.pinkyMcp]);
        const palmWidthPx = Math.sqrt(
            Math.pow(indexMcp.x - pinkyMcp.x, 2) + Math.pow(indexMcp.y - pinkyMcp.y, 2)
        );
        const palmWidthMm = palmWidthPx / pixelsPerMm;

        // Calculer la hauteur de la main
        const wrist = toPixels(landmarks[PALM_LANDMARKS.wrist]);
        const middleTip = toPixels(landmarks[FINGER_LANDMARKS.middle.tip]);
        const handTotalHeightPx = Math.sqrt(
            Math.pow(wrist.x - middleTip.x, 2) + Math.pow(wrist.y - middleTip.y, 2)
        );

        // Fonction pour mesurer un doigt basée sur les ratios anatomiques
        const measureFinger = (fingerName: keyof typeof FINGER_LANDMARKS): FingerMeasurement | null => {
            // Utiliser le ratio anatomique pour calculer la largeur du doigt
            const ratio = FINGER_WIDTH_RATIOS[fingerName];
            const fingerWidthMm = palmWidthMm * ratio;
            const fingerWidthPx = fingerWidthMm * pixelsPerMm;

            // La profondeur est généralement 80-90% de la largeur (doigt légèrement ovale)
            const depthMm = fingerWidthMm * 0.85;

            // Calculer la circonférence (forme elliptique)
            const circumference = ellipseCircumference(fingerWidthMm, depthMm);
            const ringSizes = circumferenceToRingSizes(circumference);

            return {
                widthPx: fingerWidthPx,
                widthMm: fingerWidthMm,
                depthMm,
                circumferenceMm: circumference,
                ringSizes,
            };
        };

        const measurements: HandMeasurements = {
            handWidthPx: palmWidthPx,
            handHeightPx: handTotalHeightPx,
            index: measureFinger('index'),
            middle: measureFinger('middle'),
            ring: measureFinger('ring'),
            pinky: measureFinger('pinky'),
        };

        console.log('[Calibration] 📏 Mesures calculées:', {
            palmWidthMm: palmWidthMm.toFixed(1),
            index: measurements.index?.circumferenceMm.toFixed(1),
            middle: measurements.middle?.circumferenceMm.toFixed(1),
            ring: measurements.ring?.circumferenceMm.toFixed(1),
            pinky: measurements.pinky?.circumferenceMm.toFixed(1),
        });

        return measurements;
    }, [landmarks, worldLandmarks, closeDistance, videoElement, containerWidth, containerHeight]);

    // Effet pour détecter la main et calculer les mesures
    useEffect(() => {
        if (step?.type === 'hand' && landmarks && landmarks.length >= 21) {
            setHandDetected(true);

            // Calculer les mesures seulement si on a le pixelsPerMm
            if (step.distance === 'close' && closeDistance?.pixelsPerMm) {
                const measurements = calculateFingerMeasurements();
                setCalculatedMeasurements(measurements);
            }
        } else {
            setHandDetected(false);
        }
    }, [step, landmarks, closeDistance, calculateFingerMeasurements]);

    // Confirmer l'étape actuelle
    const handleConfirm = () => {
        if (step.type === 'card') {
            // Sauvegarder la calibration carte
            if (step.distance === 'close') {
                setCloseCardCalibration(cardWidthPx);
            } else {
                setFarCardCalibration(cardWidthPx);
            }
        } else {
            // Sauvegarder les mesures de main
            if (step.distance === 'close' && calculatedMeasurements) {
                setCloseHandMeasurements(calculatedMeasurements);
            } else if (step.distance === 'far') {
                // Pour la distance loin, on recalcule avec le nouveau pixelsPerMm
                // Pour l'instant on sauvegarde les dimensions du slider
                setFarHandMeasurements({
                    handWidthPx,
                    handHeightPx,
                    index: null,
                    middle: null,
                    ring: null,
                    pinky: null,
                });
            }
        }

        // Passer à l'étape suivante ou terminer
        if (currentStep < 4) {
            setCurrentStep(currentStep + 1);
            setSliderValue(50);
            setHandWidthSlider(50);
            setHandHeightSlider(50);
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
            return (
                <div className="relative w-full h-full flex flex-col">
                    {/* Zone centrale - cadre de la carte */}
                    <div className="flex-1 flex items-center justify-center">
                        <div
                            className="border-2 border-blue-500 bg-blue-500/20 shadow-[0_0_30px_rgba(59,130,246,0.5)] relative rounded-lg"
                            style={{
                                width: cardWidthPx,
                                height: cardHeightPx,
                                transition: 'width 0.1s, height 0.1s',
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

                    {/* Slider en bas */}
                    <div className="bg-black/70 p-4 rounded-t-lg">
                        <div className="max-w-md mx-auto space-y-2">
                            <div className="flex justify-between text-xs text-gray-300">
                                <span>Plus petit</span>
                                <span className="text-blue-400 font-mono">{Math.round(cardWidthPx)}px</span>
                                <span>Plus grand</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.5"
                                value={sliderValue}
                                onChange={(e) => setSliderValue(Number(e.target.value))}
                                className="w-full h-3 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                </div>
            );
        }

        // Type = hand - Contour ajustable pour calibrer la taille de la main
        return (
            <div className="relative w-full h-full flex flex-col">
                {/* Zone centrale - contour de main ajustable */}
                <div className="flex-1 flex items-center justify-center relative">
                    {/* Contour de main (rectangle vert ajustable) */}
                    <div
                        className="border-2 border-green-500 bg-green-500/10 shadow-[0_0_30px_rgba(34,197,94,0.5)] relative rounded-lg"
                        style={{
                            width: handWidthPx,
                            height: handHeightPx,
                            transition: 'width 0.1s, height 0.1s',
                        }}
                    >
                        {/* Coins décoratifs */}
                        <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-green-400 rounded-tl" />
                        <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-green-400 rounded-tr" />
                        <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-green-400 rounded-bl" />
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-green-400 rounded-br" />

                        {/* Icône main au centre */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <Hand className="w-16 h-16 text-green-500/30" />
                        </div>

                        {/* Labels dimensions */}
                        <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/70 px-2 py-0.5 rounded text-sm font-mono text-green-400">
                            {Math.round(handWidthPx)}px
                        </div>
                        <div className="absolute top-1/2 -right-14 -translate-y-1/2 bg-black/70 px-2 py-0.5 rounded text-sm font-mono text-green-400">
                            {Math.round(handHeightPx)}px
                        </div>
                    </div>

                    {/* Instruction */}
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-green-600/90 text-white text-sm px-4 py-2 rounded-full shadow-lg">
                        🖐️ Placez votre main dans le cadre
                    </div>
                </div>

                {/* Sliders en bas */}
                <div className="bg-black/70 p-4 rounded-t-lg space-y-3">
                    {/* Slider Largeur */}
                    <div className="max-w-md mx-auto space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Étroit</span>
                            <span className="text-green-400 font-mono">Largeur: {Math.round(handWidthPx)}px</span>
                            <span>Large</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.5"
                            value={handWidthSlider}
                            onChange={(e) => setHandWidthSlider(Number(e.target.value))}
                            className="w-full h-3 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                        />
                    </div>

                    {/* Slider Hauteur */}
                    <div className="max-w-md mx-auto space-y-1">
                        <div className="flex justify-between text-xs text-gray-300">
                            <span>Court</span>
                            <span className="text-green-400 font-mono">Hauteur: {Math.round(handHeightPx)}px</span>
                            <span>Grand</span>
                        </div>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            step="0.5"
                            value={handHeightSlider}
                            onChange={(e) => setHandHeightSlider(Number(e.target.value))}
                            className="w-full h-3 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-green-500"
                        />
                    </div>
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
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-5 text-lg"
                >
                    Confirmer
                    <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
