# Feature 2: AR Physics with Real-World Surfaces

Enable virtual balls to collide with physical room geometry (walls, floor, furniture) using WebXR plane/mesh detection + Rapier physics.

## Requirements

- Detect room geometry via WebXR spatial mapping
- Create physics colliders for detected surfaces
- Balls bounce off walls/furniture, rest on physical floor
- Hide virtual ground plane in AR mode
- Support both Quest 2 (planes) and Quest 3 (planes + meshes)
- User must configure room: Settings → Guardian → Mixed Reality

## Device Capabilities

| Feature | Quest 2 | Quest 3 | Notes |
|---------|---------|---------|-------|
| Passthrough | Grayscale | Color | Automatic in AR mode |
| Plane Detection | Yes | Yes | Flat surfaces as rectangles |
| Mesh Detection | No | Yes | Detailed 3D room geometry |
| Semantic Labels | Yes | Yes | 'floor', 'wall', 'table', 'ceiling' |

**Design Decision:** We'll implement both plane and mesh detection with automatic fallback. Quest 3 users get accurate mesh-based collision, Quest 2 users get functional plane-based collision. This ensures the best experience for each device while maintaining compatibility.

## WebXR Session Setup

```javascript
// AR session requires immersive-ar mode
const session = await navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['plane-detection', 'local-floor', 'anchors'],
  optionalFeatures: ['mesh-detection', 'depth-sensing']
})
```

**Key points:**
- `immersive-ar` mode (not `immersive-vr`) enables passthrough automatically
- `local-floor` reference space aligns Y=0 with physical floor, critical for proper physics
- `plane-detection` is required (Quest 2/3 compatible)
- `mesh-detection` is optional (Quest 3 only) - session won't fail if unavailable

## @react-three/xr Implementation

### Store Configuration

```tsx
const store = createXRStore({
  planeDetection: true,
  meshDetection: true
})

// App.tsx buttons
<button onClick={() => store.enterVR()}>Enter VR</button>
<button onClick={() => store.enterAR()}>Enter AR</button>
```

The store automatically requests the appropriate WebXR features when entering AR mode.

### Plane Detection

```tsx
import { useXRPlanes, XRSpace, XRPlaneModel } from '@react-three/xr'

const planes = useXRPlanes()           // All planes
const walls = useXRPlanes('wall')      // Filter by semantic label
const floor = useXRPlanes('floor')

// Available semantic labels: 'floor', 'wall', 'table', 'ceiling'
```

Planes are detected by the Quest's spatial mapping system. Each plane is a flat rectangular surface with position, orientation, and boundary polygon. The semantic label helps distinguish what type of surface it is.

### Mesh Detection (Quest 3)

```tsx
import { useXRMeshes, XRSpace, XRMeshModel } from '@react-three/xr'

const meshes = useXRMeshes()

// Each mesh provides:
// - meshSpace: XRSpace (coordinate system)
// - vertices: Float32Array (3D vertex positions)
// - indices: Uint32Array (triangle indices)
// - lastChangedTime: timestamp (for detecting updates)
```

Meshes provide detailed 3D geometry of the room, including furniture and curved surfaces. More accurate than planes but higher performance cost.

### Mode Detection

```tsx
import { useXR } from '@react-three/xr'

const mode = useXR(state => state.mode)
const isAR = mode === 'immersive-ar'
const isVR = mode === 'immersive-vr'
```

Use this to conditionally render different content for VR vs AR modes.

## Physics Integration Strategy

The core challenge is creating Rapier physics colliders from WebXR-detected geometry. We need two approaches:

1. **Plane-based collision** (Quest 2/3): Simple rectangular colliders, lower cost
2. **Mesh-based collision** (Quest 3): Accurate trimesh colliders, higher cost

### Plane Colliders (Quest 2/3 Compatible)

```tsx
import { RigidBody, CuboidCollider } from '@react-three/rapier'
import { useXRPlanes, XRSpace } from '@react-three/xr'
import { useMemo } from 'react'

function PhysicsPlanes() {
  const planes = useXRPlanes()

  return (
    <>
      {planes.map(plane => (
        <PhysicsPlane key={plane.planeSpace} plane={plane} />
      ))}
    </>
  )
}

function PhysicsPlane({ plane }) {
  // Calculate plane dimensions from polygon boundary
  const dimensions = useMemo(() => {
    const { minX, maxX, minZ, maxZ } = getBounds(plane.polygon)
    return {
      width: maxX - minX,
      height: maxZ - minZ,
      thickness: 0.01  // 1cm thick collision surface
    }
  }, [plane.polygon])

  return (
    <XRSpace space={plane.planeSpace}>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider
          args={[dimensions.width / 2, dimensions.thickness, dimensions.height / 2]}
        />
      </RigidBody>
    </XRSpace>
  )
}

// Helper to find bounding box of polygon
function getBounds(polygon) {
  let minX = Infinity, maxX = -Infinity
  let minZ = Infinity, maxZ = -Infinity

  for (const point of polygon) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }

  return { minX, maxX, minZ, maxZ }
}
```

