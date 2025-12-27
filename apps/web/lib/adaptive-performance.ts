/**
 * =============================================================================
 * ADAPTIVE-PERFORMANCE.TS - Version 1.0
 * =============================================================================
 * 
 * Système de performance adaptatif pour TryJewel.
 * 
 * PRINCIPE:
 * - Détecte les capacités de l'appareil au démarrage
 * - Définit 4 tiers de performance (T0 = économie → T3 = qualité)
 * - Permet l'adaptation automatique basée sur le FPS réel
 * 
 * IMPORTANT: Ce fichier est ISOLÉ et ne modifie AUCUN fichier existant.
 * Il fournit juste des utilitaires qui peuvent être utilisés optionnellement.
 * 
 * @author TryJewel Team
 * @version 1.0.0
 */

// =============================================================================
// TYPES
// =============================================================================

/**
 * Les 4 niveaux de performance
 * 
 * T0 = Ultra économique (appareils très faibles)
 * T1 = Économique (appareils budget)
 * T2 = Équilibré (appareils milieu de gamme)
 * T3 = Qualité (appareils haut de gamme)
 */
export type PerformanceTier = 0 | 1 | 2 | 3;

/**
 * Configuration pour chaque tier
 */
export interface TierConfig {
    // MediaPipe
    modelComplexity: 0 | 1;
    minDetectionConfidence: number;
    minTrackingConfidence: number;
    
    // Frame processing
    frameSkip: number;  // 1 = toutes les frames, 2 = 1 sur 2, etc.
    
    // Géométries Three.js
    cylinderSegments: number;
    sphereSegments: number;
    
    // Features
    enableHand3D: boolean;
    enableOccluders: boolean;
    enableSkeleton2D: boolean;
    
    // Cibles FPS
    targetFPS: number;
    minAcceptableFPS: number;
}

/**
 * Informations sur l'appareil détecté
 */
export interface DeviceCapabilities {
    // Hardware
    cpuCores: number;
    deviceMemoryGB: number | null;
    gpuTier: 'low' | 'mid' | 'high' | 'unknown';
    
    // Platform
    isMobile: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    
    // Browser
    supportsOffscreenCanvas: boolean;
    supportsWebGL2: boolean;
    
    // Computed
    recommendedTier: PerformanceTier;
}

/**
 * Métriques de performance en temps réel
 */
export interface PerformanceMetrics {
    currentFPS: number;
    averageFPS: number;
    minFPS: number;
    maxFPS: number;
    frameCount: number;
    droppedFrames: number;
    lastUpdateTime: number;
}

// =============================================================================
// CONFIGURATIONS PAR TIER
// =============================================================================

/**
 * Configuration pour chaque tier de performance
 * 
 * IMPORTANT: On garde modelComplexity: 1 même pour T0/T1 car 0 dégrade trop le tracking
 */
export const TIER_CONFIGS: Record<PerformanceTier, TierConfig> = {
    // T0 - Ultra économique: pour appareils très faibles
    0: {
        modelComplexity: 1,          // On garde 1 pour la précision!
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.6,
        frameSkip: 3,                // Traiter 1 frame sur 3
        cylinderSegments: 6,
        sphereSegments: 6,
        enableHand3D: false,         // Désactivé pour économiser
        enableOccluders: false,      // Désactivé pour économiser
        enableSkeleton2D: true,
        targetFPS: 20,
        minAcceptableFPS: 15,
    },
    
    // T1 - Économique: pour appareils budget
    1: {
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        frameSkip: 2,                // Traiter 1 frame sur 2
        cylinderSegments: 8,
        sphereSegments: 8,
        enableHand3D: false,
        enableOccluders: true,
        enableSkeleton2D: true,
        targetFPS: 24,
        minAcceptableFPS: 18,
    },
    
    // T2 - Équilibré: pour appareils milieu de gamme (DEFAULT)
    2: {
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        frameSkip: 1,                // Toutes les frames
        cylinderSegments: 12,
        sphereSegments: 12,
        enableHand3D: true,
        enableOccluders: true,
        enableSkeleton2D: true,
        targetFPS: 30,
        minAcceptableFPS: 24,
    },
    
    // T3 - Qualité: pour appareils haut de gamme
    3: {
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        frameSkip: 1,
        cylinderSegments: 32,
        sphereSegments: 16,
        enableHand3D: true,
        enableOccluders: true,
        enableSkeleton2D: true,
        targetFPS: 60,
        minAcceptableFPS: 30,
    },
};

// =============================================================================
// DÉTECTION DES CAPACITÉS
// =============================================================================

/**
 * Détecte les capacités de l'appareil
 * Safe à appeler côté serveur (retourne des valeurs par défaut)
 */
