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
        title: "Carte (proche)",
        instruction: "Placez une carte bancaire dans le cadre bleu",
        type: 'card',
        distance: 'close',
    },
    {
        icon: <Hand className="h-5 w-5" />,
        title: "Main (proche)",
        instruction: "Posez la carte, montrez votre main ouverte",
        type: 'hand',
        distance: 'close',
    },
    {
        icon: <CreditCard className="h-5 w-5" />,
        title: "Carte (loin)",
        instruction: "Reculez et placez la carte dans le cadre",
        type: 'card',
        distance: 'far',
    },
    {
        icon: <Hand className="h-5 w-5" />,
        title: "Main (loin)",
        instruction: "Montrez votre main à cette distance",
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

    const stepIndex = currentStep - 1; // currentStep est 1-indexed
    const step = STEPS[stepIndex];

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
            z: lm.z, // Z est déjà en unités relatives
        });

        // Calculer la largeur de la paume pour référence
        const indexMcp = toPixels(landmarks[PALM_LANDMARKS.indexMcp]);
        const pinkyMcp = toPixels(landmarks[PALM_LANDMARKS.pinkyMcp]);
        const palmWidthPx = Math.sqrt(
            Math.pow(indexMcp.x - pinkyMcp.x, 2) + Math.pow(indexMcp.y - pinkyMcp.y, 2)
        );

        // Calculer la hauteur de la main
        const wrist = toPixels(landmarks[PALM_LANDMARKS.wrist]);
        const middleTip = toPixels(landmarks[FINGER_LANDMARKS.middle.tip]);
        const handTotalHeightPx = Math.sqrt(
            Math.pow(wrist.x - middleTip.x, 2) + Math.pow(wrist.y - middleTip.y, 2)
        );

        // Fonction pour mesurer un doigt
        const measureFinger = (fingerName: keyof typeof FINGER_LANDMARKS): FingerMeasurement | null => {
            const fingerLm = FINGER_LANDMARKS[fingerName];
            const pip = toPixels(landmarks[fingerLm.pip]);
            const dip = toPixels(landmarks[fingerLm.dip]);

            // Largeur du doigt = distance PIP-DIP (approximation)
            // En réalité on mesure le segment, pas la largeur transversale
            // Pour la largeur, on estime à ~60% de la longueur du segment PIP-DIP
            const segmentLength = Math.sqrt(
                Math.pow(pip.x - dip.x, 2) + Math.pow(pip.y - dip.y, 2)
            );

            // Estimation de la largeur du doigt (basée sur proportions anatomiques)
            // Un doigt fait environ 15-20mm de large au niveau de la phalange proximale
            const fingerWidthPx = segmentLength * 0.7; // Approximation
            const fingerWidthMm = fingerWidthPx / pixelsPerMm;

            // Pour la profondeur, utiliser worldLandmarks si disponible
            let depthMm = fingerWidthMm * 0.8; // Par défaut: 80% de la largeur (doigt légèrement aplati)

            if (worldLandmarks && worldLandmarks.length >= 21) {
                const worldPip = worldLandmarks[fingerLm.pip];
                const worldDip = worldLandmarks[fingerLm.dip];
                // La différence Z donne une indication de la profondeur
                const zDiff = Math.abs(worldPip.z - worldDip.z);
                // Convertir Z (en mètres dans worldLandmarks) en mm
                depthMm = Math.max(fingerWidthMm * 0.6, zDiff * 1000 + fingerWidthMm * 0.5);
            }

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
                <>
                    {/* Cadre de la carte */}
                    <div className="relative flex-1 flex items-center justify-center">
                        <div
                            className="border-2 border-blue-500 bg-blue-500/10 shadow-[0_0_20px_rgba(59,130,246,0.4)] relative rounded-lg"
                            style={{
                                width: cardWidthPx,
                                height: cardHeightPx,
                                transition: 'width 0.1s, height 0.1s',
                            }}
                        >
                            {/* Coins décoratifs */}
                            <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-400 rounded-tl" />
                            <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-400 rounded-tr" />
                            <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-400 rounded-bl" />
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-400 rounded-br" />

                            {/* Label dimensions */}
                            <div className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-mono text-cyan-400">
                                {CREDIT_CARD_WIDTH_MM} mm
                            </div>
                            <div className="absolute top-1/2 -right-12 -translate-y-1/2 text-xs font-mono text-cyan-400">
                                {CREDIT_CARD_HEIGHT_MM.toFixed(0)} mm
                            </div>
                        </div>

                        {/* Affichage pixels */}
                        <div className="absolute bottom-4 text-center text-sm text-gray-400">
                            {Math.round(cardWidthPx)}px
                        </div>
                    </div>

                    {/* Slider */}
                    <div className="w-full max-w-md px-4 space-y-2">
                        <div className="flex justify-between text-xs text-gray-500">
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
                            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                    </div>
                </>
            );
        }

        // Type = hand
        return (
            <>
                {/* Silhouette de main */}
                <div className="relative flex-1 flex items-center justify-center">
                    <div
                        className={`
                            relative transition-all duration-200
                            ${handDetected ? 'opacity-80' : 'opacity-50'}
                        `}
                        style={{
                            width: handWidthPx,
                            height: handHeightPx,
                        }}
                    >
                        {/* SVG de main simplifiée */}
                        <svg
                            viewBox="0 0 100 140"
                            className={`w-full h-full ${handDetected ? 'stroke-green-500' : 'stroke-gray-400'}`}
                            fill="none"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            {/* Paume */}
                            <ellipse cx="50" cy="100" rx="35" ry="30" strokeDasharray={handDetected ? "0" : "4 2"} />

                            {/* Doigts */}
                            {/* Index */}
                            <path d="M35 75 L35 25 Q35 15 40 15 Q45 15 45 25 L45 75" strokeDasharray={handDetected ? "0" : "4 2"} />
                            {/* Majeur */}
                            <path d="M45 70 L45 10 Q45 0 50 0 Q55 0 55 10 L55 70" strokeDasharray={handDetected ? "0" : "4 2"} />
                            {/* Annulaire */}
                            <path d="M55 75 L55 20 Q55 10 60 10 Q65 10 65 20 L65 75" strokeDasharray={handDetected ? "0" : "4 2"} />
                            {/* Auriculaire */}
                            <path d="M65 80 L65 35 Q65 25 70 25 Q75 25 75 35 L75 80" strokeDasharray={handDetected ? "0" : "4 2"} />
                            {/* Pouce */}
                            <path d="M20 90 Q5 85 10 70 Q15 55 25 60 L30 75" strokeDasharray={handDetected ? "0" : "4 2"} />
                        </svg>

                        {/* Indicateur de détection */}
                        {handDetected && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                                Main détectée
                            </div>
                        )}
                    </div>

                    {/* Affichage des mesures */}
                    <div className="absolute bottom-4 text-center space-y-1">
                        <div className="text-sm text-gray-400">
                            Largeur: <span className="text-cyan-400 font-mono">{Math.round(handWidthPx)}px</span>
                            {" · "}
                            Hauteur: <span className="text-cyan-400 font-mono">{Math.round(handHeightPx)}px</span>
                        </div>
                        {calculatedMeasurements && step.distance === 'close' && (
                            <div className="text-xs text-green-400">
                                Tours de doigt calculés
                            </div>
                        )}
                    </div>
                </div>

                {/* Sliders pour ajuster manuellement si pas de détection */}
                {!handDetected && (
                    <div className="w-full max-w-md px-4 space-y-4">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Étroit</span>
                                <span className="text-white">Largeur: {Math.round(handWidthPx)}px</span>
                                <span>Large</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.5"
                                value={handWidthSlider}
                                onChange={(e) => setHandWidthSlider(Number(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs text-gray-500">
                                <span>Court</span>
                                <span className="text-white">Hauteur: {Math.round(handHeightPx)}px</span>
                                <span>Grand</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="100"
                                step="0.5"
                                value={handHeightSlider}
                                onChange={(e) => setHandHeightSlider(Number(e.target.value))}
                                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            />
                        </div>
                    </div>
                )}

                {/* Message d'instruction si détection active */}
                {handDetected && (
                    <div className="text-sm text-gray-400 text-center px-4">
                        Ajustez le contour pour qu'il épouse votre main
                    </div>
                )}
            </>
        );
    };

    if (!step) return null;

    return (
        <div className="absolute inset-0 z-50 flex flex-col bg-black/60 backdrop-blur-sm text-white">
            {/* Header */}
            <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    {step.icon}
                    <span className="text-sm text-gray-400">Selfie</span>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="text-white hover:bg-white/10 rounded-full"
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Titre de l'étape */}
            <div className="px-4 pb-2">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                    {step.icon}
                    Étape {currentStep}/4 : {step.title}
                </h2>
                <p className="text-sm text-gray-300 mt-1">{step.instruction}</p>
            </div>

            {/* Indicateurs de progression */}
            {renderStepIndicators()}

            {/* Contenu principal */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
                {renderStepContent()}
            </div>

            {/* Infos caméra */}
            <div className="px-4 py-2 text-xs text-gray-500 flex gap-4">
                <span>Résolution: {videoElement?.videoWidth || 0}×{videoElement?.videoHeight || 0}</span>
                <span>Caméra: Frontale</span>
                <span>Miroir: Oui</span>
            </div>

            {/* Bouton confirmer */}
            <div className="p-4">
                <Button
                    onClick={handleConfirm}
                    disabled={step.type === 'hand' && step.distance === 'close' && !handDetected}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg disabled:opacity-50"
                >
                    Confirmer
                    <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
            </div>
        </div>
    );
}
