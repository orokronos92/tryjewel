"use client";

import { useCalibrationStore, RingSizes } from "@/stores/calibration-store";
import { useJewelryStore } from "@/stores/jewelry-store";

interface RingSizeIndicatorProps {
    className?: string;
}

/**
 * Affiche le tour de doigt du doigt sélectionné dans un badge
 * Apparaît uniquement si la calibration a été effectuée
 */
export function RingSizeIndicator({ className = "" }: RingSizeIndicatorProps) {
    const { isCalibrated, finalFingerSizes } = useCalibrationStore();
    const selectedFinger = useJewelryStore((s) => s.selected.finger);

    // Ne rien afficher si pas calibré ou si c'est le pouce
    if (!isCalibrated || selectedFinger === 'thumb' || !selectedFinger) {
        return null;
    }

    const fingerSize = finalFingerSizes[selectedFinger as keyof typeof finalFingerSizes];

    if (!fingerSize) {
        return null;
    }

    // Noms des doigts en français
    const fingerNames: Record<string, string> = {
        index: "Index",
        middle: "Majeur",
        ring: "Annulaire",
        pinky: "Auriculaire",
    };

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Badge principal avec taille EU */}
            <div className="bg-black/70 backdrop-blur-sm rounded-full px-4 py-2 flex items-center gap-3 border border-white/20">
                {/* Indicateur circulaire avec taille */}
                <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
                        <span className="text-lg font-bold text-white">{fingerSize.eu}</span>
                    </div>
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-amber-500 text-[10px] text-white px-1.5 rounded-full">
                        EU
                    </div>
                </div>

                {/* Infos détaillées */}
                <div className="text-white">
                    <div className="text-sm font-medium">{fingerNames[selectedFinger]}</div>
                    <div className="text-xs text-gray-300 flex gap-2">
                        <span>US {fingerSize.us}</span>
                        <span>•</span>
                        <span>UK {fingerSize.uk}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                        ∅ {fingerSize.circumferenceMm.toFixed(1)}mm
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Version compacte pour affichage dans un coin
 */
export function RingSizeIndicatorCompact({ className = "" }: RingSizeIndicatorProps) {
    const { isCalibrated, finalFingerSizes } = useCalibrationStore();
    const selectedFinger = useJewelryStore((s) => s.selected.finger);

    if (!isCalibrated || selectedFinger === 'thumb' || !selectedFinger) {
        return null;
    }

    const fingerSize = finalFingerSizes[selectedFinger as keyof typeof finalFingerSizes];

    if (!fingerSize) {
        return null;
    }

    return (
        <div className={`bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-2 border border-amber-500/30 ${className}`}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
                <span className="text-sm font-bold text-white">{fingerSize.eu}</span>
            </div>
            <div className="text-white text-xs">
                <div className="font-medium">Taille {fingerSize.eu}</div>
                <div className="text-gray-400 text-[10px]">US {fingerSize.us}</div>
            </div>
        </div>
    );
}

/**
 * Tableau récapitulatif de toutes les tailles
 */
export function RingSizeSummary({ className = "" }: { className?: string }) {
    const { isCalibrated, finalFingerSizes } = useCalibrationStore();
    const selectedFinger = useJewelryStore((s) => s.selected.finger);
    const setFinger = useJewelryStore((s) => s.setFinger);

    if (!isCalibrated) {
        return null;
    }

    const fingers = ['index', 'middle', 'ring', 'pinky'] as const;
    const fingerNames: Record<string, string> = {
        index: "Index",
        middle: "Majeur",
        ring: "Annulaire",
        pinky: "Auriculaire",
    };

    const handleFingerSelect = (finger: string) => {
        setFinger(finger as 'index' | 'middle' | 'ring' | 'pinky');
    };

    return (
        <div className={`bg-black/70 backdrop-blur-sm rounded-lg p-3 border border-white/10 ${className}`}>
            <div className="text-xs text-gray-400 mb-2 font-medium">Vos tailles de bague</div>
            <div className="grid grid-cols-4 gap-2">
                {fingers.map((finger) => {
                    const size = finalFingerSizes[finger];
                    const isSelected = selectedFinger === finger;

                    return (
                        <button
                            key={finger}
                            onClick={() => handleFingerSelect(finger)}
                            className={`
                                flex flex-col items-center p-2 rounded-lg transition-all
                                ${isSelected
                                    ? 'bg-amber-500/30 border border-amber-500'
                                    : 'bg-white/5 border border-transparent hover:bg-white/10'
                                }
                            `}
                        >
                            <span className="text-[10px] text-gray-400">{fingerNames[finger]}</span>
                            {size ? (
                                <>
                                    <span className={`text-lg font-bold ${isSelected ? 'text-amber-400' : 'text-white'}`}>
                                        {size.eu}
                                    </span>
                                    <span className="text-[10px] text-gray-500">US {size.us}</span>
                                </>
                            ) : (
                                <span className="text-sm text-gray-600">-</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
