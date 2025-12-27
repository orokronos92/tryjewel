import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Store pour ajuster la position et l'échelle du squelette vert
 * afin de le superposer parfaitement à la vidéo
 */
interface SkeletonAdjustmentState {
  // Offsets de position (en pixels)
  offsetX: number;
  offsetY: number;

  // Facteurs d'échelle indépendants (1.0 = 100%)
  scaleX: number;
  scaleY: number;

  // Actions
  setOffsetX: (value: number) => void;
  setOffsetY: (value: number) => void;
  setScaleX: (value: number) => void;
  setScaleY: (value: number) => void;
  reset: () => void;
}

const DEFAULT_VALUES = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1.0,
  scaleY: 1.0,
};

export const useSkeletonAdjustmentStore = create<SkeletonAdjustmentState>()((set) => ({
  ...DEFAULT_VALUES,

  setOffsetX: (value) => set({ offsetX: value }),
  setOffsetY: (value) => set({ offsetY: value }),
  setScaleX: (value) => set({ scaleX: value }),
  setScaleY: (value) => set({ scaleY: value }),

  reset: () => set(DEFAULT_VALUES),
}));
