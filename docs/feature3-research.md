# Feature 3 Research: Object Palette with Draw Mode

## Overview

Feature 3 implements an object selection palette that allows users to:
1. Open a palette UI by pressing the Y button on the left controller
2. Select between two object types (Block or Pyramid) using controller rays and trigger
3. Enter draw mode where they can place selected objects on AR planes
4. Exit draw mode by pressing X on the left controller

This builds directly on Feature 2's AR plane detection and object placement system, adding UI for object selection.

## User Workflow

Based on user clarification, the workflow is:

1. **Open Palette**: Press Y button → Palette appears in front of user
2. **Select Object**: Point controller at Block/Pyramid → Press trigger → Object selected, palette closes, enter draw mode
3. **Place Objects**: In draw mode, cursor (reticle) is visible → Point at plane → Press trigger to place selected object
4. **Re-open Palette in Draw Mode**: Press Y again → Palette re-opens (allows switching object type)
5. **Exit Draw Mode**: Press X button → Exit draw mode, cursor hidden, selectedObjectType cleared

**Key Points**:
- Palette closes automatically after object selection
- Pressing Y in draw mode re-opens the palette (not disabled)
- Controller rays are always visible (not just when palette is open)
- Cursor visibility is tied to draw mode state
- Cannot switch object types without reopening palette

## Component Architecture

```
Scene (AR mode)
├── ARHitTestManager (existing from Feature 2)
│   ├── Reticle (cursor - only visible in draw mode)
│   └── PlacementHandler (modified to handle selected object type)
└── ObjectPalette (new)
    ├── PalettePanel (3D UI positioned in front of user)
    │   ├── BlockButton (selectable mesh)
    │   └── PyramidButton (selectable mesh)
    ├── PaletteController (handles Y/X button input)
    └── RayPointers (controller rays - always visible)
```

## State Management

### Required State

```tsx
// In Scene component or global state
const [isPaletteVisible, setIsPaletteVisible] = useState(false)
const [selectedObjectType, setSelectedObjectType] = useState<'block' | 'pyramid' | null>(null)
const [isDrawMode, setIsDrawMode] = useState(false)
const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([])

interface PlacedObject {
  id: string
  type: 'block' | 'pyramid'
  anchor: XRAnchor
}
```

### State Transitions

```
Initial State:
  isPaletteVisible: false
  selectedObjectType: null
  isDrawMode: false

Press Y:
  isPaletteVisible: true

Select Block/Pyramid:
  selectedObjectType: 'block' or 'pyramid'
  isDrawMode: true
  isPaletteVisible: false

Press X (in draw mode):
  isDrawMode: false
  selectedObjectType: null

Press Y (in draw mode):
  isPaletteVisible: true
  (isDrawMode and selectedObjectType remain unchanged)
```

## Technical Implementation Details

### 1. Controller Rays

**Approach**: Controllers in @react-three/xr automatically include ray pointers when configured.

**Implementation**:
```tsx
// Controllers are already configured in the XR store
// They render rays by default
const store = createXRStore({
  controller: true, // Default configuration includes rays
})

// Optional: Customize ray appearance
const store = createXRStore({
  controller: {
    rayPointer: {
      rayModel: { color: 'blue' }
    }
  }
})
```

**Key Points**:
- Controllers render rays automatically in XR mode
- Rays are used by the pointer event system for interaction
- No manual ray rendering or raycasting needed
- Works seamlessly with onClick, onPointerDown, etc.

### 2. Button Input Detection

**Approach**: Use `useXRInputSourceState` hook to detect button presses.

