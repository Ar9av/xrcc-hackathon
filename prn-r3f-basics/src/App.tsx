import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { XR, createXRStore, useXRInputSourceState, XROrigin } from '@react-three/xr'
import { OrbitControls, Box } from '@react-three/drei'
import * as THREE from 'three'
import './App.css'

// Create XR store - manages VR/AR session state
const store = createXRStore()

/**
 * PlayerRig component handles VR locomotion (movement)
 * This moves the XROrigin based on controller input
 *
 * Uses the proper @react-three/xr API for controller input
 */
function PlayerRig() {
  // Reference to the XROrigin group - this is what we move for locomotion
  const originRef = useRef<THREE.Group>(null)

  // Store the player's Y-axis rotation (turning left/right)
  const playerRotation = useRef(0)

  // Get controller states using @react-three/xr hooks
  // These provide proper access to the gamepad data
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  // useFrame runs every frame (60fps typically)
  useFrame((_, delta) => {
    if (!originRef.current) return

    // Movement and rotation speeds
    const moveSpeed = 2.0 // units per second
    const rotateSpeed = 1.5 // radians per second

    // Initialize movement values
    let moveX = 0 // left/right strafe
    let moveZ = 0 // forward/backward
    let rotation = 0 // turning

    /**
     * Quest 2 Controller Layout:
     * - Left thumbstick: Movement (forward/back/strafe)
     * - Right thumbstick: Rotation (smooth turning)
     */

    // Get left controller thumbstick for movement
    if (leftController?.gamepad) {
      const leftThumbstick = leftController.gamepad['xr-standard-thumbstick']
      if (leftThumbstick) {
        moveX = leftThumbstick.xAxis ?? 0 // Strafe left/right
        moveZ = -(leftThumbstick.yAxis ?? 0) // Forward/backward (inverted)
      }
    }

    // Get right controller thumbstick for rotation
    if (rightController?.gamepad) {
      const rightThumbstick = rightController.gamepad['xr-standard-thumbstick']
      if (rightThumbstick) {
        rotation = rightThumbstick.xAxis ?? 0 // Turn left/right
      }
    }

    // Apply rotation first (so movement is in the new direction)
    if (Math.abs(rotation) > 0.1) { // Dead zone to avoid drift
      playerRotation.current -= rotation * rotateSpeed * delta
    }

    // Create a quaternion from our Y-axis rotation
    const playerQuaternion = new THREE.Quaternion()
    playerQuaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), playerRotation.current)

    // Apply forward/backward movement
    if (Math.abs(moveZ) > 0.1) { // Dead zone
      const direction = new THREE.Vector3(0, 0, -1) // Forward is -Z
      direction.applyQuaternion(playerQuaternion)
      direction.y = 0 // Keep horizontal
      direction.normalize()

      originRef.current.position.addScaledVector(
        direction,
        moveZ * moveSpeed * delta
      )
    }

    // Apply left/right strafing
    if (Math.abs(moveX) > 0.1) { // Dead zone
      const rightDirection = new THREE.Vector3(1, 0, 0) // Right is +X
      rightDirection.applyQuaternion(playerQuaternion)
      rightDirection.y = 0
      rightDirection.normalize()

      originRef.current.position.addScaledVector(
        rightDirection,
        moveX * moveSpeed * delta
      )
    }

    // Apply rotation to the XROrigin
    originRef.current.rotation.y = playerRotation.current
  })

  // Return the XROrigin component - this is the root of the player's coordinate system
  return <XROrigin ref={originRef} />
}

/**
 * Scene component contains all 3D objects and lighting
 */
function Scene() {
  return (
    <>
      {/* PlayerRig must be inside XR context to access controllers */}
      <PlayerRig />

      {/* Lighting setup */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Pink box - positioned at eye level, 2 units away */}
      <Box position={[0, 1.5, -2]}>
        <meshStandardMaterial color="hotpink" />
      </Box>

      {/* Additional boxes to show movement */}
      <Box position={[3, 1.5, -2]}>
        <meshStandardMaterial color="cyan" />
      </Box>

      <Box position={[-3, 1.5, -2]}>
        <meshStandardMaterial color="yellow" />
      </Box>

      <Box position={[0, 1.5, -5]}>
        <meshStandardMaterial color="lime" />
      </Box>

      {/* Large ground plane - 50x50 units with grid pattern */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="lightblue" wireframe={false} />
      </mesh>

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
