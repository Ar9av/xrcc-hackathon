# Feature 4.2 Rotate Mode Research: Object Rotation

## Overview

Feature 4.2 implements object modification capabilities for objects placed in AR mode. This feature builds on Feature 4.1 (Object Selection and Deletion) by adding transformation modes. **This research document focuses ONLY on Rotate Mode**, the first of three modes (Rotate, Scale, Move).

This research covers:
1. Visual feedback with RingGeometry
2. Rotation around plane normal axis
3. Thumbstick input for smooth rotation
4. Mode toggling with 'A' button
5. Dynamic ring sizing based on object bounding box

## Requirements Summary

Based on `docs/r3f-feature-exploration.md` Feature 4.2:

### Rotate Mode Visual Description
- A flat ring (RingGeometry) appears centered on the object when in rotate mode
- Ring is parallel to the plane on which object is placed
- Ring is vertically in the middle of the object's height (local Y-axis midpoint)
- Ring is yellow in color
- Ring must scale with object size (30cm larger than bounding box diagonal)
- Ring must always be visible even if object scales in Feature 4.2.2 (Scale Mode)

### Rotation Behavior
- Object can ONLY be rotated parallel to the plane on which it was placed
- Rotation axis is the plane's normal vector (perpendicular to plane)
- Right or left thumbstick controls rotation (either one, not both simultaneously)
- Thumbstick right → clockwise rotation (viewed from above, +Y direction of plane)
- Thumbstick left → counter-clockwise rotation
- If both thumbsticks used, take latest input and ignore previous
- Rotation speed: 30 degrees per second (π/6 radians per second)
- Smooth, real-time rotation as thumbstick is held
- Rotation only works when an object is selected

### Mode Management
- 'A' button on right controller toggles between modes
- Default mode is rotate mode
- For now: Toggle between rotate, scale (no functionality), and move (no functionality)
- When implementing modes one by one, toggle only between implemented modes
- Currently: Only rotate mode implemented, so 'A' button cycles through rotate → scale → move → rotate
- Scale and move modes display placeholder text but have no functionality yet

## User Workflow

1. **Select Object**: Point at placed object → Press trigger → Object selected
2. **Enter Rotate Mode**: Object starts in rotate mode by default (yellow ring appears)
3. **Rotate Object**:
   - Push right/left thumbstick left/right
   - Object rotates parallel to its placement plane
   - Ring provides visual feedback of rotate mode
4. **Toggle Mode**: Press 'A' on right controller → cycles to scale/move (placeholders for now)
5. **Deselect**: Point at empty space → Press trigger → Modes disabled, ring disappears

## Component Architecture

```
Scene (AR mode)
├── ARHitTestManager
│   ├── PlacementHandler
│   │   ├── SelectableObject (from Feature 4.1)
│   │   │   ├── GLB Model
│   │   │   ├── SelectionHighlight (Feature 4.1 - will remove when modes added)
│   │   │   └── ModificationVisuals (NEW)
│   │   │       ├── RotateRing (visible in rotate mode)
│   │   │       ├── ScaleSlider (placeholder - Feature 4.2.2)
│   │   │       └── MoveAxes (placeholder - Feature 4.2.3)
│   │   ├── SelectionController (B button deletion - Feature 4.1)
│   │   └── ModificationController (NEW)
│   │       ├── Mode toggle ('A' button)
│   │       ├── RotationHandler (thumbstick input)
│   │       ├── ScaleHandler (placeholder)
│   │       └── MoveHandler (placeholder)
```

## State Management

### Current State (Feature 4.1)

```tsx
// In PlacementHandler component
const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
const [anchoredObjects, setAnchoredObjects] = useState<Array<{
  id: string
  anchor: XRAnchor
  type: 'table' | 'bed' | 'sofa' | 'round-table'
}>>([])
```

### Required State Additions for Feature 4.2

```tsx
// Transformation mode state
type TransformMode = 'rotate' | 'scale' | 'move'
const [transformMode, setTransformMode] = useState<TransformMode>('rotate')

// Object rotation state (stored per object)
interface AnchoredObjectData {
  id: string
  anchor: XRAnchor
  type: 'table' | 'bed' | 'sofa' | 'round-table'
  rotation: number  // NEW - rotation angle in radians around plane normal
}
```

### State Management Strategy

**Rotation Storage**: Store rotation angle per object in `anchoredObjects` array.

**Rationale**:
- Each object has independent rotation relative to its placement plane
- Rotation persists when object is deselected and reselected
- Rotation angle applied relative to anchor's coordinate system
- Simple number (radians) is efficient and straightforward

