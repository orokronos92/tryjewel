# AR Jewelry Try-On - Suivi de Progression

## Vue d'ensemble

Application d'essayage virtuel de bijoux (bagues) utilisant MediaPipe pour le tracking de main en temps réel.

---

## Ce qui fonctionne

### 1. Tracking MediaPipe
- Détection de main en temps réel
- Extraction des landmarks (21 points)
- Rendu 3D du squelette de la main avec Three.js

### 2. Contour de main pour calibration
- SVG réaliste avec 5 doigts distincts (source: OpenClipart)
- Couleur verte semi-transparente (`#22c55e`, `rgba(34, 197, 94, 0.15)`)
- Fichier externe `/public/assets/hand-outline.svg`
- Sliders indépendants pour largeur ET hauteur
- `preserveAspectRatio="none"` pour permettre l'ajustement libre

### 3. Interface de calibration (structure)
- Wizard en 4 étapes :
  1. Carte bancaire à 30cm
  2. Main à 30cm
  3. Carte bancaire à 50cm
  4. Main à 50cm
- Navigation entre étapes
- Affichage contextuel carte/main selon l'étape

### 4. Slider Z pour profondeur
- Contrôle manuel de la position Z des bijoux
- Effet parallaxe simulé pour caméra orthographique

---

## Formules implémentées (à valider)

### Tour de doigt (circonférence)
```typescript
// Formule de Ramanujan pour ellipse
// C ≈ π * (3(a+b) - √((3a+b)(a+3b)))
function ellipseCircumference(width: number, depth: number): number {
    const a = width / 2;
    const b = depth / 2;
    return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}
```

### Ratios anatomiques des doigts
```typescript
// Largeur des doigts par rapport à la paume
const FINGER_WIDTH_RATIOS = {
    index: 0.22,   // ~22% de la largeur paume
    middle: 0.23,  // ~23% (le plus large)
    ring: 0.21,    // ~21%
    pinky: 0.18,   // ~18% (le plus fin)
};

// Ratio profondeur/largeur pour les doigts
const FINGER_DEPTH_RATIO = 0.85;
```

### Conversion tailles de bagues
```typescript
// EU: circonférence en mm directement
eu = Math.round(circumferenceMm);

// US: formule standard
us = (circumferenceMm - 36.5) / 2.55;

// UK: approximation (A=37mm, +1.25mm par taille)
ukIndex = Math.round((circumferenceMm - 37) / 1.25);
```

### Pixels vers mm (via carte bancaire)
```typescript
// Carte bancaire ISO/IEC 7810 ID-1
const CREDIT_CARD_WIDTH_MM = 85.6;
const CREDIT_CARD_HEIGHT_MM = 53.98;

// Ratio de conversion
pixelsPerMm = cardWidthPx / CREDIT_CARD_WIDTH_MM;
```

---

## Ce qui ne fonctionne pas encore

### 1. Calibration non intégrée au tracking
- Les mesures de calibration sont stockées mais pas utilisées
- Le rendu 3D n'utilise pas les données de calibration
- Pas de conversion pixels → mm en temps réel

### 2. Estimation de la profondeur Z
- MediaPipe fournit un Z relatif (pas métrique)
- La calibration à 30cm et 50cm devrait permettre d'interpoler
- Non implémenté actuellement

### 3. PerspectiveCamera vs OrthographicCamera
- Actuellement: OrthographicCamera (pas de perspective naturelle)
- Objectif: PerspectiveCamera avec FOV calibré
- Le FOV peut être estimé via la calibration (ratio taille carte à différentes distances)

---

## Idées explorées

### 1. Double calibration (30cm / 50cm)
**Concept:** Capturer les données à deux distances permet de :
- Calculer le FOV réel de la caméra
- Interpoler la profondeur Z en temps réel
- Compenser les variations de taille apparente

**État:** Structure en place, logique de calcul non implémentée

### 2. Capteurs de l'appareil (orientation)
**Concept:** Utiliser l'accéléromètre/gyroscope pour :
- Détecter l'orientation du téléphone pendant calibration
- Stabiliser le rendu lors de mouvements
- Fusion de données capteurs + vision

**État:** POC documenté, non implémenté

### 3. Effet parallaxe Z simulé
**Concept:** Pour caméra orthographique, simuler la profondeur via :
- Décalage vertical (objets plus loin → plus haut dans l'image)
- Scaling (objets plus loin → plus petits)

**État:** Implémenté partiellement avec slider manuel

---

## Structure des données

### CalibrationStore (Zustand)
```typescript
interface CalibrationState {
    currentStep: number;          // 0-5
    closeDistance: DistanceCalibration | null;  // 30cm
    farDistance: DistanceCalibration | null;    // 50cm
    finalFingerSizes: {
        index: RingSizes | null;
        middle: RingSizes | null;
        ring: RingSizes | null;
        pinky: RingSizes | null;
    };
    skeletonScaleFactor: number;
    isCalibrated: boolean;
    isCalibrating: boolean;
}

interface DistanceCalibration {
    cardWidthPx: number;
    pixelsPerMm: number;
    handMeasurements: HandMeasurements | null;
}
```

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `components/calibration-wizard.tsx` | Interface de calibration 4 étapes |
| `stores/calibration-store.ts` | État global calibration (Zustand) |
| `components/jewelry-3d.tsx` | Rendu Three.js des bijoux |
| `components/hand-tracking-overlay.tsx` | Overlay MediaPipe |
| `public/assets/hand-outline.svg` | SVG du contour de main |

---

## Prochaines étapes prioritaires

1. **Valider les formules de tour de doigt**
   - Tester avec des mesures réelles
   - Comparer avec des baguiers standard

2. **Intégrer la calibration au rendu**
   - Utiliser `pixelsPerMm` pour dimensionner les bijoux
   - Appliquer le `skeletonScaleFactor`

3. **Implémenter l'estimation Z**
   - Calculer le FOV depuis calibration 30cm/50cm
   - Interpoler Z en temps réel

4. **Passer en PerspectiveCamera**
   - Utiliser le FOV calibré
   - Supprimer les hacks de parallaxe

---

## Notes techniques

- **Framework:** Next.js 16 + React 19
- **3D:** Three.js + React Three Fiber
- **Tracking:** MediaPipe Hands (vision tasks)
- **State:** Zustand avec persistence
- **Style:** Tailwind CSS + shadcn/ui
