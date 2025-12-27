/**
 * =============================================================================
 * ONE-EURO-FILTER.TS - Version 2.0 avec support Quaternion
 * =============================================================================
 * 
 * Le 1€ Filter est un algorithme de lissage adaptatif:
 * - À basse vitesse: fort lissage (réduit le jitter/tremblements)
 * - À haute vitesse: faible lissage (réduit le lag)
 * 
 * Author: Gery Casiez (algorithme original)
 * TypeScript port + QuaternionFilter pour TryJewel
 * 
 * @version 2.0.0
 */

import * as THREE from 'three';

// =============================================================================
// FILTRE DE BASE (SCALAIRE)
// =============================================================================

export class OneEuroFilter {
  private minCutoff: number;
  private beta: number;
  private dcutoff: number;
  private x: number | number[] | null = null;
  private dx: number | number[] = 0;
  private lastTime: number | undefined;

  /**
   * @param minCutoff Fréquence de coupure minimum en Hz (plus bas = plus de lissage)
   * @param beta Coefficient de vitesse (plus haut = plus réactif aux mouvements)
   * @param dcutoff Fréquence de coupure pour la dérivée
   */
  constructor(minCutoff: number = 1.0, beta: number = 0.007, dcutoff: number = 1.0) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dcutoff = dcutoff;
  }

  /**
   * Filtre une valeur (scalaire ou array)
   * @param value Valeur à filtrer
   * @param timestamp Timestamp en secondes
   */
  filter(value: number | number[], timestamp: number = Date.now() / 1000): number | number[] {
    // Premier appel: initialiser
    if (this.lastTime === undefined) {
      this.lastTime = timestamp;
      this.x = value;
      this.dx = Array.isArray(value) ? value.map(() => 0) : 0;
      return value;
    }

    // Delta temps
    const dt = timestamp - this.lastTime;
    this.lastTime = timestamp;

    if (dt <= 0) return this.x!;

    // Traitement array (vecteurs 3D, etc.)
    if (Array.isArray(value)) {
      if (!Array.isArray(this.x)) this.x = value;
      
      return value.map((v, i) => {
        const dx = (v - (this.x as number[])[i]) / dt;
        const edx = this.exponentialSmoothing(dx, (this.dx as number[])[i], dt, this.dcutoff);
        (this.dx as number[])[i] = edx;
        
        const cutoff = this.minCutoff + this.beta * Math.abs(edx);
        const result = this.exponentialSmoothing(v, (this.x as number[])[i], dt, cutoff);
        (this.x as number[])[i] = result;
        return result;
      });
    }

    // Traitement scalaire
    const dx = (value - (this.x as number)) / dt;
    const edx = this.exponentialSmoothing(dx, this.dx as number, dt, this.dcutoff);
    this.dx = edx;

    const cutoff = this.minCutoff + this.beta * Math.abs(edx);
    const result = this.exponentialSmoothing(value, this.x as number, dt, cutoff);
    this.x = result;
    
    return result;
  }

  private exponentialSmoothing(a: number, x: number, dt: number, cutoff: number): number {
    const tau = 1.0 / (2.0 * Math.PI * cutoff);
    const alpha = 1.0 / (1.0 + tau / dt);
    return alpha * a + (1.0 - alpha) * x;
  }

  reset(): void {
    this.x = null;
    this.dx = 0;
    this.lastTime = undefined;
  }

  setParams(minCutoff?: number, beta?: number, dcutoff?: number): void {
    if (minCutoff !== undefined) this.minCutoff = minCutoff;
    if (beta !== undefined) this.beta = beta;
    if (dcutoff !== undefined) this.dcutoff = dcutoff;
  }
}

// =============================================================================
// FILTRE POUR VECTEURS 3D (POSITIONS)
// =============================================================================

export class Vector3OneEuroFilter {
  private filters: [OneEuroFilter, OneEuroFilter, OneEuroFilter];

  constructor(minCutoff: number = 1.0, beta: number = 0.007, dcutoff: number = 1.0) {
    this.filters = [
      new OneEuroFilter(minCutoff, beta, dcutoff),
      new OneEuroFilter(minCutoff, beta, dcutoff),
      new OneEuroFilter(minCutoff, beta, dcutoff)
    ];
  }

  filter(v: THREE.Vector3, t: number = performance.now() / 1000): THREE.Vector3 {
    return new THREE.Vector3(
      this.filters[0].filter(v.x, t) as number,
      this.filters[1].filter(v.y, t) as number,
      this.filters[2].filter(v.z, t) as number
    );
  }

  reset(): void {
    this.filters.forEach(f => f.reset());
  }

  setParams(minCutoff?: number, beta?: number, dcutoff?: number): void {
    this.filters.forEach(f => f.setParams(minCutoff, beta, dcutoff));
  }
}

// =============================================================================
// FILTRE POUR QUATERNIONS (ROTATIONS)
// =============================================================================

export class QuaternionOneEuroFilter {
  private filters: [OneEuroFilter, OneEuroFilter, OneEuroFilter, OneEuroFilter];
  private prevQuat: THREE.Quaternion | null = null;

  /**
   * @param minCutoff Fréquence de coupure minimum (défaut: 1.5 pour rotations)
   * @param beta Coefficient de vitesse (défaut: 0.01 pour rotations)
   */
  constructor(minCutoff: number = 1.5, beta: number = 0.01, dcutoff: number = 1.0) {
    this.filters = [
      new OneEuroFilter(minCutoff, beta, dcutoff),
      new OneEuroFilter(minCutoff, beta, dcutoff),
      new OneEuroFilter(minCutoff, beta, dcutoff),
      new OneEuroFilter(minCutoff, beta, dcutoff)
    ];
  }

  /**
   * Filtre un Quaternion avec gestion de la continuité
   * (q et -q représentent la même rotation, on prend le chemin le plus court)
   */
  filter(q: THREE.Quaternion, t: number = performance.now() / 1000): THREE.Quaternion {
    let qContinuous = q.clone();
    
    // Assurer la continuité (éviter les sauts de 360°)
    if (this.prevQuat !== null) {
      const dot = this.prevQuat.x * q.x + 
                  this.prevQuat.y * q.y + 
                  this.prevQuat.z * q.z + 
                  this.prevQuat.w * q.w;
      
      if (dot < 0) {
        qContinuous.set(-q.x, -q.y, -q.z, -q.w);
      }
    }

    // Filtrer chaque composante
    const result = new THREE.Quaternion(
      this.filters[0].filter(qContinuous.x, t) as number,
      this.filters[1].filter(qContinuous.y, t) as number,
      this.filters[2].filter(qContinuous.z, t) as number,
      this.filters[3].filter(qContinuous.w, t) as number
    );

    // CRITIQUE: Renormaliser après filtrage
    result.normalize();

    this.prevQuat = result.clone();
    return result;
  }

  reset(): void {
    this.filters.forEach(f => f.reset());
    this.prevQuat = null;
  }

  setParams(minCutoff?: number, beta?: number, dcutoff?: number): void {
    this.filters.forEach(f => f.setParams(minCutoff, beta, dcutoff));
  }
}

// =============================================================================
// PRESETS
// =============================================================================

export const FILTER_PRESETS = {
  SMOOTH: { minCutoff: 0.5, beta: 0.001 },
  BALANCED: { minCutoff: 1.5, beta: 0.007 },
  RESPONSIVE: { minCutoff: 3.0, beta: 0.02 }
} as const;

export default OneEuroFilter;