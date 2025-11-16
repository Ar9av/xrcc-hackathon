import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useFrame, type ThreeEvent, useThree } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useGLTF, Text } from '@react-three/drei'
import * as THREE from 'three'

// Feature 4.2: Debug flag for rotation visualization
// Set to false to hide debug axes and improve performance
const ENABLE_ROTATION_DEBUG = false

// Debug flag for plane detection visualization
// Set to false to hide plane wireframes and improve performance
const ENABLE_PLANE_VISUALIZATION = false

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
 * - Supports placing different object types (tv, bed, or sofa)
 */

interface ARHitTestManagerProps {
  isDrawMode: boolean
  selectedObjectType: 'tv' | 'bed' | 'sofa' | 'round-table' | null
  onExitDrawMode: () => void
  isPaletteVisible: boolean
  onDeselectObject?: () => void  // Callback to deselect objects when palette opens
  onClosePalette?: () => void  // Callback to close palette when clicking in world
}

export function ARHitTestManager({ isDrawMode, selectedObjectType, onExitDrawMode, isPaletteVisible, onDeselectObject, onClosePalette }: ARHitTestManagerProps) {
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
      {ENABLE_PLANE_VISUALIZATION && <PlaneVisualizer xrRefSpace={xrRefSpaceRef.current} />}

      {/* Placement handler - manages object placement and anchors */}
      <PlacementHandler
        hitResult={currentHitResult}
        xrRefSpace={xrRefSpaceRef.current}
        isDrawMode={isDrawMode}
        selectedObjectType={selectedObjectType}
        onExitDrawMode={onExitDrawMode}
        isPaletteVisible={isPaletteVisible}
        onDeselectObject={onDeselectObject}
        onClosePalette={onClosePalette}
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
  selectedObjectType: 'tv' | 'bed' | 'sofa' | 'round-table' | null
  onExitDrawMode: () => void
  isPaletteVisible: boolean
  onDeselectObject?: () => void
  onClosePalette?: () => void
}

// Feature 4.2: Transform mode type
type TransformMode = 'rotate' | 'scale' | 'move'

