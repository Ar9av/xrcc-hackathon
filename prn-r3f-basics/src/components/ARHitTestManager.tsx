import { useEffect, useRef, useState, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

/**
 * ARHitTestManager - Main component for AR plane detection and object placement
 *
 * Implements hit testing exactly like ar-example.html:
 * 1. Creates hit test source from viewer space
 * 2. Updates reticle position from hit test results each frame
 * 3. Handles object placement on select event via anchors
 *
 * Feature 3 additions:
 * - Only shows cursor when in draw mode
 * - Supports placing different object types (table, bed, or sofa)
 */

interface ARHitTestManagerProps {
  isDrawMode: boolean
  selectedObjectType: 'table' | 'bed' | 'sofa' | 'round-table' | null
  onExitDrawMode: () => void
}

export function ARHitTestManager({ isDrawMode, selectedObjectType, onExitDrawMode }: ARHitTestManagerProps) {
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
  // Feature 3: Only show cursor when in draw mode
  useFrame((state) => {
    if (!session || !hitTestSourceRef.current || !xrRefSpaceRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame) return

    const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current)

    // Only show cursor and store hit results when in draw mode
    if (hitTestResults.length > 0 && isDrawMode) {
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
        isDrawMode={isDrawMode}
        selectedObjectType={selectedObjectType}
        onExitDrawMode={onExitDrawMode}
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
        groupRef.current?.add(mesh)
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
 * PlacementHandler - Handles trigger press and creates anchored objects
 *
 * Listens for session 'select' event and creates anchors at hit test positions
 * Feature 3: Only places objects when in draw mode with a selected object type
 * Feature 4.1: Manages object selection and deletion
 */
interface PlacementHandlerProps {
  hitResult: XRHitTestResult | null
  xrRefSpace: XRReferenceSpace | null
  isDrawMode: boolean
  selectedObjectType: 'table' | 'bed' | 'sofa' | 'round-table' | null
  onExitDrawMode: () => void
}

function PlacementHandler({ hitResult, xrRefSpace, isDrawMode, selectedObjectType, onExitDrawMode }: PlacementHandlerProps) {
  const { session } = useXR()
  const [anchoredObjects, setAnchoredObjects] = useState<Array<{
    id: string
    anchor: XRAnchor
    type: 'table' | 'bed' | 'sofa' | 'round-table'
  }>>([])

  // Feature 4.1: Selection state
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const objectClickedRef = useRef(false)

  // Feature 4.1: Delete handler
  const handleDeleteSelected = () => {
    if (!selectedObjectId) return

    console.log(`Deleting object: ${selectedObjectId}`)
    setAnchoredObjects(prev => prev.filter(obj => obj.id !== selectedObjectId))
    setSelectedObjectId(null)
  }

  // Listen for select event (mirrors ar-example.html lines 118, 183-192)
  // Feature 3: Only place objects when in draw mode with selected type
  // Feature 4.1: Handle selection/deselection
  useEffect(() => {
    if (!session) return

    const onSelect = () => {
      // Feature 4.1: Handle deselection (clicked empty space)
      if (!objectClickedRef.current && selectedObjectId) {
        console.log('Deselecting - clicked empty space')
        setSelectedObjectId(null)
      }

      // Reset flag for next select event
      objectClickedRef.current = false

      // Feature 3: Only place objects if in draw mode with selected type
      if (!isDrawMode || !selectedObjectType || !hitResult || !xrRefSpace) return

      // Create anchor exactly like ar-example.html line 186
      // TypeScript doesn't recognize AR features, so we need to cast
      if ('createAnchor' in hitResult) {
        (hitResult as any).createAnchor().then((anchor: XRAnchor) => {
          setAnchoredObjects(prev => [...prev, {
            id: Math.random().toString(),
            anchor: anchor,
            type: selectedObjectType
          }])

          // Exit draw mode after placing one object to prevent accidental placement when selecting
          console.log('Object placed - exiting draw mode')
          onExitDrawMode()
        }).catch((error: Error) => {
          console.error("Could not create anchor: " + error)
        })
      }
    }

    session.addEventListener('select', onSelect)
    return () => session.removeEventListener('select', onSelect)
  }, [session, hitResult, xrRefSpace, isDrawMode, selectedObjectType, selectedObjectId])

  return (
    <>
      {anchoredObjects.map(({ id, anchor, type }) => (
        <SelectableObject
          key={id}
          id={id}
          anchor={anchor}
          xrRefSpace={xrRefSpace}
          type={type}
          isSelected={selectedObjectId === id}
          onSelect={(id) => {
            objectClickedRef.current = true
            setSelectedObjectId(id)
            console.log(`Object selected: ${id}`)
          }}
        />
      ))}

      {/* Feature 4.1: B button controller for deletion */}
      <SelectionController
        selectedObjectId={selectedObjectId}
        onDeleteSelected={handleDeleteSelected}
      />
    </>
  )
}

/**
 * SelectableObject - Renders GLB model (table, bed, or sofa) that tracks anchor position
 *
 * Updates object position from anchor pose each frame
 * Feature 3: Supports table, bed, and sofa object types loaded from GLB files
 * Feature 4.1: Supports selection via onClick and visual feedback
 */
interface SelectableObjectProps {
  id: string
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
  type: 'table' | 'bed' | 'sofa' | 'round-table'
  isSelected: boolean
  onSelect: (id: string) => void
}

function SelectableObject({ id, anchor, xrRefSpace, type, isSelected, onSelect }: SelectableObjectProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { session } = useXR()

  // Feature 4.1: Handle click for selection
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation() // Prevent triggering deselection
    onSelect(id)
  }

  // Load the appropriate GLB model
  const modelPath = type === 'round-table' ? '/asset/round-table.glb' : `/asset/${type}.glb`
  const { scene } = useGLTF(modelPath)

  // Clone the scene to avoid sharing geometry between instances
  const clonedScene = useMemo(() => {
    const cloned = scene.clone()
    
    // Traverse and fix materials to ensure textures and colors are visible
    cloned.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        // Handle both single materials and arrays
        const materials = Array.isArray(child.material) ? child.material : [child.material]
        
        materials.forEach((material) => {
          if (material instanceof THREE.MeshStandardMaterial || 
              material instanceof THREE.MeshPhysicalMaterial) {
            // Material is already a lit material, just ensure it's properly configured
            material.needsUpdate = true
            // Ensure textures are properly set
            if (material.map) material.map.needsUpdate = true
            if (material.normalMap) material.normalMap.needsUpdate = true
            if (material.roughnessMap) material.roughnessMap.needsUpdate = true
            if (material.metalnessMap) material.metalnessMap.needsUpdate = true
          } else if (material instanceof THREE.MeshBasicMaterial) {
            // Convert unlit materials to lit materials to show textures properly
            const newMaterial = new THREE.MeshStandardMaterial()
            newMaterial.copy(material)
            if (material.map) newMaterial.map = material.map
            if (material.color) newMaterial.color.copy(material.color)
            newMaterial.needsUpdate = true
            // Replace the material
            if (Array.isArray(child.material)) {
              const index = child.material.indexOf(material)
              child.material[index] = newMaterial
            } else {
              child.material = newMaterial
            }
          }
        })
      }
    })
    
    return cloned
  }, [scene])

  // Scale factors: table 90% (10% reduction), bed 20% (80% reduction), sofa 100%, round-table 100%
  const scale = useMemo(() => {
    if (type === 'table') return 0.9
    if (type === 'bed') return 0.25
    return 1.0
  }, [type])

  // Calculate Y offset once when model is loaded (unscaled, we'll scale it in the offset)
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    // Calculate Y offset to place object base on surface
    return size.y / 2 - center.y
  }, [clonedScene])

  // Update position from anchor each frame (mirrors ar-example.html lines 213-221)
  useFrame((state) => {
    if (!session || !xrRefSpace || !groupRef.current) return

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
    groupRef.current.matrix.fromArray(anchorPose.transform.matrix)

    // Offset by calculated Y offset (scaled) so the bottom of the object sits on the surface
    const translationMatrix = new THREE.Matrix4().makeTranslation(0, yOffset * scale, 0)
    groupRef.current.matrix.multiply(translationMatrix)
  })

  return (
    <group ref={groupRef} matrixAutoUpdate={false} onClick={handleClick}>
      <group scale={scale}>
        <primitive object={clonedScene} />
      </group>

      {/* Feature 4.1: Visual feedback for selection */}
      {isSelected && <SelectionHighlight />}
    </group>
  )
}

