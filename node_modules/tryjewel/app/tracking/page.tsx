"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CameraIcon } from "lucide-react";

export default function TrackingPage() {
  const [cameraActive, setCameraActive] = useState(false);

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Virtual Try-On</h1>
          <p className="text-muted-foreground">
            AR jewelry tracking (simplified version)
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Jewelry Selection</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Type
                  </label>
                  <select className="w-full p-2 border rounded">
                    <option value="ring">Ring</option>
                    <option value="bracelet">Bracelet</option>
                    <option value="earring">Earring</option>
                    <option value="necklace">Necklace</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Finger
                  </label>
                  <select className="w-full p-2 border rounded">
                    <option value="ring">Ring Finger</option>
                    <option value="index">Index</option>
                    <option value="middle">Middle</option>
                    <option value="thumb">Thumb</option>
                    <option value="pinky">Pinky</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Hand
                  </label>
                  <select className="w-full p-2 border rounded">
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">Status</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Camera:</span>
                  <span className={cameraActive ? "text-green-500" : "text-red-500"}>
                    {cameraActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Connection:</span>
                  <span className="text-yellow-500">Connecting...</span>
                </div>
                <div className="flex justify-between">
                  <span>FPS:</span>
                  <span>0</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Right Panel - Camera */}
          <div className="lg:col-span-2">
            <Card className="p-6 h-[600px] flex flex-col items-center justify-center">
              {!cameraActive ? (
                <div className="text-center">
                  <CameraIcon className="w-16 h-16 text-muted-foreground mb-4 mx-auto" />
                  <h2 className="text-2xl font-bold mb-2">Camera Inactive</h2>
                  <p className="text-muted-foreground mb-6">
                    Click the button below to start the camera
                  </p>
                  <Button
                    onClick={() => setCameraActive(true)}
                    size="lg"
                  >
                    <CameraIcon className="w-5 h-5 mr-2" />
                    Start Camera
                  </Button>
                </div>
              ) : (
                <div className="w-full h-full bg-black rounded-lg flex items-center justify-center">
                  <p className="text-white">
                    Camera feed will appear here
                    <br />
                    <span className="text-sm text-gray-400">
                      (WebRTC integration required)
                    </span>
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}