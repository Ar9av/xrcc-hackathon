import { useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { XR, createXRStore, useXRInputSourceState, XROrigin, useXRControllerLocomotion } from '@react-three/xr'
import { OrbitControls, Box, Sphere } from '@react-three/drei'
import { Physics, RigidBody, RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'
import './App.css'

// Create XR store - manages VR/AR session state
const store = createXRStore()

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
    translation: {
      speed: 2.0  // Movement speed (units per second)
    },
    rotation: {
      type: 'snap',    // Snap turning (like Meta default) - more comfortable
      degrees: 45,     // Rotate 45 degrees per snap
      deadZone: 0.1    // Thumbstick dead zone to prevent drift
    },
    translationController: 'left'  // Left controller thumbstick for movement
  })

  // Return the XROrigin component - this is the root of the player's coordinate system
  return <XROrigin ref={originRef} />
}

/**
 * Tunable physics parameters
 */
const BALL_RADIUS = 0.15
const BALL_RESTITUTION = 0.5 // Bounciness
const BALL_FRICTION = 0.7
const BALL_MASS = 0.5
const GRAB_DISTANCE = 0.5  // Increased for easier grabbing
const VELOCITY_HISTORY_SIZE = 5  // Fewer frames for more responsive throws
const THROW_MULTIPLIER = 3.0  // Higher multiplier for better throw feel

/**
 * GrabbableBall component - a physics ball that can be picked up and thrown
 */
interface GrabbableBallProps {
  position: [number, number, number]
  id: string
  isGrabbed: boolean
  grabbedBy: 'left' | 'right' | null
  rigidBodyRef: React.RefObject<RapierRigidBody | null>
  pendingVelocity: THREE.Vector3 | null
}

function GrabbableBall({ position, isGrabbed, rigidBodyRef, pendingVelocity }: GrabbableBallProps) {
  const wasGrabbed = useRef(false)
  const velocityApplied = useRef(false)

  useFrame(() => {
    // Apply pending velocity after ball switches to dynamic mode
    if (!isGrabbed && wasGrabbed.current && pendingVelocity && rigidBodyRef.current && !velocityApplied.current) {
      console.log('Applying pending velocity after mode switch:', pendingVelocity, 'magnitude:', pendingVelocity.length())
      rigidBodyRef.current.setLinvel(pendingVelocity, true)
      velocityApplied.current = true
    }

    // Reset flag when grabbed again
    if (isGrabbed && !wasGrabbed.current) {
      velocityApplied.current = false
    }

    wasGrabbed.current = isGrabbed
  })

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={isGrabbed ? 'kinematicPosition' : 'dynamic'}
      position={position}
      colliders="ball"
      restitution={BALL_RESTITUTION}
      friction={BALL_FRICTION}
      mass={BALL_MASS}
    >
      <Sphere args={[BALL_RADIUS]}>
        <meshStandardMaterial color={isGrabbed ? "yellow" : "orange"} />
      </Sphere>
    </RigidBody>
  )
}

/**
 * GrabController - handles grip button input and grab/throw mechanics for one hand
 */
interface BallData {
  id: string
  rigidBodyRef: React.RefObject<RapierRigidBody | null>
  isGrabbed: boolean
  grabbedBy: 'left' | 'right' | null
  pendingVelocity: THREE.Vector3 | null
}

interface GrabControllerProps {
  hand: 'left' | 'right'
  balls: BallData[]
  onGrab: (ballId: string, hand: 'left' | 'right') => void
  onRelease: (ballId: string, velocity: THREE.Vector3) => void
}

