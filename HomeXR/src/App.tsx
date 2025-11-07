import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { XR, createXRStore, XROrigin, useXRControllerLocomotion, useXRInputSourceState } from '@react-three/xr'
import { OrbitControls, Box, useGLTF, Html } from '@react-three/drei'
import { Physics, RigidBody, RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import './App.css'

// Create XR store - manages VR/AR session state
const store = createXRStore()

// Physics and grab constants
const GRAB_DISTANCE = 0.5
const THROW_MULTIPLIER = 1.5
const VELOCITY_HISTORY_SIZE = 5

/**
 * Grab state interface for furniture items
 */
interface GrabState {
  id: string
  rigidBodyRef: React.RefObject<RapierRigidBody>
  isGrabbed: boolean
  grabbedBy: 'left' | 'right' | null
  pendingVelocity: THREE.Vector3 | null
  velocityHistory: THREE.Vector3[]
}

/**
 * Props for grabbable furniture
 */
interface GrabbableFurnitureProps {
  item: FurnitureItem
  preloadedScenes: Record<FurnitureType, THREE.Object3D | null>
  grabState: GrabState
  onGrab: (id: string, hand: 'left' | 'right') => void
  onRelease: (id: string, hand: 'left' | 'right', velocity: THREE.Vector3) => void
  onDragMove?: (id: string, position: [number, number, number]) => void
}

/**
 * PlayerRig component handles VR locomotion (movement)
 * Uses the built-in useXRControllerLocomotion hook which handles head-relative movement automatically
 */
function PlayerRig() {
  // Reference to the XROrigin group - this is what we move for locomotion
  const originRef = useRef<THREE.Group>(null)

  // Use the official hook for controller-based locomotion
  // This automatically handles:
  // - Head-relative movement (forward = where you're looking)
  // - Snap rotation with right thumbstick (comfortable for VR)
  // - Proper dead zones
  useXRControllerLocomotion(originRef)

  // Return the XROrigin component - this is the root of the player's coordinate system
  return <XROrigin ref={originRef} />
}


/**
 * Furniture types and data
 */
type FurnitureType = 'bed' | 'sofa' | 'table'

interface FurnitureItem {
  id: string
  type: FurnitureType
  position: [number, number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
}

const FURNITURE_MODELS: Record<FurnitureType, { path: string; name: string; scale: number; image: string }> = {
  bed: { path: '/asset/bed.glb', name: 'Bed', scale: 1, image: '/asset/images/bed.webp' },
  sofa: { path: '/asset/sofa.glb', name: 'Sofa', scale: 1, image: '/asset/images/sofa.webp' },
  table: { path: '/asset/table.glb', name: 'Table', scale: 1, image: '/asset/images/table.png' },
}

/**
 * FurniturePalette component - shows furniture options in a floating UI
 */
interface FurniturePaletteProps {
  onSelectFurniture: (type: FurnitureType) => void
  isOpen: boolean
  onToggle: () => void
}

function FurniturePalette({ onSelectFurniture, isOpen, onToggle }: FurniturePaletteProps) {
  return (
    <Html position={[0, 2, -2]} center>
      <div style={{
        background: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '10px',
        padding: '20px',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        minWidth: '300px',
        display: isOpen ? 'block' : 'none'
      }}>
        <h3 style={{ marginTop: 0, textAlign: 'center' }}>Furniture Palette</h3>
        <p style={{ textAlign: 'center', margin: '10px 0', fontSize: '12px', opacity: 0.8 }}>
          Click to auto-place furniture in the scene
        </p>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
          {Object.entries(FURNITURE_MODELS).map(([type, model]) => (
            <div key={type} style={{ textAlign: 'center' }}>
              <button
                onClick={() => onSelectFurniture(type as FurnitureType)}
                style={{
                  padding: '8px',
                  background: '#333',
                  border: '2px solid #555',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '5px',
                  minWidth: '80px',
                  minHeight: '80px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#555';
                  e.currentTarget.style.borderColor = '#777';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = '#333';
                  e.currentTarget.style.borderColor = '#555';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                <img
                  src={model.image}
                  alt={model.name}
                  style={{
                    width: '50px',
                    height: '50px',
                    objectFit: 'contain',
                    borderRadius: '4px'
                  }}
                />
                <span style={{
                  fontSize: '12px',
                  color: 'white',
                  fontWeight: 'bold',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.8)'
                }}>
                  {model.name}
                </span>
              </button>
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: '15px' }}>
          <button
            onClick={onToggle}
            style={{
              padding: '8px 15px',
              background: '#666',
              border: 'none',
              borderRadius: '5px',
              color: 'white',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </Html>
  )
}

/**
 * FurnitureItemWrapper component - manages grab state for individual furniture items
 */
interface FurnitureItemWrapperProps {
  item: FurnitureItem
  preloadedScenes: Record<FurnitureType, THREE.Object3D | null>
  onGrab: (id: string, hand: 'left' | 'right') => void
  onRelease: (id: string, hand: 'left' | 'right', velocity: THREE.Vector3) => void
  onDragMove: (id: string, position: [number, number, number]) => void
}

function FurnitureItemWrapper({ item, preloadedScenes, onGrab, onRelease, onDragMove }: FurnitureItemWrapperProps) {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const [isGrabbed, setIsGrabbed] = useState(false)
  const [grabbedBy, setGrabbedBy] = useState<'left' | 'right' | null>(null)
  const [velocityHistory, setVelocityHistory] = useState<THREE.Vector3[]>([])

  // Track previous position for velocity calculation
  const prevPositionRef = useRef<THREE.Vector3>(new THREE.Vector3())
  const currentPositionRef = useRef<THREE.Vector3>(new THREE.Vector3())

  // Update velocity history when grabbed using useFrame for smooth tracking
  useFrame(() => {
    if (isGrabbed && rigidBodyRef.current) {
      const rigidBody = rigidBodyRef.current
      const currentPos = rigidBody.translation()
      currentPositionRef.current.set(currentPos.x, currentPos.y, currentPos.z)

      if (!prevPositionRef.current.equals(new THREE.Vector3(0, 0, 0))) {
        const velocity = new THREE.Vector3()
          .subVectors(currentPositionRef.current, prevPositionRef.current)
          .divideScalar(1 / 60) // Assuming 60 FPS

        setVelocityHistory(prev => {
          const newHistory = [...prev, velocity]
          return newHistory.length > VELOCITY_HISTORY_SIZE ? newHistory.slice(-VELOCITY_HISTORY_SIZE) : newHistory
        })
      }

      prevPositionRef.current.copy(currentPositionRef.current)
    }
  })

  // Reset velocity history when not grabbed
  useEffect(() => {
    if (!isGrabbed) {
      prevPositionRef.current.set(0, 0, 0)
      setVelocityHistory([])
    }
  }, [isGrabbed])

  // Calculate average velocity for throwing
  const getAverageVelocity = () => {
    if (velocityHistory.length === 0) return new THREE.Vector3()
    const sum = velocityHistory.reduce((acc, vel) => acc.add(vel), new THREE.Vector3())
    return sum.divideScalar(velocityHistory.length)
  }

  // Handle grab
  const handleGrab = useCallback((hand: 'left' | 'right') => {
    setIsGrabbed(true)
    setGrabbedBy(hand)
    onGrab(item.id, hand)
  }, [item.id, onGrab])

  // Handle release
  const handleRelease = useCallback((hand: 'left' | 'right') => {
    const velocity = getAverageVelocity().multiplyScalar(THROW_MULTIPLIER)
    setIsGrabbed(false)
    setGrabbedBy(null)
    onRelease(item.id, hand, velocity)
  }, [item.id, onRelease, velocityHistory])

  const grabState: GrabState = {
    id: item.id,
    rigidBodyRef,
    isGrabbed,
    grabbedBy,
    pendingVelocity: null,
    velocityHistory
  }

  return (
    <GrabbableFurniture
      item={item}
      preloadedScenes={preloadedScenes}
      grabState={grabState}
      onGrab={handleGrab}
      onRelease={handleRelease}
      onDragMove={onDragMove}
    />
  )
}

/**
 * DragButton component - appears on top of beds for horizontal movement
 */
interface DragButtonProps {
  position: [number, number, number]
  onLongPressStart: () => void
  onLongPressEnd: () => void
  onDrag: (deltaX: number, deltaZ: number) => void
  isDragging: boolean
}

function DragButton({ position, onLongPressStart, onLongPressEnd, onDrag, isDragging }: DragButtonProps) {
  const [isPressed, setIsPressed] = useState(false)
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null)
  const [dragStartPos, setDragStartPos] = useState<{ x: number; z: number } | null>(null)

  const handleMouseDown = (event: React.MouseEvent) => {
    event.stopPropagation()
    setIsPressed(true)

    const timer = setTimeout(() => {
      onLongPressStart()
      setDragStartPos({ x: event.clientX, z: event.clientY })
    }, 500) // 500ms long press

    setLongPressTimer(timer)
  }

  const handleMouseUp = () => {
    setIsPressed(false)
    if (longPressTimer) {
      clearTimeout(longPressTimer)
      setLongPressTimer(null)
    }
    onLongPressEnd()
    setDragStartPos(null)
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (isDragging && dragStartPos) {
      const deltaX = (event.clientX - dragStartPos.x) * 0.01 // Scale down movement
      const deltaZ = (event.clientY - dragStartPos.z) * 0.01
      onDrag(deltaX, deltaZ)
      setDragStartPos({ x: event.clientX, z: event.clientY })
    }
  }

  return (
    <Html position={position} center>
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
        style={{
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          border: 'none',
          background: isDragging ? '#ff6b6b' : isPressed ? '#ffa500' : '#4CAF50',
          color: 'white',
          cursor: isDragging ? 'grabbing' : 'grab',
          fontSize: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'background 0.2s',
          userSelect: 'none'
        }}
        title="Long press and drag to move horizontally"
      >
        {isDragging ? '↔' : '⋮⋮'}
      </button>
    </Html>
  )
}

/**
 * GrabbableFurniture component - renders a furniture item that can be grabbed and moved
 */
function GrabbableFurniture({ item, preloadedScenes, grabState, onGrab, onRelease, onDragMove }: GrabbableFurnitureProps) {
  const modelRef = useRef<THREE.Group>(null)
  const scene = preloadedScenes[item.type]
  const { rigidBodyRef, isGrabbed, grabbedBy } = grabState

  // Drag state for button-based movement
  const [isDraggingWithButton, setIsDraggingWithButton] = useState(false)
  const [originalPosition, setOriginalPosition] = useState<[number, number, number]>(item.position)

  // Fallback colors for each furniture type
  const fallbackColors = {
    bed: 'blue',
    sofa: 'red',
    table: 'green'
  }

  // Handle long press start for drag button
  const handleLongPressStart = useCallback(() => {
    if (!isGrabbed) { // Only allow button drag if not grabbed by controller
      setIsDraggingWithButton(true)
      setOriginalPosition(item.position)
    }
  }, [isGrabbed, item.position])

  // Handle long press end for drag button
  const handleLongPressEnd = useCallback(() => {
    setIsDraggingWithButton(false)
  }, [])

  // Handle drag movement (horizontal only, keep Y fixed)
  const handleDrag = useCallback((deltaX: number, deltaZ: number) => {
    if (isDraggingWithButton && onDragMove) {
      const newPosition: [number, number, number] = [
        originalPosition[0] + deltaX,
        originalPosition[1], // Keep Y position fixed
        originalPosition[2] + deltaZ
      ]
      onDragMove(item.id, newPosition)
      setOriginalPosition(newPosition)
    }
  }, [isDraggingWithButton, onDragMove, item.id, originalPosition])

  return (
    <>
      <RigidBody
        ref={rigidBodyRef}
        type={isGrabbed ? "kinematicPosition" : "dynamic"}
        position={item.position}
        rotation={item.rotation}
        enabledRotations={[false, false, false]} // Prevent rotation for now
        restitution={0} // Remove all bouncing
        friction={1} // Add friction for stability
        linearDamping={0.8} // Reduce unwanted movement
        angularDamping={0.8} // Prevent unwanted rotation
        onCollisionEnter={({ other }) => {
          // Handle collision logic if needed
        }}
      >
        {scene ? (
          <primitive
            ref={modelRef}
            object={scene.clone()}
            scale={item.scale}
          />
        ) : (
          // Fallback cube if model fails to load
          <Box args={[1, 1, 1]}>
            <meshStandardMaterial color={fallbackColors[item.type]} />
          </Box>
        )}
      </RigidBody>

      {/* Drag button for all furniture - positioned on top */}
      {!isGrabbed && (
        <DragButton
          position={[item.position[0], item.position[1] + 1.5, item.position[2]]}
          onLongPressStart={handleLongPressStart}
          onLongPressEnd={handleLongPressEnd}
          onDrag={handleDrag}
          isDragging={isDraggingWithButton}
        />
      )}
    </>
  )
}



/**
 * GrabController component - handles VR controller grab mechanics
 */
interface GrabControllerProps {
  hand: 'left' | 'right'
  placedFurniture: FurnitureItem[]
  onGrab: (id: string, hand: 'left' | 'right') => void
  onRelease: (id: string, hand: 'left' | 'right', velocity: THREE.Vector3) => void
}

function GrabController({ hand, placedFurniture, onGrab, onRelease }: GrabControllerProps) {
  const controller = useXRInputSourceState('controller', hand)
  const controllerRef = useRef<THREE.Group>(null)

  // Check if grip button is pressed
  const isGripPressed = controller?.gamepad?.['xr-standard-squeeze']?.pressed || false

  // Find the closest grabbable furniture within range
  const findClosestGrabbable = () => {
    if (!controllerRef.current) return null

    const controllerPos = controllerRef.current.position
    let closestItem: FurnitureItem | null = null
    let closestDistance = GRAB_DISTANCE

    placedFurniture.forEach(item => {
      // For now, assume all furniture is grabbable and not grabbed
      // In a more complex implementation, we'd check grab states
      const furniturePos = item.position
      const distance = controllerPos.distanceTo(new THREE.Vector3(furniturePos[0], furniturePos[1], furniturePos[2]))

      if (distance < closestDistance) {
        closestItem = item
        closestDistance = distance
      }
    })

    return closestItem
  }

  // Handle grab/release logic
  useEffect(() => {
    const closest = findClosestGrabbable()

    if (isGripPressed && closest) {
      // Grab the furniture
      onGrab(closest.id, hand)
    }
  }, [isGripPressed, placedFurniture, hand, onGrab])

  return (
    <group ref={controllerRef}>
      {/* Visual indicator for controller */}
      <mesh visible={false}>
        <sphereGeometry args={[0.01]} />
        <meshBasicMaterial color="red" />
      </mesh>
    </group>
  )
}

/**
 * Scene component contains all 3D objects and lighting
 */
interface SceneProps {
  isPaletteOpen: boolean
  onTogglePalette: () => void
}

function Scene({ isPaletteOpen, onTogglePalette }: SceneProps) {
  // Furniture state
  const [placedFurniture, setPlacedFurniture] = useState<FurnitureItem[]>([])
  const furnitureIdCounter = useRef(0)

  // Preload GLTF models and extract scenes
  const preloadedScenes = useMemo(() => {
    const bedGltf = useGLTF(FURNITURE_MODELS.bed.path)
    const sofaGltf = useGLTF(FURNITURE_MODELS.sofa.path)
    const tableGltf = useGLTF(FURNITURE_MODELS.table.path)

    return {
      bed: bedGltf.scene,
      sofa: sofaGltf.scene,
      table: tableGltf.scene
    }
  }, [])



  // Furniture handlers - automatically place when selected
  const handleSelectFurniture = (type: FurnitureType) => {
    // Auto-place furniture at random positions
    const positions = [
      [2, 0.5, -3] as [number, number, number],   // Position 1
      [-2, 0.5, -3] as [number, number, number],  // Position 2
      [0, 0.5, -5] as [number, number, number],   // Position 3
      [3, 0.5, -1] as [number, number, number],   // Position 4
      [-3, 0.5, -1] as [number, number, number],  // Position 5
    ]

    // Find a position that doesn't have furniture yet
    const usedPositions = placedFurniture.map(item => item.position)
    const availablePosition = positions.find(pos =>
      !usedPositions.some(used => used[0] === pos[0] && used[2] === pos[2])
    )

    if (availablePosition) {
      const newFurniture: FurnitureItem = {
        id: `furniture-${furnitureIdCounter.current++}`,
        type,
        position: availablePosition,
        rotation: [0, 0, 0],
        scale: [FURNITURE_MODELS[type].scale, FURNITURE_MODELS[type].scale, FURNITURE_MODELS[type].scale]
      }

      setPlacedFurniture(prev => [...prev, newFurniture])
      console.log(`Auto-placed ${type} at`, availablePosition)
    } else {
      console.log(`No available positions for ${type}`)
    }
  }

  // Grab and release handlers (for logging and potential future use)
  const handleGrab = (id: string, hand: 'left' | 'right') => {
    console.log(`Grabbed furniture ${id} with ${hand} hand`)
  }

  const handleRelease = (id: string, hand: 'left' | 'right', velocity: THREE.Vector3) => {
    console.log(`Released furniture ${id} with velocity`, velocity)
  }

  // Handle drag movement for button-based dragging
  const handleDragMove = useCallback((id: string, position: [number, number, number]) => {
    setPlacedFurniture(prev =>
      prev.map(item =>
        item.id === id ? { ...item, position } : item
      )
    )
  }, [])



  return (
    <>
      {/* PlayerRig must be inside XR context to access controllers */}
      <PlayerRig />

      {/* Furniture Palette */}
      <FurniturePalette
        onSelectFurniture={handleSelectFurniture}
        isOpen={isPaletteOpen}
        onToggle={onTogglePalette}
      />

      {/* Physics world - wraps all physics-enabled objects */}
      <Physics gravity={[0, -9.81, 0]}>
        {/* Lighting setup */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {/* Ground plane - fixed rigid body */}
        <RigidBody
          type="fixed"
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0, 0]}
          restitution={0} // Remove bouncing off ground
          friction={1} // Add friction for stability
        >
          <mesh receiveShadow userData={{ isGround: true }}>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="lightblue" wireframe={false} />
          </mesh>
        </RigidBody>

        {/* Placed furniture items - now grabbable */}
        {placedFurniture.map((item) => (
          <FurnitureItemWrapper
            key={item.id}
            item={item}
            preloadedScenes={preloadedScenes}
            onGrab={handleGrab}
            onRelease={handleRelease}
            onDragMove={handleDragMove}
          />
        ))}

        {/* Grab controllers for both hands */}
        <GrabController
          hand="left"
          placedFurniture={placedFurniture}
          onGrab={handleGrab}
          onRelease={handleRelease}
        />
        <GrabController
          hand="right"
          placedFurniture={placedFurniture}
          onGrab={handleGrab}
          onRelease={handleRelease}
        />

      </Physics>

      {/* Grid helper for better spatial awareness - 50x50 grid, 1 unit cells */}
      <gridHelper args={[50, 50, 'gray', 'darkgray']} position={[0, 0.01, 0]} />

      {/* Orbit controls only active in non-XR mode (desktop viewing) */}
      <OrbitControls />
    </>
  )
}

function App() {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <button
        onClick={() => store.enterAR()}
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        Enter AR
      </button>

      <button
        onClick={() => store.enterVR()}
        style={{
          position: 'absolute',
          top: '60px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        Enter VR
      </button>

      <button
        onClick={() => setIsPaletteOpen(!isPaletteOpen)}
        style={{
          position: 'absolute',
          top: '100px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '5px'
        }}
      >
        {isPaletteOpen ? 'Close' : 'Open'} Furniture Palette
      </button>

      <Canvas>
        <XR store={store}>
          <Scene isPaletteOpen={isPaletteOpen} onTogglePalette={() => setIsPaletteOpen(!isPaletteOpen)} />
        </XR>
      </Canvas>
    </div>
  )
}

export default App
