# Feature 4.1 Research: Object Selection and Deletion

## Overview

Feature 4.1 implements object selection and deletion functionality for objects placed in AR mode. This builds on Feature 3 (Object Palette) by adding the ability to:
1. Select a placed object by pointing at it with the controller and pressing trigger
2. Deselect by pointing elsewhere and pressing trigger
3. Delete the selected object by pressing B button on right controller

This feature is the foundation for Feature 4.2 (Object Modification), which will add rotation, scaling, and position transformation.

## User Workflow

Based on feature requirements:

1. **Select Object**: Point controller ray at a placed object → Press trigger → Object selected
2. **Deselect Object**: Point anywhere else (not on object) → Press trigger → Object deselected
3. **Delete Object**: With object selected → Press B button on right controller → Object deleted

**Key Points**:
- Controller rays are already visible from Feature 3 implementation
- Selection uses the same trigger/pointer event system as palette selection
- Only one object can be selected at a time
- Visual feedback indicates selected object (axes will be added in 4.2)
- B button only works when object is selected
- Pressing B without selection does nothing

## Component Architecture

```
Scene (AR mode)
├── ARHitTestManager (existing from Features 2 & 3)
│   ├── Reticle (cursor - visible in draw mode)
│   ├── PlacementHandler (creates anchored objects)
│   └── PlacedObjects (new: manages placed object instances)
│       └── SelectableObject (new: individual placed object with selection logic)
│           ├── 3D Model (table/bed/sofa GLB)
│           ├── Selection Highlight (visual feedback)
│           └── onClick handler for selection
└── SelectionController (new: handles B button for deletion)
```

## State Management

### Current State (Feature 3)

```tsx
// In ARHitTestManager PlacementHandler
const [anchoredObjects, setAnchoredObjects] = useState<Array<{
  id: string
  anchor: XRAnchor
  type: 'table' | 'bed' | 'sofa'
}>>([])
```

### Required State Changes

```tsx
// Extend anchoredObjects interface to include selection state
interface AnchoredObjectData {
  id: string
  anchor: XRAnchor
  type: 'table' | 'bed' | 'sofa'
}

// Add selection state (lifted to Scene or ARHitTestManager level)
const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)

// Alternative: Store selection in object data (NOT RECOMMENDED for performance)
// This would cause re-renders of all objects when selection changes
interface AnchoredObjectData {
  id: string
  anchor: XRAnchor
  type: 'table' | 'bed' | 'sofa'
  isSelected: boolean  // AVOID - causes unnecessary re-renders
}
```

### State Management Strategy

**Recommended Approach**: Lift selection state to parent component level.

**Rationale**:
- Selection state is global - only one object selected at a time
- Avoids prop drilling if using context
- Prevents unnecessary re-renders of unselected objects
- Makes deletion logic centralized and simple
- Easier to integrate with Feature 4.2's transform modes

**Implementation**:
```tsx
// In ARHitTestManager or Scene component
const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
const [anchoredObjects, setAnchoredObjects] = useState<AnchoredObjectData[]>([])

// Delete handler
const handleDeleteSelected = () => {
  if (!selectedObjectId) return

  setAnchoredObjects(prev => prev.filter(obj => obj.id !== selectedObjectId))
  setSelectedObjectId(null)
}

// Selection handler
const handleSelectObject = (id: string) => {
  setSelectedObjectId(id)
}

// Deselection handler
const handleDeselectObject = () => {
  setSelectedObjectId(null)
}
```

## Technical Implementation Details

### 1. Object Selection with Controller Rays

**Approach**: Use @react-three/xr's built-in pointer events on placed object meshes.

**Current Implementation Context**:
- Controllers already have rays visible (Feature 3)
- Pointer events already work on palette buttons (Feature 3)
- Same pattern applies to placed objects

**Implementation**:

