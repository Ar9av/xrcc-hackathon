# Feature 4.2 Move Mode Research: Object Movement with Grip Drag

## Overview

This document provides comprehensive research for implementing **Move Mode** in Feature 4.2. Move mode allows users to reposition selected AR objects by holding the grip button and dragging their hand along the object's local X and Y axes. The movement is constrained to the plane on which the object was originally placed.

**Key Challenge**: Tracking real-time controller position changes, projecting movement onto the object's local plane, and updating the AR anchor position to maintain proper tracking as the system's understanding of the world evolves.

This research covers:
1. Requirements analysis and clarifications
2. Axes visualization with ArrowHelper
3. Controller position tracking and movement calculation
4. Plane-constrained movement mathematics
5. Anchor position updates (delete and recreate pattern)
6. Grip button input handling
7. Integration with existing transform modes

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

**Anchor Point Updates**:
- **CRITICAL**: Must update the actual AR anchor position
- Anchor position determines where rotation and scale operations occur
- All other modes (rotate, scale) depend on anchor position
- Moving the object must move the anchor so rotation pivot moves correctly

### Mode Management

**Entry/Exit**:
- Enter move mode: Press 'A' button when in scale mode
- Exit move mode: Press 'A' button to cycle back to rotate mode
- Visual feedback: Red axes visible only in move mode
- Deselecting object removes axes

**State Persistence**:
- Object position persists after exiting move mode
- Position persists when deselecting and reselecting object
- Each object has independent position (determined by anchor)

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
8. **Verify**: Return to rotate mode → Object rotates around new position

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
- `SelectableObject`: Update anchor position as object moves
- `ModificationVisuals`: Add MoveAxes rendering for move mode
- `PlacementHandler`: Handle anchor recreation when object moved

## State Management

### Current State (from Rotate and Scale Modes)

```tsx
// In PlacementHandler component
interface AnchoredObjectData {
  id: string
  anchor: XRAnchor
  type: 'table' | 'bed' | 'sofa' | 'round-table'
  rotation: number  // Existing from rotate mode
  scale: number     // Existing from scale mode
}

const [transformMode, setTransformMode] = useState<TransformMode>('rotate')
const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
```

### Additional State for Move Mode

```tsx
// No new persistent state needed!
// Movement is handled by updating the anchor position directly
// The anchor itself stores the position

// Temporary state during drag (in MoveController component)
interface MovementState {
  isMoving: boolean
  initialControllerPos: THREE.Vector3 | null
  initialAnchorPos: THREE.Vector3 | null
  activeHand: 'left' | 'right' | null
}
```

**Key Insight**: Unlike rotation and scale, movement doesn't need persistent state per object because the position is inherently stored in the **anchor's pose**. The anchor is the source of truth for position.

### State Update Pattern

```tsx
// In PlacementHandler
const handleMove = async (objectId: string, newPosition: THREE.Vector3, planeNormal: THREE.Vector3) => {
  // Find the object
  const obj = anchoredObjects.find(o => o.id === objectId)
  if (!obj) return

  // Delete old anchor (cannot move anchors, must recreate)
  obj.anchor.delete()

  // Create new anchor at new position
  const newAnchor = await createAnchorAtPosition(newPosition, planeNormal)

  // Update state with new anchor (position is implicit in anchor)
  setAnchoredObjects(prev => prev.map(o =>
    o.id === objectId
      ? { ...o, anchor: newAnchor }
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

**Implementation Pattern** (from scale mode):
```tsx
// Calculate actual object height from GLB model (cached)
const unscaledHeight = useMemo(() => {
  if (!objectRef.current) return 0.5
  const bbox = new THREE.Box3().setFromObject(objectRef.current)
  const size = bbox.getSize(new THREE.Vector3())
  return size.y
}, [objectRef])

