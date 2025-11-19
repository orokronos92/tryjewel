import { useJewelryStore, type Finger, type Hand } from '@/stores/jewelry-store';

export interface UseFingerSelectionReturn {
  selectedFinger: Finger;
  selectedHand: Hand;
  setFinger: (finger: Finger) => void;
  setHand: (hand: Hand) => void;
}

export function useFingerSelection(): UseFingerSelectionReturn {
  const { selected, setFinger, setHand } = useJewelryStore();

  return {
    selectedFinger: selected.finger,
    selectedHand: selected.hand,
    setFinger,
    setHand,
  };
}
