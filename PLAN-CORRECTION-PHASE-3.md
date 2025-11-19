# 🎥 PLAN CORRECTION PHASE 3 - Webcam & AR Core

**État actuel :** 30% (WebSocket ✅, Caméra ❌)  
**État cible :** 100%  
**Durée estimée :** 2-3 heures

---

## 📊 RÉCAPITULATIF PHASE 3

### ✅ Ce qui fonctionne (30%)
- ✅ WebSocket connecté (backend ↔ frontend)
- ✅ Jewelry selector créé (4 types)
- ✅ Hand selector créé (gauche/droite)
- ✅ Finger selector créé (5 doigts)
- ✅ Stores Zustand opérationnels
- ✅ AR configuration flow (UI)

### ❌ Ce qui manque (70%)
- ❌ **Caméra ne démarre pas** (écran noir)
- ❌ Hook `use-webcam.ts` incomplet (fonctions vides)
- ❌ Frame capture non implémenté
- ❌ Communication WebSocket avec frames non testée
- ❌ Tracking temps réel non opérationnel

---

## 🎯 DIAGNOSTIC PROBLÈME CAMÉRA

### Cause racine identifiée

**Fichier :** `apps/web/components/camera-feed.tsx`

**Problème :** Le composant utilise `useCameraStore` mais les fonctions `startCamera()`, `stopCamera()` sont définies **dans le composant**, pas dans le hook.

**Résultat :** Le hook `useCamera()` (si appelé) retourne des fonctions vides.

### Architecture attendue

```
camera-feed.tsx (Composant UI)
    ↓ utilise
use-webcam.ts (Hook logique)
    ↓ utilise
camera-store.ts (State Zustand)
```

**Actuellement :** Tout est mélangé dans `camera-feed.tsx`

---

## 🔧 PLAN D'ACTION - 4 ÉTAPES

### **ÉTAPE 1 : Compléter Hook use-webcam.ts** (45 min)

#### Problème
Le hook existe mais contient uniquement des `TODO` et fonctions vides.

#### Actions

**1.1 - Ouvrir le fichier**

📍 `apps/web/hooks/use-webcam.ts`

**État actuel :** Squelette avec TODOs

---

**1.2 - Implémenter startCamera()**

Remplacer le TODO par :

```typescript
const startCamera = async () => {
  setIsLoading(true);
  clearError();

  try {
    const constraints: MediaStreamConstraints = {
      video: {
        width: { ideal: camera.constraints.width || 1280 },
        height: { ideal: camera.constraints.height || 720 },
        facingMode: camera.constraints.facingMode || 'user',
        deviceId: camera.currentCameraId ? { exact: camera.currentCameraId } : undefined,
      },
      audio: false,
    };

    const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    
    setStream(mediaStream);
    setCameraActive(true);

    if (videoRef.current) {
      videoRef.current.srcObject = mediaStream;
    }

    // Vérifier permission status (optionnel)
    try {
      const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
      // Store la permission si besoin
    } catch {
      // Permission API pas disponible sur tous navigateurs
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Accès caméra refusé';
    setError(errorMessage);
    console.error('[useWebcam] Erreur démarrage caméra:', error);
  } finally {
    setIsLoading(false);
  }
};
```

---

**1.3 - Implémenter stopCamera()**

Remplacer le TODO par :

```typescript
const stopCamera = () => {
  if (camera.stream) {
    camera.stream.getTracks().forEach(track => {
      track.stop();
      console.log('[useWebcam] Track arrêté:', track.kind);
    });
    setStream(null);
    setCameraActive(false);
    setVideoReady(false);
  }
};
```

---

**1.4 - Implémenter toggleCamera()**

Remplacer le TODO par :

```typescript
const toggleCamera = async () => {
  if (camera.isActive) {
    stopCamera();
  } else {
    await startCamera();
  }
};
```

---

**1.5 - Implémenter switchCamera()**

Remplacer le TODO par :