```tsx
function SelectableObject({
  id,
  anchor,
  xrRefSpace,
  type,
  isSelected,
  onSelect,
  onDeselect
}: SelectableObjectProps) {
  const groupRef = useRef<THREE.Group>(null)
  const { session } = useXR()

  // Load GLB model (existing from Feature 3)
  const modelPath = `/asset/${type}.glb`
  const { scene } = useGLTF(modelPath)
  const clonedScene = useMemo(() => scene.clone(), [scene])

  // Update position from anchor each frame (existing)
  useFrame((state) => {
    if (!session || !xrRefSpace || !groupRef.current) return
    const frame = state.gl.xr.getFrame()
    if (!frame?.trackedAnchors?.has(anchor)) return

    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    groupRef.current.matrix.fromArray(anchorPose.transform.matrix)
    // Apply Y offset for base positioning (existing logic)
  })

  // NEW: Selection handler
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation() // Prevent triggering deselection
    onSelect(id)
  }

  return (
    <group
      ref={groupRef}
      matrixAutoUpdate={false}
      onClick={handleClick}  // NEW
    >
      <primitive object={clonedScene} />

      {/* NEW: Visual feedback for selection */}
      {isSelected && (
        <SelectionHighlight type={type} />
      )}
    </group>
  )
}

// NEW: Visual selection feedback component
function SelectionHighlight({ type }: { type: string }) {
  // Could be outline, glow, bounding box, etc.
  // For now, simple wireframe box around object
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color="yellow"
        wireframe
        opacity={0.5}
        transparent
      />
    </mesh>
  )
}
```

**Key Points**:
- `onClick` fires when trigger pressed while ray intersects object
- `event.stopPropagation()` prevents event bubbling to background
- Visual feedback clearly indicates selected state
- Same interaction pattern as palette buttons

### 2. Deselection by Clicking Empty Space

**Challenge**: How to detect "clicking on nothing" in 3D space?

**Solution**: Listen to the session 'select' event and use a flag to track if an object handled the click.

**Implementation**:

```tsx
function PlacementHandler({
  hitResult,
  xrRefSpace,
  isDrawMode,
  selectedObjectType
}) {
  const { session } = useXR()
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [anchoredObjects, setAnchoredObjects] = useState([...])
  const objectClickedRef = useRef(false)

  // Listen for select event for both placement and deselection
  useEffect(() => {
    if (!session) return

    const onSelect = () => {
      // Check if an object was clicked
      if (!objectClickedRef.current && selectedObjectId) {
        // No object clicked but we have a selection - deselect
        console.log('Deselecting - clicked empty space')
        setSelectedObjectId(null)
      }

      // Reset flag for next select event
      objectClickedRef.current = false

      // Existing placement logic
      if (isDrawMode && selectedObjectType && hitResult && xrRefSpace) {
        // ... anchor creation code ...
      }
    }

    session.addEventListener('select', onSelect)
    return () => session.removeEventListener('select', onSelect)
  }, [session, hitResult, xrRefSpace, isDrawMode, selectedObjectType, selectedObjectId])

  return (
    <>
      {anchoredObjects.map(({ id, anchor, type }) => (
        <SelectableObject
          key={id}
          id={id}
          anchor={anchor}
          xrRefSpace={xrRefSpace}
          type={type}
          isSelected={selectedObjectId === id}
          onSelect={(id) => {
            objectClickedRef.current = true
            setSelectedObjectId(id)
          }}
        />
      ))}
    </>
  )
}
```

**How It Works**:
1. `objectClickedRef` tracks whether any object handled the current select event
2. When an object is clicked, it sets the flag to `true` BEFORE the session 'select' event fires
3. In the session 'select' handler:
   - If flag is `false` and we have a selection → deselect (clicked empty space)
   - If flag is `true` → object already handled it (selection already updated)
4. Reset flag after each select event

**Why This Is Better Than Invisible Plane**:
- No extra geometry in the scene
- More explicit and readable logic
- Aligns with existing 'select' event pattern used for placement
- No need to manage invisible collision meshes
- More efficient (no raycasting against large plane)

**Key Points**:
- Use `useRef` for the flag to avoid re-renders
- Reset flag AFTER checking, not before
- Objects still call `event.stopPropagation()` to prevent event bubbling issues
- Works seamlessly with existing placement logic in same event handler

### 3. Controller Button Detection for Deletion

**Requirement**: Detect B button press on right controller to delete selected object.

**Quest 2 Button Mapping**:

From WebXR specification and research:
- **Right Controller**:
  - `buttons[0]`: Thumbstick press
  - `buttons[1]`: Trigger
  - `buttons[2]`: Grip/squeeze
  - `buttons[3]`: A button
  - `buttons[4]`: B button
  - `buttons[5]`: Thumbrest (dummy/placeholder)

