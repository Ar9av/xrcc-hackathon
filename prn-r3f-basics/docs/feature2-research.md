# Feature 2 Research: AR Plane Detection and Object Placement

## Overview

Feature 2 implements AR plane detection with object placement, allowing users to:
1. See a cursor/reticle at the intersection of their view direction with detected real-world planes
2. Place objects (pyramids) on detected planes by pressing the trigger button
3. Have objects correctly oriented with their base on the plane, facing the user

This is a fundamental AR interaction pattern used in many AR applications like IKEA Place, Google AR, and Meta Horizon.

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

### Available Hooks and Components

From `@react-three/xr` documentation:

#### 1. `useXRHitTest` Hook (Not documented, but exists)
```tsx
// Based on XRHitTest component usage
const matrixHelper = new Matrix4()
const hitTestPosition = new Vector3()

<XRHitTest
  space={inputSource.targetRaySpace}
  onResults={(results, getWorldMatrix) => {
    if (results.length > 0) {
      getWorldMatrix(matrixHelper, results[0])
      hitTestPosition.setFromMatrixPosition(matrixHelper)
    }
  }}
/>
```

#### 2. `useXRPlanes` Hook
```tsx
const wallPlanes = useXRPlanes('wall')
const floorPlanes = useXRPlanes('horizontal')

return (
  <>
    {wallPlanes.map((plane) => (
      <XRSpace key={plane.id} space={plane.planeSpace}>
        <XRPlaneModel plane={plane}>
          <meshBasicMaterial color="red" />
        </XRPlaneModel>
      </XRSpace>
    ))}
  </>
)
```

#### 3. `XRSpace` Component
Positions objects in a specific XRSpace coordinate system:
```tsx
<XRSpace space={plane.planeSpace}>
  <mesh>
    {/* This mesh is positioned relative to the plane space */}
  </mesh>
</XRSpace>
```

#### 4. Session Configuration
Enable features in XR store:
```tsx
const store = createXRStore({
  hitTest: true,        // Enable hit testing (default: true)
  planeDetection: true, // Enable plane detection (default: true)
  anchors: true,        // Enable anchors (default: true)
})
```

### Implementation Pattern for Feature 2

Based on the requirements and available APIs, here's the recommended approach:

#### Component Structure
```
Scene
├── ARCursor (renders cursor at hit test position)
├── ARObjectPlacer (handles trigger input for placing objects)
└── PlacedPyramids (renders placed pyramids)
```

#### 1. AR Cursor Component

**Purpose**: Show a visual indicator where objects will be placed

**Implementation Approach**:
```tsx
function ARCursor() {
  const cursorRef = useRef<THREE.Mesh>(null)
  const [isVisible, setIsVisible] = useState(false)

  // Store hit test position/matrix
  const hitMatrix = useRef(new THREE.Matrix4())
  const hitPosition = useRef(new THREE.Vector3())

  // Use XRHitTest component or access session directly
  // Update cursor position each frame based on hit test results

  useFrame((state) => {
    // In XR session, get hit test results
    // Update cursor position and visibility
  })

  return (
    <mesh ref={cursorRef} visible={isVisible}>
      <ringGeometry args={[0.15, 0.2, 32]} />
      <meshBasicMaterial color="white" side={THREE.DoubleSide} />
    </mesh>
  )
}
```

**Key Considerations**:
- Cursor should only be visible in AR mode and when hit test has results
- Should render on both sides (DoubleSide) to be visible from any angle
- Matrix from hit test includes orientation - use directly for proper alignment
- Consider fade-in animation when hit test first succeeds

#### 2. Object Placement Handler

**Purpose**: Detect trigger input and create pyramids at cursor location

**Implementation Approach**:
```tsx
function ARObjectPlacer({ cursorMatrix, onPlace }) {
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')
  const prevTriggerState = useRef({ left: false, right: false })

  useFrame(() => {
    // Check left trigger
    const leftTrigger = leftController?.gamepad?.['xr-standard-trigger']
    const leftPressed = leftTrigger?.state === 'pressed'

    if (leftPressed && !prevTriggerState.current.left && cursorMatrix) {
      onPlace(cursorMatrix.clone())
    }
    prevTriggerState.current.left = leftPressed

    // Same for right controller
  })

  return null
}
```

