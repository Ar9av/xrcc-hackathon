# Feature 4.2 Move Mode Research: Object Movement with Grip Drag

## Overview

This document provides comprehensive research for implementing **Move Mode** in Feature 4.2. Move mode allows users to reposition selected AR objects by holding the grip button and dragging their hand along the object's local X and Y axes. The movement is constrained to the plane on which the object was originally placed.

**Key Challenge**: Tracking real-time controller position changes, projecting movement onto the object's local plane, and applying visual offset while maintaining proper AR tracking.

This research covers:
1. Requirements analysis and clarifications
2. Axes visualization with ArrowHelper
3. Controller position tracking and movement calculation
4. Plane-constrained movement mathematics
5. Grip button input handling
6. Integration with existing transform modes

## Requirements Summary

Based on `docs/r3f-feature-exploration.md` Feature 4.2 Move Mode and user clarifications:

### Visual Description

**Axes Component Structure**:
- Two perpendicular axes (X and Y) appear centered on the selected object
- Axes correspond to the object's **local X and Y directions** (follow object rotation)
- Axes are parallel to the placement plane (not global X and Y)
- Axes positioned above the object (same positioning logic as scale slider)
- Axes appear at object's center in local space but raised along plane normal
- Color: Red for both axes
- Axes must scale with object size to remain visible
- Axes consist of line + cone at the end (standard 3D axis appearance)

**Axes Positioning Logic** (from scale mode):
```
Position = anchor_position + (object_height + 0.3m) * plane_normal
```
- Same vertical offset logic as scale slider (30cm above object)
- Positioned perpendicular to plane, oriented along object's local X/Y

