# Feature 4.2 Scale Mode Research: Object Scaling with Slider UI

## Overview

This document provides comprehensive research for implementing **Scale Mode** in Feature 4.2. Scale mode allows users to resize selected AR objects using thumbstick input with a visual cone+torus slider UI that provides real-time feedback.

**Key Challenge**: Creating a 3D slider that is positioned perpendicular to the placement plane (following the surface normal) but always oriented parallel to global Y-axis (vertical), regardless of whether the object is on a floor, wall, or angled surface.

This research covers:
1. Requirements analysis and clarifications
2. Three.js geometry APIs (ConeGeometry, TorusGeometry)
3. Slider positioning and orientation math
4. Dynamic torus sizing calculation
5. Scaling behavior implementation
6. Thumbstick input handling
7. Integration with existing transform modes

## Requirements Summary

Based on `docs/r3f-feature-exploration.md` Feature 4.2 Scale Mode and clarifications:

### Visual Description

**Slider Component Structure**:
- Cone: 1m length, 20cm diameter at base, tip pointing down
- Torus: Moves along cone height, acts as slider indicator
- Colors: Cone = light green (#90EE90), Torus = dark green (#006400)
- Cone geometric center is the anchor point (0.5m from tip/base)

**Torus Sizing Formula**:
- Inner diameter = `x * (cone_diameter / cone_height)`
  - Where `x` = distance from tip (ranges from 0 to 1m)
  - At tip (x=0): inner diameter = 0cm
  - At base (x=1m): inner diameter = 20cm
- Outer diameter = inner diameter + 20cm (torus is 10cm thick)
- Tube radius = 10cm (half of 20cm thickness)

**Slider Positioning**:
- **Position**: `anchor_position + (object_height + 0.5m) * plane_normal`
  - Slider moves away from surface along plane normal (perpendicular to plane)
  - Fixed 50cm clearance above object's bounding box height
  - Position updates as object scales (height changes)
- **Orientation**: Always aligned with global Y-axis
  - Cone base points up in global Y (+Y direction)
  - Cone tip points down in global Y (-Y direction)
  - This is independent of plane orientation (works for walls, floors, ceilings)

**Torus Starting Position**:
- Always starts at the **middle of the cone** when entering scale mode
- Middle = 0.5m from tip = halfway up the 1m cone
- Represents current scale factor (100% or default scale)

### Scaling Behavior

**Scale Range**:
- Minimum: 75% of current default scale (0.75x)
- Maximum: 125% of current default scale (1.25x)
- Total range: 50% variation from default
- **Note**: "Current default scale" includes the pre-applied asset scaling factors:
  - Table: 0.9x (90%)
  - Bed: 0.25x (25%)
  - Sofa/Round-table: 1.0x (100%)

**Thumbstick Control**:
- Forward (positive Y-axis): Increase size (torus moves toward base)
- Backward (negative Y-axis): Decrease size (torus moves toward tip)
- Both left AND right thumbsticks control scaling
- Prioritization: Strongest input wins (same logic as rotate mode)

**Scaling Speed**:
- Full thumbstick push: 4 seconds from min (75%) to max (125%)
- Speed calculation: (125% - 75%) / 4 seconds = 12.5% per second
- In decimal: 0.125 scale units per second at full push
- Frame-based: `deltaScale = thumbstickValue * 0.125 * deltaTime`

**Torus Movement Range**:
- At minimum scale (75%): torus at cone tip (0m from tip)
- At maximum scale (125%): torus at cone base (1m from tip)
- Middle position (100%): 0.5m from tip (starting position)
- Linear mapping: `torusPosition = (currentScale - 0.75) / 0.5 * 1.0`

**Constraints**:
- Torus cannot move beyond cone tip (minimum scale limit)
- Torus cannot move beyond cone base (maximum scale limit)
- Maintain aspect ratio: scale all dimensions (X, Y, Z) equally
- Slider position updates automatically as object grows/shrinks

### Mode Management

**Entry/Exit**:
- Enter scale mode: Press 'A' button when in rotate mode
- Exit scale mode: Press 'A' button to go to move mode
- Visual feedback: Scale slider visible only in scale mode
- Deselecting object removes slider

**State Persistence**:
- Object scale persists after exiting scale mode
- Scale persists when deselecting and reselecting object
- Each object has independent scale value

## User Workflow

1. **Select Object**: Point at placed object → Press trigger → Object selected (in rotate mode by default)
2. **Enter Scale Mode**: Press 'A' on right controller → Mode changes to scale
3. **Scale Visual Appears**: Cone+torus slider appears above object, torus at middle
4. **Adjust Scale**:
   - Push thumbstick forward → Object grows, torus moves up cone toward base
   - Push thumbstick backward → Object shrinks, torus moves down cone toward tip
   - Release thumbstick → Scaling stops, torus stays at position
5. **Switch Modes**: Press 'A' → Cycle to move mode (slider disappears)
6. **Deselect**: Point at empty space → Press trigger → Object keeps new scale

## Component Architecture

```
SelectableObject (parent group with matrixAutoUpdate=false)
├── GLB Model (scaled by scale factor)
├── ModificationVisuals (when isSelected=true)
│   ├── RotateRing (mode='rotate')
│   ├── ScaleSlider (mode='scale') ← NEW
│   │   ├── SliderGroup (positioned + oriented)
│   │   │   ├── Cone (light green, tip down in local space)
│   │   │   └── Torus (dark green, animated position)
│   └── MoveAxes (mode='move' - placeholder)
├── ScaleController (thumbstick input) ← NEW
└── ModeController (A button toggle - existing)
```

**New Components**:
- `ScaleSlider`: Container component that positions and orients the slider
- `ScaleController`: Handles thumbstick Y-axis input for scaling

**Modified Components**:
- `SelectableObject`: Apply scale transformation
- `ModificationVisuals`: Add ScaleSlider rendering
- `PlacementHandler`: Add scale state management

## State Management

### Required State Additions

```tsx
// In PlacementHandler component
interface AnchoredObjectData {
  id: string
  anchor: XRAnchor
  type: 'table' | 'bed' | 'sofa' | 'round-table'
  rotation: number  // Existing from rotate mode
  scale: number     // NEW - scale multiplier (0.75 to 1.25)
}

// Initialize with default scale
const newObject = {
  id: Math.random().toString(),
  anchor: anchor,
  type: selectedObjectType,
  rotation: 0,
  scale: 1.0  // 100% = default scale with asset-specific adjustments
}
```

### State Update Handlers

```tsx
// Scale handler - updates scale for selected object
const handleScale = (deltaScale: number) => {
  if (!selectedObjectId) return

  setAnchoredObjects(prev => prev.map(obj => {
    if (obj.id === selectedObjectId) {
      const newScale = obj.scale + deltaScale
      // Clamp to range [0.75, 1.25]
      const clampedScale = Math.max(0.75, Math.min(1.25, newScale))
      return { ...obj, scale: clampedScale }
    }
    return obj
  }))
}
```

## Technical Implementation Details

### 1. ConeGeometry and TorusGeometry Creation

**ConeGeometry API**:
```tsx
new THREE.ConeGeometry(
  radius,         // Radius at base of cone
  height,         // Height of cone
  radialSegments  // Number of segments around circumference
)
```

**For Scale Slider**:
```tsx
const coneRadius = 0.1  // 20cm diameter = 10cm radius
const coneHeight = 1.0  // 1 meter tall
const coneGeometry = new THREE.ConeGeometry(coneRadius, coneHeight, 16)
```

**Critical Note**: ConeGeometry origin is at its **geometric center**, not at the base or tip. This means:
- The tip is at Y = +0.5m in local space
- The base is at Y = -0.5m in local space
- Center (origin) is at Y = 0

**TorusGeometry API**:
```tsx
new THREE.TorusGeometry(
  radius,           // Main circle radius (from center to tube center)
  tubeRadius,       // Tube thickness radius
  radialSegments,   // Segments around tube cross-section
  tubularSegments   // Segments around main circle
)
```

**For Scale Slider**:
```tsx
// Torus sizing is DYNAMIC based on position on cone
const distanceFromTip = (scale - 0.75) / 0.5 * 1.0  // 0 to 1 meter

// Inner diameter calculation: x * (cone_diameter / cone_height)
const innerDiameter = distanceFromTip * (0.2 / 1.0)  // 0 to 0.2m
const innerRadius = innerDiameter / 2  // 0 to 0.1m

// Outer diameter = inner + 20cm → outer radius = inner radius + 10cm
const tubeRadius = 0.1  // 10cm tube thickness (constant)
const torusRadius = innerRadius  // Main radius equals inner radius

const torusGeometry = new THREE.TorusGeometry(
  torusRadius,    // Varies from 0 to 0.1m
  tubeRadius,     // Constant 0.1m
  16,             // Radial segments
  32              // Tubular segments
)
```

**Torus Positioning on Cone**:
```tsx
// Torus position in cone's local space (Y-axis)
// Cone tip is at +0.5m, base at -0.5m (due to geometric center origin)

const distanceFromTip = (scale - 0.75) / 0.5 * 1.0  // 0 to 1m
const torusLocalY = 0.5 - distanceFromTip  // +0.5 to -0.5

// At min scale (0.75): torusLocalY = +0.5 (at tip)
// At mid scale (1.00): torusLocalY = 0.0 (at center)
// At max scale (1.25): torusLocalY = -0.5 (at base)
```

### 2. Slider Positioning: Perpendicular to Plane

**Objective**: Place slider away from surface along plane normal.

**Calculation**:
```tsx
// Get object's bounding box to determine height
const bbox = new THREE.Box3().setFromObject(objectRef.current)
const size = bbox.getSize(new THREE.Vector3())
const objectHeight = size.y * scale  // Scaled height

// Extract plane normal from anchor matrix (Y-axis of anchor)
const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
const anchorPos = new THREE.Vector3()
const anchorQuat = new THREE.Quaternion()
anchorMatrix.decompose(anchorPos, anchorQuat, new THREE.Vector3())

const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

// Slider position: anchor + (objectHeight + clearance) * planeNormal
const clearance = 0.5  // 50cm above object
const sliderPosition = anchorPos.clone()
  .add(planeNormal.clone().multiplyScalar(objectHeight + clearance))
```

**Why this works**:
- Plane normal points perpendicular to surface (from anchor's Y-axis)
- For floor: planeNormal ≈ (0, 1, 0) → slider moves up
- For wall: planeNormal ≈ (1, 0, 0) or similar → slider moves away from wall
- Clearance ensures slider doesn't intersect with object as it scales

### 3. Slider Orientation: Always Global Y-Axis

**Challenge**: Slider must point up/down in global Y regardless of parent orientation.

**Approach**: Create a quaternion that aligns the cone's local up direction with global down direction.

**Implementation Pattern**:

```tsx
// Cone's default orientation: tip points up in +Y (local space)
// We want: tip points down in global -Y

// Method 1: Direct rotation (simplest)
// Rotate cone 180° around X-axis to flip it upside down
const coneRotation = new THREE.Quaternion()
coneRotation.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI)

// Apply to cone mesh
coneMesh.quaternion.copy(coneRotation)

// Method 2: lookAt with inversion (if in group hierarchy)
// Create a matrix that looks from slider position toward global down
const upVector = new THREE.Vector3(0, 1, 0)  // Global up
const targetPosition = sliderPosition.clone().add(new THREE.Vector3(0, -1, 0))

const lookMatrix = new THREE.Matrix4()
lookMatrix.lookAt(sliderPosition, targetPosition, upVector)
const sliderQuat = new THREE.Quaternion()
sliderQuat.setFromRotationMatrix(lookMatrix)
```

**Recommended Approach**: Use a **separate group** for the slider with its own transformation:

```tsx
function ScaleSlider({ objectRef, anchor, xrRefSpace, scale }) {
  const sliderGroupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (!sliderGroupRef.current || !objectRef.current) return

    // Calculate slider position (perpendicular to plane)
    const sliderPos = calculateSliderPosition(objectRef, anchor, xrRefSpace, scale)

    // Set position
    sliderGroupRef.current.position.copy(sliderPos)

    // Set orientation to global Y (no rotation needed if cone already oriented)
    // Or apply fixed rotation to align with global Y
    sliderGroupRef.current.quaternion.set(0, 0, 0, 1)  // Identity = global axes
  })

  return (
    <group ref={sliderGroupRef}>
      {/* Cone rotated to point tip down */}
      <mesh rotation={[Math.PI, 0, 0]}>  {/* 180° around X-axis */}
        <coneGeometry args={[0.1, 1.0, 16]} />
        <meshBasicMaterial color="#90EE90" />
      </mesh>

      {/* Torus at dynamic position */}
      <mesh position={[0, torusLocalY, 0]}>
        <torusGeometry args={[torusRadius, 0.1, 16, 32]} />
        <meshBasicMaterial color="#006400" />
      </mesh>
    </group>
  )
}
```

**Key Insight**: Since the slider is a child of the scene (not the object), we can position it in world space and orient it independently using identity quaternion or fixed rotation.

### 4. Dynamic Torus Sizing and Positioning

**Torus Size Calculation**:

```tsx
// Map scale (0.75 to 1.25) to distance from tip (0 to 1m)
const scaleRange = 0.5  // 1.25 - 0.75
const distanceFromTip = (scale - 0.75) / scaleRange * 1.0

// Inner diameter formula: x * (cone_diameter / cone_height)
const coneDiameter = 0.2  // 20cm
const coneHeight = 1.0    // 1m
const innerDiameter = distanceFromTip * (coneDiameter / coneHeight)
const innerRadius = innerDiameter / 2

// Outer radius = inner radius + tube thickness
const tubeRadius = 0.1  // 10cm constant
const torusRadius = innerRadius

// Handle edge case: at minimum scale, torus has 0 inner radius
// This creates a "sphere" effect (torus with 0 main radius)
const finalTorusRadius = Math.max(0.01, torusRadius)  // Minimum 1cm to avoid degenerate geometry
```

**Torus Position on Cone**:

```tsx
// Convert distance from tip to local Y position on cone
// Cone origin is at center: tip=+0.5m, base=-0.5m

const torusLocalY = (coneHeight / 2) - distanceFromTip
// At scale 0.75: distanceFromTip=0 → torusLocalY = 0.5 (tip)
// At scale 1.00: distanceFromTip=0.5 → torusLocalY = 0.0 (center)
// At scale 1.25: distanceFromTip=1.0 → torusLocalY = -0.5 (base)
```

**Dynamic Update Pattern**:

```tsx
function AnimatedTorus({ scale }: { scale: number }) {
  const torusRef = useRef<THREE.Mesh>(null)

  // Recalculate torus geometry when scale changes
  const { torusRadius, torusPosition } = useMemo(() => {
    const distanceFromTip = (scale - 0.75) / 0.5 * 1.0
    const innerRadius = distanceFromTip * 0.2
    const radius = Math.max(0.01, innerRadius)
    const yPos = 0.5 - distanceFromTip

    return { torusRadius: radius, torusPosition: yPos }
  }, [scale])

  return (
    <mesh ref={torusRef} position={[0, torusPosition, 0]}>
      <torusGeometry args={[torusRadius, 0.1, 16, 32]} />
      <meshBasicMaterial color="#006400" />
    </mesh>
  )
}
```

**Performance Note**: Creating new geometry each frame is expensive. Use `useMemo` to only recreate when scale changes. Alternatively, update geometry attributes directly (more complex).

### 5. Applying Scale to Object

**Scale Application Pattern**:

```tsx
function SelectableObject({ scale, ...props }) {
  const groupRef = useRef<THREE.Group>(null)
  const modelGroupRef = useRef<THREE.Group>(null)

  // Asset-specific base scale factors (existing)
  const baseScale = useMemo(() => {
    if (type === 'table') return 0.9
    if (type === 'bed') return 0.25
    return 1.0
  }, [type])

  // Combined scale = base scale * user scale
  const finalScale = baseScale * scale

  useFrame((state) => {
    // ... existing anchor positioning and rotation logic ...

    // Apply combined scale to the model group
    if (modelGroupRef.current) {
      modelGroupRef.current.scale.setScalar(finalScale)
    }
  })

  return (
    <group ref={groupRef} matrixAutoUpdate={false}>
      <group ref={modelGroupRef} scale={finalScale}>
        <primitive object={clonedScene} />
      </group>

      {/* Visuals at original (non-scaled) position */}
      {isSelected && <ModificationVisuals ... />}
    </group>
  )
}
```

**Important**: Apply scale to the **model group**, not the parent group. This allows modification visuals (slider, ring, axes) to remain at the original anchor position while the model scales.

### 6. Thumbstick Input for Scaling

**Controller Input Pattern**:

```tsx
function ScaleController({
  selectedObjectId,
  transformMode,
  onScale
}: ScaleControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  useFrame((state, delta) => {
    // Only scale when object selected and in scale mode
    if (!selectedObjectId || transformMode !== 'scale') return

    const leftThumbstick = leftController?.gamepad?.['xr-standard-thumbstick']
    const rightThumbstick = rightController?.gamepad?.['xr-standard-thumbstick']

    const leftY = leftThumbstick?.yAxis ?? 0
    const rightY = rightThumbstick?.yAxis ?? 0

    const DEAD_ZONE = 0.1
    const leftActive = Math.abs(leftY) > DEAD_ZONE
    const rightActive = Math.abs(rightY) > DEAD_ZONE

    // Determine scaling input: use strongest thumbstick if both active
    let scaleInput = 0
    if (leftActive && rightActive) {
      scaleInput = Math.abs(leftY) > Math.abs(rightY) ? leftY : rightY
    } else if (leftActive) {
      scaleInput = leftY
    } else if (rightActive) {
      scaleInput = rightY
    }

    // Apply scaling with sensitivity
    if (scaleInput !== 0) {
      // Sensitivity: 12.5% per second at full push
      const scaleSpeed = 0.125  // 0.125 scale units per second
      const deltaScale = scaleInput * scaleSpeed * delta

      // Positive input (forward) = increase scale
      onScale(deltaScale)
    }
  })

  return null
}
```

**Key Points**:
- Use Y-axis (forward/backward) for scaling, not X-axis
- Strongest input wins when both thumbsticks active (same as rotate mode)
- Dead zone prevents drift
- Frame-rate independent with `delta`
- Scale speed: 0.125 units/sec = 12.5% per second

### 7. Slider Position Updates with Scale

**Challenge**: As object grows/shrinks, slider must maintain clearance above object.

**Solution**: Recalculate slider position in `useFrame` based on current scale.

```tsx
function ScaleSlider({ objectRef, anchor, xrRefSpace, scale }) {
  const sliderGroupRef = useRef<THREE.Group>(null)

  // Cache unscaled object height (calculate once on mount)
  const unscaledHeight = useMemo(() => {
    if (!objectRef.current) return 0.5
    const bbox = new THREE.Box3().setFromObject(objectRef.current)
    const size = bbox.getSize(new THREE.Vector3())
    return size.y
  }, [objectRef])

  useFrame((state) => {
    if (!sliderGroupRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Extract anchor position and plane normal
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorPos = new THREE.Vector3()
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(anchorPos, anchorQuat, new THREE.Vector3())

    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Calculate scaled object height
    const scaledHeight = unscaledHeight * scale

    // Position slider: anchor + (scaledHeight + clearance) * normal
    const clearance = 0.5
    const sliderPos = anchorPos.clone()
      .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))

    sliderGroupRef.current.position.copy(sliderPos)
  })

  return (
    <group ref={sliderGroupRef}>
      {/* Cone and torus */}
    </group>
  )
}
```

**Optimization**: Only recalculate unscaled height when entering scale mode or when object changes. Use `useMemo` or `useEffect` to cache.

## Integration with Existing Features

### Rotate Mode Integration

**Shared State**:
- Both modes operate on the selected object
- Mode toggling switches between rotate ring and scale slider visuals
- State persists: rotation and scale are independent

**No Conflicts**:
- Rotate uses thumbstick X-axis, scale uses Y-axis
- Different visual indicators prevent confusion
- Both transformations are additive (rotation + scale)

### Selection and Deletion

**Works Naturally**:
- Scale only active when object selected
- Deleting scaled object removes it entirely (scale doesn't persist elsewhere)
- Deselecting preserves scale for when object is reselected

### Move Mode (Future)

**Considerations**:
- Move mode will likely use grip button (not thumbsticks)
- All three transformations (rotate, scale, move) are independent
- Apply order: position → rotation → scale (for correct visual placement)

## Performance Considerations

### Geometry Recreation

**Problem**: Creating new TorusGeometry every frame when scale changes is expensive.

**Solutions**:

1. **useMemo approach** (Recommended):
```tsx
const torusGeometry = useMemo(() => {
  const torusRadius = calculateTorusRadius(scale)
  return new THREE.TorusGeometry(torusRadius, 0.1, 16, 32)
}, [scale])
```
- Only recreates when scale changes
- Simple and declarative
- Good performance for <60 objects

2. **Geometry attribute update** (Advanced):
```tsx
useEffect(() => {
  if (!torusGeometryRef.current) return

  const torusRadius = calculateTorusRadius(scale)
  const newGeometry = new THREE.TorusGeometry(torusRadius, 0.1, 16, 32)

  torusGeometryRef.current.attributes.position.copyArray(
    newGeometry.attributes.position.array
  )
  torusGeometryRef.current.attributes.position.needsUpdate = true

  newGeometry.dispose()
}, [scale])
```
- Reuses existing geometry object
- More complex, requires careful memory management
- Better for >100 objects (not needed here)

3. **Throttled updates**:
```tsx
const [torusRadius, setTorusRadius] = useState(0.05)
const lastUpdateTime = useRef(0)

useFrame((state) => {
  // Only update torus geometry every 100ms
  if (state.clock.elapsedTime - lastUpdateTime.current > 0.1) {
    const newRadius = calculateTorusRadius(scale)
    if (Math.abs(newRadius - torusRadius) > 0.001) {
      setTorusRadius(newRadius)
      lastUpdateTime.current = state.clock.elapsedTime
    }
  }
})
```
- Reduces update frequency
- Smooth enough for user perception
- Good compromise

**Recommendation**: Start with `useMemo` approach. Optimize only if performance issues observed.

### Bounding Box Calculations

**Issue**: `Box3.setFromObject()` is expensive, shouldn't run every frame.

**Solution**: Cache unscaled bounding box dimensions.

```tsx
// Calculate once when entering scale mode or on object mount
const unscaledDimensions = useMemo(() => {
  if (!objectRef.current) return { height: 0.5, diagonal: 0.7 }

  const bbox = new THREE.Box3().setFromObject(objectRef.current)
  const size = bbox.getSize(new THREE.Vector3())

  return {
    height: size.y,
    diagonal: size.length()
  }
}, [objectRef, type])  // Recalc only when object or type changes

// Use cached values with current scale
const scaledHeight = unscaledDimensions.height * scale
const scaledDiagonal = unscaledDimensions.diagonal * scale
```

## Implementation Phases

### Phase 1: State Management & Scale Application

**Tasks**:
1. Add `scale: number` to AnchoredObjectData interface (default: 1.0)
2. Create `handleScale(deltaScale: number)` function in PlacementHandler
3. Apply scale to SelectableObject's model group
4. Test: Manually change scale in state → object resizes

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Objects have scale property initialized to 1.0
- Changing scale programmatically resizes object correctly
- Scale is clamped to [0.75, 1.25] range
- Combined with base scale (0.9 for table, 0.25 for bed, etc.)

### Phase 2: Slider Visual Components

**Tasks**:
1. Create `ScaleSlider` component
2. Implement cone geometry (1m tall, 0.1m radius, light green)
3. Rotate cone to point tip down (180° around X-axis)
4. Implement torus with dynamic sizing
5. Position torus at calculated Y position on cone
6. Add to `ModificationVisuals` for scale mode

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Cone appears above selected object in scale mode
- Cone points downward (tip down, base up)
- Torus appears on cone at middle position initially
- Torus resizes based on position (larger at base, smaller at tip)
- Colors correct (light green cone, dark green torus)

### Phase 3: Slider Positioning

**Tasks**:
1. Calculate slider position: anchor + (objectHeight + 0.5m) * planeNormal
2. Extract plane normal from anchor matrix
3. Update slider position each frame
4. Ensure slider moves as object scales (height changes)
5. Test on horizontal planes (floor/table)

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Slider appears 50cm above object's top
- Slider position updates as object scales
- Slider moves perpendicular to placement plane
- Works for floor and table placements

### Phase 4: Slider Orientation (Global Y)

**Tasks**:
1. Set slider group orientation to global axes
2. Ensure cone always points up/down regardless of plane
3. Test on vertical planes (walls) if available
4. Verify cone doesn't tilt with object rotation

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Cone always points straight up/down (global Y)
- Orientation independent of placement plane angle
- Works correctly on walls (slider sticks out from wall)
- Cone doesn't rotate when object rotates

### Phase 5: Thumbstick Input & Scaling

**Tasks**:
1. Create `ScaleController` component
2. Read left and right thumbstick Y-axis values
3. Implement strongest-input-wins logic
4. Apply dead zone (0.1)
5. Calculate delta scale (12.5% per second)
6. Call `handleScale` to update state
7. Test scaling speed and responsiveness

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Thumbstick forward increases size smoothly
- Thumbstick backward decreases size smoothly
- Scaling stops at min (75%) and max (125%) limits
- Both left and right thumbsticks work
- Strongest input wins when both used
- Scaling takes ~4 seconds from min to max with full push

### Phase 6: Torus Animation & Sizing

**Tasks**:
1. Link torus position to scale value
2. Implement dynamic torus radius calculation
3. Update torus geometry when scale changes
4. Ensure smooth animation as user scales
5. Handle edge case at minimum scale (0 radius)

**Files**: `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Torus moves up cone as object grows
- Torus moves down cone as object shrinks
- Torus size increases as it moves toward base
- Torus size decreases as it moves toward tip
- Smooth animation, no jittering
- No geometry errors at minimum radius

### Phase 7: Testing & Polish

**Testing Checklist**:
- [ ] Scaling works for all object types (table, bed, sofa, round-table)
- [ ] Slider appears correctly above object
- [ ] Slider positioned 50cm above object's scaled height
- [ ] Cone always points up/down in global space
- [ ] Torus starts at middle on entering scale mode
- [ ] Torus moves smoothly with thumbstick input
- [ ] Torus size increases toward base, decreases toward tip
- [ ] Scale range correctly limited to [75%, 125%]
- [ ] Scaling speed feels natural (4 seconds for full range)
- [ ] Both thumbsticks control scaling
- [ ] Mode toggle (A button) works smoothly
- [ ] Scale persists after deselecting/reselecting
- [ ] Slider disappears when switching modes or deselecting
- [ ] Works on horizontal planes (floor/table)
- [ ] Works on vertical planes (walls) if available

**Edge Cases**:
- Rapidly pushing thumbstick forward/backward
- Switching modes during scaling
- Scaling to minimum/maximum limits
- Deleting object while in scale mode
- Multiple objects with different scales

**Polish**:
- Adjust cone/torus colors if visibility issues
- Fine-tune slider clearance distance (50cm may need adjustment)
- Verify torus thickness (20cm outer - inner) looks good
- Test with different lighting conditions in AR

## Code Snippets

### Complete ScaleSlider Component

```tsx
interface ScaleSliderProps {
  objectRef: React.RefObject<THREE.Group | null>
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
  scale: number
}

function ScaleSlider({ objectRef, anchor, xrRefSpace, scale }: ScaleSliderProps) {
  const sliderGroupRef = useRef<THREE.Group>(null)
  const { session } = useXR()

  // Cache unscaled object height
  const unscaledHeight = useMemo(() => {
    if (!objectRef.current) return 0.5
    const bbox = new THREE.Box3().setFromObject(objectRef.current)
    const size = bbox.getSize(new THREE.Vector3())
    return size.y
  }, [objectRef])

  // Calculate torus parameters from scale
  const { torusRadius, torusYPosition } = useMemo(() => {
    // Map scale to distance from tip (0 to 1m)
    const distanceFromTip = (scale - 0.75) / 0.5 * 1.0

    // Inner radius formula
    const innerRadius = distanceFromTip * 0.2  // cone diameter / height
    const radius = Math.max(0.01, innerRadius / 2)  // Avoid degenerate geometry

    // Position on cone (tip=+0.5, base=-0.5 due to geometric center)
    const yPos = 0.5 - distanceFromTip

    return { torusRadius: radius, torusYPosition: yPos }
  }, [scale])

  // Update slider position each frame
  useFrame((state) => {
    if (!session || !xrRefSpace || !sliderGroupRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame?.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // Extract anchor position and plane normal
    const anchorMatrix = new THREE.Matrix4().fromArray(anchorPose.transform.matrix)
    const anchorPos = new THREE.Vector3()
    const anchorQuat = new THREE.Quaternion()
    anchorMatrix.decompose(anchorPos, anchorQuat, new THREE.Vector3())

    const planeNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(anchorQuat)

    // Calculate scaled height and slider position
    const scaledHeight = unscaledHeight * scale
    const clearance = 0.5
    const sliderPos = anchorPos.clone()
      .add(planeNormal.clone().multiplyScalar(scaledHeight + clearance))

    sliderGroupRef.current.position.copy(sliderPos)

    // Set orientation to global Y (identity quaternion)
    sliderGroupRef.current.quaternion.set(0, 0, 0, 1)
  })

  return (
    <group ref={sliderGroupRef}>
      {/* Cone: 1m tall, 0.1m radius, tip pointing down */}
      <mesh rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[0.1, 1.0, 16]} />
        <meshBasicMaterial color="#90EE90" side={THREE.DoubleSide} />
      </mesh>

      {/* Torus: dynamic size and position */}
      <mesh position={[0, torusYPosition, 0]}>
        <torusGeometry args={[torusRadius, 0.1, 16, 32]} />
        <meshBasicMaterial color="#006400" />
      </mesh>
    </group>
  )
}
```

### ScaleController Component

```tsx
interface ScaleControllerProps {
  selectedObjectId: string | null
  transformMode: TransformMode
  onScale: (deltaScale: number) => void
}

function ScaleController({ selectedObjectId, transformMode, onScale }: ScaleControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  useFrame((state, delta) => {
    // Only scale when object selected and in scale mode
    if (!selectedObjectId || transformMode !== 'scale') return

    const leftThumbstick = leftController?.gamepad?.['xr-standard-thumbstick']
    const rightThumbstick = rightController?.gamepad?.['xr-standard-thumbstick']

    const leftY = leftThumbstick?.yAxis ?? 0
    const rightY = rightThumbstick?.yAxis ?? 0

    const DEAD_ZONE = 0.1
    const leftActive = Math.abs(leftY) > DEAD_ZONE
    const rightActive = Math.abs(rightY) > DEAD_ZONE

    // Determine scaling input: use strongest thumbstick if both active
    let scaleInput = 0
    if (leftActive && rightActive) {
      scaleInput = Math.abs(leftY) > Math.abs(rightY) ? leftY : rightY
    } else if (leftActive) {
      scaleInput = leftY
    } else if (rightActive) {
      scaleInput = rightY
    }

    // Apply scaling
    if (scaleInput !== 0) {
      // Speed: 12.5% per second = 0.125 scale units per second
      const scaleSpeed = 0.125
      const deltaScale = scaleInput * scaleSpeed * delta

      onScale(deltaScale)
    }
  })

  return null
}
```

### Scale State Management

```tsx
// In PlacementHandler component

const [anchoredObjects, setAnchoredObjects] = useState<Array<{
  id: string
  anchor: XRAnchor
  type: 'table' | 'bed' | 'sofa' | 'round-table'
  rotation: number
  scale: number  // NEW: 0.75 to 1.25
}>>([])

// Handler for scale changes
const handleScale = (deltaScale: number) => {
  if (!selectedObjectId) return

  setAnchoredObjects(prev => prev.map(obj => {
    if (obj.id === selectedObjectId) {
      const newScale = obj.scale + deltaScale
      const clampedScale = Math.max(0.75, Math.min(1.25, newScale))
      return { ...obj, scale: clampedScale }
    }
    return obj
  }))
}

// Initialize with default scale when creating object
const createObject = () => {
  setAnchoredObjects(prev => [...prev, {
    id: Math.random().toString(),
    anchor: anchor,
    type: selectedObjectType,
    rotation: 0,
    scale: 1.0  // 100% = default
  }])
}
```

## Key Learnings Applied

### From Rotate Mode Implementation

1. **Plane Normal Extraction**: Use anchor's Y-axis to get perpendicular direction
2. **Child Component Positioning**: Children inherit parent transform
3. **useMemo for Performance**: Cache expensive calculations like bounding boxes
4. **Thumbstick Input Pattern**: Dead zone, strongest-input-wins, frame-rate independence

### From AR Hit Testing

1. **Matrix Operations**: Use `Matrix4` for position/orientation calculations
2. **Direct Position Assignment**: Set position directly, don't use decompose unnecessarily
3. **Anchor Tracking**: Check `frame.trackedAnchors?.has(anchor)` before using pose

### From Three.js Documentation

1. **Geometry Origins**: ConeGeometry center is at geometric center, not base
2. **TorusGeometry Sizing**: Main radius + tube radius defines outer diameter
3. **Quaternion for Orientation**: Use identity quaternion for global axes alignment
4. **meshBasicMaterial**: Unlit material ensures visibility in AR passthrough

## Challenges & Solutions

### Challenge 1: Cone Orientation vs. Parent Orientation

**Problem**: Cone must point down in global Y even when placed on wall (vertical plane).

**Solution**: Place slider in its own group separate from object hierarchy. Set position in world space, use identity quaternion or fixed rotation for global Y alignment.

### Challenge 2: Dynamic Torus Sizing

**Problem**: Torus inner radius changes from 0cm to 10cm as it moves along cone.

**Solution**: Recalculate TorusGeometry in `useMemo` based on scale. Use minimal radius (0.01m) at tip to avoid degenerate geometry. Accept geometry recreation cost as it only happens when scale changes.

### Challenge 3: Slider Position Updates with Scale

**Problem**: As object grows, slider must move further away to maintain clearance.

**Solution**: Cache unscaled height in `useMemo`. Multiply by current scale in `useFrame`. Recalculate slider position every frame based on scaled height.

### Challenge 4: Scale Range Mapping

**Problem**: Map scale value (0.75 to 1.25) to torus position (0 to 1m) and inner radius (0 to 10cm).

**Solution**: Linear interpolation formula:
```
distanceFromTip = (scale - 0.75) / 0.5 * 1.0
innerRadius = distanceFromTip * 0.1  (cone radius / cone height)
```

### Challenge 5: Combined Scale Factors

**Problem**: Objects already have base scale factors (table=0.9, bed=0.25). User scale must be additive.

**Solution**: Store user scale separately (1.0 = 100%). Apply as: `finalScale = baseScale * userScale`. User scales from 75% to 125% of the already-scaled model.

## References

### Documentation

- [Three.js ConeGeometry](https://threejs.org/docs/#api/en/geometries/ConeGeometry)
- [Three.js TorusGeometry](https://threejs.org/docs/#api/en/geometries/TorusGeometry)
- [Three.js Quaternion](https://threejs.org/docs/#api/en/math/Quaternion)
- [Three.js Box3](https://threejs.org/docs/#api/en/math/Box3)
- [React Three Fiber - useFrame](https://docs.pmnd.rs/react-three-fiber/api/hooks#useframe)
- [@react-three/xr - useXRInputSourceState](https://github.com/pmndrs/xr)

### Codebase References

- `src/components/ARHitTestManager.tsx` - Rotate mode implementation, anchor positioning
- `docs/r3f-learnings.md` - Matrix operations, controller input patterns
- `docs/feature4-2-rotate-research.md` - Quaternion rotation, mode toggling, bounding box caching

### Mathematical Formulas

**Torus Inner Diameter**: `innerDiameter = distanceFromTip * (coneDiameter / coneHeight)`
- At tip (0m): 0 * (0.2 / 1.0) = 0cm
- At middle (0.5m): 0.5 * (0.2 / 1.0) = 10cm
- At base (1m): 1.0 * (0.2 / 1.0) = 20cm

**Scale to Distance Mapping**: `distanceFromTip = (scale - 0.75) / 0.5 * 1.0`
- At scale 0.75: (0.75 - 0.75) / 0.5 * 1.0 = 0m
- At scale 1.00: (1.00 - 0.75) / 0.5 * 1.0 = 0.5m
- At scale 1.25: (1.25 - 0.75) / 0.5 * 1.0 = 1m

**Cone Local Y Position**: `torusY = (coneHeight / 2) - distanceFromTip`
- At 0m from tip: 0.5 - 0 = +0.5 (tip)
- At 0.5m from tip: 0.5 - 0.5 = 0 (center)
- At 1m from tip: 0.5 - 1.0 = -0.5 (base)

## Next Steps

After implementing scale mode:
1. Test thoroughly on Quest 2 device
2. Document any issues or refinements needed
3. Prepare for Feature 4.2.3 (Move Mode) implementation
4. Consider performance optimizations if needed
5. Update CLAUDE.md with scale mode patterns and learnings
