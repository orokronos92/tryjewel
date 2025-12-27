/**
 * =============================================================================
 * CAMERA-STORE.TS - VERSION 6.0 - LA VERSION QUI MARCHE
 * =============================================================================
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FacingMode = 'user' | 'environment';

interface CameraState {
  isActive: boolean;
  isVideoReady: boolean;
  stream: MediaStream | null;
  error: string | null;
  facingMode: FacingMode;
  shouldMirror: boolean;
  canSwitchCamera: boolean;
  isMobile: boolean;
}

interface CameraStore {
  camera: CameraState;
  setCameraActive: (isActive: boolean) => void;
  setVideoReady: (ready: boolean) => void;
  setStream: (stream: MediaStream | null) => void;
  setError: (error: string | null) => void;
  setFacingMode: (mode: FacingMode) => void;
  setCanSwitchCamera: (can: boolean) => void;
  setIsMobile: (mobile: boolean) => void;
}

const defaultState: CameraState = {
  isActive: false,
  isVideoReady: false,
  stream: null,
  error: null,
  facingMode: 'user',
  shouldMirror: true,
  canSwitchCamera: false,
  isMobile: false,
};

export const useCameraStore = create<CameraStore>()(
  persist(
    (set) => ({
      camera: { ...defaultState },

      setCameraActive: (isActive) => {
        set((state) => ({
          camera: { ...state.camera, isActive }
        }));
      },

      setVideoReady: (ready) => {
        set((state) => ({
          camera: { ...state.camera, isVideoReady: ready }
        }));
      },

      setStream: (stream) => {
        set((state) => ({
          camera: { ...state.camera, stream }
        }));
      },

      setError: (error) => {
        set((state) => ({
          camera: { ...state.camera, error }
        }));
      },

      // ⚡ Auto-calcul du shouldMirror
      setFacingMode: (mode) => {
        set((state) => ({
          camera: {
            ...state.camera,
            facingMode: mode,
            shouldMirror: mode === 'user', // Selfie = miroir
          }
        }));
      },

      setCanSwitchCamera: (can) => {
        set((state) => ({
          camera: { ...state.camera, canSwitchCamera: can }
        }));
      },

      setIsMobile: (mobile) => {
        set((state) => ({
          camera: { ...state.camera, isMobile: mobile }
        }));
      },
    }),
    {
      name: 'camera-store-v6',
      partialize: (state) => ({
        camera: {
          facingMode: state.camera.facingMode,
          canSwitchCamera: state.camera.canSwitchCamera,
        }
      }),
    }
  )
);

export default useCameraStore;