**Axes Orientation**:
- X-axis: Points along object's local X direction
- Y-axis: Points along object's local Y direction
- Both axes rotate with the object (unlike scale slider which stays vertical)
- Axes are parallel to the plane (lie flat on the plane's surface)

### Movement Behavior

**Movement Constraints**:
- Object can **only move along the plane** on which it was created
- Movement uses object's local X and Y axes (not global/plane axes)
- No movement perpendicular to the plane (no Z-axis movement)

**Input Method**:
- Hold grip button on either left OR right controller
- Drag hand along the X and Y directions shown by axes
- Both X and Y components of hand movement are translated to object movement
- Release grip button to stop moving (object remains in move mode)
- Prioritization: Latest input wins (same as rotate/scale modes)

**Movement Calculation**:
- Track controller position when grip is first pressed (initial position)
- Calculate delta from initial position to current position
- Project delta onto object's local X and Y axes
- Apply sensitivity multiplier: **2.0** (moving hand 1m moves object 2m)
- Movement should be smooth and real-time

**Sensitivity Factor**: 2.0
- User moves hand 1 meter → Object moves 2 meters
- Makes movement more responsive and less physically tiring

**Position Storage**:
- Movement offset stored as `movementOffset` in object state
- Applied visually to object position in real-time
- Visualization components (axes, slider) use object's world position
- Anchor remains at original placement location

### Mode Management

**Entry/Exit**:
- Enter move mode: Press 'A' button when in scale mode
- Exit move mode: Press 'A' button to cycle back to rotate mode
- Visual feedback: Red axes visible only in move mode
- Deselecting object removes axes

**State Persistence**:
- Object position persists after exiting move mode
- Position persists when deselecting and reselecting object
- Each object has independent position (stored as movementOffset)

## User Workflow

1. **Select Object**: Point at placed object → Press trigger → Object selected (in rotate mode by default)
2. **Enter Move Mode**: Press 'A' twice (rotate → scale → move) → Red axes appear above object
3. **Start Moving**:
   - Hold grip button on left or right controller
   - Initial controller position is recorded
4. **Drag to Move**:
   - Move hand along visible X/Y axes directions
   - Object follows hand movement with 2x sensitivity
   - Movement constrained to placement plane
   - Real-time smooth movement
5. **Stop Moving**: Release grip button → Object stops, remains in move mode
6. **Continue Adjusting**: Can press grip again to make further adjustments
7. **Switch Modes**: Press 'A' → Cycle to rotate mode (axes disappear)
8. **Verify**: Return to rotate mode → Object rotates around its visual position

## Component Architecture

```
SelectableObject (parent group with matrixAutoUpdate=false)
├── GLB Model (positioned at anchor + offset)
├── ModificationVisuals (when isSelected=true)
│   ├── RotateRing (mode='rotate')
│   ├── MoveAxes (mode='move') ← NEW
│   │   ├── AxesGroup (positioned above object)
│   │   │   ├── X-Axis ArrowHelper (red, along local X)
│   │   │   └── Y-Axis ArrowHelper (red, along local Y)
│   └── (Scale slider rendered at PlacementHandler level)
├── MoveController (grip button + drag handler) ← NEW
└── ModeController (A button toggle - existing)
```

**New Components**:
- `MoveAxes`: Renders two perpendicular red axes above the object
- `MoveController`: Handles grip button hold and controller position tracking

**Modified Components**:
- `SelectableObject`: Apply movementOffset to visual position
- `ModificationVisuals`: Add MoveAxes rendering for move mode
- `PlacementHandler`: Store and manage movementOffset in object state

## State Management

### Current State (from Rotate and Scale Modes)

```tsx
// In PlacementHandler component
interface AnchoredObjectData {
  id: string
  anchor: XRAnchor
  type: 'table' | 'bed' | 'sofa' | 'round-table'
  rotation: number       // Existing from rotate mode
  scale: number          // Existing from scale mode
  movementOffset: THREE.Vector3  // NEW for move mode
}

const [transformMode, setTransformMode] = useState<TransformMode>('rotate')
const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
```

### Additional State for Move Mode

```tsx
// Persistent state: movementOffset in AnchoredObjectData (see above)
// Initialized to (0, 0, 0) when object is placed

// Temporary state during drag (in MoveController component)
interface MovementState {
  isMoving: boolean
  initialControllerPos: THREE.Vector3 | null
  activeHand: 'left' | 'right' | null
}
```

**Key Insight**: Movement is stored as an offset from the original anchor position. The anchor stays at the original placement location, and `movementOffset` is applied visually to the object.

### State Update Pattern

```tsx
// In PlacementHandler
const handleMove = (objectId: string, deltaMovement: THREE.Vector3) => {
  setAnchoredObjects(prev => prev.map(o =>
    o.id === objectId
      ? { ...o, movementOffset: o.movementOffset.clone().add(deltaMovement) }
      : o
  ))
}
```

## Technical Implementation Details

### 1. ArrowHelper for Axes Visualization

**Three.js ArrowHelper API**:
```tsx
new THREE.ArrowHelper(
  dir,        // Direction from origin (must be unit vector)
  origin,     // Point at which arrow starts
  length,     // Length of arrow (default: 1)
  hex,        // Color as hexadecimal (default: 0xffff00)
  headLength, // Length of arrow head (default: 0.2 * length)
  headWidth   // Width of arrow head (default: 0.2 * headLength)
)
```

**Creating Two Perpendicular Axes**:
```tsx
function MoveAxes({ objectRef, anchor, xrRefSpace }: MoveAxesProps) {
  const axesGroupRef = useRef<THREE.Group>(null)
  const { session } = useXR()

  // Create arrow helpers once (red color = 0xff0000)
  const xAxisArrow = useMemo(() =>
    new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),  // X direction
      new THREE.Vector3(0, 0, 0),  // Origin
      0.5,                          // 50cm length
      0xff0000,                     // Red
      0.1,                          // 10cm head
      0.05                          // 5cm head width
    ), []
  )

  const yAxisArrow = useMemo(() =>
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),  // Y direction (will be object's local Y)
      new THREE.Vector3(0, 0, 0),  // Origin
      0.5,                          // 50cm length
      0xff0000,                     // Red
      0.1,                          // 10cm head
      0.05                          // 5cm head width
    ), []
  )

  useFrame((state) => {
    if (!session || !xrRefSpace || !axesGroupRef.current || !objectRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame?.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Position axes above object (similar to scale slider)
    const axesPosition = calculateAxesPosition(objectRef, anchor, anchorPose)
    axesGroupRef.current.position.copy(axesPosition)

    // Orient axes to match object's rotation on the plane
    const axesOrientation = calculateAxesOrientation(objectRef, anchorPose)
    axesGroupRef.current.quaternion.copy(axesOrientation)

    // Update arrow directions based on object rotation
    updateArrowDirections(xAxisArrow, yAxisArrow, axesOrientation)
  })

  return (
    <group ref={axesGroupRef}>
      <primitive object={xAxisArrow} />
      <primitive object={yAxisArrow} />
    </group>
  )
}
```

**Key Points**:
- ArrowHelper is a Three.js Object3D, use `<primitive object={arrowHelper} />`
- Create once with `useMemo`, update direction/position in `useFrame`
- Both axes share same origin (center of axes visualization)
- Direction vectors must be unit vectors (normalized)

### 2. Axes Positioning Above Object

**Requirement**: Position axes 30cm above object, perpendicular to plane (same as scale slider).

**Implementation Pattern**:
```tsx
// Calculate actual object height from GLB model (cached)
const unscaledHeight = useMemo(() => {
  if (!objectRef.current) return 0.5
  const bbox = new THREE.Box3().setFromObject(objectRef.current)
  const size = bbox.getSize(new THREE.Vector3())
  return size.y
}, [objectRef])

useFrame((state) => {
  if (!objectRef.current) return

  // Get object's actual world position (includes movementOffset)
  const objectWorldPos = new THREE.Vector3()
  objectRef.current.getWorldPosition(objectWorldPos)

  // Extract plane normal from anchor
  const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
  const anchorQuat = new THREE.Quaternion()
  anchorMatrix.decompose(new THREE.Vector3(), anchorQuat, new THREE.Vector3())
  const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

  // Calculate scaled height (accounts for user scale from scale mode)
  const scaledHeight = unscaledHeight * baseScale * scale

  // Position axes: objectWorldPos + (scaledHeight + clearance) * planeNormal
  const clearance = 0.3  // 30cm above object
  const axesPos = objectWorldPos.clone()
    .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))

  axesGroupRef.current.position.copy(axesPos)
})
```

**Why This Works**:
- `objectRef.current.getWorldPosition()` automatically includes movementOffset
- No need to manually track or pass movementOffset to visualization components
- Plane normal still comes from anchor (defines surface orientation)
- For floor: normal ≈ (0, 1, 0) → axes move up
- For wall: normal ≈ (1, 0, 0) or similar → axes move away from wall
- Clearance ensures axes don't intersect with object as it scales

### 3. Axes Orientation: Follow Object Rotation

**Requirement**: Axes follow object's rotation (unlike scale slider which stays vertical).

**Challenge**: Axes must be:
1. Parallel to the placement plane (not sticking up perpendicular)
2. Rotated to match object's current rotation state
3. Still show object's local X and Y directions clearly

**Approach**: Extract object's rotation from anchor + user rotation.

```tsx
function calculateAxesOrientation(anchorPose: XRPose, objectRotation: number) {
  // Get anchor's base orientation (plane orientation)
  const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
  const anchorQuat = new THREE.Quaternion()
  anchorMatrix.decompose(new THREE.Vector3(), anchorQuat, new THREE.Vector3())

  // Get plane normal (rotation axis)
  const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

  // Create rotation quaternion around plane normal
  const rotationQuat = new THREE.Quaternion().setFromAxisAngle(planeNormal, objectRotation)

  // Combine: anchor orientation + user rotation
  const finalQuat = rotationQuat.multiply(anchorQuat)

  return finalQuat
}
```

**Setting Arrow Directions**:
```tsx
function updateArrowDirections(
  xArrow: THREE.ArrowHelper,
  yArrow: THREE.ArrowHelper,
  orientation: THREE.Quaternion
) {
  // Object's local X direction (in world space)
  const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(orientation)
  xArrow.setDirection(localX.normalize())

  // Object's local Y direction (in world space)
  const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(orientation)
  yArrow.setDirection(localY.normalize())

  // Note: Origin stays at (0,0,0) in axes group local space
}
```

**Key Insight**: The axes group itself is oriented and positioned, then the arrows within show X/Y directions in that oriented space.

### 4. Axes Scaling with Object Size

**Requirement**: Axes must be visible beyond object's X and Y dimensions.

**Implementation**:
```tsx
const axesLength = useMemo(() => {
  if (!objectRef.current) return 0.5

  const bbox = new THREE.Box3().setFromObject(objectRef.current)
  const size = bbox.getSize(new THREE.Vector3())

  // Larger of X or Y dimension + 20cm clearance
  const maxDim = Math.max(size.x, size.y)
  return (maxDim / 2) + 0.2
}, [objectRef])

// Update arrow lengths
xAxisArrow.setLength(axesLength, 0.1, 0.05)
yAxisArrow.setLength(axesLength, 0.1, 0.05)
```

**ArrowHelper.setLength() API**:
```tsx
arrowHelper.setLength(
  length,     // Total length of arrow
  headLength, // Length of cone at end (optional)
  headWidth   // Width of cone (optional)
)
```

### 5. Controller Position Tracking

**Requirement**: Track controller position in real-time while grip button is held.

**Pattern from r3f-learnings.md**:
```tsx
// WRONG: Using controller.position (returns local coords)
const pos = controller.object.position.clone()

// CORRECT: Using getWorldPosition (returns world coords)
const pos = new THREE.Vector3()
controller.object.getWorldPosition(pos)
```

**MoveController Implementation**:
```tsx
function MoveController({
  selectedObjectId,
  transformMode,
  onMove
}: MoveControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  // Movement state (reset when grip released)
  const isMoving = useRef(false)
  const activeHand = useRef<'left' | 'right' | null>(null)
  const initialControllerPos = useRef<THREE.Vector3 | null>(null)
  const initialObjectPos = useRef<THREE.Vector3 | null>(null)

  // Previous grip button states for edge detection
  const prevLeftGrip = useRef(false)
  const prevRightGrip = useRef(false)

  useFrame((state, delta) => {
    // Only active when object selected and in move mode
    if (!selectedObjectId || transformMode !== 'move') {
      isMoving.current = false
      return
    }

    // Check grip button states
    const leftGrip = leftController?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'
    const rightGrip = rightController?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'

    // Detect grip press (edge: false → true)
    const leftGripPressed = leftGrip && !prevLeftGrip.current
    const rightGripPressed = rightGrip && !prevRightGrip.current

    // Prioritize latest input
    if (leftGripPressed || (leftGrip && activeHand.current === 'left')) {
      handleGripPress('left', leftController)
    } else if (rightGripPressed || (rightGrip && activeHand.current === 'right')) {
      handleGripPress('right', rightController)
    }

    // Detect grip release
    if (!leftGrip && !rightGrip) {
      isMoving.current = false
      activeHand.current = null
      initialControllerPos.current = null
    }

    // Update previous states
    prevLeftGrip.current = leftGrip
    prevRightGrip.current = rightGrip

    // Handle ongoing movement
    if (isMoving.current && activeHand.current) {
      const controller = activeHand.current === 'left' ? leftController : rightController
      handleMovement(controller)
    }
  })

  const handleGripPress = (hand: 'left' | 'right', controller: any) => {
    if (!controller?.object) return

    // Record initial positions on first press
    if (!isMoving.current) {
      isMoving.current = true
      activeHand.current = hand

      // Get controller world position
      const controllerPos = new THREE.Vector3()
      controller.object.getWorldPosition(controllerPos)
      initialControllerPos.current = controllerPos.clone()

      // Get object's current anchor position (will need from parent)
      // This is passed via callback or ref
      initialObjectPos.current = getCurrentObjectPosition()

      console.log('Grip pressed - starting movement', { hand, controllerPos })
    }
  }

  const handleMovement = (controller: any) => {
    if (!controller?.object || !initialControllerPos.current) return

    // Get current controller position
    const currentControllerPos = new THREE.Vector3()
    controller.object.getWorldPosition(currentControllerPos)

    // Calculate delta movement
    const delta = currentControllerPos.clone().sub(initialControllerPos.current)

    // Apply sensitivity
    const SENSITIVITY = 2.0
    const movement = delta.multiplyScalar(SENSITIVITY)

    // Project movement onto object's plane and local axes (see section 6)
    const projectedMovement = projectMovementOntoPlane(movement)

    // Update object position via callback
    onMove(projectedMovement)
  }

  return null
}
```

**Key Points**:
- Track grip button state with edge detection (same pattern as A/B buttons)
- Prioritize latest input: if both grips pressed, use most recent
- Record initial positions only on first press
- Calculate delta from initial, not frame-to-frame (more stable)
- Real-time: callback fires every frame while moving

### 6. Movement Projection onto Plane

**Requirement**: Project 3D controller movement onto object's local X/Y plane.

**Mathematical Approach**:
1. Get controller movement delta in world space
2. Get object's local X and Y axes in world space
3. Project delta onto X-axis → X component
4. Project delta onto Y-axis → Y component
5. Reconstruct movement as: `newPos = oldPos + (X_component * X_axis) + (Y_component * Y_axis)`

**Implementation**:
```tsx
function projectMovementOntoPlane(
  worldDelta: THREE.Vector3,
  anchorPose: XRPose,
  objectRotation: number
): THREE.Vector3 {
  // Extract anchor orientation
  const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
  const anchorQuat = new THREE.Quaternion()
  anchorMatrix.decompose(new THREE.Vector3(), anchorQuat, new THREE.Vector3())

  // Get plane normal
  const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

  // Apply object rotation around plane normal
  const rotationQuat = new THREE.Quaternion().setFromAxisAngle(planeNormal, objectRotation)
  const finalQuat = rotationQuat.multiply(anchorQuat)

  // Get object's local X and Y axes in world space
  const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(finalQuat)
  const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(finalQuat)

  // Project delta onto local axes (dot product)
  const xComponent = worldDelta.dot(localX)
  const yComponent = worldDelta.dot(localY)

  // Reconstruct movement in plane
  const projectedMovement = new THREE.Vector3()
    .addScaledVector(localX, xComponent)
    .addScaledVector(localY, yComponent)

  return projectedMovement
}
```

**Vector Projection Math**:
```
Given:
- delta: 3D movement vector in world space
- axis: unit vector of axis to project onto

Projection formula:
  component = delta · axis  (dot product)
  projected_vector = component * axis
```

**Why This Works**:
- Dot product extracts the component of delta along each axis
- Multiplying back by axis vector gives movement in that direction
- Summing X and Y components reconstructs total movement in plane
- Ignores any Z component (perpendicular to plane)

### 7. Real-Time Visual Updates with Movement Offset

**Approach**: Store movement as an offset from the anchor position, apply it visually in real-time.

**Implementation Pattern**:
```tsx
function SelectableObject({
  anchor,
  rotation,
  scale,
  movementOffset  // NEW: persistent offset from anchor
}: SelectableObjectProps) {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!groupRef.current) return

    const frame = state.gl.xr.getFrame()
    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Base position from anchor
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorPos = new THREE.Vector3()
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(anchorPos, anchorQuat, new THREE.Vector3())

    // Apply movement offset
    const finalPos = anchorPos.clone().add(movementOffset)

    // Apply rotation
    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)
    const rotationQuat = new THREE.Quaternion().setFromAxisAngle(planeNormal, rotation)
    const finalQuat = rotationQuat.multiply(anchorQuat)

    // Apply Y offset
    const yOffset = /* calculate from bbox */ 0.5
    const offsetPos = finalPos.clone().add(
      planeNormal.clone().multiplyScalar(yOffset * scale)
    )

    // Update matrix
    groupRef.current.matrix.compose(offsetPos, finalQuat, new THREE.Vector3(1, 1, 1))
  })

  return <group ref={groupRef} matrixAutoUpdate={false}>...</group>
}
```

**Key Benefits**:
- No async anchor updates needed
- Movement is immediate and smooth
- Simple state management (just a Vector3 offset)
- Anchor stays at original placement location (AR tracking remains stable)
- Rotation and scale work correctly around visual position

### CRITICAL: Correct Position Update Pattern

**Problem Discovered During Implementation:**

There are two approaches to updating the object position, but only one is correct:

#### ❌ INCORRECT Approach (Causes Velocity Bug):
```tsx
// In MoveController.updateMovement() - called every frame
const delta = currentControllerPos.clone().sub(initialControllerPos)
const movement = delta.multiplyScalar(SENSITIVITY)
const projectedMovement = projectMovementOntoPlane(movement, ...)

// In handleMoveObject() - called every frame
setAnchoredObjects(prev => prev.map(obj => {
  if (obj.id === selectedObjectId) {
    // WRONG: Adding delta to current offset every frame
    return { ...obj, movementOffset: obj.movementOffset.clone().add(deltaMovement) }
  }
  return obj
}))
```

**Why This Fails:**
- Frame 1: Hand moves 0.5m from start → delta = 0.5m → offset becomes 0 + 0.5 = 0.5m
- Frame 2: Hand still at 0.5m from start → delta = 0.5m → offset becomes 0.5 + 0.5 = 1.0m
- Frame 3: Hand still at 0.5m from start → delta = 0.5m → offset becomes 1.0 + 0.5 = 1.5m
- Frame 4-∞: **Object keeps accelerating** even though hand is steady!

At 90fps, this accumulates 0.5m × 90 = 45 meters per second of unwanted movement.

#### ✅ CORRECT Approach (Direct Position Mapping):
```tsx
// In MoveController - store initial object position when grip pressed
const initialMovementOffset = useRef<THREE.Vector3 | null>(null)

const startMovement = (hand, controller) => {
  // ... existing code ...

  // NEW: Capture object's position when grip is first pressed
  const objData = anchoredObjects.find(o => o.id === selectedObjectId)
  if (objData) {
    initialMovementOffset.current = objData.movementOffset.clone()
  }
}

const updateMovement = (controller, state) => {
  // ... calculate delta from initial controller position ...
  const delta = currentControllerPos.clone().sub(initialControllerPos.current)
  const movement = delta.multiplyScalar(SENSITIVITY)
  const projectedMovement = projectMovementOntoPlane(movement, ...)

  // NEW: Pass both initial offset and delta
  onMove(selectedObjectId, initialMovementOffset.current, projectedMovement)
}

// In handleMoveObject() - called every frame
const handleMoveObject = (
  objectId: string,
  initialOffset: THREE.Vector3,
  deltaMovement: THREE.Vector3
) => {
  setAnchoredObjects(prev => prev.map(obj => {
    if (obj.id === objectId) {
      // CORRECT: Set offset to initial + delta (not accumulating)
      return { ...obj, movementOffset: initialOffset.clone().add(deltaMovement) }
    }
    return obj
  }))
}
```

**Why This Works:**
- Frame 1: Hand moves 0.5m from start → delta = 0.5m → offset = initial + 0.5m
- Frame 2: Hand still at 0.5m from start → delta = 0.5m → offset = initial + 0.5m (same!)
- Frame 3: Hand still at 0.5m from start → delta = 0.5m → offset = initial + 0.5m (no change)
- Hand moves to 1.0m from start → delta = 1.0m → offset = initial + 1.0m
- **Object position directly tracks hand position** - no accumulation, no velocity

**Key Principle:**
The object's position should be a **direct function** of the controller's current position, not an **accumulation** of frame-by-frame deltas. This gives you:
- Predictable 1:1 mapping between hand and object
- Object stops when hand stops
- No unwanted acceleration or velocity
- Smooth, responsive control

**Alternative Simpler Approach:**
Instead of passing both initial offset and delta, you could also just set the entire movement offset directly:
```tsx
// Calculate absolute position from hand movement
const newOffset = initialMovementOffset.current.clone().add(projectedMovement)
setAnchoredObjects(prev => prev.map(obj =>
  obj.id === selectedObjectId ? { ...obj, movementOffset: newOffset } : obj
))
```

This is conceptually clearer: "The object's offset IS the initial offset plus the hand's displacement."

## CRITICAL: Correct Visualization Positioning Approaches

**Problem Discovered During Implementation:**

Different visualizations (rotate ring, scale slider, move axes) require different hierarchical approaches to position correctly and respond to object transforms (movement, rotation, scaling).

### Three Approaches for Three Visualizations:

#### 1. ✅ RotateRing - Child Inside Scaled Group

**Hierarchy:**
```tsx
<group ref={groupRef} matrixAutoUpdate={false}>  // Object root
  <group scale={finalScale}>                     // Scaled group
    <primitive object={clonedScene} />           // Model

    {isSelected && transformMode === 'rotate' && (
      <RotateRing />  // ← Inside scaled group
    )}
  </group>
</group>
```

**Positioning:**
```tsx
// Simple local positioning - parent handles all transforms
<mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
  <ringGeometry args={[ringRadius * 0.925, ringRadius, 32]} />
  <meshBasicMaterial color="yellow" side={THREE.DoubleSide} />
</mesh>
```

**Why This Works:**
- Ring is centered on object → position `[0, 0, 0]` in local space
- Ring must scale with object → inside scaled group inherits scale automatically
- Ring must rotate with object → inside object group inherits rotation automatically
- Ring must move with object → inside object group inherits position automatically
- No `useFrame` needed - parent transform handles everything

**Result:** Ring perfectly tracks object position, rotation, and scale with zero code.

---

#### 2. ✅ MoveAxes - Child Inside Scaled Group (with Y offset)

**Hierarchy:**
```tsx
<group ref={groupRef} matrixAutoUpdate={false}>  // Object root
  <group scale={finalScale}>                     // Scaled group
    <primitive object={clonedScene} />           // Model

    {isSelected && transformMode === 'move' && (
      <MoveAxes scale={scale} type={type} baseScale={baseScale} />  // ← Inside scaled group
    )}
  </group>
</group>
```

**Positioning:**
```tsx
function MoveAxes({ scale, type, baseScale }: MoveAxesProps) {
  // Calculate Y position in local space
  const yPosition = useMemo(() => {
    const scaledHeight = unscaledHeight * scale
    const clearance = 0.3  // 30cm above object
    return scaledHeight + clearance
  }, [unscaledHeight, scale])

  // Simple local positioning - parent handles all transforms
  return (
    <group position={[0, yPosition, 0]}>
      <primitive object={xAxisArrow} />
      <primitive object={yAxisArrow} />
    </group>
  )
}
```

**Why This Works:**
- Axes positioned above object → `yPosition = scaledHeight + clearance`
- Axes must scale with object → inside scaled group inherits scale
- Axes must rotate with object → inside object group inherits rotation (axes point along object's local X/Y)
- Axes must move with object → inside object group inherits position
- Only needs to recalculate `yPosition` when scale changes (useMemo optimization)

**Result:** Axes perfectly track object and stay 30cm above, scaling and rotating automatically.

---

#### 3. ✅ ScaleSlider - Sibling Using `getWorldPosition()`

**Hierarchy:**
```tsx
// At PlacementHandler level (OUTSIDE object hierarchy)
{isSelected && transformMode === 'scale' && (
  <ScaleSlider
    objectRef={objectRef}  // Pass ref to track object
    anchor={anchor}
    xrRefSpace={xrRefSpace}
    type={type}
    scale={scale}
    baseScale={baseScale}
  />
)}
```

**Positioning:**
```tsx
function ScaleSlider({ objectRef, anchor, ... }: ScaleSliderProps) {
  useFrame((state) => {
    if (!objectRef.current) return

    // Get object's actual world position (includes movementOffset!)
    const objectWorldPos = new THREE.Vector3()
    objectRef.current.getWorldPosition(objectWorldPos)

    // Get plane normal from anchor
    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(new THREE.Vector3(), anchorQuat, new THREE.Vector3())
    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Position slider above object's world position
    const scaledHeight = unscaledHeight * baseScale * scale
    const clearance = 0.5
    const sliderPos = objectWorldPos.clone()
      .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))

    sliderGroupRef.current.position.copy(sliderPos)

    // Always vertical (global Y-axis) - NOT rotated with object
    sliderGroupRef.current.quaternion.set(0, 0, 0, 1)
  })
}
```

**Why This Works:**
- Slider must NOT rotate with object → rendered as sibling (outside object hierarchy)
- Slider must NOT scale with object → rendered as sibling
- Slider MUST follow object when moved → uses `objectRef.current.getWorldPosition()`
- Slider must stay vertical → explicitly sets identity quaternion (global Y-axis)
- Uses `useFrame` to continuously track object's world position

**Critical Insight:** `objectRef.current.getWorldPosition()` automatically includes `movementOffset` because the object's matrix is composed with `anchorPos + movementOffset` in `SelectableObject.useFrame`.

---

### Why Not Use Anchor Position for ScaleSlider?

**❌ WRONG Approach (doesn't track movement):**
```tsx
// Get anchor position (ORIGINAL placement location)
const anchorPos = new THREE.Vector3()
anchorMatrix.decompose(anchorPos, anchorQuat, new THREE.Vector3())

// Position slider above anchor
const sliderPos = anchorPos.clone()  // ← BUG: Doesn't include movementOffset!
  .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))
```

**Problem:** Anchor position is the ORIGINAL placement location, not the current visual position after movement. The slider would stay at the original position even when the object is moved.

**✅ CORRECT Approach (tracks movement):**
```tsx
// Get object's world position (includes movementOffset)
const objectWorldPos = new THREE.Vector3()
objectRef.current.getWorldPosition(objectWorldPos)

// Position slider above object's current position
const sliderPos = objectWorldPos.clone()  // ✓ Includes movementOffset automatically!
  .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))
```

---

### Decision Matrix: When to Use Each Approach

| Visualization | Must Scale? | Must Rotate? | Must Stay Vertical? | Approach | Hierarchy |
|--------------|------------|--------------|-------------------|----------|-----------|
| **RotateRing** | ✓ Yes | ✓ Yes | ✗ No (lies on plane) | Child in scaled group | Inside |
| **MoveAxes** | ✓ Yes | ✓ Yes | ✗ No (follow object) | Child in scaled group | Inside |
| **ScaleSlider** | ✗ No | ✗ No | ✓ Yes (global Y) | Sibling + getWorldPosition | Outside |

**General Rule:**
- **If visualization should inherit transforms** (scale, rotation, position) → Render as **child** inside scaled group
- **If visualization should NOT inherit some transforms** → Render as **sibling** and use `getWorldPosition()` to track

---

### Passing Refs to Children

**Problem:** ScaleSlider needs access to the object's group ref to call `getWorldPosition()`.

**Solution:** Use `React.forwardRef` and ref map:

```tsx
// In PlacementHandler - create ref map for all objects
const objectRefsMap = useRef<Map<string, React.RefObject<THREE.Group>>>(new Map())

{anchoredObjects.map(({ id, ... }) => {
  // Get or create ref for this object
  if (!objectRefsMap.current.has(id)) {
    objectRefsMap.current.set(id, { current: null })
  }
  const objectRef = objectRefsMap.current.get(id)!

  return (
    <>
      <SelectableObject ref={objectRef} ... />
      {isSelected && transformMode === 'scale' && (
        <ScaleSlider objectRef={objectRef} ... />  // Pass ref to sibling
      )}
    </>
  )
})}

// Make SelectableObject a forwardRef component
const SelectableObject = React.forwardRef<THREE.Group, SelectableObjectProps>(
  function SelectableObject({ ... }, ref) {
    const groupRef = (ref as React.RefObject<THREE.Group>) || useRef<THREE.Group>(null)
    // ...
  }
)
```

**Why This Works:**
- Map stores refs indexed by object ID
- Refs persist across re-renders
- Parent passes ref to both child (SelectableObject) and sibling (ScaleSlider)
- ScaleSlider can access object's transform via `objectRef.current.getWorldPosition()`

## Performance Considerations

### Controller Position Tracking

**Frequency**: Every frame (90-120fps)

**Operations per frame**:
- `getWorldPosition()`: Fast (matrix decomposition)
- Vector subtraction: Trivial
- Dot products (2): Fast (3 multiplications + 2 additions each)
- Vector scaling/addition: Trivial

**Impact**: Negligible (< 0.1ms per frame)

### State Updates

**Frequency**: Once per frame during drag

**Cost**: Vector addition in state update (trivial)

**Impact**: Negligible - just updating a Vector3 reference

### Axes Visualization

**Concern**: ArrowHelper updates every frame

**Analysis**:
- ArrowHelper contains ~200 vertices (line + cone)
- `setDirection()`: Updates rotation matrix only
- `setLength()`: Updates scale matrix only
- No geometry recreation

**Optimization**: Cache arrow helpers in `useMemo`, update only direction/length.

**Expected Impact**: Minimal (< 0.2ms per frame)

### Bounding Box Calculations

**Reuse from Scale Mode**: Cache unscaled object height in `useMemo`, multiply by scale for current height.

```tsx
const unscaledHeight = useMemo(() => {
  if (!objectRef.current) return 0.5
  const bbox = new THREE.Box3().setFromObject(objectRef.current)
  return bbox.getSize(new THREE.Vector3()).y
}, [objectRef])

// In useFrame
const scaledHeight = unscaledHeight * baseScale * scale
```

## Implementation Phases

### Phase 1: Axes Visualization

**Tasks**:
1. Create `MoveAxes` component
2. Implement ArrowHelper creation for X and Y axes
3. Position axes above object (reuse scale slider positioning logic)
4. Orient axes to match object rotation
5. Scale axes based on object size
6. Add to `ModificationVisuals` for move mode

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Red axes appear above selected object in move mode
- Axes are parallel to placement plane
- Axes follow object rotation
- Axes are visible beyond object boundaries
- Axes positioned 30cm above object
- Axes disappear when mode changes or object deselected

### Phase 2: Grip Button Detection

**Tasks**:
1. Create `MoveController` component
2. Detect grip button press/release on both controllers
3. Implement edge detection (prevent hold-triggering)
4. Track active hand (latest input wins)
5. Record initial controller position on grip press
6. Test: Grip press/release logged to console

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Grip press detected on left or right controller
- Grip release stops movement
- Both controllers work independently
- Latest input takes priority when both pressed
- Console logs show grip events

### Phase 3: Controller Position Tracking

**Tasks**:
1. Get controller world position using `getWorldPosition()`
2. Calculate delta from initial position to current position
3. Apply sensitivity factor (2.0)
4. Log movement delta to console
5. Test: Hand movement tracked in real-time

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Controller position tracked every frame while grip held
- Delta calculated relative to initial press position
- Sensitivity multiplier applied correctly
- Console shows movement vectors
- No performance issues

### Phase 4: Movement Projection

**Tasks**:
1. Extract object's local X and Y axes in world space
2. Project controller movement delta onto local axes
3. Calculate X and Y components using dot product
4. Reconstruct projected movement vector
5. Test: Movement constrained to plane

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Movement projected onto object's plane correctly
- Works for horizontal planes (floor)
- Works for vertical planes (wall) if available
- Movement follows object rotation
- No movement perpendicular to plane

### Phase 5: Visual Position Updates and State Management

**Tasks**:
1. Add `movementOffset` to `AnchoredObjectData` interface
2. Pass `movementOffset` to `SelectableObject`
3. Apply offset to visual position in `useFrame`
4. Update `handleMove` to add delta to `movementOffset` state
5. Test real-time visual feedback
6. Ensure smooth, responsive movement
7. Verify movement persists after grip released

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Object moves immediately when hand moves
- Movement is smooth (no jitter)
- Movement stops when grip released
- Object position updates in real-time
- 2x sensitivity feels natural
- Position persists after releasing grip
- Position persists when deselecting/reselecting object

### Phase 6: Integration Testing

**Testing Checklist**:
- [ ] Axes appear in move mode for all object types
- [ ] Axes positioned correctly above object
- [ ] Axes rotate with object
- [ ] Axes scale appropriately
- [ ] Grip press on left controller works
- [ ] Grip press on right controller works
- [ ] Both controllers work independently
- [ ] Latest input wins when both pressed
- [ ] Movement is smooth and real-time
- [ ] Movement constrained to plane
- [ ] Movement follows object rotation
- [ ] Sensitivity (2x) feels correct
- [ ] Object stays in new position after release
- [ ] Rotation works around visual position (movementOffset applied)
- [ ] Scale works from visual position (movementOffset applied)
- [ ] Mode toggle (A button) works smoothly
- [ ] Works on horizontal planes (floor/table)
- [ ] Works on vertical planes (walls) if available

**Edge Cases**:
- Moving object to extreme positions
- Rapid grip press/release
- Switching modes during movement
- Deleting object while in move mode
- Multiple objects with independent positions
- Moving rotated objects
- Moving scaled objects

## Integration with Existing Features

### Rotate Mode Integration

**Dependencies**:
- Rotation must work around visual position (anchor + movementOffset)
- Moving an object should not reset its rotation
- Rotation state is independent of movementOffset

**No Conflicts**:
- Rotate uses thumbstick, move uses grip (different inputs)
- Rotate ring and move axes are different visual indicators
- Transformations are independent

### Scale Mode Integration

**Dependencies**:
- Axes position must account for current scale (object height)
- Moving scaled objects should work correctly
- Scale state is independent of movementOffset
- Scale slider uses `objectRef.current.getWorldPosition()` to track moved objects

**Shared Pattern**:
- Both use same positioning logic (height + clearance above object)
- Both positioned perpendicular to plane
- Both use object world position (automatic movementOffset inclusion)

### Selection and Deletion

**Works Naturally**:
- Move only active when object selected
- Deleting moving object cancels movement
- Deselecting preserves position (stored in movementOffset)

## Code Snippets

### Complete MoveAxes Component

```tsx
interface MoveAxesProps {
  objectRef: React.RefObject<THREE.Group | null>
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
  rotation: number  // Object's rotation
  scale: number     // Object's scale
  baseScale: number // Asset-specific base scale
}

function MoveAxes({ objectRef, anchor, xrRefSpace, rotation, scale, baseScale }: MoveAxesProps) {
  const axesGroupRef = useRef<THREE.Group>(null)
  const { session } = useXR()

  // Load GLB model to calculate actual object dimensions (reuse scale slider pattern)
  const type = /* get from parent */
  const modelPath = type === 'round-table' ? '/asset/round-table.glb' : `/asset/${type}.glb`
  const { scene } = useGLTF(modelPath)

  // Cache unscaled object height
  const unscaledHeight = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene)
    const size = box.getSize(new THREE.Vector3())
    return size.y
  }, [scene])

  // Calculate axes length based on object size
  const axesLength = useMemo(() => {
    if (!objectRef.current) return 0.5
    const box = new THREE.Box3().setFromObject(objectRef.current)
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y)
    return (maxDim / 2) + 0.2
  }, [objectRef])

  // Create arrow helpers (red, pointing X and Y)
  const xAxisArrow = useMemo(() =>
    new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, 0),
      axesLength,
      0xff0000,  // Red
      0.1,
      0.05
    ), [axesLength]
  )

  const yAxisArrow = useMemo(() =>
    new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(0, 0, 0),
      axesLength,
      0xff0000,  // Red
      0.1,
      0.05
    ), [axesLength]
  )

  // Update axes position and orientation each frame
  useFrame((state) => {
    if (!session || !xrRefSpace || !axesGroupRef.current || !objectRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame?.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Get object's actual world position (includes movementOffset)
    const objectWorldPos = new THREE.Vector3()
    objectRef.current.getWorldPosition(objectWorldPos)

    // Extract anchor orientation for plane normal
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(new THREE.Vector3(), anchorQuat, new THREE.Vector3())

    // Plane normal (perpendicular to plane)
    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Calculate scaled height
    const scaledHeight = unscaledHeight * baseScale * scale

    // Position axes 30cm above object top (using object's world position)
    const clearance = 0.3
    const axesPos = objectWorldPos.clone()
      .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))

    axesGroupRef.current.position.copy(axesPos)

    // Orient axes to match object rotation (apply rotation around plane normal)
    const rotationQuat = new THREE.Quaternion().setFromAxisAngle(planeNormal, rotation)
    const finalQuat = rotationQuat.multiply(anchorQuat)
    axesGroupRef.current.quaternion.copy(finalQuat)

    // Update arrow directions to match rotation
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(finalQuat)
    const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(finalQuat)

    xAxisArrow.setDirection(localX.normalize())
    yAxisArrow.setDirection(localY.normalize())
  })

  return (
    <group ref={axesGroupRef}>
      <primitive object={xAxisArrow} />
      <primitive object={yAxisArrow} />
    </group>
  )
}
```

### MoveController Component

```tsx
interface MoveControllerProps {
  selectedObjectId: string | null
  transformMode: TransformMode
  onMove: (objectId: string, initialOffset: THREE.Vector3, deltaMovement: THREE.Vector3) => void
  anchoredObjects: Array<{ id: string, anchor: XRAnchor, rotation: number, movementOffset: THREE.Vector3 }>
  xrRefSpace: XRReferenceSpace | null
}

function MoveController({
  selectedObjectId,
  transformMode,
  onMove,
  anchoredObjects,
  xrRefSpace
}: MoveControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')
  const { session } = useXR()

  // Movement state
  const isMoving = useRef(false)
  const activeHand = useRef<'left' | 'right' | null>(null)
  const initialControllerPos = useRef<THREE.Vector3 | null>(null)
  const initialMovementOffset = useRef<THREE.Vector3 | null>(null)  // CRITICAL: Store initial object position

  // Previous grip states for edge detection
  const prevLeftGrip = useRef(false)
  const prevRightGrip = useRef(false)

  useFrame((state) => {
    // Only active when object selected and in move mode
    if (!selectedObjectId || transformMode !== 'move' || !session || !xrRefSpace) {
      isMoving.current = false
      return
    }

    // Check grip button states
    const leftGrip = leftController?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'
    const rightGrip = rightController?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'

    // Detect grip press (edge: false → true)
    const leftGripPressed = leftGrip && !prevLeftGrip.current
    const rightGripPressed = rightGrip && !prevRightGrip.current

    // Handle grip press
    if (leftGripPressed && leftController?.object) {
      startMovement('left', leftController)
    } else if (rightGripPressed && rightController?.object) {
      startMovement('right', rightController)
    }

    // Handle ongoing movement
    if (isMoving.current && activeHand.current) {
      const controller = activeHand.current === 'left' ? leftController : rightController
      updateMovement(controller, state)
    }

    // Detect grip release
    if (isMoving.current && !leftGrip && !rightGrip) {
      finishMovement()
    }

    // Update previous states
    prevLeftGrip.current = leftGrip
    prevRightGrip.current = rightGrip
  })

  const startMovement = (hand: 'left' | 'right', controller: any) => {
    if (!controller?.object || !selectedObjectId) return

    isMoving.current = true
    activeHand.current = hand

    // Capture initial controller position
    const controllerPos = new THREE.Vector3()
    controller.object.getWorldPosition(controllerPos)
    initialControllerPos.current = controllerPos.clone()

    // CRITICAL: Capture object's current position when grip is pressed
    const objData = anchoredObjects.find(o => o.id === selectedObjectId)
    if (objData) {
      initialMovementOffset.current = objData.movementOffset.clone()
    }

    console.log(`Movement started - ${hand} grip pressed`)
  }

  const updateMovement = (controller: any, state: any) => {
    if (!controller?.object || !initialControllerPos.current || !initialMovementOffset.current || !selectedObjectId || !xrRefSpace) return

    // Get current controller position
    const currentPos = new THREE.Vector3()
    controller.object.getWorldPosition(currentPos)

    // Calculate delta from initial position
    const delta = currentPos.clone().sub(initialControllerPos.current)

    // Apply sensitivity
    const SENSITIVITY = 1.0
    const movement = delta.multiplyScalar(SENSITIVITY)

    // Get selected object data
    const objData = anchoredObjects.find(o => o.id === selectedObjectId)
    if (!objData) return

    // Get anchor pose
    const frame = state.gl.xr.getFrame()
    if (!frame) return

    const anchorPose = frame.getPose(objData.anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Project movement onto object's plane
    const projectedMovement = projectMovementOntoPlane(movement, anchorPose, objData.rotation)

    // CRITICAL: Pass both initial offset and delta to update handler
    // This sets position = initial + delta (not accumulating each frame)
    onMove(selectedObjectId, initialMovementOffset.current, projectedMovement)
  }

  const finishMovement = () => {
    // Reset state
    isMoving.current = false
    activeHand.current = null
    initialControllerPos.current = null
    initialMovementOffset.current = null

    console.log('Movement finished - grip released')
  }

  const projectMovementOntoPlane = (
    worldDelta: THREE.Vector3,
    anchorPose: XRPose,
    objectRotation: number
  ): THREE.Vector3 => {
    // Extract anchor orientation
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(new THREE.Vector3(), anchorQuat, new THREE.Vector3())

    // Get plane normal
    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Apply object rotation
    const rotationQuat = new THREE.Quaternion().setFromAxisAngle(planeNormal, objectRotation)
    const finalQuat = rotationQuat.multiply(anchorQuat)

    // Get object's local X and Y axes in world space
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(finalQuat)
    const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(finalQuat)

    // Project delta onto local axes
    const xComponent = worldDelta.dot(localX)
    const yComponent = worldDelta.dot(localY)

    // Reconstruct movement in plane
    return new THREE.Vector3()
      .addScaledVector(localX, xComponent)
      .addScaledVector(localY, yComponent)
  }

  return null
}
```

### Movement State Handler

```tsx
// In PlacementHandler component

// CORRECT: Set position to initial + delta (not accumulating)
const handleMoveObject = (
  objectId: string,
  initialOffset: THREE.Vector3,
  deltaMovement: THREE.Vector3
) => {
  setAnchoredObjects(prev => prev.map(o => {
    if (o.id === objectId) {
      // Set offset to initial + delta (direct position mapping)
      const newOffset = initialOffset.clone().add(deltaMovement)
      return { ...o, movementOffset: newOffset }
    }
    return o
  }))
}

// Usage in SelectableObject
function SelectableObject({
  anchor,
  rotation,
  scale,
  movementOffset,  // Passed from parent
  ...
}: SelectableObjectProps) {
  useFrame((state) => {
    // ... get anchorPos and anchorQuat ...

    // Apply movement offset to base position
    const finalPos = anchorPos.clone().add(movementOffset)

    // Apply rotation around moved position
    const rotationQuat = new THREE.Quaternion().setFromAxisAngle(planeNormal, rotation)
    const finalQuat = rotationQuat.multiply(anchorQuat)

    // ... compose matrix with finalPos and finalQuat ...
  })
}
```

## Key Learnings Applied

### From Scale Mode Implementation

1. **Positioning UI Above Object**: Reuse `anchor + (height + clearance) * planeNormal` pattern
2. **Actual Object Dimensions**: Load GLB model, cache height with `useMemo`
3. **Parent Transform Inheritance**: Render axes as children (they should inherit object rotation)
4. **Performance**: Cache bounding box calculations, only update when needed

### From Rotate Mode Implementation

1. **Quaternion Rotation**: Use `setFromAxisAngle()` for rotation around plane normal
2. **Plane Normal Extraction**: Get from anchor's Y-axis
3. **Button Input Pattern**: Edge detection with `useRef` for grip button
4. **Mode State Management**: Transform mode persists across selections

### From WebXR Documentation

1. **Controller Position**: Use `getWorldPosition()`, not `.position`
2. **Frame Access**: `state.gl.xr.getFrame()` in `useFrame`
3. **Object World Position**: Use `objectRef.current.getWorldPosition()` for visualization positioning

### From Three.js Documentation

1. **ArrowHelper**: Components are `line` and `cone`, update with `setDirection()` and `setLength()`
2. **Vector Projection**: Use dot product to project onto axis
3. **Quaternion Application**: `vector.applyQuaternion()` transforms to new coordinate system
4. **Matrix Decomposition**: Extract position, rotation, scale separately

## Challenges & Solutions

### Challenge 1: Axes Should Follow Object Rotation

**Problem**: Requirement says axes should be "relative to object's orientation (X and Y along object's local X and Y)".

**Solution**:
- Extract object's final rotation (anchor orientation + user rotation)
- Apply this rotation to axes group
- Axes are children of axes group, so they inherit rotation
- Update arrow directions to point along rotated local X and Y

### Challenge 2: Projecting 3D Movement onto 2D Plane

**Problem**: Controller moves in 3D space, object should only move in its placement plane.

**Solution**:
- Extract object's local X and Y axes in world space
- Use dot product to project movement delta onto each axis
- Reconstruct movement as combination of X and Y components
- Ignores any perpendicular (Z) component automatically

### Challenge 3: Visualizations Following Moved Object

**Problem**: Axes and scale slider need to stay positioned above object after it's moved.

**Solution**:
- Use `objectRef.current.getWorldPosition()` instead of calculating from anchor
- This automatically includes the `movementOffset` in the position
- No need to manually track or pass offset to visualization components
- Simpler and more maintainable

### Challenge 4: Maintaining Rotation Pivot After Move

**Problem**: Rotation should work around the object's visual position, not the original anchor.

**Solution**:
- Apply `movementOffset` before applying rotation in `SelectableObject`
- Rotation quaternion is applied relative to the moved position
- `finalPos = anchorPos + movementOffset` → then apply rotation around `finalPos`
- Works naturally with the existing rotation logic

## API Reference

### Three.js APIs

**ArrowHelper**:
```tsx
new THREE.ArrowHelper(dir, origin, length, hex, headLength, headWidth)
arrowHelper.setDirection(direction: Vector3)
arrowHelper.setLength(length, headLength?, headWidth?)
arrowHelper.setColor(color: Color | string | number)
```

**Vector3 Operations**:
```tsx
vector.dot(otherVector)           // Dot product: number
vector.applyQuaternion(quaternion) // Transform by quaternion
vector.addScaledVector(vector, scale) // Add scaled vector
```

**Box3 (Bounding Box)**:
```tsx
const bbox = new THREE.Box3().setFromObject(object)
const size = bbox.getSize(new THREE.Vector3())
const center = bbox.getCenter(new THREE.Vector3())
```

### WebXR APIs

**XRAnchor**:
```tsx
anchor.anchorSpace: XRSpace
```

**XRFrame**:
```tsx
frame.getPose(space: XRSpace, baseSpace: XRReferenceSpace): XRPose | null
frame.trackedAnchors: XRAnchorSet
```

### @react-three/xr APIs

**useXRInputSourceState**:
```tsx
const controller = useXRInputSourceState('controller', 'left' | 'right')
controller?.object.getWorldPosition(vector)
controller?.gamepad?.['xr-standard-squeeze']?.state === 'pressed'
```

**Controller Object**:
```tsx
controller.object: THREE.Object3D  // Has getWorldPosition() method
controller.gamepad: XRGamepad      // Button and axis states
controller.inputSource: XRInputSource // Raw WebXR input source
```

## References

### Documentation

- [Three.js ArrowHelper](https://threejs.org/docs/#api/en/helpers/ArrowHelper)
- [Three.js Vector3](https://threejs.org/docs/#api/en/math/Vector3)
- [WebXR Anchors Module](https://immersive-web.github.io/anchors/)
- [MDN XRAnchor](https://developer.mozilla.org/en-US/docs/Web/API/XRAnchor)
- [MDN XRFrame.createAnchor()](https://developer.mozilla.org/en-US/docs/Web/API/XRFrame/createAnchor)
- [@react-three/xr - Controller Gamepad](https://github.com/pmndrs/xr/blob/main/docs/tutorials/gamepad.md)

### Codebase References

- `src/components/ARHitTestManager.tsx` - Existing anchor management, position tracking
- `docs/r3f-learnings.md` - Controller position tracking, matrix operations
- `docs/feature4-2-scale-research.md` - Positioning logic above object, parent transforms
- `docs/feature4-2-rotate-research.md` - Quaternion rotation, plane normal extraction, mode toggling

### Mathematical Concepts

**Vector Projection Formula**:
```
Given: vector V, axis A (unit vector)
Component along A = V · A (dot product)
Projected vector = (V · A) * A
```

**Plane-Constrained Movement**:
```
Given: 3D delta D, plane with axes X and Y (unit vectors)
X component = D · X
Y component = D · Y
Projected movement = (X component) * X + (Y component) * Y
```

**Sensitivity Multiplier**:
```
Given: hand movement distance d, sensitivity s
Object movement = d * s
Example: d=1m, s=2.0 → object moves 2m
```

## Implementation Summary

### What Needs to Be Implemented

1. **MoveAxes Component** (Lines TBD in ARHitTestManager.tsx):
   - Two red ArrowHelpers for X and Y axes
   - Positioned 30cm above object (reuse scale slider positioning)
   - Oriented to match object rotation (follow local X/Y)
   - Scaled based on object size
   - Rendered in ModificationVisuals for mode='move'

2. **MoveController Component** (Lines TBD in ARHitTestManager.tsx):
   - Grip button detection (both hands, edge detection)
   - Controller position tracking with `getWorldPosition()`
   - Movement delta calculation with 2x sensitivity
   - Movement projection onto object's plane
   - Accumulated movement ref
   - Only active in move mode with selected object

3. **State Management** (Lines TBD in ARHitTestManager.tsx):
   - Add `movementOffset: THREE.Vector3` to `AnchoredObjectData` interface
   - Initialize to `new THREE.Vector3(0, 0, 0)` when object placed
   - Update via `handleMoveObject` callback

4. **SelectableObject Modifications** (Lines TBD in ARHitTestManager.tsx):
   - Accept `movementOffset` prop
   - Apply offset to base position in `useFrame`: `finalPos = anchorPos + movementOffset`
   - Rotation and scale work around moved position

5. **PlacementHandler Modifications** (Lines TBD in ARHitTestManager.tsx):
   - Add `handleMoveObject` callback to update `movementOffset`
   - Pass `movementOffset` to SelectableObject
   - Pass callback to MoveController

### Files Modified

- `src/components/ARHitTestManager.tsx` - All move mode implementation
- No changes to App.tsx or ObjectPalette.tsx
- Self-contained feature implementation

## Next Steps

After completing research:
1. Review research document with user
2. Implement Phase 1 (Axes Visualization)
3. Test axes appearance and positioning
4. Implement Phase 2-3 (Grip detection and position tracking)
5. Test grip button and tracking
6. Implement Phase 4-5 (Movement projection, visual updates, and state management)
7. Test real-time movement and position persistence
8. Phase 6 integration testing on Quest 2
9. Refine and polish based on testing feedback