- **Left Controller**:
  - `buttons[0]`: Thumbstick press
  - `buttons[1]`: Trigger
  - `buttons[2]`: Grip/squeeze
  - `buttons[3]`: X button
  - `buttons[4]`: Y button
  - `buttons[5]`: Thumbrest (dummy/placeholder)

**Named Gamepad Components** (used in Feature 3):
- @react-three/xr provides named access: `'a-button'`, `'b-button'`, `'x-button'`, `'y-button'`
- These are more readable than numeric indices
- Same state detection pattern as Y/X buttons in Feature 3

**Implementation**:

```tsx
function SelectionController({ selectedObjectId, onDeleteSelected }) {
  const rightController = useXRInputSourceState('controller', 'right')
  const previousBState = useRef(false)

  useFrame(() => {
    if (!rightController?.gamepad) return

    // B button detection on right controller
    const bButton = rightController.gamepad['b-button']
    const isBPressed = bButton?.state === 'pressed'

    // Edge detection: trigger only on press (false → true transition)
    if (isBPressed && !previousBState.current && selectedObjectId) {
      console.log('B button pressed - deleting selected object')
      onDeleteSelected()
    }
    previousBState.current = isBPressed
  })

  return null
}
```

**Key Points**:
- Use `useXRInputSourceState('controller', 'right')` to get right controller
- Access B button via `gamepad['b-button']`
- Edge detection with ref to avoid repeated triggers on hold
- Only delete if `selectedObjectId` exists (guarded deletion)
- Same pattern as Y/X button detection in Feature 3

**Alternative**: Use numeric index (less readable but works)
```tsx
const bButton = rightController.gamepad.buttons?.[4]
const isBPressed = bButton?.pressed === true
```

### 4. Object Deletion Logic

**Approach**: Remove object from state array by filtering out the selected ID.

**Implementation**:

```tsx
// In parent component (ARHitTestManager or Scene)
const handleDeleteSelected = () => {
  if (!selectedObjectId) return

  console.log(`Deleting object: ${selectedObjectId}`)

  // Remove from anchored objects array
  setAnchoredObjects(prev => prev.filter(obj => obj.id !== selectedObjectId))

  // Clear selection state
  setSelectedObjectId(null)
}
```

**Cleanup Considerations**:

WebXR anchors should be cleaned up when no longer needed. However:
- Anchors are managed by the WebXR system
- When component unmounts, React handles cleanup
- Anchor object will be garbage collected
- No explicit `anchor.delete()` or similar method in WebXR API
- React's unmount cleanup is sufficient

**Alternative with Explicit Cleanup**:
```tsx
const [anchoredObjects, setAnchoredObjects] = useState<Map<string, {
  anchor: XRAnchor
  type: string
}>>(new Map())

const handleDeleteSelected = () => {
  if (!selectedObjectId) return

  const obj = anchoredObjects.get(selectedObjectId)
  if (obj?.anchor) {
    // Anchors don't have explicit delete method in WebXR API
    // Just remove from state and let garbage collection handle it
  }

  setAnchoredObjects(prev => {
    const next = new Map(prev)
    next.delete(selectedObjectId)
    return next
  })

  setSelectedObjectId(null)
}
```

**Recommendation**: Simple filter approach is sufficient. React handles cleanup automatically.

### 5. Visual Feedback for Selection

**Requirement**: "Visual feedback for currently selected object is based on the 'axes' that appear for the modification."

**For Feature 4.1**: Since axes are part of Feature 4.2, we need temporary visual feedback.

**Options**:

#### Option A: Simple Outline/Wireframe (Recommended for 4.1)
```tsx
function SelectionHighlight({ type }) {
  // Simple wireframe box as placeholder
  // Will be replaced by axes in Feature 4.2
  return (
    <mesh position={[0, 0.5, 0]}>
      <boxGeometry args={[0.8, 0.8, 0.8]} />
      <meshBasicMaterial
        color="yellow"
        wireframe
        opacity={0.8}
        transparent
      />
    </mesh>
  )
}
```

#### Option B: Glow Effect (More polished)
```tsx
import { Outlines } from '@react-three/drei'

function SelectableObject({ isSelected, ... }) {
  return (
    <group ...>
      <primitive object={clonedScene} />
      {isSelected && <Outlines thickness={0.05} color="yellow" />}
    </group>
  )
}
```

