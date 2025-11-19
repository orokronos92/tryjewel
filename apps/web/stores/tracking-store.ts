import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TrackingResult, WebSocketFrame } from '@/lib/schemas/tracking.schema';

/**
 * Zustand store for tracking state and WebSocket connection
 */

// Connection status enum
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// Tracking state interface
interface TrackingState {
  is_tracking: boolean;
  is_processing: boolean;
  last_frame_id: string | null;
  processing_fps: number;
  average_latency_ms: number;
  frame_count: number;
  error_count: number;
  last_error: string | null;
  last_result: TrackingResult | null;
}

// Store state interface
interface TrackingStoreState {
  // Connection state
  socket: any | null;
  connection_status: ConnectionStatus;
  reconnection_attempts: number;

  // Tracking state
  tracking: TrackingState;

  // Configuration
  config: {
    jewelry_type: string;
    finger: string;
    hand: string;
    enable_smoothing: boolean;
    enable_cache: boolean;
  };

  // Cache (in-memory)
  result_cache: Map<string, TrackingResult>;

  // Actions
  initializeSocket: () => void;
  connect: () => void;
  disconnect: () => void;
  reconnect: () => void;

  // Tracking actions
  startTracking: () => void;
  stopTracking: () => void;
  processFrame: (frame: WebSocketFrame) => Promise<TrackingResult>;

  // Result handling
  addToCache: (frame_id: string, result: TrackingResult) => void;
  getFromCache: (frame_id: string) => TrackingResult | undefined;
  clearCache: () => void;

  // Error handling
  setError: (error: string) => void;
  clearError: () => void;

  // Configuration
  updateConfig: (config: Partial<TrackingStoreState['config']>) => void;

  // WebSocket event handlers
  handleConnection: (data: any) => void;
  handleTrackingResult: (result: TrackingResult) => void;
  handleTrackingError: (error: { error: string; error_code: string }) => void;
}

// Default state
const defaultTrackingState: TrackingState = {
  is_tracking: false,
  is_processing: false,
  last_frame_id: null,
  processing_fps: 0,
  average_latency_ms: 0,
  frame_count: 0,
  error_count: 0,
  last_error: null,
  last_result: null
};

const defaultConfig = {
  jewelry_type: 'ring',
  finger: 'index',
  hand: 'right',
  enable_smoothing: true,
  enable_cache: true
};

