'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Torus, Sphere } from '@react-three/drei'
import * as THREE from 'three'

interface ProceduralJewelryProps {
  type: 'ring' | 'bracelet' | 'earring' | 'necklace'
  position: [number, number, number]
  rotation: [number, number, number]
  scale: number
  color?: string
}

export function ProceduralJewelry({
  type,
  position,
  rotation,
  scale,
  color = '#FFD700',
}: ProceduralJewelryProps) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001
    }
  })

  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: color,
    metalness: 0.9,
    roughness: 0.1,
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.2,
  }), [color])

  if (type === 'earring') {
    return (
      <Sphere
        ref={meshRef}
        position={position}
        rotation={rotation}
        scale={scale}
        args={[0.15, 32, 32]}
        material={material}
      />
    )
  }

  const args: [number, number, number, number] = 
    type === 'bracelet' ? [0.8, 0.08, 16, 32] :
    type === 'necklace' ? [1.2, 0.05, 16, 64] :
    [0.5, 0.1, 16, 32]

  return (
    <Torus
      ref={meshRef}
      position={position}
      rotation={rotation}
      scale={scale}
      args={args}
      material={material}
    />
  )
}

export function SimpleRing({ 
  position = [0, 0, 0], 
  scale = 1 
}: { 
  position?: [number, number, number]
  scale?: number 
}) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#FFD700',
    metalness: 0.9,
    roughness: 0.1,
  }), [])

  return (
    <Torus 
      position={position} 
      scale={scale} 
      args={[0.5, 0.1, 16, 32]}
      material={material}
    />
  )
}

export default ProceduralJewelry