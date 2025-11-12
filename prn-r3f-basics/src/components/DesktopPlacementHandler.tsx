import { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

interface DesktopPlacementHandlerProps {
  selectedObjectType: 'table' | 'bed' | 'sofa' | 'round-table' | null
  isDrawMode: boolean
}

interface PlacedObject {
  id: string
  position: THREE.Vector3
  type: 'table' | 'bed' | 'sofa' | 'round-table'
}

export function DesktopPlacementHandler({ selectedObjectType, isDrawMode }: DesktopPlacementHandlerProps) {
  const { camera, raycaster, gl } = useThree()
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([])
  const mouseRef = useRef(new THREE.Vector2())
  const cursorRef = useRef<THREE.Mesh>(null)

  // Handle mouse move for cursor visualization
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDrawMode) return

    const rect = gl.domElement.getBoundingClientRect()
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
  }, [isDrawMode, gl.domElement])

  // Handle click to place objects
  const handleClick = useCallback((event: MouseEvent) => {
    if (!isDrawMode || !selectedObjectType) return

    const rect = gl.domElement.getBoundingClientRect()
    mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(mouseRef.current, camera)

    // Raycast against the ground plane (gridHelper)
    const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)
    const intersection = new THREE.Vector3()
    raycaster.ray.intersectPlane(groundPlane, intersection)

    if (intersection) {
      setPlacedObjects(prev => [...prev, {
        id: Math.random().toString(),
        position: intersection.clone(),
        type: selectedObjectType
      }])
    }
  }, [isDrawMode, selectedObjectType, gl.domElement, camera, raycaster])

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

  // Add event listeners
  useEffect(() => {
    const canvas = gl.domElement
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('click', handleClick)

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('click', handleClick)
    }
  }, [handleMouseMove, handleClick, gl.domElement])

  return (
    <>
      {/* Cursor indicator */}
      <mesh ref={cursorRef} visible={false} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.15, 0.2, 32]} />
        <meshBasicMaterial color="white" side={THREE.DoubleSide} />
      </mesh>

      {/* Placed objects */}
      {placedObjects.map((obj) => (
        <DesktopPlacedObject key={obj.id} position={obj.position} type={obj.type} />
      ))}
    </>
  )
}

interface DesktopPlacedObjectProps {
  position: THREE.Vector3
  type: 'table' | 'bed' | 'sofa' | 'round-table'
}

function DesktopPlacedObject({ position, type }: DesktopPlacedObjectProps) {
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

  // Scale factors: table 90% (10% reduction), bed 50% (50% reduction), sofa 100%, round-table 100%
  const scale = useMemo(() => {
    if (type === 'table') return 1.2
    if (type === 'bed') return 0.9
    return 1.0
  }, [type])

  // Calculate Y offset to place object base on surface
  const yOffset = useMemo(() => {
    const box = new THREE.Box3().setFromObject(clonedScene)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    return (size.y / 2 - center.y) * scale
  }, [clonedScene, scale])

  return (
    <group position={[position.x, position.y + yOffset, position.z]} scale={scale}>
      <primitive object={clonedScene} />
    </group>
  )
}

// Preload models
useGLTF.preload('/asset/table.glb')
useGLTF.preload('/asset/bed.glb')
useGLTF.preload('/asset/sofa.glb')
useGLTF.preload('/asset/round-table.glb')