// Store implementation
export const useTrackingStore = create<TrackingStoreState>()(
  persist(
    (set, get) => ({
      // State
      socket: null,
      connection_status: 'disconnected',
      reconnection_attempts: 0,

      tracking: { ...defaultTrackingState },
      config: { ...defaultConfig },
      result_cache: new Map(),

      // Socket initialization
      initializeSocket: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
        }

        // Initialize Socket.IO client
        const io = require('socket.io-client');
        const newSocket = io('http://localhost:5000', {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000,
          timeout: 10000
        });

        // Set up event listeners
        newSocket.on('connect', () => {
          get().handleConnection({ status: 'connected' });
        });

        newSocket.on('disconnect', () => {
          set({ connection_status: 'disconnected' });
        });

        newSocket.on('connection_response', (data: any) => {
          get().handleConnection(data);
        });

        newSocket.on('connection_error', (error: any) => {
          get().setError(error.message);
        });

        newSocket.on('tracking_results', (result: any) => {
          get().handleTrackingResult(result);
        });

        newSocket.on('tracking_error', (error: any) => {
          get().handleTrackingError(error);
        });

        newSocket.on('connect_error', (error: any) => {
          set({
            connection_status: 'error',
            reconnection_attempts: get().reconnection_attempts + 1
          });
          get().setError(`Connection error: ${error.message}`);
        });

        newSocket.on('pong', (data: any) => {
          console.log('[WebSocket] Pong received:', data);
        });

        set({ socket: newSocket });
        return newSocket;
      },

      // Connection management
      connect: () => {
        const { socket, connection_status } = get();
        if (connection_status === 'disconnected' || !socket) {
          const newSocket = get().initializeSocket();
          set({ connection_status: 'connecting' });
          return newSocket;
        }
        return socket;
      },

      disconnect: () => {
        const { socket } = get();
        if (socket) {
          socket.disconnect();
          set({
            socket: null,
            connection_status: 'disconnected',
            tracking: { ...defaultTrackingState }
          });
        }
      },

      reconnect: () => {
        get().disconnect();
        setTimeout(() => {
          get().connect();
        }, 1000);
      },

      // Tracking actions
      startTracking: () => {
        set((state) => ({
          tracking: {
            ...state.tracking,
            is_tracking: true,
            frame_count: 0,
            error_count: 0
          }
        }));
      },

      stopTracking: () => {
        set((state) => ({
          tracking: {
            ...state.tracking,
            is_tracking: false,
            is_processing: false
          }
        }));
      },

      processFrame: async (frame: WebSocketFrame) => {
        const { socket, config, tracking } = get();

        if (!socket || !tracking.is_tracking) {
          throw new Error('Not connected or tracking not started');
        }

        set((state) => ({
          tracking: {
            ...state.tracking,
            is_processing: true,
            last_frame_id: frame.frame_id || null
          }
        }));

        const startTime = Date.now();

        return new Promise<TrackingResult>((resolve, reject) => {
          // Set up response handler
          const handleResult = (result: TrackingResult & { frame_id?: string }) => {
            if (result.frame_id === frame.frame_id) {
              const processingTime = Date.now() - startTime;
              const { frame_count } = get().tracking;

              set((state) => ({
                tracking: {
                  ...state.tracking,
                  is_processing: false,
                  last_result: result,
                  frame_count: frame_count + 1,
                  processing_fps: frame_count > 0 ? 1000 / processingTime : 0,
                  average_latency_ms:
                    frame_count > 0
                      ? (state.tracking.average_latency_ms * frame_count + processingTime) / (frame_count + 1)
                      : processingTime
                }
              }));

              // Cache successful results
              if (result.success && config.enable_cache && frame.frame_id) {
                get().addToCache(frame.frame_id, result);
              }

              resolve(result);
            }
          };

          // Send frame
          socket.emit('track_frame', frame);

          // Listen for result
          socket.once('tracking_results', handleResult);

          // Timeout
          setTimeout(() => {
            socket.off('tracking_results', handleResult);
            reject(new Error('Request timeout'));
          }, 10000);
        });
      },

      // Cache management
      addToCache: (frame_id: string, result: TrackingResult) => {
        const { result_cache } = get();
        result_cache.set(frame_id, result);

        // Limit cache size to 100 items
        if (result_cache.size > 100) {
          const firstKey = result_cache.keys().next().value;
          if (firstKey) {
            result_cache.delete(firstKey);
          }
        }
      },

      getFromCache: (frame_id: string) => {
        return get().result_cache.get(frame_id);
      },

      clearCache: () => {
        get().result_cache.clear();
      },

      // Error handling
      setError: (error: string) => {
        set((state) => ({
          tracking: {
            ...state.tracking,
            last_error: error,
            error_count: state.tracking.error_count + 1
          }
        }));
      },

      clearError: () => {
        set((state) => ({
          tracking: {
            ...state.tracking,
            last_error: null
          }
        }));
      },

      // Configuration
      updateConfig: (configUpdate: Partial<TrackingStoreState['config']>) => {
        set((state) => ({
          config: {
            ...state.config,
            ...configUpdate
          }
        }));
      },

      // Event handlers
      handleConnection: (data: any) => {
        console.log('[WebSocket] Connected:', data);
        set({
          connection_status: 'connected',
          reconnection_attempts: 0
        });
      },

      handleTrackingResult: (result: TrackingResult) => {
        set((state) => ({
          tracking: {
            ...state.tracking,
            last_result: result,
            is_processing: false
          }
        }));
      },

      handleTrackingError: (error: { error: string; error_code: string }) => {
        get().setError(error.error);
        console.error('[WebSocket] Tracking error:', error);
      }
    }),
    {
      name: 'tracking-store',
      partialize: (state) => ({
        config: state.config
      })
    }
  )
);