function GrabController({ hand, balls, onGrab, onRelease }: GrabControllerProps) {
  const controller = useXRInputSourceState('controller', hand)
  const velocityHistory = useRef<THREE.Vector3[]>([])
  const previousGripState = useRef(false)
  const previousPosition = useRef<THREE.Vector3 | null>(null)
  const lastFrameTime = useRef<number>(performance.now())

  useFrame(() => {
    if (!controller?.gamepad || !controller.object) return

    const squeeze = controller.gamepad['xr-standard-squeeze']
    const isGripPressed = squeeze?.state === 'pressed'

    // Get world position of controller
    const controllerPos = new THREE.Vector3()
    controller.object.getWorldPosition(controllerPos)

    // Track controller velocity with frame-rate independent calculation
    const currentTime = performance.now()
    const deltaTime = (currentTime - lastFrameTime.current) / 1000 // Convert to seconds

    if (previousPosition.current && deltaTime > 0 && isGripPressed) {
      const velocity = controllerPos.clone().sub(previousPosition.current).divideScalar(deltaTime)
      velocityHistory.current.push(velocity)
      if (velocityHistory.current.length > VELOCITY_HISTORY_SIZE) {
        velocityHistory.current.shift()
      }

      // Log occasionally to avoid spam
      if (velocityHistory.current.length % 10 === 0) {
        console.log(`[${hand}] Tracking velocity:`, velocity.length().toFixed(3), 'history:', velocityHistory.current.length)
      }
    }

    previousPosition.current = controllerPos.clone()
    lastFrameTime.current = currentTime

    // Grip just pressed - attempt grab
    if (isGripPressed && !previousGripState.current) {
      attemptGrab(controllerPos, hand)
    }

    // Grip just released - throw
    if (!isGripPressed && previousGripState.current) {
      releaseGrab(hand)
    }

    // Update held ball position
    if (isGripPressed) {
      updateHeldBall(controllerPos, hand)
    }

    previousGripState.current = isGripPressed
  })

  const attemptGrab = (controllerPos: THREE.Vector3, hand: 'left' | 'right') => {
    // Find closest ball within grab distance
    let closestBallId: string | null = null
    let closestDistance = Infinity

    for (const ball of balls) {
      if (ball.isGrabbed) continue

      const ballBody = ball.rigidBodyRef.current
      if (!ballBody) continue

      const ballPos = ballBody.translation()
      const distance = controllerPos.distanceTo(new THREE.Vector3(ballPos.x, ballPos.y, ballPos.z))

      if (distance <= GRAB_DISTANCE && distance < closestDistance) {
        closestBallId = ball.id
        closestDistance = distance
      }
    }

    if (closestBallId !== null) {
      onGrab(closestBallId, hand)
      velocityHistory.current = []
    }
  }

  const releaseGrab = (hand: 'left' | 'right') => {
    const ball = balls.find(b => b.grabbedBy === hand && b.isGrabbed)
    if (!ball) return

    // Calculate throw velocity
    const throwVelocity = calculateThrowVelocity(velocityHistory.current)

    console.log(`[${hand}] Releasing ball with velocity:`, {
      historyLength: velocityHistory.current.length,
      velocity: throwVelocity,
      magnitude: throwVelocity.length()
    })

    onRelease(ball.id, throwVelocity)
    velocityHistory.current = []
  }

  const updateHeldBall = (controllerPos: THREE.Vector3, hand: 'left' | 'right') => {
    const ball = balls.find(b => b.grabbedBy === hand && b.isGrabbed)
    if (!ball || !ball.rigidBodyRef.current) return

    // Move ball to controller position
    ball.rigidBodyRef.current.setTranslation(controllerPos, true)
  }

  const calculateThrowVelocity = (velocityHistory: THREE.Vector3[]): THREE.Vector3 => {
    if (velocityHistory.length === 0) return new THREE.Vector3()

    // Use simple average of recent velocities for more responsive throws
    const avgVelocity = new THREE.Vector3()
    for (const vel of velocityHistory) {
      avgVelocity.add(vel)
    }
    avgVelocity.divideScalar(velocityHistory.length)

    return avgVelocity.multiplyScalar(THROW_MULTIPLIER)
  }

  return null
}

/**
 * Scene component contains all 3D objects and lighting
 */
