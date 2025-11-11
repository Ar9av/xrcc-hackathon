import { useState, useRef, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { XR, createXRStore, useXR, XROrigin } from '@react-three/xr'
// Commented out: Player locomotion disabled to allow thumbsticks for object rotation only
// import { useXRControllerLocomotion } from '@react-three/xr'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'
import { ARHitTestManager } from './components/ARHitTestManager'
import { ObjectPalette } from './components/ObjectPalette'
import { DesktopFurnitureMenu } from './components/DesktopFurnitureMenu'
import { DesktopPlacementHandler } from './components/DesktopPlacementHandler'
import LandingPage from './components/LandingPage'

// Create XR store - manages VR/AR session state
// Request hit-test, anchors, and plane-detection features for AR
const store = createXRStore({
  ar: {
    requiredFeatures: ['hit-test', 'anchors', 'plane-detection'],
  }
} as any)

/**
 * PlayerRig component handles VR locomotion (movement)
 * Uses the built-in useXRControllerLocomotion hook which handles head-relative movement automatically
 *
 * COMMENTED OUT: Player locomotion disabled to allow thumbsticks to control object rotation only
 */
function PlayerRig() {
  // Reference to the XROrigin group - this is what we move for locomotion
  const originRef = useRef<THREE.Group>(null)

  // COMMENTED OUT: Disable player movement so thumbsticks only control object rotation
  // Use the official hook for controller-based locomotion
  // This automatically handles:
  // - Head-relative movement (forward = where you're looking)
  // - Snap rotation with right thumbstick (comfortable for VR)
  // - Proper dead zones
  // useXRControllerLocomotion(originRef, {
  //   speed: 2.0  // Movement speed (units per second)
  // })

  // Return the XROrigin component - this is the root of the player's coordinate system
  return <XROrigin ref={originRef} />
}


interface SceneProps {
  selectedObjectType: 'table' | 'bed' | 'sofa' | 'round-table' | null
  isDrawMode: boolean
  isPaletteVisible: boolean
  onSelectTable: () => void
  onSelectBed: () => void
  onSelectSofa: () => void
  onSelectRoundTable: () => void
  onTogglePalette: () => void
  onExitDrawMode: () => void
}

/**
 * ARModeDetector - Component to detect AR mode and notify parent
 */
function ARModeDetector({ onModeChange }: { onModeChange: (isAR: boolean) => void }) {
  const { mode } = useXR()
  
  useEffect(() => {
    onModeChange(mode === 'immersive-ar')
  }, [mode, onModeChange])
  
  return null
}

/**
 * Scene component contains all 3D objects and lighting
 */
function Scene({
  selectedObjectType,
  isDrawMode,
  isPaletteVisible,
  onSelectTable,
  onSelectBed,
  onSelectSofa,
  onSelectRoundTable,
  onTogglePalette,
  onExitDrawMode
}: SceneProps) {
  // Detect XR mode to conditionally render AR or VR components
  const { mode } = useXR()

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
            onExitDrawMode={onExitDrawMode}
          />
          <ObjectPalette
            isVisible={isPaletteVisible}
            onTogglePalette={onTogglePalette}
            onSelectTable={onSelectTable}
            onSelectBed={onSelectBed}
            onSelectSofa={onSelectSofa}
            onSelectRoundTable={onSelectRoundTable}
            onExitDrawMode={onExitDrawMode}
            isDrawMode={isDrawMode}
          />
        </>
      )}

      {/* Desktop-specific components - only render in non-AR mode */}
      {mode !== 'immersive-ar' && (
        <DesktopPlacementHandler
          selectedObjectType={selectedObjectType}
          isDrawMode={isDrawMode}
        />
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
  // Landing page state
  const [showLandingPage, setShowLandingPage] = useState(true)

  // Feature 3 state management - Object Palette and Draw Mode
  // Shared between AR and desktop modes
  const [isPaletteVisible, setIsPaletteVisible] = useState(false)
  const [selectedObjectType, setSelectedObjectType] = useState<'table' | 'bed' | 'sofa' | 'round-table' | null>(null)
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

  const handleSelectRoundTable = () => {
    setSelectedObjectType('round-table')
    setIsDrawMode(true)
    setIsPaletteVisible(false)
  }

  const handleExitDrawMode = () => {
    setIsDrawMode(false)
    setSelectedObjectType(null)
  }

  // Check if we're in AR mode to conditionally show desktop menu
  const [isARMode, setIsARMode] = useState(false)
  const handleModeChange = useCallback((isAR: boolean) => {
    setIsARMode(isAR)
  }, [])

  const handleEnterAR = () => {
    setShowLandingPage(false)
    // Small delay to ensure landing page is hidden before entering AR
    setTimeout(() => {
      store.enterAR()
    }, 100)
  }

  // Show landing page
  if (showLandingPage) {
    return <LandingPage onEnterAR={handleEnterAR} />
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Back to landing page button */}
      <button
        onClick={() => setShowLandingPage(true)}
        style={{
          position: 'absolute',
          top: '20px',
          left: '20px',
          zIndex: 1000,
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          background: 'rgba(10, 10, 10, 0.8)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)'
        }}
      >
        ← Back to Home
      </button>

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
          cursor: 'pointer',
          background: 'rgba(10, 10, 10, 0.8)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)'
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
          cursor: 'pointer',
          background: 'rgba(10, 10, 10, 0.8)',
          color: 'white',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '8px',
          backdropFilter: 'blur(10px)'
        }}
      >
        Enter VR
      </button>

      {/* Desktop furniture menu - only show when not in AR mode */}
      {!isARMode && (
        <DesktopFurnitureMenu
          onSelectTable={handleSelectTable}
          onSelectBed={handleSelectBed}
          onSelectSofa={handleSelectSofa}
          onSelectRoundTable={handleSelectRoundTable}
          onCancelSelection={handleExitDrawMode}
          selectedObjectType={selectedObjectType}
        />
      )}

      <Canvas>
        <XR store={store}>
          <ARModeDetector onModeChange={handleModeChange} />
          <Scene
            selectedObjectType={selectedObjectType}
            isDrawMode={isDrawMode}
            isPaletteVisible={isPaletteVisible}
            onSelectTable={handleSelectTable}
            onSelectBed={handleSelectBed}
            onSelectSofa={handleSelectSofa}
            onSelectRoundTable={handleSelectRoundTable}
            onTogglePalette={handleTogglePalette}
            onExitDrawMode={handleExitDrawMode}
          />
        </XR>
      </Canvas>
    </div>
  )
}

export default App
