import React, { useEffect, useRef, useState, useMemo } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

// Feature 4.2: Debug flag for rotation visualization
// Set to false to hide debug axes and improve performance
const ENABLE_ROTATION_DEBUG = false

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

// Feature 4.2: Transform mode type
type TransformMode = 'rotate' | 'scale' | 'move'

function PlacementHandler({ hitResult, xrRefSpace, isDrawMode, selectedObjectType, onExitDrawMode }: PlacementHandlerProps) {
  const { session } = useXR()
  const [anchoredObjects, setAnchoredObjects] = useState<Array<{
    id: string
    anchor: XRAnchor
    type: 'table' | 'bed' | 'sofa' | 'round-table'
    rotation: number  // Feature 4.2: Rotation angle in radians around plane normal
    scale: number  // Feature 4.2: Scale multiplier (0.75 to 1.25, default 1.0 = 100%)
  }>>([])

  // Feature 4.1: Selection state
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const objectClickedRef = useRef(false)

  // Feature 4.2: Transform mode state (default is rotate)
  const [transformMode, setTransformMode] = useState<TransformMode>('rotate')

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
            scale: 1.0  // Feature 4.2: Initialize scale to 1.0 (100%)
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
      {anchoredObjects.map(({ id, anchor, type, rotation, scale }) => {
        const isSelected = selectedObjectId === id
        return (
          <React.Fragment key={id}>
            <SelectableObject
              id={id}
              anchor={anchor}
              xrRefSpace={xrRefSpace}
              type={type}
              rotation={rotation}
              scale={scale}
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
                anchor={anchor}
                xrRefSpace={xrRefSpace}
                scale={scale}
                baseScale={type === 'table' ? 0.9 : type === 'bed' ? 0.25 : 1.0}
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

      {/* Feature 4.2: Rotation, scale, and mode controllers */}
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
      <ModeController
        selectedObjectId={selectedObjectId}
        onToggleMode={handleToggleMode}
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
 * Feature 4.2: Supports rotation around plane normal and scaling
 */
interface SelectableObjectProps {
  id: string
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
  type: 'table' | 'bed' | 'sofa' | 'round-table'
  rotation: number  // Feature 4.2: Rotation angle in radians
  scale: number  // Feature 4.2: Scale multiplier (0.75 to 1.25)
  isSelected: boolean
  transformMode: TransformMode  // Feature 4.2: Current transform mode
  onSelect: (id: string) => void
}

function SelectableObject({ id, anchor, xrRefSpace, type, rotation, scale, isSelected, transformMode, onSelect }: SelectableObjectProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { session } = useXR()

  // Debug: Arrow to visualize object's anchor position (DISABLED)
  // const objectAnchorArrow = useMemo(() => new THREE.ArrowHelper(
  //   new THREE.Vector3(0, 1, 0),
  //   new THREE.Vector3(0, 0, 0),
  //   1.0,  // 1m long
  //   0x00ff00,  // Green color
  //   0.15,
  //   0.08
  // ), [])

  // Debug: Arrow to visualize object's local origin (DISABLED)
  // const objectOriginArrow = useMemo(() => new THREE.ArrowHelper(
  //   new THREE.Vector3(0, 1, 0),
  //   new THREE.Vector3(0, 0, 0),
  //   0.8,  // 0.8m long
  //   0xff0000,  // Red color
  //   0.12,
  //   0.06
  // ), [])

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

  // Base scale factors: table 90% (10% reduction), bed 20% (80% reduction), sofa 100%, round-table 100%
  const baseScale = useMemo(() => {
    if (type === 'table') return 0.9
    if (type === 'bed') return 0.25
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

    // Debug: Update object's anchor position arrow (green) - DISABLED
    // objectAnchorArrow.position.copy(anchorPos)
    // objectAnchorArrow.setDirection(planeNormal.normalize())

    // Position object at anchor point + offset along plane normal
    const finalPos = anchorPos.clone().add(planeNormal.clone().multiplyScalar(yOffset * finalScale))

    // Debug: Update object's local origin arrow (red) - DISABLED
    // objectOriginArrow.position.copy(finalPos)
    // objectOriginArrow.setDirection(planeNormal.normalize())

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
    <>
      {/* Debug: Green arrow at anchor position, Red arrow at object origin - DISABLED */}
      {/* {isSelected && (
        <>
          <primitive object={objectAnchorArrow} />
          <primitive object={objectOriginArrow} />
        </>
      )} */}

      <group ref={groupRef} matrixAutoUpdate={false} onClick={handleClick}>
        <group scale={finalScale}>
          <primitive object={clonedScene} />
        </group>

        {/* Feature 4.2: Mode-specific visual feedback (rotate/move only, scale is rendered outside) */}
        {isSelected && (
          <ModificationVisuals
            mode={transformMode}
            objectRef={groupRef}
            anchor={anchor}
            xrRefSpace={xrRefSpace}
          />
        )}
      </group>
    </>
  )
}

/**
 * ModificationVisuals - Container for mode-specific visual feedback
 *
 * Feature 4.2: Shows different visuals based on active transform mode
 * - Rotate mode: Yellow ring around object
 * - Scale mode: Slider rendered at PlacementHandler level (outside this hierarchy)
 * - Move mode: Placeholder (red axes - to be implemented)
 */
interface ModificationVisualsProps {
  mode: TransformMode
  objectRef: React.RefObject<THREE.Group | null>
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
}

function ModificationVisuals({ mode, objectRef, anchor, xrRefSpace }: ModificationVisualsProps) {
  return (
    <>
      {mode === 'rotate' && (
        <RotateRing objectRef={objectRef} anchor={anchor} xrRefSpace={xrRefSpace} />
      )}
      {mode === 'move' && (
        // Placeholder for Feature 4.2.3
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="red" />
        </mesh>
      )}
    </>
  )
}

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
 * Feature 4.2: Shows a cone + torus slider above the selected object
 * - Cone: 1m tall, 0.1m radius (20cm diameter), light green, tip pointing down
 * - Torus: Dynamic sizing based on scale, dark green, moves along cone
 * - Positioned perpendicular to placement plane with fixed 50cm clearance
 * - Oriented parallel to global Y-axis (always vertical)
 * - Torus starts at middle of cone (represents 100% scale)
 * - Rendered outside object hierarchy to avoid transform inheritance
 */
interface ScaleSliderProps {
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
  scale: number  // User scale multiplier (0.75 to 1.25)
  baseScale: number  // Asset-specific base scale
}

function ScaleSlider({ anchor, xrRefSpace, scale, baseScale }: ScaleSliderProps) {
  const sliderGroupRef = useRef<THREE.Group>(null)
  const { session } = useXR()

  // Debug: Arrow to visualize anchor normal - DISABLED
  // const anchorNormalArrow = useMemo(() => new THREE.ArrowHelper(
  //   new THREE.Vector3(0, 1, 0),
  //   new THREE.Vector3(0, 0, 0),
  //   1.5,  // 1.5m long for visibility
  //   0xff00ff,  // Magenta color
  //   0.2,
  //   0.1
  // ), [])

  // Approximate object heights (unscaled) based on asset type
  // These are rough estimates - ideally would be calculated from actual models
  const unscaledHeight = 0.5  // Default estimate for positioning

  // Calculate torus parameters from scale
  const { torusRadius, torusYPosition } = useMemo(() => {
    // Map scale (0.75 to 1.25) to distance from tip (0 to 1m)
    const distanceFromTip = (scale - 0.75) / 0.5 * 1.0

    // Inner diameter formula: distanceFromTip * (cone_diameter / cone_height)
    // cone_diameter = 0.2m (20cm), cone_height = 1.0m
    const innerDiameter = distanceFromTip * (0.2 / 1.0)
    const innerRadius = innerDiameter / 2

    // Minimum radius to avoid degenerate geometry
    const radius = Math.max(0.01, innerRadius)

    // Position on cone (tip at +0.5m, base at -0.5m due to geometric center)
    const yPos = 0.5 - distanceFromTip

    return { torusRadius: radius, torusYPosition: yPos }
  }, [scale])

  // Update slider position each frame
  useFrame((state) => {
    if (!session || !xrRefSpace || !sliderGroupRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame?.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Extract anchor position and plane normal
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorPos = new THREE.Vector3()
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(anchorPos, anchorQuat, new THREE.Vector3())

    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Debug: Update anchor normal arrow - DISABLED
    // anchorNormalArrow.position.copy(anchorPos)
    // anchorNormalArrow.setDirection(planeNormal.normalize())

    // Calculate scaled height (unscaled height * base scale * user scale)
    const scaledHeight = unscaledHeight * baseScale * scale

    // Position slider: anchor + (scaledHeight + clearance) * normal
    const clearance = 0.5  // 50cm above object
    const sliderPos = anchorPos.clone()
      .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))

    sliderGroupRef.current.position.copy(sliderPos)

    // Set orientation to global Y (identity quaternion = global axes)
    sliderGroupRef.current.quaternion.set(0, 0, 0, 1)
  })

  return (
    <>
      {/* Debug: Magenta arrow showing anchor position and plane normal - DISABLED */}
      {/* <primitive object={anchorNormalArrow} /> */}

      <group ref={sliderGroupRef}>
        {/* Cone: 1m tall, 0.1m radius, tip pointing down */}
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.1, 1.0, 16]} />
          <meshBasicMaterial color="#90EE90" side={THREE.DoubleSide} />
        </mesh>

        {/* Torus: dynamic size and position */}
        <mesh position={[0, torusYPosition, 0]}>
          <torusGeometry args={[torusRadius, 0.1, 16, 32]} />
          <meshBasicMaterial color="#006400" />
        </mesh>
      </group>
    </>
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
 * Feature 4.2: Smooth scaling control using controller thumbsticks
 * - Only active when object is selected and in scale mode
 * - Either left or right thumbstick Y-axis controls scaling
 * - If both thumbsticks active, uses the one with larger magnitude
 * - Forward (positive Y) increases size, backward (negative Y) decreases size
 * - Scaling speed: 12.5% per second (4 seconds for full range 75% to 125%)
 * - Dead zone: 0.1 to prevent drift
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
    // Only scale when object selected and in scale mode
    if (!selectedObjectId || transformMode !== 'scale') return

    const leftThumbstick = leftController?.gamepad?.['xr-standard-thumbstick']
    const rightThumbstick = rightController?.gamepad?.['xr-standard-thumbstick']

    const leftY = leftThumbstick?.yAxis ?? 0
    const rightY = rightThumbstick?.yAxis ?? 0

    const DEAD_ZONE = 0.1
    const leftActive = Math.abs(leftY) > DEAD_ZONE
    const rightActive = Math.abs(rightY) > DEAD_ZONE

    // Determine scaling input: use strongest thumbstick if both active
    let scaleInput = 0
    if (leftActive && rightActive) {
      scaleInput = Math.abs(leftY) > Math.abs(rightY) ? leftY : rightY
    } else if (leftActive) {
      scaleInput = leftY
    } else if (rightActive) {
      scaleInput = rightY
    }

    // Apply scaling
    if (scaleInput !== 0) {
      // Speed: 12.5% per second = 0.125 scale units per second
      const scaleSpeed = 0.125
      // Invert the sign so forward (positive yAxis) increases size
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
useGLTF.preload('/asset/table.glb')
useGLTF.preload('/asset/bed.glb')
useGLTF.preload('/asset/sofa.glb')
useGLTF.preload('/asset/round-table.glb')