```typescript
const switchCamera = async (deviceId: string) => {
  console.log('[useWebcam] Changement caméra:', deviceId);
  
  // Arrêter caméra actuelle
  if (camera.isActive) {
    stopCamera();
  }
  
  // Mettre à jour device ID dans store
  useCameraStore.getState().setCurrentCamera(deviceId);
  
  // Redémarrer avec nouvelle caméra
  await startCamera();
};
```

---

**1.6 - Ajouter effet pour video element**

Ajouter dans le hook, avant le return :

```typescript
// Connecter stream au video element quand il change
useEffect(() => {
  if (videoRef.current && camera.stream) {
    videoRef.current.srcObject = camera.stream;
    
    // Listener pour savoir quand vidéo est prête
    const handleLoadedMetadata = () => {
      console.log('[useWebcam] Vidéo prête');
      useCameraStore.getState().setVideoReady(true);
    };
    
    videoRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      videoRef.current?.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }
}, [camera.stream]);

// Cleanup au unmount
useEffect(() => {
  return () => {
    stopCamera();
  };
}, []);
```

---

**1.7 - Validation**

Vérifier que le fichier compile :

```powershell
cd C:\AR_jewel\apps\web
npm run build
```

**Résultat attendu :** Pas d'erreurs TypeScript sur `use-webcam.ts`

---

### **ÉTAPE 2 : Simplifier camera-feed.tsx** (30 min)

#### Problème
Le composant `camera-feed.tsx` réimplémente toute la logique alors qu'elle devrait être dans le hook.

#### Actions

**2.1 - Ouvrir le fichier**

📍 `apps/web/components/camera-feed.tsx`

---

**2.2 - Remplacer tout le contenu**

Supprimer tout et remplacer par :

```typescript
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
    camera, 
    isLoading,
    startCamera, 
    stopCamera, 
    toggleCamera 
  } = useWebcam();

  // Auto-start si demandé
  useEffect(() => {
    if (autoStart && !camera.isActive && !isLoading) {
      startCamera();
    }
  }, [autoStart]);

  return (
    <Card className={`w-full ${className}`}>
      <CardContent className="p-0">
        {/* Zone vidéo */}
        <div className="relative bg-black aspect-video overflow-hidden">
          {camera.isActive ? (
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
        {camera.error && (
          <Alert variant="destructive" className="m-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{camera.error}</AlertDescription>
          </Alert>
        )}

        {/* Contrôles */}
        {showControls && (
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <Button
                onClick={toggleCamera}
                disabled={isLoading}
                variant={camera.isActive ? "destructive" : "default"}
                className="flex-1"
              >
                {camera.isActive ? (
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
            {camera.isVideoReady && camera.stream && (
              <div className="mt-4 text-xs text-muted-foreground">
                {(() => {
                  const settings = camera.stream.getVideoTracks()[0]?.getSettings();
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
```

---

**2.3 - Validation**

Compiler :

```powershell
cd C:\AR_jewel\apps\web
npm run build
```

**Résultat attendu :** Pas d'erreurs

---

### **ÉTAPE 3 : Créer Page de Test /test-camera** (15 min)

#### Objectif
Avoir une page dédiée pour tester la caméra isolément.

#### Actions

**3.1 - Créer dossier**

📍 `apps/web/app/test-camera/`

```powershell
cd C:\AR_jewel\apps\web\app
mkdir test-camera
```

---

**3.2 - Créer page.tsx**

📍 `apps/web/app/test-camera/page.tsx`

Créer ce fichier :

```typescript
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
```

---

**3.3 - Tester la page**

Backend déjà démarré, frontend déjà démarré, ouvre dans navigateur :

```
http://localhost:3000/test-camera
```

**Actions attendues :**
1. Cliquer "Démarrer la caméra"
2. Popup navigateur demande permission
3. Cliquer "Autoriser"
4. Flux vidéo apparaît

**Résultat attendu :** ✅ Vidéo visible

---