**Why this approach:**
- Planes are represented as polygons in the XR API, but Rapier needs dimensions
- We calculate bounding box from polygon vertices to get width/height
- Use thin cuboid (1cm) to approximate flat surface without visual offset
- `type="fixed"` means static geometry (no movement), more efficient

### Mesh Colliders (Quest 3)

```tsx
import { RigidBody, TrimeshCollider } from '@react-three/rapier'
import { useXRMeshes, XRSpace } from '@react-three/xr'
import { useMemo } from 'react'

function PhysicsMeshes() {
  const meshes = useXRMeshes()

  return (
    <>
      {meshes.map(mesh => (
        <PhysicsMesh key={mesh.meshSpace} mesh={mesh} />
      ))}
    </>
  )
}

function PhysicsMesh({ mesh }) {
  // Prepare geometry for Rapier trimesh collider
  const colliderGeometry = useMemo(() => ({
    vertices: mesh.vertices,
    indices: mesh.indices
  }), [mesh.lastChangedTime])

  return (
    <XRSpace space={mesh.meshSpace}>
      <RigidBody type="fixed" colliders={false}>
        <TrimeshCollider args={[colliderGeometry.vertices, colliderGeometry.indices]} />
      </RigidBody>
    </XRSpace>
  )
}
```

**Why this approach:**
- XRMesh directly provides vertices and indices that Rapier TrimeshCollider expects
- Use `useMemo` with `lastChangedTime` to rebuild collider only when mesh updates
- Trimesh handles complex geometry (furniture, curved surfaces) accurately
- Higher performance cost than cuboids but necessary for accurate collision with complex shapes

### Hybrid Approach (Recommended)

```tsx
function ARPhysics() {
  const meshes = useXRMeshes()

  // Prefer meshes if available (Quest 3), fallback to planes (Quest 2)
  const useMeshes = meshes.length > 0

  return useMeshes ? <PhysicsMeshes /> : <PhysicsPlanes />
}
```

**Design rationale:**
- Quest 3 users automatically get mesh-based collision (more accurate)
- Quest 2 users automatically get plane-based collision (still functional)
- No device detection needed - just check if meshes are available
- Single component handles both cases

## Conditional Rendering Pattern

VR and AR modes need different scene content. VR has virtual environment (ground, cubes, locomotion), AR uses real-world surfaces.

```tsx
function Scene() {
  const mode = useXR(state => state.mode)
  const isAR = mode === 'immersive-ar'

  return (
    <Physics gravity={[0, -9.81, 0]}>
      {/* VR-only elements */}
      {!isAR && (
        <>
          <PlayerRig />           {/* Thumbstick locomotion */}
          <Ground />              {/* Virtual floor */}
          <StaticCubes />         {/* Test cubes */}
        </>
      )}

      {/* AR-only elements */}
      {isAR && <ARPhysics />}     {/* Real-world colliders */}

      {/* Shared elements (both VR and AR) */}
      <GrabbableBalls />
      <GrabController hand="left" />
      <GrabController hand="right" />

      {/* Adjust lighting per mode */}
      <ambientLight intensity={isAR ? 0.8 : 0.5} />
      <directionalLight position={[10, 10, 5]} intensity={isAR ? 0.5 : 1.0} />
    </Physics>
  )
}
```

**Why conditional rendering:**
- VR needs virtual floor for physics, AR uses detected real floor
- VR needs locomotion (player can move), AR user walks in real space
- AR needs less artificial lighting (passthrough shows real environment)
- Shared elements (balls, grab mechanics) work in both modes

## Critical Implementation Points

### 1. Always Use XRSpace

```tsx
// Correct - XRSpace handles coordinate transform
<XRSpace space={plane.planeSpace}>
  <RigidBody>...</RigidBody>
</XRSpace>

// Wrong - manual positioning won't work
<RigidBody position={[x, y, z]}>...</RigidBody>
```

**Why:** WebXR provides geometry in local coordinate spaces. XRSpace component transforms from local space → world space. Without it, colliders will be positioned incorrectly.

### 2. Use type="fixed" for Environment

```tsx
<RigidBody type="fixed" colliders={false}>
  <CuboidCollider args={[...]} />
</RigidBody>
```

