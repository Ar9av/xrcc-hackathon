# Feature 2 Research: Digital Object Interaction with Physical Objects in AR

## Feature Requirements

1. Bring room context into AR experience (walls, floor, furniture)
2. Enable virtual balls to interact with physical room objects via physics
3. Align virtual floor with physical floor
4. Understand Meta Quest setup requirements

## Overview

Feature 2 requires implementing **spatial awareness** in AR mode, where virtual objects understand and physically interact with the real-world environment. This involves:
- WebXR plane/mesh detection APIs
- @react-three/xr integration
- Physics collision setup with room geometry
- Proper floor alignment

---

## Meta Quest AR Capabilities

### Supported Features

Meta Quest 2, Quest Pro, and Quest 3 headsets support WebXR mixed reality with the following features:

1. **Passthrough**
   - Real-time 3D visualization of the physical world
   - **Quest Pro & Quest 3**: Full color passthrough
   - **Quest 2**: Grayscale passthrough

2. **Plane Detection**
   - Detects flat surfaces (floors, walls, tables, desks, couches)
   - Represented as horizontal or vertical rectangular planes
   - Includes position, orientation, and polygon vertices
   - Enables virtual-physical surface interaction

3. **Mesh Detection** (Quest 3)
   - Detailed 3D mesh representation of room geometry
   - Provides vertices and indices for creating collision geometry
   - More accurate than plane detection for complex shapes
   - Supported in emulator for debugging

4. **Spatial Anchors**
   - Persistent position tracking across sessions
   - Anchors maintain pose relative to real world
   - Can be saved and restored

5. **Depth API** (Quest 3)
   - Real-time depth occlusion
   - Virtual objects can be occluded by physical objects
   - Enables realistic mixed reality experiences

### Quest Room Setup Requirements

**IMPORTANT**: Users MUST configure room setup on their Meta Quest headset for plane/mesh detection to work.

**Setup Path**:
```
Settings → Guardian → Mixed Reality
```

Without room setup, the headset won't have spatial mapping data to provide to WebXR applications.

---

## WebXR AR Session & Features

### Requesting AR Session with Features

To enable AR mode with spatial detection, request an `immersive-ar` session with required features:

```javascript
const session = await navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['plane-detection', 'mesh-detection', 'anchors', 'local-floor'],
  optionalFeatures: ['depth-sensing']
})
```

**Session Mode**: `immersive-ar` (NOT `immersive-vr`)
- Enables passthrough automatically
- Provides access to real-world understanding features

**Required Features**:
- `plane-detection`: Access to detected planes via `session.detectedPlanes`
- `mesh-detection`: Access to detected meshes via `session.detectedMeshes`
- `local-floor`: Floor-level reference space for proper alignment
- `anchors`: Create persistent spatial anchors

**Optional Features**:
- `depth-sensing`: Depth API for occlusion (Quest 3)

### WebXR Spatial Detection APIs

#### XRPlane Objects

Each detected plane provides:
- `planeSpace`: XRSpace representing plane's coordinate system
- `polygon`: Array of DOMPointReadOnly representing plane boundary vertices
- `orientation`: 'horizontal' or 'vertical'
- `semanticLabel`: Type of surface (e.g., 'floor', 'wall', 'table')

#### XRMesh Objects

Each detected mesh provides:
- `meshSpace`: XRSpace representing mesh's coordinate system
- `vertices`: Float32Array of vertex positions
- `indices`: Uint32Array of triangle indices
- `lastChangedTime`: DOMHighResTimeStamp for tracking updates

---

## @react-three/xr Implementation

### Entering AR Mode

```tsx
import { createXRStore, XR } from '@react-three/xr'

const store = createXRStore()

function App() {
  return (
    <>
      <button onClick={() => store.enterAR()}>Enter AR</button>
      <Canvas>
        <XR store={store}>
          <Scene />
        </XR>
      </Canvas>
    </>
  )
}
```

### Plane Detection

**Hook**: `useXRPlanes(semantic?: string)`

Returns array of detected planes, optionally filtered by semantic label.