### **ÉTAPE 4 : Implémenter Frame Capture & Tracking** (60 min)

#### Objectif
Une fois la caméra fonctionnelle, capturer les frames et les envoyer au backend.

#### Actions

**4.1 - Compléter use-ar-tracking.ts**

📍 `apps/web/hooks/use-ar-tracking.ts`

**État actuel :** Squelette avec TODOs

**Implémenter :**

```typescript
import { useEffect, useRef } from 'react';
import { useTrackingStore } from '@/stores/tracking-store';
import { useJewelryStore } from '@/stores/jewelry-store';

export function useARTracking(videoElement: HTMLVideoElement | null) {
  const frameIntervalRef = useRef<NodeJS.Timeout>();
  const lastFrameTimeRef = useRef(0);
  
  const { 
    tracking,
    socket,
    startTracking, 
    stopTracking,
    updateTrackingResults,
    updatePerformance 
  } = useTrackingStore();
  
  const { selected } = useJewelryStore();

  useEffect(() => {
    if (!tracking.is_tracking || !videoElement || !socket) return;

    console.log('[useARTracking] Starting frame capture loop');

    // Frame capture loop (10 FPS)
    frameIntervalRef.current = setInterval(async () => {
      if (videoElement.readyState === videoElement.HAVE_ENOUGH_DATA) {
        const startTime = performance.now();
        
        try {
          // Capture frame as base64
          const canvas = document.createElement('canvas');
          canvas.width = videoElement.videoWidth;
          canvas.height = videoElement.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          
          ctx.drawImage(videoElement, 0, 0);
          
          // Convert to base64
          const base64Image = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
          
          // Send via WebSocket
          socket.emit('track_frame', {
            image_base64: base64Image,
            jewelry_type: selected.jewelry_type || 'ring',
            finger: selected.finger,
            hand: selected.hand,
            frame_id: `frame_${Date.now()}`,
            timestamp: Date.now(),
          });
          
          lastFrameTimeRef.current = startTime;
          
        } catch (error) {
          console.error('[useARTracking] Frame capture error:', error);
        }
      }
    }, 100); // 10 FPS = 100ms interval

    return () => {
      if (frameIntervalRef.current) {
        clearInterval(frameIntervalRef.current);
      }
    };
  }, [tracking.is_tracking, videoElement, socket, selected]);

  // Listen for tracking results
  useEffect(() => {
    if (!socket) return;

    const handleTrackingResults = (result: any) => {
      const now = performance.now();
      const latency = now - lastFrameTimeRef.current;
      
      updateTrackingResults(result);
      updatePerformance(calculateFPS(), latency);
    };

    socket.on('tracking_results', handleTrackingResults);

    return () => {
      socket.off('tracking_results', handleTrackingResults);
    };
  }, [socket]);

  return {
    isTracking: tracking.is_tracking,
    isProcessing: tracking.is_processing,
    lastResult: tracking.last_result,
    startTracking,
    stopTracking,
  };
}

function calculateFPS() {
  // Simplified FPS calculation
  return 10; // TODO: Implement proper FPS tracking
}
```

---

**4.2 - Modifier page /tracking principale**

📍 `apps/web/app/tracking/page.tsx` (ou créer si absent)

Créer/Modifier :

