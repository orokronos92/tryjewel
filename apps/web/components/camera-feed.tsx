"use client";

import { useRef, useEffect, useState } from "react";
import { useCameraStore } from "@/stores/camera-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CameraOff, RefreshCw, AlertCircle } from "lucide-react";

/**
 * Simplified Camera Feed Component
 */

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const {
    camera,
    availableCameras,
    setCameraActive,
    setVideoReady,
    setError,
    setCurrentCamera,
    setStream,
    clearError,
    loadCameras,
  } = useCameraStore();

  // Initialize camera on mount
  useEffect(() => {
    if (autoStart && !camera.isActive) {
      startCamera();
    }
  }, [autoStart]);

  // Handle video element when stream changes
  useEffect(() => {
    if (videoRef.current && camera.stream) {
      videoRef.current.srcObject = camera.stream;
    }
  }, [camera.stream]);

  // Load available cameras
  useEffect(() => {
    loadCameras().catch(console.error);
  }, [loadCameras]);

  const handleLoadedMetadata = () => {
    setVideoReady(true);
  };

  const handleVideoError = () => {
    setError("Video playback error");
  };

  const startCamera = async () => {
    try {
      setIsInitializing(true);
      clearError();

      const constraints: MediaStreamConstraints = {
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: camera.constraints.facingMode,
          deviceId: camera.currentCameraId || undefined,
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(stream);
      setCameraActive(true);

      try {
        const permission = await navigator.permissions.query({
          name: 'camera' as PermissionName
        });
        useCameraStore.getState().setPermissionStatus(permission.state);
      } catch {
        // Permission API not available
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Camera access denied';
      setError(errorMessage);
      console.error('Camera error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopCamera = () => {
    if (camera.stream) {
      camera.stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setCameraActive(false);
      setVideoReady(false);
    }
  };

  const toggleCamera = async () => {
    if (camera.isActive) {
      stopCamera();
    } else {
      await startCamera();
    }
  };

  const switchCamera = async (deviceId: string) => {
    setCurrentCamera(deviceId);
    if (camera.isActive) {
      stopCamera();
      await startCamera();
    }
  };

  const captureFrame = async (): Promise<string | null> => {
    if (!videoRef.current || !camera.isActive) {
      setError("Camera not active");
      return null;
    }

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!canvas) return null;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (!context) {
        setError("Canvas context not available");
        return null;
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      return new Promise((resolve) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              onFrameCapture?.(base64);
              resolve(base64);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          },
          'image/jpeg',
          0.8
        );
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to capture frame';
      setError(errorMessage);
      return null;
    }
  };

  const getStatusBadge = () => {
    if (camera.error) {
      return <Badge variant="destructive" className="flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Error
      </Badge>;
    }

    if (!camera.isActive) {
      return <Badge variant="secondary">Inactive</Badge>;
    }

    if (camera.isActive && !camera.isVideoReady) {
      return <Badge variant="outline">Initializing...</Badge>;
    }

    return <Badge variant="default" className="flex items-center gap-1">
      <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
      Active
    </Badge>;
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Camera Feed
          </CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          {camera.isActive ? (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={handleLoadedMetadata}
                onError={handleVideoError}
                className="w-full h-full object-cover"
              />

              {isInitializing && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="flex items-center gap-2 text-white">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Initializing camera...</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 bg-muted flex flex-col items-center justify-center gap-3">
              <CameraOff className="w-12 h-12 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Camera inactive</p>
              {camera.permissionStatus !== 'granted' && (
                <p className="text-xs text-muted-foreground">
                  Click &ldquo;Start Camera&rdquo; to enable access
                </p>
              )}
            </div>
          )}
        </div>

        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {camera.error && (
          <div className="bg-destructive/15 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{camera.error}</span>
          </div>
        )}

        {showControls && (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                onClick={toggleCamera}
                disabled={isInitializing}
                className="flex-1"
                variant={camera.isActive ? "destructive" : "default"}
              >
                {camera.isActive ? (
                  <>
                    <CameraOff className="w-4 h-4 mr-2" />
                    Stop Camera
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    Start Camera
                  </>
                )}
              </Button>

              {camera.isActive && camera.isVideoReady && (
                <Button onClick={captureFrame} variant="outline">
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  Capture
                </Button>
              )}
            </div>

            {availableCameras.length > 1 && (
              <div>
                <label className="text-sm font-medium mb-1 block">Camera:</label>
                <select
                  value={camera.currentCameraId || ''}
                  onChange={(e) => switchCamera(e.target.value)}
                  className="w-full p-2 border rounded-md bg-background"
                  disabled={isInitializing}
                >
                  {availableCameras.map((cam) => (
                    <option key={cam.deviceId} value={cam.deviceId}>
                      {cam.label || `Camera ${cam.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {camera.isVideoReady && camera.stream && (
              <div className="text-xs text-muted-foreground space-y-1">
                {(() => {
                  const settings = camera.stream.getVideoTracks()[0]?.getSettings();
                  return settings ? (
                    <>
                      <div>Resolution: {settings.width}×{settings.height}</div>
                      <div>Facing: {settings.facingMode || 'unknown'}</div>
                      <div>Device: {camera.currentCameraId?.slice(0, 8) || 'default'}</div>
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