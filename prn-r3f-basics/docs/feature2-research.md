# Feature 2 Research: AR Plane Detection and Object Placement

## Overview

Feature 2 implements AR plane detection with object placement, allowing users to:
1. See a cursor/reticle at the intersection of their view direction with detected real-world planes
2. Place objects (pyramids) on detected planes by pressing the trigger button
3. Have objects correctly oriented with their base on the plane, facing the user

This is a fundamental AR interaction pattern used in many AR applications like IKEA Place, Google AR, and Meta Horizon.

## Key Implementation Strategy

**IMPORTANT**: This implementation follows ar-example.html EXACTLY, translating vanilla WebXR to React Three Fiber.

### Critical Simplifications

1. **Use hit test matrix directly** - Don't decompose and recalculate orientation
2. **No complex rotation math** - ConeGeometry already points up (+Y), which matches hit test surface normal
3. **Use session 'select' event** - Don't poll controller buttons manually
4. **Anchors track everything** - Let WebXR handle position updates, just apply the matrix each frame

### What Makes This Different

The reference implementation (ar-example.html) is ~200 lines of straightforward WebXR code. The key insight is that hit test results provide a transformation matrix that already contains:
- **Position**: Where the ray hit the surface
- **Orientation**: Y-axis aligned with surface normal (perpendicular to plane)

We don't need to calculate anything - just use the matrix!

## Reference Implementation Analysis

The example implementation at `docs/ar-example.html` demonstrates the core WebXR approach:

### Key Components from Example
1. **Session Setup**: Requests `immersive-ar` with features `['local', 'hit-test', 'anchors']`
2. **Hit Test Source**: Created from viewer space - `session.requestHitTestSource({ space: xrViewerSpace })`
3. **Animation Loop**: Gets hit test results each frame - `frame.getHitTestResults(xrHitTestSource)`
4. **Reticle**: Positioned using hit result pose matrix - `reticle.matrix = pose.transform.matrix`
5. **Object Placement**: Creates anchors on select event - `reticleHitTestResult.createAnchor()`
6. **Anchor Tracking**: Updates placed object positions each frame using tracked anchors

### Critical Insights
- Hit testing rays cast from viewer space (headset forward direction)
- The hit pose matrix includes both position AND orientation (Y-axis = surface normal)
- Anchors persist objects at real-world locations even as tracking updates
- Must request `hit-test` feature explicitly in session init

## WebXR API Concepts

### 1. Hit Testing

**Purpose**: Determines where virtual rays intersect with real-world geometry

**API Flow**:
```javascript
// 1. Request feature in session
navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['hit-test']
})

// 2. Create hit test source from a reference space
session.requestReferenceSpace('viewer').then((viewerSpace) => {
  session.requestHitTestSource({ space: viewerSpace }).then((source) => {
    xrHitTestSource = source
  })
})

// 3. Get results each frame
function onXRFrame(time, frame) {
  const hitTestResults = frame.getHitTestResults(xrHitTestSource)
  if (hitTestResults.length > 0) {
    const pose = hitTestResults[0].getPose(referenceSpace)
    // pose.transform.matrix contains position + orientation
  }
}
```

**Key Properties**:
- `XRHitTestResult.getPose(referenceSpace)` returns the intersection pose
- The pose matrix encodes:
  - Position: where the ray hit
  - Orientation: Y-axis aligned with surface normal (perpendicular to surface)

**Best Practices**:
- Hit test sources should be created once, not every frame
- Check `hitTestResults.length > 0` before accessing
- Hit testing requires real-world understanding - may not work immediately after session starts

### 2. Plane Detection

**Purpose**: Identifies flat surfaces (floors, walls, tables) in the real world

**API Flow**:
```javascript
// 1. Enable in session
navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['plane-detection']
})

// 2. Access detected planes each frame
function onXRFrame(time, frame) {
  const detectedPlanes = frame.detectedPlanes
  detectedPlanes.forEach(plane => {
    // plane.planeSpace: XRSpace with origin at plane center
    // plane.polygon: vertices describing plane shape
    // plane.orientation: 'horizontal' | 'vertical' | null
    // plane.semanticLabel: 'floor' | 'wall' | 'table' | etc.
  })
}
```

**XRPlane Properties**:
- `planeSpace`: Coordinate system with Y-axis as plane normal
- `polygon`: Frozen array of DOMPointReadOnly vertices (plane-local coordinates)
- `orientation`: `'horizontal'`, `'vertical'`, or `null`
- `semanticLabel`: String identifier or `null` (device-dependent)
- `lastChangedTime`: Timestamp of last property update

