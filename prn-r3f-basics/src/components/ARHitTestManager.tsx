import { useEffect, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import * as THREE from 'three'

/**
 * ARHitTestManager - Main component for AR plane detection and object placement
 *
 * Implements hit testing exactly like ar-example.html:
 * 1. Creates hit test source from viewer space
 * 2. Updates reticle position from hit test results each frame
 * 3. Handles object placement on select event via anchors
 */
export function ARHitTestManager() {
  const { session } = useXR()
  const xrRefSpaceRef = useRef<XRReferenceSpace | null>(null)
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null)
  const reticleRef = useRef<THREE.Mesh>(null)
  const [currentHitResult, setCurrentHitResult] = useState<XRHitTestResult | null>(null)

  // Step 1: Create hit test source (mirrors ar-example.html lines 136-141)
  useEffect(() => {
    if (!session) return

    // Get viewer space for hit test source
    session.requestReferenceSpace('viewer').then((viewerSpace) => {
      // Create hit test source from viewer space
      // TypeScript doesn't recognize AR features, so we need to cast
      if ('requestHitTestSource' in session) {
        (session as any).requestHitTestSource({ space: viewerSpace }).then((source: XRHitTestSource) => {
          hitTestSourceRef.current = source
        }).catch((error: Error) => {
          console.error('Failed to create hit test source:', error)
        })
      } else {
        console.error('Hit test not supported by this XR session')
      }
    }).catch((error) => {
      console.error('Failed to get viewer space:', error)
    })

    // Get reference space for pose queries
    // Use 'local-floor' to match the XR store's rendering space
    session.requestReferenceSpace('local-floor').then((refSpace) => {
      xrRefSpaceRef.current = refSpace
    }).catch((error) => {
      console.error('Failed to get reference space:', error)
    })

    return () => {
      hitTestSourceRef.current?.cancel()
    }
  }, [session])

  // Step 2: Get hit test results each frame (mirrors ar-example.html lines 203-210)
  useFrame((state) => {
    if (!session || !hitTestSourceRef.current || !xrRefSpaceRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame) return

    const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current)

    if (hitTestResults.length > 0) {
      const hitPose = hitTestResults[0].getPose(xrRefSpaceRef.current)
      if (hitPose && reticleRef.current) {
        // CRITICAL: Directly assign the transformation matrix from WebXR
        // The hit test pose matrix contains:
        // - Position: intersection point on the surface
        // - Orientation: Y-axis aligned with surface normal (perpendicular to plane)
        // DO NOT call matrix.decompose() - it will overwrite position/rotation/quaternion
        reticleRef.current.visible = true
        reticleRef.current.matrix.fromArray(hitPose.transform.matrix)

        // Apply additional rotation to make ring lie flat on the surface
        // RingGeometry lies in XY plane by default, but we need it in XZ plane
        // to be perpendicular to the Y-axis (surface normal)
        const rotationMatrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
        reticleRef.current.matrix.multiply(rotationMatrix)

        setCurrentHitResult(hitTestResults[0])
      }
    } else {
      if (reticleRef.current) reticleRef.current.visible = false
      setCurrentHitResult(null)
    }
  })

  return (
    <>
      {/* Reticle (cursor) - white ring that shows where objects will be placed
          matrixAutoUpdate={false} is CRITICAL - prevents Three.js from recalculating
          the matrix from position/rotation/scale, allowing us to directly set the matrix */}
      <mesh ref={reticleRef} visible={false} matrixAutoUpdate={false}>
        <ringGeometry args={[0.15, 0.2, 32]} />
        <meshBasicMaterial color="white" side={THREE.DoubleSide} />
      </mesh>

      {/* Plane visualizer - shows detected planes for debugging */}
      <PlaneVisualizer xrRefSpace={xrRefSpaceRef.current} />

      {/* Placement handler - manages object placement and anchors */}
      <PlacementHandler
        hitResult={currentHitResult}
        xrRefSpace={xrRefSpaceRef.current}
      />
    </>
  )
}

/**
 * PlaneVisualizer - Visualizes detected planes for debugging
 *
 * Renders semi-transparent meshes for each detected plane
 */
interface PlaneVisualizerProps {
  xrRefSpace: XRReferenceSpace | null
}

