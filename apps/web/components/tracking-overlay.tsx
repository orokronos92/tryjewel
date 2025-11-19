"use client";

import React, { Suspense, useState, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, Sphere, Ring } from "@react-three/drei";
import * as THREE from "three";
import { useTrackingStore } from "@/stores/tracking-store";
import { useJewelryStore } from "@/stores/jewelry-store";
import { type JewelryType } from "@/stores/jewelry-store";

/**
 * Simplified 3D Jewelry Tracking Overlay
 */

// Types
interface Position {
  x: number;
  y: number;
  z: number;
}

interface Rotation {
  x: number;
  y: number;
  z: number;
}

interface JewelryPosition {
  position: Position;
  rotation: Rotation;
  scale: number;
  confidence: number;
}

interface HandLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

interface HandResult {
  handedness: string;
  handedness_score: number;
  landmarks: HandLandmark[];
}

interface TrackingData {
  jewelry_position: JewelryPosition | null;
  hand_result: HandResult | null;
  confidence: number;
  success: boolean;
}

// Lights component using hooks
function SceneLights() {
  const { scene } = useThree();
  
  useEffect(() => {
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    const directional = new THREE.DirectionalLight(0xffffff, 1);
    directional.position.set(10, 10, 5);
    
    scene.add(ambient);
    scene.add(directional);
    
    return () => {
      scene.remove(ambient);
      scene.remove(directional);
    };
  }, [scene]);
  
  return null;
}

// Simple Ring Component
function Ring3D({ position, rotation, scale, color = "#FFD700" }: {
  position: Position;
  rotation: Rotation;
  scale: number;
  color?: string;
}) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.8,
    roughness: 0.2,
  }), [color]);

  return (
    <Ring
      position={[position.x * 10, -position.y * 10, position.z * 5]}
      rotation={[rotation.x * 0.017, rotation.y * 0.017, rotation.z * 0.017]}
      args={[0.8 * scale, 1.2 * scale, 32]}
      material={material}
    />
  );
}

// Simple Bracelet Component
function Bracelet3D({ position, rotation, scale, color = "#C0C0C0" }: {
  position: Position;
  rotation: Rotation;
  scale: number;
  color?: string;
}) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.9,
    roughness: 0.1,
  }), [color]);

  return (
    <Ring
      position={[position.x * 10, -position.y * 10, position.z * 5]}
      rotation={[rotation.x * 0.017, 0, 0]}
      args={[1.5 * scale, 1.8 * scale, 64]}
      material={material}
    />
  );
}

// Jewelry Model Selector
function JewelryModel({ trackingData, jewelryType }: {
  trackingData: TrackingData;
  jewelryType: JewelryType;
}) {
  if (!trackingData.jewelry_position || !trackingData.success) {
    return null;
  }

  const { position, rotation, scale } = trackingData.jewelry_position;

  switch (jewelryType) {
    case "ring":
      return <Ring3D position={position} rotation={rotation} scale={scale} />;
    case "bracelet":
      return <Bracelet3D position={position} rotation={rotation} scale={scale} />;
    default:
      return null;
  }
}

// Main 3D Scene
function TrackingScene({ trackingData }: { trackingData: TrackingData }) {
  const { selected } = useJewelryStore();

  const indicatorMaterial = useMemo(() => {
    if (!trackingData.jewelry_position) return null;
    
    const confidence = trackingData.jewelry_position.confidence;
    const color = confidence > 0.8 ? "#00ff00" : confidence > 0.5 ? "#ffff00" : "#ff0000";
    
    return new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
    });
  }, [trackingData.jewelry_position]);

  return (
    <>
      <SceneLights />
      {selected.jewelry_type && (
        <JewelryModel trackingData={trackingData} jewelryType={selected.jewelry_type} />
      )}
      
      {trackingData.jewelry_position && indicatorMaterial && (
        <Sphere
          args={[0.1]}
          position={[
            trackingData.jewelry_position.position.x * 10,
            -trackingData.jewelry_position.position.y * 10,
            trackingData.jewelry_position.position.z * 5 + 1,
          ]}
          material={indicatorMaterial}
        />
      )}
    </>
  );
}

// Main Component
export function TrackingOverlay({
  className = "",
  showStats = true,
}: {
  videoRef?: React.RefObject<HTMLVideoElement>;
  className?: string;
  showStats?: boolean;
}) {
  const { tracking } = useTrackingStore();
  const { selected } = useJewelryStore();
  const [trackingData, setTrackingData] = useState<TrackingData>({
    jewelry_position: null,
    hand_result: null,
    confidence: 0,
    success: false,
  });

  // Compute tracking data from store
  const computedTrackingData = useMemo(() => {
    if (!tracking.last_result) {
      return {
        jewelry_position: null,
        hand_result: null,
        confidence: 0,
        success: false,
      };
    }
    return {
      jewelry_position: tracking.last_result.jewelry_position || null,
      hand_result: tracking.last_result.hand_result || null,
      confidence: tracking.last_result.confidence || 0,
      success: tracking.last_result.success,
    };
  }, [tracking.last_result]);

  useEffect(() => {
    setTrackingData(computedTrackingData);
  }, [computedTrackingData]);

  return (
    <div className={`relative w-full h-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 10], fov: 75 }}
        style={{ position: "absolute", inset: 0 }}
      >
        <Suspense fallback={null}>
          <TrackingScene trackingData={trackingData} />
          <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
        </Suspense>
      </Canvas>

      {/* Overlay Info */}
      <div className="absolute top-4 left-4 space-y-2">
        {selected.jewelry_type && (
          <div className="bg-black/50 text-white p-2 rounded text-sm">
            <div>Jewelry: {selected.jewelry_type}</div>
            {selected.jewelry_type === "ring" && <div>Finger: {selected.finger}</div>}
            <div>Hand: {selected.hand}</div>
          </div>
        )}

        {showStats && tracking.is_tracking && (
          <div className="bg-black/50 text-white p-2 rounded text-sm">
            <div>FPS: {tracking.processing_fps}</div>
            <div>Latency: {tracking.average_latency_ms}ms</div>
            <div>Confidence: {(trackingData.confidence * 100).toFixed(1)}%</div>
          </div>
        )}
      </div>

      {/* Connection Status */}
      <div className="absolute top-4 right-4">
        <div
          className={`w-3 h-3 rounded-full ${
            tracking.is_tracking
              ? "bg-green-500"
              : "bg-red-500"
          }`}
        />
      </div>
    </div>
  );
}

// Loading State
export function TrackingOverlayLoading() {
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
        <p>Initializing 3D tracking...</p>
      </div>
    </div>
  );
}

// Error State
export function TrackingOverlayError({ error }: { error: string }) {
  return (
    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
      <div className="text-white text-center p-4">
        <p className="text-red-500 mb-2">Tracking Error</p>
        <p className="text-sm">{error}</p>
      </div>
    </div>
  );
}

// Type exports
export type { Position, Rotation, JewelryPosition, HandLandmark, HandResult, TrackingData };

export default TrackingOverlay;