/**
 * SelectionHighlight - Visual feedback for selected object
 *
 * Feature 4.1: Simple wireframe box to indicate selection
 * Will be replaced with transform axes in Feature 4.2
 */
function SelectionHighlight() {
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshBasicMaterial
        color="yellow"
        wireframe
        opacity={0.8}
        transparent
      />
    </mesh>
  )
}

/**
 * SelectionController - Handles B button input for deletion
 *
 * Feature 4.1: Monitors right controller B button and triggers deletion
 */
interface SelectionControllerProps {
  selectedObjectId: string | null
  onDeleteSelected: () => void
}

function SelectionController({ selectedObjectId, onDeleteSelected }: SelectionControllerProps) {
  const rightController = useXRInputSourceState('controller', 'right')
  const previousBState = useRef(false)

  useFrame(() => {
    if (!rightController?.gamepad) return

    // B button detection on right controller
    const bButton = rightController.gamepad['b-button']
    const isBPressed = bButton?.state === 'pressed'

    // Edge detection: trigger only on press (false → true transition)
    if (isBPressed && !previousBState.current && selectedObjectId) {
      console.log('B button pressed - deleting selected object')
      onDeleteSelected()
    }
    previousBState.current = isBPressed
  })

  return null
}

// Preload models for better performance
useGLTF.preload('/asset/table.glb')
useGLTF.preload('/asset/bed.glb')
useGLTF.preload('/asset/sofa.glb')
useGLTF.preload('/asset/round-table.glb')
