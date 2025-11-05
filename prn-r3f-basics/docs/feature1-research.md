# Feature 1 Research: Physics for Object Interaction

## Overview

This document contains comprehensive research for implementing Feature 1, which adds physics-based object interaction to the VR scene. The feature includes:
- Making existing 4 cubes rigid (static physics bodies)
- Adding throwable balls with realistic physics
- VR grab/hold/throw mechanics using Quest 2 grip buttons
- Collision detection between balls, cubes, and floor

---

## Current Codebase State

### Project Structure
```
src/
├── App.tsx          # Main application with XR setup
├── main.tsx         # Entry point
└── App.css         # Styles

docs/
├── r3f-learnings.md             # Existing learnings
├── r3f-feature-exploration.md   # Feature requirements
└── feature1-research.md         # This document
```

### Current Scene Setup (App.tsx)

**Components:**
- **PlayerRig**: Handles VR locomotion with thumbstick input
  - Uses `XROrigin` for movement (not camera)
  - Left thumbstick: forward/backward/strafe
  - Right thumbstick: rotation
  - Already has controller input handling via `useXRInputSourceState`

- **Scene**: Contains 3D objects
  - 4 Box components at positions:
    - `[0, 1.5, -2]` - hotpink
    - `[3, 1.5, -2]` - cyan
    - `[-3, 1.5, -2]` - yellow
    - `[0, 1.5, -5]` - lime
  - Ground plane: 50x50 units at y=0
  - Grid helper for spatial awareness
  - Ambient and directional lighting
  - OrbitControls for desktop testing

**Current Dependencies:**
```json
{
  "@react-three/drei": "^10.7.6",
  "@react-three/fiber": "^9.4.0",
  "@react-three/xr": "^6.6.27",
  "three": "^0.181.0"
}
```

**No Physics Implemented Yet** - This is a greenfield implementation.

---

## Physics Library Selection

### Chosen: @react-three/rapier

**Reasons:**
1. **Official pmndrs ecosystem** - Same team as react-three-fiber and drei (Trust Score: 9.6)
2. **WASM-based Rapier engine** - High performance, written in Rust
3. **Excellent documentation** - 72 code snippets available in Context7
4. **WebXR compatibility** - Works seamlessly with @react-three/xr
5. **Rich feature set** - Rigid bodies, colliders, joints, forces, velocity tracking

**Installation:**
```bash
npm install @react-three/rapier
```

### Alternative Considered: @react-three/cannon
- Older, less actively maintained
- JavaScript-based (slower than WASM)
- Not found in Context7 documentation

---

## Implementation Architecture

### 1. Physics World Setup

Wrap the entire scene in a `<Physics>` component:

```tsx
import { Physics } from '@react-three/rapier'

function Scene() {
  return (
    <Physics gravity={[0, -9.81, 0]}>
      {/* All physics-enabled objects go here */}
    </Physics>
  )
}
```

**Key Props:**
- `gravity`: [x, y, z] acceleration (default: [0, -9.81, 0])
- `debug`: Set to `true` to visualize colliders (useful for development)
- `colliders`: Can be set to `false` to manually define all colliders

---

### 2. Static Rigid Bodies (Cubes)

**Requirement:** "Make all those cubes rigid so that they stay in place and other objects cannot pass through them"

**Implementation:** Use `<RigidBody>` with `type="fixed"`

```tsx
import { RigidBody } from '@react-three/rapier'
import { Box } from '@react-three/drei'

// Replace existing Box components with:
<RigidBody type="fixed" position={[0, 1.5, -2]}>
  <Box>
    <meshStandardMaterial color="hotpink" />
  </Box>
</RigidBody>
```

**RigidBody Types:**
- `"fixed"` - Static, immovable objects (walls, floors, our cubes)
- `"dynamic"` - Moving objects affected by forces (our balls)
- `"kinematicPosition"` - Movable but not affected by physics
- `"kinematicVelocity"` - Velocity-controlled movement

