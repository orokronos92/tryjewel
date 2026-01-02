/**
 * =============================================================================
 * PERFORMANCE-DEBUG.TSX - Version 1.0
 * =============================================================================
 * 
 * Composant de debug pour visualiser:
 * - Les capacités détectées de l'appareil
 * - Le tier de performance recommandé
 * - Les métriques FPS en temps réel
 * - Les contrôles manuels pour tester les tiers
 * 
 * UTILISATION:
 * 1. Importer le composant: import { PerformanceDebug } from '@/components/performance-debug';
 * 2. L'ajouter dans ta page: <PerformanceDebug />
 * 
 * IMPORTANT: Ce composant est ISOLÉ et OPTIONNEL.
 * Il ne modifie aucun fichier existant.
 * 
 * @author TryJewel Team
 * @version 1.0.0
 */

'use client';

import { useEffect, useState, useRef } from 'react';
import {
    type PerformanceTier,
    type DeviceCapabilities,
    type PerformanceMetrics,
    type TierConfig,
    detectDeviceCapabilities,
    getTierConfig,
    getTierName,
    FPSTracker,
    TIER_CONFIGS,
} from '@/lib/adaptive-performance';
import { useCalibrationStore } from '@/stores/calibration-store';

// =============================================================================
// TYPES
// =============================================================================

interface PerformanceDebugProps {
    /** Position du panneau */
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'middle-left' | 'middle-right';
    /** Afficher par défaut ou replié */
    defaultExpanded?: boolean;
    /** Callback quand le tier change manuellement */
    onTierChange?: (tier: PerformanceTier) => void;
}

// =============================================================================
// COMPOSANT PRINCIPAL
// =============================================================================

