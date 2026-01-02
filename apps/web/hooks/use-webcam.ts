/**
 * =============================================================================
 * USE-WEBCAM.TS - VERSION 6.0 - LA VERSION QUI MARCHE
 * =============================================================================
 * 
 * - Délai 1500ms si caméra active, 300ms sinon
 * - Mobile = canSwitchCamera true immédiatement
 * - Contraintes simples { facingMode: mode }
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useCameraStore } from '@/stores/camera-store';
import { arDbg } from '@/lib/debug-logger';

export type FacingMode = 'user' | 'environment';

export interface UseWebcamReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  isActive: boolean;
  isLoading: boolean;
  error: string | null;
  facingMode: FacingMode;
  shouldMirror: boolean;
  canSwitchCamera: boolean;
  isMobile: boolean;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  toggleCamera: () => Promise<void>;
  switchCamera: (deviceId: string) => Promise<void>;
  switchFacingMode: () => Promise<void>;
}

function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Types pour les caméras
interface CameraDevice {
  deviceId: string;
  label: string;
  type: 'front' | 'back' | 'unknown';
}

export function useWebcam(): UseWebcamReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  // ⚡ Liste des caméras par deviceId
  const [cameras, setCameras] = useState<CameraDevice[]>([]);
  const [currentCameraIndex, setCurrentCameraIndex] = useState(0);

  const {
    camera,
    setCameraActive,
    setVideoReady,
    setStream,
    setError,
    setFacingMode,
    setCanSwitchCamera,
    setIsMobile,
  } = useCameraStore();

  const isMobile = detectMobile();

  // ⚡ ÉNUMÉRER LES CAMÉRAS PAR DEVICEID
  useEffect(() => {
    async function enumerateCameras() {
      try {
        // D'abord demander la permission
        const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
        tempStream.getTracks().forEach(t => t.stop());

        // Ensuite énumérer
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(d => d.kind === 'videoinput');

        const cameraList: CameraDevice[] = videoDevices.map(device => {
          const label = device.label.toLowerCase();
          let type: 'front' | 'back' | 'unknown' = 'unknown';

          if (label.includes('front') || label.includes('user') || label.includes('selfie') || label.includes('facing front')) {
            type = 'front';
          } else if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('facing back')) {
            type = 'back';
          }

          return {
            deviceId: device.deviceId,
            label: device.label,
            type,
          };
        });

        setCameras(cameraList);
        setCanSwitchCamera(cameraList.length > 1);
        setIsMobile(isMobile);

      } catch (err) {
        setIsMobile(isMobile);
        if (isMobile) setCanSwitchCamera(true);
      }
    }

    enumerateCameras();
  }, [isMobile, setCanSwitchCamera, setIsMobile]);

  // =========================================================================
  // START CAMERA
  // =========================================================================

  const startWithMode = useCallback(async (mode: FacingMode): Promise<boolean> => {
    try {
      // ⚡ Optimisation Résolution: 640x480 sur mobile pour MediaPipe
      const videoConstraints: MediaTrackConstraints = isMobile
        ? {
          facingMode: mode,
          width: { ideal: 640 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 }
        }
        : {
          facingMode: mode,
          width: { ideal: 1280 }, // 720p sur PC pour la qualité
          height: { ideal: 720 }
        };

      const constraints: MediaStreamConstraints = {
        video: videoConstraints,
        audio: false,
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      setStream(mediaStream);
      setCameraActive(true);
      setFacingMode(mode);
      setLocalError(null);
      setError(null);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => { });
        setVideoReady(true);

        // 🔍 DEBUG: Log startup info
        const track = mediaStream.getVideoTracks()[0];
        const settings = track?.getSettings();
        arDbg.startup({
          device: {
            isMobile,
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            cores: navigator.hardwareConcurrency || 0,
            memory: (navigator as unknown as { deviceMemory?: number }).deviceMemory || null,
          },
          config: {
            frameSkip: isMobile ? 2 : 1,
            useWorker: true,
            occludersEnabled: true,
          },
          camera: {
            requested: {
              width: isMobile ? 640 : 1280,
              height: isMobile ? 480 : 720,
            },
            actual: {
              width: settings?.width || 0,
              height: settings?.height || 0,
            },
            facingMode: mode,
            label: track?.label || 'unknown',
          },
        });

        arDbg.cam({
          event: 'started',
          requested: { width: isMobile ? 640 : 1280, height: isMobile ? 480 : 720 },
          actual: { width: settings?.width || 0, height: settings?.height || 0 },
          facingMode: mode,
          label: track?.label || 'unknown',
        });
      }

      return true;

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur caméra';
      setLocalError(msg);
      setError(msg);
      return false;
    }
  }, [setStream, setCameraActive, setFacingMode, setVideoReady, setError]);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    const mode = useCameraStore.getState().camera.facingMode;
    await startWithMode(mode);
    setIsLoading(false);
  }, [startWithMode]);

  // =========================================================================
  // STOP CAMERA - Reset complet pour Samsung
  // =========================================================================

  const stopCamera = useCallback(() => {
    // 🔍 DEBUG: Log camera stop
    arDbg.cam({ event: 'stopped' });

    // 1. Stopper via store
    const stream = useCameraStore.getState().camera.stream;
    if (stream) {
      stream.getTracks().forEach(track => {
        track.stop();
      });
    }

    // 2. Nettoyer le video element complètement
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.load(); // Force reset hardware
    }

    // 3. Update store
    setStream(null);
    setCameraActive(false);
    setVideoReady(false);
  }, [setStream, setCameraActive, setVideoReady]);

  // =========================================================================
  // TOGGLE
  // =========================================================================

  const toggleCamera = useCallback(async () => {
    if (camera.isActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  }, [camera.isActive, stopCamera, startCamera]);

  // =========================================================================
  // SWITCH BY DEVICEID
  // =========================================================================

  const switchCamera = useCallback(async (deviceId: string) => {
    setIsLoading(true);
    stopCamera();
    await new Promise(r => setTimeout(r, 500));

    try {
      const videoConstraints: MediaTrackConstraints = isMobile
        ? { deviceId: { exact: deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
        : { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } };

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      setStream(mediaStream);
      setCameraActive(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => { });
      }
    } catch {
      setLocalError('Erreur switch');
    }

    setIsLoading(false);
  }, [stopCamera, setStream, setCameraActive]);

  // =========================================================================
  // ⚡ SWITCH FACING MODE - PAR DEVICEID (méthode Gemini)
  // =========================================================================

  const switchFacingMode = useCallback(async () => {
    if (cameras.length < 2) {
      return;
    }

    setIsLoading(true);
    setLocalError(null);
    setError(null);

    // 1. Stop complet
    stopCamera();

    // 2. Délai pour libérer la caméra - 3000ms pour Samsung
    await new Promise(r => setTimeout(r, 3000));

    // 3. Passer à la caméra suivante
    const nextIndex = (currentCameraIndex + 1) % cameras.length;
    const nextCamera = cameras[nextIndex];

    try {
      // ⚡ UTILISER DEVICEID + Résolution optimisée
      const videoConstraints: MediaTrackConstraints = isMobile
        ? { deviceId: { exact: nextCamera.deviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
        : { deviceId: { exact: nextCamera.deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } };

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: false,
      });

      setStream(mediaStream);
      setCameraActive(true);
      setCurrentCameraIndex(nextIndex);

      // Mettre à jour le facingMode pour le mirroring
      const newMode = nextCamera.type === 'front' ? 'user' : 'environment';
      setFacingMode(newMode);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play().catch(() => { });
        setVideoReady(true);

        // 🔍 DEBUG: Log camera switch
        const track = mediaStream.getVideoTracks()[0];
        const settings = track?.getSettings();
        arDbg.cam({
          event: 'switched',
          requested: { width: isMobile ? 640 : 1280, height: isMobile ? 480 : 720 },
          actual: { width: settings?.width || 0, height: settings?.height || 0 },
          facingMode: newMode,
          label: track?.label || 'unknown',
        });
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur switch';
      setLocalError(msg);
      setError(msg);

      // Fallback: réessayer l'ancienne caméra
      await new Promise(r => setTimeout(r, 500));
      await startCamera();
    }

    setIsLoading(false);
  }, [cameras, currentCameraIndex, stopCamera, setStream, setCameraActive, setFacingMode, setVideoReady, setError, startCamera, isMobile]);

  // =========================================================================
  // SYNC VIDEO ELEMENT
  // =========================================================================

  useEffect(() => {
    if (videoRef.current && camera.stream) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  // =========================================================================
  // CLEANUP
  // =========================================================================

  useEffect(() => {
    return () => {
      const stream = useCameraStore.getState().camera.stream;
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    videoRef,
    stream: camera.stream,
    isActive: camera.isActive,
    isLoading,
    error: localError || camera.error,
    facingMode: camera.facingMode,
    shouldMirror: camera.shouldMirror,
    canSwitchCamera: camera.canSwitchCamera,
    isMobile: camera.isMobile,
    startCamera,
    stopCamera,
    toggleCamera,
    switchCamera,
    switchFacingMode,
  };
}

export default useWebcam;