export function detectDeviceCapabilities(): DeviceCapabilities {
    // SSR guard
    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
        return {
            cpuCores: 4,
            deviceMemoryGB: null,
            gpuTier: 'unknown',
            isMobile: false,
            isIOS: false,
            isAndroid: false,
            supportsOffscreenCanvas: false,
            supportsWebGL2: false,
            recommendedTier: 2,
        };
    }
    
    // Détecter le nombre de cores CPU
    const cpuCores = navigator.hardwareConcurrency || 4;
    
    // Détecter la mémoire (Chrome uniquement)
    const deviceMemoryGB = (navigator as any).deviceMemory || null;
    
    // Détecter la plateforme
    const ua = navigator.userAgent.toLowerCase();
    const isMobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isIOS = /iphone|ipad|ipod/i.test(ua);
    const isAndroid = /android/i.test(ua);
    
    // Détecter WebGL2
    let supportsWebGL2 = false;
    try {
        const canvas = document.createElement('canvas');
        supportsWebGL2 = !!canvas.getContext('webgl2');
    } catch {
        supportsWebGL2 = false;
    }
    
    // Détecter OffscreenCanvas
    const supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
    
    // Estimer le tier GPU basé sur WebGL
    const gpuTier = estimateGPUTier();
    
    // Calculer le tier recommandé
    const recommendedTier = calculateRecommendedTier({
        cpuCores,
        deviceMemoryGB,
        gpuTier,
        isMobile,
        isIOS,
        isAndroid,
        supportsWebGL2,
    });
    
    return {
        cpuCores,
        deviceMemoryGB,
        gpuTier,
        isMobile,
        isIOS,
        isAndroid,
        supportsOffscreenCanvas,
        supportsWebGL2,
        recommendedTier,
    };
}

/**
 * Estime le tier GPU basé sur les infos WebGL
 */
function estimateGPUTier(): 'low' | 'mid' | 'high' | 'unknown' {
    if (typeof document === 'undefined') return 'unknown';
    
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if (!gl) return 'unknown';
        
        const glContext = gl as WebGLRenderingContext;
        const debugInfo = glContext.getExtension('WEBGL_debug_renderer_info');
        
        if (!debugInfo) return 'mid'; // Assume mid si pas d'info
        
        const renderer = glContext.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();
        
        // GPUs haut de gamme
        if (
            renderer.includes('nvidia') ||
            renderer.includes('geforce') ||
            renderer.includes('radeon rx') ||
            renderer.includes('apple m1') ||
            renderer.includes('apple m2') ||
            renderer.includes('apple m3') ||
            renderer.includes('apple gpu') // iPhone récents
        ) {
            return 'high';
        }
        
        // GPUs bas de gamme
        if (
            renderer.includes('intel hd') ||
            renderer.includes('intel uhd') ||
            renderer.includes('mali-4') ||
            renderer.includes('mali-t') ||
            renderer.includes('adreno 3') ||
            renderer.includes('adreno 4') ||
            renderer.includes('powervr')
        ) {
            return 'low';
        }
        
        // GPUs milieu de gamme
        if (
            renderer.includes('adreno 5') ||
            renderer.includes('adreno 6') ||
            renderer.includes('mali-g') ||
            renderer.includes('intel iris')
        ) {
            return 'mid';
        }
        
        return 'mid'; // Default
        
    } catch {
        return 'unknown';
    }
}

/**
 * Calcule le tier recommandé basé sur les capacités détectées
 */
function calculateRecommendedTier(caps: {
    cpuCores: number;
    deviceMemoryGB: number | null;
    gpuTier: 'low' | 'mid' | 'high' | 'unknown';
    isMobile: boolean;
    isIOS: boolean;
    isAndroid: boolean;
    supportsWebGL2: boolean;
}): PerformanceTier {
    let score = 0;
    
    // Score basé sur CPU
    if (caps.cpuCores >= 8) score += 3;
    else if (caps.cpuCores >= 4) score += 2;
    else if (caps.cpuCores >= 2) score += 1;
    
    // Score basé sur mémoire
    if (caps.deviceMemoryGB !== null) {
        if (caps.deviceMemoryGB >= 8) score += 3;
        else if (caps.deviceMemoryGB >= 4) score += 2;
        else if (caps.deviceMemoryGB >= 2) score += 1;
    } else {
        score += 1.5; // Valeur moyenne si inconnu
    }
    
    // Score basé sur GPU
    if (caps.gpuTier === 'high') score += 3;
    else if (caps.gpuTier === 'mid') score += 2;
    else if (caps.gpuTier === 'low') score += 0.5;
    else score += 1.5; // unknown = mid
    
    // Bonus/malus plateforme
    if (caps.isIOS) {
        // iOS est généralement bien optimisé
        score += 1;
    } else if (caps.isAndroid && caps.isMobile) {
        // Android mobile peut être très variable
        score -= 0.5;
    }
    
    // Bonus WebGL2
    if (caps.supportsWebGL2) score += 0.5;
    
    // Convertir score en tier
    // Score max théorique: ~11, min: ~1
    if (score >= 8) return 3;      // High-end
    if (score >= 5.5) return 2;    // Mid-range
    if (score >= 3) return 1;      // Budget
    return 0;                       // Ultra-low
}