**Key Considerations**:
- Need to detect trigger button press (not hold)
- Should work with both left and right controllers
- Only place if cursor is visible (has valid hit test result)
- Clone matrix to avoid reference issues

#### 3. Pyramid Component

**Purpose**: Render a pyramid with proper orientation

**Geometry**:
```tsx
function Pyramid({ position, rotation }) {
  return (
    <mesh position={position} rotation={rotation}>
      <coneGeometry args={[0.2, 0.3, 4]} />
      <meshStandardMaterial color="cyan" />
    </mesh>
  )
}
```

**Orientation Requirements**:
- Base on plane (cone base down)
- Point towards user
- Perpendicular to plane normal

**Calculating Orientation**:
```tsx
function calculatePyramidOrientation(hitMatrix: THREE.Matrix4, userPosition: THREE.Vector3) {
  // Extract position and normal from hit matrix
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  hitMatrix.decompose(position, quaternion, scale)

  // Y-axis is surface normal in hit test result
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)

  // Calculate direction to user (projected onto plane)
  const toUser = userPosition.clone().sub(position)
  toUser.projectOnPlane(normal).normalize()

  // Create rotation that:
  // 1. Aligns Y-axis with surface normal (base on plane)
  // 2. Aligns -Z-axis with direction to user (point at user)

  const rotationMatrix = new THREE.Matrix4()
  rotationMatrix.lookAt(toUser, new THREE.Vector3(0, 0, 0), normal)

  const finalQuaternion = new THREE.Quaternion()
  finalQuaternion.setFromRotationMatrix(rotationMatrix)

  return { position, quaternion: finalQuaternion }
}
```

## Technical Challenges and Solutions

### Challenge 1: Hit Testing from Viewer Space

**Problem**: Need to cast hit test ray from user's head direction (where they're looking)

**Solution**:
- Request viewer reference space: `session.requestReferenceSpace('viewer')`
- Create hit test source from viewer space
- This automatically casts ray forward from headset

**In @react-three/xr**:
```tsx
// Access session and create hit test source
const store = useXR()
useEffect(() => {
  if (store.session) {
    store.session.requestReferenceSpace('viewer').then(viewerSpace => {
      store.session.requestHitTestSource({ space: viewerSpace }).then(source => {
        setHitTestSource(source)
      })
    })
  }
}, [store.session])
```

### Challenge 2: Cursor Visibility and Draw Mode

**Problem**: Cursor should only be visible when:
- In AR mode
- Hit test has valid results
- In "draw mode" (Feature 3 requirement - but for Feature 2, always in draw mode)

**Solution**:
```tsx
const { mode } = useXR() // Get current session mode
const [hasHitResult, setHasHitResult] = useState(false)

const cursorVisible = mode === 'immersive-ar' && hasHitResult

return <mesh visible={cursorVisible}>...</mesh>
```

### Challenge 3: Object Orientation on Vertical vs Horizontal Planes

**Problem**: Pyramid should:
- Stand upright on horizontal surfaces (floor)
- Stick to vertical surfaces (walls) with base against wall
- Point towards user in both cases

**Solution**: The hit test result matrix already provides correct orientation:
- Y-axis of hit matrix = surface normal
- For horizontal plane: normal points up
- For vertical plane: normal points out from wall

**Implementation**:
```tsx
function PlacedPyramid({ hitMatrix, userPosition }) {
  const position = new THREE.Vector3()
  const quaternion = new THREE.Quaternion()
  const scale = new THREE.Vector3()
  hitMatrix.decompose(position, quaternion, scale)

  // Get normal from matrix (Y-axis)
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion)

  // Direction to user
  const toUser = userPosition.clone().sub(position).normalize()

  // Project toUser onto plane (perpendicular to normal)
  const onPlane = toUser.clone().projectOnPlane(normal).normalize()

  // Create orientation: up = normal, forward = towards user
  const up = normal
  const forward = onPlane.negate() // Cone points in -Z direction

  // Calculate final rotation using lookAt
  const lookAtMatrix = new THREE.Matrix4()
  lookAtMatrix.lookAt(new THREE.Vector3(0, 0, 0), forward, up)

  const finalRotation = new THREE.Euler()
  finalRotation.setFromRotationMatrix(lookAtMatrix)

  return (
    <mesh position={position} rotation={finalRotation}>
      <coneGeometry args={[0.2, 0.3, 4]} />
      <meshStandardMaterial color="cyan" />
    </mesh>
  )
}
```

