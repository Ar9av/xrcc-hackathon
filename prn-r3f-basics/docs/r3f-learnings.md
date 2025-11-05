# React Three Fiber & WebXR Reference

React Three Fiber (r3f) renders Three.js declaratively. @react-three/xr adds WebXR support.

## Core Concepts

Canvas: Root component, sets up renderer/scene/camera.
```tsx
<Canvas>{/* scene */}</Canvas>
```

Declarative 3D: JSX for Three.js objects.
```tsx
<mesh>
  <boxGeometry />
  <meshStandardMaterial color="hotpink" />
</mesh>
```

useFrame: Runs per-frame (60-120fps).
```tsx
useFrame((state, delta) => {
  // state.camera, state.scene, delta
})
```

## WebXR Setup

```tsx
const store = createXRStore()

// App
<button onClick={() => store.enterVR()}>Enter VR</button>
<Canvas>
  <XR store={store}><Scene /></XR>
</Canvas>
```

XROrigin: Move this instead of camera for locomotion (root of player coordinate system).
```tsx
function PlayerRig() {
  const originRef = useRef<THREE.Group>(null)
  useFrame(() => {
    originRef.current.position.x += 0.1
  })
  return <XROrigin ref={originRef} />
}
```

## Controller Input

WRONG: Using raw WebXR API (session.inputSources) doesn't work well with @react-three/xr.

CORRECT: Use useXRInputSourceState hook:
```tsx
const leftController = useXRInputSourceState('controller', 'left')
const rightController = useXRInputSourceState('controller', 'right')

useFrame(() => {
  const thumbstick = leftController?.gamepad?.['xr-standard-thumbstick']
  const x = thumbstick?.xAxis ?? 0  // -1 to 1
  const y = thumbstick?.yAxis ?? 0  // -1 to 1
})
```

Quest 2 buttons:
- xr-standard-thumbstick: xAxis (left/right), yAxis (forward/back)
- xr-standard-trigger: Index trigger
- xr-standard-squeeze: Grip button

## Head-Relative Locomotion

RECOMMENDED: Use useXRControllerLocomotion hook. Automatically handles head-relative movement, prevents feedback loops, includes dead zones.
```tsx
function PlayerRig() {
  const originRef = useRef<THREE.Group>(null)
  useXRControllerLocomotion(originRef, {
    translation: { speed: 2.0 },
    rotation: {
      type: 'snap',  // or 'smooth'
      degrees: 45,   // snap: degrees per turn
      // speed: Math.PI  // smooth: radians/sec
      deadZone: 0.1
    },
    translationController: 'left'
  })
  return <XROrigin ref={originRef} />
}
```

Snap turning (degrees: 30-90) reduces motion sickness. Smooth turning offers more control but can cause discomfort.

Manual implementation pitfalls:
- WRONG: Moving in world space (originRef.current.position.x += speed) - always moves same direction
- WRONG: Using camera.getWorldDirection() - creates feedback loop spiral as camera moves
- WRONG: Using full quaternion - includes pitch/roll causing jittery horizontal movement

CORRECT manual approach: Extract only yaw (Y-axis rotation).
```tsx
useFrame((state, delta) => {
  const euler = new THREE.Euler().setFromQuaternion(
    state.camera.getWorldQuaternion(new THREE.Quaternion()), 'YXZ'
  )
  const headYaw = euler.y

  const forward = new THREE.Vector3(Math.sin(headYaw), 0, Math.cos(headYaw)).normalize()
  const right = new THREE.Vector3(Math.cos(headYaw), 0, -Math.sin(headYaw)).normalize()

  if (Math.abs(moveZ) > 0.1) {
    originRef.current.position.addScaledVector(forward, moveZ * 2.0 * delta)
  }
})
```

Why: Euler 'YXZ' extracts yaw only, Y=0 keeps horizontal, addScaledVector is frame-rate independent.

## Physics (@react-three/rapier)

Setup:
```tsx
<Physics gravity={[0, -9.81, 0]}>
  {/* objects */}
</Physics>
```

Rigid body types:
- fixed: Immovable (walls, floors)
- dynamic: Full physics simulation
- kinematicPosition: Programmatically moved, not affected by physics. CRITICAL: setLinvel is ignored in kinematic mode.

```tsx
<RigidBody
  type="dynamic"
  colliders="ball"  // "ball", "cuboid", "hull"
  mass={0.5}
  restitution={0.5}  // bounciness
  friction={0.7}
  linearDamping={0.1}
  angularDamping={0.1}
/>
```

API:
```tsx
const ref = useRef<RapierRigidBody>(null)
ref.current?.setLinvel({ x: 5, y: 0, z: -2 }, true)
ref.current?.applyImpulse({ x: 0, y: 10, z: 0 }, true)
ref.current?.setTranslation({ x: 1, y: 2, z: 3 }, true)
```

