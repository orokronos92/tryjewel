"use client";

import { useState } from "react";
import { useSkeletonAdjustmentStore } from "@/stores/skeleton-adjustment-store";
import { useRingAdjustmentStore } from "@/stores/ring-adjustment-store";
import { RotateCcw, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Composant de contrÃ´le pour ajuster le squelette et la bague AR
 * Widget avec sections dÃ©roulantes pour organiser les contrÃ´les
 */
export function ARAdjustmentControls() {
    const [openSection, setOpenSection] = useState<'skeleton' | 'ring' | null>('skeleton');

    // Skeleton store
    const skeleton = useSkeletonAdjustmentStore();

    // Ring store
    const ring = useRingAdjustmentStore();

    const toggleSection = (section: 'skeleton' | 'ring') => {
        setOpenSection(openSection === section ? null : section);
    };

    return (
        <div className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-sm rounded-lg text-white w-40 z-50">
            {/* Header */}
            <div className="p-2 border-b border-white/10">
                <h3 className="font-semibold text-xs">Ajustements</h3>
            </div>

            {/* Section Squelette */}
            <div className="border-b border-white/10">
                <div
                    onClick={() => toggleSection('skeleton')}
                    className="w-full px-2 py-1.5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                >
                    <span className="text-[10px] font-medium">Squelette</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                skeleton.reset();
                            }}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                            title="RÃ©initialiser"
                        >
                            <RotateCcw size={14} />
                        </button>
                        {openSection === 'skeleton' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>

                {openSection === 'skeleton' && (
                    <div className="px-2 pb-2 space-y-1.5 text-[10px]">
                        {/* Position X */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Position X</label>
                                <span className="text-gray-400">{skeleton.offsetX.toFixed(0)}px</span>
                            </div>
                            <input
                                type="range"
                                min="-200"
                                max="200"
                                step="1"
                                value={skeleton.offsetX}
                                onChange={(e) => skeleton.setOffsetX(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                        </div>

                        {/* Position Y */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Position Y</label>
                                <span className="text-gray-400">{skeleton.offsetY.toFixed(0)}px</span>
                            </div>
                            <input
                                type="range"
                                min="-200"
                                max="200"
                                step="1"
                                value={skeleton.offsetY}
                                onChange={(e) => skeleton.setOffsetY(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                        </div>

                        {/* Position Z */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Position Z</label>
                                <span className="text-gray-400">{skeleton.offsetZ.toFixed(0)}px</span>
                            </div>
                            <input
                                type="range"
                                min="-200"
                                max="200"
                                step="1"
                                value={skeleton.offsetZ}
                                onChange={(e) => skeleton.setOffsetZ(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                        </div>

                        {/* Échelle X */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Largeur (X)</label>
                                <span className="text-gray-400">{(skeleton.scaleX * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="1.5"
                                step="0.01"
                                value={skeleton.scaleX}
                                onChange={(e) => skeleton.setScaleX(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                        </div>

                        {/* Échelle Y */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Hauteur (Y)</label>
                                <span className="text-gray-400">{(skeleton.scaleY * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.5"
                                max="1.5"
                                step="0.01"
                                value={skeleton.scaleY}
                                onChange={(e) => skeleton.setScaleY(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Section Bague */}
            <div>
                <div
                    onClick={() => toggleSection('ring')}
                    className="w-full px-2 py-1.5 flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer"
                >
                    <span className="text-[10px] font-medium">Bague</span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                ring.reset();
                            }}
                            className="p-1 hover:bg-white/10 rounded transition-colors"
                            title="RÃ©initialiser"
                        >
                            <RotateCcw size={14} />
                        </button>
                        {openSection === 'ring' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                </div>

                {openSection === 'ring' && (
                    <div className="px-2 pb-2 space-y-1.5 text-[10px]">
                        {/* Position sur doigt */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Position sur doigt</label>
                                <span className="text-gray-400">{(ring.t * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={ring.t}
                                onChange={(e) => ring.setT(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>

                        {/* Offset X */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Offset X</label>
                                <span className="text-gray-400">{ring.offsetX.toFixed(3)}</span>
                            </div>
                            <input
                                type="range"
                                min="-0.1"
                                max="0.1"
                                step="0.001"
                                value={ring.offsetX}
                                onChange={(e) => ring.setOffsetX(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>

                        {/* Offset Y */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Offset Y</label>
                                <span className="text-gray-400">{ring.offsetY.toFixed(3)}</span>
                            </div>
                            <input
                                type="range"
                                min="-0.1"
                                max="0.1"
                                step="0.001"
                                value={ring.offsetY}
                                onChange={(e) => ring.setOffsetY(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>

                        {/* Offset Z */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Offset Z</label>
                                <span className="text-gray-400">{ring.offsetZ.toFixed(3)}</span>
                            </div>
                            <input
                                type="range"
                                min="-0.1"
                                max="0.1"
                                step="0.001"
                                value={ring.offsetZ}
                                onChange={(e) => ring.setOffsetZ(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>

                        {/* Ã‰chelle */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Ã‰chelle</label>
                                <span className="text-gray-400">{(ring.scale * 100).toFixed(0)}%</span>
                            </div>
                            <input
                                type="range"
                                min="0.6"
                                max="1.4"
                                step="0.01"
                                value={ring.scale}
                                onChange={(e) => ring.setScale(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>

                        {/* Rotation X */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Rotation X</label>
                                <span className="text-gray-400">{ring.rotationX.toFixed(1)}Â°</span>
                            </div>
                            <input
                                type="range"
                                min="-180"
                                max="180"
                                step="1"
                                value={ring.rotationX}
                                onChange={(e) => ring.setRotationX(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>

                        {/* Rotation Y */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Rotation Y</label>
                                <span className="text-gray-400">{ring.rotationY.toFixed(1)}Â°</span>
                            </div>
                            <input
                                type="range"
                                min="-180"
                                max="180"
                                step="1"
                                value={ring.rotationY}
                                onChange={(e) => ring.setRotationY(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>

                        {/* Rotation Z */}
                        <div>
                            <div className="flex justify-between mb-0.5">
                                <label>Rotation Z</label>
                                <span className="text-gray-400">{ring.rotationZ.toFixed(1)}Â°</span>
                            </div>
                            <input
                                type="range"
                                min="-180"
                                max="180"
                                step="1"
                                value={ring.rotationZ}
                                onChange={(e) => ring.setRotationZ(Number(e.target.value))}
                                className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}