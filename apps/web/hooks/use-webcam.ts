import { useState, useRef, useEffect } from 'react';
import { useCameraStore } from '@/stores/camera-store';

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

  const startCamera = async () => {
    setIsLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        }
      });
      setStream(stream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Camera error');
    } finally {
      setIsLoading(false);
    }
  };

  const stopCamera = () => {
    if (camera.stream) {
      camera.stream.getTracks().forEach(track => track.stop());
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
