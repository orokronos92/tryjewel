/**
 * =============================================================================
 * DEVICE-DETECTION.TS - VERSION 2.1.0
 * =============================================================================
 * 
 * Utilitaires pour détecter le type d'appareil et ses capacités caméra.
 * 
 * @author TryJewel Team
 * @version 2.1.0
 */

// =============================================================================
// TYPES
// =============================================================================

export type FacingMode = 'user' | 'environment';
export type Platform = 'ios' | 'android' | 'other';
export type Orientation = 'portrait' | 'landscape';

export interface DeviceInfo {
  isMobile: boolean;
  isTablet: boolean;
  platform: Platform;
  orientation: Orientation;
  screenWidth: number;
  screenHeight: number;
  hasTouch: boolean;
  userAgent: string;
}

export interface CameraProfile {
  facingMode: FacingMode;
  width: number;
  height: number;
  aspectRatio: number;
  shouldMirror: boolean;
}

export interface CameraInfo {
  deviceId: string;
  label: string;
  facingMode: FacingMode | null;
}

// =============================================================================
// DÉTECTION DU DEVICE
// =============================================================================

/**
 * Détecte le type d'appareil actuel
 */
export function detectDevice(): DeviceInfo {
  // SSR guard
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      isMobile: false,
      isTablet: false,
      platform: 'other',
      orientation: 'landscape',
      screenWidth: 1920,
      screenHeight: 1080,
      hasTouch: false,
      userAgent: '',
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  
  // Détection mobile
  const mobileRegex = /android|webos|iphone|ipod|blackberry|iemobile|opera mini/i;
  const tabletRegex = /ipad|android(?!.*mobile)/i;
  
  const isMobile = mobileRegex.test(ua) && !tabletRegex.test(ua);
  const isTablet = tabletRegex.test(ua);
  
  // Fallback: détection par touch et taille d'écran
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const smallScreen = window.innerWidth < 768;
  
  // Si on a du touch ET un petit écran, c'est probablement un mobile
  const isMobileByFeatures = hasTouch && smallScreen;
  
  // Détection plateforme
  let platform: Platform = 'other';
  if (/iphone|ipad|ipod/i.test(ua)) {
    platform = 'ios';
  } else if (/android/i.test(ua)) {
    platform = 'android';
  }
  
  // Orientation
  const isPortrait = window.innerHeight > window.innerWidth;
  
  return {
    isMobile: isMobile || isMobileByFeatures,
    isTablet,
    platform,
    orientation: isPortrait ? 'portrait' : 'landscape',
    screenWidth: window.innerWidth,
    screenHeight: window.innerHeight,
    hasTouch,
    userAgent: ua,
  };
}

// =============================================================================
// PROFIL CAMÉRA
// =============================================================================

/**
 * Génère un profil de contraintes caméra adapté au device
 */
export function getCameraProfile(
  facingMode: FacingMode = 'user',
  device?: DeviceInfo
): CameraProfile {
  const d = device || detectDevice();
  
  // Miroir seulement pour caméra frontale
  const shouldMirror = facingMode === 'user';
  
  if (d.isMobile || d.isTablet) {
    if (d.orientation === 'portrait') {
      // Mobile portrait - ratio 9:16
      return {
        facingMode,
        width: 720,
        height: 1280,
        aspectRatio: 9 / 16,
        shouldMirror,
      };
    } else {
      // Mobile paysage - ratio 16:9
      return {
        facingMode,
        width: 1280,
        height: 720,
        aspectRatio: 16 / 9,
        shouldMirror,
      };
    }
  }
  
  // Desktop - toujours paysage
  return {
    facingMode: 'user',
    width: 1280,
    height: 720,
    aspectRatio: 16 / 9,
    shouldMirror: true,
  };
}

// =============================================================================
// VÉRIFICATION CAPACITÉS CAMÉRA
// =============================================================================

/**
 * Vérifie si l'appareil peut switcher entre caméras
 */
export async function canSwitchCamera(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return false;
  }
  
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');
    return cameras.length > 1;
  } catch {
    return false;
  }
}

/**
 * Énumère les caméras disponibles avec leur facingMode supposé
 */
export async function enumerateCameras(): Promise<CameraInfo[]> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
    return [];
  }
  
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter(d => d.kind === 'videoinput');
    
    return cameras.map(camera => {
      // Essayer de deviner le facingMode depuis le label
      const label = camera.label.toLowerCase();
      let facingMode: FacingMode | null = null;
      
      if (label.includes('front') || label.includes('user') || label.includes('selfie') || label.includes('facetime')) {
        facingMode = 'user';
      } else if (label.includes('back') || label.includes('rear') || label.includes('environment') || label.includes('arrière')) {
        facingMode = 'environment';
      }
      
      return {
        deviceId: camera.deviceId,
        label: camera.label || `Camera ${camera.deviceId.slice(0, 8)}`,
        facingMode,
      };
    });
  } catch {
    return [];
  }
}

// =============================================================================
// UTILITAIRES MIROIR
// =============================================================================

/**
 * Détermine si la vidéo doit être en miroir
 */
export function shouldMirrorVideo(facingMode: FacingMode): boolean {
  // Miroir pour caméra frontale (selfie), pas pour caméra arrière
  return facingMode === 'user';
}

// =============================================================================
// LISTENER ORIENTATION
// =============================================================================

/**
 * Ajoute un listener pour les changements d'orientation
 */
export function onOrientationChange(callback: (device: DeviceInfo) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }
  
  const handler = () => {
    // Petit délai pour laisser le temps au navigateur de mettre à jour les dimensions
    setTimeout(() => {
      callback(detectDevice());
    }, 100);
  };
  
  window.addEventListener('orientationchange', handler);
  window.addEventListener('resize', handler);
  
  return () => {
    window.removeEventListener('orientationchange', handler);
    window.removeEventListener('resize', handler);
  };
}

// =============================================================================
// EXPORTS
// =============================================================================

export const deviceDetection = {
  detectDevice,
  getCameraProfile,
  canSwitchCamera,
  enumerateCameras,
  shouldMirrorVideo,
  onOrientationChange,
};

export default deviceDetection;