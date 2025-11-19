"use client";

import { useState, useRef } from "react";
import { CameraFeed } from "@/components/camera-feed";
import { useARTracking } from "@/hooks/use-ar-tracking";
import { useCameraStore } from "@/stores/camera-store";
import { useJewelryStore } from "@/stores/jewelry-store";
import { useTrackingStore } from "@/stores/tracking-store";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CameraIcon, Activity } from "lucide-react";

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
            <SelectItem value="earring">💎 Boucle d'oreille</SelectItem>
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

export default function TrackingPage() {
  const { camera } = useCameraStore();
  const { tracking, connection_status } = useTrackingStore();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { isTracking, startTracking, stopTracking } = useARTracking(videoRef.current);

  // Connect videoRef to camera stream
  if (camera.stream && videoRef.current && !videoRef.current.srcObject) {
    videoRef.current.srcObject = camera.stream;
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">
          🤖 AR Virtual Try-On (Phase 3 - Beta)
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Configuration
              </h2>
              <JewelrySelector />
            </Card>

            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Statut</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span>Caméra:</span>
                  <Badge variant={camera.isActive ? "default" : "secondary"}>
                    {camera.isActive ? "✅ Active" : "❌ Inactive"}
                  </Badge>
                </div>

                <div className="flex justify-between">
                  <span>WebSocket:</span>
                  <Badge variant={connection_status === 'connected' ? "default" : "secondary"}>
                    {connection_status === 'connected' ? "✅ Connecté" : "❌ Déconnecté"}
                  </Badge>
                </div>

                <div className="flex justify-between">
                  <span>Tracking:</span>
                  <Badge variant={isTracking ? "default" : "secondary"}>
                    {isTracking ? "🎯 Actif" : "⏸️ Inactif"}
                  </Badge>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    onClick={isTracking ? stopTracking : startTracking}
                    disabled={!camera.isActive || connection_status !== 'connected'}
                    variant={isTracking ? "destructive" : "default"}
                    className="w-full"
                  >
                    {isTracking ? "⏹️ Arrêter tracking" : "🚀 Démarrer tracking"}
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Panel - Camera */}
          <div className="lg:col-span-2">
            <Card className="p-0 overflow-hidden">
              <CardContent className="p-0">
                {camera.isActive ? (
                  <div className="relative">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover aspect-video"
                    />
                    {isTracking && (
                      <div className="absolute top-4 left-4 bg-black/70 text-white px-3 py-2 rounded-lg">
                        <div className="text-sm font-medium">🎯 Tracking actif</div>
                        <div className="text-xs text-green-400">Envoi des frames...</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="aspect-video bg-muted flex flex-col items-center justify-center gap-4">
                    <CameraIcon className="w-16 h-16 text-muted-foreground" />
                    <p className="text-muted-foreground">Caméra inactive</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
