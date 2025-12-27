/**
 * =============================================================================
 * FINGER-OCCLUDERS.TSX - VERSION 1.0
 * =============================================================================
 * 
 * Composant séparé pour gérer les occluders de doigts avec logique de profondeur
 * intelligente basée sur la position 2D des doigts.
 * 
 * PROBLÈME RÉSOLU:
 * Les Z de MediaPipe sont estimés et peu fiables. Au lieu d'utiliser le depth
 * buffer classique, on infère la profondeur depuis les positions 2D:
 * - Position X relative des doigts dans l'image
 * - Orientation paume/dos de la main
 * 
 * LOGIQUE:
 * - Main droite, paume face caméra: doigt le plus à gauche (X petit) = DEVANT
 * - Main droite, dos face caméra: doigt le plus à droite (X grand) = DEVANT
 * - On active un occluder SEULEMENT s'il est devant la bague
 * 
 * @author TryJewel Team
 * @version 1.0.0
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
    mcpX: number;       // Position X du MCP pour debug
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

/** MCP landmarks pour calculer la position X de chaque doigt */
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
        
        console.log('[FingerOccluders] ✅ Created', this.occluders.size, 'occluders');
    }
    
    // =========================================================================
    // CALCUL DE L'ORDRE DE PROFONDEUR BASÉ SUR 2D
    // =========================================================================
    
    /**
     * Calcule l'ordre de profondeur des doigts basé sur leur position X
     * et l'orientation de la main (paume/dos)
     */
    private calculateDepthOrder(ringFingerName: string): Map<string, number> {
        const depthOrder = new Map<string, number>();
        
        // Récupérer palmAngle et handedness
        const palmFacingData = handBonesData.get('_palmFacing');
        const handednessData = handBonesData.get('_handedness');
        
        if (!palmFacingData || !handednessData) {
            // Pas de données, tous les occluders actifs par sécurité
            ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach((f, i) => {
                depthOrder.set(f, i);
            });
            return depthOrder;
        }
        
        const palmAngle = palmFacingData.position.y;  // -1 (dos) à +1 (paume)
        const isLeftHand = handednessData.position.x === 1;
        
        // Récupérer les positions X des MCP de chaque doigt
        const fingerPositions: { name: string; x: number }[] = [];
        
        for (const [fingerName, boneName] of Object.entries(FINGER_MCP_BONES)) {
            const boneData = handBonesData.get(boneName);
            if (boneData) {
                fingerPositions.push({
                    name: fingerName,
                    x: boneData.position.x
                });
            }
        }
        
        if (fingerPositions.length === 0) {
            return depthOrder;
        }
        
        // Trier par position X
        // LOGIQUE CLÉ:
        // - Main droite + paume face: X petit = DEVANT (rang 0)
        // - Main droite + dos face: X grand = DEVANT (rang 0)
        // - Main gauche: inverse
        
        const isPalmFacing = palmAngle > 0;
        
        // Déterminer le sens du tri
        // Pour main droite regardant paume: index (gauche) est devant → trier X croissant
        // Pour main droite regardant dos: auriculaire (droite) est devant → trier X décroissant
        let sortAscending: boolean;
        
        if (isLeftHand) {
            // Main gauche: inverse de la main droite
            sortAscending = !isPalmFacing;
        } else {
            // Main droite
            sortAscending = isPalmFacing;
        }
        
        fingerPositions.sort((a, b) => {
            return sortAscending ? (a.x - b.x) : (b.x - a.x);
        });
        
        // Attribuer les rangs (0 = le plus devant)
        fingerPositions.forEach((fp, index) => {
            depthOrder.set(fp.name, index);
        });
        
        // Debug log (toutes les 60 frames)
        if (this.frameCount % 60 === 0) {
            console.log('[FingerOccluders] Depth order:', {
                palmAngle: palmAngle.toFixed(2),
                isLeftHand,
                isPalmFacing,
                sortAscending,
                order: fingerPositions.map(fp => `${fp.name}(${fp.x.toFixed(3)})`).join(' → '),
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
     * @param debugMode Si true, affiche les occluders en magenta
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
            
            // ⚡ LOGIQUE DE PROFONDEUR
            // L'occluder est actif seulement si son doigt est DEVANT la bague
            const occluderFingerRank = depthOrder.get(config.fingerName) ?? 2;
            const isInFront = occluderFingerRank < ringFingerRank;
            
            // Cas spécial: les occluders du même doigt que la bague restent actifs
            // (pour masquer les phalanges au-dessus de la bague)
            const isSameFinger = config.fingerName === ringFingerName;
            
            // Activer l'occluder si:
            // 1. Il est sur un doigt devant la bague, OU
            // 2. Il est sur le même doigt que la bague (phalanges au-dessus)
            const shouldBeActive = isInFront || isSameFinger;
            
            mesh.visible = shouldBeActive;
            
            // Mode debug: afficher en couleur
            const mat = mesh.material as THREE.MeshBasicMaterial;
            if (debugMode) {
                mat.colorWrite = true;
                mat.transparent = true;
                mat.opacity = 0.6;
                
                // Couleur selon l'état
                if (!shouldBeActive) {
                    mat.color = new THREE.Color(0x444444);  // Gris = désactivé
                    mat.opacity = 0.2;
                } else if (isSameFinger) {
                    mat.color = new THREE.Color(0x00ff00);  // Vert = même doigt
                } else {
                    mat.color = new THREE.Color(0xff00ff);  // Magenta = devant
                }
                
                // Toujours visible en debug
                mesh.visible = true;
            } else {
                mat.colorWrite = false;
                mat.transparent = false;
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
        console.log('[FingerOccluders] 🧹 Disposed');
    }
}

export default FingerOccluderManager;