**Mode State**: Store at PlacementHandler level (same as selection state).

**Rationale**:
- Mode is global - only affects currently selected object
- Mode persists across selections (selecting new object keeps current mode)
- Easy to toggle with 'A' button
- Accessible to all modification controllers

**Implementation**:
```tsx
// In PlacementHandler
const [transformMode, setTransformMode] = useState<TransformMode>('rotate')
const [anchoredObjects, setAnchoredObjects] = useState<AnchoredObjectData[]>([])

// Update rotation for selected object
const handleRotate = (deltaRotation: number) => {
  if (!selectedObjectId) return

  setAnchoredObjects(prev => prev.map(obj =>
    obj.id === selectedObjectId
      ? { ...obj, rotation: (obj.rotation + deltaRotation) % (Math.PI * 2) }
      : obj
  ))
}

// Toggle mode with 'A' button
const handleToggleMode = () => {
  setTransformMode(prev => {
    if (prev === 'rotate') return 'scale'
    if (prev === 'scale') return 'move'
    return 'rotate'
  })
}
```

## Technical Implementation Details

### 1. RingGeometry Creation and Positioning

**Requirement**: Yellow ring parallel to placement plane, centered at object's vertical midpoint.

**RingGeometry API**:
```tsx
new THREE.RingGeometry(
  innerRadius,   // Inner radius of ring
  outerRadius,   // Outer radius of ring
  thetaSegments  // Number of segments (32 for smooth circle)
)
```

**Implementation Approach**:

```tsx
function RotateRing({ objectRef, anchor, xrRefSpace }: RotateRingProps) {
  const ringRef = useRef<THREE.Mesh>(null)
  const { session } = useXR()

  // Calculate ring radius based on object bounding box
  const ringRadius = useMemo(() => {
    if (!objectRef.current) return 0.5 // Default fallback

    const bbox = new THREE.Box3().setFromObject(objectRef.current)
    const size = bbox.getSize(new THREE.Vector3())

    // Bounding box diagonal + 30cm (0.3 meters)
    const diagonal = size.length()
    return (diagonal / 2) + 0.3
  }, [objectRef])

  // Update ring position each frame
  useFrame((state) => {
    if (!session || !xrRefSpace || !ringRef.current || !objectRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame?.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Get object's bounding box in local coordinates
    const bbox = new THREE.Box3().setFromObject(objectRef.current)
    const size = bbox.getSize(new THREE.Vector3())
    const yMidpoint = size.y / 2

    // Start with anchor's transformation matrix
    ringRef.current.matrix.fromArray(anchorPose.transform.matrix)

    // Translate to vertical midpoint of object
    const translation = new THREE.Matrix4().makeTranslation(0, yMidpoint, 0)
    ringRef.current.matrix.multiply(translation)
  })

  return (
    <mesh ref={ringRef} matrixAutoUpdate={false}>
      <ringGeometry args={[ringRadius * 0.85, ringRadius, 32]} />
      <meshBasicMaterial color="yellow" side={THREE.DoubleSide} />
    </mesh>
  )
}
```

**Key Points**:
- Ring lies flat on XZ plane by default (parallel to horizontal plane)
- Anchor matrix Y-axis is the plane normal, so ring is automatically parallel to plane
- Inner radius = 85% of outer radius for visible ring thickness
- Ring positioned at `yMidpoint` of object's local Y extent
- `meshBasicMaterial` ensures visibility without scene lighting
- `DoubleSide` makes ring visible from both sides

### 2. Object Bounding Box Calculation

**Purpose**: Calculate ring size and position based on object dimensions.

**Three.js Box3 API**:
```tsx
const bbox = new THREE.Box3().setFromObject(object)
const size = bbox.getSize(new THREE.Vector3())     // Width, height, depth
const center = bbox.getCenter(new THREE.Vector3()) // Center point
const diagonal = size.length()                      // Diagonal length
```

**Challenges and Solutions**:

#### Challenge: Bounding box includes all children
**Solution**: This is actually what we want. GLB models contain multiple meshes, and we want the ring to encompass the entire visual object.

#### Challenge: Bounding box updates with scale changes
**Solution**: Calculate ring radius dynamically each frame OR recalculate when entering rotate mode. For rotate mode only, calculate once when mode activated.

#### Challenge: Bounding box in world space vs local space
**Solution**: `setFromObject()` calculates in world space, but we can use the size (dimensions) since we only care about the object's extent, not absolute position.

