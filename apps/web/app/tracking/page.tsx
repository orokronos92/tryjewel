"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import dynamic from 'next/dynamic';
import { CameraFeed } from "@/components/camera-feed";
import { useEdgeARTracking } from "@/hooks/use-edge-ar-tracking";
import { useEdgeTrackingStore } from "@/stores/edge-tracking-store";
import { useCameraStore } from "@/stores/camera-store";
import { useJewelryStore } from "@/stores/jewelry-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Smartphone, Sparkles } from "lucide-react";
import { ARAdjustmentControls } from "@/components/ar-adjustment-controls";
import { PerformanceDebugMini } from '@/components/performance-debug';
import { usePerformanceStore, useTierConfig } from '@/stores/performance-store';
import { getTierName } from '@/lib/adaptive-performance';
import { CalibrationWizard } from '@/components/calibration-wizard';
import { RingSizeIndicatorCompact, RingSizeSummary } from '@/components/ring-size-indicator';
import { useCalibrationStore } from '@/stores/calibration-store';

// =============================================================================
// IMPORTS DYNAMIQUES (SSR disabled)
// =============================================================================

const Jewelry3D = dynamic(
  () => import('@/components/jewelry-3d'),
  { ssr: false }
);

// =============================================================================
// JEWELRY SELECTOR
// =============================================================================