useFrame((state) => {
  // Extract anchor position and plane normal
  const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
  const anchorPos = new THREE.Vector3()
  const anchorQuat = new THREE.Quaternion()
  anchorMatrix.decompose(anchorPos, anchorQuat, new THREE.Vector3())

  const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

  // Calculate scaled height (accounts for user scale from scale mode)
  const scaledHeight = unscaledHeight * baseScale * scale

  // Position axes: anchor + (scaledHeight + clearance) * planeNormal
  const clearance = 0.3  // 30cm above object
  const axesPos = anchorPos.clone()
    .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))

  axesGroupRef.current.position.copy(axesPos)
})
```

**Why This Works**:
- Plane normal points perpendicular to surface (from anchor's Y-axis)
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

### 7. Anchor Position Updates

**CRITICAL FINDING**: WebXR anchors **cannot be moved**. They are automatically updated by the tracking system. To "move" an object, you must:
1. Delete the old anchor
2. Create a new anchor at the new position

**WebXR Anchor API (from MDN)**:
```tsx
// Creating an anchor from XRFrame
const newAnchor = await frame.createAnchor(
  pose,          // XRRigidTransform with new position/orientation
  referenceSpace // XRReferenceSpace to interpret pose in
)

// Deleting an anchor
anchor.delete()

// Checking if anchor is still tracked
if (frame.trackedAnchors?.has(anchor)) {
  // Anchor is valid
}
```

**Update Pattern**:
```tsx
async function updateObjectPosition(
  objectId: string,
  deltaMovement: THREE.Vector3,
  anchoredObjects: AnchoredObjectData[],
  session: XRSession,
  xrRefSpace: XRReferenceSpace
) {
  const obj = anchoredObjects.find(o => o.id === objectId)
  if (!obj) return

  // Get current anchor pose
  const frame = session.requestAnimationFrame(() => {}) // Get current frame
  const anchorPose = frame.getPose(obj.anchor.anchorSpace, xrRefSpace)
  if (!anchorPose) return

  // Calculate new position
  const currentPos = new THREE.Vector3().setFromMatrixPosition(
    new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
  )
  const newPos = currentPos.clone().add(deltaMovement)

  // Extract current orientation (preserve rotation)
  const currentMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
  const currentQuat = new THREE.Quaternion()
  currentMatrix.decompose(new THREE.Vector3(), currentQuat, new THREE.Vector3())

  // Create new pose (new position + preserved orientation)
  const newPose = new XRRigidTransform(
    { x: newPos.x, y: newPos.y, z: newPos.z },
    { x: currentQuat.x, y: currentQuat.y, z: currentQuat.z, w: currentQuat.w }
  )

  // Delete old anchor
  obj.anchor.delete()

  // Create new anchor at new position
  const newAnchor = await frame.createAnchor(newPose, xrRefSpace)

  // Update state
  setAnchoredObjects(prev => prev.map(o =>
    o.id === objectId
      ? { ...o, anchor: newAnchor }
      : o
  ))
}
```

**Challenges with Async Anchor Creation**:
- `createAnchor()` returns a Promise
- Cannot call in `useFrame` (async not allowed)
- Movement should be real-time, but anchor update is async

**Solution Options**:

**Option A: Accumulate Movement, Update Periodically**
```tsx
// Accumulate movement in ref
const accumulatedMovement = useRef(new THREE.Vector3())

useFrame(() => {
  if (isMoving) {
    // Calculate delta
    accumulatedMovement.current.add(projectedDelta)
  }
})

// Separate effect watches for grip release
useEffect(() => {
  if (!isMoving && accumulatedMovement.current.length() > 0.01) {
    // Apply accumulated movement to anchor
    updateAnchorPosition(accumulatedMovement.current)
    accumulatedMovement.current.set(0, 0, 0)
  }
}, [isMoving])
```

**Option B: Update Position in useFrame, Recreate Anchor on Release**
```tsx
// Store offset from anchor in ref (temporary during drag)
const offsetFromAnchor = useRef(new THREE.Vector3())

useFrame(() => {
  if (isMoving) {
    // Update offset (visual position changes immediately)
    offsetFromAnchor.current.add(projectedDelta)

    // Apply offset to visual position (not anchor yet)
    objectRef.current.position.copy(anchorPos.clone().add(offsetFromAnchor.current))
  }
})