**Implementation**:
```tsx
function PaletteController({ onTogglePalette, onExitDrawMode, isDrawMode }) {
  const leftController = useXRInputSourceState('controller', 'left')
  const previousYState = useRef(false)
  const previousXState = useRef(false)

  useFrame(() => {
    if (!leftController?.gamepad) return

    // Y button detection
    const yButton = leftController.gamepad['y-button'] // or 'a-button', 'b-button', 'x-button'
    const isYPressed = yButton?.state === 'pressed'

    if (isYPressed && !previousYState.current) {
      onTogglePalette()
    }
    previousYState.current = isYPressed

    // X button detection (only in draw mode)
    if (isDrawMode) {
      const xButton = leftController.gamepad['x-button']
      const isXPressed = xButton?.state === 'pressed'

      if (isXPressed && !previousXState.current) {
        onExitDrawMode()
      }
      previousXState.current = isXPressed
    }
  })

  return null
}
```

**Quest 2 Button Mapping**:
- Y button: `'y-button'`
- X button: `'x-button'`
- A button (right controller): `'a-button'`
- B button (right controller): `'b-button'`
- Trigger: Via session 'select' event (already used in Feature 2)

### 3. 3D Palette Panel Positioning

**Approach**: Create 3D mesh panel positioned in front of user's head when palette opens.

**Two Options**:

#### Option A: Simple Fixed Position (Recommended)
Position panel at a fixed offset from camera when opened, no tracking.

```tsx
function PalettePanel({ visible, onSelectBlock, onSelectPyramid }) {
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  const positioned = useRef(false)

  useFrame(() => {
    if (visible && !positioned.current && groupRef.current) {
      // Get camera position and forward direction
      const cameraPos = camera.position.clone()
      const cameraForward = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(camera.quaternion)

      // Position panel 1.5m in front of user, slightly below eye level
      const panelPos = cameraPos.clone()
        .add(cameraForward.multiplyScalar(1.5))
        .add(new THREE.Vector3(0, -0.2, 0))

      groupRef.current.position.copy(panelPos)

      // Make panel face the user
      groupRef.current.lookAt(camera.position)

      positioned.current = true
    }

    // Reset positioning flag when hidden
    if (!visible && positioned.current) {
      positioned.current = false
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef}>
      {/* Panel background */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[1.0, 0.5]} />
        <meshStandardMaterial color="#333333" opacity={0.9} transparent />
      </mesh>

      {/* Block button - left side */}
      <mesh
        position={[-0.3, 0, 0.01]}
        onClick={onSelectBlock}
      >
        <boxGeometry args={[0.3, 0.3, 0.3]} />
        <meshStandardMaterial color="orange" />
      </mesh>

      {/* Pyramid button - right side */}
      <mesh
        position={[0.3, 0, 0.01]}
        onClick={onSelectPyramid}
      >
        <coneGeometry args={[0.15, 0.3, 4]} />
        <meshStandardMaterial color="cyan" />
      </mesh>
    </group>
  )
}
```

#### Option B: HTML Overlay with Drei (Alternative)
Use @react-three/drei's Html component for 2D UI.

```tsx
import { Html } from '@react-three/drei'

function PalettePanel({ visible, onSelectBlock, onSelectPyramid }) {
  const groupRef = useRef<THREE.Group>(null)
  // ... same positioning logic as Option A

  if (!visible) return null

  return (
    <group ref={groupRef}>
      <Html
        center
        distanceFactor={1.5}
        transform
        style={{
          background: 'rgba(0,0,0,0.8)',
          padding: '20px',
          borderRadius: '10px',
          display: 'flex',
          gap: '20px',
        }}
      >
        <button onClick={onSelectBlock}>Block</button>
        <button onClick={onSelectPyramid}>Pyramid</button>
      </Html>
    </group>
  )
}
```

**Recommendation**: Use Option A (3D meshes) because:
- More immersive VR experience
- Consistent with 3D scene aesthetic
- Better depth perception and spatial awareness
- Easier to interact with using controller rays
- Html component can have rendering/input quirks in VR

### 4. Ray-Object Intersection for Selection

**Approach**: Use built-in pointer events from @react-three/xr - no manual raycasting needed.

**Implementation**:
```tsx
// Simply attach onClick handler to meshes
<mesh onClick={(event) => {
  console.log('Block selected!', event)
  onSelectBlock()
}}>
  <boxGeometry args={[0.3, 0.3, 0.3]} />
  <meshStandardMaterial color="orange" />
</mesh>
```

