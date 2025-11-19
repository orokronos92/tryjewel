import { useEffect, useRef } from 'react';
import { useTrackingStore } from '@/stores/tracking-store';

export interface UseARTrackingReturn {
  isConnected: boolean;
  isTracking: boolean;
  lastResult: any | null;
  startTracking: () => void;
  stopTracking: () => void;
  sendFrame: (frameData: string) => Promise<void>;
}

export function useARTracking(videoElement: HTMLVideoElement | null): UseARTrackingReturn {
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const { tracking, startTracking, stopTracking } = useTrackingStore();

  const connectWebSocket = () => {
    console.log('WebSocket connection: Todo');
  };

  const sendFrame = async (frameData: string) => {
    if (!videoElement) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0);

    const frame = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

    // TODO: Envoyer via WebSocket
    console.log('Sending frame:', frame.substring(0, 50) + '...');
  };

  const startFrameLoop = () => {
    if (frameIntervalRef.current) return;

    frameIntervalRef.current = setInterval(() => {
      if (videoElement && videoElement.readyState >= 2) {
        sendFrame('');
      }
    }, 50);
  };

  const stopFrameLoop = () => {
    if (frameIntervalRef.current) {
      clearInterval(frameIntervalRef.current);
      frameIntervalRef.current = null;
    }
  };

  useEffect(() => {
    connectWebSocket();
    return () => {
      stopFrameLoop();
    };
  }, []);

  return {
    isConnected: false, // TODO: Implement WebSocket connection
    isTracking: tracking.is_tracking,
    lastResult: tracking.last_result,
    startTracking: () => {
      startTracking();
      startFrameLoop();
    },
    stopTracking: () => {
      stopTracking();
      stopFrameLoop();
    },
    sendFrame,
  };
}