**Automatic Colliders:**
By default, `<RigidBody>` automatically generates a collider based on the wrapped mesh geometry. For Box components, it creates a cuboid collider matching the box dimensions.

**Floor Implementation:**
The ground plane also needs to be a fixed rigid body:

```tsx
<RigidBody type="fixed" position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
  <mesh>
    <planeGeometry args={[50, 50]} />
    <meshStandardMaterial color="lightblue" />
  </mesh>
</RigidBody>
```

---

### 3. Dynamic Rigid Bodies (Balls)

**Requirement:** "Add some small balls to the space that are solid but I should be able to pick up the balls and throw them"

**Implementation:** Use `<RigidBody>` with `type="dynamic"`

```tsx
import { RigidBody } from '@react-three/rapier'
import { Sphere } from '@react-three/drei'

function Ball({ position }) {
  return (
    <RigidBody
      type="dynamic"
      position={position}
      colliders="ball"
      restitution={0.5}  // Bounciness (0-1)
      friction={0.7}     // Surface friction
      mass={0.5}         // Mass in kg
    >
      <Sphere args={[0.15]}>  {/* radius: 0.15 units = small ball */}
        <meshStandardMaterial color="orange" />
      </Sphere>
    </RigidBody>
  )
}

// Usage: Add multiple balls to the scene
<Ball position={[1, 2, -3]} />
<Ball position={[-1, 2, -3]} />
<Ball position={[0, 2, -4]} />
```

**Key Props:**
- `colliders="ball"` - Automatic sphere collider (more efficient than mesh collider)
- `restitution` - Bounciness (0 = no bounce, 1 = perfect bounce)
- `friction` - Surface friction (affects rolling and sliding)
- `mass` - Object mass (affects throwing physics)
- `linearDamping` - Air resistance for linear velocity
- `angularDamping` - Air resistance for rotation

