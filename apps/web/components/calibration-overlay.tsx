"use client";

import { useState } from "react";
import { useCalibrationStore } from "@/stores/calibration-store";
import { Button } from "@/components/ui/button";
import { CreditCard, Check, X } from "lucide-react";

interface CalibrationOverlayProps {
    onClose: () => void;
    containerWidth: number;
    containerHeight: number;
}

export function CalibrationOverlay({ onClose, containerWidth, containerHeight }: CalibrationOverlayProps) {
    const setCalibration = useCalibrationStore((s) => s.setCalibration);

    // Valeur par défaut : environ 1/3 de la largeur de l'écran ou une valeur raisonnable
    const [sliderValue, setSliderValue] = useState(33);

    // Convertir le slider (0-100) en pixels réels
    // Min: 10% de la largeur du conteneur, Max: 90%
    const getWidthPx = (val: number) => {
        const min = containerWidth * 0.1;
        const max = containerWidth * 0.9;
        return min + (val / 100) * (max - min);
    };

    const currentWidthPx = getWidthPx(sliderValue);
    // Ratio standard carte credit (85.60 × 53.98 mm) => Ratio ~1.585
    const aspectRatio = 85.60 / 53.98;
    const currentHeightPx = currentWidthPx / aspectRatio;

    const handleSave = () => {
        setCalibration(currentWidthPx);
        onClose();
    };

    return (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/20 backdrop-blur-[2px] p-4 text-white">
            <div className="absolute top-4 right-4">
                <Button variant="ghost" size="icon" onClick={onClose} className="bg-black/40 hover:bg-black/60 text-white rounded-full">
                    <X className="h-6 w-6" />
                </Button>
            </div>

            <div className="text-center mb-8 max-w-md space-y-2">
                <div className="flex items-center justify-center gap-2 mb-2">
                    <CreditCard className="h-8 w-8 text-blue-400" />
                    <h2 className="text-2xl font-bold">Calibration</h2>
                </div>
                <p className="text-sm text-gray-200">
                    Posez une carte standard (bancaire, fidélité) sur le dos de votre main.
                </p>
                <p className="text-sm font-semibold text-blue-300">
                    Ajustez le cadre bleu pour qu'il corresponde exactement à la taille de votre carte.
                </p>
            </div>

            {/* Zone de visualisation */}
            <div className="relative w-full max-w-lg aspect-video flex items-center justify-center mb-8 pointer-events-none">
                {/* Le cadre de référence */}
                <div
                    className="border-2 border-blue-500 bg-blue-500/10 shadow-[0_0_15px_rgba(59,130,246,0.5)] relative"
                    style={{
                        width: currentWidthPx,
                        height: currentHeightPx,
                        transition: 'width 0.1s, height 0.1s'
                    }}
                >
                    {/* Lignes guides */}
                    <div className="absolute inset-0 border border-blue-300/30 opacity-50" />
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-blue-400/30" />
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-blue-400/30" />

                    <div className="absolute -top-6 left-0 right-0 text-center text-xs font-mono text-blue-300">
                        85.6 mm
                    </div>
                </div>
            </div>

            {/* Contrôles */}
            <div className="w-full max-w-xs space-y-6">
                <div className="space-y-4">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>Plus petit</span>
                        <span>Plus grand</span>
                    </div>

                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={sliderValue}
                        onChange={(e) => setSliderValue(Number(e.target.value))}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                <Button
                    onClick={handleSave}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6 shadow-lg shadow-blue-900/20"
                >
                    <Check className="mr-2 h-5 w-5" />
                    Valider la Calibration
                </Button>
            </div>
        </div>
    );
}
