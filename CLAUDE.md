# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a learning project focused on React Three Fiber (R3F) for WebXR development, specifically targeting Meta Quest 2 VR headsets. The application demonstrates 3D scene rendering, VR locomotion with controller input, and proper WebXR session management.

**Tech Stack:**
- React 19 + TypeScript
- React Three Fiber (R3F) - React renderer for Three.js
- @react-three/xr - WebXR/VR/AR support
- @react-three/drei - R3F utility components
- Vite - Build tool with HTTPS support for WebXR

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (with HTTPS for WebXR)
npm run dev

# Build for production
npm run build

# Lint code
npm run lint

# Preview production build
npm run preview
```

The dev server runs on port 5173 with HTTPS enabled (required for WebXR). The server is exposed to the local network for testing on Quest 2 devices.

## Project Structure

### Key Files

- **src/App.tsx** - Main application file containing:
  - `App` - Root component (XR store, entry buttons, Canvas)
  - `Scene` - 3D scene (PlayerRig, Physics, GrabbableBalls, AR components)
  - `PlayerRig` - VR locomotion using `useXRControllerLocomotion` hook
  - `GrabbableBall` - Physics ball with grab/throw mechanics
  - `GrabController` - Grip button handler for grab/throw
  - AR state management for object palette and draw mode

- **src/components/ARHitTestManager.tsx** - AR plane detection, object placement, selection, and transformation:
  - Hit test source creation from viewer space
  - Reticle cursor positioning on detected planes
  - Object placement via anchors on trigger press
  - Support for multiple object types (table, bed, sofa, round-table)
  - Draw mode integration (only places objects when in draw mode, auto-exits after placement)
  - Object selection with controller rays (onClick handlers)
  - B button deletion (SelectionController component)
  - Object rotation with thumbstick input (RotationController component)
  - Mode toggling with A button (ModeController component)
  - Transform mode visuals: RotateRing (yellow ring), scale/move placeholders
  - Flag-based deselection logic for empty space clicks

- **src/components/ObjectPalette.tsx** - 3D UI palette for AR object selection:
  - `ObjectPalette` - Main component managing palette and button input
  - `PalettePanel` - 3D UI panel with object selection buttons
  - `PaletteController` - Y/X button detection for palette control
  - Position calculation in front of user's head using camera.matrixWorld

### Key Hooks (from @react-three/xr)

- **useXRControllerLocomotion(originRef, options)**
  - Purpose: Head-relative movement and rotation
  - Features: Forward/backward/strafe (left thumbstick), snap rotation (right thumbstick)
  - Options: `{ speed, rotationSpeed, deadZone }`

- **useXRInputSourceState(type, hand)**
  - Purpose: Access controller state
  - Usage: `useXRInputSourceState('controller', 'left'|'right')`
  - Returns: `gamepad` object with buttons/axes (e.g., `gamepad['xr-standard-squeeze']`)

### Key Interfaces/Types

- **BallData** - Ball state: `{ id, rigidBodyRef, isGrabbed, grabbedBy, pendingVelocity }`
- **GrabbableBallProps** - Props for grabbable balls
- **GrabControllerProps** - Props for grab handlers: `{ hand, balls, onGrab, onRelease }`

### Physics Constants (in App.tsx)

```ts
BALL_RADIUS = 0.3, GRAB_DISTANCE = 0.5, THROW_MULTIPLIER = 1.5
VELOCITY_HISTORY_SIZE = 5  // For throw velocity calculation
```

## Architecture & Key Concepts

### Component Hierarchy

```
App (XR store, entry buttons)
└── Canvas → XR → Scene
    ├── PlayerRig (locomotion with useXRControllerLocomotion)
    ├── AR Mode Components (when mode === 'immersive-ar'):
    │   ├── ARHitTestManager (plane detection, object placement)
    │   └── ObjectPalette (3D UI for object selection)
    ├── Physics (VR mode)
    │   ├── GrabbableBall (x3)
    │   ├── RigidBody cubes (x4)
    │   └── Ground plane
    ├── GrabController (left/right hands, VR mode)
    └── OrbitControls (desktop preview)
