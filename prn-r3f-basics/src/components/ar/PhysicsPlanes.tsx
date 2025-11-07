import { useMemo } from 'react'
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useXRPlanes, XRSpace } from '@react-three/xr'

/**
 * PhysicsPlanes - Creates physics colliders from detected AR planes
 * Compatible with Quest 2 and Quest 3
 * Uses CuboidCollider for flat surfaces (walls, floor, ceiling, furniture tops)
 */
export function PhysicsPlanes() {
  const planes = useXRPlanes()

  console.log(`[PhysicsPlanes] Detected ${planes.length} planes`)

  return (
    <>
      {planes.map((plane, index) => (
        <PhysicsPlane key={`plane-${index}`} plane={plane} />
      ))}
    </>
  )
}

interface PhysicsPlaneProps {
  plane: any  // XRPlane type not exported by @react-three/xr
}

function PhysicsPlane({ plane }: PhysicsPlaneProps) {
  // Calculate plane dimensions from polygon boundary
  const dimensions = useMemo(() => {
    const bounds = getBounds(plane.polygon)
    return {
      width: bounds.maxX - bounds.minX,
      height: bounds.maxZ - bounds.minZ,
      thickness: 0.01  // 1cm thick collision surface
    }
  }, [plane.polygon])

  // Log plane info for debugging
  useMemo(() => {
    console.log(`[Plane] ${plane.semanticLabel || 'unknown'}`, {
      orientation: plane.orientation,
      dimensions: dimensions,
      polygon: plane.polygon.length + ' vertices'
    })
  }, [plane.semanticLabel, plane.orientation, dimensions, plane.polygon.length])

  return (
    <XRSpace space={plane.planeSpace}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[dimensions.width / 2, dimensions.thickness, dimensions.height / 2]}
        />
      </RigidBody>

      {/* Visual debug overlay - semi-transparent colored plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[dimensions.width, dimensions.height]} />
        <meshBasicMaterial
          color={getColorForLabel(plane.semanticLabel)}
          transparent
          opacity={0.3}
          side={2}  // DoubleSide
        />
      </mesh>
    </XRSpace>
  )
}

/**
 * Calculate bounding box from plane polygon
 */
function getBounds(polygon: DOMPointReadOnly[]) {
  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const point of polygon) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }

  return { minX, maxX, minZ, maxZ }
}

/**
 * Assign colors to different plane types for debugging
 */
function getColorForLabel(label?: string): string {
  switch (label) {
    case 'floor': return '#00ff00'      // Green
    case 'wall': return '#0000ff'       // Blue
    case 'ceiling': return '#ffff00'    // Yellow
    case 'table': return '#ff00ff'      // Magenta
    default: return '#ffffff'            // White
  }
}
