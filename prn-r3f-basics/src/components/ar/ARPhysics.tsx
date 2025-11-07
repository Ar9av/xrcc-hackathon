import { PhysicsPlanes } from './PhysicsPlanes'
import { PhysicsMeshes } from './PhysicsMeshes'
import { useXRMeshes, useXRPlanes } from '@react-three/xr'
import { RigidBody } from '@react-three/rapier'

/**
 * ARPhysics - Hybrid selector for AR physics collision
 *
 * Strategy:
 * - Quest 3: Prefers mesh-based collision (more accurate) if meshes available
 * - Quest 2: Falls back to plane-based collision (still functional)
 * - Provides temporary invisible floor until plane/mesh detection loads
 *
 * This approach ensures:
 * - Best experience per device (no manual detection needed)
 * - Balls don't fall infinitely while waiting for room geometry
 * - Smooth transition when room data loads
 */
export function ARPhysics() {
  const meshes = useXRMeshes()
  const planes = useXRPlanes()

  // Prefer meshes if available (Quest 3), fallback to planes (Quest 2)
  const useMeshes = meshes.length > 0
  const hasRoomGeometry = meshes.length > 0 || planes.length > 0

  console.log('[ARPhysics]', {
    meshCount: meshes.length,
    planeCount: planes.length,
    mode: useMeshes ? 'mesh' : 'plane',
    hasRoomGeometry
  })

  return (
    <>
      {/* Render detected room geometry */}
      {useMeshes ? <PhysicsMeshes /> : <PhysicsPlanes />}

      {/* Temporary invisible floor - prevents balls from falling until planes load */}
      {!hasRoomGeometry && (
        <RigidBody type="fixed" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <mesh>
            <planeGeometry args={[50, 50]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </RigidBody>
      )}
    </>
  )
}
