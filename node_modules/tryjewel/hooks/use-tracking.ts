import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {} from 'socket.io-client';
import {
  TrackingRequestSchema,
  TrackingRequest,
  TrackingResult,
  WebSocketFrame
} from '@/lib/schemas/tracking.schema';
import { useTrackingStore } from '@/stores/tracking-store';

/**
 * React Query hooks for tracking API and WebSocket
 */

// REST API hooks
export const useTrackingAPI = () => {
  const queryClient = useQueryClient();

  // Track single frame (REST API)
  const trackFrame = useMutation({
    mutationKey: ['tracking'],
    mutationFn: async (request: TrackingRequest): Promise<TrackingResult> => {
      const response = await fetch('http://localhost:5000/api/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // Validate with Zod
      const validation = TrackingRequestSchema.safeParse(request);
      if (!validation.success) {
        console.warn('Validation warning:', validation.error);
      }

      return result;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['tracking', 'last'], data);
    },
    onError: (error) => {
      console.error('Tracking error:', error);
    }
  });

  // Get last tracking result
  const lastResult = useQuery({
    queryKey: ['tracking', 'last'],
    queryFn: () => null as TrackingResult | null,
    staleTime: Infinity,
    initialData: null
  });

  // Get tracking history
  const history = useQuery({
    queryKey: ['tracking', 'history'],
    queryFn: () => {
      const stored = localStorage.getItem('tracking_results');
      return stored ? JSON.parse(stored) : [];
    },
    initialData: []
  });

  // Get health status
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const response = await fetch('http://localhost:5000/health');
      if (!response.ok) throw new Error('Health check failed');
      return response.json();
    },
    refetchInterval: 30000, // Refetch every 30 seconds
    staleTime: 30000
  });

  return {
    trackFrame: trackFrame.mutateAsync,
    isTracking: trackFrame.isPending,
    trackingError: trackFrame.error,
    lastResult: lastResult.data,
    history: history.data,
    health: health.data,
    isLoading: trackFrame.isPending || health.isLoading
  };
};

