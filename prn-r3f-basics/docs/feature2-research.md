# Feature 2 Research: Object Palette and Creation System

## Overview
Feature 2 implements a VR object palette system that allows users to:
1. Open a palette UI with Y button (left controller)
2. Select object types using controller rays
3. Enter draw mode to create objects at controller position
4. See ghost preview of object before creation
5. Exit draw mode with X button

## Requirements Summary
- **Palette UI**: Fixed in front of user when opened, shows Block and Plank options
- **Controller Rays**: Always visible from both controllers
- **Object Types**:
  - Block: Cube (matching existing cube size ~1m)
  - Plank: 2m × 0.4m × 0.05m
- **Draw Mode**: Ghost preview at controller position, match controller rotation
- **Created Objects**: Fixed rigid bodies (immovable)
- **Interaction**: Multiple object creation until X pressed to exit

## Key Technologies and Libraries

### 1. @react-three/xr (v6.1+)
The primary library for WebXR functionality, with built-in pointer event support.

**Controller Ray Implementation:**
```tsx
const store = createXRStore({
  controller: {
    rayPointer: {
      rayModel: { color: 'white' }  // Configure ray appearance
    }
  }
})
```

**Key Features:**
- Built-in raycasting with pointer events
- onClick handlers work directly on meshes
- Ray color, length, and appearance customizable
- Works out-of-the-box with UIKit and React Three components

**Documentation Source:** pmndrs/xr GitHub

### 2. @react-three/rapier
Already in use for physics. Will use for creating fixed rigid bodies.

```tsx
<RigidBody type="fixed" colliders="cuboid">
  <mesh>
    <boxGeometry args={[2, 0.4, 0.05]} />
  </mesh>
</RigidBody>
```

### 3. @react-three/uikit (Optional)
Comprehensive 3D UI library with buttons, containers, text, and flexbox layouts.

**Pros:**
- Professional UI components
- Flexbox layout in 3D space
- Built-in button/text components
- Works with @react-three/xr pointer events

**Cons:**
- Additional dependency
- May be overkill for simple 2-option palette
- Learning curve for layout system

**Alternative:** Simple mesh-based UI with text sprites (easier for proof-of-concept)

## Implementation Details

### 1. Controller Button Detection

**Critical Finding:** WebXR does not provide event-based button callbacks. Must poll button state in useFrame and track changes manually.

**Quest 2 Button Mapping:**
```typescript
// From WebXR gamepad spec
const gamepad = controller?.gamepad

// Button indices for left controller:
// 0: thumbstick button
// 1: trigger
// 2: grip
// 3: (reserved)
// 4: X button
// 5: Y button

// Right controller: 0,1,2,3,4,5 = thumbstick,trigger,grip,(reserved),A,B
```

**Button Press Detection Pattern:**
```tsx
function useButtonPress(controller: XRControllerState | undefined, buttonIndex: number, onPress: () => void) {
  const previousState = useRef(false)

  useFrame(() => {
    if (!controller?.gamepad) return

    const buttons = Array.from(controller.gamepad)
    const currentState = buttons[buttonIndex]?.state === 'pressed'

    // Detect rising edge (button just pressed)
    if (currentState && !previousState.current) {
      onPress()
    }

    previousState.current = currentState
  })
}
```

**IMPORTANT:** Must track previous state to detect button down event (rising edge detection). Without this, the callback fires every frame while button is held.

**Sources:**
- WebXR Gamepads Module spec
- GitHub: immersive-web/webxr-gamepads-module
- Stack Overflow: WebXR controller button pressing

### 2. Palette UI Implementation

**Option A: UIKit-Based Palette** (Professional but heavier)
```tsx
import { Container, Text } from '@react-three/uikit'

function ObjectPalette() {
  return (
    <Container
      backgroundColor="black"
      backgroundOpacity={0.8}
      borderRadius={16}
      padding={20}
      flexDirection="row"
      gap={20}
    >
      <Container onClick={() => selectObject('block')}>
        <Text>Block</Text>
        {/* 3D preview of block */}
      </Container>
      <Container onClick={() => selectObject('plank')}>
        <Text>Plank</Text>
        {/* 3D preview of plank */}
      </Container>
    </Container>
  )
}
```

