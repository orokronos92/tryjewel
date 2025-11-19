import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Zustand store for camera management
 */

type FacingMode = 'user' | 'environment';

type VideoConstraints = {
  width: number;
  height: number;
  facingMode: FacingMode;
};

interface CameraState {
  isActive: boolean;
  isVideoReady: boolean;
  error: string | null;
  currentCameraId: string | null;
  constraints: VideoConstraints;
  stream: MediaStream | null;
  permissionStatus: PermissionState;
}

interface CameraStoreState {
  camera: CameraState;
  availableCameras: MediaDeviceInfo[];
  isLoadingCameras: boolean;

  setCameraActive: (active: boolean) => void;
  setVideoReady: (ready: boolean) => void;
  setError: (error: string | null) => void;
  setCurrentCamera: (deviceId: string) => void;
  setConstraints: (constraints: Partial<VideoConstraints>) => void;
  setStream: (stream: MediaStream | null) => void;
  setPermissionStatus: (status: PermissionState) => void;

  loadCameras: () => Promise<MediaDeviceInfo[]>;
  clearError: () => void;

  getConstraints: () => VideoConstraints;
  getSettings: () => MediaTrackSettings | null;
}

const defaultConstraints: VideoConstraints = {
  width: 1280,
  height: 720,
  facingMode: 'user'
};

const defaultCameraState: CameraState = {
  isActive: false,
  isVideoReady: false,
  error: null,
  currentCameraId: null,
  constraints: { ...defaultConstraints },
  stream: null,
  permissionStatus: 'prompt'
};

export const useCameraStore = create<CameraStoreState>()(
  persist(
    (set, get) => ({
      camera: { ...defaultCameraState },
      availableCameras: [],
      isLoadingCameras: false,

      setCameraActive: (active: boolean) =>
        set((state) => ({
          camera: { ...state.camera, isActive: active }
        })),

      setVideoReady: (ready: boolean) =>
        set((state) => ({
          camera: { ...state.camera, isVideoReady: ready }
        })),

      setError: (error: string | null) =>
        set((state) => ({
          camera: { ...state.camera, error }
        })),

      setCurrentCamera: (deviceId: string) =>
        set((state) => ({
          camera: { ...state.camera, currentCameraId: deviceId }
        })),

      setConstraints: (constraints: Partial<VideoConstraints>) =>
        set((state) => ({
          camera: {
            ...state.camera,
            constraints: { ...state.camera.constraints, ...constraints }
          }
        })),

      setStream: (stream: MediaStream | null) =>
        set((state) => ({
          camera: { ...state.camera, stream }
        })),

      setPermissionStatus: (status: PermissionState) =>
        set((state) => ({
          camera: { ...state.camera, permissionStatus: status }
        })),

      loadCameras: async () => {
        set({ isLoadingCameras: true });
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const cameras = devices.filter(d => d.kind === 'videoinput');
          set({ availableCameras: cameras });
          return cameras;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Failed to load cameras';
          get().setError(errorMessage);
          throw error;
        } finally {
          set({ isLoadingCameras: false });
        }
      },

      clearError: () =>
        set((state) => ({
          camera: { ...state.camera, error: null }
        })),

      getConstraints: () => {
        return get().camera.constraints;
      },

      getSettings: () => {
        const stream = get().camera.stream;
        if (!stream) return null;
        const tracks = stream.getVideoTracks();
        if (tracks.length === 0) return null;
        return tracks[0].getSettings();
      }
    }),
    {
      name: 'camera-store',
      partialize: (state) => ({
        camera: {
          constraints: state.camera.constraints,
          currentCameraId: state.camera.currentCameraId
        }
      })
    }
  )
);

// Selectors
export const useCameraActive = () => useCameraStore((state) => state.camera.isActive);
export const useCameraError = () => useCameraStore((state) => state.camera.error);
export const useCameraVideoReady = () => useCameraStore((state) => state.camera.isVideoReady);
export const useAvailableCameras = () => useCameraStore((state) => state.availableCameras);
export const useCurrentCameraId = () => useCameraStore((state) => state.camera.currentCameraId);
export const useCameraConstraints = () => useCameraStore((state) => state.camera.constraints);
export const useCameraStream = () => useCameraStore((state) => state.camera.stream);
export const useCameraPermission = () => useCameraStore((state) => state.camera.permissionStatus);