**Implementation Pattern**:
```tsx
// Calculate once when object selected and mode = rotate
useEffect(() => {
  if (!isSelected || transformMode !== 'rotate' || !groupRef.current) return

  const bbox = new THREE.Box3().setFromObject(groupRef.current)
  const size = bbox.getSize(new THREE.Vector3())
  const diagonal = size.length()

  // Ring radius = (diagonal / 2) + 0.3m clearance
  setRingRadius((diagonal / 2) + 0.3)

  // Y midpoint for ring positioning
  setRingYPosition(size.y / 2)
}, [isSelected, transformMode])
```

### 3. Extracting Plane Normal from Anchor

**Requirement**: Rotate object around the plane's normal vector (perpendicular to plane).

**Key Insight**: The anchor's transformation matrix already contains the plane normal as its Y-axis.

**Anchor Matrix Structure**:
```
The 4x4 transformation matrix from anchorPose.transform.matrix contains:
- Column 0 (indices 0,1,2): X-axis direction (tangent to plane)
- Column 1 (indices 4,5,6): Y-axis direction (PLANE NORMAL)
- Column 2 (indices 8,9,10): Z-axis direction (tangent to plane)
- Column 3 (indices 12,13,14): Position
```

**Extracting the Normal**:
```tsx
// From anchor pose matrix
const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
const matrix = anchorPose.transform.matrix

// Extract Y-axis (plane normal) from matrix
const planeNormal = new THREE.Vector3(
  matrix[4],  // Y-axis X component
  matrix[5],  // Y-axis Y component
  matrix[6]   // Y-axis Z component
).normalize()
```

**Alternative using Three.js Matrix4**:
```tsx
const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
const planeNormal = new THREE.Vector3()
anchorMatrix.extractBasis(
  new THREE.Vector3(), // X-axis (discard)
  planeNormal,         // Y-axis (plane normal)
  new THREE.Vector3()  // Z-axis (discard)
)
planeNormal.normalize()
```

**Verification**: The plane normal should point "up" from the surface:
- For floor/table (horizontal): planeNormal ≈ (0, 1, 0)
- For wall (vertical): planeNormal perpendicular to wall surface
- Always perpendicular to the detected plane

### 4. Rotation Around Arbitrary Axis

**Requirement**: Rotate object around plane normal, regardless of plane orientation.

**Approach Options**:

#### Option A: Quaternion-based rotation (RECOMMENDED)
```tsx
// Create rotation quaternion from axis and angle
const rotationQuat = new THREE.Quaternion()
rotationQuat.setFromAxisAngle(planeNormal, rotationAngle)

// Apply to object (either multiply quaternions or directly set)
object.quaternion.multiplyQuaternions(baseQuaternion, rotationQuat)
```

#### Option B: Direct rotation property
```tsx
// Only works if rotation axis aligns with world Y-axis
// NOT SUITABLE for walls or non-horizontal planes
object.rotation.y += deltaAngle  // ✗ WRONG for arbitrary planes
```

#### Option C: RotateOnAxis method
```tsx
// Rotate around axis in local space
object.rotateOnAxis(planeNormal, deltaAngle)
```

**Recommended: Quaternion-based approach**

**Rationale**:
- Works for any plane orientation (horizontal, vertical, angled)
- Clean separation of base orientation (from anchor) and rotation (from user)
- Mathematically robust, no gimbal lock issues
- Compatible with matrix-based positioning used for anchors

**Implementation Strategy**:
```tsx
function SelectableObject({ rotation, anchor, ... }) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!groupRef.current) return

    const frame = state.gl.xr.getFrame()
    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Apply anchor's base transformation
    groupRef.current.matrix.fromArray(anchorPose.transform.matrix)

    // Extract plane normal from anchor matrix
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const planeNormal = new THREE.Vector3()
    anchorMatrix.extractBasis(
      new THREE.Vector3(),
      planeNormal,
      new THREE.Vector3()
    )
    planeNormal.normalize()

    // Create rotation quaternion
    const rotationQuat = new THREE.Quaternion()
    rotationQuat.setFromAxisAngle(planeNormal, rotation)

    // Apply rotation to matrix
    const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(rotationQuat)
    groupRef.current.matrix.multiply(rotationMatrix)

    // Apply Y offset (existing logic)
    const yOffsetMatrix = new THREE.Matrix4().makeTranslation(0, yOffset, 0)
    groupRef.current.matrix.multiply(yOffsetMatrix)
  })

  return <group ref={groupRef} matrixAutoUpdate={false}>...</group>
}
```

**Key Points**:
- Base transformation from anchor (includes plane orientation)
- Rotation applied as additional transformation around plane normal
- Order matters: anchor matrix → rotation → Y offset
- Rotation angle stored per object in state