#### Option C: Simple Color Change
```tsx
// Change material emissive color when selected
useEffect(() => {
  if (!clonedScene) return

  clonedScene.traverse((child) => {
    if (child.isMesh && child.material) {
      if (isSelected) {
        child.material.emissive.setHex(0xffff00)
        child.material.emissiveIntensity = 0.3
      } else {
        child.material.emissive.setHex(0x000000)
        child.material.emissiveIntensity = 0
      }
    }
  })
}, [isSelected, clonedScene])
```

**Recommendation**:
- Start with Option A (wireframe) for simplicity
- Easy to replace with axes in Feature 4.2
- Clear visual indicator without modifying loaded models
- No additional dependencies needed

### 6. Integration with Existing Code

**Current Code Structure** (Feature 3):

```tsx
// ARHitTestManager.tsx
function PlacementHandler({ hitResult, xrRefSpace, isDrawMode, selectedObjectType }) {
  const [anchoredObjects, setAnchoredObjects] = useState([...])

  useEffect(() => {
    // Listen for select event, create anchors
  }, [session, hitResult, ...])

  return (
    <>
      {anchoredObjects.map(({ id, anchor, type }) => (
        <AnchoredObject key={id} anchor={anchor} xrRefSpace={xrRefSpace} type={type} />
      ))}
    </>
  )
}

function AnchoredObject({ anchor, xrRefSpace, type }) {
  // Loads GLB, updates position from anchor
  return <group><primitive object={clonedScene} /></group>
}
```

**Required Changes**:

1. **Rename `AnchoredObject` to `SelectableObject`** (semantic clarity)
2. **Add selection props** to SelectableObject
3. **Lift state** for selection management
4. **Add wrapper** for deselection plane
5. **Add SelectionController** component for B button

**Modified Structure**:

```tsx
// ARHitTestManager.tsx
function PlacementHandler({
  hitResult,
  xrRefSpace,
  isDrawMode,
  selectedObjectType
}) {
  const [anchoredObjects, setAnchoredObjects] = useState([...])
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const objectClickedRef = useRef(false)

  // Delete logic
  const handleDelete = () => {
    if (!selectedObjectId) return
    setAnchoredObjects(prev => prev.filter(obj => obj.id !== selectedObjectId))
    setSelectedObjectId(null) // Clear selection after delete
  }

  useEffect(() => {
    // Combined placement and deselection logic
    const onSelect = () => {
      // Handle deselection
      if (!objectClickedRef.current && selectedObjectId) {
        setSelectedObjectId(null)
      }
      objectClickedRef.current = false

      // Existing anchor creation logic
      if (isDrawMode && selectedObjectType && hitResult && xrRefSpace) {
        // ... create anchor ...
      }
    }

    session.addEventListener('select', onSelect)
    return () => session.removeEventListener('select', onSelect)
  }, [session, hitResult, selectedObjectId, ...])

  return (
    <>
      {/* Modified: SelectableObject instead of AnchoredObject */}
      {anchoredObjects.map(({ id, anchor, type }) => (
        <SelectableObject
          key={id}
          id={id}
          anchor={anchor}
          xrRefSpace={xrRefSpace}
          type={type}
          isSelected={selectedObjectId === id}
          onSelect={(id) => {
            objectClickedRef.current = true
            setSelectedObjectId(id)
          }}
        />
      ))}

      {/* NEW: B button controller */}
      <SelectionController
        selectedObjectId={selectedObjectId}
        onDeleteSelected={handleDelete}
      />
    </>
  )
}

// Renamed and enhanced
function SelectableObject({
  id, anchor, xrRefSpace, type, isSelected, onSelect
}) {
  // Existing position update logic
  // + NEW: onClick handler
  // + NEW: SelectionHighlight when isSelected

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(id); }}>
      <primitive object={clonedScene} />
      {isSelected && <SelectionHighlight />}
    </group>
  )
}

// NEW component
function SelectionController({ selectedObjectId, onDeleteSelected }) {
  // B button detection logic
}

// NEW component
function SelectionHighlight() {
  // Visual feedback - wireframe box
}
```

**State Management Location**:

Keep selection state in PlacementHandler component since:
- It already manages `anchoredObjects` state
- Delete logic needs both states together
- Keeps Feature 4.1 self-contained
- Simple and straightforward

