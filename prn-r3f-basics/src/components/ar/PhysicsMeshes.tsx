import { useMemo } from 'react'
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useXRMeshes, XRSpace } from '@react-three/xr'
import * as THREE from 'three'

/**
 * PhysicsMeshes - Creates physics colliders from detected AR meshes
 * Quest 3 only feature - provides detailed 3D room geometry
 * Uses TrimeshCollider for accurate collision with furniture and curved surfaces
 */
export function PhysicsMeshes() {
  const meshes = useXRMeshes()

  console.log(`[PhysicsMeshes] Detected ${meshes.length} meshes`)

  return (
    <>
      {meshes.map((mesh, index) => (
        <PhysicsMesh key={`mesh-${index}`} mesh={mesh} />
      ))}
    </>
  )
}

interface PhysicsMeshProps {
  mesh: any  // XRMesh type not exported by @react-three/xr
}

function PhysicsMesh({ mesh }: PhysicsMeshProps) {
  // Prepare geometry for Rapier trimesh collider
  const colliderGeometry = useMemo(() => ({
    vertices: mesh.vertices,
    indices: mesh.indices
  }), [mesh.lastChangedTime])

  // Create THREE.js geometry for visual debug overlay
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3))
    geo.setIndex(new THREE.BufferAttribute(mesh.indices, 1))
    geo.computeVertexNormals()
    return geo
  }, [mesh.lastChangedTime])

  // Log mesh info for debugging
  useMemo(() => {
    const vertexCount = mesh.vertices.length / 3
    const triangleCount = mesh.indices.length / 3
    console.log(`[Mesh] vertices: ${vertexCount}, triangles: ${triangleCount}`)
  }, [mesh.vertices.length, mesh.indices.length])

  return (
    <XRSpace space={mesh.meshSpace}>
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider args={[colliderGeometry.vertices, colliderGeometry.indices]} />
      </RigidBody>

      {/* Visual debug overlay - cyan wireframe */}
      <mesh geometry={geometry}>
        <meshBasicMaterial
          color="#00ffff"
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>
    </XRSpace>
  )
}
