import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store pour ajuster la position et l'échelle de la bague 3D
 * Permet d'affiner manuellement le positionnement sur le doigt
 */
interface RingAdjustmentState {
    // Position sur le doigt (0 = base MCP, 1 = bout TIP)
    t: number;

    // Offsets de position (en unités 3D)
    offsetX: number;
    offsetY: number;
    offsetZ: number;

    // Échelle (0.6 = 60%, 1.4 = 140%)
    scale: number;

    // Rotations (en degrés) - pour fine-tuning si nécessaire
    rotationX: number;
    rotationY: number;
    rotationZ: number;

    // Actions
    setT: (value: number) => void;
    setOffsetX: (value: number) => void;
    setOffsetY: (value: number) => void;
    setOffsetZ: (value: number) => void;
    setScale: (value: number) => void;
    setRotationX: (value: number) => void;
    setRotationY: (value: number) => void;
    setRotationZ: (value: number) => void;
    reset: () => void;
}

const DEFAULT_VALUES = {
    t: 0.5,        // Position par défaut (0.5 = milieu de l'os)
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    scale: 1.0,     // 100%
    rotationX: 0,   // Pas de correction nécessaire si le cylindre est bien orienté
    rotationY: 0,
    rotationZ: 0,
};

export const useRingAdjustmentStore = create<RingAdjustmentState>()((set) => ({
    ...DEFAULT_VALUES,

    setT: (value) => set({ t: value }),
    setOffsetX: (value) => set({ offsetX: value }),
    setOffsetY: (value) => set({ offsetY: value }),
    setOffsetZ: (value) => set({ offsetZ: value }),
    setScale: (value) => set({ scale: value }),
    setRotationX: (value) => set({ rotationX: value }),
    setRotationY: (value) => set({ rotationY: value }),
    setRotationZ: (value) => set({ rotationZ: value }),

    reset: () => set(DEFAULT_VALUES),
}));