function Scene() {
  // Create refs for each ball
  const ball1Ref = useRef<RapierRigidBody | null>(null)
  const ball2Ref = useRef<RapierRigidBody | null>(null)
  const ball3Ref = useRef<RapierRigidBody | null>(null)

  const ballRefs: Record<string, React.RefObject<RapierRigidBody | null>> = {
    'ball-1': ball1Ref,
    'ball-2': ball2Ref,
    'ball-3': ball3Ref,
  }

  // Ball state management - positioned closer and at waist height for easier grabbing
  const [balls, setBalls] = useState([
    {
      id: 'ball-1',
      position: [0.5, 1.0, -1.5] as [number, number, number],  // Right side, waist height, close
      isGrabbed: false,
      grabbedBy: null as 'left' | 'right' | null,
      pendingVelocity: null as THREE.Vector3 | null,
    },
    {
      id: 'ball-2',
      position: [-0.5, 1.0, -1.5] as [number, number, number],  // Left side, waist height, close
      isGrabbed: false,
      grabbedBy: null as 'left' | 'right' | null,
      pendingVelocity: null as THREE.Vector3 | null,
    },
    {
      id: 'ball-3',
      position: [0, 1.2, -1.0] as [number, number, number],  // Center, chest height, very close
      isGrabbed: false,
      grabbedBy: null as 'left' | 'right' | null,
      pendingVelocity: null as THREE.Vector3 | null,
    },
  ])

  const handleGrab = (ballId: string, hand: 'left' | 'right') => {
    setBalls(prevBalls =>
      prevBalls.map(ball =>
        ball.id === ballId
          ? { ...ball, isGrabbed: true, grabbedBy: hand, pendingVelocity: null }
          : ball
      )
    )
  }

  const handleRelease = (ballId: string, velocity: THREE.Vector3) => {
    console.log(`handleRelease called for ${ballId}`, {
      velocity: velocity,
      magnitude: velocity.length()
    })

    // Store velocity to be applied after ball switches to dynamic mode
    setBalls(prevBalls => {
      const updatedBalls = prevBalls.map(ball => {
        if (ball.id === ballId) {
          return {
            ...ball,
            isGrabbed: false,
            grabbedBy: null,
            pendingVelocity: velocity.clone()  // Clone to prevent mutation
          }
        }
        return ball
      })
      return updatedBalls
    })
  }

  // Prepare ball data for controllers
  const ballsForControllers: BallData[] = balls.map(ball => ({
    ...ball,
    rigidBodyRef: ballRefs[ball.id]
  }))

  return (
    <>
      {/* PlayerRig must be inside XR context to access controllers */}
      <PlayerRig />

      {/* Physics world - wraps all physics-enabled objects */}
      <Physics gravity={[0, -9.81, 0]}>
        {/* Lighting setup */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {/* Fixed cubes - static rigid bodies that balls will collide with */}
        <RigidBody type="fixed" position={[0, 1.5, -2]}>
          <Box>
            <meshStandardMaterial color="hotpink" />
          </Box>
        </RigidBody>

        <RigidBody type="fixed" position={[3, 1.5, -2]}>
          <Box>
            <meshStandardMaterial color="cyan" />
          </Box>
        </RigidBody>

        <RigidBody type="fixed" position={[-3, 1.5, -2]}>
          <Box>
            <meshStandardMaterial color="yellow" />
          </Box>
        </RigidBody>

        <RigidBody type="fixed" position={[0, 1.5, -5]}>
          <Box>
            <meshStandardMaterial color="lime" />
          </Box>
        </RigidBody>

        {/* Ground plane - fixed rigid body */}
        <RigidBody type="fixed" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <mesh receiveShadow>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="lightblue" wireframe={false} />
          </mesh>
        </RigidBody>

        {/* Grabbable balls */}
        {balls.map((ball) => (
          <GrabbableBall
            key={ball.id}
            id={ball.id}
            position={ball.position}
            isGrabbed={ball.isGrabbed}
            grabbedBy={ball.grabbedBy}
            rigidBodyRef={ballRefs[ball.id]}
            pendingVelocity={ball.pendingVelocity}
          />
        ))}

        {/* Grab controllers for both hands */}
        <GrabController
          hand="left"
          balls={ballsForControllers}
          onGrab={handleGrab}
          onRelease={handleRelease}
        />
        <GrabController
          hand="right"
          balls={ballsForControllers}
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