## VR Object Interaction

Controller position:
WRONG: controller.object.position.clone() - returns (0,0,0) because it's local position relative to XROrigin parent.
CORRECT: Use getWorldPosition() to get actual world position through entire transform hierarchy.
```tsx
const pos = new THREE.Vector3()
controller.object.getWorldPosition(pos)
```

Distance-based grabbing:
```tsx
const GRAB_DISTANCE = 0.5
for (const obj of objects) {
  const objPos = obj.rigidBodyRef.current?.translation()
  const distance = controllerPos.distanceTo(new THREE.Vector3(objPos.x, objPos.y, objPos.z))
  if (distance <= GRAB_DISTANCE && distance < closestDistance) {
    closestObject = obj
  }
}
```

Kinematic to dynamic transition: Use pending velocity pattern. Apply velocity AFTER switching to dynamic.
```tsx
function GrabbableObject({ isGrabbed, pendingVelocity, rigidBodyRef }) {
  const wasGrabbed = useRef(false)
  useFrame(() => {
    if (!isGrabbed && wasGrabbed.current && pendingVelocity) {
      rigidBodyRef.current.setLinvel(pendingVelocity, true)
    }
    wasGrabbed.current = isGrabbed
  })
  return <RigidBody ref={rigidBodyRef} type={isGrabbed ? 'kinematicPosition' : 'dynamic'} />
}
```

Velocity tracking (frame-rate independent):
```tsx
const velocityHistory = useRef<THREE.Vector3[]>([])
const lastFrameTime = useRef(performance.now())
const previousPosition = useRef<THREE.Vector3 | null>(null)

useFrame(() => {
  const deltaTime = (performance.now() - lastFrameTime.current) / 1000
  if (previousPosition.current && deltaTime > 0) {
    const velocity = controllerPos.clone().sub(previousPosition.current).divideScalar(deltaTime)
    velocityHistory.current.push(velocity)
    if (velocityHistory.current.length > 5) velocityHistory.current.shift()
  }
  previousPosition.current = controllerPos.clone()
  lastFrameTime.current = performance.now()
})

// Calculate average and apply multiplier
const avgVel = new THREE.Vector3()
for (const vel of history) avgVel.add(vel)
return avgVel.divideScalar(history.length).multiplyScalar(3.0)
```

History size: 5 frames (responsive) vs 10 (smooth). Multiplier: 3.0 default.

Button state detection:
```tsx
const previousButtonState = useRef(false)
useFrame(() => {
  const isPressed = controller?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'
  if (isPressed && !previousButtonState.current) onButtonDown()
  if (!isPressed && previousButtonState.current) onButtonUp()
  previousButtonState.current = isPressed
})
```

## Common Issues

Multiple Three.js instances: Add to vite.config.ts:
```ts
resolve: { dedupe: ['three', '@react-three/fiber'] }
```

WebXR requires HTTPS: Add basicSsl plugin:
```ts
plugins: [react(), basicSsl()], server: { host: true, port: 5173 }
```

Camera not moving: Move XROrigin, not camera.

Controller input not working: Use useXRInputSourceState hook, not session.inputSources.

## Best Practices

Use refs for frequently updated values (not state, prevents re-renders).

Lighting: Include both ambient and directional.
```tsx
<ambientLight intensity={0.5} />
<directionalLight position={[10, 10, 5]} />
```

Physics performance: Limit to 20-30 dynamic bodies for 90fps VR. Fixed bodies cheaper than dynamic.

Kinematic bodies: Never apply velocity to kinematic. Use pending velocity pattern (switch to dynamic, then apply in useFrame).

Controller position: Use getWorldPosition(), not .position (returns local coords).

## Development Setup

Required packages: @react-three/drei, @react-three/fiber, @react-three/xr, react, three. Dev: @vitejs/plugin-basic-ssl, vite.

Vite config:
```ts
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: { host: true, port: 5173 },
  resolve: { dedupe: ['three', '@react-three/fiber'] }
})
```

Testing Quest 2: Run npm run dev, navigate to https://[ip]:5173/ in Quest browser, accept cert, click Enter VR.

Emulator: @react-three/xr includes WebXR emulator. Press Cmd/Win+Alt+E to toggle.

## Quick Reference

```tsx
const store = createXRStore()

function App() {
  return (
    <>
      <button onClick={() => store.enterVR()}>Enter VR</button>
      <Canvas>
        <XR store={store}><Scene /></XR>
      </Canvas>
    </>
  )
}

function PlayerRig() {
  const originRef = useRef<THREE.Group>(null)
  useXRControllerLocomotion(originRef, {
    translation: { speed: 2.0 },
    rotation: { type: 'snap', degrees: 45 },
    translationController: 'left'
  })
  return <XROrigin ref={originRef} />
}
```
