"use client";

import { CameraFeed } from "@/components/camera-feed";

export default function TestCameraPage() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Test Caméra</h1>
          <p className="text-muted-foreground">
            Page de test pour valider le fonctionnement de la caméra
          </p>
        </div>

        <CameraFeed autoStart={false} showControls={true} />

        <div className="bg-muted p-4 rounded-lg">
          <h2 className="font-semibold mb-2">Instructions</h2>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li>Cliquer sur "Démarrer la caméra"</li>
            <li>Autoriser l'accès à la caméra dans le navigateur</li>
            <li>Vérifier que le flux vidéo s'affiche</li>
            <li>Tester le bouton "Arrêter"</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
