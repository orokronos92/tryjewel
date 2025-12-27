/**
 * =============================================================================
 * CAMERA-FEED.TSX - VERSION 6.0 - LA VERSION QUI MARCHE
 * =============================================================================
 */

"use client";

import { useEffect } from "react";
import { useWebcam } from "@/hooks/use-webcam";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Camera,
  CameraOff,
  AlertCircle,
  SwitchCamera,
  FlipHorizontal,
  Smartphone
} from "lucide-react";

interface CameraFeedProps {
  onVideoReady?: (video: HTMLVideoElement) => void;
  autoStart?: boolean;
  showControls?: boolean;
  className?: string;
}

export function CameraFeed({
  onVideoReady,
  autoStart = true,
  showControls = true,
  className = "",
}: CameraFeedProps) {
  const {
    videoRef,
    stream,
    isActive,
    isLoading,
    error,
    facingMode,
    shouldMirror,
    canSwitchCamera,
    isMobile,
    startCamera,
    toggleCamera,
    switchFacingMode,
  } = useWebcam();

  // Auto-start
  useEffect(() => {
    if (autoStart && !isActive && !isLoading) {
      startCamera();
    }
  }, [autoStart, isActive, isLoading, startCamera]);

  // Notify video ready
  useEffect(() => {
    const video = videoRef.current;
    if (video && stream && isActive && onVideoReady) {
      if (video.readyState >= 2) {
        onVideoReady(video);
      } else {
        const handleLoaded = () => onVideoReady(video);
        video.addEventListener('loadedmetadata', handleLoaded);
        return () => video.removeEventListener('loadedmetadata', handleLoaded);
      }
    }
  }, [stream, isActive, onVideoReady, videoRef]);

  // Video style avec mirroring
  const videoStyle: React.CSSProperties = {
    transform: shouldMirror ? 'scaleX(-1)' : 'none',
    transition: 'transform 0.3s ease',
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  };

  return (
    <Card className={`w-full overflow-hidden ${className}`}>
      <CardContent className="p-0 relative">
        <div
          className="relative bg-black overflow-hidden"
          style={{ aspectRatio: isMobile ? '3/4' : '16/9' }}
        >
          {isActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={videoStyle}
              />

              {/* ⚡ BOUTON SWITCH - TOUJOURS VISIBLE SI canSwitchCamera */}
              {canSwitchCamera && (
                <button
                  onClick={switchFacingMode}
                  disabled={isLoading}
                  className="absolute top-3 right-3 z-30 p-3 rounded-full bg-black/60 hover:bg-black/80 text-white transition-all disabled:opacity-50 shadow-lg"
                  style={{ transform: isLoading ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s' }}
                >
                  <SwitchCamera className="w-6 h-6" />
                </button>
              )}

              {/* Indicateur caméra */}
              <div className="absolute top-3 left-3 z-30 flex items-center gap-2 px-2 py-1 rounded-full bg-black/50 text-white text-xs">
                {facingMode === 'user' ? (
                  <>
                    <FlipHorizontal className="w-4 h-4" />
                    <span>Selfie</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4" />
                    <span>Arrière</span>
                  </>
                )}
              </div>

              {/* Loading pendant switch */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40">
                  <div className="text-white text-center">
                    <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                    <p className="text-sm">Changement...</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <CameraOff className="w-16 h-16 text-gray-400" />
              <p className="text-gray-400">Caméra inactive</p>
              {!isLoading && showControls && (
                <Button onClick={startCamera} size="lg">
                  <Camera className="mr-2 h-5 w-5" />
                  Démarrer
                </Button>
              )}
            </div>
          )}

          {/* Loading initial */}
          {isLoading && !isActive && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-40">
              <div className="text-white text-center">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                <p>Initialisation...</p>
              </div>
            </div>
          )}
        </div>

        {/* Erreur */}
        {error && (
          <Alert variant="destructive" className="m-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Contrôles */}
        {showControls && (
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Button
                onClick={toggleCamera}
                disabled={isLoading}
                variant={isActive ? "destructive" : "default"}
                className="flex-1"
              >
                {isActive ? (
                  <>
                    <CameraOff className="mr-2 h-4 w-4" />
                    Arrêter
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 h-4 w-4" />
                    Démarrer
                  </>
                )}
              </Button>

              {canSwitchCamera && isActive && (
                <Button
                  onClick={switchFacingMode}
                  disabled={isLoading}
                  variant="outline"
                >
                  <SwitchCamera className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Infos */}
            {stream && (
              <div className="mt-4 text-xs text-muted-foreground space-y-1">
                {(() => {
                  const settings = stream.getVideoTracks()[0]?.getSettings();
                  return settings ? (
                    <>
                      <div>Résolution: {settings.width}×{settings.height}</div>
                      <div>Caméra: {facingMode === 'user' ? 'Frontale' : 'Arrière'}</div>
                      <div>Miroir: {shouldMirror ? 'Oui' : 'Non'}</div>
                      {isMobile && <div>📱 Mobile</div>}
                    </>
                  ) : null;
                })()}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CameraFeed;