function PlaneVisualizer({ xrRefSpace }: PlaneVisualizerProps) {
  const { session } = useXR()
  const [detectedPlanes, setDetectedPlanes] = useState<Map<XRPlane, THREE.Mesh>>(new Map())
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!session || !xrRefSpace || !groupRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame || !frame.detectedPlanes) return

    const currentPlanes = new Map<XRPlane, THREE.Mesh>()

    // Process each detected plane
    frame.detectedPlanes.forEach((plane: XRPlane) => {
      // Get or create mesh for this plane
      let mesh = detectedPlanes.get(plane)

      if (!mesh) {
        // Create new mesh for this plane
        const geometry = new THREE.BufferGeometry()
        const material = new THREE.MeshBasicMaterial({
          color: 0x00ff00,
          side: THREE.DoubleSide,
          wireframe: true
        })
        mesh = new THREE.Mesh(geometry, material)
        groupRef.current.add(mesh)
      }

      // Update plane geometry from polygon
      if (plane.polygon && plane.polygon.length > 0) {
        const vertices: number[] = []
        const indices: number[] = []

        // Convert polygon points to vertices
        plane.polygon.forEach((point: DOMPointReadOnly) => {
          vertices.push(point.x, point.y, point.z)
        })

        // Create triangles for the polygon (simple fan triangulation)
        for (let i = 1; i < plane.polygon.length - 1; i++) {
          indices.push(0, i, i + 1)
        }

        const geometry = mesh.geometry as THREE.BufferGeometry
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
        geometry.setIndex(indices)
        geometry.computeVertexNormals()
      }

      // Update mesh position and orientation from plane pose
      // Directly assign the matrix from WebXR (contains position + orientation)
      const planePose = frame.getPose(plane.planeSpace, xrRefSpace)
      if (planePose) {
        mesh.matrixAutoUpdate = false
        mesh.matrix.fromArray(planePose.transform.matrix)
      }

      currentPlanes.set(plane, mesh)
    })

    // Remove meshes for planes that are no longer detected
    detectedPlanes.forEach((mesh, plane) => {
      if (!currentPlanes.has(plane)) {
        groupRef.current?.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      }
    })

    setDetectedPlanes(currentPlanes)
  })

  return <group ref={groupRef} />
}

/**
 * PlacementHandler - Handles trigger press and creates anchored pyramids
 *
 * Listens for session 'select' event and creates anchors at hit test positions
 */
interface PlacementHandlerProps {
  hitResult: XRHitTestResult | null
  xrRefSpace: XRReferenceSpace | null
}

function PlacementHandler({ hitResult, xrRefSpace }: PlacementHandlerProps) {
  const { session } = useXR()
  const [anchoredPyramids, setAnchoredPyramids] = useState<Array<{
    id: string
    anchor: XRAnchor
  }>>([])

  // Listen for select event (mirrors ar-example.html lines 118, 183-192)
  useEffect(() => {
    if (!session) return

    const onSelect = () => {
      if (hitResult && xrRefSpace) {
        // Create anchor exactly like ar-example.html line 186
        // TypeScript doesn't recognize AR features, so we need to cast
        if ('createAnchor' in hitResult) {
          (hitResult as any).createAnchor().then((anchor: XRAnchor) => {
            setAnchoredPyramids(prev => [...prev, {
              id: Math.random().toString(),
              anchor: anchor
            }])
          }).catch((error: Error) => {
            console.error("Could not create anchor: " + error)
          })
        }
      }
    }

    session.addEventListener('select', onSelect)
    return () => session.removeEventListener('select', onSelect)
  }, [session, hitResult, xrRefSpace])

  return (
    <>
      {anchoredPyramids.map(({ id, anchor }) => (
        <AnchoredPyramid
          key={id}
          anchor={anchor}
          xrRefSpace={xrRefSpace}
        />
      ))}
    </>
  )
}

/**
 * AnchoredPyramid - Renders pyramid that tracks anchor position
 *
 * Updates pyramid position from anchor pose each frame
 */
interface AnchoredPyramidProps {
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
}

function AnchoredPyramid({ anchor, xrRefSpace }: AnchoredPyramidProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { session } = useXR()

  // Update position from anchor each frame (mirrors ar-example.html lines 213-221)
  useFrame((state) => {
    if (!session || !xrRefSpace || !meshRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame) return

    // Check if anchor is still tracked
    if (!frame.trackedAnchors?.has(anchor)) return

    // Get anchor pose
    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // EXACTLY like ar-example.html line 220: directly assign matrix
    // The matrix already contains correct position AND orientation:
    // - Position: where the anchor is (on the surface)
    // - Orientation: Y-axis = surface normal (perpendicular to plane)
    meshRef.current.matrix.fromArray(anchorPose.transform.matrix)

    // CRITICAL: Offset pyramid so BASE is at anchor point, not center
    // ConeGeometry origin is at geometric center, so we translate up by height/2
    // Translation is along Y-axis in the anchor's local space (surface normal direction)
    const pyramidHeight = 0.3
    const translationMatrix = new THREE.Matrix4().makeTranslation(0, pyramidHeight / 2, 0)
    meshRef.current.matrix.multiply(translationMatrix)
  })

  return (
    <mesh ref={meshRef} matrixAutoUpdate={false}>
      {/* Pyramid: cone with 4 segments, pointing up (+Y) which aligns with surface normal
          Height 0.3, base radius 0.2 */}
      <coneGeometry args={[0.2, 0.3, 4]} />
      <meshStandardMaterial color="cyan" />
    </mesh>
  )
}