```

### Feature 3: Object Palette for AR

**Purpose:** Allow users to select and place different object types in AR mode using a 3D UI palette.

**User Workflow:**
1. Enter AR mode → Detect planes
2. Press Y button (left controller) → Palette appears in front of user
3. Point controller at object button → Press trigger → Object selected, draw mode activated, palette closes
4. Point at detected plane → Cursor appears → Press trigger → Place selected object
5. Press Y to reopen palette and select different object type
6. Press X to exit draw mode (hides cursor)

**State Management (in Scene component):**
- `isPaletteVisible`: Boolean controlling palette UI visibility
- `selectedObjectType`: String indicating which object is selected ('block' | 'pyramid' | 'bed' | 'sofa' | 'table' | null)
- `isDrawMode`: Boolean indicating if user can place objects

**Controller Button Mapping:**
- Y button (left controller): Toggle palette visibility, exits draw mode when opening
- X button (left controller): Exit draw mode
- Trigger button: Select object from palette OR place object on plane (depending on context)

**3D Assets (added by ar9av):**
Located in `public/asset/`:
- `bed.glb` - 3D furniture model
- `sofa.glb` - 3D furniture model
- `table.glb` - 3D furniture model
- `images/bed.png` - Palette button texture
- `images/sofa.webp` - Palette button texture
- `images/table.png` - Palette button texture

**Known Issues:**
- Palette positioning inconsistent - sometimes appears on floor, sometimes to the right
- camera.getWorldDirection() occasionally returns unexpected values (e.g., pointing down when user looking forward)
- Debug visualizations added to troubleshoot: shows default forward, quaternion-applied forward, forward flat, head position, target position as colored rays from origin

### Feature 4.1: Object Selection and Deletion

**Purpose:** Allow users to select and delete placed AR objects using controller interactions.

**User Workflow:**
1. Point controller ray at placed object → Press trigger → Object selected (yellow wireframe appears)
2. Point at empty space → Press trigger → Object deselected (wireframe disappears)
3. With object selected → Press B button (right controller) → Object deleted
4. Draw mode auto-exits after placing object to prevent accidental duplicates

**State Management (in PlacementHandler component):**
- `selectedObjectId`: String | null tracking currently selected object
- `objectClickedRef`: Ref flag to distinguish object clicks from empty space clicks
- `anchoredObjects`: Array of placed objects with IDs for deletion

**Controller Button Mapping:**
- Trigger button: Select object OR deselect (context-dependent)
- B button (right controller): Delete currently selected object

**Implementation Details:**
- **SelectableObject** - Renamed from AnchoredObject with added props:
  - `id`: Unique identifier for selection tracking
  - `isSelected`: Boolean for visual feedback
  - `onSelect`: Callback with `event.stopPropagation()` to prevent deselection
  - `onClick` handler uses @react-three/xr pointer events (automatic raycasting)

- **SelectionHighlight** - Visual feedback component:
  - Yellow wireframe box positioned at [0, 0.5, 0]
  - Temporary indicator (will be replaced with transform axes in Feature 4.2)

- **SelectionController** - B button detection:
  - Uses `useXRInputSourceState('controller', 'right')`
  - Edge detection with `previousBState` ref (false → true transition)
  - Only triggers deletion when `selectedObjectId` exists

- **Deselection Logic** - Flag-based approach:
  - Objects set `objectClickedRef.current = true` in onClick before session 'select' event
  - Session 'select' handler checks flag: if false and selection exists → deselect
  - Prevents conflict between placement and selection (both use trigger)

**Key Pattern:** Auto-exit draw mode after object placement prevents selecting objects from triggering duplicate placement.

### Feature 4.2: Object Rotation (Rotate Mode)

**State (in PlacementHandler):**
- `transformMode`: 'rotate' | 'scale' | 'move' (default: 'rotate')
- `rotation`: Number (radians) in anchoredObjects array per object
- `handleRotate(deltaRotation)`: Updates rotation state
- `handleToggleMode()`: Cycles through modes

**Components (in ARHitTestManager.tsx):**
- `RotateRing`: Yellow ring at object center [0,0,0], rotation [-π/2,0,0], radius = bbox diagonal/2 + 0.15m, thickness 7.5%
- `RotationController`: Thumbstick X-axis input, 30°/sec, dead zone 0.1, strongest input wins when both active
- `ModeController`: A button (right) cycles modes with edge detection
- `ModificationVisuals`: Container that renders ring/placeholders based on mode

**Rotation Logic (SelectableObject useFrame):**
- Decompose anchor matrix → extract plane normal from Y-axis
- Create rotation quat: `setFromAxisAngle(planeNormal, rotation)`
- Compose: `matrix.compose(anchorPos + offset, rotationQuat * anchorQuat, scale)`

**Key Patterns:**
- Child visuals inherit parent transform - no manual matrix updates
- Quaternion rotation around arbitrary axis for any plane orientation
- No modulo on angle (causes snapping) - soft normalization at ±4π
- Player locomotion disabled (commented out in App.tsx)

### Critical WebXR Patterns

**XROrigin vs Camera Movement:**
In WebXR, NEVER move the camera directly. Always move the `XROrigin` component, which acts as the root of the player's coordinate system. The VR headset controls camera position relative to this origin.

```tsx
// ✓ Correct
const originRef = useRef<THREE.Group>(null)
useFrame(() => {
  originRef.current.position.x += speed
})
return <XROrigin ref={originRef} />