**Example - Render All Walls**:
```tsx
import { useXRPlanes, XRSpace, XRPlaneModel } from '@react-three/xr'

function RedWalls() {
  const wallPlanes = useXRPlanes('wall')

  return (
    <>
      {wallPlanes.map((plane) => (
        <XRSpace key={plane.planeSpace} space={plane.planeSpace}>
          <XRPlaneModel plane={plane}>
            <meshBasicMaterial color="red" />
          </XRPlaneModel>
        </XRSpace>
      ))}
    </>
  )
}
```

**Semantic Labels**:
- `'floor'`: Floor surfaces
- `'wall'`: Wall surfaces
- `'ceiling'`: Ceiling surfaces
- `'table'`: Table surfaces
- No filter: Returns all detected planes

### Mesh Detection

**Hook**: `useXRMeshes()`

Returns array of detected room meshes.

**Example - Render Detected Meshes**:
```tsx
import { useXRMeshes, XRSpace, XRMeshModel } from '@react-three/xr'

function DetectedMeshes() {
  const meshes = useXRMeshes()

  return (
    <>
      {meshes.map((mesh) => (
        <XRSpace key={mesh.meshSpace} space={mesh.meshSpace}>
          <XRMeshModel mesh={mesh}>
            <meshBasicMaterial color="blue" wireframe />
          </XRMeshModel>
        </XRSpace>
      ))}
    </>
  )
}
```

### XRSpace Component

**Critical**: All detected planes/meshes MUST be wrapped in `XRSpace` component to position them correctly in the scene.

```tsx
<XRSpace space={plane.planeSpace}>
  {/* Content positioned relative to detected plane */}
</XRSpace>
```

### Hit Testing

**Use Case**: Place objects at AR cursor position or ray intersection

```tsx
import { useXRInputSourceState, XRHitTest } from '@react-three/xr'
import { Matrix4, Vector3 } from 'three'

const matrixHelper = new Matrix4()
const hitTestPosition = new Vector3()

function HitTestExample() {
  const rightController = useXRInputSourceState('controller', 'right')

  return (
    <XRHitTest
      space={rightController?.inputSource.targetRaySpace}
      onResults={(results, getWorldMatrix) => {
        if (results.length === 0) return

        getWorldMatrix(matrixHelper, results[0])
        hitTestPosition.setFromMatrixPosition(matrixHelper)
      }}
    />
  )
}
```

### Anchors

**Use Case**: Persist virtual objects at real-world positions

```tsx
import { useXRAnchor, useXRInputSourceState, useXRInputSourceEvent, XRSpace } from '@react-three/xr'

function AnchoredObject() {
  const [anchor, requestAnchor] = useXRAnchor()
  const controllerState = useXRInputSourceState('controller', 'right')

  useXRInputSourceEvent(
    controllerState?.inputSource,
    'select',
    async () => {
      if (!controllerState) return

      // Create anchor at controller position
      requestAnchor({
        relativeTo: 'space',
        space: controllerState.inputSource.targetRaySpace
      })
    },
    [requestAnchor, controllerState]
  )

  if (!anchor) return null

  return (
    <XRSpace space={anchor.anchorSpace}>
      <mesh scale={0.1}>
        <boxGeometry />
        <meshStandardMaterial color="green" />
      </mesh>
    </XRSpace>
  )
}
```

---

## Physics Integration with Room Geometry

### Challenge

Virtual objects (balls) need to collide with detected real-world surfaces using @react-three/rapier physics.

### Solution: Trimesh Colliders from Detected Geometry

#### Approach 1: Using Detected Planes

**Pros**:
- Simpler geometry (rectangles)
- Lower performance cost
- Works on Quest 2

**Cons**:
- Less accurate for complex shapes
- Only flat surfaces

**Implementation Pattern**:
```tsx
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useXRPlanes, XRSpace } from '@react-three/xr'

function PhysicsPlanes() {
  const planes = useXRPlanes()

  return (
    <>
      {planes.map((plane) => {
        // Calculate plane dimensions from polygon vertices
        const width = calculateWidth(plane.polygon)
        const height = calculateHeight(plane.polygon)

        return (
          <XRSpace key={plane.planeSpace} space={plane.planeSpace}>
            <RigidBody type="fixed">
              <CuboidCollider args={[width / 2, 0.01, height / 2]} />
            </RigidBody>
          </XRSpace>
        )
      })}
    </>
  )
}
```