### 5. Thumbstick Input for Rotation

**Requirement**: Either left or right thumbstick (X-axis) controls rotation. If both used, take latest input.

**Quest 2 Thumbstick Mapping**:
- Left thumbstick: `leftController.gamepad['xr-standard-thumbstick']`
- Right thumbstick: `rightController.gamepad['xr-standard-thumbstick']`
- X-axis values: -1 (left) to +1 (right)
- Y-axis values: -1 (backward) to +1 (forward)

**Implementation**:

```tsx
function RotationController({
  selectedObjectId,
  transformMode,
  onRotate
}: RotationControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')
  const lastInputSource = useRef<'left' | 'right' | null>(null)

  useFrame((state, delta) => {
    // Only rotate when object selected and in rotate mode
    if (!selectedObjectId || transformMode !== 'rotate') return

    const leftThumbstick = leftController?.gamepad?.['xr-standard-thumbstick']
    const rightThumbstick = rightController?.gamepad?.['xr-standard-thumbstick']

    const leftX = leftThumbstick?.xAxis ?? 0
    const rightX = rightThumbstick?.xAxis ?? 0

    const DEAD_ZONE = 0.1
    const leftActive = Math.abs(leftX) > DEAD_ZONE
    const rightActive = Math.abs(rightX) > DEAD_ZONE

    // Determine which input to use
    let rotationInput = 0
    if (leftActive && rightActive) {
      // Both active - use the one that was used most recently
      // If neither was last source, default to right
      if (lastInputSource.current === 'left') {
        rotationInput = leftX
      } else {
        rotationInput = rightX
        lastInputSource.current = 'right'
      }
    } else if (leftActive) {
      rotationInput = leftX
      lastInputSource.current = 'left'
    } else if (rightActive) {
      rotationInput = rightX
      lastInputSource.current = 'right'
    } else {
      lastInputSource.current = null
    }

    // Apply rotation
    if (Math.abs(rotationInput) > DEAD_ZONE) {
      // 30 degrees per second = π/6 radians per second
      const rotationSpeed = Math.PI / 6  // radians per second
      const deltaRotation = rotationInput * rotationSpeed * delta

      // Positive input (right) = clockwise (positive rotation)
      // Negative input (left) = counter-clockwise (negative rotation)
      onRotate(deltaRotation)
    }
  })

  return null
}
```

**Key Points**:
- Dead zone of 0.1 prevents drift
- `delta` makes rotation frame-rate independent
- 30 deg/sec = π/6 rad/sec (0.5236 rad/sec)
- Latest input source takes precedence when both active
- Reset `lastInputSource` when neither active

**Alternative: Simple approach (both inputs add)**
```tsx
// Simpler but allows both controllers to control simultaneously
const rotationInput = leftX + rightX
if (Math.abs(rotationInput) > DEAD_ZONE) {
  const deltaRotation = rotationInput * (Math.PI / 6) * delta
  onRotate(deltaRotation)
}
```

**Recommendation**: Use "latest input" approach per requirements, but simple approach is also viable and more intuitive.

### 6. Mode Toggling with 'A' Button

**Requirement**: 'A' button on right controller cycles through modes: rotate → scale → move → rotate.

**Implementation**:

```tsx
function ModeController({
  selectedObjectId,
  transformMode,
  onToggleMode
}: ModeControllerProps) {
  const rightController = useXRInputSourceState('controller', 'right')
  const previousAState = useRef(false)

  useFrame(() => {
    // Only allow mode toggle when object is selected
    if (!selectedObjectId) return
    if (!rightController?.gamepad) return

    // A button detection on right controller
    const aButton = rightController.gamepad['a-button']
    const isAPressed = aButton?.state === 'pressed'

    // Edge detection: trigger only on press (false → true transition)
    if (isAPressed && !previousAState.current) {
      console.log('A button pressed - toggling mode')
      onToggleMode()
    }

    previousAState.current = isAPressed
  })

  return null
}
```

**Mode Toggle Logic**:
```tsx
// In PlacementHandler
const handleToggleMode = () => {
  setTransformMode(prev => {
    const modes: TransformMode[] = ['rotate', 'scale', 'move']
    const currentIndex = modes.indexOf(prev)
    const nextIndex = (currentIndex + 1) % modes.length
    console.log(`Mode changed: ${prev} → ${modes[nextIndex]}`)
    return modes[nextIndex]
  })
}
```

**Key Points**:
- Same edge detection pattern as B button (Feature 4.1)
- Only toggle when object selected (no mode without selection)
- Mode persists across selections
- Console logging helps with debugging