// =============================================================================
// GESTIONNAIRE DE MÉTRIQUES FPS
// =============================================================================

/**
 * Classe pour tracker les FPS en temps réel
 */
export class FPSTracker {
    private samples: number[] = [];
    private maxSamples: number;
    private lastFrameTime: number = 0;
    private frameCount: number = 0;
    private droppedFrames: number = 0;
    
    constructor(maxSamples: number = 60) {
        this.maxSamples = maxSamples;
    }
    
    /**
     * Appelé à chaque frame pour enregistrer le timing
     */
    recordFrame(): void {
        const now = performance.now();
        
        if (this.lastFrameTime > 0) {
            const delta = now - this.lastFrameTime;
            const fps = 1000 / delta;
            
            this.samples.push(fps);
            
            // Garder seulement les N derniers samples
            if (this.samples.length > this.maxSamples) {
                this.samples.shift();
            }
            
            // Détecter les frames dropped (delta > 50ms = moins de 20 FPS)
            if (delta > 50) {
                this.droppedFrames++;
            }
        }
        
        this.lastFrameTime = now;
        this.frameCount++;
    }
    
    /**
     * Retourne les métriques actuelles
     */
    getMetrics(): PerformanceMetrics {
        if (this.samples.length === 0) {
            return {
                currentFPS: 0,
                averageFPS: 0,
                minFPS: 0,
                maxFPS: 0,
                frameCount: this.frameCount,
                droppedFrames: this.droppedFrames,
                lastUpdateTime: this.lastFrameTime,
            };
        }
        
        const currentFPS = this.samples[this.samples.length - 1] || 0;
        const averageFPS = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
        const minFPS = Math.min(...this.samples);
        const maxFPS = Math.max(...this.samples);
        
        return {
            currentFPS: Math.round(currentFPS),
            averageFPS: Math.round(averageFPS),
            minFPS: Math.round(minFPS),
            maxFPS: Math.round(maxFPS),
            frameCount: this.frameCount,
            droppedFrames: this.droppedFrames,
            lastUpdateTime: this.lastFrameTime,
        };
    }
    
    /**
     * Remet à zéro les métriques
     */
    reset(): void {
        this.samples = [];
        this.lastFrameTime = 0;
        this.frameCount = 0;
        this.droppedFrames = 0;
    }
}

// =============================================================================
// LOGIQUE D'ADAPTATION
// =============================================================================

/**
 * Détermine si on doit changer de tier basé sur les métriques FPS
 * 
 * @param currentTier Tier actuel
 * @param metrics Métriques FPS
 * @param stableSeconds Nombre de secondes de stabilité requises
 * @returns Nouveau tier suggéré (ou null si pas de changement)
 */
export function suggestTierChange(
    currentTier: PerformanceTier,
    metrics: PerformanceMetrics,
    stableSeconds: number = 3
): PerformanceTier | null {
    const config = TIER_CONFIGS[currentTier];
    
    // Pas assez de données (moins de 3 secondes à 30fps)
    if (metrics.frameCount < stableSeconds * 30) {
        return null;
    }
    
    // Si FPS moyen trop bas, descendre d'un tier
    if (metrics.averageFPS < config.minAcceptableFPS && currentTier > 0) {
        return (currentTier - 1) as PerformanceTier;
    }
    
    // Si FPS moyen très bon ET stable, monter d'un tier
    if (currentTier < 3) {
        const nextConfig = TIER_CONFIGS[(currentTier + 1) as PerformanceTier];
        
        // On monte si on dépasse largement la cible du tier suivant
        if (
            metrics.averageFPS > nextConfig.targetFPS * 1.2 &&
            metrics.minFPS > nextConfig.minAcceptableFPS
        ) {
            return (currentTier + 1) as PerformanceTier;
        }
    }
    
    return null;
}

// =============================================================================
// UTILITAIRES
// =============================================================================

/**
 * Retourne une description textuelle du tier
 */
export function getTierName(tier: PerformanceTier): string {
    const names: Record<PerformanceTier, string> = {
        0: 'Ultra Lite',
        1: 'Lite',
        2: 'Balanced',
        3: 'Quality',
    };
    return names[tier];
}

/**
 * Retourne la config pour un tier donné
 */
export function getTierConfig(tier: PerformanceTier): TierConfig {
    return TIER_CONFIGS[tier];
}

// =============================================================================
// EXPORTS
// =============================================================================

export default {
    detectDeviceCapabilities,
    getTierConfig,
    getTierName,
    suggestTierChange,
    FPSTracker,
    TIER_CONFIGS,
};