#### Approach 2: Using Detected Meshes (Recommended for Quest 3)

**Pros**:
- Accurate collision with complex geometry
- Handles furniture, curved surfaces
- Better visual/physics alignment

**Cons**:
- Higher performance cost
- Only Quest 3
- More complex implementation

**Implementation Pattern**:
```tsx
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useXRMeshes, XRSpace } from '@react-three/xr'
import { useMemo } from 'react'

function PhysicsMeshes() {
  const meshes = useXRMeshes()

  return (
    <>
      {meshes.map((mesh) => (
        <MeshCollider key={mesh.meshSpace} mesh={mesh} />
      ))}
    </>
  )
}

function MeshCollider({ mesh }) {
  // Extract vertices and indices for Rapier
  const { vertices, indices } = useMemo(() => {
    // XRMesh provides Float32Array vertices and Uint32Array indices
    // Convert to format expected by Rapier
    return {
      vertices: mesh.vertices,
      indices: mesh.indices
    }
  }, [mesh.lastChangedTime]) // Re-compute when mesh updates

  return (
    <XRSpace space={mesh.meshSpace}>
      <RigidBody type="fixed">
        <TrimeshCollider args={[vertices, indices]} />
      </RigidBody>
    </XRSpace>
  )
}
```

### Rapier Trimesh Colliders

**API**: `ColliderDesc.trimesh(vertices, indices)`

- `vertices`: Float32Array of vertex positions [x1,y1,z1, x2,y2,z2, ...]
- `indices`: Uint32Array of triangle indices [i1,i2,i3, i4,i5,i6, ...]

**React-three-rapier**:
```tsx
<TrimeshCollider args={[vertices, indices]} />
```

**Collision Groups**:
```tsx
<RigidBody
  type="fixed"
  collisionGroups={interactionGroups(0b0001, 0b1111)} // Collide with everything
>
  <TrimeshCollider args={[vertices, indices]} />
</RigidBody>
```

**Performance Considerations**:
- Trimesh colliders are more expensive than primitives (cuboid, sphere)
- Keep mesh complexity reasonable (< 10,000 triangles recommended)
- Use `type="fixed"` for static environment (no dynamic calculation needed)
- Consider using simplified collision meshes vs. visual meshes

---

## Floor Alignment in AR

### Problem

The virtual floor may not align with the physical floor, causing:
- Virtual floor covering physical objects
- Objects appearing to float or sink
- Poor mixed reality immersion

### Solution: Reference Spaces

#### Reference Space Types

1. **`local`**: Origin at session start position, no floor offset
2. **`local-floor`**: Origin at floor level, offset applied based on device understanding
3. **`viewer`**: Origin at viewer's head position (not suitable for floor alignment)
4. **`bounded-floor`**: Floor-level with defined safe movement boundary (not widely supported)

#### Recommended Approach for AR

**Use `local-floor` reference space + plane detection for accurate floor alignment**

```javascript
// Request session with local-floor
const session = await navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['plane-detection', 'local-floor']
})

// Get local-floor reference space
const referenceSpace = await session.requestReferenceSpace('local-floor')
```

**Why local-floor?**
- Origin positioned at estimated floor level
- Y=0 corresponds to physical floor
- Virtual objects positioned at Y=0 rest on physical floor

**Why also use plane detection?**
- `local-floor` provides rough floor estimate
- Plane detection with semantic label `'floor'` gives precise floor position
- Can use floor plane position to fine-tune alignment

### Floor Alignment Implementation

```tsx
import { useXRPlanes, XRSpace } from '@react-three/xr'
import { useEffect, useRef } from 'react'

function FloorAlignedScene() {
  const floorPlanes = useXRPlanes('floor')
  const sceneRef = useRef()

  useEffect(() => {
    if (floorPlanes.length > 0 && sceneRef.current) {
      // Get first detected floor plane
      const floor = floorPlanes[0]

      // Floor plane provides correct floor position
      // Can use this to adjust scene origin if needed

      // Note: With local-floor reference space,
      // floor plane should already align with Y=0
      console.log('Floor detected at:', floor.planeSpace)
    }
  }, [floorPlanes])

  return (
    <group ref={sceneRef}>
      {/* Scene content positioned relative to Y=0 floor */}
    </group>
  )
}
```