### 7. Removing Feature 4.1 Wireframe

**Current**: SelectionHighlight shows yellow wireframe box.

**Change**: Replace wireframe with mode-specific visuals.

```tsx
// OLD (Feature 4.1)
{isSelected && <SelectionHighlight />}

// NEW (Feature 4.2)
{isSelected && (
  <ModificationVisuals
    mode={transformMode}
    objectRef={groupRef}
    anchor={anchor}
    xrRefSpace={xrRefSpace}
  />
)}

function ModificationVisuals({ mode, objectRef, anchor, xrRefSpace }) {
  return (
    <>
      {mode === 'rotate' && (
        <RotateRing objectRef={objectRef} anchor={anchor} xrRefSpace={xrRefSpace} />
      )}
      {mode === 'scale' && (
        // Placeholder for Feature 4.2.2
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="green" />
        </mesh>
      )}
      {mode === 'move' && (
        // Placeholder for Feature 4.2.3
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="red" />
        </mesh>
      )}
    </>
  )
}
```

## Implementation Plan

### Phase 1: State Management Setup

**What to implement**:
1. Add `rotation: number` to AnchoredObjectData interface
2. Initialize rotation to 0 when creating anchored objects
3. Add `transformMode` state to PlacementHandler
4. Pass `rotation` prop to SelectableObject
5. Test: Object state includes rotation field

**Files to modify**:
- `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Objects created with `rotation: 0`
- transformMode state defaults to 'rotate'
- Console logs show correct state structure

### Phase 2: Rotation Application

**What to implement**:
1. Modify SelectableObject's useFrame to apply rotation
2. Extract plane normal from anchor matrix
3. Create rotation quaternion from axis and angle
4. Apply rotation to object matrix
5. Test: Manually change rotation state → object rotates

**Files to modify**:
- `src/components/ARHitTestManager.tsx` (SelectableObject component)

**Success Criteria**:
- Object rotates around plane normal
- Rotation works for horizontal planes (floor/table)
- Rotation works for vertical planes (walls) - test if available
- Object maintains correct position and orientation

### Phase 3: RingGeometry Visual

**What to implement**:
1. Create RotateRing component
2. Calculate ring radius from object bounding box
3. Position ring at object's Y midpoint
4. Ensure ring is parallel to placement plane
5. Only show when selected and mode='rotate'
6. Remove old SelectionHighlight wireframe

**Files to modify**:
- `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Yellow ring appears around selected object in rotate mode
- Ring is parallel to placement plane
- Ring is at vertical midpoint of object
- Ring scales appropriately for different object sizes
- Ring disappears when mode changes or object deselected

### Phase 4: Thumbstick Input

**What to implement**:
1. Create RotationController component
2. Read left and right thumbstick X-axis values
3. Implement "latest input" logic for both thumbsticks
4. Apply dead zone (0.1)
5. Calculate delta rotation (30 deg/sec with frame time)
6. Update object rotation via onRotate callback
7. Test: Rotation smooth and responsive

**Files to modify**:
- `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Thumbstick right rotates object clockwise
- Thumbstick left rotates object counter-clockwise
- Rotation speed is 30 degrees per second
- Smooth, real-time rotation
- Either left or right thumbstick works
- Both thumbsticks don't conflict (latest wins)

### Phase 5: Mode Toggling

**What to implement**:
1. Create ModeController component
2. Detect 'A' button press on right controller
3. Implement edge detection (prevent hold-triggering)
4. Cycle through modes: rotate → scale → move → rotate
5. Add placeholder visuals for scale/move modes
6. Test: Mode toggle with console logging

**Files to modify**:
- `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- 'A' button cycles through modes
- Mode change logged to console
- Rotate mode shows ring
- Scale/move modes show placeholder (small cube)
- Mode persists across selections
- Cannot toggle mode when no object selected

### Phase 6: Testing & Polish

**What to test**:
1. Rotation accuracy and smoothness on Quest 2
2. Ring visibility and positioning
3. Mode toggling responsiveness
4. Rotation with different object types (table, bed, sofa)
5. Rotation on horizontal vs vertical planes
6. Edge cases: rapid mode switching, rapid rotations

**Polish**:
1. Adjust ring thickness if needed (inner vs outer radius)
2. Verify rotation direction (clockwise vs counter-clockwise)
3. Add console logs for debugging
4. Test ring scaling with different object sizes

**Success Criteria**:
- Smooth, intuitive rotation experience
- Clear visual feedback with ring
- Responsive thumbstick input
- Reliable mode toggling
- Works across all object types and plane orientations