**Collision Behavior:**
Balls will automatically collide with:
- Fixed cubes (will bounce naturally)
- The floor (won't fall through)
- Other balls (ball-to-ball collisions)

---

### 4. VR Grab Mechanics

**Requirement:** "Pick up/hold mechanic - this should work when I press the grip button on the left or right controller"

#### A. Grip Button Detection

Based on existing controller input pattern in PlayerRig, extend to detect grip button:

```tsx
import { useXRInputSourceState } from '@react-three/xr'

function GrabController({ hand }) {
  const controller = useXRInputSourceState('controller', hand)

  useFrame(() => {
    if (!controller?.gamepad) return

    // Access the grip/squeeze button
    const squeeze = controller.gamepad['xr-standard-squeeze']

    if (squeeze) {
      const isPressed = squeeze.state === 'pressed'
      const pressValue = squeeze.button?.value ?? 0  // 0 to 1

      if (isPressed) {
        // Grip button is pressed - attempt to grab
      } else {
        // Grip button released - throw
      }
    }
  })
}
```

**Quest 2 Controller Gamepad Components:**
- `'xr-standard-trigger'` - Index finger trigger
- `'xr-standard-squeeze'` - Grip button (our target)
- `'xr-standard-thumbstick'` - Thumbstick (already used for movement)

**Button States:**
```typescript
type ButtonState = 'default' | 'touched' | 'pressed'

interface GamepadButton {
  state: ButtonState
  button?: {
    value: number      // 0 to 1
    pressed: boolean
    touched: boolean
  }
  xAxis?: number      // For thumbsticks
  yAxis?: number
}
```

#### B. Grab Implementation Strategy

**Approach 1: Attachment Method (Simpler)**
When grip is pressed and controller is near a ball:
1. Disable the ball's physics temporarily
2. Parent the ball to the controller
3. Track controller velocity over last few frames
4. On release, re-enable physics and apply velocity

**Approach 2: Fixed Joint Method (More Realistic)**
Use Rapier's fixed joint to attach ball to controller:
1. Create a kinematic rigid body at controller position
2. Use `useFixedJoint` to connect ball to controller body
3. Move controller body with controller position
4. On release, remove joint and apply velocity

**Recommended: Approach 1** for initial implementation (simpler, works well for VR throwing)

#### C. Grab Implementation Code

```tsx
import { useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useXRInputSourceState } from '@react-three/xr'
import { RigidBody, RapierRigidBody } from '@react-three/rapier'
import * as THREE from 'three'

function GrabbableBall({ position }) {
  const rigidBodyRef = useRef<RapierRigidBody>(null)
  const [isGrabbed, setIsGrabbed] = useState(false)
  const [grabbedBy, setGrabbedBy] = useState<'left' | 'right' | null>(null)

  return (
    <RigidBody
      ref={rigidBodyRef}
      type={isGrabbed ? 'kinematicPosition' : 'dynamic'}
      position={position}
      colliders="ball"
      restitution={0.5}
      friction={0.7}
      mass={0.5}
    >
      <Sphere args={[0.15]}>
        <meshStandardMaterial color={isGrabbed ? "yellow" : "orange"} />
      </Sphere>
    </RigidBody>
  )
}

function GrabController({ hand, balls }) {
  const controller = useXRInputSourceState('controller', hand)
  const velocityHistory = useRef<THREE.Vector3[]>([])
  const maxHistorySize = 10
  const previousGripState = useRef(false)

  useFrame(() => {
    if (!controller?.gamepad || !controller.object) return

    const squeeze = controller.gamepad['xr-standard-squeeze']
    const isGripPressed = squeeze?.state === 'pressed'

    // Track controller velocity
    const controllerPos = controller.object.position.clone()
    if (velocityHistory.current.length > 0) {
      const lastPos = velocityHistory.current[velocityHistory.current.length - 1]
      const velocity = controllerPos.clone().sub(lastPos).divideScalar(1/60) // Assuming 60fps
      velocityHistory.current.push(velocity)
      if (velocityHistory.current.length > maxHistorySize) {
        velocityHistory.current.shift()
      }
    } else {
      velocityHistory.current.push(new THREE.Vector3())
    }

    // Grip just pressed - attempt grab
    if (isGripPressed && !previousGripState.current) {
      attemptGrab(controller.object.position, hand, balls)
    }

    // Grip just released - throw
    if (!isGripPressed && previousGripState.current) {
      releaseGrab(hand, balls, velocityHistory.current)
      velocityHistory.current = []
    }

    // Update held ball position
    if (isGripPressed) {
      updateHeldBall(controller.object.position, hand, balls)
    }

    previousGripState.current = isGripPressed
  })

  return null
}
```

**Key Implementation Details:**

1. **Velocity Tracking:**
   - Store controller position history (last 10 frames)
   - Calculate average velocity on release
   - Apply as linear velocity to ball rigid body

2. **Grab Detection:**
   - Check distance from controller to each ball
   - Grab closest ball within threshold (e.g., 0.3 units)
   - Change ball type to `kinematicPosition` when grabbed

3. **Release/Throw:**
   - Calculate average velocity from history
   - Change ball type back to `dynamic`
   - Use `rigidBody.setLinvel()` to apply throw velocity
   - Scale velocity by a factor (e.g., 1.5x) for better feel

---

### 5. Throw Physics

**Requirement:** "I should be able to pick up and throw the balls by doing the throwing action and releasing the grip button"

#### Velocity Calculation

**Frame-Rate Independent Velocity Tracking:**
```tsx
const lastFrameTime = useRef<number>(performance.now())

useFrame(() => {
  // ... controller position code ...

  const currentTime = performance.now()
  const deltaTime = (currentTime - lastFrameTime.current) / 1000 // Convert to seconds

  if (previousPosition.current && deltaTime > 0) {
    const velocity = controllerPos.clone().sub(previousPosition.current).divideScalar(deltaTime)
    velocityHistory.current.push(velocity)
    if (velocityHistory.current.length > VELOCITY_HISTORY_SIZE) {
      velocityHistory.current.shift()
    }
  }

  previousPosition.current = controllerPos.clone()
  lastFrameTime.current = currentTime
})
```

**Throw Velocity Calculation:**
```tsx
function calculateThrowVelocity(velocityHistory: THREE.Vector3[]): THREE.Vector3 {
  if (velocityHistory.length === 0) return new THREE.Vector3()

  // Use simple average for responsive throws
  const avgVelocity = new THREE.Vector3()
  for (const vel of velocityHistory) {
    avgVelocity.add(vel)
  }
  avgVelocity.divideScalar(velocityHistory.length)

  return avgVelocity.multiplyScalar(THROW_MULTIPLIER)
}

function releaseGrab(hand, balls, velocityHistory) {
  const ball = balls.find(b => b.grabbedBy === hand)
  if (!ball || !ball.rigidBodyRef.current) return

  // Calculate throw velocity
  const velocity = calculateThrowVelocity(velocityHistory)

  // Apply to rigid body
  ball.rigidBodyRef.current.setLinvel(velocity, true)

  // Release state
  ball.setIsGrabbed(false)
  ball.setGrabbedBy(null)
}
```

**Rapier Velocity Methods:**
- `setLinvel(velocity, wakeUp)` - Set linear velocity
- `setAngvel(velocity, wakeUp)` - Set angular velocity
- `applyImpulse(impulse, wakeUp)` - One-time force push
- `addForce(force, wakeUp)` - Continuous force

**For throwing, use `setLinvel()`** - Direct velocity setting provides the most intuitive throwing feel.

---

### 6. Collision Events (Optional Enhancement)

```tsx
<RigidBody
  onCollisionEnter={({ manifold, target, other }) => {
    console.log("Ball hit something!")
    // Could play sound effects, particle effects, etc.
  }}
>
  <Sphere>
    <meshStandardMaterial color="orange" />
  </Sphere>
</RigidBody>
```

---

## Implementation Plan

### Step 1: Install Physics Library
```bash
npm install @react-three/rapier
```

### Step 2: Wrap Scene in Physics
- Add `<Physics>` component to Scene
- Set gravity to `[0, -9.81, 0]`
- Optional: Enable `debug` mode to visualize colliders (disable before final)

### Step 3: Convert Cubes to Fixed RigidBodies
- Wrap each existing `<Box>` with `<RigidBody type="fixed">`
- Keep existing positions and colors
- Wrap ground plane in fixed RigidBody

### Step 4: Add Dynamic Balls
- Create `GrabbableBall` component with dynamic RigidBody
- Position balls close and at reachable height:
  - `[0.5, 1.0, -1.5]`, `[-0.5, 1.0, -1.5]`, `[0, 1.2, -1.0]`
- Test basic physics (falling, bouncing)

### Step 5: Implement Grab Detection
- Create `GrabbableBall` component with grab state
- Create `GrabController` component for each hand
- **CRITICAL:** Use `getWorldPosition()` NOT `.position.clone()`
- Implement grip button detection using `controller.gamepad['xr-standard-squeeze']`
- Add distance-based grab detection (0.5 units recommended)
- Optional: Add debug spheres to visualize controller positions

### Step 6: Implement Throw Mechanics
- Add frame-rate independent velocity tracking using `performance.now()`
- Implement velocity history buffer (5 frames)
- Calculate average velocity on release
- Apply velocity with multiplier (start at 3.0)
- Tune multipliers for good feel

### Step 7: Polish
- Adjust physics parameters (restitution, friction, mass)
- Tune throw velocity scaling based on testing
- Add visual feedback (color change when grabbed)
- Remove debug mode and console logs
- Test thoroughly in VR headset

---

## Code Integration Points

### App.tsx Modifications

```tsx
// Add import
import { Physics, RigidBody } from '@react-three/rapier'

function Scene() {
  return (
    <>
      <PlayerRig />

      {/* NEW: Wrap in Physics */}
      <Physics gravity={[0, -9.81, 0]} debug>

        {/* Lighting stays outside or inside - both work */}
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />

        {/* MODIFIED: Cubes become fixed RigidBodies */}
        <RigidBody type="fixed" position={[0, 1.5, -2]}>
          <Box><meshStandardMaterial color="hotpink" /></Box>
        </RigidBody>

        {/* ... other cubes ... */}

        {/* MODIFIED: Floor becomes fixed RigidBody */}
        <RigidBody type="fixed" rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <mesh>
            <planeGeometry args={[50, 50]} />
            <meshStandardMaterial color="lightblue" />
          </mesh>
        </RigidBody>

        {/* NEW: Add grabbable balls */}
        <GrabbableBall position={[1, 2, -3]} />
        <GrabbableBall position={[-1, 2, -3]} />
        <GrabbableBall position={[0, 2, -4]} />

        {/* NEW: Grab controllers */}
        <GrabController hand="left" />
        <GrabController hand="right" />

      </Physics>

      <gridHelper args={[50, 50, 'gray', 'darkgray']} position={[0, 0.01, 0]} />
      <OrbitControls />
    </>
  )
}
```

---

## Testing Checklist

### Desktop (with debug mode)
- [ ] Balls fall to ground with gravity
- [ ] Balls bounce on ground
- [ ] Balls collide with cubes
- [ ] Balls don't pass through floor or cubes
- [ ] Colliders visible in debug mode

### VR (Quest 2)
- [ ] Balls visible and at correct scale
- [ ] Grip button detected on left controller
- [ ] Grip button detected on right controller
- [ ] Can grab ball when controller is near it
- [ ] Ball follows controller when grabbed
- [ ] Ball changes color when grabbed
- [ ] Ball releases when grip released
- [ ] Thrown ball has velocity based on throw speed
- [ ] Throw direction matches hand movement
- [ ] Multiple balls can be grabbed independently
- [ ] Balls collide with cubes after being thrown
- [ ] Balls bounce naturally after throw

---

## Tunable Parameters

```typescript
// Physics
const GRAVITY = -9.81

// Ball properties
const BALL_RADIUS = 0.15
const BALL_MASS = 0.5
const BALL_RESTITUTION = 0.5  // Bounciness
const BALL_FRICTION = 0.7

// Grab detection
const GRAB_DISTANCE = 0.5  // Max distance to grab (0.3 is too small, 0.5 recommended)

// Throw mechanics
const VELOCITY_HISTORY_SIZE = 5   // Frames to average (5 for responsive, 10 for smooth)
const THROW_MULTIPLIER = 3.0      // Velocity scaling (1.5 is too weak, start at 3.0)

// Visual feedback
const GRABBED_COLOR = "yellow"
const NORMAL_COLOR = "orange"
```

---

## Known Considerations

### Performance
- Rapier is WASM-based and very fast
- Dynamic balls are more expensive than fixed cubes
- Recommend max 20-30 dynamic balls for 90fps VR
- Automatic colliders are efficient (no manual optimization needed)

### WebXR Controller Position - CRITICAL IMPLEMENTATION DETAIL

**❌ WRONG APPROACH (Does Not Work):**
```tsx
const controllerPos = controller.object.position.clone()
```

**Problem:** This gives the LOCAL position relative to the controller's parent (XROrigin), which is always at origin (0,0,0) because the controller's local position doesn't change. The debug spheres will appear stuck at world origin.

**✅ CORRECT APPROACH (Works):**
```tsx
const controllerPos = new THREE.Vector3()
controller.object.getWorldPosition(controllerPos)
```

**Why it works:** `getWorldPosition()` accounts for the entire transform hierarchy including XROrigin movement and properly returns the controller's position in world space. This is essential for grab detection and ball positioning.

**Implementation Note:** This is the single most critical fix for making grab mechanics work. Without it, grab detection will always fail because the controller position will be incorrectly reported as (0,0,0).

### Physics Timestep
- Rapier runs at fixed timestep (60Hz by default)
- Works well with VR's 90Hz or 120Hz refresh rate
- No manual timestep configuration needed

### Grab Feel and Throw Velocity

**Ball Positioning for Easy Grabbing:**
- Initial ball positions should be close (1-2 meters in front)
- Height should be waist/chest level (1.0-1.2 meters)
- Example positions that work well:
  - `[0.5, 1.0, -1.5]` - Right side, waist height
  - `[-0.5, 1.0, -1.5]` - Left side, waist height
  - `[0, 1.2, -1.0]` - Center, chest height

**Grab Distance:**
- Default 0.3 units may be too small for comfortable grabbing
- 0.5 units recommended for easier interaction
- Can be increased further if needed

**Velocity Tracking:**
- Velocity multiplier may need tuning per user preference
- Too high = unrealistic throws
- Too low = frustrating, weak throws
- Start at 3.0x and adjust (1.5x is too weak)
- Use frame-rate independent velocity calculation
- Average last 5 frames for responsive feel

### Multi-Hand Grab
- Current design: one ball per hand max
- Could be enhanced to allow 2+ balls per hand
- Would need array of grabbed balls instead of single reference

---

## Implementation Debugging Tips

### Visual Debugging
When grab mechanics aren't working, add visual debug spheres to show controller positions:

```tsx
const debugSphereRef = useRef<THREE.Mesh>(null)

// In useFrame:
if (debugSphereRef.current) {
  debugSphereRef.current.position.copy(controllerPos)
}

// Render:
return (
  <mesh ref={debugSphereRef}>
    <sphereGeometry args={[0.08]} />
    <meshStandardMaterial
      color={hand === 'left' ? 'blue' : 'red'}
      emissive={hand === 'left' ? 'blue' : 'red'}
      emissiveIntensity={0.5}
    />
  </mesh>
)
```

**If spheres are stuck at origin (0,0,0):** You're using `.position.clone()` instead of `getWorldPosition()`.

### Console Logging
Add strategic console logs to debug:
- Button press detection: Log when grip is pressed/released
- Grab attempts: Log distances between controller and each ball
- Velocity tracking: Log velocity history on throw

Remove all debug code before final implementation.

### Common Issues and Solutions

**Issue: Balls don't respond to grab**
- Check: Are you using `getWorldPosition()` for controller position?
- Check: Is grab distance large enough? (Try 0.5 instead of 0.3)
- Check: Are balls positioned close enough to reach?

**Issue: Throws are too weak**
- Increase throw multiplier (try 3.0 or higher)
- Reduce velocity history size (5 frames vs 10)
- Use simple average instead of exponential moving average
- Ensure frame-rate independent velocity calculation

**Issue: Throws in wrong direction**
- Verify velocity tracking is using world positions
- Check velocity history is being cleared on grab

---

## References

### Documentation
- [@react-three/rapier GitHub](https://github.com/pmndrs/react-three-rapier)
- [Rapier Physics Engine Docs](https://rapier.rs/docs/)
- [@react-three/xr Documentation](https://pmndrs.github.io/xr/)
- [WebXR Gamepad Module](https://www.w3.org/TR/webxr-gamepads-module-1/)

### Learnings Documents
- `docs/r3f-learnings.md` - React Three Fiber patterns and XR setup
- `docs/r3f-feature-exploration.md` - Feature requirements

### Code Examples Referenced
- 72 react-three-rapier code snippets from Context7
- Existing PlayerRig implementation for controller input pattern
- Unity XR Interaction Toolkit concepts (adapted for WebXR)

---

## Next Steps

After Feature 1 is implemented and tested, Feature 2 will build on this foundation:
- Feature 2 adds AR pass-through mode
- Will use Meta's scene understanding API
- Balls will collide with real-world walls and furniture
- May need to switch to scene mesh colliders

This physics foundation is essential for all future features involving object interaction.
