import { useState, useRef, useEffect } from 'react';
import { useCameraStore } from '@/stores/camera-store';
import { useCameraStore as cameraStore } from '@/stores/camera-store';
import { clearError, setVideoReady } from '@/stores/camera-store';

export interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement>;
  stream: MediaStream | null;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  toggleCamera: () => Promise<void>;
  switchCamera: (deviceId: string) => Promise<void>;
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { camera, setCameraActive, setError, setStream } = useCameraStore();

  const clearError = () => {
    useCameraStore.getState().setError(null);
  };

  const startCamera = async () => {
    setIsLoading(true);
    clearError();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: camera.constraints.width || 1280 },
          height: { ideal: camera.constraints.height || 720 },
          facingMode: camera.constraints.facingMode || 'user',
          deviceId: camera.currentCameraId ? { exact: camera.currentCameraId } : undefined,
        },
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Vérifier permission status (optionnel)
      try {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        // Store la permission si besoin
        console.log('[useWebcam] Permission status:', permission.state);
      } catch {
        // Permission API pas disponible sur tous navigateurs
        console.log('[useWebcam] Permission API non disponible');
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Accès caméra refusé';
      setError(errorMessage);
      console.error('[useWebcam] Erreur démarrage caméra:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (camera.stream) {
      camera.stream.getTracks().forEach(track => {
        track.stop();
        console.log('[useWebcam] Track arrêté:', track.kind);
      });
      setStream(null);
      setCameraActive(false);
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  const toggleCamera = async () => {
    if (camera.isActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  const switchCamera = async (deviceId: string) => {
    if (camera.stream) {
      stopCamera();
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } }
    });
    setStream(stream);
    setCameraActive(true);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  // Connecter stream au video element quand il change
  useEffect(() => {
    if (videoRef.current && camera.stream) {
      videoRef.current.srcObject = camera.stream;

      // Listener pour savoir quand vidéo est prête
      const handleLoadedMetadata = () => {
        console.log('[useWebcam] Vidéo prête');
        useCameraStore.getState().setVideoReady(true);
      };

      videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);

      return () => {
        videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [camera.stream]);

  // Cleanup au unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return {
    videoRef,
    stream: camera.stream,
    isActive: camera.isActive,
    isLoading,
    error: camera.error,
    startCamera,
    stopCamera,
    toggleCamera,
    switchCamera,
  };
}