// On grip release, commit offset to new anchor
useEffect(() => {
  if (!isMoving && offsetFromAnchor.current.length() > 0) {
    // Create new anchor at offset position
    const newPos = anchorPos.clone().add(offsetFromAnchor.current)
    recreateAnchorAtPosition(newPos)
    offsetFromAnchor.current.set(0, 0, 0)
  }
}, [isMoving])
```

**Recommended: Option B** - Visual feedback is immediate, anchor update on release is acceptable.

**XRRigidTransform Creation**:
```tsx
// From position and quaternion
const transform = new XRRigidTransform(
  { x: pos.x, y: pos.y, z: pos.z },           // DOMPointInit position
  { x: quat.x, y: quat.y, z: quat.z, w: quat.w } // DOMPointInit orientation
)

// From matrix (if available)
const transform = new XRRigidTransform(matrix.toArray())
```

### 8. Real-Time Visual Updates During Drag

**Challenge**: Anchor updates are async, but user expects immediate visual feedback.

**Solution**: Apply movement to object's visual position immediately, commit to anchor on release.

**Implementation Pattern**:
```tsx
function SelectableObject({
  anchor,
  rotation,
  scale,
  isMoving,  // NEW: passed from parent
  movementOffset  // NEW: temporary offset during drag
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

    // Apply temporary movement offset (only when moving)
    const finalPos = isMoving
      ? anchorPos.clone().add(movementOffset)
      : anchorPos

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

**Key Pattern**: Temporary offset applied during drag, committed to anchor on release.

## Performance Considerations

### Controller Position Tracking

**Frequency**: Every frame (90-120fps)

**Operations per frame**:
- `getWorldPosition()`: Fast (matrix decomposition)
- Vector subtraction: Trivial
- Dot products (2): Fast (3 multiplications + 2 additions each)
- Vector scaling/addition: Trivial

**Impact**: Negligible (< 0.1ms per frame)

### Anchor Recreation

**Frequency**: Once per drag operation (on grip release)

**Cost**: Async operation, may take 10-50ms

**Mitigation**:
- Only recreate on grip release (not every frame)
- User won't notice delay (not in critical path)
- Visual updates happen immediately (separate from anchor update)

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

### Phase 5: Visual Position Updates

**Tasks**:
1. Pass movement offset to `SelectableObject`
2. Apply offset to visual position in `useFrame`
3. Test real-time visual feedback
4. Ensure smooth, responsive movement
5. Verify movement stops when grip released

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Object moves immediately when hand moves
- Movement is smooth (no jitter)
- Movement stops when grip released
- Object position updates in real-time
- 2x sensitivity feels natural

### Phase 6: Anchor Position Updates

**Tasks**:
1. Implement anchor deletion on grip release
2. Create new anchor at new position
3. Preserve object rotation and scale in new anchor
4. Update `anchoredObjects` state with new anchor
5. Test: Object stays in new position after release

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Old anchor deleted when grip released
- New anchor created at moved position
- Object rotation preserved
- Object scale preserved
- Object tracks new position correctly
- No errors in anchor creation

### Phase 7: Integration Testing

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
- [ ] Rotation works around new position (anchor updated)
- [ ] Scale works from new position (anchor updated)
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
- Rotation must work around new anchor position after moving
- Moving an object should not reset its rotation
- Rotation state is preserved when recreating anchor

**No Conflicts**:
- Rotate uses thumbstick, move uses grip (different inputs)
- Rotate ring and move axes are different visual indicators
- Transformations are independent

### Scale Mode Integration

**Dependencies**:
- Axes position must account for current scale (object height)
- Moving scaled objects should work correctly
- Scale state is preserved when recreating anchor

**Shared Pattern**:
- Both use same positioning logic (height + clearance above object)
- Both positioned perpendicular to plane

### Selection and Deletion

**Works Naturally**:
- Move only active when object selected
- Deleting moving object cancels movement
- Deselecting preserves position (stored in anchor)

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
    if (!session || !xrRefSpace || !axesGroupRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame?.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Extract anchor position and orientation
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorPos = new THREE.Vector3()
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(anchorPos, anchorQuat, new THREE.Vector3())

    // Plane normal (perpendicular to plane)
    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Calculate scaled height
    const scaledHeight = unscaledHeight * baseScale * scale

    // Position axes 30cm above object top
    const clearance = 0.3
    const axesPos = anchorPos.clone()
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
  onMove: (objectId: string, deltaMovement: THREE.Vector3) => void
  getObjectData: (objectId: string) => { anchor: XRAnchor, rotation: number } | null
}

function MoveController({
  selectedObjectId,
  transformMode,
  onMove,
  getObjectData
}: MoveControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')
  const { session } = useXR()

  // Movement state
  const isMoving = useRef(false)
  const activeHand = useRef<'left' | 'right' | null>(null)
  const initialControllerPos = useRef<THREE.Vector3 | null>(null)
  const accumulatedMovement = useRef(new THREE.Vector3())

  // Previous grip states for edge detection
  const prevLeftGrip = useRef(false)
  const prevRightGrip = useRef(false)

  useFrame((state, delta) => {
    // Only active when object selected and in move mode
    if (!selectedObjectId || transformMode !== 'move') {
      if (isMoving.current) {
        // Apply accumulated movement on mode exit
        if (accumulatedMovement.current.length() > 0.01) {
          onMove(selectedObjectId, accumulatedMovement.current)
          accumulatedMovement.current.set(0, 0, 0)
        }
        isMoving.current = false
      }
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
      updateMovement(controller, selectedObjectId)
    }

    // Detect grip release
    if (isMoving.current && !leftGrip && !rightGrip) {
      finishMovement(selectedObjectId)
    }

    // Update previous states
    prevLeftGrip.current = leftGrip
    prevRightGrip.current = rightGrip
  })

  const startMovement = (hand: 'left' | 'right', controller: any) => {
    if (!controller?.object) return

    isMoving.current = true
    activeHand.current = hand

    const controllerPos = new THREE.Vector3()
    controller.object.getWorldPosition(controllerPos)
    initialControllerPos.current = controllerPos.clone()
    accumulatedMovement.current.set(0, 0, 0)

    console.log(`Movement started - ${hand} grip pressed`)
  }

  const updateMovement = (controller: any, objectId: string) => {
    if (!controller?.object || !initialControllerPos.current) return

    // Get current controller position
    const currentPos = new THREE.Vector3()
    controller.object.getWorldPosition(currentPos)

    // Calculate delta from initial position
    const delta = currentPos.clone().sub(initialControllerPos.current)

    // Apply sensitivity
    const SENSITIVITY = 2.0
    const movement = delta.multiplyScalar(SENSITIVITY)

    // Get object data (anchor, rotation)
    const objData = getObjectData(objectId)
    if (!objData) return

    // Get anchor pose
    const frame = state.gl.xr.getFrame()
    const anchorPose = frame?.getPose(objData.anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Project movement onto object's plane
    const projectedMovement = projectMovementOntoPlane(movement, anchorPose, objData.rotation)

    // Accumulate movement
    accumulatedMovement.current.copy(projectedMovement)
  }

  const finishMovement = (objectId: string) => {
    // Apply accumulated movement
    if (accumulatedMovement.current.length() > 0.01) {
      onMove(objectId, accumulatedMovement.current)
    }

    // Reset state
    isMoving.current = false
    activeHand.current = null
    initialControllerPos.current = null
    accumulatedMovement.current.set(0, 0, 0)

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

### Anchor Update Handler

```tsx
// In PlacementHandler component

const handleMoveObject = async (objectId: string, deltaMovement: THREE.Vector3) => {
  const obj = anchoredObjects.find(o => o.id === objectId)
  if (!obj || !session || !xrRefSpace) return

  try {
    // Get current anchor pose
    const frame = /* need to get frame - see note below */
    const anchorPose = frame.getPose(obj.anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Calculate new position
    const currentMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const currentPos = new THREE.Vector3()
    const currentQuat = new THREE.Quaternion()
    currentMatrix.decompose(currentPos, currentQuat, new THREE.Vector3())

    const newPos = currentPos.clone().add(deltaMovement)

    // Create new pose (preserve orientation)
    const newPose = new XRRigidTransform(
      { x: newPos.x, y: newPos.y, z: newPos.z },
      { x: currentQuat.x, y: currentQuat.y, z: currentQuat.z, w: currentQuat.w }
    )

    // Delete old anchor
    obj.anchor.delete()

    // Create new anchor at new position
    const newAnchor = await frame.createAnchor(newPose, xrRefSpace)

    // Update state with new anchor
    setAnchoredObjects(prev => prev.map(o =>
      o.id === objectId
        ? { ...o, anchor: newAnchor }
        : o
    ))

    console.log('Anchor updated to new position', newPos)
  } catch (error) {
    console.error('Failed to update anchor position:', error)
  }
}

// Note: Getting frame outside useFrame is tricky
// May need to store frame in ref or use different approach
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

1. **Anchor Limitations**: Cannot move anchors, must delete and recreate
2. **Controller Position**: Use `getWorldPosition()`, not `.position`
3. **XRRigidTransform**: Create from position + quaternion for anchor poses
4. **Frame Access**: `state.gl.xr.getFrame()` in `useFrame`

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

### Challenge 2: Real-Time Movement with Async Anchor Updates

**Problem**: Anchor creation is async (Promise), but movement should be real-time.

**Solution**:
- Visual updates happen immediately (offset applied in `useFrame`)
- Anchor update happens on grip release (async operation acceptable)
- Accumulate movement in ref, commit to anchor when drag ends
- Two-phase approach: temporary visual + permanent anchor

### Challenge 3: Projecting 3D Movement onto 2D Plane

**Problem**: Controller moves in 3D space, object should only move in its placement plane.

**Solution**:
- Extract object's local X and Y axes in world space
- Use dot product to project movement delta onto each axis
- Reconstruct movement as combination of X and Y components
- Ignores any perpendicular (Z) component automatically

### Challenge 4: Maintaining Rotation Pivot After Move

**Problem**: User requirement says "moving should also move the anchor point so that rotation works properly".

**Solution**:
- Recreate anchor at new position with same orientation
- Rotation state (angle) is preserved in object data
- Rotation is applied relative to anchor, so new anchor = new pivot
- Scale and rotation modes automatically work from new position

### Challenge 5: Accessing XRFrame Outside useFrame

**Problem**: Anchor creation needs XRFrame, but is called from effect/callback (not `useFrame`).

**Solution Options**:
1. Store frame in ref during `useFrame`, access in callback (stale data risk)
2. Use `session.requestAnimationFrame()` to get next frame (adds delay)
3. Accumulate movement, update anchor in `useFrame` when grip released

**Recommended**: Option 3 - Check grip state in `useFrame`, trigger anchor update there.

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
anchor.delete(): void
```

**XRFrame**:
```tsx
frame.createAnchor(pose: XRRigidTransform, space: XRReferenceSpace): Promise<XRAnchor>
frame.getPose(space: XRSpace, baseSpace: XRReferenceSpace): XRPose | null
frame.trackedAnchors: XRAnchorSet
```

**XRRigidTransform**:
```tsx
new XRRigidTransform(
  position?: DOMPointInit,
  orientation?: DOMPointInit
)
// DOMPointInit: { x, y, z, w? }
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

3. **Anchor Update Handler** (Lines TBD in ARHitTestManager.tsx):
   - Delete old anchor on grip release
   - Create new anchor at new position
   - Preserve object rotation and scale
   - Update `anchoredObjects` state
   - Error handling for anchor creation

4. **SelectableObject Modifications** (Lines TBD in ARHitTestManager.tsx):
   - Accept movement offset prop (temporary during drag)
   - Apply offset to visual position in `useFrame`
   - Commit to anchor when movement ends

5. **PlacementHandler Modifications** (Lines TBD in ARHitTestManager.tsx):
   - Add `handleMoveObject` callback
   - Pass callback to MoveController
   - Manage anchor recreation logic

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
6. Implement Phase 4-5 (Movement projection and visual updates)
7. Test real-time movement
8. Implement Phase 6 (Anchor updates)
9. Test anchor recreation and position persistence
10. Phase 7 integration testing on Quest 2
11. Refine and polish based on testing feedback
