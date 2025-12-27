import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CalibrationState {
    isCalibrated: boolean;

    // La largeur de la carte de crédit (85.6mm) en pixels telle que vue par la caméra
    // lors de l'étape de calibration.
    calibrationCardWidthPx: number;

    // UI State
    isCalibrating: boolean;

    // Actions
    setCalibration: (widthPx: number) => void;
    resetCalibration: () => void;
    setIsCalibrating: (value: boolean) => void;
}

export const useCalibrationStore = create<CalibrationState>()(
    persist(
        (set) => ({
            isCalibrated: false,
            calibrationCardWidthPx: 0,
            isCalibrating: false,

            setCalibration: (widthPx) => set({
                isCalibrated: true,
                calibrationCardWidthPx: widthPx,
                isCalibrating: false
            }),

            resetCalibration: () => set({
                isCalibrated: false,
                calibrationCardWidthPx: 0
            }),

            setIsCalibrating: (value) => set({ isCalibrating: value }),
        }),
        {
            name: 'ar-jewel-calibration',
        }
    )
);
