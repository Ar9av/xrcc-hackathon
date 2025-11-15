import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, Html } from '@react-three/drei'
import * as THREE from 'three'

interface DesktopPlacementHandlerProps {
  selectedObjectType: 'tv' | 'bed' | 'sofa' | 'round-table' | null
  isDrawMode: boolean
}

type TransformMode = 'rotate' | 'scale' | 'move'

interface PlacedObject {
  id: string
  position: THREE.Vector3
  type: 'tv' | 'bed' | 'sofa' | 'round-table'
  rotation: number  // Rotation angle in radians around Y-axis
  scale: number  // Scale multiplier (0.75 to 1.25, default 1.0)
  movementOffset: THREE.Vector3  // Movement offset from original position
}

export function DesktopPlacementHandler({ selectedObjectType, isDrawMode }: DesktopPlacementHandlerProps) {
  const { camera, raycaster, gl } = useThree()
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([])
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [transformMode, setTransformMode] = useState<TransformMode>('rotate')
  const mouseRef = useRef(new THREE.Vector2())
  const cursorRef = useRef<THREE.Mesh>(null)
  const objectClickedRef = useRef(false)
  
  // Store refs to object groups for raycasting
  const objectRefsMap = useRef<Map<string, React.RefObject<THREE.Group | null>>>(new Map())
  
  // For move mode - track initial mouse position and object position
  const moveStartRef = useRef<{ mousePos: THREE.Vector2, objectPos: THREE.Vector3 } | null>(null)
  const isDraggingRef = useRef(false)
  
  // For rotate mode - track initial angle and mouse position
  const rotateStartRef = useRef<{ initialRotation: number, initialAngle: number } | null>(null)
  const isRotatingRef = useRef(false)
  
  // For scale mode - track initial scale and mouse position
  const scaleStartRef = useRef<{ initialScale: number, initialMouseY: number } | null>(null)
  const isScalingRef = useRef(false)

  // Handle mouse move for cursor visualization
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDrawMode) return

    const rect = gl.domElement.getBoundingClientRect()
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }, [isDrawMode, gl.domElement])

  // Handle click to place objects or select objects
  const handleClick = useCallback((event: MouseEvent) => {
    const rect = gl.domElement.getBoundingClientRect()
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouseRef.current, camera)

    // First check if we clicked on an object
    const objectMeshes: THREE.Object3D[] = []
    placedObjects.forEach(obj => {
      const objRef = objectRefsMap.current.get(obj.id)
      if (objRef?.current) {
        // Collect all meshes from the object group
        objRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            objectMeshes.push(child)
          }
        })
      }
    })

    if (objectMeshes.length > 0) {
      const intersects = raycaster.intersectObjects(objectMeshes, true)
      if (intersects.length > 0 && !isDrawMode) {
        // Find which object was clicked
        const clickedMesh = intersects[0].object
        let clickedObjectId: string | null = null
        objectRefsMap.current.forEach((ref, id) => {
          if (ref.current && ref.current.getObjectById(clickedMesh.id)) {
            clickedObjectId = id
          }
        })
        // Also check by traversing up the tree
        if (!clickedObjectId) {
          let parent = clickedMesh.parent
          while (parent) {
            objectRefsMap.current.forEach((ref, id) => {
              if (ref.current === parent) {
                clickedObjectId = id
              }
            })
            if (clickedObjectId) break
            parent = parent.parent
          }
        }
        if (clickedObjectId) {
          objectClickedRef.current = true
          setSelectedObjectId(clickedObjectId)
          return
        }
      }
    }

    // Handle deselection (clicked empty space)
    if (!objectClickedRef.current && selectedObjectId && !isDrawMode) {
      setSelectedObjectId(null)
      objectClickedRef.current = false
      return
    }

    // Reset flag
    objectClickedRef.current = false

    // Place new object if in draw mode
    if (!isDrawMode || !selectedObjectType) return

    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const intersection = new THREE.Vector3()
    raycaster.ray.intersectPlane(groundPlane, intersection)

    if (intersection) {
      const newId = Math.random().toString()
      // Create ref for new object
      objectRefsMap.current.set(newId, React.createRef<THREE.Group>())
      setPlacedObjects(prev => [...prev, {
        id: newId,
        position: intersection.clone(),
        type: selectedObjectType,
        rotation: 0,
        scale: 1.0,
        movementOffset: new THREE.Vector3(0, 0, 0)
      }])
    }
  }, [isDrawMode, selectedObjectType, gl.domElement, camera, raycaster, placedObjects, selectedObjectId])

  // Update cursor position
  useFrame(() => {
    if (!isDrawMode || !cursorRef.current) {
      if (cursorRef.current) cursorRef.current.visible = false
      return
    }

    raycaster.setFromCamera(mouseRef.current, camera)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const intersection = new THREE.Vector3()
    raycaster.ray.intersectPlane(groundPlane, intersection)

    if (intersection) {
      cursorRef.current.visible = true
      cursorRef.current.position.copy(intersection)
    } else {
      cursorRef.current.visible = false
    }
  })

  // Handle mouse down for move mode, rotate mode, and scale mode
  const handleMouseDown = useCallback((event: MouseEvent) => {
    if (!selectedObjectId || isDrawMode) return

    const rect = gl.domElement.getBoundingClientRect()
    const mousePos = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    )

    const selectedObj = placedObjects.find(obj => obj.id === selectedObjectId)
    if (!selectedObj) return

    if (transformMode === 'move') {
      moveStartRef.current = {
        mousePos: mousePos.clone(),
        objectPos: selectedObj.position.clone().add(selectedObj.movementOffset)
      }
      isDraggingRef.current = true
    } else if (transformMode === 'rotate') {
      // Check if clicking on rotate dial
      raycaster.setFromCamera(mousePos, camera)
      // We'll check for intersection in useFrame
      const worldPos = new THREE.Vector3()
      const objRef = objectRefsMap.current.get(selectedObjectId)
      if (objRef?.current) {
        objRef.current.getWorldPosition(worldPos)
        const toMouse = new THREE.Vector3()
        raycaster.ray.at(1, toMouse)
        const dir = toMouse.clone().sub(worldPos)
        dir.y = 0 // Project to horizontal plane
        dir.normalize()
        const angle = Math.atan2(dir.x, dir.z)
        rotateStartRef.current = {
          initialRotation: selectedObj.rotation,
          initialAngle: angle
        }
        isRotatingRef.current = true
      }
    } else if (transformMode === 'scale') {
      // Check if clicking on scale slider torus
      raycaster.setFromCamera(mousePos, camera)
      // We'll check for torus intersection - for now, allow any click in scale mode
      // The torus click handler will prevent propagation if clicked directly
      scaleStartRef.current = {
        initialScale: selectedObj.scale,
        initialMouseY: event.clientY
      }
      isScalingRef.current = true
    }
  }, [selectedObjectId, transformMode, isDrawMode, gl.domElement, placedObjects, camera, raycaster])

  // Handle mouse up for all modes
  const handleMouseUp = useCallback(() => {
    isDraggingRef.current = false
    moveStartRef.current = null
    isRotatingRef.current = false
    rotateStartRef.current = null
    isScalingRef.current = false
    scaleStartRef.current = null
  }, [])

  // Handle wheel for rotate and scale (as alternative to dragging)
  const handleWheel = useCallback((event: WheelEvent) => {
    if (!selectedObjectId || isDrawMode || isRotatingRef.current || isScalingRef.current) return
    event.preventDefault()

    const delta = event.deltaY * 0.001

    if (transformMode === 'rotate') {
      setPlacedObjects(prev => prev.map(obj => {
        if (obj.id === selectedObjectId) {
          return { ...obj, rotation: obj.rotation + delta }
        }
        return obj
      }))
    } else if (transformMode === 'scale') {
      setPlacedObjects(prev => prev.map(obj => {
        if (obj.id === selectedObjectId) {
          const newScale = Math.max(0.75, Math.min(1.25, obj.scale + delta))
          return { ...obj, scale: newScale }
        }
        return obj
      }))
    }
  }, [selectedObjectId, transformMode, isDrawMode])
  
  // Handle mouse move for scale mode dragging
  const handleMouseMoveForScale = useCallback((event: MouseEvent) => {
    if (isScalingRef.current && scaleStartRef.current && selectedObjectId) {
      const deltaY = (scaleStartRef.current.initialMouseY - event.clientY) * 0.002 // Invert so dragging up increases scale
      const newScale = Math.max(0.75, Math.min(1.25, scaleStartRef.current.initialScale + deltaY))
      setPlacedObjects(prev => prev.map(obj => {
        if (obj.id === selectedObjectId) {
          return { ...obj, scale: newScale }
        }
        return obj
      }))
    }
  }, [selectedObjectId])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Delete key
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedObjectId) {
          setPlacedObjects(prev => prev.filter(obj => obj.id !== selectedObjectId))
          setSelectedObjectId(null)
        }
      }
      // Mode switching: R for rotate, S for scale, M for move
      else if ((event.key === 'r' || event.key === 'R') && !event.ctrlKey && !event.metaKey) {
        setTransformMode('rotate')
      } else if ((event.key === 's' || event.key === 'S') && !event.ctrlKey && !event.metaKey) {
        setTransformMode('scale')
      } else if ((event.key === 'm' || event.key === 'M') && !event.ctrlKey && !event.metaKey) {
        setTransformMode('move')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedObjectId])

  // Handle mouse move for move mode, rotate mode, and scale mode dragging
  useFrame(() => {
    // Move mode
    if (isDraggingRef.current && moveStartRef.current && selectedObjectId) {
      raycaster.setFromCamera(mouseRef.current, camera)
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
      const intersection = new THREE.Vector3()
      raycaster.ray.intersectPlane(groundPlane, intersection)

      if (intersection) {
        const selectedObj = placedObjects.find(obj => obj.id === selectedObjectId)
        if (selectedObj) {
          const deltaMovement = intersection.clone().sub(moveStartRef.current.objectPos)
          setPlacedObjects(prev => prev.map(obj => {
            if (obj.id === selectedObjectId) {
              return { ...obj, movementOffset: deltaMovement }
            }
            return obj
          }))
        }
      }
    }
    
    // Rotate mode
    if (isRotatingRef.current && rotateStartRef.current && selectedObjectId) {
      const selectedObj = placedObjects.find(obj => obj.id === selectedObjectId)
      if (selectedObj) {
        raycaster.setFromCamera(mouseRef.current, camera)
        const worldPos = new THREE.Vector3()
        const objRef = objectRefsMap.current.get(selectedObjectId)
        if (objRef?.current) {
          objRef.current.getWorldPosition(worldPos)
          const toMouse = new THREE.Vector3()
          raycaster.ray.at(1, toMouse)
          const dir = toMouse.clone().sub(worldPos)
          dir.y = 0 // Project to horizontal plane
          dir.normalize()
          const currentAngle = Math.atan2(dir.x, dir.z)
          const deltaAngle = currentAngle - rotateStartRef.current.initialAngle
          const newRotation = rotateStartRef.current.initialRotation + deltaAngle
          setPlacedObjects(prev => prev.map(obj => {
            if (obj.id === selectedObjectId) {
              return { ...obj, rotation: newRotation }
            }
            return obj
          }))
        }
      }
    }
  })

  // Add event listeners
  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mousemove', handleMouseMoveForScale)
    canvas.addEventListener('click', handleClick)
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mousemove', handleMouseMoveForScale)
      canvas.removeEventListener('click', handleClick)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [handleMouseMove, handleMouseMoveForScale, handleClick, handleMouseDown, handleMouseUp, handleWheel, gl.domElement])

  return (
    <>
      {/* Cursor indicator */}
      <mesh ref={cursorRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.2, 32]} />
        <meshBasicMaterial color="white" side={THREE.DoubleSide} />
      </mesh>

      {/* Transform Controls UI Panel - rendered as fixed overlay */}
      {selectedObjectId && (
        <Html
          position={[0, 0, 0]}
          center
          style={{
            pointerEvents: 'none',
            userSelect: 'none'
          }}
          transform={false}
        >
          <div style={{
            position: 'fixed',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: '8px',
            background: 'rgba(40, 40, 40, 0.95)',
            padding: '12px 16px',
            borderRadius: '8px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
            pointerEvents: 'auto'
          }}>
            <button
              onClick={() => setTransformMode('rotate')}
              style={{
                padding: '8px 16px',
                background: transformMode === 'rotate' ? 'rgba(74, 144, 226, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                border: transformMode === 'rotate' ? '1px solid #4a90e2' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: transformMode === 'rotate' ? '600' : '400'
              }}
              title="Rotate (R key)"
            >
              Rotate (R)
            </button>
            <button
              onClick={() => setTransformMode('scale')}
              style={{
                padding: '8px 16px',
                background: transformMode === 'scale' ? 'rgba(74, 144, 226, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                border: transformMode === 'scale' ? '1px solid #4a90e2' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: transformMode === 'scale' ? '600' : '400'
              }}
              title="Scale/Resize (S key)"
            >
              Resize (S)
            </button>
            <button
              onClick={() => setTransformMode('move')}
              style={{
                padding: '8px 16px',
                background: transformMode === 'move' ? 'rgba(74, 144, 226, 0.3)' : 'rgba(255, 255, 255, 0.1)',
                border: transformMode === 'move' ? '1px solid #4a90e2' : '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: transformMode === 'move' ? '600' : '400'
              }}
              title="Move (M key)"
            >
              Move (M)
            </button>
            <button
              onClick={() => {
                if (selectedObjectId) {
                  setPlacedObjects(prev => prev.filter(obj => obj.id !== selectedObjectId))
                  setSelectedObjectId(null)
                }
              }}
              style={{
                padding: '8px 16px',
                background: 'rgba(220, 38, 38, 0.2)',
                border: '1px solid rgba(220, 38, 38, 0.4)',
                borderRadius: '6px',
                color: '#ffffff',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              title="Delete (Delete/Backspace key)"
            >
              Delete
            </button>
          </div>
        </Html>
      )}

      {/* Placed objects */}
      {placedObjects.map((obj) => {
        // Get or create ref for this object
        if (!objectRefsMap.current.has(obj.id)) {
          objectRefsMap.current.set(obj.id, React.createRef<THREE.Group>())
        }
        const objectRef = objectRefsMap.current.get(obj.id)!

        return (
          <DesktopPlacedObject
            key={obj.id}
            ref={objectRef}
            id={obj.id}
            position={obj.position}
            type={obj.type}
            rotation={obj.rotation}
            scale={obj.scale}
            movementOffset={obj.movementOffset}
            isSelected={selectedObjectId === obj.id}
            transformMode={transformMode}
            onSelect={(id) => {
              objectClickedRef.current = true
              setSelectedObjectId(id)
            }}
          />
        )
      })}
    </>
  )
}