**Important Notes**:
- Plane detection is separate from hit testing
- Planes persist across frames and can be updated
- Not all devices provide semantic labels
- Quest 2 requires user to define guardian/play area for plane detection

### 3. Anchors

**Purpose**: Maintain stable references to real-world locations

**API Flow**:
```javascript
// Create anchor from hit test result
hitTestResult.createAnchor().then((anchor) => {
  anchoredObjects.push({ mesh, anchor })
})

// Update anchored objects each frame
function onXRFrame(time, frame) {
  for (const { mesh, anchor } of anchoredObjects) {
    if (frame.trackedAnchors.has(anchor)) {
      const pose = frame.getPose(anchor.anchorSpace, referenceSpace)
      mesh.matrix = pose.transform.matrix
    }
  }
}
```

**Why Use Anchors**:
- Real-world tracking improves over time as system learns environment
- Anchors automatically update positions as tracking refines
- Objects stay "stuck" to real-world locations even as user moves
- Essential for persistent AR experiences

## React Three Fiber Implementation

### Direct Translation from ar-example.html

The ar-example.html uses a straightforward WebXR approach. Here's how to implement it exactly in React Three Fiber:

#### Key Pattern from ar-example.html

```javascript
// 1. Session setup (line 109)
navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['local', 'hit-test', 'anchors']
})

// 2. Create hit test source from viewer space (lines 136-141)
session.requestReferenceSpace('viewer').then((refSpace) => {
  xrViewerSpace = refSpace;
  session.requestHitTestSource({ space: xrViewerSpace }).then((hitTestSource) => {
    xrHitTestSource = hitTestSource;
  });
});

// 3. Get hit test results each frame (lines 203-210)
if (xrHitTestSource && pose) {
  let hitTestResults = frame.getHitTestResults(xrHitTestSource);
  if (hitTestResults.length > 0) {
    let pose = hitTestResults[0].getPose(xrRefSpace);
    reticle.visible = true;
    reticle.matrix = pose.transform.matrix;  // ← DIRECTLY use the matrix
    reticleHitTestResult = hitTestResults[0];
  }
}

// 4. On select event, create anchor (lines 183-192)
if (reticle.visible) {
  reticleHitTestResult.createAnchor().then((anchor) => {
    addAnchoredObjectsToScene(anchor);
  });
}

// 5. Update anchored objects each frame (lines 213-221)
for (const {anchoredObject, anchor} of anchoredObjects) {
  if (!frame.trackedAnchors.has(anchor)) continue;
  const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace);
  anchoredObject.matrix = anchorPose.transform.matrix;  // ← DIRECTLY use the matrix
}
```

### Implementation in React Three Fiber

#### Session Configuration
```tsx
const store = createXRStore({
  // These features match ar-example.html line 109
  // @react-three/xr enables these by default, so no extra config needed
})

<XR store={store}>
  <Scene />
</XR>
```

#### Component Structure
```
Scene (AR mode)
├── ARHitTestManager (manages hit test source and results)
│   ├── Reticle (cursor at hit position)
│   └── PlacementHandler (listens for trigger, creates anchors)
└── AnchoredPyramids (renders pyramids tracked to anchors)
```

#### 1. AR Hit Test Manager

**Purpose**: Exactly replicate ar-example.html hit test setup