export function PerformanceDebug({
    position = 'middle-left',
    defaultExpanded = true,
    onTierChange,
}: PerformanceDebugProps) {
    // État
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [selectedTier, setSelectedTier] = useState<PerformanceTier>(2);
    const [isInitialized, setIsInitialized] = useState(false);

    // Calibration FOV
    const calculatedFOV = useCalibrationStore((state) => state.calculatedFOV);
    const isCalibrated = useCalibrationStore((state) => state.isCalibrated);

    // Refs
    const fpsTrackerRef = useRef<FPSTracker | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    
    // =========================================================================
    // INITIALISATION
    // =========================================================================
    
    useEffect(() => {
        // Détecter les capacités
        const caps = detectDeviceCapabilities();
        setCapabilities(caps);
        setSelectedTier(caps.recommendedTier);
        
        // Créer le tracker FPS
        fpsTrackerRef.current = new FPSTracker(60);
        
        setIsInitialized(true);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, []);
    
    // =========================================================================
    // BOUCLE DE MESURE FPS
    // =========================================================================
    
    useEffect(() => {
        if (!isInitialized || !fpsTrackerRef.current) return;
        
        const measureLoop = () => {
            fpsTrackerRef.current?.recordFrame();
            
            // Mettre à jour les métriques toutes les 30 frames
            const currentMetrics = fpsTrackerRef.current?.getMetrics();
            if (currentMetrics && currentMetrics.frameCount % 30 === 0) {
                setMetrics({ ...currentMetrics });
            }
            
            animationFrameRef.current = requestAnimationFrame(measureLoop);
        };
        
        animationFrameRef.current = requestAnimationFrame(measureLoop);
        
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isInitialized]);
    
    // =========================================================================
    // HANDLERS
    // =========================================================================
    
    const handleTierChange = (tier: PerformanceTier) => {
        setSelectedTier(tier);
        onTierChange?.(tier);
    };
    
    // =========================================================================
    // STYLES DE POSITION
    // =========================================================================
    
    const positionStyles: Record<string, string> = {
        'top-left': 'top-4 left-4',
        'top-right': 'top-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'middle-left': 'top-1/2 left-4 -translate-y-1/2',
        'middle-right': 'top-1/2 right-4 -translate-y-1/2',
    };
    
    // =========================================================================
    // RENDER
    // =========================================================================
    
    if (!isInitialized) {
        return null;
    }
    
    const currentConfig = getTierConfig(selectedTier);
    
    return (
        <div 
            className={`fixed ${positionStyles[position]} z-50 pointer-events-auto`}
            style={{ maxWidth: '320px' }}
        >
            {/* Header avec toggle */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full bg-blue-600/95 text-white px-3 py-2 rounded-t-lg flex items-center justify-between hover:bg-blue-700 transition-colors"
            >
                <span className="text-sm font-mono flex items-center gap-2">
                    <span>📊</span>
                    <span>Performance Debug</span>
                </span>
                <span className="text-xs">
                    {isExpanded ? '▼' : '▶'}
                </span>
            </button>
            
            {/* Contenu */}
            {isExpanded && (
                <div className="bg-blue-900/90 backdrop-blur-sm text-white p-3 rounded-b-lg text-xs font-mono space-y-3">
                    
                    {/* Section: Device Capabilities */}
                    <Section title="🔍 Device Capabilities">
                        {capabilities && (
                            <div className="space-y-1">
                                <Row label="Platform" value={
                                    capabilities.isMobile 
                                        ? `📱 Mobile (${capabilities.isIOS ? 'iOS' : capabilities.isAndroid ? 'Android' : 'Other'})`
                                        : '💻 Desktop'
                                } />
                                <Row label="CPU Cores" value={capabilities.cpuCores.toString()} />
                                <Row label="Memory" value={
                                    capabilities.deviceMemoryGB 
                                        ? `${capabilities.deviceMemoryGB} GB` 
                                        : 'Unknown'
                                } />
                                <Row label="GPU Tier" value={
                                    <GpuBadge tier={capabilities.gpuTier} />
                                } />
                                <Row label="WebGL2" value={
                                    capabilities.supportsWebGL2 ? '✅' : '❌'
                                } />
                                <Row label="Recommended" value={
                                    <TierBadge tier={capabilities.recommendedTier} />
                                } />
                            </div>
                        )}
                    </Section>
                    
                    {/* Section: FPS Metrics */}
                    <Section title="⚡ FPS Metrics">
                        {metrics ? (
                            <div className="space-y-1">
                                <Row label="Current" value={
                                    <FpsBadge fps={metrics.currentFPS} />
                                } />
                                <Row label="Average" value={`${metrics.averageFPS} FPS`} />
                                <Row label="Min / Max" value={`${metrics.minFPS} / ${metrics.maxFPS}`} />
                                <Row label="Frames" value={metrics.frameCount.toString()} />
                                <Row label="Dropped" value={
                                    <span className={metrics.droppedFrames > 10 ? 'text-red-400' : 'text-green-400'}>
                                        {metrics.droppedFrames}
                                    </span>
                                } />
                            </div>
                        ) : (
                            <div className="text-blue-200/50">Measuring...</div>
                        )}
                    </Section>

                    {/* Section: Camera FOV (from calibration) */}
                    <Section title="📷 Camera FOV">
                        {isCalibrated && calculatedFOV ? (
                            <div className="space-y-1">
                                <Row label="Horizontal" value={
                                    <FovBadge fov={calculatedFOV.horizontal} />
                                } />
                                <Row label="Vertical" value={
                                    <FovBadge fov={calculatedFOV.vertical} />
                                } />
                                <Row label="Focal Length" value={`${calculatedFOV.focalLengthPx} px`} />
                            </div>
                        ) : (
                            <div className="text-blue-200/50">
                                {isCalibrated ? 'No FOV data' : 'Not calibrated'}
                            </div>
                        )}
                    </Section>

                    {/* Section: Tier Selection */}
                    <Section title="🎚️ Performance Tier">
                        <div className="flex gap-1 mb-2">
                            {([0, 1, 2, 3] as PerformanceTier[]).map((tier) => (
                                <button
                                    key={tier}
                                    onClick={() => handleTierChange(tier)}
                                    className={`flex-1 px-2 py-1.5 rounded text-xs transition-colors ${
                                        selectedTier === tier
                                            ? 'bg-white text-blue-900 font-bold'
                                            : 'bg-blue-700/50 text-blue-100 hover:bg-blue-600/50'
                                    }`}
                                >
                                    T{tier}
                                </button>
                            ))}
                        </div>
                        <div className="text-center text-blue-200">
                            {getTierName(selectedTier)}
                        </div>
                    </Section>
                    
                    {/* Section: Current Config */}
                    <Section title="⚙️ Tier Config">
                        <div className="space-y-1">
                            <Row label="Model" value={`Complexity ${currentConfig.modelComplexity}`} />
                            <Row label="Frame Skip" value={
                                currentConfig.frameSkip === 1 
                                    ? 'None' 
                                    : `1/${currentConfig.frameSkip}`
                            } />
                            <Row label="Geometry" value={`${currentConfig.cylinderSegments} segs`} />
                            <Row label="Hand3D" value={currentConfig.enableHand3D ? '✅' : '❌'} />
                            <Row label="Occluders" value={currentConfig.enableOccluders ? '✅' : '❌'} />
                            <Row label="Target FPS" value={`${currentConfig.targetFPS}`} />
                        </div>
                    </Section>
                    
                    {/* Section: All Tiers Comparison */}
                    <Section title="📋 Tiers Comparison">
                        <div className="overflow-x-auto">
                            <table className="w-full text-[10px]">
                                <thead>
                                    <tr className="text-blue-200/70">
                                        <th className="text-left py-1">Tier</th>
                                        <th className="text-center">Skip</th>
                                        <th className="text-center">Segs</th>
                                        <th className="text-center">Hand</th>
                                        <th className="text-center">FPS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {([0, 1, 2, 3] as PerformanceTier[]).map((tier) => {
                                        const config = TIER_CONFIGS[tier];
                                        const isSelected = tier === selectedTier;
                                        return (
                                            <tr 
                                                key={tier}
                                                className={isSelected ? 'bg-white/10' : ''}
                                            >
                                                <td className="py-1">
                                                    <span className={isSelected ? 'text-white font-bold' : ''}>
                                                        T{tier} {getTierName(tier)}
                                                    </span>
                                                </td>
                                                <td className="text-center">{config.frameSkip}</td>
                                                <td className="text-center">{config.cylinderSegments}</td>
                                                <td className="text-center">{config.enableHand3D ? '✓' : '✗'}</td>
                                                <td className="text-center">{config.targetFPS}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </Section>
                    
                </div>
            )}
        </div>
    );
}

// =============================================================================
// SOUS-COMPOSANTS
// =============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="border-t border-blue-400/30 pt-2">
            <div className="text-blue-200 text-[10px] uppercase tracking-wider mb-1.5">
                {title}
            </div>
            {children}
        </div>
    );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div className="flex justify-between items-center">
            <span className="text-blue-200/70">{label}:</span>
            <span>{value}</span>
        </div>
    );
}

function TierBadge({ tier }: { tier: PerformanceTier }) {
    const colors: Record<PerformanceTier, string> = {
        0: 'bg-red-500/20 text-red-400',
        1: 'bg-orange-500/20 text-orange-400',
        2: 'bg-blue-500/20 text-blue-400',
        3: 'bg-green-500/20 text-green-400',
    };
    
    return (
        <span className={`px-1.5 py-0.5 rounded ${colors[tier]}`}>
            T{tier} {getTierName(tier)}
        </span>
    );
}

function GpuBadge({ tier }: { tier: 'low' | 'mid' | 'high' | 'unknown' }) {
    const styles: Record<string, string> = {
        low: 'text-red-400',
        mid: 'text-yellow-400',
        high: 'text-green-400',
        unknown: 'text-gray-400',
    };
    
    const icons: Record<string, string> = {
        low: '🔴',
        mid: '🟡',
        high: '🟢',
        unknown: '⚪',
    };
    
    return (
        <span className={styles[tier]}>
            {icons[tier]} {tier.charAt(0).toUpperCase() + tier.slice(1)}
        </span>
    );
}

function FpsBadge({ fps }: { fps: number }) {
    let color = 'text-green-400';
    let icon = '🟢';

    if (fps < 20) {
        color = 'text-red-400';
        icon = '🔴';
    } else if (fps < 30) {
        color = 'text-yellow-400';
        icon = '🟡';
    }

    return (
        <span className={`${color} font-bold`}>
            {icon} {fps} FPS
        </span>
    );
}

function FovBadge({ fov }: { fov: number }) {
    // Typical webcam FOV ranges: 50-80° is normal, <50° is narrow, >80° is wide
    let color = 'text-green-400';
    let status = 'normal';

    if (fov < 45) {
        color = 'text-orange-400';
        status = 'étroit';
    } else if (fov > 90) {
        color = 'text-yellow-400';
        status = 'large';
    }

    return (
        <span className={color}>
            {fov.toFixed(1)}° <span className="text-blue-200/50">({status})</span>
        </span>
    );
}

// =============================================================================
// COMPOSANT MINIMAL (version compacte)
// =============================================================================

export function PerformanceDebugMini({ position = 'bottom-left' }: { position?: string }) {
    const [capabilities, setCapabilities] = useState<DeviceCapabilities | null>(null);
    const [fps, setFps] = useState(0);
    const fpsTrackerRef = useRef<FPSTracker | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    
    useEffect(() => {
        const caps = detectDeviceCapabilities();
        setCapabilities(caps);
        fpsTrackerRef.current = new FPSTracker(30);
        
        const loop = () => {
            fpsTrackerRef.current?.recordFrame();
            const m = fpsTrackerRef.current?.getMetrics();
            if (m && m.frameCount % 15 === 0) {
                setFps(m.currentFPS);
            }
            animationFrameRef.current = requestAnimationFrame(loop);
        };
        
        animationFrameRef.current = requestAnimationFrame(loop);
        
        return () => {
            if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        };
    }, []);
    
    if (!capabilities) return null;
    
    const positionStyles: Record<string, string> = {
        'top-left': 'top-4 left-4',
        'top-right': 'top-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'bottom-right': 'bottom-4 right-4',
        'middle-left': 'top-1/2 left-4 -translate-y-1/2',
        'middle-right': 'top-1/2 right-4 -translate-y-1/2',
    };
    
    return (
        <div className={`fixed ${positionStyles[position]} z-50 bg-blue-600/90 text-white px-2 py-1 rounded text-xs font-mono`}>
            T{capabilities.recommendedTier} | {fps} FPS | {capabilities.isMobile ? '📱' : '💻'}
        </div>
    );
}

// =============================================================================
// EXPORTS
// =============================================================================

export default PerformanceDebug;