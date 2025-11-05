# React Three Fiber & WebXR Learnings

A comprehensive guide based on building a WebXR application for Meta Quest 2 with React Three Fiber.

## Table of Contents
- [Overview](#overview)
- [Core Concepts](#core-concepts)
- [WebXR with @react-three/xr](#webxr-with-react-threexr)
- [Controller Input Handling](#controller-input-handling)
- [Physics with @react-three/rapier](#physics-with-react-threerapier)
- [VR Object Interaction](#vr-object-interaction)
- [Common Issues & Solutions](#common-issues--solutions)
- [Best Practices](#best-practices)
- [Development Setup](#development-setup)

---

## Overview

**React Three Fiber (r3f)** is a React renderer for Three.js that allows you to build 3D scenes declaratively with reusable, state-reactive components.

**@react-three/xr** extends r3f to provide VR/AR capabilities through the WebXR API, making it easy to create immersive experiences for devices like Meta Quest 2.

---

## Core Concepts

### 1. Canvas Component
The `<Canvas>` component is the root of every r3f application. It sets up the Three.js renderer, scene, and camera.

```tsx
import { Canvas } from '@react-three/fiber'

function App() {
  return (
    <Canvas>
      {/* Your 3D scene goes here */}
    </Canvas>
  )
}
```

### 2. Declarative 3D Objects
Three.js objects are created declaratively using JSX:

```tsx
// Instead of:
// const geometry = new THREE.BoxGeometry()
// const material = new THREE.MeshStandardMaterial({ color: 'hotpink' })
// const mesh = new THREE.Mesh(geometry, material)

// You write:
<mesh>
  <boxGeometry />
  <meshStandardMaterial color="hotpink" />
</mesh>
```

### 3. useFrame Hook
The `useFrame` hook runs code on every frame (typically 60fps, or 90/120fps in VR):

```tsx
import { useFrame } from '@react-three/fiber'

useFrame((state, delta) => {
  // state.camera - access the camera
  // state.scene - access the scene
  // delta - time since last frame in seconds
})
```

### 4. Component Helpers from @react-three/drei
`drei` provides ready-to-use helpers:

```tsx
import { Box, OrbitControls } from '@react-three/drei'

<Box position={[0, 1.5, -2]}>
  <meshStandardMaterial color="hotpink" />
</Box>
<OrbitControls />
```

---

## WebXR with @react-three/xr

### Setup

1. **Create XR Store**
```tsx
import { createXRStore, XR } from '@react-three/xr'

const store = createXRStore()
```

2. **Wrap Scene with XR Component**
```tsx
<Canvas>
  <XR store={store}>
    <Scene />
  </XR>
</Canvas>
```

3. **Add Entry Buttons**
```tsx
<button onClick={() => store.enterVR()}>Enter VR</button>
<button onClick={() => store.enterAR()}>Enter AR</button>
```

### XROrigin Component
**Critical Concept:** In WebXR, you don't move the camera directly. Instead, you move the `XROrigin` component, which acts as the root of the player's coordinate system.

```tsx
import { XROrigin } from '@react-three/xr'

function PlayerRig() {
  const originRef = useRef<THREE.Group>(null)

  useFrame(() => {
    // Move the origin, not the camera!
    if (originRef.current) {
      originRef.current.position.x += 0.1
    }
  })

  return <XROrigin ref={originRef} />
}
```

---

## Controller Input Handling

### The Wrong Way (Low-level WebXR API)
❌ Don't use the raw WebXR API when using @react-three/xr:

```tsx
// DON'T DO THIS
const { session } = useXR()
session.inputSources.forEach(inputSource => {
  const axes = inputSource.gamepad.axes
  // This doesn't work well with @react-three/xr
})
```

### The Right Way (useXRInputSourceState)
✅ Use @react-three/xr hooks:

```tsx
import { useXRInputSourceState } from '@react-three/xr'

function PlayerRig() {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  useFrame((_, delta) => {
    // Access thumbstick via named gamepad component
    if (leftController?.gamepad) {
      const thumbstick = leftController.gamepad['xr-standard-thumbstick']
      if (thumbstick) {
        const x = thumbstick.xAxis ?? 0  // -1 to 1
        const y = thumbstick.yAxis ?? 0  // -1 to 1
        // Apply movement
      }
    }
  })
}
```

### Quest 2 Controller Mapping

**Left Controller:**
- `xr-standard-thumbstick`: Thumbstick (2D input)
  - `xAxis`: Left/right (-1 to 1)
  - `yAxis`: Forward/backward (-1 to 1)
- `xr-standard-trigger`: Index finger trigger
- `xr-standard-squeeze`: Grip button

**Right Controller:**
- Same layout as left controller
- Commonly used for rotation/turning

### Implementing Smooth Locomotion

```tsx
function PlayerRig() {
  const originRef = useRef<THREE.Group>(null)
  const playerRotation = useRef(0)

  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  useFrame((_, delta) => {
    if (!originRef.current) return

    const moveSpeed = 2.0
    const rotateSpeed = 1.5

    let moveX = 0, moveZ = 0, rotation = 0

    // Left stick: movement
    if (leftController?.gamepad) {
      const stick = leftController.gamepad['xr-standard-thumbstick']
      if (stick) {
        moveX = stick.xAxis ?? 0
        moveZ = -(stick.yAxis ?? 0) // Inverted
      }
    }

    // Right stick: rotation
    if (rightController?.gamepad) {
      const stick = rightController.gamepad['xr-standard-thumbstick']
      if (stick) {
        rotation = stick.xAxis ?? 0
      }
    }

    // Apply rotation
    if (Math.abs(rotation) > 0.1) {
      playerRotation.current -= rotation * rotateSpeed * delta
    }

    // Create rotation quaternion
    const quat = new THREE.Quaternion()
    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), playerRotation.current)

    // Apply movement in rotated direction
    if (Math.abs(moveZ) > 0.1) {
      const forward = new THREE.Vector3(0, 0, -1)
      forward.applyQuaternion(quat)
      forward.y = 0
      forward.normalize()
      originRef.current.position.addScaledVector(forward, moveZ * moveSpeed * delta)
    }

    if (Math.abs(moveX) > 0.1) {
      const right = new THREE.Vector3(1, 0, 0)
      right.applyQuaternion(quat)
      right.y = 0
      right.normalize()
      originRef.current.position.addScaledVector(right, moveX * moveSpeed * delta)
    }

    originRef.current.rotation.y = playerRotation.current
  })

  return <XROrigin ref={originRef} />
}
```

**Key Points:**
- Dead zone of 0.1 prevents thumbstick drift
- Rotation applied first, then movement follows the new orientation
- Keep movement horizontal by setting `y = 0`
- Use `addScaledVector` for frame-rate independent movement

---

## Physics with @react-three/rapier

### Setup

**Installation:**
```bash
npm install @react-three/rapier
```

**Basic Setup:**
```tsx
import { Physics, RigidBody } from '@react-three/rapier'

function Scene() {
  return (
    <Physics gravity={[0, -9.81, 0]}>
      {/* Physics-enabled objects */}
    </Physics>
  )
}
```

### Rigid Body Types

**Fixed (Static):**
- Immovable objects (walls, floors, obstacles)
- Other objects collide with them but they don't move
```tsx
<RigidBody type="fixed" position={[0, 0, 0]}>
  <Box />
</RigidBody>
```

**Dynamic:**
- Fully physics-simulated objects
- Affected by gravity, forces, and collisions
```tsx
<RigidBody type="dynamic" colliders="ball" mass={0.5} restitution={0.5}>
  <Sphere />
</RigidBody>
```

**Kinematic Position:**
- Can be moved programmatically but not affected by physics
- Other dynamic objects collide with them
- **Critical:** Velocity commands (`setLinvel`) are **ignored** in kinematic mode
```tsx
<RigidBody type="kinematicPosition">
  <Box />
</RigidBody>
```

### Common Properties

```tsx
<RigidBody
  type="dynamic"
  position={[0, 1, 0]}
  colliders="ball"        // Auto-generate collider: "ball", "cuboid", "hull"
  mass={0.5}              // Object mass in kg
  restitution={0.5}       // Bounciness (0 = no bounce, 1 = perfect bounce)
  friction={0.7}          // Surface friction
  linearDamping={0.1}     // Air resistance for linear motion
  angularDamping={0.1}    // Air resistance for rotation
>
  <mesh />
</RigidBody>
```

### Applying Forces and Velocity

```tsx
import { RapierRigidBody } from '@react-three/rapier'

const rigidBodyRef = useRef<RapierRigidBody>(null)

// Set velocity directly
rigidBodyRef.current?.setLinvel({ x: 5, y: 0, z: -2 }, true)

// Apply impulse (one-time force)
rigidBodyRef.current?.applyImpulse({ x: 0, y: 10, z: 0 }, true)

// Set position (for kinematic bodies)
rigidBodyRef.current?.setTranslation({ x: 1, y: 2, z: 3 }, true)
```

---

## VR Object Interaction

### Controller World Position

**❌ Wrong - Returns (0,0,0):**
```tsx
const controllerPos = controller.object.position.clone()
```

**✅ Correct - Returns actual world position:**
```tsx
const controllerPos = new THREE.Vector3()
controller.object.getWorldPosition(controllerPos)
```

**Why:** Controllers are children of XROrigin. `.position` gives local position relative to parent (always origin). `getWorldPosition()` accounts for the entire transform hierarchy.

### Grab Mechanics Pattern

**Basic Distance-Based Grabbing:**
```tsx
function attemptGrab(controllerPos: THREE.Vector3) {
  const GRAB_DISTANCE = 0.5
  let closestObject = null
  let closestDistance = Infinity

  for (const obj of objects) {
    const objPos = obj.rigidBodyRef.current?.translation()
    if (!objPos) continue

    const distance = controllerPos.distanceTo(
      new THREE.Vector3(objPos.x, objPos.y, objPos.z)
    )

    if (distance <= GRAB_DISTANCE && distance < closestDistance) {
      closestObject = obj
      closestDistance = distance
    }
  }

  if (closestObject) {
    // Grab the object
  }
}
```

### Kinematic vs Dynamic State Transitions

**Problem:** Applying velocity while object is kinematic doesn't work.

**Solution:** Use pending velocity pattern:

```tsx
interface GrabbableObject {
  isGrabbed: boolean
  pendingVelocity: THREE.Vector3 | null
}

// In component:
function GrabbableObject({ isGrabbed, pendingVelocity, rigidBodyRef }) {
  const wasGrabbed = useRef(false)

  useFrame(() => {
    // Apply velocity AFTER switching to dynamic mode
    if (!isGrabbed && wasGrabbed.current && pendingVelocity && rigidBodyRef.current) {
      rigidBodyRef.current.setLinvel(pendingVelocity, true)
    }
    wasGrabbed.current = isGrabbed
  })

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={isGrabbed ? 'kinematicPosition' : 'dynamic'}
    >
      {/* mesh */}
    </RigidBody>
  )
}
```

**Why this works:**
1. Object is kinematic while grabbed → velocity ignored
2. State updates → object becomes dynamic
3. Next frame → `useFrame` detects state change and applies velocity
4. Object now responds to velocity correctly

### Velocity Tracking for Throwing

**Frame-Rate Independent Tracking:**
```tsx
const velocityHistory = useRef<THREE.Vector3[]>([])
const lastFrameTime = useRef(performance.now())
const previousPosition = useRef<THREE.Vector3 | null>(null)

useFrame(() => {
  const currentTime = performance.now()
  const deltaTime = (currentTime - lastFrameTime.current) / 1000

  if (previousPosition.current && deltaTime > 0) {
    const velocity = controllerPos
      .clone()
      .sub(previousPosition.current)
      .divideScalar(deltaTime)

    velocityHistory.current.push(velocity)
    if (velocityHistory.current.length > 5) {
      velocityHistory.current.shift()
    }
  }

  previousPosition.current = controllerPos.clone()
  lastFrameTime.current = currentTime
})
```

**Calculate Throw Velocity:**
```tsx
function calculateThrowVelocity(history: THREE.Vector3[]): THREE.Vector3 {
  if (history.length === 0) return new THREE.Vector3()

  // Simple average
  const avgVelocity = new THREE.Vector3()
  for (const vel of history) {
    avgVelocity.add(vel)
  }
  avgVelocity.divideScalar(history.length)

  // Apply multiplier for better feel
  return avgVelocity.multiplyScalar(3.0)
}
```

**Key Parameters:**
- History size: 5 frames (responsive) vs 10 frames (smooth)
- Throw multiplier: Start at 3.0, adjust for feel
- Only track velocity while object is held

### Button State Detection

```tsx
const controller = useXRInputSourceState('controller', hand)
const previousButtonState = useRef(false)

useFrame(() => {
  const button = controller?.gamepad?.['xr-standard-squeeze']
  const isPressed = button?.state === 'pressed'

  // Detect button down (just pressed)
  if (isPressed && !previousButtonState.current) {
    onButtonDown()
  }

  // Detect button up (just released)
  if (!isPressed && previousButtonState.current) {
    onButtonUp()
  }

  previousButtonState.current = isPressed
})
```

**Available Buttons:**
- `'xr-standard-trigger'` - Index trigger
- `'xr-standard-squeeze'` - Grip button
- `'xr-standard-thumbstick'` - Thumbstick (has xAxis, yAxis)

---

## Common Issues & Solutions

### Issue 1: Multiple Three.js Instances

**Error:**
```
WARNING: Multiple instances of Three.js being imported
TypeError: material.onBuild is not a function
```

**Cause:** Different packages in node_modules are bundling their own versions of Three.js.

**Solution:** Add Vite's `resolve.dedupe` configuration:

```ts
// vite.config.ts
export default defineConfig({
  resolve: {
    dedupe: ['three', '@react-three/fiber']
  }
})
```

This forces all packages to use the same Three.js instance from your node_modules.

### Issue 2: WebXR Requires HTTPS

**Error:** WebXR won't work over HTTP (except on localhost)

**Solution:** Use Vite's basicSsl plugin:

```ts
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true, // Expose to network
    port: 5173
  }
})
```

### Issue 3: Camera Position Not Updating

**Problem:** Trying to move `state.camera.position` in XR doesn't work.

**Solution:** Don't move the camera in XR! Move the `XROrigin` instead. WebXR controls the camera position relative to the origin.

### Issue 4: Controller Input Not Working

**Problem:** Using `session.inputSources` directly doesn't provide reliable input.

**Solution:** Use @react-three/xr's `useXRInputSourceState` hook instead of the low-level WebXR API.

---

## Best Practices

### 1. Component Organization
```tsx
// Separate concerns into components
function Scene() {
  return (
    <>
      <PlayerRig />
      <Lighting />
      <Environment />
      <GameObjects />
    </>
  )
}
```

### 2. Use Refs for Frequently Updated Values
```tsx
// Use refs for values that change every frame
const playerRotation = useRef(0) // ✓ Won't trigger re-renders

// Don't use state for frame-rate updates
const [playerRotation, setPlayerRotation] = useState(0) // ✗ Causes re-renders
```

### 3. Lighting Setup
Always include both ambient and directional lighting:

```tsx
<ambientLight intensity={0.5} />
<directionalLight position={[10, 10, 5]} intensity={1} />
```

### 4. Ground Plane & Grid for Spatial Awareness
```tsx
<mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
  <planeGeometry args={[50, 50]} />
  <meshStandardMaterial color="lightblue" />
</mesh>
<gridHelper args={[50, 50, 'gray', 'darkgray']} position={[0, 0.01, 0]} />
```

### 5. Desktop Preview with OrbitControls
Keep OrbitControls for non-XR mode testing:

```tsx
import { OrbitControls } from '@react-three/drei'

<OrbitControls /> {/* Only active when not in XR */}
```

### 6. Physics Performance
- Limit dynamic rigid bodies (20-30 max for 90fps VR)
- Use automatic colliders when possible
- Fixed bodies are cheaper than dynamic
- Disable physics debug mode in production

### 7. Kinematic Body State Management
Never apply velocity to kinematic bodies:
```tsx
// ✗ Wrong - velocity ignored
rigidBody.setLinvel(velocity, true)  // While type="kinematicPosition"

// ✓ Correct - use pending velocity pattern
// Store velocity, switch to dynamic, then apply in useFrame
```

### 8. Controller Position Tracking
Always use `getWorldPosition()` for controllers:
```tsx
// ✗ Wrong
const pos = controller.object.position.clone()  // Returns (0,0,0)

// ✓ Correct
const pos = new THREE.Vector3()
controller.object.getWorldPosition(pos)
```

---

## Development Setup

### Required Packages
```json
{
  "dependencies": {
    "@react-three/drei": "^10.7.6",
    "@react-three/fiber": "^9.4.0",
    "@react-three/xr": "^6.6.27",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "three": "^0.181.0"
  },
  "devDependencies": {
    "@vitejs/plugin-basic-ssl": "^2.1.0",
    "@vitejs/plugin-react": "^5.0.4",
    "vite": "^7.1.7"
  }
}
```

### Vite Configuration
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Required for WebXR on Quest 2
  ],
  server: {
    host: true, // Expose to network
    port: 5173,
  },
  resolve: {
    dedupe: ['three', '@react-three/fiber'] // Fix multiple Three.js instances
  }
})
```

### Testing on Meta Quest 2

1. **Start dev server:**
   ```bash
   npm run dev
   ```

2. **Find your local IP:**
   Terminal shows: `➜  Network: https://192.168.1.3:5173/`

3. **On Quest 2:**
   - Open Browser
   - Navigate to `https://[your-ip]:5173/`
   - Accept self-signed certificate (Advanced → Proceed)
   - Click "Enter VR"

### Emulator Testing

@react-three/xr includes Meta's WebXR emulator by default:
- Works on localhost
- Press `Command/Windows + Option/Alt + E` to toggle
- Provides virtual controllers and headset
- No headset needed for development

---

## Resources

- [React Three Fiber Docs](https://docs.pmnd.rs/react-three-fiber)
- [@react-three/xr Docs](https://pmndrs.github.io/xr/docs/getting-started/introduction)
- [@react-three/xr Reintroduction (2024)](https://pmnd.rs/blog/reintroducing-react-three-xr)
- [Three.js Manual](https://threejs.org/manual/)
- [WebXR Device API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)

---

## Summary

**Key Takeaways:**

1. ✅ Use `useXRInputSourceState` for controller input, not raw WebXR API
2. ✅ Move `XROrigin`, not the camera, for VR locomotion
3. ✅ Use `getWorldPosition()` for controller tracking, not `.position`
4. ✅ Use pending velocity pattern for kinematic→dynamic transitions
5. ✅ Add `resolve.dedupe` to Vite config to avoid Three.js conflicts
6. ✅ Use HTTPS (basicSsl plugin) for WebXR on physical devices
7. ✅ Implement dead zones (0.1) for thumbstick input
8. ✅ Use refs for frequently updated values, not state
9. ✅ Keep movement horizontal by setting `y = 0` in direction vectors
10. ✅ Track velocity frame-rate independently using `performance.now()`

**Common Pattern:**
```tsx
const store = createXRStore()

function App() {
  return (
    <>
      <button onClick={() => store.enterVR()}>Enter VR</button>
      <Canvas>
        <XR store={store}>
          <Scene />
        </XR>
      </Canvas>
    </>
  )
}

function Scene() {
  return (
    <>
      <PlayerRig />
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} />
      {/* Your 3D objects */}
      <OrbitControls />
    </>
  )
}

function PlayerRig() {
  const originRef = useRef<THREE.Group>(null)
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  useFrame((_, delta) => {
    // Handle controller input
    // Move originRef.current
  })

  return <XROrigin ref={originRef} />
}
```

---

*Last Updated: November 2025*