### Challenge 4: Using Anchors for Stability

**Problem**: Placed objects should stay in real-world position as tracking improves

**Solution**: Create anchor from hit test result
```tsx
interface PlacedObject {
  id: string
  anchor: XRAnchor | null
  initialMatrix: THREE.Matrix4
}

function onTriggerPress(hitTestResult: XRHitTestResult) {
  // Create anchor
  hitTestResult.createAnchor().then((anchor) => {
    const obj: PlacedObject = {
      id: generateId(),
      anchor: anchor,
      initialMatrix: hitTestResult.getPose(referenceSpace).transform.matrix
    }
    setPlacedObjects(prev => [...prev, obj])
  }).catch(error => {
    console.warn('Failed to create anchor:', error)
    // Fallback: place without anchor
  })
}
```

**Update objects each frame**:
```tsx
useFrame((state) => {
  if (!state.session) return
  const frame = state.gl.xr.getFrame()

  for (const obj of placedObjects) {
    if (obj.anchor && frame.trackedAnchors.has(obj.anchor)) {
      const pose = frame.getPose(obj.anchor.anchorSpace, xrRefSpace)
      // Update object position from pose.transform.matrix
    }
  }
})
```

### Challenge 5: Accessing XRFrame in React Three Fiber

**Problem**: Need access to XRFrame to get hit test results and tracked anchors

**Solution**: Access through `state.gl.xr` in useFrame:
```tsx
useFrame((state, delta) => {
  const xrManager = state.gl.xr
  if (!xrManager.isPresenting) return

  const frame = xrManager.getFrame()
  if (!frame) return

  // Now can access frame.getHitTestResults(), frame.trackedAnchors, etc.
})
```

## Implementation Plan

### Step 1: Basic Hit Test Cursor

1. Access XR session in Scene component
2. Create hit test source from viewer space
3. Implement ARCursor component that:
   - Gets hit test results each frame
   - Updates cursor position/visibility
   - Renders simple ring geometry

**Success Criteria**: White ring cursor appears on detected surfaces in AR mode

### Step 2: Trigger Input Detection

1. Use `useXRInputSourceState` to access controllers
2. Detect trigger button press events
3. Log to console when trigger pressed with cursor visible

**Success Criteria**: Console logs trigger presses in AR mode

### Step 3: Object Placement (No Orientation)

1. Create state to store placed pyramid positions
2. On trigger press, add new pyramid at cursor position
3. Render pyramids (ignore orientation initially)

**Success Criteria**: Pyramids appear at cursor location when trigger pressed

### Step 4: Proper Orientation

1. Store hit matrix (not just position) for each placed object
2. Calculate pyramid orientation from hit matrix and user position
3. Apply rotation to pyramids

**Success Criteria**: Pyramids point towards user, base on plane

### Step 5: Anchor Implementation

1. Create anchors from hit test results
2. Store anchor references with placed objects
3. Update object transforms from anchor poses each frame

**Success Criteria**: Placed objects stay stable as user moves and tracking updates

## Code Structure

### Modified App.tsx

```tsx
// Add AR-specific components
function Scene() {
  // Existing VR content
  const { mode } = useXR()

  return (
    <>
      {/* Existing VR components */}
      <PlayerRig />
      <Physics>...</Physics>

      {/* AR-specific components - only active in AR mode */}
      {mode === 'immersive-ar' && (
        <>
          <ARCursor />
          <ARObjectPlacer />
          <PlacedObjects />
        </>
      )}
    </>
  )
}
```

### New Components

**src/components/ARCursor.tsx**
- Handles hit testing
- Renders cursor at hit point
- Exposes hit matrix to parent

**src/components/ARObjectPlacer.tsx**
- Monitors trigger input
- Creates placed objects
- Manages anchors

**src/components/PlacedPyramid.tsx**
- Renders individual pyramid
- Handles anchor-based positioning
- Calculates orientation

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
