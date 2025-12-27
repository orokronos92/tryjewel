/**
 * Edge Tracking Store (Zustand)
 * Version simplifiÃ©e SANS WebSocket ni backend Python
 * 
 * Changements vs tracking-store.ts :
 * âŒ Plus de socket
 * âŒ Plus de connection_status  
 * âŒ Plus de reconnection_attempts
 * âœ… Juste l'Ã©tat local du tracking
 * âœ… Compatible avec jewelry-3d.tsx actuel
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ========================================
// TYPES (identiques Ã  votre archi actuelle)
// ========================================

interface HandLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
}

interface HandResult {
    handedness: string;
    handedness_score: number;
    landmarks: HandLandmark[];
    world_landmarks: HandLandmark[];
}

interface JewelryPosition {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    quaternion: { x: number; y: number; z: number; w: number };
    scale: number;
    confidence: number;
}


// ✅ PHASE 1: Type pour le rig Kalidokit complet
interface KalidoHandRig {
    [key: string]: { x: number; y: number; z: number } | undefined;
}

export interface TrackingResult {
    success: boolean;
    hand_result: HandResult | null;
    jewelry_position: JewelryPosition | null;
    confidence: number;
    processing_time_ms: number;
    frame_id?: string;
    timestamp?: number;
    kalidokit_rig?: KalidoHandRig;  // ✅ PHASE 1: Rig complet pour rotations naturelles
}

interface TrackingState {
    is_tracking: boolean;
    is_processing: boolean;
    last_result: TrackingResult | null;
    processing_fps: number;
    average_latency_ms: number;
    frame_count: number;
    error_count: number;
    last_error: string | null;
}

interface TrackingConfig {
    jewelry_type: 'ring' | 'bracelet' | 'earring' | 'necklace';
    finger: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
    hand: 'left' | 'right';
    enable_smoothing: boolean;
    model_complexity: 0 | 1;
    min_detection_confidence: number;
    min_tracking_confidence: number;
}

interface EdgeTrackingStore {
    // State
    tracking: TrackingState;
    config: TrackingConfig;

    // Result cache (optional)
    result_cache: Map<string, TrackingResult>;

    // Actions
    updateTrackingResult: (result: TrackingResult) => void;
    setTracking: (isTracking: boolean) => void;
    setProcessing: (isProcessing: boolean) => void;
    updateFPS: (fps: number) => void;
    updateLatency: (latency: number) => void;
    setError: (error: string | null) => void;
    clearError: () => void;

    // Config
    updateConfig: (config: Partial<TrackingConfig>) => void;

    // Cache
    cacheResult: (frameId: string | undefined, result: TrackingResult) => void;
    getCachedResult: (frameId: string) => TrackingResult | undefined;
    clearCache: () => void;

    // Reset
    reset: () => void;
}

// ========================================
// DEFAULT STATES
// ========================================

const defaultTrackingState: TrackingState = {
    is_tracking: false,
    is_processing: false,
    last_result: null,
    processing_fps: 0,
    average_latency_ms: 0,
    frame_count: 0,
    error_count: 0,
    last_error: null,
};

const defaultConfig: TrackingConfig = {
    jewelry_type: 'ring',
    finger: 'index',
    hand: 'right',
    enable_smoothing: true,
    model_complexity: 1,
    min_detection_confidence: 0.5,
    min_tracking_confidence: 0.5,
};

// ========================================
// STORE IMPLEMENTATION
// ========================================

export const useEdgeTrackingStore = create<EdgeTrackingStore>()(
    persist(
        (set, get) => ({
            // Initial state
            tracking: { ...defaultTrackingState },
            config: { ...defaultConfig },
            result_cache: new Map(),

            // ========================================
            // UPDATE TRACKING RESULT
            // ========================================
            updateTrackingResult: (result: TrackingResult) => {
                set((state) => {
                    const newFrameCount = state.tracking.frame_count + 1;

                    // Update average latency (exponential moving average)
                    const alpha = 0.1;
                    const newLatency =
                        state.tracking.average_latency_ms * (1 - alpha) +
                        result.processing_time_ms * alpha;

                    return {
                        tracking: {
                            ...state.tracking,
                            last_result: result,
                            frame_count: newFrameCount,
                            average_latency_ms: newLatency,
                            last_error: result.success ? null : state.tracking.last_error,
                        },
                    };
                });

                // Cache if has frame_id
                if (result.frame_id) {
                    get().cacheResult(result.frame_id, result);
                }
            },

            // ========================================
            // SET TRACKING STATE
            // ========================================
            setTracking: (isTracking: boolean) => {
                set((state) => ({
                    tracking: {
                        ...state.tracking,
                        is_tracking: isTracking,
                        // Reset counters when starting
                        ...(isTracking ? {
                            frame_count: 0,
                            error_count: 0,
                            processing_fps: 0,
                            average_latency_ms: 0,
                        } : {}),
                    },
                }));
            },

            // ========================================
            // SET PROCESSING
            // ========================================
            setProcessing: (isProcessing: boolean) => {
                set((state) => ({
                    tracking: {
                        ...state.tracking,
                        is_processing: isProcessing,
                    },
                }));
            },

            // ========================================
            // UPDATE FPS
            // ========================================
            updateFPS: (fps: number) => {
                set((state) => ({
                    tracking: {
                        ...state.tracking,
                        processing_fps: fps,
                    },
                }));
            },

            // ========================================
            // UPDATE LATENCY
            // ========================================
            updateLatency: (latency: number) => {
                set((state) => ({
                    tracking: {
                        ...state.tracking,
                        average_latency_ms: latency,
                    },
                }));
            },

            // ========================================
            // ERROR HANDLING
            // ========================================
            setError: (error: string | null) => {
                set((state) => ({
                    tracking: {
                        ...state.tracking,
                        last_error: error,
                        error_count: error ? state.tracking.error_count + 1 : state.tracking.error_count,
                    },
                }));
            },

            clearError: () => {
                set((state) => ({
                    tracking: {
                        ...state.tracking,
                        last_error: null,
                    },
                }));
            },

            // ========================================
            // CONFIG UPDATES
            // ========================================
            updateConfig: (config: Partial<TrackingConfig>) => {
                set((state) => ({
                    config: {
                        ...state.config,
                        ...config,
                    },
                }));
            },

            // ========================================
            // CACHE OPERATIONS
            // ========================================
            cacheResult: (frameId: string | undefined, result: TrackingResult) => {
                // âœ… FIX: Skip if no frameId
                if (!frameId) return;

                const { result_cache } = get();
                result_cache.set(frameId, result);

                // Limit cache size to 100 items
                if (result_cache.size > 100) {
                    const firstKey = result_cache.keys().next().value;
                    if (firstKey) {
                        result_cache.delete(firstKey);
                    }
                }
            },

            getCachedResult: (frameId: string) => {
                return get().result_cache.get(frameId);
            },

            clearCache: () => {
                set({ result_cache: new Map() });
            },

            // ========================================
            // RESET
            // ========================================
            reset: () => {
                set({
                    tracking: { ...defaultTrackingState },
                    config: { ...defaultConfig },
                    result_cache: new Map(),
                });
            },
        }),
        {
            name: 'edge-tracking-store',
            // Only persist config, not tracking state
            partialize: (state) => ({
                config: state.config,
            }),
        }
    )
);

// ========================================
// SELECTOR HOOKS (pour performance)
// ========================================

export const useTrackingState = () =>
    useEdgeTrackingStore((state) => state.tracking);

export const useTrackingConfig = () =>
    useEdgeTrackingStore((state) => state.config);

export const useIsTracking = () =>
    useEdgeTrackingStore((state) => state.tracking.is_tracking);

export const useLastResult = () =>
    useEdgeTrackingStore((state) => state.tracking.last_result);

export const useTrackingFPS = () =>
    useEdgeTrackingStore((state) => state.tracking.processing_fps);

export const useTrackingLatency = () =>
    useEdgeTrackingStore((state) => state.tracking.average_latency_ms);