function JewelrySelector() {
  const { selected, setJewelryType, setFinger, setHand } = useJewelryStore();

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Type de bijou</label>
        <Select
          value={selected.jewelry_type || "ring"}
          onValueChange={(value: "ring" | "bracelet" | "earring" | "necklace") => setJewelryType(value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ring">💍 Bague</SelectItem>
            <SelectItem value="bracelet">⌚ Bracelet</SelectItem>
            <SelectItem value="earring">💎 Boucle d&apos;oreille</SelectItem>
            <SelectItem value="necklace">📿 Collier</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.jewelry_type === "ring" && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">Main</label>
            <Select
              value={selected.hand}
              onValueChange={(value: "left" | "right") => setHand(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">🤚 Gauche</SelectItem>
                <SelectItem value="right">🤚 Droite</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Doigt</label>
            <Select
              value={selected.finger}
              onValueChange={(value: "thumb" | "index" | "middle" | "ring" | "pinky") => setFinger(value)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thumb">Pouce</SelectItem>
                <SelectItem value="index">Index</SelectItem>
                <SelectItem value="middle">Majeur</SelectItem>
                <SelectItem value="ring">Annulaire</SelectItem>
                <SelectItem value="pinky">Auriculaire</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}

// =============================================================================
// PAGE PRINCIPALE - VERSION 11.0 (Hand3D supprimé)
// =============================================================================

export default function TrackingPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  // ⚡ FIX CANVAS: State pour les dimensions exactes de la vidéo
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const lastDimensionsRef = useRef<{ width: number; height: number } | null>(null);

  // Stores
  const { camera } = useCameraStore();
  const { tracking, updateTrackingResult, setTracking, updateFPS } = useEdgeTrackingStore();
  const { selected } = useJewelryStore();
  const {
    isCalibrating,
    isCalibrated,
    setIsCalibrating,
    currentStep,
    resetCalibration,
  } = useCalibrationStore();

  // ⚡ Reset calibration au démarrage de la session (une seule fois)
  const hasResetRef = useRef(false);
  useEffect(() => {
    if (!hasResetRef.current) {
      hasResetRef.current = true;
      resetCalibration();
      console.log('[Tracking] 🔄 Calibration reset pour nouvelle session');
    }
  }, []);

  // ⚡ PERFORMANCE ADAPTATIF - Récupérer la config du tier actuel
  const tierConfig = useTierConfig();
  const { initialize: initPerformance, currentTier, recordFrame, checkAndAdapt } = usePerformanceStore();

  // Détection mobile
  const isMobile = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent.toLowerCase();
    const mobile = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const smallScreen = window.innerWidth < 768;
    return mobile || (hasTouch && smallScreen);
  }, []);

  // ==========================================================================
  // VERROUILLAGE PORTRAIT (mobile uniquement)
  // ==========================================================================

  useEffect(() => {
    if (!isMobile) return;

    const lockOrientation = async () => {
      try {
        // @ts-ignore - L'API screen.orientation.lock n'est pas dans tous les types
        if (screen.orientation?.lock) {
          // @ts-ignore
          await screen.orientation.lock('portrait');
        }
      } catch {
        // Silently fail
      }
    };

    lockOrientation();

    return () => {
      try {
        // @ts-ignore
        screen.orientation?.unlock?.();
      } catch {
        // Ignore
      }
    };
  }, [isMobile]);

  // ==========================================================================
  // ⚡ PERFORMANCE ADAPTATIF - Initialisation au démarrage
  // ==========================================================================

  useEffect(() => {
    initPerformance();
    console.log('[TrackingPage] 🎯 Performance system initialized, tier:', currentTier, getTierName(currentTier));
  }, [initPerformance]);

  // ==========================================================================
  // EDGE AR TRACKING
  // ==========================================================================

  const {
    isTracking,
    isInitialized,
    startTracking,
    stopTracking,
    fps,
    error,
    averageProcessingTime
  } = useEdgeARTracking(videoElement, {
    jewelryType: selected.jewelry_type || 'ring',
    finger: selected.finger || 'index',
    hand: selected.hand || 'right',
    // ⚡ PERFORMANCE ADAPTATIF - Utiliser les configs du tier détecté
    frameSkip: tierConfig.frameSkip,
    modelComplexity: tierConfig.modelComplexity,
    minDetectionConfidence: tierConfig.minDetectionConfidence,
    minTrackingConfidence: tierConfig.minTrackingConfidence,
    onResult: (result) => {
      updateTrackingResult(result);
      // ⚡ Enregistrer la frame pour les métriques de performance
      recordFrame();
    }
  });

  // Sync FPS to store
  useEffect(() => {
    updateFPS(fps);
  }, [fps, updateFPS]);

  // Sync tracking state to store
  useEffect(() => {
    setTracking(isTracking);
  }, [isTracking, setTracking]);

  // ⚡ ADAPTATION AUTOMATIQUE - Vérifier toutes les 2 secondes
  useEffect(() => {
    if (!isTracking) return;

    const interval = setInterval(() => {
      checkAndAdapt();
    }, 2000);

    return () => clearInterval(interval);
  }, [isTracking, checkAndAdapt]);

  // Set video element when ready
  useEffect(() => {
    setVideoElement(videoRef.current);
  }, [camera.isActive]);

  // ⚡ FIX CANVAS: handleVideoReady avec ResizeObserver pour capturer les vraies dimensions
  const handleVideoReady = useCallback((video: HTMLVideoElement) => {
    setVideoElement(video);

    // Fonction pour mettre à jour les dimensions
    const updateDimensions = () => {
      if (!video) return;

      const width = video.clientWidth;
      const height = video.clientHeight;

      // Ne mettre à jour QUE si les dimensions ont vraiment changé
      if (width > 0 && height > 0) {
        const last = lastDimensionsRef.current;
        if (!last || last.width !== width || last.height !== height) {
          lastDimensionsRef.current = { width, height };
          setVideoDimensions({ width, height });
          console.log('[Page] 📐 Video dimensions updated:', { width, height });
        }
      }
    };

    // Mettre à jour immédiatement
    updateDimensions();

    // Cleanup ancien observer si existe
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }

    // Observer les changements de taille
    resizeObserverRef.current = new ResizeObserver(updateDimensions);
    resizeObserverRef.current.observe(video);
  }, []);

  // Cleanup ResizeObserver au démontage
  useEffect(() => {
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  // ==========================================================================
  // CALIBRATION
  // ==========================================================================

  const handleButtonClick = useCallback(() => {
    const calibStore = useCalibrationStore.getState();
    console.log('[Tracking] 🚀 Button clicked, state:', {
      isCalibrated: calibStore.isCalibrated,
      isCalibrating: calibStore.isCalibrating,
      currentStep: calibStore.currentStep,
    });

    if (!calibStore.isCalibrated) {
      // Lancer la calibration
      console.log('[Tracking] 📐 Lancement calibration wizard...');
      useCalibrationStore.getState().setIsCalibrating(true);
      startTracking(); // Pour avoir les landmarks MediaPipe
    } else {
      // Calibré -> lancer le tracking
      console.log('[Tracking] ✅ Calibré, démarrage essayage...');
      startTracking();
    }
  }, [startTracking]);

  const handleCalibrationClose = useCallback(() => {
    setIsCalibrating(false);
    // Si la calibration n'est PAS complète, arrêter le tracking
    if (!useCalibrationStore.getState().isCalibrated) {
      stopTracking();
    }
    // Si complète, le tracking continue
  }, [setIsCalibrating, stopTracking]);

  // Récupérer les landmarks pour la calibration
  const currentLandmarks = tracking.last_result?.hand_result?.landmarks ?? null;
  const currentWorldLandmarks = tracking.last_result?.hand_result?.world_landmarks ?? null;

  // ==========================================================================
  // RENDER
  // ==========================================================================

  return (
    <div className="min-h-screen bg-background p-2 sm:p-4">

      {/* Performance Debug */}
      <PerformanceDebugMini position="top-left" />

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <h1 className="text-xl sm:text-3xl font-bold mb-4 sm:mb-6 flex items-center gap-2">
          💍 AR Try-On
          {isMobile && (
            <Badge variant="outline" className="text-xs">
              <Smartphone className="w-3 h-3 mr-1" />
              Mobile
            </Badge>
          )}
        </h1>

        {/* Layout adaptatif */}
        <div className={`grid gap-4 sm:gap-6 ${isMobile ? 'grid-cols-1' : 'grid-cols-1 lg:grid-cols-3'}`}>

          {/* ================================================================
              MOBILE: Caméra en premier (plein écran)
              ================================================================ */}
          {isMobile && (
            <div className="relative w-full">
              <CameraFeed
                autoStart={true}
                showControls={false}
                onVideoReady={handleVideoReady}
              />

              {/* Bijou 3D - v11.0 UNIFIÉ (inclut tous les calculs) */}
              {/* ⚡ FIX: Monter une seule fois, Jewelry3D gère la visibilité en interne */}
              {isTracking && !isCalibrating && (
                <Jewelry3D
                  videoWidth={videoDimensions?.width}
                  videoHeight={videoDimensions?.height}
                />
              )}

              {/* Wizard de calibration */}
              {isCalibrating && (
                <CalibrationWizard
                  onClose={handleCalibrationClose}
                  containerWidth={videoDimensions?.width || 640}
                  containerHeight={videoDimensions?.height || 480}
                  videoElement={videoElement}
                  landmarks={currentLandmarks}
                  worldLandmarks={currentWorldLandmarks}
                />
              )}

              {/* Overlay compact mobile */}
              {isTracking && camera.isActive && !isCalibrating && (
                <div className="absolute top-16 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs z-20">
                  {tracking.last_result?.success ? "✅" : "🔍"} {fps.toFixed(0)} FPS
                  <span className="ml-2 opacity-70">T{currentTier}</span>
                </div>
              )}

              {/* Indicateur de taille de bague */}
              {isTracking && !isCalibrating && isCalibrated && (
                <RingSizeIndicatorCompact className="absolute top-16 right-2 z-20" />
              )}

              {/* Contrôles AR */}
              {isTracking && !isCalibrating && <ARAdjustmentControls />}
            </div>
          )}

          {/* ================================================================
              PANNEAU CONFIGURATION
              ================================================================ */}
          <div className={`space-y-4 sm:space-y-6 ${isMobile ? 'order-2' : ''}`}>
            <Card className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
                Configuration
              </h2>
              <JewelrySelector />
            </Card>

            <Card className="p-4 sm:p-6">
              <h2 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Statut</h2>
              <div className="space-y-2 sm:space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span>Caméra:</span>
                  <Badge variant={camera.isActive ? "default" : "secondary"} className="text-xs">
                    {camera.isActive ? "✅ Active" : "⏸ Inactive"}
                  </Badge>
                </div>

                <div className="flex justify-between">
                  <span>MediaPipe:</span>
                  <Badge variant={isInitialized ? "default" : "secondary"} className="text-xs">
                    {isInitialized ? "✅ Prêt" : "⏳ Chargement..."}
                  </Badge>
                </div>

                <div className="flex justify-between">
                  <span>Tracking:</span>
                  <Badge variant={isTracking ? "default" : "secondary"} className="text-xs">
                    {isTracking ? "🎯 Actif" : "⏸ Inactif"}
                  </Badge>
                </div>

                {/* ⚡ Performance Tier */}
                <div className="flex justify-between">
                  <span>Performance:</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      currentTier === 0 ? 'bg-red-500/10 text-red-500' :
                      currentTier === 1 ? 'bg-orange-500/10 text-orange-500' :
                      currentTier === 2 ? 'bg-blue-500/10 text-blue-500' :
                      'bg-green-500/10 text-green-500'
                    }`}
                  >
                    T{currentTier} {getTierName(currentTier)}
                  </Badge>
                </div>

                {/* ⚡ Config actuelle */}
                {isTracking && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Config:</span>
                    <span className="text-xs">
                      Skip:{tierConfig.frameSkip} • Model:{tierConfig.modelComplexity === 0 ? 'Lite' : 'Full'}
                    </span>
                  </div>
                )}

                {/* Stats */}
                {isTracking && fps > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span>FPS:</span>
                      <Badge variant="outline" className="bg-green-500/10 text-green-500 text-xs">
                        {fps.toFixed(1)} FPS
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span>Latence:</span>
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-500 text-xs">
                        {averageProcessingTime.toFixed(0)} ms
                      </Badge>
                    </div>
                  </>
                )}

                {/* Erreurs */}
                {error && (
                  <div className="pt-2 border-t">
                    <p className="text-red-500 text-xs">{error}</p>
                  </div>
                )}

                {/* Bouton */}
                <div className="pt-3 sm:pt-4 border-t">
                  <Button
                    onClick={isTracking ? stopTracking : handleButtonClick}
                    disabled={!camera.isActive || !isInitialized || !videoElement}
                    variant={isTracking ? "destructive" : "default"}
                    className="w-full text-sm"
                  >
                    {isTracking ? (
                      "⏹️ Arrêter"
                    ) : isCalibrated ? (
                      "🎯 Commencer l'essayage"
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-1" />
                        Calibrer & Démarrer
                      </>
                    )}
                  </Button>
                </div>

                {/* Résumé des tailles si calibré */}
                {isCalibrated && !isTracking && (
                  <RingSizeSummary className="mt-4" />
                )}
              </div>
            </Card>
          </div>

          {/* ================================================================
              DESKTOP: Caméra à droite (2 colonnes)
              ================================================================ */}
          {!isMobile && (
            <div className="lg:col-span-2 relative">
              <CameraFeed
                autoStart={true}
                showControls={true}
                onVideoReady={handleVideoReady}
              />

              {/* Bijou 3D - v11.0 UNIFIÉ */}
              {/* ⚡ FIX: Monter une seule fois, Jewelry3D gère la visibilité en interne */}
              {isTracking && !isCalibrating && (
                <Jewelry3D
                  videoWidth={videoDimensions?.width}
                  videoHeight={videoDimensions?.height}
                />
              )}

              {/* Wizard de calibration */}
              {isCalibrating && (
                <CalibrationWizard
                  onClose={handleCalibrationClose}
                  containerWidth={videoDimensions?.width || 640}
                  containerHeight={videoDimensions?.height || 480}
                  videoElement={videoElement}
                  landmarks={currentLandmarks}
                  worldLandmarks={currentWorldLandmarks}
                />
              )}

              {/* Overlay desktop */}
              {isTracking && camera.isActive && !isCalibrating && (
                <div className="absolute top-8 left-8 bg-black/70 text-white px-3 py-2 rounded-lg z-20">
                  <div className="text-sm font-medium">🎯 Edge Computing</div>
                  <div className="text-xs text-green-400">
                    {tracking.last_result?.success
                      ? "✅ Main détectée"
                      : "🔍 Recherche..."}
                  </div>
                  <div className="text-xs text-blue-400 mt-1">
                    ⚡ {fps.toFixed(0)} FPS • {averageProcessingTime.toFixed(0)}ms
                  </div>
                  <div className="text-xs text-yellow-400 mt-1">
                    📊 T{currentTier} {getTierName(currentTier)} • Skip:{tierConfig.frameSkip}
                  </div>
                </div>
              )}

              {/* Indicateur de taille de bague */}
              {isTracking && !isCalibrating && isCalibrated && (
                <RingSizeIndicatorCompact className="absolute top-8 right-8 z-20" />
              )}

              {/* Contrôles AR */}
              {isTracking && !isCalibrating && <ARAdjustmentControls />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}