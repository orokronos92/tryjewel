import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';

/**
 * Zustand store for jewelry selection and state management
 */

// Enums for jewelry types
export const JEWELRY_TYPES = ['ring', 'bracelet', 'earring', 'necklace'] as const;
export const FINGERS = ['thumb', 'index', 'middle', 'ring', 'pinky'] as const;
export const HANDS = ['left', 'right'] as const;

export type JewelryType = typeof JEWELRY_TYPES[number];
export type Finger = typeof FINGERS[number];
export type Hand = typeof HANDS[number];

// Jewelry item interface
export interface JewelryItem {
  id: string;
  type: JewelryType;
  name: string;
  material: string;
  color: string;
  model_url?: string;
  thumbnail_url?: string;
  price?: number;
  metadata?: Record<string, any>;
}

// Selected jewelry configuration
export interface SelectedJewelry {
  jewelry_id: string | null;
  jewelry_type: JewelryType | null;
  finger: Finger;
  hand: Hand;
  placement: 'hand' | 'wrist' | 'ear' | 'neck' | null;
}

// Store state interface
interface JewelryStoreState {
  // Current selection
  selected: SelectedJewelry;

  // Available jewelry items
  available_jewelry: JewelryItem[];

  // UI state
  is_selector_open: boolean;
  is_loading: boolean;

  // Actions
  setSelectedJewelry: (jewelry: Partial<SelectedJewelry>) => void;
  setJewelryType: (type: JewelryType) => void;
  setFinger: (finger: Finger) => void;
  setHand: (hand: Hand) => void;
  setPlacement: (placement: SelectedJewelry['placement']) => void;

  // Jewelry management
  addJewelry: (item: JewelryItem) => void;
  removeJewelry: (id: string) => void;
  loadJewelry: (items: JewelryItem[]) => void;
  clearSelection: () => void;

  // UI actions
  openSelector: () => void;
  closeSelector: () => void;
  toggleSelector: () => void;
}

// Default state
const defaultSelected: SelectedJewelry = {
  jewelry_id: null,
  jewelry_type: null,
  finger: 'index',
  hand: 'right',
  placement: null
};

// Store implementation
export const useJewelryStore = create<JewelryStoreState>()(
  persist(
    (set, get) => ({
      // State
      selected: { ...defaultSelected },
      available_jewelry: [],
      is_selector_open: false,
      is_loading: false,

      // Selection actions
      setSelectedJewelry: (jewelry) =>
        set((state) => ({
          selected: { ...state.selected, ...jewelry }
        })),

      setJewelryType: (type) =>
        set((state) => ({
          selected: { ...state.selected, jewelry_type: type, placement: getPlacementForType(type) }
        })),

      setFinger: (finger) =>
        set((state) => ({
          selected: { ...state.selected, finger }
        })),

      setHand: (hand) =>
        set((state) => ({
          selected: { ...state.selected, hand }
        })),

      setPlacement: (placement) =>
        set((state) => ({
          selected: { ...state.selected, placement }
        })),

      // Jewelry management
      addJewelry: (item) =>
        set((state) => ({
          available_jewelry: [...state.available_jewelry, item]
        })),

      removeJewelry: (id) =>
        set((state) => ({
          available_jewelry: state.available_jewelry.filter((item) => item.id !== id)
        })),

      loadJewelry: (items) =>
        set({
          available_jewelry: items
        }),

      clearSelection: () =>
        set({
          selected: { ...defaultSelected }
        }),

      // UI actions
      openSelector: () =>
        set({
          is_selector_open: true
        }),

      closeSelector: () =>
        set({
          is_selector_open: false
        }),

      toggleSelector: () =>
        set((state) => ({
          is_selector_open: !state.is_selector_open
        }))
    }),
    {
      name: 'jewelry-store',
      partialize: (state) => ({
        selected: state.selected,
        available_jewelry: state.available_jewelry
      })
    }
  )
);

// Helper function to determine placement based on jewelry type
function getPlacementForType(type: JewelryType): SelectedJewelry['placement'] {
  switch (type) {
    case 'ring':
      return 'hand';
    case 'bracelet':
      return 'wrist';
    case 'earring':
      return 'ear';
    case 'necklace':
      return 'neck';
    default:
      return null;
  }
}

// Selectors for computed values
export const useSelectedJewelry = () => useJewelryStore((state) => state.selected);
export const useAvailableJewelry = () => useJewelryStore((state) => state.available_jewelry);
export const useJewelrySelectorOpen = () => useJewelryStore((state) => state.is_selector_open);

// Jewelry type helpers
export const getJewelryIcon = (type: JewelryType): string => {
  const icons: Record<JewelryType, string> = {
    ring: '💍',
    bracelet: '⌚',
    earring: '💎',
    necklace: '📿'
  };
  return icons[type] || '💎';
};

export const getJewelryColor = (type: JewelryType): string => {
  const colors: Record<JewelryType, string> = {
    ring: '#FFD700',      // Gold
    bracelet: '#C0C0C0',  // Silver
    earring: '#FFD700',
    necklace: '#FFD700'
  };
  return colors[type] || '#FFD700';
};
