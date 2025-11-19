'use client'

import { extend } from '@react-three/fiber'
import{
  Group,
  Mesh,
  PlaneGeometry,
  CylinderGeometry,
  TorusGeometry,
  SphereGeometry,
  BoxGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  AmbientLight,
  DirectionalLight,
  PointLight,
} from 'three'

// Extend R3F with Three.js primitives
extend({
  Group,
  Mesh,
  PlaneGeometry,
  CylinderGeometry,
  TorusGeometry,
  SphereGeometry,
  BoxGeometry,
  MeshBasicMaterial,
  MeshStandardMaterial,
  AmbientLight,
  DirectionalLight,
  PointLight,
})

// Export for use in components
export {}