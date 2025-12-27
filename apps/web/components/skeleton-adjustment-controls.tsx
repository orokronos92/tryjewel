"use client";

import { useSkeletonAdjustmentStore } from "@/stores/skeleton-adjustment-store";
import { RotateCcw } from "lucide-react";

/**
 * Composant de contrôle pour ajuster le squelette vert
 * Permet de régler la position (X, Y) et l'échelle pour superposer le squelette à la vidéo
 */
export function SkeletonAdjustmentControls() {
    const { offsetX, offsetY, scaleX, scaleY, setOffsetX, setOffsetY, setScaleX, setScaleY, reset } = useSkeletonAdjustmentStore();

    return (
        <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg p-4 text-white w-80 z-50">
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Ajustement Squelette</h3>
                <button
                    onClick={reset}
                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                    title="Réinitialiser"
                >
                    <RotateCcw size={16} />
                </button>
            </div>

            <div className="space-y-3 text-xs">
                {/* Offset X */}
                <div>
                    <div className="flex justify-between mb-1">
                        <label>Position X</label>
                        <span className="text-gray-400">{offsetX.toFixed(0)}px</span>
                    </div>
                    <input
                        type="range"
                        min="-200"
                        max="200"
                        step="1"
                        value={offsetX}
                        onChange={(e) => setOffsetX(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                </div>

                {/* Offset Y */}
                <div>
                    <div className="flex justify-between mb-1">
                        <label>Position Y</label>
                        <span className="text-gray-400">{offsetY.toFixed(0)}px</span>
                    </div>
                    <input
                        type="range"
                        min="-200"
                        max="200"
                        step="1"
                        value={offsetY}
                        onChange={(e) => setOffsetY(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                    />
                </div>

                {/* Scale X */}
                <div>
                    <div className="flex justify-between mb-1">
                        <label>Échelle X</label>
                        <span className="text-gray-400">{(scaleX * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.01"
                        value={scaleX}
                        onChange={(e) => setScaleX(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    />
                </div>

                {/* Scale Y */}
                <div>
                    <div className="flex justify-between mb-1">
                        <label>Échelle Y</label>
                        <span className="text-gray-400">{(scaleY * 100).toFixed(0)}%</span>
                    </div>
                    <input
                        type="range"
                        min="0.5"
                        max="1.5"
                        step="0.01"
                        value={scaleY}
                        onChange={(e) => setScaleY(Number(e.target.value))}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                    />
                </div>
            </div>
        </div>
    );
}
