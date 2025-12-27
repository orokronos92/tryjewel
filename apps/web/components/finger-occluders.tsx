/**
 * =============================================================================
 * FINGER-OCCLUDERS.TSX - VERSION 1.8 - FIX MÊME DOIGT CONDITIONNEL
 * =============================================================================
 * 
 * FIX v1.8: Même doigt (vert) actif SEULEMENT si rang 0 (le plus devant)
 * FIX v1.7: Tri Z croissant (Z petit = proche caméra)
 * 
 * LOGIQUE FINALE:
 * - Autre doigt devant (magenta) → actif
 * - Même doigt (vert) → actif SEULEMENT si rang 0
 * 
 * @author TryJewel Team
 * @version 1.8.0
 */

'use client';

import * as THREE from 'three';
import { handBonesData, type BoneData } from './hand-3d';

// =============================================================================
// TYPES
// =============================================================================

export interface OccluderConfig {
    boneName: string;
    fingerName: 'thumb' | 'index' | 'middle' | 'ring' | 'pinky';
    radiusTop: number;
    radiusBottom: number;
}

export interface DepthOrderInfo {
    fingerName: string;
    depthRank: number;  // 0 = le plus devant, 4 = le plus derrière
    z: number;          // Position Z pour debug
}

// =============================================================================
// CONSTANTES
// =============================================================================

/** Configuration de chaque occluder */
const OCCLUDER_CONFIGS: OccluderConfig[] = [
    // Pouce
    { boneName: 'thumb_mcp', fingerName: 'thumb', radiusTop: 0.022, radiusBottom: 0.026 },
    { boneName: 'thumb_ip', fingerName: 'thumb', radiusTop: 0.020, radiusBottom: 0.024 },
    
    // Index
    { boneName: 'index_mcp', fingerName: 'index', radiusTop: 0.020, radiusBottom: 0.024 },
    { boneName: 'index_pip', fingerName: 'index', radiusTop: 0.018, radiusBottom: 0.022 },
    { boneName: 'index_dip', fingerName: 'index', radiusTop: 0.016, radiusBottom: 0.020 },
    
    // Majeur
    { boneName: 'middle_mcp', fingerName: 'middle', radiusTop: 0.020, radiusBottom: 0.024 },
    { boneName: 'middle_pip', fingerName: 'middle', radiusTop: 0.018, radiusBottom: 0.022 },
    { boneName: 'middle_dip', fingerName: 'middle', radiusTop: 0.016, radiusBottom: 0.020 },
    
    // Annulaire
    { boneName: 'ring_mcp', fingerName: 'ring', radiusTop: 0.020, radiusBottom: 0.024 },
    { boneName: 'ring_pip', fingerName: 'ring', radiusTop: 0.018, radiusBottom: 0.022 },
    { boneName: 'ring_dip', fingerName: 'ring', radiusTop: 0.016, radiusBottom: 0.020 },
    
    // Auriculaire
    { boneName: 'pinky_mcp', fingerName: 'pinky', radiusTop: 0.016, radiusBottom: 0.020 },
    { boneName: 'pinky_pip', fingerName: 'pinky', radiusTop: 0.014, radiusBottom: 0.018 },
    { boneName: 'pinky_dip', fingerName: 'pinky', radiusTop: 0.012, radiusBottom: 0.016 },
];

/** MCP bones pour calculer la position Z de chaque doigt */
const FINGER_MCP_BONES: Record<string, string> = {
    thumb: 'thumb_mcp',
    index: 'index_mcp',
    middle: 'middle_mcp',
    ring: 'ring_mcp',
    pinky: 'pinky_mcp',
};

// =============================================================================
// CLASSE PRINCIPALE
// =============================================================================

export class FingerOccluderManager {
    private occluders: Map<string, THREE.Mesh> = new Map();
    private scene: THREE.Scene;
    private debugMode: boolean = false;
    