// RotateDial component - interactive rotation control (defined before use)
interface RotateDialProps {
  objectRef: React.RefObject<THREE.Group | null>
  rotation: number
  onRotate?: (newRotation: number) => void
}

function RotateDial({ objectRef, rotation }: RotateDialProps) {
  const ringRadius = useMemo(() => {
    if (!objectRef.current) return 0.5
    const bbox = new THREE.Box3().setFromObject(objectRef.current)
    const size = bbox.getSize(new THREE.Vector3())
    const diagonal = size.length()
    return (diagonal / 2) + 0.15
  }, [objectRef])

  // Calculate handle position based on rotation
  const handlePosition = useMemo(() => {
    const x = Math.sin(rotation) * ringRadius
    const z = Math.cos(rotation) * ringRadius
    return new THREE.Vector3(x, 0.1, z) // Slightly above the ring
  }, [rotation, ringRadius])

  return (
    <group>
      {/* Ring */}
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[ringRadius * 0.925, ringRadius, 32]} />
        <meshBasicMaterial color="yellow" side={THREE.DoubleSide} />
      </mesh>
      {/* Handle/knob on the ring */}
      <mesh position={handlePosition} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 0.1, 16]} />
        <meshBasicMaterial color="#ffaa00" />
      </mesh>
      {/* Center dot */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.1, 16]} />
        <meshBasicMaterial color="yellow" />
      </mesh>
    </group>
  )
}