```typescript
"use client";

import { useState } from "react";
import { CameraFeed } from "@/components/camera-feed";
import { JewelrySelector } from "@/components/ar/jewelry-selector";
import { Button } from "@/components/ui/button";
import { useARTracking } from "@/hooks/use-ar-tracking";
import { useCameraStore } from "@/stores/camera-store";

export default function TrackingPage() {
  const { camera } = useCameraStore();
  const { isTracking, startTracking, stopTracking } = useARTracking(
    camera.stream?.getVideoTracks()[0] as any // TODO: Better typing
  );

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">AR Virtual Try-On</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Controls */}
          <div className="space-y-6">
            <JewelrySelector />
            
            <div className="space-y-2">
              {camera.isActive ? (
                isTracking ? (
                  <Button 
                    onClick={stopTracking} 
                    variant="destructive"
                    className="w-full"
                  >
                    Arrêter le tracking
                  </Button>
                ) : (
                  <Button 
                    onClick={startTracking}
                    className="w-full bg-gold-500 hover:bg-gold-600"
                  >
                    Démarrer le tracking
                  </Button>
                )
              ) : (
                <p className="text-sm text-muted-foreground text-center">
                  Démarrez la caméra pour commencer
                </p>
              )}
            </div>
          </div>

          {/* Right Panel - Camera */}
          <div className="lg:col-span-2">
            <CameraFeed autoStart={true} showControls={true} />
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

**4.3 - Tester le tracking complet**

**Setup (3 terminaux) :**

Terminal 1 - Backend :
```powershell
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\activate
$env:PYTHONPATH="$PWD/src"
python src/api/server.py
```

Terminal 2 - Frontend :
```powershell
cd C:\AR_jewel\apps\web
npm run dev
```

Terminal 3 - Logs :
```powershell
# Observer les logs backend
```

**Test :**
1. Ouvrir `http://localhost:3000/tracking`
2. Caméra démarre automatiquement
3. Sélectionner "Bague" + "Index" + "Main gauche"
4. Cliquer "Démarrer le tracking"
5. Mettre ta main devant la caméra

**Résultat attendu :**
- ✅ Backend logs : "track_frame received"
- ✅ Backend logs : "Tracking result: success=True"
- ✅ Console navigateur (F12) : Pas d'erreurs
- ✅ WebSocket messages visibles

---

## ✅ VALIDATION FINALE PHASE 3

### Checklist Definition of Done

