import { useRef, useState, useEffect } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { useXRInputSourceState } from '@react-three/xr'
import * as THREE from 'three'
import { TextureLoader } from 'three'

// Temp vectors/matrix to avoid allocations in useFrame
const headPos = new THREE.Vector3()
const tmpForward = new THREE.Vector3()
const tmpFlat = new THREE.Vector3()
const panelPos = new THREE.Vector3()
const upVec = new THREE.Vector3(0, 1, 0)
const lookMatrix = new THREE.Matrix4()

/**
 * ObjectPalette - Main component for Feature 3
 * Manages palette UI, button detection, and object selection
 */

interface ObjectPaletteProps {
  isVisible: boolean
  onTogglePalette: () => void
  onSelectTable: () => void
  onSelectBed: () => void
  onSelectSofa: () => void
  onSelectRoundTable: () => void
  onExitDrawMode: () => void
  isDrawMode: boolean
}

export function ObjectPalette({
  isVisible,
  onTogglePalette,
  onSelectTable,
  onSelectBed,
  onSelectSofa,
  onSelectRoundTable,
  onExitDrawMode,
  isDrawMode
}: ObjectPaletteProps) {
  return (
    <>
      {/* Palette UI - 3D panel with table, bed, sofa, and round-table buttons */}
      <PalettePanel
        visible={isVisible}
        onSelectTable={onSelectTable}
        onSelectBed={onSelectBed}
        onSelectSofa={onSelectSofa}
        onSelectRoundTable={onSelectRoundTable}
      />

      {/* Button input controller - Y to toggle palette, X to exit draw mode */}
      <PaletteController
        onTogglePalette={onTogglePalette}
        onExitDrawMode={onExitDrawMode}
        isDrawMode={isDrawMode}
      />
    </>
  )
}

/**
 * PalettePanel - 3D UI panel with object selection buttons
 * Positioned in front of user when visible
 */
interface PalettePanelProps {
  visible: boolean
  onSelectTable: () => void
  onSelectBed: () => void
  onSelectSofa: () => void
  onSelectRoundTable: () => void
}