interface DesktopPlacedObjectProps {
  id: string
  position: THREE.Vector3
  type: 'tv' | 'bed' | 'sofa' | 'round-table'
  rotation: number
  scale: number
  movementOffset: THREE.Vector3
  isSelected: boolean
  transformMode: TransformMode
  onSelect: (id: string) => void
}

const DesktopPlacedObject = React.forwardRef<THREE.Group, DesktopPlacedObjectProps>(
  function DesktopPlacedObject({
    id,
    position,
    type,
    rotation,
    scale,
    movementOffset,
    isSelected,
    transformMode,
    onSelect
  }, ref) {
    const groupRef = (ref as React.RefObject<THREE.Group>) || useRef<THREE.Group>(null)
  const modelPath = type === 'round-table' ? '/asset/round-table.glb' : `/asset/${type}.glb`
  const { scene } = useGLTF(modelPath)
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

  // Base scale factors
  const baseScale = useMemo(() => {
    if (type === 'tv') return 1.2
    if (type === 'bed') return 0.9
    return 1.0
  }, [type])

  // Combined scale = base scale * user scale
  const finalScale = baseScale * scale

  // Calculate Y offset to place object base on surface
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    return (size.y / 2 - center.y) * finalScale
  }, [clonedScene, finalScale])

  // Handle click for selection
  const handleClick = (event: any) => {
    event.stopPropagation()
    onSelect(id)
  }

  // Calculate final position with movement offset
  const finalPosition = useMemo(() => {
    return position.clone()
      .add(movementOffset)
      .add(new THREE.Vector3(0, yOffset, 0))
  }, [position, movementOffset, yOffset])

  // Calculate rotation quaternion
  const rotationQuat = useMemo(() => {
    return new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
  }, [rotation])

  return (
    <group
      ref={groupRef}
      position={finalPosition}
      quaternion={rotationQuat}
      scale={finalScale}
      onClick={handleClick}
    >
      <primitive object={clonedScene} />

      {/* Rotate dial visual */}
      {isSelected && transformMode === 'rotate' && (
        <RotateDial
          objectRef={groupRef}
          rotation={rotation}
        />
      )}

      {/* Move axes visual */}
      {isSelected && transformMode === 'move' && (
        <MoveAxes type={type} scale={scale} />
      )}

      {/* Scale slider visual */}
      {isSelected && transformMode === 'scale' && (
        <ScaleSlider
          type={type}
          scale={scale}
          baseScale={baseScale}
          finalPosition={finalPosition}
          objectId={id}
        />
      )}
    </group>
  )
})


