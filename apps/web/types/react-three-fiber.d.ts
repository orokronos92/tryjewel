import { Object3DNode } from '@react-three/fiber'
import * as THREE from 'three'

declare module '@react-three/fiber' {
  interface ThreeElements {
    // Objects
    group: Object3DNode<THREE.Group, typeof THREE.Group>
    mesh: Object3DNode<THREE.Mesh, typeof THREE.Mesh>
    primitive: Object3DNode<THREE.Object3D, typeof THREE.Object3D>
    
    // Geometries
    planeGeometry: Object3DNode<THREE.PlaneGeometry, typeof THREE.PlaneGeometry>
    cylinderGeometry: Object3DNode<THREE.CylinderGeometry, typeof THREE.CylinderGeometry>
    torusGeometry: Object3DNode<THREE.TorusGeometry, typeof THREE.TorusGeometry>
    sphereGeometry: Object3DNode<THREE.SphereGeometry, typeof THREE.SphereGeometry>
    boxGeometry: Object3DNode<THREE.BoxGeometry, typeof THREE.BoxGeometry>
    
    // Materials
    meshBasicMaterial: Object3DNode<THREE.MeshBasicMaterial, typeof THREE.MeshBasicMaterial>
    meshStandardMaterial: Object3DNode<THREE.MeshStandardMaterial, typeof THREE.MeshStandardMaterial>
    
    // Lights
    ambientLight: Object3DNode<THREE.AmbientLight, typeof THREE.AmbientLight>
    directionalLight: Object3DNode<THREE.DirectionalLight, typeof THREE.DirectionalLight>
    pointLight: Object3DNode<THREE.PointLight, typeof THREE.PointLight>
  }
}