function PlacementHandler({ hitResult, xrRefSpace, isDrawMode, selectedObjectType, onExitDrawMode, isPaletteVisible, onDeselectObject, onClosePalette }: PlacementHandlerProps) {
  const { session } = useXR()
  const [anchoredObjects, setAnchoredObjects] = useState<Array<{
    id: string
    anchor: XRAnchor
    type: 'tv' | 'bed' | 'sofa' | 'round-table'
    rotation: number  // Feature 4.2: Rotation angle in radians around plane normal
    scale: number  // Feature 4.2: Scale multiplier (0.75 to 1.25, default 1.0 = 100%)
    movementOffset: THREE.Vector3  // Feature 4.2: Movement offset from anchor position
  }>>([])

  // Feature 4.1: Selection state
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const objectClickedRef = useRef(false)

  // Deselect object when palette opens
  useEffect(() => {
    if (isPaletteVisible && selectedObjectId) {
      console.log('Palette opened - deselecting object')
      setSelectedObjectId(null)
      onDeselectObject?.()
    }
  }, [isPaletteVisible])

  // Feature 4.2: Transform mode state (default is rotate)
  const [transformMode, setTransformMode] = useState<TransformMode>('rotate')

  // Store refs to object groups for visualization positioning
  const objectRefsMap = useRef<Map<string, React.RefObject<THREE.Group | null>>>(new Map())

  // Feature 4.1: Delete handler
  const handleDeleteSelected = () => {
    if (!selectedObjectId) return

    console.log(`Deleting object: ${selectedObjectId}`)
    setAnchoredObjects(prev => prev.filter(obj => obj.id !== selectedObjectId))
    setSelectedObjectId(null)
  }

  // Feature 4.2: Rotation handler - accumulates rotation angle smoothly
  const handleRotate = (deltaRotation: number) => {
    if (!selectedObjectId) return

    setAnchoredObjects(prev => prev.map(obj => {
      if (obj.id === selectedObjectId) {
        const newRotation = obj.rotation + deltaRotation
        // Keep rotation in reasonable range to avoid floating point drift
        const normalizedRotation = newRotation > Math.PI * 4 ? newRotation - Math.PI * 4 :
                                    newRotation < -Math.PI * 4 ? newRotation + Math.PI * 4 :
                                    newRotation
        return { ...obj, rotation: normalizedRotation }
      }
      return obj
    }))
  }

  // Feature 4.2: Scale handler - accumulates scale smoothly with clamping
  const handleScale = (deltaScale: number) => {
    if (!selectedObjectId) return

    setAnchoredObjects(prev => prev.map(obj => {
      if (obj.id === selectedObjectId) {
        const newScale = obj.scale + deltaScale
        // Clamp to range [0.75, 1.25]
        const clampedScale = Math.max(0.75, Math.min(1.25, newScale))
        return { ...obj, scale: clampedScale }
      }
      return obj
    }))
  }

  // Feature 4.2: Move handler - sets position to initial + delta (not accumulating)
  const handleMoveObject = (initialOffset: THREE.Vector3, deltaMovement: THREE.Vector3) => {
    if (!selectedObjectId) return

    setAnchoredObjects(prev => prev.map(obj => {
      if (obj.id === selectedObjectId) {
        // CORRECT: Set offset to initial + delta (direct position mapping)
        const newOffset = initialOffset.clone().add(deltaMovement)
        return { ...obj, movementOffset: newOffset }
      }
      return obj
    }))
  }

  // Feature 4.2: Mode toggle handler
  const handleToggleMode = () => {
    setTransformMode(prev => {
      const modes: TransformMode[] = ['rotate', 'scale', 'move']
      const currentIndex = modes.indexOf(prev)
      const nextIndex = (currentIndex + 1) % modes.length
      console.log(`Mode changed: ${prev} → ${modes[nextIndex]}`)
      return modes[nextIndex]
    })
  }

  // Listen for select event (mirrors ar-example.html lines 118, 183-192)
  // Feature 3: Only place objects when in draw mode with selected type
  // Feature 4.1: Handle selection/deselection
  useEffect(() => {
    if (!session) return

    const onSelect = () => {
      // Close palette if open and clicked anywhere (empty space or object)
      if (isPaletteVisible) {
        console.log('Palette open - closing palette')
        onClosePalette?.()
        // Don't return here - still need to handle object selection if clicking on object
      }

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
            type: selectedObjectType,
            rotation: 0,  // Feature 4.2: Initialize rotation to 0
            scale: 1.0,  // Feature 4.2: Initialize scale to 1.0 (100%)
            movementOffset: new THREE.Vector3(0, 0, 0)  // Feature 4.2: Initialize movement offset to zero
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
      {anchoredObjects.map(({ id, anchor, type, rotation, scale, movementOffset }) => {
        const isSelected = selectedObjectId === id

        // Get or create ref for this object
        if (!objectRefsMap.current.has(id)) {
          objectRefsMap.current.set(id, React.createRef<THREE.Group>())
        }
        const objectRef = objectRefsMap.current.get(id)!

        return (
          <React.Fragment key={id}>
            <SelectableObject
              ref={objectRef}
              id={id}
              anchor={anchor}
              xrRefSpace={xrRefSpace}
              type={type}
              rotation={rotation}
              scale={scale}
              movementOffset={movementOffset}
              isSelected={isSelected}
              transformMode={transformMode}
              onSelect={(id) => {
                objectClickedRef.current = true
                setSelectedObjectId(id)
                console.log(`Object selected: ${id}`)
              }}
            />
            {/* Render ScaleSlider outside object hierarchy for correct world-space positioning */}
            {isSelected && transformMode === 'scale' && (
              <ScaleSlider
                objectRef={objectRef}
                anchor={anchor}
                xrRefSpace={xrRefSpace}
                type={type}
                scale={scale}
                baseScale={type === 'tv' ? 0.9 : type === 'bed' ? 0.25 : 1.0}
              />
            )}
          </React.Fragment>
        )
      })}

      {/* Feature 4.1: B button controller for deletion */}
      <SelectionController
        selectedObjectId={selectedObjectId}
        onDeleteSelected={handleDeleteSelected}
      />

      {/* Feature 4.2: Rotation, scale, move, and mode controllers */}
      <RotationController
        selectedObjectId={selectedObjectId}
        transformMode={transformMode}
        onRotate={handleRotate}
      />
      <ScaleController
        selectedObjectId={selectedObjectId}
        transformMode={transformMode}
        onScale={handleScale}
      />
      <MoveController
        selectedObjectId={selectedObjectId}
        transformMode={transformMode}
        onMove={handleMoveObject}
        anchoredObjects={anchoredObjects}
        xrRefSpace={xrRefSpace}
      />
      <ModeController
        selectedObjectId={selectedObjectId}
        onToggleMode={handleToggleMode}
      />

      {/* Controller tooltips - shows button instructions based on current state */}
      <ControllerTooltips
        isPaletteVisible={isPaletteVisible}
        isDrawMode={isDrawMode}
        selectedObjectId={selectedObjectId}
        transformMode={transformMode}
      />
    </>
  )
}

/**
 * SelectableObject - Renders GLB model (tv, bed, or sofa) that tracks anchor position
 *
 * Updates object position from anchor pose each frame
 * Feature 3: Supports tv, bed, and sofa object types loaded from GLB files
 * Feature 4.1: Supports selection via onClick and visual feedback
 * Feature 4.2: Supports rotation around plane normal and scaling
 */
interface SelectableObjectProps {
  id: string
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
  type: 'tv' | 'bed' | 'sofa' | 'round-table'
  rotation: number  // Feature 4.2: Rotation angle in radians
  scale: number  // Feature 4.2: Scale multiplier (0.75 to 1.25)
  movementOffset: THREE.Vector3  // Feature 4.2: Movement offset from anchor
  isSelected: boolean
  transformMode: TransformMode  // Feature 4.2: Current transform mode
  onSelect: (id: string) => void
}

const SelectableObject = React.forwardRef<THREE.Group, SelectableObjectProps>(
  function SelectableObject({ id, anchor, xrRefSpace, type, rotation, scale, movementOffset, isSelected, transformMode, onSelect }, ref) {
    const groupRef = (ref as React.RefObject<THREE.Group>) || useRef<THREE.Group>(null)
    const { session } = useXR()

  // Handle click for selection (Feature 4.1)
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

  // Base scale factors: tv 90% (10% reduction), bed 50% (50% reduction), sofa 100%, round-table 100%
  const baseScale = useMemo(() => {
    if (type === 'tv') return 0.02
    if (type === 'bed') return 1.1
    return 1.0
  }, [type])

  // Combined scale = base scale * user scale (0.75 to 1.25)
  const finalScale = baseScale * scale

  // Calculate Y offset once when model is loaded (unscaled, we'll scale it in the offset)
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    // Calculate Y offset to place object base on surface
    return size.y / 2 - center.y
  }, [clonedScene])

  // Feature 4.2: Update object position and rotation from anchor each frame
  useFrame((state) => {
    if (!session || !xrRefSpace || !groupRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame) return

    // Check if anchor is still tracked
    if (!frame.trackedAnchors?.has(anchor)) return

    // Get anchor pose
    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Decompose anchor matrix to get position and orientation
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorPos = new THREE.Vector3()
    const anchorQuat = new THREE.Quaternion()
    const anchorScale = new THREE.Vector3()
    anchorMatrix.decompose(anchorPos, anchorQuat, anchorScale)

    // Extract plane normal from anchor orientation (Y-axis)
    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Position object at anchor point + movement offset + Y offset along plane normal
    const finalPos = anchorPos.clone()
      .add(movementOffset)  // Apply user movement offset
      .add(planeNormal.clone().multiplyScalar(yOffset * finalScale))  // Apply Y offset for object base

    // Apply user rotation around plane normal
    let finalQuat = anchorQuat.clone()
    if (rotation !== 0) {
      const rotationQuat = new THREE.Quaternion().setFromAxisAngle(planeNormal, rotation)
      finalQuat = rotationQuat.multiply(anchorQuat)
    }

    // Update object transformation
    groupRef.current.matrix.compose(finalPos, finalQuat, new THREE.Vector3(1, 1, 1))
  })

  return (
    <group ref={groupRef} matrixAutoUpdate={false} onClick={handleClick}>
      <group scale={finalScale}>
        <primitive object={clonedScene} />

        {/* Rotate ring inside scale group to inherit scaling */}
        {isSelected && transformMode === 'rotate' && (
          <RotateRing objectRef={groupRef} anchor={anchor} xrRefSpace={xrRefSpace} />
        )}

        {/* Move axes inside scale group to inherit scaling and position */}
        {isSelected && transformMode === 'move' && (
          <MoveAxes
            scale={scale}
            type={type}
          />
        )}
      </group>
    </group>
  )
})