**How It Works**:
1. @react-three/xr's pointer event system automatically:
   - Creates rays from controllers
   - Performs raycasting each frame
   - Fires pointer events (onClick, onPointerOver, etc.)
2. When controller ray hits mesh and trigger pressed:
   - `onClick` event fires
   - Event contains intersection details
3. No manual THREE.Raycaster needed

**Event Types Available**:
- `onClick`: Trigger pressed and released on same object
- `onPointerDown`: Trigger pressed
- `onPointerUp`: Trigger released
- `onPointerOver`: Ray enters object
- `onPointerOut`: Ray leaves object
- `onPointerMove`: Ray moves within object

**Visual Feedback**:
```tsx
const [isHovered, setIsHovered] = useState(false)

<mesh
  onClick={onSelectBlock}
  onPointerOver={() => setIsHovered(true)}
  onPointerOut={() => setIsHovered(false)}
>
  <boxGeometry args={[0.3, 0.3, 0.3]} />
  <meshStandardMaterial
    color={isHovered ? 'yellow' : 'orange'}
  />
</mesh>
```

### 5. Modifying Feature 2 for Object Type Selection

**Current Feature 2 Behavior**: Always places pyramids

**Required Changes**:
1. Pass `selectedObjectType` prop to PlacementHandler
2. Modify AnchoredObject component to accept `type` prop
3. Render appropriate geometry based on type

**Implementation**:
```tsx
// In ARHitTestManager.tsx
interface PlacementHandlerProps {
  hitResult: XRHitTestResult | null
  xrRefSpace: XRReferenceSpace | null
  selectedObjectType: 'block' | 'pyramid' | null  // NEW
  isDrawMode: boolean  // NEW
}

function PlacementHandler({
  hitResult,
  xrRefSpace,
  selectedObjectType,
  isDrawMode
}: PlacementHandlerProps) {
  const { session } = useXR()
  const [anchoredObjects, setAnchoredObjects] = useState<Array<{
    id: string
    anchor: XRAnchor
    type: 'block' | 'pyramid'  // NEW
  }>>([])

  useEffect(() => {
    if (!session) return

    const onSelect = () => {
      // Only place objects if in draw mode with selected type
      if (!isDrawMode || !selectedObjectType || !hitResult || !xrRefSpace) return

      if ('createAnchor' in hitResult) {
        (hitResult as any).createAnchor().then((anchor: XRAnchor) => {
          setAnchoredObjects(prev => [...prev, {
            id: Math.random().toString(),
            anchor: anchor,
            type: selectedObjectType  // NEW
          }])
        }).catch((error: Error) => {
          console.error("Could not create anchor: " + error)
        })
      }
    }

    session.addEventListener('select', onSelect)
    return () => session.removeEventListener('select', onSelect)
  }, [session, hitResult, xrRefSpace, isDrawMode, selectedObjectType])

  return (
    <>
      {anchoredObjects.map(({ id, anchor, type }) => (
        <AnchoredObject
          key={id}
          anchor={anchor}
          xrRefSpace={xrRefSpace}
          type={type}  // NEW
        />
      ))}
    </>
  )
}

// Modified AnchoredObject component
interface AnchoredObjectProps {
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
  type: 'block' | 'pyramid'  // NEW
}

function AnchoredObject({ anchor, xrRefSpace, type }: AnchoredObjectProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { session } = useXR()

  useFrame((state) => {
    if (!session || !xrRefSpace || !meshRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame || !frame.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    meshRef.current.matrix.fromArray(anchorPose.transform.matrix)

    // Different offset for different object types
    const objectHeight = type === 'block' ? 0.25 : 0.3
    const offset = new THREE.Matrix4().makeTranslation(0, objectHeight / 2, 0)
    meshRef.current.matrix.multiply(offset)
  })

  return (
    <mesh ref={meshRef} matrixAutoUpdate={false}>
      {/* Render different geometry based on type */}
      {type === 'block' ? (
        <boxGeometry args={[0.5, 0.5, 0.5]} />
      ) : (
        <coneGeometry args={[0.2, 0.3, 4]} />
      )}
      <meshStandardMaterial color={type === 'block' ? 'orange' : 'cyan'} />
    </mesh>
  )
}
```

