import { useEffect, useRef } from 'react';
import { useTrackingStore } from '@/stores/tracking-store';
import { useJewelryStore } from '@/stores/jewelry-store';

export function useARTracking(videoElement: HTMLVideoElement | null) {
  const frameIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastFrameTimeRef = useRef(0);

  const {
    tracking,
    socket,
    startTracking,
    stopTracking
  } = useTrackingStore();

  const { selected } = useJewelryStore();

  useEffect(() => {
    if (!tracking.is_tracking || !videoElement || !socket) return;

    console.log('[useARTracking] Starting frame capture loop');

    // Frame capture loop (10 FPS)
    frameIntervalRef.current = setInterval(async () => {
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        const startTime = performance.now();

        try {
          // Capture frame as base64
          const canvas = document.createElement('canvas');
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;

          const ctx = canvas.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(videoElement, 0, 0);

          // Convert to base64
          const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];

          // Send via WebSocket
          socket.emit('track_frame', {
            image_base64: base64Image,
            jewelry_type: selected.jewelry_type || 'ring',
            finger: selected.finger,
            hand: selected.hand,
            frame_id: `frame_${Date.now()}`,
            timestamp: Date.now(),
          });

          lastFrameTimeRef.current = startTime;

        } catch (error) {
          console.error('[useARTracking] Frame capture error:', error);
        }
      }
    }, 100); // 10 FPS = 100ms interval

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [tracking.is_tracking, videoElement, socket, selected]);

  // Listen for tracking results
  useEffect(() => {
    if (!socket) return;

    const handleTrackingResults = (result: any) => {
      const now = performance.now();
      const latency = now - lastFrameTimeRef.current;

      // Le store mettra à jour automatiquement via handleTrackingResult
      // TODO: Ajouter la latence au store si nécessaire
    };

    socket.on('tracking_results', handleTrackingResults);

    return () => {
      socket.off('tracking_results', handleTrackingResults);
    };
  }, [socket]);

  return {
    isTracking: tracking.is_tracking,
    isProcessing: tracking.is_processing,
    lastResult: tracking.last_result,
    startTracking,
    stopTracking,
  };
}

function calculateFPS() {
  // Simplified FPS calculation
  return 10; // TODO: Implement proper FPS tracking
}
