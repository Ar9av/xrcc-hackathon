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

```tsx
function calculateThrowVelocity(velocityHistory: THREE.Vector3[]): THREE.Vector3 {
  if (velocityHistory.length === 0) return new THREE.Vector3()

  // Use exponential moving average (EMA) for smoother velocity
  let ema = velocityHistory[0].clone()
  const alpha = 0.3 // Smoothing factor

  for (let i = 1; i < velocityHistory.length; i++) {
    ema.lerp(velocityHistory[i], alpha)
  }

  // Scale factor for better throwing feel (tunable)
  const throwMultiplier = 1.5

  return ema.multiplyScalar(throwMultiplier)
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
- Enable `debug` mode initially to visualize colliders
- Set gravity to `[0, -9.81, 0]`

### Step 3: Convert Cubes to Fixed RigidBodies
- Wrap each existing `<Box>` with `<RigidBody type="fixed">`
- Keep existing positions and colors
- Wrap ground plane in fixed RigidBody

### Step 4: Add Dynamic Balls
- Create `Ball` component with dynamic RigidBody
- Add 3-5 balls at various positions in the scene
- Test basic physics (falling, bouncing)

### Step 5: Implement Grab Detection
- Create `GrabbableBall` component with grab state
- Create `GrabController` component for each hand
- Implement grip button detection using existing controller input pattern
- Add distance-based grab detection

### Step 6: Implement Throw Mechanics
- Add controller velocity tracking
- Implement velocity history buffer
- Calculate and apply throw velocity on release
- Tune multipliers for good feel

### Step 7: Polish
- Adjust physics parameters (restitution, friction, mass)
- Tune throw velocity scaling
- Add visual feedback (color change when grabbed)
- Remove debug mode
- Test in VR headset

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
const GRAB_DISTANCE = 0.3  // Max distance to grab

// Throw mechanics
const VELOCITY_HISTORY_SIZE = 10  // Frames to average
const THROW_MULTIPLIER = 1.5      // Velocity scaling
const VELOCITY_SMOOTHING = 0.3    // EMA alpha

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

### WebXR Controller Position
- Controller position comes from `controller.object.position`
- This is in world space
- Needs to be transformed relative to XROrigin if origin moves

### Physics Timestep
- Rapier runs at fixed timestep (60Hz by default)
- Works well with VR's 90Hz or 120Hz refresh rate
- No manual timestep configuration needed

### Grab Feel
- Velocity multiplier may need tuning per user preference
- Too high = unrealistic throws
- Too low = frustrating, weak throws
- Start at 1.5x and adjust

### Multi-Hand Grab
- Current design: one ball per hand max
- Could be enhanced to allow 2+ balls per hand
- Would need array of grabbed balls instead of single reference

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