// MoveAxes component
interface MoveAxesProps {
  type: 'tv' | 'bed' | 'sofa' | 'round-table'
  scale: number
}

function MoveAxes({ type, scale }: MoveAxesProps) {
  const modelPath = type === 'round-table' ? '/asset/round-table.glb' : `/asset/${type}.glb`
  const { scene } = useGLTF(modelPath)

  const unscaledHeight = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    return box.getSize(new THREE.Vector3()).y
  }, [scene])

  const yPosition = useMemo(() => {
    const scaledHeight = unscaledHeight * scale
    return scaledHeight + 0.3
  }, [unscaledHeight, scale])

  const axesLength = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.z)
    return ((maxDim / 2) + 0.2) / 2
  }, [scene])

  const xPosArrow = useMemo(() =>
    new THREE.ArrowHelper(new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), axesLength, 0xff0000, 0.1, 0.05),
    [axesLength]
  )
  const xNegArrow = useMemo(() =>
    new THREE.ArrowHelper(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 0, 0), axesLength, 0xff0000, 0.1, 0.05),
    [axesLength]
  )
  const zPosArrow = useMemo(() =>
    new THREE.ArrowHelper(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), axesLength, 0xff0000, 0.1, 0.05),
    [axesLength]
  )
  const zNegArrow = useMemo(() =>
    new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), axesLength, 0xff0000, 0.1, 0.05),
    [axesLength]
  )

  return (
    <group position={[0, yPosition, 0]}>
      <primitive object={xPosArrow} />
      <primitive object={xNegArrow} />
      <primitive object={zPosArrow} />
      <primitive object={zNegArrow} />
    </group>
  )
}