function PalettePanel({ visible, onSelectTable, onSelectBed, onSelectSofa, onSelectRoundTable }: PalettePanelProps) {
  const groupRef = useRef<THREE.Group>(null)
  const positioned = useRef(false)
  const [tableHovered, setTableHovered] = useState(false)
  const [bedHovered, setBedHovered] = useState(false)
  const [sofaHovered, setSofaHovered] = useState(false)
  const [roundTableHovered, setRoundTableHovered] = useState(false)

  // Load images
  const tableTexture = useLoader(TextureLoader, '/asset/images/table.png')
  const bedTexture = useLoader(TextureLoader, '/asset/images/bed.png')
  const sofaTexture = useLoader(TextureLoader, '/asset/images/sofa.png')
  const roundTableTexture = useLoader(TextureLoader, '/asset/images/round-table.png')

  // Debug visualization refs
  // const debugGroupRef = useRef<THREE.Group>(null)

  // Reset positioned flag when palette is hidden
  useEffect(() => {
    if (!visible) {
      positioned.current = false
      // Clear debug visualizations
      // if (debugGroupRef.current) {
      //   debugGroupRef.current.clear()
      // }
      // console.log('Resetting position flag - palette hidden (useEffect)')
    }
  }, [visible])

  useFrame((state) => {
    const panel = groupRef.current
    if (!panel || !visible) return

    // Position ONCE when visible becomes true, then keep it anchored
    if (visible && !positioned.current) {
      const camera = state.camera

      // Get head position from matrixWorld
      const position = headPos.setFromMatrixPosition(camera.matrixWorld)
      // console.log('Head position:', position.toArray())

      // Extract forward direction directly from matrixWorld (fixes WebXR bug with getWorldDirection)
      // Column 2 is the Z-axis (forward), negate because Three.js cameras look down -Z
      const forward = tmpForward.setFromMatrixColumn(camera.matrixWorld, 2).negate()
      // console.log('Forward (from matrixWorld):', forward.toArray())

      // Project forward onto horizontal plane so palette stays in front even when looking up/down
      const forwardFlat = tmpFlat.set(forward.x, 0, forward.z)
      // console.log('Forward flat (before guard):', forwardFlat.toArray(), 'lengthSq:', forwardFlat.lengthSq())

      // Guard against zero-vector when looking straight up/down
      if (forwardFlat.lengthSq() < 1e-4) {
        // console.log('Zero-vector detected, using fallback')
        forwardFlat.set(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y))
      }
      forwardFlat.normalize()
      // console.log('Forward flat (normalized):', forwardFlat.toArray())

      // Place palette 1m in front, slightly below eye level for comfort
      const target = panelPos.copy(position).addScaledVector(forwardFlat, 1.0)
      target.y = position.y - 0.15
      // console.log('Target position:', target.toArray())

      panel.position.copy(target)

      // Make panel face the head (not mimic head rotation)
      lookMatrix.lookAt(target, position, upVec)          // Make panel face the head
      panel.quaternion.setFromRotationMatrix(lookMatrix)  // Panel's +Z now points toward the head
      panel.rotateY(Math.PI)                              // Flip so the front face looks at the user

      // Create debug visualizations - arrows from camera position
      // if (debugGroupRef.current) {
      //   // Clear previous debug lines
      //   debugGroupRef.current.clear()

      //   // Use camera position as origin for arrows (not world origin)
      //   const origin = position.clone()

      //   // 1. Forward direction - YELLOW arrow from head
      //   const arrow1 = new THREE.ArrowHelper(forward.clone().normalize(), origin, 1.5, 0xffff00, 0.2, 0.1)
      //   debugGroupRef.current.add(arrow1)

      //   // 2. Forward flat (projected) - GREEN arrow from head
      //   const arrow2 = new THREE.ArrowHelper(forwardFlat.clone().normalize(), origin, 1.5, 0x00ff00, 0.2, 0.1)
      //   debugGroupRef.current.add(arrow2)

      //   // 3. Target position - RED sphere where palette will be placed
      //   const targetMarker = new THREE.Mesh(
      //     new THREE.SphereGeometry(0.1),
      //     new THREE.MeshBasicMaterial({ color: 0xff0000 })
      //   )
      //   targetMarker.position.copy(target)
      //   debugGroupRef.current.add(targetMarker)

      //   console.log('Debug: Head position:', position.toArray())
      //   console.log('Debug: Forward:', forward.toArray())
      //   console.log('Debug: Forward flat:', forwardFlat.toArray())
      //   console.log('Debug: Target position:', target.toArray())
      // }

      // console.log('Palette positioned!')
      positioned.current = true
    }
  })

  return (
    <>
      {/* Debug visualization group - shows rays from origin */}
      {/* <group ref={debugGroupRef} /> */}

      {/* Palette UI - hide with visible prop instead of returning null to ensure cleanup */}
      <group ref={groupRef} visible={visible}>
        {/* Panel background - using BasicMaterial so it's visible without lighting */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[2.0, 0.6]} />
          <meshBasicMaterial color="#666666" opacity={0.95} transparent />
        </mesh>

        {/* Table button - left side */}
        <mesh
          position={[-0.4, 0, 0.01]}
          onClick={() => {
            // console.log('Table selected!')
            onSelectTable()
          }}
          onPointerOver={() => setTableHovered(true)}
          onPointerOut={() => setTableHovered(false)}
        >
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial 
            map={tableTexture} 
            transparent 
            opacity={tableHovered ? 1.0 : 0.8}
          />
        </mesh>
        {/* Table label background */}
        <mesh position={[-0.4, -0.2, 0.01]}>
          <planeGeometry args={[0.3, 0.1]} />
          <meshBasicMaterial color={tableHovered ? '#ffff00' : '#888888'} opacity={0.9} transparent />
        </mesh>

        {/* Bed button - center */}
        <mesh
          position={[0, 0, 0.01]}
          onClick={() => {
            // console.log('Bed selected!')
            onSelectBed()
          }}
          onPointerOver={() => setBedHovered(true)}
          onPointerOut={() => setBedHovered(false)}
        >
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial 
            map={bedTexture} 
            transparent 
            opacity={bedHovered ? 1.0 : 0.8}
          />
        </mesh>
        {/* Bed label background */}
        <mesh position={[0, -0.2, 0.01]}>
          <planeGeometry args={[0.3, 0.1]} />
          <meshBasicMaterial color={bedHovered ? '#ffff00' : '#888888'} opacity={0.9} transparent />
        </mesh>

        {/* Sofa button - right side */}
        <mesh
          position={[0.4, 0, 0.01]}
          onClick={() => {
            // console.log('Sofa selected!')
            onSelectSofa()
          }}
          onPointerOver={() => setSofaHovered(true)}
          onPointerOut={() => setSofaHovered(false)}
        >
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial 
            map={sofaTexture} 
            transparent 
            opacity={sofaHovered ? 1.0 : 0.8}
          />
        </mesh>
        {/* Sofa label background */}
        <mesh position={[0.4, -0.2, 0.01]}>
          <planeGeometry args={[0.3, 0.1]} />
          <meshBasicMaterial color={sofaHovered ? '#ffff00' : '#888888'} opacity={0.9} transparent />
        </mesh>

        {/* Round Table button - far right side */}
        <mesh
          position={[0.8, 0, 0.01]}
          onClick={() => {
            // console.log('Round Table selected!')
            onSelectRoundTable()
          }}
          onPointerOver={() => setRoundTableHovered(true)}
          onPointerOut={() => setRoundTableHovered(false)}
        >
          <planeGeometry args={[0.3, 0.3]} />
          <meshBasicMaterial 
            map={roundTableTexture} 
            transparent 
            opacity={roundTableHovered ? 1.0 : 0.8}
          />
        </mesh>
        {/* Round Table label background */}
        <mesh position={[0.8, -0.2, 0.01]}>
          <planeGeometry args={[0.3, 0.1]} />
          <meshBasicMaterial color={roundTableHovered ? '#ffff00' : '#888888'} opacity={0.9} transparent />
        </mesh>
      </group>
    </>
  )
}