## Code Structure

### New Components

**RotateRing** - Visual indicator for rotate mode
- Yellow ring that surrounds selected object
- Parallel to placement plane
- Positioned at object's vertical midpoint
- Scales based on object bounding box

**RotationController** - Handles thumbstick input
- Monitors left and right thumbstick X-axis
- Implements latest-input-source logic
- Applies rotation speed with dead zone
- Only active when selected and mode='rotate'

**ModeController** - Handles 'A' button for mode toggling
- Monitors right controller 'A' button
- Edge detection for button press
- Cycles through transform modes
- Only active when object is selected

**ModificationVisuals** - Container for mode-specific visuals
- Shows RotateRing in rotate mode
- Shows placeholder for scale mode (cube)
- Shows placeholder for move mode (cube)
- Replaces Feature 4.1's SelectionHighlight

### Modified Components

**SelectableObject**
- Added `rotation` prop (rotation angle in radians)
- Modified useFrame to apply rotation around plane normal
- Extract plane normal from anchor matrix
- Apply quaternion-based rotation
- Render ModificationVisuals instead of SelectionHighlight

**PlacementHandler**
- Added `transformMode` state management
- Added `rotation` field to anchoredObjects
- Added `handleRotate` callback (updates rotation state)
- Added `handleToggleMode` callback (cycles modes)
- Render RotationController and ModeController

### Modified Files

**src/components/ARHitTestManager.tsx**
- All Feature 4.2 Rotate Mode changes in this file
- No changes to App.tsx or ObjectPalette.tsx
- Self-contained feature implementation

## Technical Challenges & Solutions

### Challenge 1: Ring Scaling with Object Size

**Problem**: Ring must be 30cm larger than bounding box diagonal, which varies per object type.

**Solution**:
- Calculate bounding box dynamically using `Box3.setFromObject()`
- Compute diagonal: `size.length()`
- Ring outer radius = `(diagonal / 2) + 0.3`
- Recalculate when object changes or when entering rotate mode
- Use `useMemo` or `useState` to cache calculated radius

**Implementation**:
```tsx
const ringRadius = useMemo(() => {
  if (!groupRef.current) return 0.5
  const bbox = new THREE.Box3().setFromObject(groupRef.current)
  const size = bbox.getSize(new THREE.Vector3())
  return (size.length() / 2) + 0.3
}, [groupRef.current, type]) // Recalc when object changes
```

### Challenge 2: Rotation Direction Consistency

**Problem**: Ensure "right = clockwise, left = counter-clockwise" from user's perspective.

**Solution**:
- Clockwise as viewed from +Y (above the plane)
- Positive rotation angle = clockwise
- Thumbstick right (positive X) = positive angle
- Plane normal might point up or down depending on plane

**Verification**:
```tsx
// Test: Place object on floor, look down at it
// Right thumbstick → object rotates clockwise
// If reversed, negate the rotation:
const deltaRotation = -rotationInput * rotationSpeed * delta
```

**Key**: Test on actual device with visual reference (asymmetric object like table).

### Challenge 3: Matrix Multiplication Order

**Problem**: Order of matrix operations affects final result.

**Correct Order**:
1. Apply anchor's base transformation (position + plane orientation)
2. Apply rotation around plane normal
3. Apply Y offset for base positioning

```tsx
groupRef.current.matrix.fromArray(anchorPose.transform.matrix)  // 1. Base
const rotationMatrix = new THREE.Matrix4().makeRotationFromQuaternion(rotationQuat)
groupRef.current.matrix.multiply(rotationMatrix)                // 2. Rotation
const yOffsetMatrix = new THREE.Matrix4().makeTranslation(0, yOffset, 0)
groupRef.current.matrix.multiply(yOffsetMatrix)                 // 3. Offset
```

**Why**: Transformations applied left-to-right in world space. Anchor matrix sets base coordinate system, rotation happens in that space, then offset along local Y.

### Challenge 4: Both Thumbsticks Used Simultaneously

**Problem**: Requirement says "take latest input and ignore previous" but unclear how to implement.

**Solution Options**:

1. **Track last input source** (implemented above)
   - Remember which thumbstick was last active
   - When both active, use the remembered one
   - Problem: What if user holds both from the start?

2. **Use strongest input**
   - Compare absolute values: use whichever has larger magnitude
   - More intuitive, no edge cases
   ```tsx
   const input = Math.abs(leftX) > Math.abs(rightX) ? leftX : rightX
   ```

3. **Sum inputs**
   - Allow both to contribute
   - Simplest, but not per requirements

**Recommendation**: Use "strongest input" approach (option 2) as it's more robust and user-friendly.