### 6. Cursor Visibility Control

**Current Behavior**: Cursor always visible when hit test succeeds

**Required Change**: Only show cursor when in draw mode

**Implementation**:
```tsx
// In ARHitTestManager.tsx
export function ARHitTestManager({ isDrawMode }: { isDrawMode: boolean }) {
  // ... existing hit test code

  useFrame((state) => {
    if (!session || !hitTestSourceRef.current || !xrRefSpaceRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame) return

    const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current)

    if (hitTestResults.length > 0 && isDrawMode) {  // NEW: Check isDrawMode
      const hitPose = hitTestResults[0].getPose(xrRefSpaceRef.current)
      if (hitPose && reticleRef.current) {
        reticleRef.current.visible = true
        reticleRef.current.matrix.fromArray(hitPose.transform.matrix)
        const rotationMatrix = new THREE.Matrix4().makeRotationX(-Math.PI / 2)
        reticleRef.current.matrix.multiply(rotationMatrix)
        setCurrentHitResult(hitTestResults[0])
      }
    } else {
      if (reticleRef.current) reticleRef.current.visible = false
      setCurrentHitResult(null)
    }
  })

  return (
    <>
      <mesh ref={reticleRef} visible={false} matrixAutoUpdate={false}>
        <ringGeometry args={[0.15, 0.2, 32]} />
        <meshBasicMaterial color="white" side={THREE.DoubleSide} />
      </mesh>
      {/* ... rest of component */}
    </>
  )
}
```

## Implementation Plan

### Step 1: Create ObjectPalette Component

**What to implement**:
1. Create new file `src/components/ObjectPalette.tsx`
2. Implement PalettePanel with Block and Pyramid buttons as 3D meshes
3. Add positioning logic to place panel in front of user
4. Add onClick handlers for object selection
5. Test panel visibility and positioning in AR mode

**Success Criteria**: Panel appears in front of user when made visible

### Step 2: Implement Button Input Detection

**What to implement**:
1. Create PaletteController component
2. Use useXRInputSourceState to access left controller
3. Detect Y button press for palette toggle
4. Detect X button press for exiting draw mode
5. Use ref pattern to track previous button state

**Success Criteria**: Console logs when Y and X buttons pressed

### Step 3: Add State Management

**What to implement**:
1. Add state variables to Scene component:
   - isPaletteVisible
   - selectedObjectType
   - isDrawMode
2. Implement state transition logic
3. Pass state down to child components
4. Wire up button handlers to state updates

**Success Criteria**: State transitions follow defined workflow

### Step 4: Integrate Palette with Feature 2

**What to implement**:
1. Modify ARHitTestManager to accept isDrawMode prop
2. Update cursor visibility logic
3. Modify PlacementHandler to accept selectedObjectType
4. Update AnchoredObject to render different geometries
5. Update select event handler to check draw mode

**Success Criteria**: Objects only placed when in draw mode, correct type rendered

### Step 5: Add Visual Feedback

**What to implement**:
1. Add hover effects to palette buttons
2. Add visual indicator for selected object type
3. Consider adding text labels using drei's Text component
4. Polish palette appearance

**Success Criteria**: Clear visual feedback for selections and interactions

## Code Structure

### New Files

**src/components/ObjectPalette.tsx**
- PalettePanel component - 3D UI for object selection
- PaletteController component - Button input handler
- Main ObjectPalette export

### Modified Files

**src/components/ARHitTestManager.tsx**
- Add isDrawMode and selectedObjectType props
- Update cursor visibility logic
- Modify PlacementHandler for object type selection
- Update AnchoredObject (rename from AnchoredPyramid) to support both types