**Option B: Simple Mesh-Based Palette** (Recommended for POC)
```tsx
function ObjectPalette({ onSelect }: { onSelect: (type: string) => void }) {
  return (
    <group>
      {/* Background panel */}
      <mesh position={[0, 0, -0.01]}>
        <planeGeometry args={[1.5, 0.6]} />
        <meshBasicMaterial color="black" opacity={0.8} transparent />
      </mesh>

      {/* Block option - actual 3D preview */}
      <mesh
        position={[-0.4, 0, 0]}
        onClick={() => onSelect('block')}
      >
        <boxGeometry args={[0.2, 0.2, 0.2]} />
        <meshStandardMaterial color="white" />
      </mesh>

      {/* Plank option - actual 3D preview */}
      <mesh
        position={[0.4, 0, 0]}
        onClick={() => onSelect('plank')}
        rotation={[0, 0, Math.PI / 4]}
      >
        <boxGeometry args={[0.4, 0.08, 0.01]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  )
}
```

**Positioning Palette in Front of User:**
```tsx
function PaletteManager({ isOpen }: { isOpen: boolean }) {
  const paletteRef = useRef<THREE.Group>(null)

  // Position palette in front of camera when opened
  useEffect(() => {
    if (isOpen && paletteRef.current) {
      const camera = /* get camera from useThree */
      const forward = new THREE.Vector3(0, 0, -1)
      forward.applyQuaternion(camera.quaternion)

      const position = camera.position.clone()
        .add(forward.multiplyScalar(2)) // 2 meters in front

      paletteRef.current.position.copy(position)
      paletteRef.current.lookAt(camera.position) // Face user
    }
  }, [isOpen])

  if (!isOpen) return null

  return <group ref={paletteRef}><ObjectPalette /></group>
}
```

### 3. Controller Rays (Pointer System)

**Built-in Ray Configuration:**
@react-three/xr v6+ includes automatic ray pointers for controllers.

```tsx
const store = createXRStore({
  controller: {
    // Rays enabled by default
    rayPointer: {
      // Customize ray appearance
      rayModel: {
        color: 'cyan',
        // Ray is automatically created and managed
      }
    }
  }
})
```

**Ray Interaction:**
Any mesh with `onClick`, `onPointerEnter`, `onPointerLeave` etc. will automatically work with controller rays.

```tsx
<mesh onClick={(e) => console.log('clicked', e.point)}>
  <boxGeometry />
</mesh>
```

**Important:** The pointer events in @react-three/xr work across all input types (mouse, touch, controller rays, hand pointers) automatically.

### 4. Transparent Ghost Preview

**Material Setup for Ghost Objects:**
```tsx
function GhostPreview({ objectType, position, rotation }) {
  return (
    <mesh position={position} rotation={rotation}>
      {objectType === 'block' ? (
        <boxGeometry args={[1, 1, 1]} />
      ) : (
        <boxGeometry args={[2, 0.4, 0.05]} />
      )}
      <meshStandardMaterial
        color="cyan"
        transparent={true}
        opacity={0.5}
        depthWrite={false}  // Prevents z-fighting with other objects
      />
    </mesh>
  )
}
```

**Key Properties:**
- `transparent: true` - Enables transparency
- `opacity: 0.5` - 50% transparent (adjust as needed)
- `depthWrite: false` - Prevents rendering artifacts with overlapping transparent objects
- `color: 'cyan'` - Tint color to distinguish from real objects

**Source:** Stack Overflow, three.js transparency discussions

### 5. Dynamic Object Creation

**State-Based Object Management:**
```tsx
interface CreatedObject {
  id: string
  type: 'block' | 'plank'
  position: THREE.Vector3
  rotation: THREE.Euler
}

function Scene() {
  const [objects, setObjects] = useState<CreatedObject[]>([])

  const createObject = (type: 'block' | 'plank', position: THREE.Vector3, rotation: THREE.Euler) => {
    setObjects(prev => [...prev, {
      id: Math.random().toString(),
      type,
      position: position.clone(),
      rotation: rotation.clone()
    }])
  }

  return (
    <>
      {objects.map(obj => (
        <CreatedObject key={obj.id} {...obj} />
      ))}
    </>
  )
}

function CreatedObject({ type, position, rotation }: CreatedObject) {
  return (
    <RigidBody type="fixed" position={position} rotation={rotation}>
      <mesh>
        {type === 'block' ? (
          <boxGeometry args={[1, 1, 1]} />
        ) : (
          <boxGeometry args={[2, 0.4, 0.05]} />
        )}
        <meshStandardMaterial color="white" />
      </mesh>
    </RigidBody>
  )
}
```

**Source:** React Three Fiber docs, Stack Overflow on dynamic object management

### 6. Controller Position and Rotation Tracking