```tsx
function PlacementHandler(...) {
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)
  const [anchoredObjects, setAnchoredObjects] = useState([...])
  const objectClickedRef = useRef(false)
  // ...
}
```

**Note**: If Feature 4.2 requires lifting state to Scene component, refactor at that time. For now, keeping everything in PlacementHandler is cleaner.

## Pointer Event System Deep Dive

### How @react-three/xr Pointer Events Work

From research on @react-three/xr documentation:

1. **Automatic Raycasting**:
   - Controllers automatically project rays into the scene
   - Each frame, rays are tested against all interactive objects
   - No manual raycasting needed

2. **Event Types**:
   - `onClick`: Full click (down + up on same object)
   - `onPointerDown`: Trigger pressed
   - `onPointerUp`: Trigger released
   - `onPointerOver`: Ray enters object bounds
   - `onPointerOut`: Ray exits object bounds
   - `onPointerMove`: Ray moves within object

3. **Event Object Properties**:
   ```tsx
   interface ThreeEvent<T> {
     point: THREE.Vector3      // Intersection point in world space
     distance: number          // Distance from ray origin
     object: THREE.Object3D    // The intersected object
     face: THREE.Face          // The intersected face
     stopPropagation: () => void
     // ... more properties
   }
   ```

4. **Event Propagation**:
   - Events bubble up through object hierarchy by default
   - Call `event.stopPropagation()` to prevent bubbling
   - Critical for preventing deselection plane from firing when clicking objects

5. **Pointer Types**:
   - XR controllers emit pointer events with type 'tracked-pointer'
   - Can filter events by pointer type if needed
   - Works with both left and right controllers simultaneously

### Optimizing Pointer Event Performance

From React Three Fiber performance best practices:

1. **Minimize Interactive Objects**:
   - Only add pointer events to objects that need them
   - Use `pointer-events: none` CSS-style property for non-interactive objects
   - Example: `<mesh pointerEvents="none">`

2. **Raycasting Layers**:
   - Use Three.js layers to limit raycast targets
   - Not typically necessary for AR use case with limited objects

3. **Event Handler Optimization**:
   - Use useCallback for event handlers if passing as props
   - Avoid creating new functions on every render

```tsx
const handleSelect = useCallback((id: string) => {
  setSelectedObjectId(id)
}, [])
```

4. **Bounding Box Accuracy**:
   - Complex GLB models may have expensive raycasting
   - Consider using simplified collision meshes if performance issues arise
   - For Feature 4.1 with 3-10 objects, not a concern

## Implementation Plan

### Phase 1: Object Selection

**What to implement**:
1. Rename `AnchoredObject` to `SelectableObject`
2. Add `id` prop to SelectableObject
3. Add `isSelected` prop to SelectableObject
4. Add `onSelect` callback prop to SelectableObject
5. Implement `onClick` handler in SelectableObject
6. Add `event.stopPropagation()` to prevent bubbling
7. Add selection state management in PlacementHandler
8. Test: Click object → console log selection

**Files to modify**:
- `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Clicking placed object logs "Object selected: {id}"
- Selection state updates correctly

### Phase 2: Visual Feedback

**What to implement**:
1. Create `SelectionHighlight` component
2. Simple wireframe box around selected object
3. Conditionally render highlight when `isSelected={true}`
4. Position highlight to match object bounds
5. Test visual feedback appears on selection

**Files to modify**:
- `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Selected object shows clear visual indicator (yellow wireframe)
- Indicator disappears when different object selected

### Phase 3: Deselection

**What to implement**:
1. Add `objectClickedRef` to track if object was clicked
2. Update session 'select' event handler to check flag
3. If flag is false and we have a selection, deselect
4. Reset flag after each select event
5. Update object onClick to set flag before selecting
6. Test: Click empty space → selection cleared → visual feedback disappears

