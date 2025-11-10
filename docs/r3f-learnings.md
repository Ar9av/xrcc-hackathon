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

## WebXR AR Features

AR session setup: Request required features explicitly.
```tsx
const store = createXRStore({
  ar: {
    requiredFeatures: ['hit-test', 'anchors', 'plane-detection']
  }
})
```

WRONG: Assuming features are enabled by default causes hit test creation to fail.
CORRECT: Explicitly request features in createXRStore configuration.

### AR Hit Testing

Problem: Position virtual objects on real-world surfaces detected by AR.

Setup hit test source from viewer space (headset forward direction):
```tsx
const hitTestSourceRef = useRef<XRHitTestSource | null>(null)
const xrRefSpaceRef = useRef<XRReferenceSpace | null>(null)

useEffect(() => {
  if (!session) return

  session.requestReferenceSpace('viewer').then((viewerSpace) => {
    if ('requestHitTestSource' in session) {
      (session as any).requestHitTestSource({ space: viewerSpace })
        .then((source: XRHitTestSource) => {
          hitTestSourceRef.current = source
        })
    }
  })

  session.requestReferenceSpace('local-floor').then((refSpace) => {
    xrRefSpaceRef.current = refSpace
  })
}, [session])
```

Get hit test results each frame:
```tsx
useFrame((state) => {
  const frame = state.gl.xr.getFrame()
  if (!frame || !hitTestSourceRef.current || !xrRefSpaceRef.current) return

  const results = frame.getHitTestResults(hitTestSourceRef.current)
  if (results.length > 0) {
    const pose = results[0].getPose(xrRefSpaceRef.current)
    if (pose) {
      mesh.matrix.fromArray(pose.transform.matrix)
      // Apply local rotation if needed
      const rotation = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
      mesh.matrix.multiply(rotation)
    }
  }
})
```

CRITICAL: Use 'local-floor' reference space, not 'local'.
WRONG: Requesting 'local' space when XR store renders in 'local-floor' causes offset (reticle appears ~1.5m below gaze).
CORRECT: Match reference space to XR store's rendering coordinate system.

### Direct Matrix Assignment

Problem: Apply WebXR pose transformations to Three.js objects.

WRONG: Calling matrix.decompose() after assignment:
```tsx
mesh.matrix.fromArray(pose.transform.matrix)
mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale) // WRONG
```
Result: Decomposition overwrites rotation, causing incorrect orientation.

CORRECT: Direct assignment with matrixAutoUpdate disabled:
```tsx
<mesh ref={meshRef} matrixAutoUpdate={false}>
  <geometry />
</mesh>

// In useFrame
mesh.matrix.fromArray(pose.transform.matrix)
```

Why: WebXR matrices contain complete transformation (position + orientation). Y-axis aligned with surface normal. Three.js matrixAutoUpdate recalculates matrix from position/rotation/scale, overwriting your direct assignment. Disable it to maintain control.

Apply local transformations by multiplying matrices:
```tsx
mesh.matrix.fromArray(anchorPose.transform.matrix)
const translation = new THREE.Matrix4().makeTranslation(0, height/2, 0)
mesh.matrix.multiply(translation)
```

### Geometry Origin Offset

Problem: Place object with specific point (e.g., base) at anchor, not geometric center.

ConeGeometry origin is at geometric center. To place base at anchor point:
```tsx
const pyramidHeight = 0.3
mesh.matrix.fromArray(anchorPose.transform.matrix)
// Translate up by half height along surface normal (Y-axis)
const offset = new THREE.Matrix4().makeTranslation(0, pyramidHeight / 2, 0)
mesh.matrix.multiply(offset)
```

WRONG: Ignoring geometry origin causes object to float or sink into surface.
CORRECT: Translate along local Y-axis (surface normal) by half the dimension to align desired point with anchor.

### Plane Detection Visualization

Access detected planes from XRFrame:
```tsx
useFrame((state) => {
  const frame = state.gl.xr.getFrame()
  if (!frame?.detectedPlanes) return

  frame.detectedPlanes.forEach((plane: XRPlane) => {
    // plane.polygon contains vertices
    // plane.planeSpace provides coordinate system

    const pose = frame.getPose(plane.planeSpace, xrRefSpace)
    if (pose) {
      mesh.matrixAutoUpdate = false
      mesh.matrix.fromArray(pose.transform.matrix)
    }
  })
})
```

Create geometry from plane polygon:
```tsx
const vertices: number[] = []
const indices: number[] = []

plane.polygon.forEach((point: DOMPointReadOnly) => {
  vertices.push(point.x, point.y, point.z)
})

// Fan triangulation
for (let i = 1; i < plane.polygon.length - 1; i++) {
  indices.push(0, i, i + 1)
}

geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
geometry.setIndex(indices)
```

### Anchors

Create anchor from hit test result:
```tsx
session.addEventListener('select', () => {
  if (hitResult) {
    (hitResult as any).createAnchor().then((anchor: XRAnchor) => {
      // Store anchor for tracking
    })
  }
})
```

Update anchored object each frame:
```tsx
useFrame((state) => {
  const frame = state.gl.xr.getFrame()
  if (!frame?.trackedAnchors?.has(anchor)) return

  const pose = frame.getPose(anchor.anchorSpace, xrRefSpace)
  if (pose) {
    mesh.matrix.fromArray(pose.transform.matrix)
  }
})
```

Anchors maintain stable references to real-world locations as tracking improves.

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