**src/App.tsx**
- Add state management for palette and draw mode
- Render ObjectPalette component in AR mode
- Pass state props to ARHitTestManager

## Testing Strategy

### Desktop Preview (WebXR Emulator)
1. Test Y button opens/closes palette
2. Test clicking palette buttons
3. Test X button exits draw mode
4. Verify state transitions
5. Check cursor visibility

### Quest 2 Device
1. Test palette positioning (comfortable viewing distance)
2. Test controller ray selection
3. Test placing both block and pyramid objects
4. Test workflow: open palette → select → place → exit → repeat
5. Verify palette stays in position until closed/reopened

## Performance Considerations

1. **Palette Rendering**: Only render when visible
2. **Button State**: Use refs to avoid re-renders on every frame
3. **Placed Objects**: Limit to 20-30 objects for performance
4. **Hover Effects**: Use simple color changes, avoid expensive operations

## Potential Challenges & Solutions

### Challenge 1: Palette Positioning in VR
**Problem**: Hard to find comfortable viewing distance and angle

**Solution**:
- Start with 1.5m distance, slightly below eye level
- Make position configurable if needed
- Test with actual users for comfort

### Challenge 2: Button State Detection
**Problem**: Need edge detection (press, not hold)

**Solution**: Use previous state refs to detect state transitions (false → true)

### Challenge 3: Ray Selection Accuracy
**Problem**: Small buttons hard to select

**Solution**:
- Make buttons reasonably large (0.3m minimum)
- Add hover effects for feedback
- Ensure good contrast with background

### Challenge 4: State Synchronization
**Problem**: Multiple components need access to shared state

**Solution**:
- Lift state to Scene component
- Pass props down explicitly
- Consider using React context if needed for deeper nesting

## Integration with Feature 4

Feature 4 will build on this by adding:
- Object selection from placed objects (not palette)
- Transform modes (position, scale, rotate)
- Transform axes visualization
- Drag interactions on axes

**Considerations for Feature 4**:
- PlacedObjects array should store complete object data
- May need to extend PlacedObject interface
- Selected object from palette vs selected placed object are different states
- Feature 3's draw mode is separate from Feature 4's transform mode

## Key Learnings from Feature 2

1. **Direct matrix assignment**: Use `matrixAutoUpdate={false}` and directly assign matrices
2. **Reference space matching**: Use 'local-floor' consistently
3. **Session events**: Use 'select' event rather than polling trigger
4. **Geometry origins**: Account for geometry center vs desired anchor point
5. **Required features**: Explicitly request WebXR features in store config

## References

### @react-three/xr Documentation
- Controllers and pointer events: https://github.com/pmndrs/xr
- Button input: useXRInputSourceState hook
- Custom inputs tutorial
- Interactions tutorial

### @react-three/drei Documentation
- Html component: https://github.com/pmndrs/drei
- Text component for labels
- Center component for alignment

### Three.js
- Group and Object3D for positioning
- LookAt for panel orientation
- Geometry origins

### Existing Implementation
- `src/components/ARHitTestManager.tsx` - Feature 2 implementation
- `src/App.tsx` - XR store configuration
- `docs/r3f-learnings.md` - R3F patterns
- `docs/feature2-research.md` - AR implementation patterns

## Next Steps

1. Implement Step 1 (ObjectPalette UI)
2. Test on device for positioning comfort
3. Implement Step 2 (Button detection)
4. Implement Step 3 (State management)
5. Implement Step 4 (Feature 2 integration)
6. Implement Step 5 (Polish and visual feedback)
7. Document learnings in r3f-learnings.md
8. Prepare for Feature 4 integration

## Notes

- Controllers automatically include rays - no manual setup needed
- Pointer events work seamlessly with XR controllers
- 3D mesh UI is more immersive than HTML overlays
- State management is straightforward with React useState
- Feature 2 modifications are minimal and non-breaking
- Workflow allows smooth object selection and placement
- Always-visible rays make interaction discovery easier
