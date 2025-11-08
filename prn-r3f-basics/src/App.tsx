import { useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR, createXRStore, useXR, XROrigin, useXRControllerLocomotion } from '@react-three/xr'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'
import { ARHitTestManager } from './components/ARHitTestManager'
import { ObjectPalette } from './components/ObjectPalette'

// Create XR store - manages VR/AR session state
// Request hit-test, anchors, and plane-detection features for AR
const store = createXRStore({
  ar: {
    requiredFeatures: ['hit-test', 'anchors', 'plane-detection'],
  }
})

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
  useXRControllerLocomotion(originRef, {
    speed: 2.0  // Movement speed (units per second)
  })

  // Return the XROrigin component - this is the root of the player's coordinate system
  return <XROrigin ref={originRef} />
}


/**
 * Scene component contains all 3D objects and lighting
 */
function Scene() {
  // Detect XR mode to conditionally render AR or VR components
  const { mode } = useXR()

  // Feature 3 state management - Object Palette and Draw Mode
  const [isPaletteVisible, setIsPaletteVisible] = useState(false)
  const [selectedObjectType, setSelectedObjectType] = useState<'table' | 'bed' | 'sofa' | null>(null)
  const [isDrawMode, setIsDrawMode] = useState(false)

  // Feature 3 handlers
  const handleTogglePalette = () => {
    setIsPaletteVisible(prev => {
      const newVisibility = !prev
      console.log('Toggling palette from', prev, 'to', newVisibility)

      // Exit draw mode when opening palette (cleaner than delay)
      if (newVisibility) {
        setIsDrawMode(false)
        setSelectedObjectType(null)
      }

      return newVisibility
    })
  }

  const handleSelectTable = () => {
    setSelectedObjectType('table')
    setIsDrawMode(true)
    setIsPaletteVisible(false)
  }

  const handleSelectBed = () => {
    setSelectedObjectType('bed')
    setIsDrawMode(true)
    setIsPaletteVisible(false)
  }

  const handleSelectSofa = () => {
    setSelectedObjectType('sofa')
    setIsDrawMode(true)
    setIsPaletteVisible(false)
  }

  const handleExitDrawMode = () => {
    setIsDrawMode(false)
    setSelectedObjectType(null)
  }

  return (
    <>
      {/* PlayerRig must be inside XR context to access controllers */}
      <PlayerRig />

      {/* AR-specific components - only render in AR mode */}
      {mode === 'immersive-ar' && (
        <>
          <ARHitTestManager
            isDrawMode={isDrawMode}
            selectedObjectType={selectedObjectType}
          />
          <ObjectPalette
            isVisible={isPaletteVisible}
            onTogglePalette={handleTogglePalette}
            onSelectTable={handleSelectTable}
            onSelectBed={handleSelectBed}
            onSelectSofa={handleSelectSofa}
            onExitDrawMode={handleExitDrawMode}
            isDrawMode={isDrawMode}
          />
        </>
      )}

      {/* Lighting setup */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Grid helper for better spatial awareness - 50x50 grid, 1 unit cells */}
      <gridHelper args={[50, 50, 'gray', 'darkgray']} position={[0, 0.01, 0]} />

      {/* Orbit controls only active in non-XR mode (desktop viewing) */}
      <OrbitControls />
    </>
  )
}

function App() {
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

      <Canvas>
        <XR store={store}>
          <Scene />
        </XR>
      </Canvas>
    </div>
  )
}

export default App