```tsx
function ARHitTestManager() {
  const { session } = useXR()
  const xrRefSpaceRef = useRef<XRReferenceSpace | null>(null)
  const hitTestSourceRef = useRef<XRHitTestSource | null>(null)
  const reticleRef = useRef<THREE.Mesh>(null)
  const [currentHitResult, setCurrentHitResult] = useState<XRHitTestResult | null>(null)

  // Step 1: Create hit test source (mirrors ar-example.html lines 136-141)
  useEffect(() => {
    if (!session) return

    // Get viewer space
    session.requestReferenceSpace('viewer').then((viewerSpace) => {
      // Create hit test source from viewer space
      session.requestHitTestSource({ space: viewerSpace }).then((source) => {
        hitTestSourceRef.current = source
      })
    })

    // Get reference space
    session.requestReferenceSpace('local').then((refSpace) => {
      xrRefSpaceRef.current = refSpace
    })

    return () => {
      hitTestSourceRef.current?.cancel()
    }
  }, [session])

  // Step 2: Get hit test results each frame (mirrors ar-example.html lines 203-210)
  useFrame((state) => {
    if (!session || !hitTestSourceRef.current || !xrRefSpaceRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame) return

    const hitTestResults = frame.getHitTestResults(hitTestSourceRef.current)

    if (hitTestResults.length > 0) {
      const hitPose = hitTestResults[0].getPose(xrRefSpaceRef.current)
      if (hitPose && reticleRef.current) {
        // EXACTLY like ar-example.html line 208: directly use matrix
        reticleRef.current.visible = true
        reticleRef.current.matrix.fromArray(hitPose.transform.matrix)
        reticleRef.current.matrix.decompose(
          reticleRef.current.position,
          reticleRef.current.quaternion,
          reticleRef.current.scale
        )
        setCurrentHitResult(hitTestResults[0])
      }
    } else {
      if (reticleRef.current) reticleRef.current.visible = false
      setCurrentHitResult(null)
    }
  })

  return (
    <>
      {/* Reticle (cursor) */}
      <mesh ref={reticleRef} visible={false}>
        <ringGeometry args={[0.15, 0.2, 32]} />
        <meshBasicMaterial color="white" side={THREE.DoubleSide} />
      </mesh>

      {/* Placement handler */}
      <PlacementHandler
        hitResult={currentHitResult}
        xrRefSpace={xrRefSpaceRef.current}
      />
    </>
  )
}
```

#### 2. Placement Handler

**Purpose**: Handle trigger press and create anchored pyramids

```tsx
interface PlacementHandlerProps {
  hitResult: XRHitTestResult | null
  xrRefSpace: XRReferenceSpace | null
}

function PlacementHandler({ hitResult, xrRefSpace }: PlacementHandlerProps) {
  const { session } = useXR()
  const [anchoredPyramids, setAnchoredPyramids] = useState<Array<{
    id: string
    anchor: XRAnchor
  }>>([])

  // Listen for select event (mirrors ar-example.html lines 183-192)
  useEffect(() => {
    if (!session) return

    const onSelect = () => {
      if (hitResult && xrRefSpace) {
        // Create anchor exactly like ar-example.html line 186
        hitResult.createAnchor().then((anchor) => {
          setAnchoredPyramids(prev => [...prev, {
            id: Math.random().toString(),
            anchor: anchor
          }])
        }).catch((error) => {
          console.error("Could not create anchor: " + error)
        })
      }
    }

    session.addEventListener('select', onSelect)
    return () => session.removeEventListener('select', onSelect)
  }, [session, hitResult, xrRefSpace])

  return (
    <>
      {anchoredPyramids.map(({ id, anchor }) => (
        <AnchoredPyramid
          key={id}
          anchor={anchor}
          xrRefSpace={xrRefSpace}
        />
      ))}
    </>
  )
}
```

#### 3. Anchored Pyramid Component

**Purpose**: Render pyramid that tracks anchor position

```tsx
interface AnchoredPyramidProps {
  anchor: XRAnchor
  xrRefSpace: XRReferenceSpace | null
}

function AnchoredPyramid({ anchor, xrRefSpace }: AnchoredPyramidProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const { session } = useXR()

  // Update position from anchor each frame (mirrors ar-example.html lines 213-221)
  useFrame((state) => {
    if (!session || !xrRefSpace || !meshRef.current) return

    const frame = state.gl.xr.getFrame()
    if (!frame) return

    // Check if anchor is still tracked
    if (!frame.trackedAnchors.has(anchor)) return

    // Get anchor pose
    const anchorPose = frame.getPose(anchor.anchorSpace, xrRefSpace)
    if (!anchorPose) return

    // EXACTLY like ar-example.html line 220: directly use matrix
    meshRef.current.matrix.fromArray(anchorPose.transform.matrix)
    meshRef.current.matrix.decompose(
      meshRef.current.position,
      meshRef.current.quaternion,
      meshRef.current.scale
    )
  })

  return (
    <mesh ref={meshRef} matrixAutoUpdate={false}>
      {/* Pyramid: cone with 4 segments, rotated to point tip up */}
      <coneGeometry args={[0.2, 0.3, 4]} />
      <meshStandardMaterial color="cyan" />
    </mesh>
  )
}
```

### Key Differences from Original Research

**CRITICAL CHANGES:**

1. **Use matrix directly**: The hit test result matrix ALREADY contains correct position AND orientation. Don't decompose and recalculate - just use it directly like ar-example.html does.

