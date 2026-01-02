/**
 * =============================================================================
 * DEBUG LOGGER - Système de debug centralisé pour AR Jewelry
 * =============================================================================
 *
 * Usage dans le code:
 *   import { dbg } from '@/lib/debug-logger';
 *   dbg.frame({ total: 45, capture: 3, mediapipe: 38, transform: 4, fps: 22 });
 *
 * Usage dans la console browser:
 *   dbg.status()           // Voir l'état
 *   dbg.enable('render')   // Activer une catégorie
 *   dbg.disable('frame')   // Désactiver une catégorie
 *   dbg.setThrottle(1000)  // Changer le throttle
 */

type LogCategory = "startup" | "frame" | "render" | "track" | "cam";

interface StartupData {
  device: {
    isMobile: boolean;
    userAgent: string;
    platform: string;
    cores: number;
    memory: number | null;
  };
  config: {
    frameSkip: number;
    useWorker: boolean;
    occludersEnabled: boolean;
  };
  camera: {
    requested: { width: number; height: number };
    actual: { width: number; height: number };
    facingMode: string;
    label: string;
  };
}

interface FrameData {
  total: number;
  capture: number;
  mediapipe: number;
  transform: number;
  fps: number;
  skipped?: boolean;
  handsDetected?: number;
}

interface RenderData {
  total: number;
  bones: number;
  occluders: number;
  ring: number;
  gl: number;
}

interface TrackData {
  confidence: number;
  palm: boolean;
  handedness: string;
}

interface CamData {
  event: "started" | "switched" | "stopped";
  requested?: { width: number; height: number };
  actual?: { width: number; height: number };
  facingMode?: string;
  label?: string;
}

class DebugLogger {
  private enabled = true;
  private categories: Record<LogCategory, boolean> = {
    startup: true,
    frame: true,
    render: false, // OFF par défaut (verbeux)
    track: true,
    cam: true,
  };

  private throttleMs = 2000;
  private lastLogTime: Record<string, number> = {};
  private startupLogged = false;

  constructor() {
    // Charger config depuis localStorage si disponible
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("dbg-config");
        if (saved) {
          const config = JSON.parse(saved);
          if (config.categories)
            this.categories = { ...this.categories, ...config.categories };
          if (config.throttleMs) this.throttleMs = config.throttleMs;
          if (config.enabled !== undefined) this.enabled = config.enabled;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  private saveConfig() {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(
          "dbg-config",
          JSON.stringify({
            enabled: this.enabled,
            categories: this.categories,
            throttleMs: this.throttleMs,
          })
        );
      } catch {
        // Ignore storage errors
      }
    }
  }

  private shouldLog(category: LogCategory, throttle = true): boolean {
    if (!this.enabled || !this.categories[category]) return false;

    if (throttle) {
      const now = performance.now();
      const last = this.lastLogTime[category] || 0;
      if (now - last < this.throttleMs) return false;
      this.lastLogTime[category] = now;
    }

    return true;
  }

  // =========================================================================
  // PUBLIC API - LOGS
  // =========================================================================

  startup(data: StartupData) {
    if (this.startupLogged) return; // Une seule fois
    if (!this.shouldLog("startup", false)) return;
    this.startupLogged = true;

    console.log(
      "%c[STARTUP]%c 🚀",
      "color: #2ecc71; font-weight: bold",
      "color: inherit",
      data
    );
  }

  frame(data: FrameData) {
    if (!this.shouldLog("frame")) return;

    const { total, capture, mediapipe, transform, fps, handsDetected = 0 } = data;
    console.log(
      "%c[FRAME]%c ⚡ total=%dms capture=%d mp=%d transform=%d | fps=%d | hands=%d",
      "color: #9b59b6; font-weight: bold",
      "color: inherit",
      Math.round(total),
      Math.round(capture),
      Math.round(mediapipe),
      Math.round(transform),
      fps,
      handsDetected
    );
  }

  render(data: RenderData) {
    if (!this.shouldLog("render")) return;

    const { total, bones, occluders, ring, gl } = data;
    console.log(
      "%c[RENDER]%c 🎨 total=%dms bones=%d occluders=%d ring=%d gl=%d",
      "color: #f1c40f; font-weight: bold",
      "color: inherit",
      Math.round(total),
      Math.round(bones),
      Math.round(occluders),
      Math.round(ring),
      Math.round(gl)
    );
  }

  track(data: TrackData) {
    if (!this.shouldLog("track")) return;

    const { confidence, palm, handedness } = data;
    console.log(
      "%c[TRACK]%c 👁️ conf=%.2f palm=%s hand=%s",
      "color: #3498db; font-weight: bold",
      "color: inherit",
      confidence,
      palm ? "true" : "false",
      handedness
    );
  }

  cam(data: CamData) {
    if (!this.shouldLog("cam", false)) return;

    const { event, requested, actual, facingMode, label } = data;
    if (event === "stopped") {
      console.log(
        "%c[CAM]%c 📷 stopped",
        "color: #e67e22; font-weight: bold",
        "color: inherit"
      );
    } else {
      console.log(
        "%c[CAM]%c 📷 %s %dx%d → %dx%d \"%s\" (%s)",
        "color: #e67e22; font-weight: bold",
        "color: inherit",
        event,
        requested?.width || 0,
        requested?.height || 0,
        actual?.width || 0,
        actual?.height || 0,
        label || "unknown",
        facingMode || "unknown"
      );
    }
  }

  // =========================================================================
  // PUBLIC API - CONTRÔLE
  // =========================================================================

  enable(category: LogCategory) {
    this.categories[category] = true;
    this.saveConfig();
    console.log(`[DBG] ✅ ${category} enabled`);
  }

  disable(category: LogCategory) {
    this.categories[category] = false;
    this.saveConfig();
    console.log(`[DBG] ❌ ${category} disabled`);
  }

  enableAll() {
    Object.keys(this.categories).forEach(
      (k) => (this.categories[k as LogCategory] = true)
    );
    this.saveConfig();
    console.log("[DBG] ✅ All categories enabled");
  }

  disableAll() {
    Object.keys(this.categories).forEach(
      (k) => (this.categories[k as LogCategory] = false)
    );
    this.saveConfig();
    console.log("[DBG] ❌ All categories disabled");
  }

  toggle(on: boolean) {
    this.enabled = on;
    this.saveConfig();
    console.log(`[DBG] Master switch: ${on ? "ON" : "OFF"}`);
  }

  setThrottle(ms: number) {
    this.throttleMs = ms;
    this.saveConfig();
    console.log(`[DBG] Throttle set to ${ms}ms`);
  }

  status() {
    console.log("[DBG] Status:", {
      enabled: this.enabled,
      categories: this.categories,
      throttleMs: this.throttleMs,
    });
  }

  // Reset le flag startup pour permettre un nouveau log
  resetStartup() {
    this.startupLogged = false;
    console.log("[DBG] Startup flag reset");
  }
}

// Singleton
export const dbg = new DebugLogger();

// Exposer sur window pour accès console (arDbg pour éviter conflit avec MediaPipe qui utilise 'dbg')
if (typeof window !== "undefined") {
  (window as unknown as { arDbg: DebugLogger }).arDbg = dbg;
}