// Selectors for computed values
export const useTrackingConnection = () => useTrackingStore((state) => state.connection_status);
export const useIsTracking = () => useTrackingStore((state) => state.tracking.is_tracking);
export const useIsProcessing = () => useTrackingStore((state) => state.tracking.is_processing);
export const useLastResult = () => useTrackingStore((state) => state.tracking.last_result);
export const useTrackingConfig = () => useTrackingStore((state) => state.config);
export const useTrackingStats = () =>
  useTrackingStore((state) => ({
    fps: state.tracking.processing_fps,
    latency: state.tracking.average_latency_ms,
    frameCount: state.tracking.frame_count,
    errorCount: state.tracking.error_count
  }));

// Connection status helpers
export const connectionStatusColor = (status: ConnectionStatus): string => {
  const colors: Record<ConnectionStatus, string> = {
    disconnected: 'bg-red-500',
    connecting: 'bg-yellow-500',
    connected: 'bg-green-500',
    error: 'bg-red-700'
  };
  return colors[status] || 'bg-gray-500';
};

export const connectionStatusText = (status: ConnectionStatus): string => {
  const texts: Record<ConnectionStatus, string> = {
    disconnected: 'Disconnected',
    connecting: 'Connecting...',
    connected: 'Connected',
    error: 'Connection Error'
  };
  return texts[status] || 'Unknown';
};

// Performance metrics
export const getFPSColor = (fps: number): string => {
  if (fps >= 30) return 'text-green-600';
  if (fps >= 20) return 'text-yellow-600';
  return 'text-red-600';
};

export const getLatencyColor = (latency: number): string => {
  if (latency <= 50) return 'text-green-600';
  if (latency <= 100) return 'text-yellow-600';
  return 'text-red-600';
};

// WebSocket utilities
export const getWebSocketURL = (): string => {
  return 'http://localhost:5000';
};

// Tracking utilities
export const formatFPS = (fps: number): string => {
  return fps.toFixed(1) + ' FPS';
};

export const formatLatency = (latency: number): string => {
  return latency.toFixed(0) + ' ms';
};

export const formatFrameCount = (count: number): string => {
  return count.toLocaleString() + ' frames';
};

// Error utilities
export const getErrorMessage = (error: any): string => {
  if (error.response) {
    return `Server error: ${error.response.status}`;
  }
  if (error.request) {
    return 'Network error: Cannot reach server';
  }
  return error.message || 'Unknown error';
};

// Frame utilities
export const generateFrameId = (): string => {
  return `frame_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const calculateFrameRate = (frames: number, durationMs: number): number => {
  const seconds = durationMs / 1000;
  return frames / seconds;
};

// Confidence utilities
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 0.9) return 'text-green-600';
  if (confidence >= 0.7) return 'text-yellow-600';
  return 'text-red-600';
};

export const formatConfidence = (confidence: number): string => {
  return (confidence * 100).toFixed(1) + '%';
};

// Processing utilities
export const shouldProcessFrame = (lastProcessedTime: number, targetFPS: number): boolean => {
  const now = Date.now();
  const elapsed = now - lastProcessedTime;
  const targetInterval = 1000 / targetFPS;
  return elapsed >= targetInterval;
};

// Batch utilities
export const batchFrames = (frames: WebSocketFrame[], batchSize: number): WebSocketFrame[][] => {
  const batches: WebSocketFrame[][] = [];
  for (let i = 0; i < frames.length; i += batchSize) {
    batches.push(frames.slice(i, i + batchSize));
  }
  return batches;
};

// Debounce utilities
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utilities
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

// Session utilities
export const saveTrackingSession = (sessionData: any): void => {
  try {
    const sessions = JSON.parse(localStorage.getItem('tracking_sessions') || '[]');
    sessions.push({
      ...sessionData,
      id: generateFrameId(),
      timestamp: Date.now()
    });
    localStorage.setItem('tracking_sessions', JSON.stringify(sessions));
  } catch (error) {
    console.error('Failed to save tracking session:', error);
  }
};

export const getTrackingSessions = (): any[] => {
  try {
    return JSON.parse(localStorage.getItem('tracking_sessions') || '[]');
  } catch (error) {
    console.error('Failed to load tracking sessions:', error);
    return [];
  }
};

export const clearTrackingSessions = (): void => {
  localStorage.removeItem('tracking_sessions');
};