**Files to modify**:
- `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Clicking empty space deselects current selection
- Visual feedback disappears
- Console logs "Object deselected"
- No interference with object placement logic

### Phase 4: B Button Detection

**What to implement**:
1. Create `SelectionController` component
2. Use `useXRInputSourceState('controller', 'right')`
3. Access B button via `gamepad['b-button']`
4. Implement edge detection with useRef
5. Wire up to `onDeleteSelected` callback
6. Test: Press B with object selected → console log

**Files to create**:
- Add `SelectionController` to `ARHitTestManager.tsx`

**Success Criteria**:
- Pressing B with selection logs "Delete requested"
- Pressing B without selection does nothing
- Edge detection works (single trigger per press)

### Phase 5: Object Deletion

**What to implement**:
1. Implement `handleDeleteSelected` function
2. Filter object from `anchoredObjects` array
3. Clear selection state after deletion
4. Test: Full workflow

**Files to modify**:
- `src/components/ARHitTestManager.tsx`

**Success Criteria**:
- Selected object removed from scene
- Selection state cleared
- Remaining objects unaffected
- Can select and delete multiple objects sequentially

### Phase 6: Testing & Polish

**What to test**:
1. Selection workflow on Quest 2 device
2. Controller ray accuracy
3. Visual feedback visibility and clarity
4. B button responsiveness
5. Edge cases: spam clicking, rapid selection changes
6. Interaction with draw mode (should they conflict?)

**Polish**:
1. Adjust highlight size/color if needed
2. Add console logs for debugging
3. Test with all object types (table, bed, sofa)
4. Verify no memory leaks with repeated add/delete cycles

**Success Criteria**:
- Smooth, intuitive selection experience
- Clear visual feedback
- Reliable deletion with B button
- No bugs or edge case issues

## Code Structure

### New Components

**SelectionController** - Handles B button input for deletion
- Monitors right controller B button
- Edge detection for button press
- Calls deletion callback when selected object exists

**SelectionHighlight** - Visual feedback for selected object
- Simple wireframe box
- Positioned around selected object
- Temporary until axes added in Feature 4.2

### Modified Components

**AnchoredObject → SelectableObject**
- Renamed for semantic clarity
- Added `id`, `isSelected`, `onSelect` props
- Added `onClick` handler with stopPropagation
- Conditionally renders SelectionHighlight

**PlacementHandler**
- Added selection state management
- Added deselection plane
- Added SelectionController
- Added delete logic
- Passes selection props to SelectableObject

### Modified Files

**src/components/ARHitTestManager.tsx**
- All Feature 4.1 changes contained in this file
- No changes to App.tsx or ObjectPalette.tsx needed
- Self-contained feature implementation

## Testing Strategy

### Desktop Testing (WebXR Emulator)

1. **Selection Testing**:
   - Place multiple objects in AR
   - Click each object with mouse
   - Verify visual feedback appears
   - Verify only one object selected at a time

2. **Deselection Testing**:
   - Select an object
   - Click empty space
   - Verify selection clears

3. **Deletion Testing**:
   - Simulate B button press (may need keyboard mapping)
   - Verify selected object deleted
   - Verify can't delete without selection

### Quest 2 Device Testing

1. **Controller Accuracy**:
   - Test ray pointing at small objects
   - Verify trigger press selects reliably
   - Test from various distances and angles

2. **Visual Feedback**:
   - Verify highlight is visible and clear
   - Test in different lighting conditions (AR passthrough)
   - Verify highlight scales appropriately with object

3. **B Button Workflow**:
   - Select object with left/right controller
   - Press B on right controller
   - Verify object deleted
   - Test rapid selections and deletions

4. **Integration Testing**:
   - Test selection while in draw mode
   - Test switching between palette and selection
   - Verify no conflicts between features

### Edge Cases to Test

1. **Rapid Selection Changes**: Click objects quickly in sequence
2. **Spam Clicking**: Click same object repeatedly
3. **Held B Button**: Hold B button - should only delete once
4. **Delete During Animation**: Delete object while hand moving
5. **Select Then Draw**: Select object then try to place new one
6. **Draw Then Select**: Place object then immediately select it

## Performance Considerations

### Expected Object Count

Based on Feature 3 implementation:
- Typical session: 5-15 placed objects
- Maximum recommended: 30 objects (per CLAUDE.md)
- Feature 4.1 should handle 30 objects smoothly

### Optimization Strategies

1. **State Updates**: Use functional updates to avoid stale closures
   ```tsx
   setAnchoredObjects(prev => prev.filter(obj => obj.id !== selectedObjectId))
   ```

2. **Refs for Button State**: Prevent re-renders on every frame
   ```tsx
   const previousBState = useRef(false)
   ```

3. **Memoization**: Clone GLB scenes once, not on every render
   ```tsx
   const clonedScene = useMemo(() => scene.clone(), [scene])
   ```

4. **Conditional Rendering**: Only render highlight when selected
   ```tsx
   {isSelected && <SelectionHighlight />}
   ```

5. **Event Handler Callbacks**: Use useCallback to prevent recreating functions
   ```tsx
   const handleSelect = useCallback((id: string) => {
     setSelectedObjectId(id)
   }, [])
   ```

### Performance Monitoring

- Monitor frame rate during selection/deletion
- Check for memory leaks with repeated add/delete cycles
- Verify smooth controller tracking during interactions
- Ensure selection doesn't impact placement performance

## Integration with Existing Features

### Feature 2 (AR Plane Detection)

- No changes required
- Hit testing and cursor continue working
- Placement creates objects with unique IDs

### Feature 3 (Object Palette)

- No changes required
- Palette and selection are separate concerns
- Draw mode and selection mode don't conflict
- Possible future enhancement: Show selected object type in palette

### Future Feature 4.2 (Object Modification)

**Preparation for 4.2**:
1. Selection state already established
2. Visual feedback placeholder (wireframe) ready to replace with axes
3. Object reference system in place
4. State management pattern set up

**Expected 4.2 Integration**:
```tsx
// Feature 4.2 will add:
const [transformMode, setTransformMode] = useState<'rotate' | 'scale' | 'position'>('rotate')