**Why:** Real-world surfaces are static (don't move). `type="fixed"` tells Rapier to skip dynamic physics calculations for these bodies, significantly improving performance.

### 3. Hide Virtual Floor in AR

```tsx
{!isAR && <Ground />}
```

**Why:** Virtual floor mesh covers real-world floor in AR, breaking immersion. Conditionally render only in VR mode.

### 4. Handle No Planes Detected

```tsx
const planes = useXRPlanes()

useEffect(() => {
  if (planes.length === 0) {
    console.warn('No planes detected. User needs to configure room setup.')
  }
}, [planes.length])
```

**Why:** If user hasn't configured room in Quest settings, no planes will be detected. Provide helpful feedback rather than silently failing.

### 5. Performance Optimization

```tsx
// Filter out tiny planes
const significantPlanes = useMemo(() => {
  return planes.filter(plane => {
    const area = calculateArea(plane.polygon)
    return area > 0.1  // Skip planes < 0.1 m²
  })
}, [planes])

// Limit trimesh colliders
const limitedMeshes = meshes.slice(0, 20)
```

**Why:** Each collider has performance cost. Small planes don't meaningfully affect gameplay. Trimesh colliders are expensive - limit to ~20 active meshes to maintain 60+ FPS.

## Implementation Steps

1. **Add AR button:** `<button onClick={() => store.enterAR()}>Enter AR</button>`
2. **Configure store:** `planeDetection: true, meshDetection: true`
3. **Conditional floor:** `{!isAR && <Ground />}`
4. **Create PhysicsPlanes component** with CuboidCollider for planes
5. **Create PhysicsMeshes component** with TrimeshCollider for meshes
6. **Create ARPhysics hybrid selector** that chooses mesh vs plane
7. **Add to Scene:** `{isAR && <ARPhysics />}`
8. **Test on Quest 2** (should use planes) **and Quest 3** (should use meshes)

## File Structure

```
src/components/
├── Scene.tsx              # Mode-based conditional rendering
├── ar/
│   ├── PhysicsPlanes.tsx  # Plane detection → CuboidCollider
│   ├── PhysicsMeshes.tsx  # Mesh detection → TrimeshCollider
│   └── ARPhysics.tsx      # Hybrid selector (mesh vs plane)
```

Keep AR-specific components in separate folder for organization.

## Troubleshooting

### No planes detected

**Symptoms:** `useXRPlanes()` returns empty array, balls fall through floor

**Causes:**
- User hasn't configured room in Quest settings
- `planeDetection: false` in store config
- Wrong reference space

**Solutions:**
- Verify room setup: Settings → Guardian → Mixed Reality
- Check store config: `planeDetection: true`
- Ensure session requests `local-floor` reference space
- Check browser console for WebXR errors

### Balls fall through floor

**Symptoms:** Physics collision doesn't work with detected surfaces

**Causes:**
- PhysicsPlanes component not rendered
- Collider dimensions calculated incorrectly
- Physics running too fast (tunneling)

**Solutions:**
- Verify `{isAR && <ARPhysics />}` is in Scene
- Check `type="fixed"` on RigidBody
- Enable CCD for fast-moving balls: `<RigidBody ccd={true}>`
- Log collider dimensions to verify correctness

### Planes misaligned with surfaces

**Symptoms:** Collision happens in wrong location, visual overlay doesn't match

**Causes:**
- Not using XRSpace component
- Manually applying transforms to planes
- Reference space mismatch

**Solutions:**
- Always wrap in `<XRSpace space={plane.planeSpace}>`
- Never manually set position/rotation on detected geometry
- Let @react-three/xr handle coordinate transforms

### Performance issues (low FPS)

**Symptoms:** FPS drops below 60, stuttering movement

**Causes:**
- Too many trimesh colliders
- Complex mesh geometry
- Too many physics bodies

**Solutions:**
- Use plane colliders instead of mesh when possible
- Filter out small planes (< 0.1 m²)
- Limit active trimesh colliders to ~20
- Use `useMemo` to avoid recreating colliders every frame

## API Reference

### XRPlane Interface

```typescript
interface XRPlane {
  planeSpace: XRSpace                    // Coordinate system
  polygon: DOMPointReadOnly[]            // Boundary vertices [x, z] (Y=0)
  orientation: 'horizontal' | 'vertical' // Plane type
  semanticLabel?: string                 // 'floor' | 'wall' | 'table' | 'ceiling'
  lastChangedTime: DOMHighResTimeStamp   // Update tracking
}
```

### XRMesh Interface

```typescript
interface XRMesh {
  meshSpace: XRSpace              // Coordinate system
  vertices: Float32Array          // [x,y,z, x,y,z, ...] format
  indices: Uint32Array            // [i1,i2,i3, i4,i5,i6, ...] triangles
  lastChangedTime: DOMHighResTimeStamp
}
```

## Design Decisions Summary

**Why hybrid plane/mesh approach?**
- Ensures compatibility across Quest 2 and Quest 3
- Quest 3 users automatically get better experience (mesh-based)
- Quest 2 users still get functional collision (plane-based)
- No manual device detection needed

**Why remove virtual floor in AR?**
- Virtual floor covers real-world surfaces in passthrough
- Breaks immersion (seeing virtual floor floating over real floor)
- Detected real floor provides physics collision

**Why use local-floor reference space?**
- Automatically aligns Y=0 with physical floor level
- Virtual objects at Y=0 rest on real floor
- Critical for proper physics interaction

**Why CuboidCollider for planes instead of TrimeshCollider?**
- Planes are flat rectangles - cuboid is perfect fit
- CuboidCollider is more performant than trimesh
- Simpler to calculate dimensions (bounding box)
- Reserve trimesh for complex geometry (meshes)

## External References

- [@react-three/xr docs](https://pmndrs.github.io/xr/)
- [@react-three/rapier docs](https://pmndrs.github.io/react-three-rapier/)
- [Meta WebXR Mixed Reality](https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality/)