// WebSocket hook
export const useTrackingWebSocket = () => {
  const {
    socket,
    connection_status,
    tracking,
    config,
    initializeSocket,
    connect,
    disconnect,
    processFrame,
    startTracking,
    stopTracking,
    updateConfig
  } = useTrackingStore();

  // Initialize socket on mount
  useEffect(() => {
    if (!socket && connection_status === 'disconnected') {
      initializeSocket();
    }

    return () => {
      // Cleanup on unmount
      if (socket) {
        disconnect();
      }
    };
  }, [socket, connection_status, initializeSocket, disconnect]);

  // Auto-reconnect on connection loss
  useEffect(() => {
    if (connection_status === 'error') {
      const timer = setTimeout(() => {
        console.log('[WebSocket] Attempting to reconnect...');
        connect();
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [connection_status, connect]);

  // Process frames function
  const sendFrame = async (frameData: {
    image_base64: string;
    jewelry_type?: string;
    finger?: string;
    hand?: string;
    frame_id?: string;
  }): Promise<TrackingResult> => {
    if (!socket || connection_status !== 'connected') {
      throw new Error('WebSocket not connected');
    }

    if (!tracking.is_tracking) {
      startTracking();
    }

    const frame: WebSocketFrame = {
      image_base64: frameData.image_base64,
      jewelry_type: (frameData.jewelry_type || config.jewelry_type) as "ring" | "bracelet" | "earring" | "necklace",
      finger: (frameData.finger || config.finger) as "thumb" | "index" | "middle" | "ring" | "pinky",
      hand: (frameData.hand || config.hand) as "left" | "right",
      frame_id: frameData.frame_id || `frame_${Date.now()}`,
      timestamp: Date.now()
    };

    try {
      const result = await processFrame(frame);
      return result;
    } catch (error) {
      console.error('Frame processing error:', error);
      throw error;
    }
  };

  // Send ping for keep-alive
  const ping = () => {
    if (socket && connection_status === 'connected') {
      socket.emit('ping', { timestamp: Date.now() });
    }
  };

  return {
    // Connection
    socket,
    connectionStatus: connection_status,
    isConnected: connection_status === 'connected',
    connect,
    disconnect,
    ping,

    // Tracking
    isTracking: tracking.is_tracking,
    isProcessing: tracking.is_processing,
    startTracking,
    stopTracking,
    sendFrame,
    lastResult: tracking.last_result,

    // Configuration
    config,
    updateConfig,

    // Stats
    stats: {
      fps: tracking.processing_fps,
      latency: tracking.average_latency_ms,
      frameCount: tracking.frame_count,
      errorCount: tracking.error_count
    }
  };
};

// Combined hook (REST + WebSocket)
export const useTracking = () => {
  const api = useTrackingAPI();
  const ws = useTrackingWebSocket();
  const [mode, setMode] = useState<'rest' | 'websocket'>('websocket');

  // Switch between REST and WebSocket
  const switchMode = (newMode: 'rest' | 'websocket') => {
    if (newMode === 'rest' && ws.isConnected) {
      ws.disconnect();
    } else if (newMode === 'websocket' && !ws.isConnected) {
      ws.connect();
    }
    setMode(newMode);
  };

  // Process frame (auto-selects mode)
  const processFrame = async (
    frameData: string | WebSocketFrame,
    options?: {
      jewelry_type?: string;
      finger?: string;
      hand?: string;
      use_rest?: boolean;
    }
  ): Promise<TrackingResult> => {
    if (options?.use_rest || mode === 'rest') {
      // Use REST API
      const base64Data = typeof frameData === 'string' ? frameData : frameData.image_base64;
      const request: TrackingRequest = {
        image: {
          image_data: base64Data,
          mime_type: 'image/jpeg'
        },
        jewelry_type: (options?.jewelry_type || 'ring') as "ring" | "bracelet" | "earring" | "necklace",
        finger: (options?.finger || 'index') as "thumb" | "index" | "middle" | "ring" | "pinky",
        hand: (options?.hand || 'right') as "left" | "right",
        request_id: `request_${Date.now()}`
      };

      return api.trackFrame(request);
    } else {
      // Use WebSocket
      const base64Data = typeof frameData === 'string' ? frameData : frameData.image_base64;
      return ws.sendFrame({
        image_base64: base64Data,
        jewelry_type: options?.jewelry_type,
        finger: options?.finger,
        hand: options?.hand
      });
    }
  };

  // Get cache status
  const isCached = (frame_id: string): boolean => {
    const { result_cache } = useTrackingStore.getState();
    return result_cache.has(frame_id);
  };

  return {
    // API
    api,
    ws,

    // Mode
    mode,
    switchMode,

    // Processing
    processFrame,
    isCached,

    // Convenience
    startTracking: ws.startTracking,
    stopTracking: ws.stopTracking,
    isTracking: ws.isTracking || api.isTracking,
    isProcessing: ws.isProcessing || api.isLoading,
    lastResult: ws.lastResult || api.lastResult
  };
};

// Camera hook (for webcam integration)
export const useCamera = () => {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  // Start camera
  const startCamera = async (constraints?: MediaStreamConstraints) => {
    try {
      const defaultConstraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(
        constraints || defaultConstraints
      );

      setStream(stream);
      setIsActive(true);
      setError(null);
      setVideoReady(false);

      // Wait for video to be ready
      if (stream.getVideoTracks()[0]) {
        setTimeout(() => setVideoReady(true), 500);
      }

      return stream;
    } catch {
      setError('Camera access denied');
      throw new Error('Camera access denied');
    }
  };

  // Stop camera
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsActive(false);
      setVideoReady(false);
    }
  };

  // Toggle camera
  const toggleCamera = async (constraints?: MediaStreamConstraints) => {
    if (isActive) {
      stopCamera();
    } else {
      await startCamera(constraints);
    }
  };

  // Capture frame as base64
  const captureFrame = async (
    video: HTMLVideoElement,
    format: 'image/jpeg' | 'image/png' = 'image/jpeg',
    quality: number = 0.8
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('Canvas context not available'));
          return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Failed to create blob'));
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = reader.result as string;
              resolve(base64.split(',')[1]);
            };
            reader.onerror = () => reject(new Error('Failed to read blob'));
            reader.readAsDataURL(blob);
          },
          format,
          quality
        );
      } catch (err) {
        reject(err);
      }
    });
  };

  // Request camera permission
  const requestPermission = async (): Promise<PermissionState> => {
    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      return permission.state;
    } catch {
      return 'prompt';
    }
  };

  // Get available cameras
  const getCameras = async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (err) {
      setError('Failed to enumerate cameras');
      return [];
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stream) {
        stopCamera();
      }
    };
  }, [stream]);

  return {
    // State
    stream,
    isActive,
    error,
    videoReady,

    // Controls
    startCamera,
    stopCamera,
    toggleCamera,
    captureFrame,
    requestPermission,
    getCameras,

    // Video element ref
    attachToVideo: (video: HTMLVideoElement) => {
      if (stream) {
        video.srcObject = stream;
      }
    }
  };
};

// Gallery hook (for screenshots)
export const useGallery = () => {
  const [items, setItems] = useState<unknown[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load from IndexedDB
  const loadGallery = async () => {
    setIsLoading(true);
    try {
      // In a real app, use IndexedDB
      const stored = localStorage.getItem('gallery_items');
      const parsed = stored ? JSON.parse(stored) : [];
      setItems(parsed);
    } catch (error) {
      console.error('Failed to load gallery:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save to gallery
  const saveToGallery = async (item: unknown) => {
    try {
      const newItem = {
        ...item,
        id: crypto?.randomUUID?.() || `item_${Date.now()}`,
        timestamp: Date.now()
      };

      const updated = [...items, newItem];
      setItems(updated);
      localStorage.setItem('gallery_items', JSON.stringify(updated));
      return newItem;
    } catch (error) {
      console.error('Failed to save to gallery:', error);
      throw error;
    }
  };

  // Remove from gallery
  const removeFromGallery = async (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    setItems(updated);
    localStorage.setItem('gallery_items', JSON.stringify(updated));
  };

  // Clear gallery
  const clearGallery = async () => {
    setItems([]);
    localStorage.removeItem('gallery_items');
  };

  // Load on mount
  useEffect(() => {
    loadGallery();
  }, []);

  return {
    items,
    isLoading,
    loadGallery,
    saveToGallery,
    removeFromGallery,
    clearGallery
  };
};