// SelectableObject will render different axes based on mode:
{isSelected && (
  <TransformAxes mode={transformMode} objectType={type} />
)}
```

## Potential Challenges & Solutions

### Challenge 1: Deselection Timing

**Problem**: Object selection and deselection both respond to 'select' event - order matters.

**Solution**:
- Use ref flag that objects set synchronously in their onClick
- Session 'select' event fires after, checks flag
- Flag approach ensures objects can "claim" the select event

**Testing**:
- Click object → should select, not deselect
- Click empty space → should deselect
- Rapid clicking between objects → should work correctly

### Challenge 2: B Button Not Registering

**Problem**: Button state detection might miss presses.

**Solution**:
- Use edge detection (false → true transition)
- Check `button.state === 'pressed'` not `button.pressed`
- Add console logs for debugging

**Fallback**:
- If named button access fails, use numeric index: `buttons[4]`

### Challenge 3: Visual Feedback Positioning

**Problem**: Highlight might not align with complex GLB models.

**Solution**:
- For 4.1: Simple wireframe at group origin is sufficient
- For 4.2: Calculate bounding box and size highlight appropriately
- Use model bounds to determine highlight scale

### Challenge 4: Selection in Dense Object Clusters

**Problem**: Hard to select specific object when many are close together.

**Solution**:
- Raycasting automatically picks closest intersection
- Trust @react-three/xr's raycaster
- If issues arise, consider increasing pointer ray thickness

### Challenge 5: Interaction with Draw Mode

**Problem**: Should users be able to select objects while in draw mode? Placement and selection both use 'select' event.

**Current Spec**: No explicit restrictions mentioned.

**Solution**:
- Allow selection anytime (more flexible UX)
- Use flag-based approach to distinguish between:
  - Object clicked → selection happens, placement skipped (flag = true)
  - Empty space clicked in draw mode → placement happens, deselection skipped (flag = false)
- Both behaviors can coexist in same event handler

**Implementation**:
```tsx
const onSelect = () => {
  // Handle selection/deselection first
  if (objectClickedRef.current) {
    // Object was clicked - selection already handled by object onClick
    objectClickedRef.current = false
    return // Don't place object when selecting
  }

  if (selectedObjectId) {
    // Clicked empty space with selection - deselect
    setSelectedObjectId(null)
  }

  // Then handle placement
  if (isDrawMode && selectedObjectType && hitResult && xrRefSpace) {
    // ... create anchor ...
  }
}
```

This allows users to:
1. Select objects while in draw mode
2. Place new objects while an object is selected
3. Deselect by clicking empty space (even in draw mode)

## Key Learnings Applied

### From docs/r3f-learnings.md

1. **Pointer Events**: @react-three/xr handles raycasting automatically - no manual raycaster setup
2. **Button Input**: Use `useXRInputSourceState` hook, not raw WebXR API
3. **State Management**: Use refs for per-frame updates, state for UI updates
4. **Performance**: Minimize re-renders by lifting state appropriately

### From Feature 3 Implementation

1. **Named Button Access**: Use `'b-button'` instead of `buttons[4]` for clarity
2. **Edge Detection Pattern**: Track previous state with ref to detect transitions
3. **Controller Rays**: Already visible and working - no additional setup
4. **Pointer Events**: onClick handlers work seamlessly on 3D meshes

### New Patterns for Feature 4.1

1. **Deselection Plane**: Invisible mesh captures "click nothing" events
2. **StopPropagation**: Essential for nested interactive objects
3. **Selection Highlighting**: Temporary wireframe approach until axes implemented
4. **Deletion Logic**: Simple state filter - React handles cleanup

## API Reference

### WebXR Gamepad Buttons (Quest 2)

**Left Controller**:
- `buttons[0]` / `gamepad['xr-standard-thumbstick']`: Thumbstick press
- `buttons[1]` / `gamepad['xr-standard-trigger']`: Trigger
- `buttons[2]` / `gamepad['xr-standard-squeeze']`: Grip
- `buttons[3]` / `gamepad['x-button']`: X button
- `buttons[4]` / `gamepad['y-button']`: Y button

**Right Controller**:
- `buttons[0]` / `gamepad['xr-standard-thumbstick']`: Thumbstick press
- `buttons[1]` / `gamepad['xr-standard-trigger']`: Trigger
- `buttons[2]` / `gamepad['xr-standard-squeeze']`: Grip
- `buttons[3]` / `gamepad['a-button']`: A button
- `buttons[4]` / `gamepad['b-button']`: B button

### @react-three/xr Hooks

**useXRInputSourceState(type, hand)**
```tsx
const controller = useXRInputSourceState('controller', 'right')
const button = controller?.gamepad?.['b-button']
const isPressed = button?.state === 'pressed'
```

### React Three Fiber Events

**ThreeEvent Properties**:
- `event.point`: Vector3 intersection point
- `event.distance`: Distance from ray origin
- `event.object`: Intersected Object3D
- `event.stopPropagation()`: Prevent event bubbling

## References

### Documentation

- [@react-three/xr Interactions Tutorial](https://pmndrs.github.io/xr/docs/tutorials/interactions)
- [WebXR Gamepads Module Spec](https://www.w3.org/TR/webxr-gamepads-module-1/)
- [React Three Fiber Events](https://r3f.docs.pmnd.rs/api/events)
- [Three.js Raycaster](https://threejs.org/docs/api/en/core/Raycaster.html)

### Codebase References

- `src/components/ARHitTestManager.tsx` - Anchor creation and object tracking
- `src/components/ObjectPalette.tsx` - Button input pattern (Y/X buttons)
- `docs/r3f-learnings.md` - Core patterns and best practices
- `docs/feature3-research.md` - Pointer events and button detection

### Research Sources

- Quest 2 button mapping: WebXR specification and developer forums
- Pointer event performance: React Three Fiber performance guide
- State management patterns: React Three Fiber discussions and examples
- Selection patterns: @react-three/xr examples and documentation

## Next Steps

1. **Implement Phase 1**: Object selection with console logging
2. **Implement Phase 2**: Visual feedback (wireframe highlight)
3. **Implement Phase 3**: Deselection via clicking empty space
4. **Implement Phase 4**: B button detection for deletion
5. **Implement Phase 5**: Object deletion logic
6. **Test on Quest 2**: Verify full workflow
7. **Document learnings**: Update r3f-learnings.md with selection patterns
8. **Prepare for Feature 4.2**: Review transform requirements, plan axes implementation

## Summary

Feature 4.1 adds essential object selection and deletion capabilities to the AR application. By leveraging existing patterns from Features 2 and 3, implementation should be straightforward:

- **Selection**: Uses @react-three/xr's built-in pointer events on placed object meshes
- **Deselection**: Invisible plane captures "click nothing" events
- **Deletion**: B button detection using same pattern as Y/X buttons from Feature 3
- **Visual Feedback**: Simple wireframe highlight until axes implemented in Feature 4.2

The implementation is self-contained within `ARHitTestManager.tsx`, requires no changes to other features, and provides a solid foundation for the transform functionality in Feature 4.2.

**Key Success Metrics**:
- Users can reliably select placed objects with controller rays
- Clear visual feedback indicates selection
- B button consistently deletes selected object
- No performance impact with up to 30 placed objects
- Smooth integration with existing features