**Getting Controller Transform:**
```tsx
function DrawModeController({ hand, selectedObject, onCreateObject }) {
  const controller = useXRInputSourceState('controller', hand)
  const ghostPosition = useRef(new THREE.Vector3())
  const ghostRotation = useRef(new THREE.Quaternion())

  useFrame(() => {
    if (!controller?.object) return

    // Get world position
    controller.object.getWorldPosition(ghostPosition.current)

    // Get world rotation
    controller.object.getWorldQuaternion(ghostRotation.current)
  })

  // Detect trigger press to create object
  useButtonPress(controller, 1, () => {
    const euler = new THREE.Euler().setFromQuaternion(ghostRotation.current)
    onCreateObject(selectedObject, ghostPosition.current, euler)
  })

  return (
    <GhostPreview
      position={ghostPosition.current}
      quaternion={ghostRotation.current}
      objectType={selectedObject}
    />
  )
}
```

**Critical:** Use `getWorldPosition()` and `getWorldQuaternion()` to get actual world-space transforms (accounting for XROrigin parent).

**Source:** docs/r3f-learnings.md, VR object interaction section

### 7. State Management Architecture

**App-Level State:**
```tsx
type AppMode = 'normal' | 'palette-open' | 'draw-mode'

function App() {
  const [mode, setMode] = useState<AppMode>('normal')
  const [selectedObjectType, setSelectedObjectType] = useState<'block' | 'plank' | null>(null)
  const [createdObjects, setCreatedObjects] = useState<CreatedObject[]>([])

  // Y button handler - toggle palette
  const handleYButton = () => {
    if (mode === 'normal') {
      setMode('palette-open')
    } else if (mode === 'palette-open') {
      setMode('normal')
    }
  }

  // X button handler - exit draw mode
  const handleXButton = () => {
    if (mode === 'draw-mode') {
      setMode('normal')
      setSelectedObjectType(null)
    }
  }

  // Object selection from palette
  const handleSelectObject = (type: 'block' | 'plank') => {
    setSelectedObjectType(type)
    setMode('draw-mode')
  }

  // Object creation in draw mode
  const handleCreateObject = (type: string, position: THREE.Vector3, rotation: THREE.Euler) => {
    setCreatedObjects(prev => [...prev, {
      id: Math.random().toString(),
      type: type as 'block' | 'plank',
      position,
      rotation
    }])
  }

  return (
    <Canvas>
      <XR store={store}>
        <Scene
          mode={mode}
          selectedObjectType={selectedObjectType}
          createdObjects={createdObjects}
          onSelectObject={handleSelectObject}
          onCreateObject={handleCreateObject}
        />

        <ButtonController
          hand="left"
          onYButton={handleYButton}
          onXButton={handleXButton}
        />
      </XR>
    </Canvas>
  )
}
```

## Technical Challenges and Solutions

### Challenge 1: No Built-in Button Events
**Problem:** WebXR doesn't provide onButtonDown/onButtonUp events
**Solution:** Manual polling in useFrame with previous state tracking (rising edge detection)

### Challenge 2: Palette Positioning
**Problem:** Positioning UI "in front of user" requires camera orientation
**Solution:** Calculate position based on camera position + forward vector when palette opens

### Challenge 3: Controller Transform in VR
**Problem:** Controller .position returns (0,0,0) in local space
**Solution:** Use getWorldPosition() and getWorldQuaternion() to account for XROrigin parent transform

### Challenge 4: Transparent Material Artifacts
**Problem:** Ghost preview z-fighting with other objects
**Solution:** Set depthWrite: false on transparent material

### Challenge 5: Performance with Many Objects
**Problem:** Creating many fixed rigid bodies could impact performance
**Solution:** RigidBody with type="fixed" is cheap. Limit other factors (complex colliders, dynamic bodies). Fixed bodies don't run physics simulation.

## Implementation Plan (Checklist)

### Phase 1: Controller Button Detection System
- [ ] Create `useButtonPress` custom hook for button state tracking
- [ ] Test Y button (index 5) detection on left controller
- [ ] Test X button (index 4) detection on left controller
- [ ] Add console.log feedback to verify button detection works

### Phase 2: Enable Controller Rays
- [ ] Configure rayPointer in createXRStore for both controllers
- [ ] Verify rays are visible in VR
- [ ] Test onClick interaction with a simple test cube
- [ ] Adjust ray color/appearance if needed

### Phase 3: App State Management
- [ ] Create AppMode type ('normal' | 'palette-open' | 'draw-mode')
- [ ] Add mode state to App component
- [ ] Add selectedObjectType state
- [ ] Add createdObjects state array
- [ ] Wire up Y button to toggle palette open/closed
- [ ] Wire up X button to exit draw mode

