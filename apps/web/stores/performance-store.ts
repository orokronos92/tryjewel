/**
 * =============================================================================
 * PERFORMANCE-STORE.TS - Version 1.0
 * =============================================================================
 * 
 * Store Zustand pour gÃ©rer l'Ã©tat de performance adaptatif.
 * 
 * IMPORTANT: Ce store est ISOLÃ‰ et OPTIONNEL.
 * Les fichiers existants continuent de fonctionner sans lui.
 * 
 * @author TryJewel Team
 * @version 1.0.0
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    type PerformanceTier,
    type TierConfig,
    type DeviceCapabilities,
    type PerformanceMetrics,
    detectDeviceCapabilities,
    getTierConfig,
    suggestTierChange,
    FPSTracker,
} from '@/lib/adaptive-performance';

// NOTE: Ce fichier doit Ãªtre placÃ© dans lib/ Ã  cÃ´tÃ© de adaptive-performance.ts
// ou ajustez le chemin d'import ci-dessus

// =============================================================================
// TYPES
// =============================================================================

type PerformancePriority = 'performance' | 'balanced' | 'quality';

interface PerformancePreferences {
    priority: PerformancePriority;
    enableAutoAdaptation: boolean;
    maxTier: PerformanceTier;
    minTier: PerformanceTier;
}

interface PerformanceStoreState {
    // Ã‰tat actuel
    currentTier: PerformanceTier;
    currentConfig: TierConfig;
    isAutoAdapting: boolean;
    
    // CapacitÃ©s dÃ©tectÃ©es
    deviceCapabilities: DeviceCapabilities | null;
    
    // MÃ©triques en temps rÃ©el
    metrics: PerformanceMetrics;
    fpsTracker: FPSTracker | null;
    
    // PrÃ©fÃ©rences utilisateur
    preferences: PerformancePreferences;
    
    // Historique des changements de tier
    tierHistory: Array<{
        tier: PerformanceTier;
        timestamp: number;
        reason: string;
    }>;
    
    // Cooldown pour Ã©viter les changements trop frÃ©quents
    lastTierChange: number;
    tierChangeCooldownMs: number;
    
    // Actions
    initialize: () => void;
    setTier: (tier: PerformanceTier, reason?: string) => void;
    enableAutoAdaptation: () => void;
    disableAutoAdaptation: () => void;
    recordFrame: () => void;
    checkAndAdapt: () => void;
    setPriority: (priority: PerformancePriority) => void;
    reset: () => void;
}

// =============================================================================
// VALEURS PAR DÃ‰FAUT
// =============================================================================

const DEFAULT_PREFERENCES: PerformancePreferences = {
    priority: 'balanced',
    enableAutoAdaptation: true,
    maxTier: 3,
    minTier: 0,
};

const DEFAULT_METRICS: PerformanceMetrics = {
    currentFPS: 0,
    averageFPS: 0,
    minFPS: 0,
    maxFPS: 0,
    frameCount: 0,
    droppedFrames: 0,
    lastUpdateTime: 0,
};

// =============================================================================
// STORE
// =============================================================================

export const usePerformanceStore = create<PerformanceStoreState>()(
    persist(
        (set, get) => ({
            // Ã‰tat initial
            currentTier: 2,  // Balanced par dÃ©faut
            currentConfig: getTierConfig(2),
            isAutoAdapting: true,
            deviceCapabilities: null,
            metrics: { ...DEFAULT_METRICS },
            fpsTracker: null,
            preferences: { ...DEFAULT_PREFERENCES },
            tierHistory: [],
            lastTierChange: 0,
            tierChangeCooldownMs: 3000,  // 3 secondes entre les changements
            
            // =========================================================
            // INITIALISATION
            // =========================================================
            
            initialize: () => {
                // DÃ©tecter les capacitÃ©s de l'appareil
                const capabilities = detectDeviceCapabilities();
                
                // CrÃ©er le tracker FPS
                const tracker = new FPSTracker(60);
                
                // DÃ©terminer le tier initial basÃ© sur la prioritÃ©
                const { preferences } = get();
                let initialTier = capabilities.recommendedTier;
                
                // Ajuster selon la prioritÃ© utilisateur
                if (preferences.priority === 'performance') {
                    initialTier = Math.max(0, initialTier - 1) as PerformanceTier;
                } else if (preferences.priority === 'quality') {
                    initialTier = Math.min(3, initialTier + 1) as PerformanceTier;
                }
                
                // Respecter les limites min/max
                initialTier = Math.max(preferences.minTier, initialTier) as PerformanceTier;
                initialTier = Math.min(preferences.maxTier, initialTier) as PerformanceTier;
                
                set({
                    deviceCapabilities: capabilities,
                    fpsTracker: tracker,
                    currentTier: initialTier,
                    currentConfig: getTierConfig(initialTier),
                    tierHistory: [{
                        tier: initialTier,
                        timestamp: Date.now(),
                        reason: 'initialization',
                    }],
                });
            },
            
            // =========================================================
            // CHANGEMENT DE TIER
            // =========================================================
            
            setTier: (tier: PerformanceTier, reason: string = 'manual') => {
                const { preferences, lastTierChange, tierChangeCooldownMs } = get();
                
                // VÃ©rifier le cooldown
                const now = Date.now();
                if (now - lastTierChange < tierChangeCooldownMs && reason !== 'manual') {
                    return;
                }
                
                // Respecter les limites
                const clampedTier = Math.max(
                    preferences.minTier,
                    Math.min(preferences.maxTier, tier)
                ) as PerformanceTier;
                
                const config = getTierConfig(clampedTier);

                set((state) => ({
                    currentTier: clampedTier,
                    currentConfig: config,
                    lastTierChange: now,
                    tierHistory: [
                        ...state.tierHistory.slice(-19),  // Garder les 20 derniers
                        {
                            tier: clampedTier,
                            timestamp: now,
                            reason,
                        },
                    ],
                }));
            },
            
            // =========================================================
            // AUTO-ADAPTATION
            // =========================================================
            
            enableAutoAdaptation: () => {
                set((state) => ({
                    isAutoAdapting: true,
                    preferences: {
                        ...state.preferences,
                        enableAutoAdaptation: true,
                    },
                }));
            },
            
            disableAutoAdaptation: () => {
                set((state) => ({
                    isAutoAdapting: false,
                    preferences: {
                        ...state.preferences,
                        enableAutoAdaptation: false,
                    },
                }));
            },
            
            // =========================================================
            // ENREGISTREMENT DES FRAMES
            // =========================================================
            
            recordFrame: () => {
                const { fpsTracker } = get();
                
                if (!fpsTracker) return;
                
                fpsTracker.recordFrame();
                
                // Mettre Ã  jour les mÃ©triques toutes les 10 frames pour Ã©conomiser
                if (fpsTracker.getMetrics().frameCount % 10 === 0) {
                    set({
                        metrics: fpsTracker.getMetrics(),
                    });
                }
            },
            
            // =========================================================
            // VÃ‰RIFICATION ET ADAPTATION
            // =========================================================
            
            checkAndAdapt: () => {
                const { 
                    isAutoAdapting, 
                    currentTier, 
                    metrics,
                    lastTierChange,
                    tierChangeCooldownMs,
                } = get();
                
                if (!isAutoAdapting) return;
                
                // VÃ©rifier le cooldown
                const now = Date.now();
                if (now - lastTierChange < tierChangeCooldownMs) return;
                
                // Demander une suggestion de changement
                const suggestion = suggestTierChange(currentTier, metrics, 3);
                
                if (suggestion !== null && suggestion !== currentTier) {
                    const reason = suggestion > currentTier 
                        ? `FPS stable (${metrics.averageFPS}), upgrade`
                        : `FPS low (${metrics.averageFPS}), downgrade`;
                    
                    get().setTier(suggestion, reason);
                }
            },
            
            // =========================================================
            // PRÃ‰FÃ‰RENCES
            // =========================================================
            
            setPriority: (priority: PerformancePriority) => {
                set((state) => ({
                    preferences: {
                        ...state.preferences,
                        priority,
                    },
                }));
                
                // RÃ©ajuster le tier selon la nouvelle prioritÃ©
                const { currentTier, deviceCapabilities } = get();
                if (!deviceCapabilities) return;
                
                let newTier = deviceCapabilities.recommendedTier;
                
                if (priority === 'performance') {
                    newTier = Math.max(0, newTier - 1) as PerformanceTier;
                } else if (priority === 'quality') {
                    newTier = Math.min(3, newTier + 1) as PerformanceTier;
                }
                
                if (newTier !== currentTier) {
                    get().setTier(newTier, `priority_change_to_${priority}`);
                }
            },
            
            // =========================================================
            // RESET
            // =========================================================
            
            reset: () => {
                const tracker = get().fpsTracker;
                if (tracker) tracker.reset();
                
                set({
                    currentTier: 2,
                    currentConfig: getTierConfig(2),
                    isAutoAdapting: true,
                    metrics: { ...DEFAULT_METRICS },
                    tierHistory: [],
                    lastTierChange: 0,
                    preferences: { ...DEFAULT_PREFERENCES },
                });
            },
        }),
        {
            name: 'performance-store-v1',
            // Ne persister que les prÃ©fÃ©rences utilisateur
            partialize: (state) => ({
                preferences: state.preferences,
                currentTier: state.currentTier,
            }),
        }
    )
);

// =============================================================================
// HOOKS SÃ‰LECTEURS
// =============================================================================

export const useCurrentTier = () => 
    usePerformanceStore((state) => state.currentTier);

export const useTierConfig = () => 
    usePerformanceStore((state) => state.currentConfig);

export const usePerformanceMetrics = () => 
    usePerformanceStore((state) => state.metrics);

export const useIsAutoAdapting = () => 
    usePerformanceStore((state) => state.isAutoAdapting);

export const useDeviceCapabilities = () => 
    usePerformanceStore((state) => state.deviceCapabilities);

// =============================================================================
// EXPORT
// =============================================================================

export default usePerformanceStore;