/**
 * PaletteController - Handles Y and X button input detection
 * Y button: Toggle palette visibility
 * X button: Exit draw mode
 */
interface PaletteControllerProps {
  onTogglePalette: () => void
  onExitDrawMode: () => void
  isDrawMode: boolean
}

function PaletteController({ onTogglePalette, onExitDrawMode, isDrawMode }: PaletteControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const previousYState = useRef(false)
  const previousXState = useRef(false)

  useFrame(() => {
    if (!leftController?.gamepad) return

    // Y button detection for palette toggle
    const yButton = leftController.gamepad['y-button']
    const isYPressed = yButton?.state === 'pressed'

    // Edge detection: trigger only on press (false → true transition)
    if (isYPressed && !previousYState.current) {
      // console.log('Y button pressed - toggling palette')
      onTogglePalette()
    }
    previousYState.current = isYPressed

    // X button detection for exiting draw mode (only active in draw mode)
    if (isDrawMode) {
      const xButton = leftController.gamepad['x-button']
      const isXPressed = xButton?.state === 'pressed'

      // Edge detection: trigger only on press (false → true transition)
      if (isXPressed && !previousXState.current) {
        // console.log('X button pressed - exiting draw mode')
        onExitDrawMode()
      }
      previousXState.current = isXPressed
    } else {
      // Reset X button state when not in draw mode
      previousXState.current = false
    }
  })

  return null
}