### Challenge 5: Ring Positioning on Non-Horizontal Planes

**Problem**: Ring must be at "vertical midpoint" of object's height, but what is "vertical" for a wall-mounted object?

**Clarification Needed**: "Vertical midpoint" likely means midpoint along object's local Y-axis (height in object's coordinate system), not world Y.

**Solution**:
- Calculate bounding box to get object's local dimensions
- Midpoint = `size.y / 2` in object's local coordinates
- Translate ring by this amount along anchor's local Y-axis (which is plane normal)
```tsx
const yMidpoint = size.y / 2
const translation = new THREE.Matrix4().makeTranslation(0, yMidpoint, 0)
ringMatrix.multiply(translation)
```

This works for any plane orientation because we're translating along the plane normal, not world Y.

## Performance Considerations

### Bounding Box Calculations

**Frequency**: Each frame vs. on-demand?

**Analysis**:
- `Box3.setFromObject()` traverses entire object hierarchy
- For GLB models with many meshes, this could be expensive
- Object dimensions only change during scaling (Feature 4.2.2)

**Optimization**:
- Calculate once when entering rotate mode
- Store in component state or ref
- Recalculate only when:
  - Object changes (selection changes)
  - Scale mode modifies object (Feature 4.2.2)

**Implementation**:
```tsx
const [ringParams, setRingParams] = useState({ radius: 0.5, yPos: 0.25 })

useEffect(() => {
  if (!isSelected || transformMode !== 'rotate' || !groupRef.current) return

  const bbox = new THREE.Box3().setFromObject(groupRef.current)
  const size = bbox.getSize(new THREE.Vector3())

  setRingParams({
    radius: (size.length() / 2) + 0.3,
    yPos: size.y / 2
  })
}, [isSelected, transformMode, objectScale]) // objectScale from Feature 4.2.2
```

### Frame Rate Impact

**Concerns**:
- Quaternion calculations each frame
- Matrix operations for rotation
- Ring positioning updates

**Analysis**:
- Quaternion operations are fast (native math)
- Matrix multiplications: ~200-300 operations each
- Modern devices handle easily at 90fps

**Optimization**:
- Only calculate rotation when thumbstick active
- Skip ring position updates when not in rotate mode
- Use conditional rendering for mode visuals

**Expected Performance**: No measurable impact with <30 objects (per CLAUDE.md recommendations).

## Integration with Existing Features

### Feature 4.1 (Object Selection)

**Dependencies**:
- Uses `selectedObjectId` state from Feature 4.1
- Rotation only works when object is selected
- Mode toggle only works when object is selected

**Changes to Feature 4.1**:
- Remove SelectionHighlight wireframe
- Replace with ModificationVisuals (mode-dependent)

### Future Features

**Feature 4.2.2 (Scale Mode)**:
- Will add `scale` field to AnchoredObjectData
- Ring radius must update when object scaled
- Scale mode will have its own visual (cone + torus slider)

**Feature 4.2.3 (Move Mode)**:
- Will use grip button for movement
- Move mode will have its own visual (red axes)
- Movement constrained to plane (same plane as rotation)

## Testing Strategy

### Desktop Testing (WebXR Emulator)

1. **Rotation Testing**:
   - Select object → verify ring appears
   - Simulate thumbstick input (keyboard)
   - Verify object rotates smoothly
   - Check rotation direction (right = clockwise)

2. **Mode Toggling**:
   - Simulate 'A' button press
   - Verify mode cycles: rotate → scale → move → rotate
   - Verify visual changes (ring → placeholder cube)

3. **State Persistence**:
   - Rotate object → deselect → reselect
   - Verify rotation persists
   - Verify mode persists

### Quest 2 Device Testing

1. **Ring Visual**:
   - Verify ring is visible and yellow
   - Check ring is parallel to placement plane
   - Test on floor, table, wall (if available)
   - Verify ring scales with object size

2. **Thumbstick Rotation**:
   - Test left thumbstick (left/right)
   - Test right thumbstick (left/right)
   - Test both simultaneously → latest should win
   - Verify smooth, responsive rotation
   - Verify 30 deg/sec speed feels natural

3. **'A' Button**:
   - Test mode toggle
   - Verify single press = single toggle (not continuous)
   - Verify mode persists across selections

4. **Object Types**:
   - Test with table (asymmetric, easy to see rotation)
   - Test with bed (large object)
   - Test with sofa (medium object)
   - Verify ring scaling is appropriate

5. **Plane Orientations**:
   - Test on floor (horizontal)
   - Test on table (horizontal, elevated)
   - Test on wall (vertical) - if plane detection works

