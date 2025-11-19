"use client";

import { useEffect } from "react";
import { useWebcam } from "@/hooks/use-webcam";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Camera, CameraOff, AlertCircle } from "lucide-react";

interface CameraFeedProps {
  onFrameCapture?: (base64: string) => void;
  autoStart?: boolean;
  showControls?: boolean;
  className?: string;
}

export function CameraFeed({
  onFrameCapture,
  autoStart = true,
  showControls = true,
  className = "",
}: CameraFeedProps) {
  const {
    videoRef,
    stream,
    isActive,
    error,
    isLoading,
    startCamera,
    stopCamera,
    toggleCamera
  } = useWebcam();

  // Auto-start si demandé
  useEffect(() => {
    if (autoStart && !isActive && !isLoading) {
      startCamera();
    }
  }, [autoStart]);

  return (
    <Card className={`w-full ${className}`}>
      <CardContent className="p-0">
        {/* Zone vidéo */}
        <div className="relative bg-black aspect-video overflow-hidden">
          {isActive ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <CameraOff className="w-16 h-16 text-gray-400" />
              <p className="text-gray-400">Caméra inactive</p>
              {!isLoading && showControls && (
                <Button onClick={startCamera} size="lg">
                  <Camera className="mr-2 h-5 w-5" />
                  Démarrer la caméra
                </Button>
              )}
            </div>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                <p>Initialisation caméra...</p>
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
            </div>

            {/* Info vidéo */}
            {stream && (
              <div className="mt-4 text-xs text-muted-foreground">
                {(() => {
                  const settings = stream.getVideoTracks()[0]?.getSettings();
                  return settings ? (
                    <div className="space-y-1">
                      <div>Résolution: {settings.width}×{settings.height}</div>
                      <div>Device: {settings.deviceId?.slice(0, 8)}...</div>
                    </div>
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