### Removing Virtual Floor in AR

**Problem**: If app has a virtual ground plane, it will cover physical floor in AR

**Solution**: Conditionally render ground plane only in VR mode

```tsx
import { useXR } from '@react-three/xr'

function Scene() {
  const mode = useXR((state) => state.mode)
  const isAR = mode === 'immersive-ar'

  return (
    <>
      {/* Only render virtual ground in VR, not AR */}
      {!isAR && (
        <RigidBody type="fixed">
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <planeGeometry args={[20, 20]} />
            <meshStandardMaterial color="#888888" />
          </mesh>
        </RigidBody>
      )}

      {/* Rest of scene... */}
    </>
  )
}
```

---

## Implementation Strategy for Feature 2

### Phase 1: Basic AR Setup
1. Add "Enter AR" button alongside "Enter VR"
2. Configure XR store with AR features
3. Conditionally hide virtual ground plane in AR mode
4. Test passthrough and basic AR functionality

### Phase 2: Plane Detection
1. Implement `useXRPlanes()` hook to detect surfaces
2. Visualize detected planes (optional debug view)
3. Create fixed RigidBody with CuboidCollider for each plane
4. Test ball collision with detected planes

### Phase 3: Mesh Detection (Optional - Quest 3 only)
1. Implement `useXRMeshes()` hook
2. Create Trimesh colliders from mesh geometry
3. Test ball collision with complex room geometry
4. Compare performance: planes vs. meshes

### Phase 4: Floor Alignment
1. Ensure `local-floor` reference space is used
2. Detect floor plane using `useXRPlanes('floor')`
3. Verify Y=0 corresponds to physical floor
4. Adjust ball spawn positions if needed

### Phase 5: Polish
1. Add hit testing for placing balls in AR
2. Implement spatial anchors for persistent ball positions
3. Optimize collision mesh complexity
4. Test on Quest 2 (planes) and Quest 3 (meshes)

---

## Code Structure Recommendations

### Component Organization

```
src/
├── App.tsx
│   └── AR/VR entry buttons + Canvas + XR
├── components/
│   ├── Scene.tsx
│   │   └── Main scene with conditional VR/AR rendering
│   ├── PlayerRig.tsx
│   │   └── VR locomotion (disabled in AR)
│   ├── GrabbableBalls.tsx
│   │   └── Existing ball system
│   ├── ar/
│   │   ├── PhysicsPlanes.tsx
│   │   │   └── Plane detection + Rapier colliders
│   │   ├── PhysicsMeshes.tsx
│   │   │   └── Mesh detection + Trimesh colliders (Quest 3)
│   │   ├── FloorAlignment.tsx
│   │   │   └── Floor plane detection + alignment
│   │   └── ARVisualizer.tsx (optional)
│   │       └── Debug visualization of detected geometry
```

### Conditional Rendering Pattern

```tsx
function Scene() {
  const mode = useXR((state) => state.mode)
  const isVR = mode === 'immersive-vr'
  const isAR = mode === 'immersive-ar'

  return (
    <Physics gravity={[0, -9.81, 0]}>
      {/* VR-only components */}
      {isVR && (
        <>
          <PlayerRig />
          <VirtualGround />
          <StaticCubes />
        </>
      )}

      {/* AR-only components */}
      {isAR && (
        <>
          <PhysicsPlanes />
          <PhysicsMeshes />
          <FloorAlignment />
        </>
      )}

      {/* Shared components */}
      <GrabbableBalls />
      <GrabController hand="left" />
      <GrabController hand="right" />

      {/* Lighting */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} />
    </Physics>
  )
}
```

---

## Potential Issues & Solutions

### Issue 1: Planes Not Detected

**Cause**: User hasn't set up room on Quest headset

**Solution**:
- Display message prompting user to configure room
- Instructions: Settings → Guardian → Mixed Reality
- Check if `session.detectedPlanes.size === 0` and show warning

### Issue 2: Floor Misalignment

**Cause**: `local-floor` estimate is inaccurate

**Solution**:
- Use detected floor plane position as ground truth
- Offset scene based on floor plane Y position
- Consider manual calibration UI

### Issue 3: Performance Issues with Meshes