/**
 * RotateRing - Yellow ring visual for rotate mode
 *
 * Feature 4.2: Shows a flat ring around the selected object
 * - Ring is parallel to the placement plane
 * - Ring is centered on the object
 * - Ring scales based on object bounding box (diagonal + 15cm)
 * - Ring thickness is 7.5% of radius
 */
interface RotateRingProps {
  objectRef: React.RefObject<THREE.Group | null>
  anchor: XRAnchor  // Used by debug visualization
  xrRefSpace: XRReferenceSpace | null  // Used by debug visualization
}

function RotateRing({ objectRef, anchor, xrRefSpace }: RotateRingProps) {
  // Cache bounding box calculations (only compute once on mount)
  const ringRadius = useMemo(() => {
    if (!objectRef.current) return 0.5

    const bbox = new THREE.Box3().setFromObject(objectRef.current)
    const size = bbox.getSize(new THREE.Vector3())

    // Bounding box diagonal + 15cm (0.15 meters) - reduced to hug object more
    const diagonal = size.length()
    return (diagonal / 2) + 0.15
  }, [objectRef])

  // Ring is a child of the object group, so it inherits the parent's transform
  // We just need to position it at the object's center (0,0,0 in local space)
  // and rotate it to lie flat on the plane
  return (
    <>
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {/* Inner radius 92.5%, outer radius 100% = 7.5% thickness (half of previous 15%) */}
        <ringGeometry args={[ringRadius * 0.925, ringRadius, 32]} />
        <meshBasicMaterial color="yellow" side={THREE.DoubleSide} />
      </mesh>

      {/* Debug visualization - disable if performance issues */}
      {ENABLE_ROTATION_DEBUG && (
        <RotateDebugVectors objectRef={objectRef} anchor={anchor} xrRefSpace={xrRefSpace} />
      )}
    </>
  )
}

/**
 * RotateDebugVectors - Debug visualization for rotation axes
 *
 * Shows colored arrows to visualize:
 * - RED: Plane normal (rotation axis) - points perpendicular to the surface
 * - BLUE: Object's local forward direction (Z-axis)
 * - GREEN: Object's local right direction (X-axis)
 * - CYAN: Object's local up direction (Y-axis)
 */
interface RotateDebugVectorsProps {
  objectRef: React.RefObject<THREE.Group | null>
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
}

function RotateDebugVectors({ objectRef, anchor, xrRefSpace }: RotateDebugVectorsProps) {
  const { session } = useXR()

  // Create arrow helpers once
  const planeNormalArrow = useMemo(() => new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    0.5,
    0xff0000,
    0.1,
    0.05
  ), [])

  const objectForwardArrow = useMemo(() => new THREE.ArrowHelper(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, 0),
    0.4,
    0x0000ff,
    0.08,
    0.04
  ), [])

  const objectRightArrow = useMemo(() => new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 0, 0),
    0.4,
    0x00ff00,
    0.08,
    0.04
  ), [])

  const objectUpArrow = useMemo(() => new THREE.ArrowHelper(
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 0),
    0.4,
    0x00ffff,
    0.08,
    0.04
  ), [])

  useFrame((state) => {
    if (!session || !xrRefSpace || !objectRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame?.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Get anchor matrix and extract basis vectors
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)

    const planeX = new THREE.Vector3()
    const planeNormal = new THREE.Vector3()
    const planeZ = new THREE.Vector3()
    anchorMatrix.extractBasis(planeX, planeNormal, planeZ)

    // Get object's world matrix
    const objectMatrix = objectRef.current.matrixWorld.clone()
    const objectForward = new THREE.Vector3()
    const objectRight = new THREE.Vector3()
    const objectUp = new THREE.Vector3()
    objectMatrix.extractBasis(objectRight, objectUp, objectForward)
    objectForward.multiplyScalar(-1) // Three.js uses -Z as forward

    // Get anchor position for arrow origin
    const anchorPos = new THREE.Vector3()
    anchorMatrix.decompose(anchorPos, new THREE.Quaternion(), new THREE.Vector3())

    // Update arrows
    planeNormalArrow.position.copy(anchorPos)
    planeNormalArrow.setDirection(planeNormal.normalize())
    planeNormalArrow.setLength(0.5, 0.1, 0.05)

    objectForwardArrow.position.copy(anchorPos)
    objectForwardArrow.setDirection(objectForward.normalize())
    objectForwardArrow.setLength(0.4, 0.08, 0.04)

    objectRightArrow.position.copy(anchorPos)
    objectRightArrow.setDirection(objectRight.normalize())
    objectRightArrow.setLength(0.4, 0.08, 0.04)

    objectUpArrow.position.copy(anchorPos)
    objectUpArrow.setDirection(objectUp.normalize())
    objectUpArrow.setLength(0.4, 0.08, 0.04)
  })

  return (
    <group>
      {/* RED: Plane normal (rotation axis) - perpendicular to surface */}
      <primitive object={planeNormalArrow} />

      {/* BLUE: Object forward (-Z) - shows which way object is facing */}
      <primitive object={objectForwardArrow} />

      {/* GREEN: Object right (X) - shows object's local X-axis */}
      <primitive object={objectRightArrow} />

      {/* CYAN: Object up (Y) - shows object's local Y-axis */}
      <primitive object={objectUpArrow} />
    </group>
  )
}

