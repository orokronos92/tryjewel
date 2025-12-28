"use client";

import { useState, useEffect } from "react";
import {
    useCalibrationStore,
    CREDIT_CARD_WIDTH_MM,
    CREDIT_CARD_HEIGHT_MM,
    HandMeasurements,
    FingerMeasurement,
    ellipseCircumference,
    circumferenceToRingSizes,
} from "@/stores/calibration-store";
import { Button } from "@/components/ui/button";
import { CreditCard, Hand, Check, X, ChevronRight } from "lucide-react";
import HandCalibrationFrame from "@/components/hand-calibration-frame";

// Ratios anatomiques pour la largeur des doigts par rapport à la largeur de la paume
const FINGER_WIDTH_RATIOS = {
    index: 0.22,   // ~22% de la largeur paume
    middle: 0.23,  // ~23% de la largeur paume (le plus large)
    ring: 0.21,    // ~21% de la largeur paume
    pinky: 0.18,   // ~18% de la largeur paume (le plus fin)
};

// Ratio profondeur/largeur pour les doigts (ellipse)
const FINGER_DEPTH_RATIO = 0.85;

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

    // Fonction pour calculer les mesures d'un doigt
    const calculateFingerMeasurement = (
        fingerName: keyof typeof FINGER_WIDTH_RATIOS,
        palmWidthMm: number
    ): FingerMeasurement => {
        const widthMm = palmWidthMm * FINGER_WIDTH_RATIOS[fingerName];
        const depthMm = widthMm * FINGER_DEPTH_RATIO;
        const circumferenceMm = ellipseCircumference(widthMm, depthMm);
        const ringSizes = circumferenceToRingSizes(circumferenceMm);

        return {
            widthPx: 0, // Non utilisé dans cette méthode
            widthMm,
            depthMm,
            circumferenceMm,
            ringSizes,
        };
    };

    // État local pour les sliders de main
    const [handWidthSlider, setHandWidthSlider] = useState(50);
    const [handHeightSlider, setHandHeightSlider] = useState(50);

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

    // ⚡ FIX: Ajuster la taille initiale selon la distance
    // À 50cm la main paraît ~2x plus petite qu'à 30cm
    const distanceScale = step.distance === 'close' ? 1.0 : 0.5;

    // Conversion slider vers pixels pour la main (avec facteur de distance)
    const getHandWidthPx = (val: number) => {
        const baseMin = containerWidth * 0.15;
        const baseMax = containerWidth * 0.5;
        // Appliquer le facteur de distance
        const min = baseMin * distanceScale;
        const max = baseMax * distanceScale;
        return min + (val / 100) * (max - min);
    };

    const getHandHeightPx = (val: number) => {
        const baseMin = containerHeight * 0.25;
        const baseMax = containerHeight * 0.7;
        // Appliquer le facteur de distance
        const min = baseMin * distanceScale;
        const max = baseMax * distanceScale;
        return min + (val / 100) * (max - min);
    };

    const handWidthPx = getHandWidthPx(handWidthSlider);
    const handHeightPx = getHandHeightPx(handHeightSlider);

    // Confirmer l'étape actuelle
    const handleConfirm = () => {
        if (step.type === 'card') {
            // Sauvegarder la calibration carte (taille FIXE)
            const fixedCardWidth = step.distance === 'close' ? containerWidth * 0.35 : containerWidth * 0.18;
            if (step.distance === 'close') {
                setCloseCardCalibration(fixedCardWidth);
            } else {
                setFarCardCalibration(fixedCardWidth);
            }
        } else {
            // Récupérer le pixelsPerMm de la carte pour cette distance
            const calibrationData = step.distance === 'close' ? closeDistance : farDistance;
            const pixelsPerMm = calibrationData?.pixelsPerMm || 1;

            // Calculer la largeur de la paume en mm
            // La largeur du contour SVG représente la largeur de la main
            // On estime que la paume fait ~60% de la largeur totale de la main
            const palmWidthMm = (handWidthPx / pixelsPerMm) * 0.6;

            console.log('[Calibration] 📏 Calcul des tailles:', {
                handWidthPx,
                pixelsPerMm,
                palmWidthMm,
            });

            // Calculer les mesures de chaque doigt
            const handMeasurements: HandMeasurements = {
                handWidthPx,
                handHeightPx,
                index: calculateFingerMeasurement('index', palmWidthMm),
                middle: calculateFingerMeasurement('middle', palmWidthMm),
                ring: calculateFingerMeasurement('ring', palmWidthMm),
                pinky: calculateFingerMeasurement('pinky', palmWidthMm),
            };

            console.log('[Calibration] 💍 Tailles calculées:', {
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
            // Reset sliders pour la prochaine étape main
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
            // Taille FIXE du cadre carte (pas de slider)
            // À 30cm: ~337px, à 50cm: ~169px (environ 2x plus petit)
            const fixedCardWidth = step.distance === 'close' ? containerWidth * 0.35 : containerWidth * 0.18;
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
                                ? "Placez votre carte dans le cadre à ~30cm"
                                : "Reculez à ~50cm et placez la carte dans le cadre"
                            }
                        </p>
                    </div>
                </div>
            );
        }

        // Type = hand - Contour de MAIN ajustable
        // SVG fait 200x280, scaleX et scaleY INDÉPENDANTS
        const svgOriginalWidth = 200;
        const svgOriginalHeight = 280;
        const scaleX = handWidthPx / svgOriginalWidth;
        const scaleY = handHeightPx / svgOriginalHeight;

        return (
            <div className="relative w-full h-full flex">
                {/* Slider Largeur - côté GAUCHE vertical */}
                <div className="absolute left-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
                    <span className="text-green-400 font-mono text-xs">{Math.round(handWidthPx)}px</span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={handWidthSlider}
                        onChange={(e) => setHandWidthSlider(Number(e.target.value))}
                        className="w-24 h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-green-500"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                    />
                    <span className="text-white/60 text-xs">Largeur</span>
                </div>

                {/* Zone centrale - contour de main */}
                <div className="flex-1 flex items-center justify-center relative">
                    <HandCalibrationFrame
                        width={containerWidth}
                        height={containerHeight}
                        scaleX={scaleX}
                        scaleY={scaleY}
                        stroke="#22c55e"
                        strokeWidth={3}
                        opacity={1}
                    />

                    {/* Labels dimensions en mm */}
                    {(() => {
                        const ppm = step.distance === 'close' ? closeDistance?.pixelsPerMm : farDistance?.pixelsPerMm;
                        if (!ppm) return null;
                        const widthMm = Math.round(handWidthPx / ppm);
                        const heightMm = Math.round(handHeightPx / ppm);
                        return (
                            <>
                                <div className="absolute top-1/2 right-16 -translate-y-1/2 bg-black/50 px-2 py-0.5 rounded text-sm font-mono text-green-400">
                                    {heightMm} mm
                                </div>
                                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/50 px-2 py-0.5 rounded text-sm font-mono text-green-400">
                                    {widthMm} mm
                                </div>
                            </>
                        );
                    })()}
                </div>

                {/* Slider Hauteur - côté DROIT vertical */}
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-10">
                    <span className="text-green-400 font-mono text-xs">{Math.round(handHeightPx)}px</span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={handHeightSlider}
                        onChange={(e) => setHandHeightSlider(Number(e.target.value))}
                        className="w-24 h-2 bg-white/30 rounded-lg appearance-none cursor-pointer accent-green-500"
                        style={{ transform: 'rotate(-90deg)', transformOrigin: 'center' }}
                    />
                    <span className="text-white/60 text-xs">Hauteur</span>
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