**Cause**: Too many trimesh colliders, complex geometry

**Solution**:
- Prefer plane detection (simpler geometry)
- Limit number of active collision meshes
- Simplify mesh geometry (reduce triangle count)
- Use LOD (Level of Detail) for collision meshes

### Issue 4: Balls Fall Through Floor

**Cause**: Collision detection failure, physics timestep issues

**Solution**:
- Increase ball mass/restitution
- Check collision groups are configured correctly
- Ensure floor colliders are `type="fixed"`
- Reduce physics simulation speed if needed

### Issue 5: Mesh Coordinate Transform Issues

**Cause**: XRSpace not used correctly, incorrect transform application

**Solution**:
- Always wrap detected geometry in `<XRSpace space={...}>`
- Never manually apply transforms to detected plane/mesh positions
- Let @react-three/xr handle coordinate transformation

---

## Testing Checklist

### On Quest 2 (Grayscale Passthrough, Plane Detection)
- [ ] AR session starts successfully
- [ ] Passthrough visible (grayscale)
- [ ] Virtual ground plane hidden in AR mode
- [ ] Planes detected (floor, walls, tables)
- [ ] Balls collide with detected planes
- [ ] Floor alignment correct (balls rest on physical floor)
- [ ] Grab/throw mechanics work in AR

### On Quest 3 (Color Passthrough, Mesh Detection)
- [ ] AR session starts successfully
- [ ] Passthrough visible (full color)
- [ ] Virtual ground plane hidden in AR mode
- [ ] Meshes detected (detailed room geometry)
- [ ] Balls collide with detected meshes
- [ ] Collision works with furniture, complex shapes
- [ ] Floor alignment correct
- [ ] Grab/throw mechanics work in AR
- [ ] Performance acceptable (60+ FPS)

### Edge Cases
- [ ] No room setup: Appropriate warning displayed
- [ ] No planes/meshes detected: Graceful fallback
- [ ] Transition VR → AR → VR works correctly
- [ ] Multiple floor planes handled correctly
- [ ] Mesh updates handled (re-create colliders)

---

## Reference Documentation

### Official Specs
- [WebXR Device API](https://immersive-web.github.io/webxr/)
- [WebXR Mesh Detection Module](https://immersive-web.github.io/real-world-meshing/)
- [WebXR Plane Detection](https://github.com/immersive-web/real-world-geometry)
- [WebXR Anchors Module](https://immersive-web.github.io/anchors/)

### @react-three/xr Documentation
- [Official Docs](https://pmndrs.github.io/xr/docs/getting-started/introduction)
- [Object Detection Tutorial](https://pmndrs.github.io/xr/docs/tutorials/object-detection)
- [Hit Testing Tutorial](https://pmndrs.github.io/xr/docs/tutorials/hit-test)
- [Anchors Tutorial](https://pmndrs.github.io/xr/docs/tutorials/anchors)

### Meta Developer Resources
- [Meta WebXR Mixed Reality Guide](https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/)
- [Meta Quest Mixed Reality Blog](https://developers.meta.com/horizon/blog/building-mixed-reality-MR-meta-quest-3-connect-developers-presence-platform/)

### Physics Integration
- [@react-three/rapier GitHub](https://github.com/pmndrs/react-three-rapier)
- [Rapier.js Documentation](https://rapier.rs/docs/user_guides/javascript/)
- [Trimesh Colliders](https://rapier.rs/docs/user_guides/javascript/colliders/)

---

## Summary

**Feature 2 is achievable** with current WebXR capabilities on Meta Quest headsets. The implementation requires:

1. **WebXR AR session** with `plane-detection` / `mesh-detection` features
2. **@react-three/xr hooks** (`useXRPlanes`, `useXRMeshes`) to access detected geometry
3. **Rapier physics integration** using fixed RigidBodies with Cuboid/Trimesh colliders
4. **Floor alignment** using `local-floor` reference space + floor plane detection
5. **Conditional rendering** to show/hide VR-specific elements in AR mode

**Recommended path**: Start with plane detection (works on Quest 2 & 3), then optionally add mesh detection for Quest 3 users for more accurate collision.

**User requirement**: Must have room configured in Quest settings (Settings → Guardian → Mixed Reality).