#### Caméra ✅
- [ ] Caméra démarre sur `/test-camera`
- [ ] Flux vidéo visible (pas d'écran noir)
- [ ] Bouton Arrêter fonctionne
- [ ] Permissions navigateur gérées
- [ ] Erreurs affichées clairement

#### Hooks ✅
- [ ] `use-webcam.ts` complet (pas de TODOs)
- [ ] `use-ar-tracking.ts` complet
- [ ] Fonctions testées et fonctionnelles
- [ ] TypeScript compile sans erreurs

#### Configuration ✅
- [ ] Sélecteur bijou fonctionne
- [ ] Sélecteur main fonctionne
- [ ] Sélecteur doigt fonctionne
- [ ] État sauvegardé dans Zustand

#### Communication ✅
- [ ] WebSocket connecté (vert)
- [ ] Frames envoyées au backend (logs visibles)
- [ ] Résultats reçus du backend
- [ ] Latence <100ms en moyenne

#### Integration ✅
- [ ] Page `/tracking` fonctionnelle
- [ ] Backend reçoit les frames
- [ ] Pas d'erreurs console
- [ ] Tracking peut démarrer/arrêter

---

## 📊 PROGRESSION

| Critère | Avant | Après |
|---------|-------|-------|
| Caméra fonctionne | ❌ | ✅ |
| Hook webcam complet | ❌ | ✅ |
| Frame capture | ❌ | ✅ |
| WebSocket frames | ❌ | ✅ |
| Tracking testable | ❌ | ✅ |
| **Score Phase 3** | **30%** | **100%** |

---

## 🎯 COMMANDES RÉSUMÉ

```powershell
# ÉTAPE 1 : Modifier use-webcam.ts
# (fait manuellement dans VSCode)

# ÉTAPE 2 : Modifier camera-feed.tsx
# (fait manuellement dans VSCode)

# ÉTAPE 3 : Créer page test
cd C:\AR_jewel\apps\web\app
mkdir test-camera

# Compiler
cd C:\AR_jewel\apps\web
npm run build

# ÉTAPE 4 : Tester
# Terminal 1 - Backend
cd C:\AR_jewel\apps\python-api
.\venv\Scripts\activate
$env:PYTHONPATH="$PWD/src"
python src/api/server.py

# Terminal 2 - Frontend
cd C:\AR_jewel\apps\web
npm run dev

# Navigateur
# http://localhost:3000/test-camera
# http://localhost:3000/tracking
```

---

## 🚨 PROBLÈMES POSSIBLES

### Caméra toujours noire après corrections

**Causes possibles :**
1. Permission refusée → Vérifier paramètres navigateur
2. Caméra utilisée par autre app → Fermer Zoom, Teams, etc.
3. HTTPS requis → Utiliser localhost (OK) ou HTTPS
4. Navigateur incompatible → Tester Chrome/Edge

**Debug :**
```javascript
// Console navigateur (F12)
navigator.mediaDevices.getUserMedia({ video: true })
  .then(stream => console.log('✅ Camera OK', stream))
  .catch(err => console.error('❌ Camera error', err))
```

---

### WebSocket ne reçoit pas les frames

**Vérifier :**
1. Backend logs : "track_frame received" doit apparaître
2. Console navigateur : Pas d'erreur WebSocket
3. État tracking : `isTracking` doit être `true`

**Debug backend :**
```python
# Dans websocket.py, ajouter log
@socketio.on('track_frame')
def handle_track_frame(data):
    print(f"📦 Frame reçue: {len(data.get('image_base64', ''))} bytes")
    # ... reste du code
```

---

### Latence trop élevée (>100ms)

**Solutions :**
1. Réduire qualité image : `canvas.toDataURL('image/jpeg', 0.5)` au lieu de 0.8
2. Réduire FPS : interval 200ms au lieu de 100ms
3. Réduire résolution caméra : 640×480 au lieu de 1280×720
4. Vérifier Redis cache actif (doit réduire latence)

---

## 📝 FICHIERS MODIFIÉS

### Hooks
```
apps/web/hooks/
├── use-webcam.ts              [MODIFIER - implémenter fonctions]
└── use-ar-tracking.ts         [MODIFIER - implémenter frame capture]
```

### Components
```
apps/web/components/
└── camera-feed.tsx            [MODIFIER - simplifier, utiliser hook]
```

### Pages
```
apps/web/app/
├── test-camera/
│   └── page.tsx               [CRÉER - page de test caméra]
└── tracking/
    └── page.tsx               [CRÉER/MODIFIER - page tracking principale]
```

---

## 🎉 APRÈS PHASE 3 COMPLÈTE

**Tu auras :**
- ✅ Caméra fonctionnelle et testée
- ✅ Frames envoyées au backend en temps réel
- ✅ Backend reçoit et traite les frames
- ✅ Base prête pour afficher bijou 3D (Phase 4)

**Commit final :**
```powershell
cd C:\AR_jewel
git add .
git commit -m "Phase 3 COMPLETE - Webcam + AR tracking temps réel fonctionnel"
git push
git tag v3.0.0-phase3
git push --tags
```

**Prêt pour Phase 4 (Three.js 3D) !** 🚀

---

## 💡 NOTES IMPORTANTES

### Pourquoi 10 FPS seulement ?

10 FPS = bon compromis entre :
- ✅ Fluidité acceptable (100ms latency max)
- ✅ Charge serveur raisonnable
- ✅ Latence réseau gérable
- ✅ CPU/GPU pas surchargés

Plus tard (Phase 8 optimisation) : augmenter à 20-30 FPS.

### Pourquoi JPEG qualité 0.8 ?

- PNG = trop lourd (2-3MB par frame)
- JPEG 1.0 = inutilement lourd
- JPEG 0.8 = **bon compromis** (100-200KB, qualité OK pour MediaPipe)
- JPEG 0.5 = si latence problème

### Auto-start caméra ?

Sur `/test-camera` : `autoStart={false}` (contrôle manuel)
Sur `/tracking` : `autoStart={true}` (démarrage immédiat)

Raison : UX meilleure, utilisateur prêt quand il arrive sur tracking.

---

**PRÊT À COMMENCER ÉTAPE 1 ?** 🎯