/**
 * ScaleSlider - Visual slider for scale mode
 *
 * Feature 4.2: Shows a cone + torus slider above the selected object for visual scaling feedback.
 *
 * Cone: 1m tall, 0.1m radius (20cm diameter), light green, tip pointing down (180° rotated).
 *
 * Torus: Dynamic sizing and positioning based on scale value.
 *   - Tube radius: 5cm (constant)
 *   - Main radius: innerRadius + tubeRadius (distance from center to tube center)
 *   - Inner diameter formula: distanceFromTip * (cone_diameter / cone_height)
 *   - Position: accounts for cone rotation (yPos = distanceFromTip - 0.5)
 *   - Orientation: 90° rotation on X-axis to align hole with cone's Y-axis
 *   - Movement: moves toward base when scaling up, toward tip when scaling down
 *
 * Positioning: Perpendicular to placement plane with 50cm clearance above actual object height.
 *   - Height calculated from GLB model using Box3.setFromObject (cached in useMemo)
 *   - Position = objectWorldPos + (scaledHeight + 0.5m) * planeNormal
 *   - Uses objectRef.getWorldPosition() to track object after movement
 *
 * Orientation: Always aligned with global Y-axis (identity quaternion).
 *
 * Hierarchy: Rendered at PlacementHandler level (sibling of SelectableObject) to avoid
 * inheriting parent transforms. World-space positioning requires independent hierarchy.
 */
interface ScaleSliderProps {
  objectRef: React.RefObject<THREE.Group | null>  // To track object position after movement
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
  type: 'tv' | 'bed' | 'sofa' | 'round-table'
  scale: number  // User scale multiplier (0.75 to 1.25)
  baseScale: number  // Asset-specific base scale factor
}

function ScaleSlider({ objectRef, anchor, xrRefSpace, type, scale, baseScale }: ScaleSliderProps) {
  const sliderGroupRef = useRef<THREE.Group>(null)
  const { session } = useXR()

  // Load GLB model to calculate actual object dimensions
  const modelPath = type === 'round-table' ? '/asset/round-table.glb' : `/asset/${type}.glb`
  const { scene } = useGLTF(modelPath)

  // Cache unscaled object height (expensive to recalculate each frame)
  const unscaledHeight = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    return size.y
  }, [scene])

  // Calculate torus geometry parameters and position from scale value
  const { torusRadius, torusYPosition } = useMemo(() => {
    // Map scale (0.75 to 1.25) to distance from cone tip (0m to 1m)
    const distanceFromTip = (scale - 0.75) / 0.5 * 1.0

    // Calculate inner diameter using cone profile formula
    // Formula: distanceFromTip * (cone_diameter / cone_height)
    // At tip (0m): 0cm inner diameter
    // At base (1m): 20cm inner diameter
    const coneDiameter = 0.2  // 20cm
    const coneHeight = 1.0    // 1m
    const innerDiameter = distanceFromTip * (coneDiameter / coneHeight)
    const innerRadius = innerDiameter / 2

    // Torus parameters: 5cm tube radius (constant), main radius = innerRadius + tubeRadius
    // TorusGeometry first param is distance from torus center to tube center
    const tubeRadius = 0.05
    const radius = Math.max(0.01, innerRadius + tubeRadius)  // Min to avoid degenerate geometry

    // Calculate Y position on cone (rotated 180° so tip at -0.5, base at +0.5)
    // Scaling up increases distanceFromTip, which increases Y, moving torus toward base
    const yPos = distanceFromTip - 0.5

    return { torusRadius: radius, torusYPosition: yPos }
  }, [scale])

  // Update slider position each frame to track object and maintain clearance
  useFrame((state) => {
    if (!session || !xrRefSpace || !sliderGroupRef.current || !objectRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame?.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Get object's actual world position (includes movementOffset)
    const objectWorldPos = new THREE.Vector3()
    objectRef.current.getWorldPosition(objectWorldPos)

    // Extract anchor orientation for plane normal
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(new THREE.Vector3(), anchorQuat, new THREE.Vector3())

    // Plane normal is anchor's Y-axis (perpendicular to placement surface)
    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Calculate current object height (accounts for base scale and user scale)
    const scaledHeight = unscaledHeight * baseScale * scale

    // Position slider 50cm above object top, along plane normal
    const clearance = 0.5
    const sliderPos = objectWorldPos.clone()
      .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))

    sliderGroupRef.current.position.copy(sliderPos)

    // Orient slider along global Y-axis (identity quaternion)
    sliderGroupRef.current.quaternion.set(0, 0, 0, 1)
  })

  return (
    <group ref={sliderGroupRef}>
      {/* Cone: 1m tall, 0.1m radius, light green, rotated 180° to point tip down */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.1, 1.0, 16]} />
        <meshBasicMaterial color="#90EE90" side={THREE.DoubleSide} />
      </mesh>

      {/* Torus: dynamic radius and position, dark green, rotated 90° to align with cone */}
      <mesh position={[0, torusYPosition, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[torusRadius, 0.05, 16, 32]} />
        <meshBasicMaterial color="#006400" />
      </mesh>
    </group>
  )
}