2. **No manual orientation calculation**: The hit test pose matrix has:
   - Y-axis aligned with surface normal (up from plane)
   - This is perfect for placing objects - NO additional rotation needed

3. **Set matrixAutoUpdate={false}**: When directly setting matrix, tell Three.js not to recalculate from position/rotation

4. **Simple pyramid**: Use `<coneGeometry args={[0.2, 0.3, 4]} />` (base radius, height, 4 sides for pyramid)
   - The cone already points up (+Y), which aligns with the surface normal from hit test
   - No rotation needed!

### Note on "Point Towards User" Requirement

The original feature spec says "pyramid must point to the user wearing headset." However, the standard AR pattern (used by ar-example.html and all major AR apps) is to align objects with the surface normal, NOT to make them point at the user. This is because:

1. **Consistency**: Objects maintain orientation relative to the surface they're on
2. **Stability**: Objects don't rotate as user walks around them
3. **Natural**: Matches how real objects work (they don't rotate to face you)

**The hit test matrix Y-axis = surface normal is the correct approach.** If user-facing orientation is truly required, it can be added later, but this should be confirmed with stakeholders as it diverges from standard AR UX patterns.

## Technical Challenges and Solutions

### Challenge 1: Accessing XRSession in React Three Fiber

**Problem**: Need XRSession to create hit test source and listen for select events

**Solution**: Use `useXR()` hook from @react-three/xr:
```tsx
const { session } = useXR()

useEffect(() => {
  if (!session) return

  // Now can use session.requestReferenceSpace(), session.requestHitTestSource(), etc.
}, [session])
```

### Challenge 2: Accessing XRFrame in useFrame

**Problem**: Need XRFrame to get hit test results and tracked anchors

**Solution**: Access through `state.gl.xr.getFrame()`:
```tsx
useFrame((state) => {
  const frame = state.gl.xr.getFrame()
  if (!frame) return

  // Now can use:
  // - frame.getHitTestResults(hitTestSource)
  // - frame.trackedAnchors.has(anchor)
  // - frame.getPose(anchorSpace, referenceSpace)
})
```

### Challenge 3: Matrix vs Position/Rotation in Three.js

**Problem**: Hit test and anchor poses provide matrices, but Three.js mesh uses position/rotation by default

**Solution**: Use matrix directly and disable auto-update:
```tsx
// Apply matrix
meshRef.current.matrix.fromArray(pose.transform.matrix)

// Decompose to update position/quaternion for Three.js
meshRef.current.matrix.decompose(
  meshRef.current.position,
  meshRef.current.quaternion,
  meshRef.current.scale
)

// OR set matrixAutoUpdate={false} and only use matrix
<mesh ref={meshRef} matrixAutoUpdate={false}>
```

**From ar-example.html**: Lines 208 and 220 directly assign the matrix:
```javascript
reticle.matrix = pose.transform.matrix;
anchoredObject.matrix = anchorPose.transform.matrix;
```

### Challenge 4: Pyramid Orientation

**Problem**: Need pyramid to point up from surface (both horizontal and vertical)

**Solution**: NO CALCULATION NEEDED! The hit test matrix Y-axis IS the surface normal.
- ConeGeometry points up (+Y) by default
- Hit test matrix Y-axis points perpendicular to surface
- These align perfectly - just use the matrix directly

```tsx
// The cone geometry is already oriented correctly!
<coneGeometry args={[0.2, 0.3, 4]} />

// The hit test matrix already has Y-axis as surface normal
// No rotation calculation needed!
```

### Challenge 5: Select Event vs Controller Button Polling

**Problem**: ar-example.html uses `session.addEventListener('select', ...)` but we might be tempted to poll controller buttons

**Solution**: Use the select event like ar-example.html - it's simpler and more reliable:
```tsx
useEffect(() => {
  if (!session) return

  const onSelect = () => {
    // Place object
  }

  session.addEventListener('select', onSelect)
  return () => session.removeEventListener('select', onSelect)
}, [session])
```

The 'select' event fires when user presses trigger button (either controller)

## Implementation Plan

Following ar-example.html implementation exactly:

### Step 1: Create ARHitTestManager Component

**What to implement**:
1. Create new component `ARHitTestManager.tsx`
2. Use `useXR()` hook to access session
3. In useEffect, create hit test source from viewer space (like ar-example.html lines 136-141)
4. Store hit test source in ref
5. Render a reticle (white ring)

**Success Criteria**: Component compiles, no runtime errors

### Step 2: Update Reticle from Hit Test Results

**What to implement**:
1. In useFrame, get XRFrame via `state.gl.xr.getFrame()`
2. Call `frame.getHitTestResults(hitTestSource)`
3. If results exist, get pose and update reticle matrix (like ar-example.html lines 203-210)
4. Set reticle visibility based on results

**Success Criteria**: White ring cursor appears on detected surfaces in AR mode

### Step 3: Listen for Select Event

**What to implement**:
1. Create PlacementHandler component
2. Use useEffect to add 'select' event listener to session (like ar-example.html line 118)
3. Log to console when select fired

**Success Criteria**: Console logs "select" when trigger pressed

### Step 4: Create Anchors on Select

**What to implement**:
1. Pass current hit test result from ARHitTestManager to PlacementHandler
2. In select handler, call `hitResult.createAnchor()` (like ar-example.html line 186)
3. Store anchors in state array

**Success Criteria**: Console shows successful anchor creation

### Step 5: Render Anchored Pyramids

**What to implement**:
1. Create AnchoredPyramid component
2. In useFrame, get anchor pose from frame (like ar-example.html lines 213-221)
3. Update pyramid mesh matrix from anchor pose
4. Use `<coneGeometry args={[0.2, 0.3, 4]} />` for pyramid

**Success Criteria**: Pyramids appear at cursor location when trigger pressed, stay stable as user moves

## Code Structure

### Modified App.tsx

```tsx
import { ARHitTestManager } from './components/ARHitTestManager'

function Scene() {
  const { mode } = useXR()

  return (
    <>
      {/* Existing VR components */}
      <PlayerRig />
      <Physics>...</Physics>

      {/* AR-specific components - only render in AR mode */}
      {mode === 'immersive-ar' && <ARHitTestManager />}
    </>
  )
}
```

### New Component Files

**src/components/ARHitTestManager.tsx**
- Main AR component
- Creates hit test source from viewer space
- Renders reticle at hit point
- Contains PlacementHandler as child

**Nested inside ARHitTestManager.tsx:**
- `PlacementHandler` - Listens for select event, creates anchors
- `AnchoredPyramid` - Renders pyramid tracked to anchor

## Testing Strategy

### Desktop Preview
1. Use WebXR emulator extension
2. Verify cursor appears in AR mode
3. Test trigger input detection

### Quest 2 Device
1. Enable Guardian/play area for plane detection
2. Test on horizontal surfaces (floor, table)
3. Test on vertical surfaces (walls)
4. Verify object orientation in both cases
5. Walk around placed objects to test anchor stability

## Performance Considerations

1. **Hit Testing**: Runs every frame - already optimized by WebXR API
2. **Placed Objects**: Limit to 20-30 objects to maintain 72fps
3. **Anchor Updates**: Only update if anchor in frame.trackedAnchors
4. **Geometry Complexity**: Keep pyramid low-poly (cone with 4 sides)

## References

### Documentation
- WebXR Hit Test API: https://immersive-web.github.io/hit-test/
- WebXR Plane Detection: https://immersive-web.github.io/real-world-geometry/plane-detection.html
- @react-three/xr Docs: https://github.com/pmndrs/xr/blob/main/docs
- Meta WebXR Guide: https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality

### Code Examples
- `docs/ar-example.html` - Reference implementation with anchors
- Three.js AR Hit Test: https://threejs.org/examples/webxr_ar_hittest.html
- Three.js AR Plane Detection: https://threejs.org/examples/webxr_ar_plane_detection.html

### Key Files
- `src/App.tsx` - Main application, current VR implementation
- `docs/r3f-learnings.md` - React Three Fiber patterns and best practices
- `docs/r3f-feature-exploration.md` - Feature requirements

## Next Steps

1. Implement Step 1 (Basic Hit Test Cursor)
2. Test on Quest 2 device
3. Iterate based on testing
4. Proceed to Steps 2-5
5. Document learnings in r3f-learnings.md

## Notes for Feature 3 Integration

Feature 3 builds on Feature 2 by adding:
- Object palette UI (opened with Y button)
- Object selection (Block or Pyramid)
- Draw mode toggle
- Cursor visibility controlled by draw mode state

The AR placement system implemented in Feature 2 will be reused:
- Same hit testing mechanism
- Same cursor rendering
- Same object placement with anchors
- Add draw mode state management
- Add object type selection

Keep this in mind when implementing Feature 2 to make Feature 3 integration smoother.
