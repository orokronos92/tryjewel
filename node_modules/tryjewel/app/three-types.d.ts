import { Object3DNode } from '@react-three/fiber'
import { Group, Mesh, Object3D, PlaneGeometry, CylinderGeometry, TorusGeometry, SphereGeometry, BoxGeometry, MeshBasicMaterial, MeshStandardMaterial, AmbientLight, DirectionalLight, PointLight } from 'three'

declare global {
  namespace JSX {
    interface IntrinsicElements {
      group: Object3DNode<Group, typeof Group>
      mesh: Object3DNode<Mesh, typeof Mesh>
      primitive: Object3DNode<Object3D, typeof Object3D>
      planeGeometry: Object3DNode<PlaneGeometry, typeof PlaneGeometry>
      cylinderGeometry: Object3DNode<CylinderGeometry, typeof CylinderGeometry>
      torusGeometry: Object3DNode<TorusGeometry, typeof TorusGeometry>
      sphereGeometry: Object3DNode<SphereGeometry, typeof SphereGeometry>
      boxGeometry: Object3DNode<BoxGeometry, typeof BoxGeometry>
      meshBasicMaterial: Object3DNode<MeshBasicMaterial, typeof MeshBasicMaterial>
      meshStandardMaterial: Object3DNode<MeshStandardMaterial, typeof MeshStandardMaterial>
      ambientLight: Object3DNode<AmbientLight, typeof AmbientLight>
      directionalLight: Object3DNode<DirectionalLight, typeof DirectionalLight>
      pointLight: Object3DNode<PointLight, typeof PointLight>
    }
  }
}