/**
 * MoveAxes - Visual axes for move mode
 *
 * Feature 4.2: Shows two perpendicular red axes above the selected object.
 * - Positioned in local space at [0, scaledHeight + clearance, 0]
 * - Inherits parent transform (moves and scales with object automatically)
 * - Red color for both X and Z axes (movement along the plane)
 */
interface MoveAxesProps {
  scale: number     // Object's user scale (0.75 to 1.25)
  type: 'tv' | 'bed' | 'sofa' | 'round-table'
}

function MoveAxes({ scale, type }: MoveAxesProps) {
  // Load GLB model to calculate actual object dimensions
  const modelPath = type === 'round-table' ? '/asset/round-table.glb' : `/asset/${type}.glb`
  const { scene } = useGLTF(modelPath)

  // Cache unscaled object height
  const unscaledHeight = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    return size.y
  }, [scene])

  // Calculate Y position: scaledHeight + clearance (in local space, will be scaled by parent)
  const yPosition = useMemo(() => {
    const scaledHeight = unscaledHeight * scale
    const clearance = 0.3
    return scaledHeight + clearance
  }, [unscaledHeight, scale])

  // Calculate axes length based on model size (half size for crosshair visibility)
  const axesLength = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.z)  // Use X and Z (not Y which is height)
    return ((maxDim / 2) + 0.2) / 2  // Half of (half dimension + clearance)
  }, [scene])

  // Create crosshair arrows (red, pointing +X, -X, +Z, -Z in local space for plane movement)
  const xPosArrow = useMemo(() =>
    new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),  // +X direction
      new THREE.Vector3(0, 0, 0),  // Origin
      axesLength,
      0xff0000,  // Red
      0.1,
      0.05
    ), [axesLength]
  )

  const xNegArrow = useMemo(() =>
    new THREE.ArrowHelper(
      new THREE.Vector3(-1, 0, 0),  // -X direction
      new THREE.Vector3(0, 0, 0),  // Origin
      axesLength,
      0xff0000,  // Red
      0.1,
      0.05
    ), [axesLength]
  )

  const zPosArrow = useMemo(() =>
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),  // +Z direction
      new THREE.Vector3(0, 0, 0),  // Origin
      axesLength,
      0xff0000,  // Red
      0.1,
      0.05
    ), [axesLength]
  )

  const zNegArrow = useMemo(() =>
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, -1),  // -Z direction
      new THREE.Vector3(0, 0, 0),  // Origin
      axesLength,
      0xff0000,  // Red
      0.1,
      0.05
    ), [axesLength]
  )

  // Simple child positioned in local space - parent handles all transforms
  return (
    <group position={[0, yPosition, 0]}>
      <primitive object={xPosArrow} />
      <primitive object={xNegArrow} />
      <primitive object={zPosArrow} />
      <primitive object={zNegArrow} />
    </group>
  )
}

/**
 * MoveController - Handles grip button input for object movement
 *
 * Feature 4.2: Monitors grip button on both controllers and enables object dragging
 * - Only active when object selected and in move mode
 * - Hold grip button and drag hand to move object
 * - Movement constrained to placement plane along local X and Z axes
 * - Sensitivity: 2.0 (hand moves 1m, object moves 2m)
 * - Latest input wins when both grips pressed
 */
interface MoveControllerProps {
  selectedObjectId: string | null
  transformMode: TransformMode
  onMove: (initialOffset: THREE.Vector3, deltaMovement: THREE.Vector3) => void
  anchoredObjects: Array<{
    id: string
    anchor: XRAnchor
    rotation: number
    movementOffset: THREE.Vector3
  }>
  xrRefSpace: XRReferenceSpace | null
}