// ScaleSlider component - interactive scale control
interface ScaleSliderProps {
  type: 'tv' | 'bed' | 'sofa' | 'round-table'
  scale: number
  baseScale: number
  finalPosition: THREE.Vector3
  objectId?: string
}

function ScaleSlider({ type, scale, baseScale, finalPosition }: ScaleSliderProps) {
  const torusRef = useRef<THREE.Mesh>(null)
  const modelPath = type === 'round-table' ? '/asset/round-table.glb' : `/asset/${type}.glb`
  const { scene } = useGLTF(modelPath)

  const unscaledHeight = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    return box.getSize(new THREE.Vector3()).y
  }, [scene])

  const { torusRadius, torusYPosition } = useMemo(() => {
    const distanceFromTip = (scale - 0.75) / 0.5 * 1.0
    const coneDiameter = 0.2
    const coneHeight = 1.0
    const innerDiameter = distanceFromTip * (coneDiameter / coneHeight)
    const innerRadius = innerDiameter / 2
    const tubeRadius = 0.05
    const radius = Math.max(0.01, innerRadius + tubeRadius)
    const yPos = distanceFromTip - 0.5
    return { torusRadius: radius, torusYPosition: yPos }
  }, [scale])

  const sliderPosition = useMemo(() => {
    const scaledHeight = unscaledHeight * baseScale * scale
    const clearance = 0.5
    return finalPosition.clone().add(new THREE.Vector3(0, scaledHeight + clearance, 0))
  }, [unscaledHeight, baseScale, scale, finalPosition])

  // Handle click on torus to start dragging
  const handleTorusClick = (event: any) => {
    event.stopPropagation()
    // The drag will be handled by the parent's mouse handlers
  }

  return (
    <group position={sliderPosition}>
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.1, 1.0, 16]} />
        <meshBasicMaterial color="#90EE90" side={THREE.DoubleSide} />
      </mesh>
      <mesh
        ref={torusRef}
        position={[0, torusYPosition, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        onClick={handleTorusClick}
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
      >
        <torusGeometry args={[torusRadius, 0.05, 16, 32]} />
        <meshBasicMaterial color="#006400" />
      </mesh>
    </group>
  )
}

// Preload models
useGLTF.preload('/asset/tv.glb')
useGLTF.preload('/asset/bed.glb')
useGLTF.preload('/asset/sofa.glb')
useGLTF.preload('/asset/round-table.glb')

