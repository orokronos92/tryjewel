"use client";

import { useEffect, useRef, useState } from "react";
import { useEdgeARTracking } from "@/hooks/use-edge-ar-tracking";

export function TestWorldLandmarks() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const maxLogs = 10;

  const { lastResult } = useEdgeARTracking(videoRef.current, {
    jewelryType: 'ring',
    finger: 'index',
    hand: 'right',
    onResult: (result) => {
      if (result.success && result.hand_result?.world_landmarks) {
        const landmarks = result.hand_result.landmarks;
        const worldLandmarks = result.hand_result.world_landmarks;

        const mcp = landmarks[5]; // Index MCP
        const pip = landmarks[6]; // Index PIP
        const worldMcp = worldLandmarks[5];
        const worldPip = worldLandmarks[6];

        const fingerWidthWorld = Math.sqrt(
          Math.pow(worldPip.x - worldMcp.x, 2) +
          Math.pow(worldPip.y - worldMcp.y, 2) +
          Math.pow(worldPip.z - worldMcp.z, 2)
        );

        const fingerWidthImage = Math.sqrt(
          Math.pow(pip.x - mcp.x, 2) +
          Math.pow(pip.y - mcp.y, 2)
        );

        const scale = Math.max(0.5, Math.min(2.0, fingerWidthWorld * 50));

        const log = `
          [TEST] fingerWidthWorld: ${fingerWidthWorld.toFixed(6)}
          fingerWidthImage: ${fingerWidthImage.toFixed(6)}
          scale: ${scale.toFixed(6)}
          worldMcp: (${worldMcp.x.toFixed(6)}, ${worldMcp.y.toFixed(6)}, ${worldMcp.z.toFixed(6)})
          worldPip: (${worldPip.x.toFixed(6)}, ${worldPip.y.toFixed(6)}, ${worldPip.z.toFixed(6)})
        `;

        setLogs(prev => {
          const newLogs = [...prev, log];
          return newLogs.slice(-maxLogs);
        });
      }
    }
  });

  useEffect(() => {
    // Démarrer la caméra
    if (videoRef.current && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        })
        .catch(err => console.error('Camera error:', err));
    }
  }, []);

  return (
    <div className="p-4 space-y-4 bg-black text-green-400 font-mono text-xs">
      <h2 className="text-white text-lg font-bold">Test World Landmarks</h2>
      <video ref={videoRef} autoPlay playsInline muted className="w-64 h-48 border border-green-400" />
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {logs.map((log, i) => (
          <pre key={i} className="whitespace-pre-wrap border-b border-green-800 pb-2">
            {log}
          </pre>
        ))}
      </div>
    </div>
  );
}