    // Cache pour éviter les recalculs
    private lastDepthOrder: Map<string, number> = new Map();
    private frameCount: number = 0;
    
    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.createOccluders();
    }
    
    // =========================================================================
    // CRÉATION DES OCCLUDERS
    // =========================================================================
    
    private createOccluders(): void {
        const baseMaterial = new THREE.MeshBasicMaterial({
            colorWrite: false,  // Invisible mais écrit dans depth buffer
            depthWrite: true,
            side: THREE.DoubleSide,
        });
        
        OCCLUDER_CONFIGS.forEach(config => {
            const geometry = new THREE.CylinderGeometry(
                config.radiusTop,
                config.radiusBottom,
                0.12,
                32
            );
            
            const mesh = new THREE.Mesh(geometry, baseMaterial.clone());
            mesh.renderOrder = -1;  // Render avant la bague
            mesh.name = `occluder_${config.boneName}`;
            mesh.visible = false;   // Caché par défaut
            
            this.scene.add(mesh);
            this.occluders.set(config.boneName, mesh);
        });
        
        console.log('[FingerOccluders v1.6] ✅ Created', this.occluders.size, 'occluders');
    }
    
    // =========================================================================
    // CALCUL DE L'ORDRE DE PROFONDEUR BASÉ SUR Z
    // =========================================================================
    
    /**
     * Calcule l'ordre de profondeur des doigts basé sur leur position Z
     * 
     * LOGIQUE:
     * - Z grand = proche caméra = DEVANT (rang 0)
     * - Z petit = loin caméra = DERRIÈRE (rang 4)
     * 
     * Note: MediaPipe utilise Z positif/grand pour les éléments proches.
     * 
     * Fonctionne dans TOUTES les orientations!
     */
    private calculateDepthOrder(ringFingerName: string): Map<string, number> {
        const depthOrder = new Map<string, number>();
        
        // Collecter la position Z de chaque doigt (depuis le MCP)
        const fingerDepths: { name: string; z: number }[] = [];
        
        for (const [fingerName, boneName] of Object.entries(FINGER_MCP_BONES)) {
            const boneData = handBonesData.get(boneName);
            if (boneData) {
                fingerDepths.push({
                    name: fingerName,
                    z: boneData.position.z  // Z = profondeur directe
                });
            }
        }
        
        if (fingerDepths.length === 0) {
            // Fallback: ordre par défaut
            ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach((f, i) => {
                depthOrder.set(f, i);
            });
            return depthOrder;
        }
        
        // Trier par Z CROISSANT: Z petit = proche caméra = rang 0 (DEVANT)
        // MediaPipe: Z négatif/petit = doigt proche de la caméra
        fingerDepths.sort((a, b) => a.z - b.z);
        
        // Attribuer les rangs (0 = le plus devant)
        fingerDepths.forEach((fd, index) => {
            depthOrder.set(fd.name, index);
        });
        
        // Debug log (toutes les 60 frames)
        if (this.frameCount % 60 === 0) {
            console.log('[FingerOccluders v1.7] Depth order (Z asc):', {
                order: fingerDepths.map(fd => `${fd.name}(z=${fd.z.toFixed(3)})`).join(' → '),
                ringFingerRank: depthOrder.get(ringFingerName)
            });
        }
        
        return depthOrder;
    }
    
    // =========================================================================
    // MISE À JOUR DES OCCLUDERS
    // =========================================================================
    
    /**
     * Met à jour tous les occluders
     * @param ringFingerName Nom du doigt portant la bague ('index', 'middle', etc.)
     * @param debugMode Si true, affiche les occluders en couleur
     */
    update(ringFingerName: string, debugMode: boolean = false): void {
        this.frameCount++;
        this.debugMode = debugMode;
        
        // Calculer l'ordre de profondeur
        const depthOrder = this.calculateDepthOrder(ringFingerName);
        this.lastDepthOrder = depthOrder;
        
        // Récupérer le rang de profondeur du doigt de la bague
        const ringFingerRank = depthOrder.get(ringFingerName) ?? 2;
        
        // Mettre à jour chaque occluder
        OCCLUDER_CONFIGS.forEach(config => {
            const mesh = this.occluders.get(config.boneName);
            const boneData = handBonesData.get(config.boneName);
            
            if (!mesh || !boneData) return;
            
            // Position et rotation depuis Hand3D
            mesh.position.set(
                boneData.position.x,
                boneData.position.y,
                boneData.position.z
            );
            
            mesh.quaternion.set(
                boneData.quaternion.x,
                boneData.quaternion.y,
                boneData.quaternion.z,
                boneData.quaternion.w
            );
            
            // Échelle
            const scale = boneData.length * 8;
            mesh.scale.setScalar(scale);
            
            // ⚡ LOGIQUE DE PROFONDEUR v1.6 - SIMPLIFIÉE
            // L'occluder est actif si:
            // 1. Son doigt est DEVANT le doigt de la bague (rang inférieur), OU
            // 2. C'est le MÊME doigt ET le doigt de la bague est le plus devant (rang 0)
            
            const occluderFingerRank = depthOrder.get(config.fingerName) ?? 2;
            const isFingerInFront = occluderFingerRank < ringFingerRank;
            const isSameFinger = config.fingerName === ringFingerName;
            
            // ⚡ FIX v1.8: Même doigt actif SEULEMENT si rang 0 (le plus devant)
            // Si d'autres doigts sont devant (magenta), le doigt porteur est désactivé
            const shouldBeActive = isFingerInFront || (isSameFinger && ringFingerRank === 0);
            
            // ⚡ OCCLUDERS ACTIFS
            mesh.visible = shouldBeActive;
            
            const mat = mesh.material as THREE.MeshBasicMaterial;
            
            // ⚡ CRITIQUE: Forcer depth même en mode debug
            mat.depthWrite = true;
            mat.depthTest = true;
            
            // ⚡ CRITIQUE: NE PAS utiliser transparent = true car ça casse le renderOrder!
            // Three.js rend les objets transparents APRÈS les opaques, ignorant renderOrder
            mat.transparent = false;
            
            if (debugMode) {
                // Mode debug: rendre visible avec couleur
                mat.colorWrite = true;
                
                // Couleur selon l'état (opacité simulée par la luminosité)
                if (!shouldBeActive) {
                    mat.color = new THREE.Color(0x222222);  // Gris foncé = désactivé
                } else if (isSameFinger) {
                    mat.color = new THREE.Color(0x00ff00);  // Vert = même doigt
                } else {
                    mat.color = new THREE.Color(0xff00ff);  // Magenta = devant
                }
                
                // Afficher tous les occluders en debug
                mesh.visible = true;
            } else {
                // Mode normal: invisible mais actif pour l'occlusion
                mat.colorWrite = false;
            }
        });
    }
    
    // =========================================================================
    // UTILITAIRES
    // =========================================================================
    
    /**
     * Récupère le dernier ordre de profondeur calculé (pour debug)
     */
    getLastDepthOrder(): Map<string, number> {
        return this.lastDepthOrder;
    }
    
    /**
     * Active/désactive le mode debug
     */
    setDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
    }
    
    /**
     * Nettoie les ressources
     */
    dispose(): void {
        this.occluders.forEach(mesh => {
            mesh.geometry.dispose();
            (mesh.material as THREE.Material).dispose();
            this.scene.remove(mesh);
        });
        this.occluders.clear();
        console.log('[FingerOccluders v1.6] 🧹 Disposed');
    }
}

export default FingerOccluderManager;