### Edge Cases

1. **Rapid mode switching**: Press 'A' repeatedly → no crashes, visual updates correctly
2. **Rotation during mode switch**: Rotate → press 'A' → verify rotation stops
3. **Deselect during rotation**: Rotate → deselect → verify rotation stops, ring disappears
4. **Multiple objects**: Rotate object A → select object B → verify B's independent rotation state
5. **Delete during rotation**: Rotate → press B → verify object deleted, no errors

## Key Learnings Applied

### From docs/r3f-learnings.md

1. **Matrix-based positioning**: Continue using `matrixAutoUpdate={false}` pattern from AR features
2. **Thumbstick input**: Use `useXRInputSourceState` hook with dead zone
3. **Button detection**: Edge detection pattern with `useRef` from Feature 4.1
4. **Performance**: Use refs for per-frame calculations, state for UI updates

### From docs/feature2-research.md

1. **Anchor matrix structure**: Y-axis is plane normal (perpendicular to surface)
2. **Direct matrix usage**: Don't decompose, multiply matrices for transformations
3. **Geometry origin**: Account for geometry's center when positioning (used for ring)

### From docs/feature4-1-research.md

1. **Button patterns**: Same edge detection pattern for 'A' button as 'B' button
2. **State management**: Keep modification state in PlacementHandler
3. **Visual feedback**: Replace SelectionHighlight with mode-specific visuals

### New Patterns for Feature 4.2

1. **Quaternion rotation**: Use `setFromAxisAngle()` for rotation around arbitrary axis
2. **Bounding box sizing**: Calculate object dimensions for dynamic visual scaling
3. **Mode state management**: Transform mode persists across selections
4. **Conditional visual rendering**: Show different visuals based on active mode

## API Reference

### Three.js APIs Used

**RingGeometry**:
```tsx
new THREE.RingGeometry(innerRadius, outerRadius, thetaSegments)
// innerRadius: 0.85 * outerRadius (for visible ring)
// outerRadius: (bbox diagonal / 2) + 0.3
// thetaSegments: 32 (smooth circle)
```

**Box3 (Bounding Box)**:
```tsx
const bbox = new THREE.Box3().setFromObject(object)
const size = bbox.getSize(new THREE.Vector3())    // dimensions
const center = bbox.getCenter(new THREE.Vector3()) // center point
const diagonal = size.length()                     // diagonal length
```

**Quaternion Rotation**:
```tsx
const quat = new THREE.Quaternion()
quat.setFromAxisAngle(axis: Vector3, angle: number)
object.quaternion.copy(quat)
// or
object.quaternion.multiplyQuaternions(baseQuat, rotationQuat)
```

**Matrix Rotation**:
```tsx
const rotMatrix = new THREE.Matrix4().makeRotationFromQuaternion(quat)
objectMatrix.multiply(rotMatrix)
```

**Extract Basis from Matrix**:
```tsx
const xAxis = new THREE.Vector3()
const yAxis = new THREE.Vector3()
const zAxis = new THREE.Vector3()
matrix.extractBasis(xAxis, yAxis, zAxis)
```

### XR Controller APIs

**Thumbstick Access**:
```tsx
const controller = useXRInputSourceState('controller', 'left' | 'right')
const thumbstick = controller?.gamepad?.['xr-standard-thumbstick']
const xAxis = thumbstick?.xAxis ?? 0  // -1 to 1 (left to right)
const yAxis = thumbstick?.yAxis ?? 0  // -1 to 1 (back to forward)
```

**'A' Button Access**:
```tsx
const rightController = useXRInputSourceState('controller', 'right')
const aButton = rightController?.gamepad?.['a-button']
const isPressed = aButton?.state === 'pressed'
```

## References

### Documentation

- [Three.js RingGeometry](https://threejs.org/docs/#api/en/geometries/RingGeometry)
- [Three.js Box3](https://threejs.org/docs/#api/en/math/Box3)
- [Three.js Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
- [Three.js Matrix4](https://threejs.org/docs/#api/en/math/Matrix4)
- [WebXR Gamepads Module](https://www.w3.org/TR/webxr-gamepads-module-1/)

### Codebase References

- `src/components/ARHitTestManager.tsx` - Selection, anchors, matrix positioning
- `src/components/ObjectPalette.tsx` - Button input patterns (Y/X buttons)
- `docs/r3f-learnings.md` - Controller input, matrix operations
- `docs/feature2-research.md` - Anchor matrix structure, plane normals
- `docs/feature4-1-research.md` - Selection state, button detection