### Phase 4: Simple Palette UI
- [ ] Create ObjectPalette component with mesh-based UI
- [ ] Add background panel mesh
- [ ] Add Block preview mesh with onClick handler
- [ ] Add Plank preview mesh with onClick handler
- [ ] Test clicking on palette options with controller rays

### Phase 5: Palette Positioning System
- [ ] Create PaletteManager component
- [ ] Implement camera-relative positioning (2m in front)
- [ ] Make palette face user (lookAt camera)
- [ ] Test palette appears correctly when Y pressed
- [ ] Ensure palette disappears when object selected

### Phase 6: Ghost Preview System
- [ ] Create GhostPreview component
- [ ] Implement transparent material (opacity 0.5, depthWrite false)
- [ ] Track controller position in draw mode
- [ ] Track controller rotation in draw mode
- [ ] Update ghost position/rotation in useFrame

### Phase 7: Object Creation System
- [ ] Create CreatedObject component with RigidBody
- [ ] Implement block geometry (1×1×1 cube)
- [ ] Implement plank geometry (2×0.4×0.05 cuboid)
- [ ] Add trigger button detection in draw mode
- [ ] Create object at controller position/rotation on trigger press
- [ ] Test object appears with correct transform

### Phase 8: Polish and Testing
- [ ] Test full flow: Y button → select → draw → create → X button
- [ ] Test creating multiple objects in sequence
- [ ] Verify created objects are fixed rigid bodies
- [ ] Test ray interaction doesn't break with palette
- [ ] Verify ghost preview matches final object size
- [ ] Add visual feedback for palette selection (hover effect)
- [ ] Test on Quest 2 hardware

### Phase 9: Edge Cases and Refinements
- [ ] Handle pressing Y while in draw mode (should ignore or cancel?)
- [ ] Handle pressing X when not in draw mode (should ignore)
- [ ] Prevent creating objects when pointing at palette
- [ ] Add limits on max number of created objects (if needed)
- [ ] Consider adding object deletion mechanism
- [ ] Document keyboard alternatives for desktop testing

## Design Decisions

### Decision 1: Simple Mesh UI vs UIKit
**Choice:** Simple mesh-based UI
**Rationale:**
- Fewer dependencies
- Easier to understand and debug
- Sufficient for 2-option palette
- Can upgrade to UIKit later if needed

### Decision 2: Palette Positioning
**Choice:** Fixed in front of user when opened
**Rationale:**
- Simpler than controller-attached
- More predictable user experience
- One-time positioning calculation

### Decision 3: Object Dimensions
**Block:** 1m × 1m × 1m (matching existing cubes)
**Plank:** 2m × 0.4m × 0.05m (long, thin, construction-style)
**Rationale:** User specified these dimensions

### Decision 4: Object Orientation
**Choice:** Match controller rotation
**Rationale:**
- More natural and intuitive
- Allows for precise placement
- User can rotate controller to orient objects

### Decision 5: Ray Visibility
**Choice:** Always visible
**Rationale:**
- Needed for Feature 3 also
- Helps with spatial awareness
- No performance impact

## Additional Resources

### Documentation
- @react-three/xr: https://github.com/pmndrs/xr
- @react-three/uikit: https://github.com/pmndrs/uikit
- WebXR Gamepads Module: https://www.w3.org/TR/webxr-gamepads-module-1/
- Three.js Materials: https://threejs.org/docs/#api/en/materials/Material

### Example Code References
- Button detection: docs/r3f-learnings.md lines 213-221
- Controller position: docs/r3f-learnings.md lines 154-159
- Dynamic objects: Stack Overflow - managing dynamic objects in R3F
- Transparent materials: Stack Overflow - transparent objects in three.js

### Testing Checklist
- [ ] Desktop browser with WebXR emulator
- [ ] Quest 2 over local network
- [ ] Both left and right controller rays work
- [ ] Y button on left controller
- [ ] X button on left controller
- [ ] Trigger buttons on both controllers
- [ ] Multiple object creation
- [ ] Physics collision with created objects

## Notes for Implementation

1. **Start Simple:** Implement mesh-based UI first, can upgrade to UIKit later
2. **Test Button Detection Early:** This is critical and can be tricky
3. **Use Refs for Ghost Position:** Avoid re-renders, update in useFrame
4. **Clone Transforms:** Always clone Vector3/Euler when storing in state
5. **Fixed Bodies are Cheap:** Don't worry about performance with many fixed bodies
6. **Rays are Automatic:** @react-three/xr v6+ handles raycasting automatically
7. **depthWrite: false:** Essential for transparent preview to look good
8. **Rising Edge Detection:** Must track previous button state to detect press