function MoveController({ selectedObjectId, transformMode, onMove, anchoredObjects, xrRefSpace }: MoveControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')
  const { session } = useXR()

  // Movement state
  const isMoving = useRef(false)
  const activeHand = useRef<'left' | 'right' | null>(null)
  const initialControllerPos = useRef<THREE.Vector3 | null>(null)
  const initialMovementOffset = useRef<THREE.Vector3 | null>(null)  // CRITICAL: Store initial object position

  // Previous grip states for edge detection
  const prevLeftGrip = useRef(false)
  const prevRightGrip = useRef(false)

  useFrame((state) => {
    // Only active when object selected and in move mode
    if (!selectedObjectId || transformMode !== 'move' || !session || !xrRefSpace) {
      isMoving.current = false
      return
    }

    // Check grip button states
    const leftGrip = leftController?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'
    const rightGrip = rightController?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'

    // Detect grip press (edge: false → true)
    const leftGripPressed = leftGrip && !prevLeftGrip.current
    const rightGripPressed = rightGrip && !prevRightGrip.current

    // Handle grip press - start movement
    if (leftGripPressed && leftController?.object) {
      startMovement('left', leftController)
    } else if (rightGripPressed && rightController?.object) {
      startMovement('right', rightController)
    }

    // Handle ongoing movement
    if (isMoving.current && activeHand.current) {
      const controller = activeHand.current === 'left' ? leftController : rightController
      updateMovement(controller, state)
    }

    // Detect grip release
    if (isMoving.current && !leftGrip && !rightGrip) {
      finishMovement()
    }

    // Update previous states
    prevLeftGrip.current = leftGrip
    prevRightGrip.current = rightGrip
  })

  const startMovement = (hand: 'left' | 'right', controller: any) => {
    if (!controller?.object || !selectedObjectId) return

    isMoving.current = true
    activeHand.current = hand

    // Capture initial controller position
    const controllerPos = new THREE.Vector3()
    controller.object.getWorldPosition(controllerPos)
    initialControllerPos.current = controllerPos.clone()

    // CRITICAL: Capture object's current position when grip is pressed
    const objData = anchoredObjects.find(o => o.id === selectedObjectId)
    if (objData) {
      initialMovementOffset.current = objData.movementOffset.clone()
    }

    console.log(`Movement started - ${hand} grip pressed`)
  }

  const updateMovement = (controller: any, state: any) => {
    if (!controller?.object || !initialControllerPos.current || !initialMovementOffset.current || !selectedObjectId || !xrRefSpace) return

    // Get current controller position
    const currentPos = new THREE.Vector3()
    controller.object.getWorldPosition(currentPos)

    // Calculate delta from initial position
    const delta = currentPos.clone().sub(initialControllerPos.current)

    // Apply sensitivity
    const SENSITIVITY = 2.0
    const movement = delta.multiplyScalar(SENSITIVITY)

    // Get selected object data
    const objData = anchoredObjects.find(o => o.id === selectedObjectId)
    if (!objData) return

    // Get anchor pose
    const frame = state.gl.xr.getFrame()
    if (!frame) return

    const anchorPose = frame.getPose(objData.anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Project movement onto object's plane
    const projectedMovement = projectMovementOntoPlane(movement, anchorPose, objData.rotation)

    // CRITICAL: Pass both initial offset and delta to update handler
    // This sets position = initial + delta (not accumulating each frame)
    onMove(initialMovementOffset.current, projectedMovement)
  }

  const finishMovement = () => {
    isMoving.current = false
    activeHand.current = null
    initialControllerPos.current = null
    initialMovementOffset.current = null

    console.log('Movement finished - grip released')
  }

  const projectMovementOntoPlane = (
    worldDelta: THREE.Vector3,
    anchorPose: XRPose,
    objectRotation: number
  ): THREE.Vector3 => {
    // Extract anchor orientation
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(new THREE.Vector3(), anchorQuat, new THREE.Vector3())

    // Get plane normal
    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Apply object rotation
    const rotationQuat = new THREE.Quaternion().setFromAxisAngle(planeNormal, objectRotation)
    const finalQuat = rotationQuat.multiply(anchorQuat)

    // Get object's local X and Z axes in world space (movement along the plane)
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(finalQuat)
    const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(finalQuat)

    // Project delta onto local axes
    const xComponent = worldDelta.dot(localX)
    const zComponent = worldDelta.dot(localZ)

    // Reconstruct movement in plane
    return new THREE.Vector3()
      .addScaledVector(localX, xComponent)
      .addScaledVector(localZ, zComponent)
  }

  return null
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

/**
 * RotationController - Handles thumbstick input for object rotation
 *
 * Feature 4.2: Smooth rotation control using controller thumbsticks
 * - Only active when object is selected and in rotate mode
 * - Either left or right thumbstick X-axis controls rotation
 * - If both thumbsticks active, uses the one with larger magnitude
 * - Rotation speed: 30 degrees per second (π/6 radians/sec)
 * - Dead zone: 0.1 to prevent drift
 */
interface RotationControllerProps {
  selectedObjectId: string | null
  transformMode: TransformMode
  onRotate: (deltaRotation: number) => void
}

function RotationController({ selectedObjectId, transformMode, onRotate }: RotationControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  useFrame((_state, delta) => {
    // Only rotate when object selected and in rotate mode
    if (!selectedObjectId || transformMode !== 'rotate') return

    const leftThumbstick = leftController?.gamepad?.['xr-standard-thumbstick']
    const rightThumbstick = rightController?.gamepad?.['xr-standard-thumbstick']

    const leftX = leftThumbstick?.xAxis ?? 0
    const rightX = rightThumbstick?.xAxis ?? 0

    const DEAD_ZONE = 0.1
    const leftActive = Math.abs(leftX) > DEAD_ZONE
    const rightActive = Math.abs(rightX) > DEAD_ZONE

    // Determine rotation input: use strongest thumbstick if both active
    let rotationInput = 0
    if (leftActive && rightActive) {
      rotationInput = Math.abs(leftX) > Math.abs(rightX) ? leftX : rightX
    } else if (leftActive) {
      rotationInput = leftX
    } else if (rightActive) {
      rotationInput = rightX
    }

    // Apply rotation with 30°/sec speed
    if (rotationInput !== 0) {
      const rotationSpeed = Math.PI / 6  // 30 degrees/sec in radians
      const deltaRotation = rotationInput * rotationSpeed * delta
      onRotate(deltaRotation)
    }
  })

  return null
}

/**
 * ScaleController - Handles thumbstick input for object scaling
 *
 * Feature 4.2: Smooth scaling control using controller thumbstick Y-axis.
 *
 * Input: Left or right thumbstick Y-axis (forward/backward).
 *   - Both controllers supported
 *   - Strongest input wins when both active
 *   - Dead zone: 0.1 to prevent drift
 *
 * Behavior:
 *   - Forward (positive Y): increases object size, torus moves toward cone base
 *   - Backward (negative Y): decreases object size, torus moves toward cone tip
 *   - Input is inverted (deltaScale = -yAxis) to match expected behavior
 *
 * Speed: 12.5% per second at full thumbstick deflection (4 seconds for 75% to 125% range).
 *
 * Only active when object is selected and in scale mode.
 */
interface ScaleControllerProps {
  selectedObjectId: string | null
  transformMode: TransformMode
  onScale: (deltaScale: number) => void
}

function ScaleController({ selectedObjectId, transformMode, onScale }: ScaleControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  useFrame((_state, delta) => {
    if (!selectedObjectId || transformMode !== 'scale') return

    // Get thumbstick Y-axis values from both controllers
    const leftThumbstick = leftController?.gamepad?.['xr-standard-thumbstick']
    const rightThumbstick = rightController?.gamepad?.['xr-standard-thumbstick']

    const leftY = leftThumbstick?.yAxis ?? 0
    const rightY = rightThumbstick?.yAxis ?? 0

    // Apply dead zone to filter out drift
    const DEAD_ZONE = 0.1
    const leftActive = Math.abs(leftY) > DEAD_ZONE
    const rightActive = Math.abs(rightY) > DEAD_ZONE

    // Select scaling input: strongest thumbstick wins if both active
    let scaleInput = 0
    if (leftActive && rightActive) {
      scaleInput = Math.abs(leftY) > Math.abs(rightY) ? leftY : rightY
    } else if (leftActive) {
      scaleInput = leftY
    } else if (rightActive) {
      scaleInput = rightY
    }

    // Apply scaling with frame-rate independent speed
    if (scaleInput !== 0) {
      const scaleSpeed = 0.125  // 12.5% per second
      // Invert input so forward (positive) increases size
      const deltaScale = -scaleInput * scaleSpeed * delta

      onScale(deltaScale)
    }
  })

  return null
}

/**
 * ModeController - Handles 'A' button input for mode toggling
 *
 * Feature 4.2: Cycles through transform modes using right controller 'A' button
 * - Only active when an object is selected
 * - Mode sequence: rotate → scale → move → rotate
 * - Edge detection prevents continuous triggering on button hold
 */
interface ModeControllerProps {
  selectedObjectId: string | null
  onToggleMode: () => void
}

/**
 * ControllerTooltips - Displays tooltips attached to controllers showing button instructions
 *
 * Tooltips change based on current state:
 * - Default: Left shows "Y - open object palette", Right shows nothing
 * - Palette open: Left shows "LT - select object", Right shows "RT - select object"
 * - Draw mode: Left shows "LT - place object", Right shows "RT - place object"
 * - Object selected (rotate/scale/move): Shows mode-specific instructions
 */
interface ControllerTooltipsProps {
  isPaletteVisible: boolean
  isDrawMode: boolean
  selectedObjectId: string | null
  transformMode: TransformMode
}

function ControllerTooltips({ isPaletteVisible, isDrawMode, selectedObjectId, transformMode }: ControllerTooltipsProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')
  const leftTooltipRef = useRef<THREE.Group>(null)
  const rightTooltipRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const { mode } = useXR()
  const isInXR = mode === 'immersive-ar'

  // Determine tooltip text based on state
  const getTooltipText = (hand: 'left' | 'right'): string | null => {
    // Object selected states take priority
    if (selectedObjectId) {
      if (transformMode === 'rotate') {
        if (hand === 'left') {
          return 'Thumb stick left/right - rotate\nY - open object palette'
        } else {
          return 'Thumb stick left/right - rotate\nA - toggle mode\nB - delete object'
        }
      } else if (transformMode === 'scale') {
        if (hand === 'left') {
          return 'Thumb stick forward - increase size\nThumb stick back - decrease size\nY - open object palette'
        } else {
          return 'Thumb stick forward - increase size\nThumb stick back - decrease size\nA - toggle mode\nB - delete object'
        }
      } else if (transformMode === 'move') {
        if (hand === 'left') {
          return 'Grip hold + drag - move object\nY - open object palette'
        } else {
          return 'Grip hold + drag - move object\nA - toggle mode\nB - delete object'
        }
      }
    }

    // Palette open state
    if (isPaletteVisible) {
      if (hand === 'left') {
        return 'LT - select object'
      } else {
        return 'RT - select object'
      }
    }

    // Draw mode state
    if (isDrawMode) {
      if (hand === 'left') {
        return 'LT - place object'
      } else {
        return 'RT - place object'
      }
    }

    // Default state
    if (hand === 'left') {
      return 'Y - open object palette'
    } else {
      return null  // No tooltip for right controller in default state
    }
  }

  const leftText = getTooltipText('left')
  const rightText = getTooltipText('right')

  // Debug: Log state changes (can be removed later)
  useEffect(() => {
    console.log('Tooltip state:', {
      isPaletteVisible,
      isDrawMode,
      selectedObjectId,
      transformMode,
      leftText,
      rightText
    })
  }, [isPaletteVisible, isDrawMode, selectedObjectId, transformMode, leftText, rightText])

  // Calculate background size based on text content (approximate)
  const getBackgroundSize = (text: string | null): [number, number] => {
    if (!text) return [0.1, 0.05]
    const lines = text.split('\n').length
    const maxLineLength = Math.max(...text.split('\n').map(line => line.length))
    // Width: ~0.005 per character, min 0.1, max 0.15 (chip shape - wider)
    // Height: ~0.012 per line, min 0.05, add padding
    const width = Math.max(0.1, Math.min(0.15, maxLineLength * 0.005))
    const height = Math.max(0.05, lines * 0.012 + 0.012)
    return [width, height]
  }

  const leftBgSize = getBackgroundSize(leftText)
  const rightBgSize = getBackgroundSize(rightText)

  // Create rounded rectangle shape for chip appearance
  const createChipShape = (width: number, height: number, radius: number) => {
    const shape = new THREE.Shape()
    const x = width / 2
    const y = height / 2
    
    // Create rounded rectangle path
    shape.moveTo(-x + radius, -y)
    shape.lineTo(x - radius, -y)
    shape.quadraticCurveTo(x, -y, x, -y + radius)
    shape.lineTo(x, y - radius)
    shape.quadraticCurveTo(x, y, x - radius, y)
    shape.lineTo(-x + radius, y)
    shape.quadraticCurveTo(-x, y, -x, y - radius)
    shape.lineTo(-x, -y + radius)
    shape.quadraticCurveTo(-x, -y, -x + radius, -y)
    
    return shape
  }

  // Position tooltips relative to controllers or in front of camera if controllers not available
  useFrame(() => {
    if (leftTooltipRef.current && leftText) {
      if (leftController?.object) {
        // Get controller world position
        const controllerPos = new THREE.Vector3()
        leftController.object.getWorldPosition(controllerPos)
        
        // Position tooltip above controller (offset upward and slightly forward)
        leftTooltipRef.current.position.copy(controllerPos)
        leftTooltipRef.current.position.y += 0.15  // 15cm above controller
      } else if (isInXR) {
        // Default position in front of camera when in XR but controllers not detected
        const forward = new THREE.Vector3(0, 0, -1)
        forward.applyQuaternion(camera.quaternion)
        leftTooltipRef.current.position.copy(camera.position)
        leftTooltipRef.current.position.add(forward.multiplyScalar(0.5)) // 50cm in front
        leftTooltipRef.current.position.y -= 0.2 // Slightly below eye level
      }
      
      // Make tooltip face camera (billboard effect)
      if (isInXR) {
        leftTooltipRef.current.lookAt(camera.position)
      }
    }

    if (rightTooltipRef.current && rightText) {
      if (rightController?.object) {
        const controllerPos = new THREE.Vector3()
        rightController.object.getWorldPosition(controllerPos)
        
        rightTooltipRef.current.position.copy(controllerPos)
        rightTooltipRef.current.position.y += 0.15
      } else if (isInXR) {
        // Default position in front of camera when in XR but controllers not detected
        const forward = new THREE.Vector3(0, 0, -1)
        forward.applyQuaternion(camera.quaternion)
        rightTooltipRef.current.position.copy(camera.position)
        rightTooltipRef.current.position.add(forward.multiplyScalar(0.5)) // 50cm in front
        rightTooltipRef.current.position.y -= 0.2 // Slightly below eye level
      }
      
      // Make tooltip face camera (billboard effect)
      if (isInXR) {
        rightTooltipRef.current.lookAt(camera.position)
      }
    }
  })

  return (
    <>
      {leftText && (
        <group ref={leftTooltipRef} visible={isInXR}>
          {/* Chip-shaped background */}
          <mesh position={[0, 0, -0.01]}>
            <shapeGeometry args={[createChipShape(leftBgSize[0], leftBgSize[1], 0.01)]} />
            <meshBasicMaterial color="#1a1a1a" opacity={1.0} />
          </mesh>
          <Text
            position={[0, 0, 0]}
            fontSize={0.007}
            color="white"
            anchorX="center"
            anchorY="middle"
            maxWidth={leftBgSize[0] - 0.01}
            outlineWidth={0.0003}
            outlineColor="black"
          >
            {leftText}
          </Text>
        </group>
      )}
      {rightText && (
        <group ref={rightTooltipRef} visible={isInXR}>
          {/* Chip-shaped background */}
          <mesh position={[0, 0, -0.01]}>
            <shapeGeometry args={[createChipShape(rightBgSize[0], rightBgSize[1], 0.01)]} />
            <meshBasicMaterial color="#1a1a1a" opacity={1.0} />
          </mesh>
          <Text
            position={[0, 0, 0]}
            fontSize={0.007}
            color="white"
            anchorX="center"
            anchorY="middle"
            maxWidth={rightBgSize[0] - 0.01}
            outlineWidth={0.0003}
            outlineColor="black"
          >
            {rightText}
          </Text>
        </group>
      )}
    </>
  )
}

function ModeController({ selectedObjectId, onToggleMode }: ModeControllerProps) {
  const rightController = useXRInputSourceState('controller', 'right')
  const previousAState = useRef(false)

  useFrame(() => {
    // Only allow mode toggle when object is selected
    if (!selectedObjectId) return
    if (!rightController?.gamepad) return

    // A button detection on right controller
    const aButton = rightController.gamepad['a-button']
    const isAPressed = aButton?.state === 'pressed'

    // Edge detection: trigger only on press (false → true transition)
    if (isAPressed && !previousAState.current) {
      console.log('A button pressed - toggling mode')
      onToggleMode()
    }

    previousAState.current = isAPressed
  })

  return null
}

// Preload models for better performance
useGLTF.preload('/asset/tv.glb')
useGLTF.preload('/asset/bed.glb')
useGLTF.preload('/asset/sofa.glb')
useGLTF.preload('/asset/round-table.glb')