// ✗ Wrong - doesn't work in VR
useFrame((state) => {
  state.camera.position.x += speed
})
```

**Controller Input:**
Use `useXRInputSourceState` hook from @react-three/xr, NOT the raw WebXR API:

```tsx
const leftController = useXRInputSourceState('controller', 'left')
const rightController = useXRInputSourceState('controller', 'right')

// Access thumbstick via named gamepad component
const thumbstick = leftController?.gamepad?.['xr-standard-thumbstick']
const x = thumbstick?.xAxis ?? 0  // -1 to 1
const y = thumbstick?.yAxis ?? 0  // -1 to 1
```

**Quest 2 Controller Layout:**
- Left thumbstick: Forward/backward (yAxis), strafe left/right (xAxis)
- Right thumbstick: Smooth rotation (xAxis)
- Implement 0.1 dead zone to prevent drift

### Vite Configuration Notes

**Critical configurations in vite.config.ts:**

1. **basicSsl plugin** - Required for WebXR on physical devices (WebXR requires HTTPS except on localhost)
2. **resolve.dedupe** - Forces single Three.js instance to prevent "multiple instances" error:
   ```ts
   resolve: {
     dedupe: ['three', '@react-three/fiber']
   }
   ```
3. **server.host: true** - Exposes dev server to local network for Quest 2 testing

## Common Issues & Resolutions

### Multiple Three.js Instances Error
**Symptoms:** `WARNING: Multiple instances of Three.js` or `TypeError: material.onBuild is not a function`

**Solution:** Already configured in vite.config.ts via `resolve.dedupe`. If error persists, clear node_modules and reinstall.

### Controller Input Not Working
**Cause:** Using raw WebXR API (`session.inputSources`) instead of @react-three/xr hooks

**Solution:** Use `useXRInputSourceState('controller', 'left'|'right')` to access controllers

### Movement Not Working in VR
**Cause:** Trying to move camera instead of XROrigin

**Solution:** Move the XROrigin ref, not `state.camera`

### WebXR Not Available Error
**Cause:** Accessing over HTTP instead of HTTPS

**Solution:** Dev server already has basicSsl plugin enabled. Ensure you're accessing via `https://` URL

## Testing on Quest 2

### VR Mode Testing

1. Start dev server: `npm run dev`
2. Note the network URL shown in terminal (e.g., `https://192.168.1.3:5173/`)
3. On Quest 2 browser:
   - Navigate to the HTTPS URL
   - Accept self-signed certificate warning
   - Click "Enter VR" button
4. Use thumbsticks to move and rotate
5. Test ball grabbing with grip buttons

### AR Mode Testing

1. Start dev server: `npm run dev`
2. On Quest 2 browser, navigate to the HTTPS URL
3. Click "Enter AR" button
4. Allow camera permissions
5. Move device to scan environment for plane detection
6. Test object palette workflow (Feature 3):
   - Press Y to open palette
   - Point at object and press trigger to select
   - Point at detected plane and press trigger to place
   - Draw mode auto-exits after placement
   - Press Y again to select and place different object type
   - Press X to exit draw mode manually if needed
7. Test Feature 4.1 (selection/deletion) and 4.2 (rotation)

## Learning Resources

The `docs/r3f-learnings.md` file contains comprehensive documentation on:
- React Three Fiber fundamentals
- WebXR implementation patterns (VR and AR)
- Controller input handling details
- AR hit testing and plane detection
- AR UI menu positioning (camera.matrixWorld, orientation, lifecycle management)
- Physics interactions and object grabbing
- Best practices and common pitfalls

Refer to this document when implementing new XR features or troubleshooting issues.

Additional documentation:
- `docs/feature3-research.md` - Detailed research on object palette implementation, controller interactions, and 3D UI design patterns
- `docs/feature4-1-research.md` - Detailed research on object selection and deletion, pointer events, button detection, and state management patterns
- `docs/feature4-2-rotate-research.md` - Detailed research on rotate mode implementation, quaternion rotation, ring geometry, thumbstick input, and mode toggling
- `docs/r3f-feature-exploration.md` - Feature requirements and exploration notes
