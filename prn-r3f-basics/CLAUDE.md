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

## Architecture & Key Concepts

### Component Structure

- **App.tsx** - Root component containing:
  - XR store initialization (`createXRStore()`)
  - Entry buttons for VR/AR sessions
  - Canvas with XR wrapper
  - Scene component

- **Scene Component** - Contains all 3D elements:
  - PlayerRig for locomotion
  - Lighting setup
  - 3D objects and environment
  - OrbitControls for desktop preview

- **PlayerRig Component** - Handles VR locomotion:
  - Manages XROrigin position/rotation
  - Processes controller input via `useXRInputSourceState`
  - Implements smooth locomotion with thumbsticks

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

1. Start dev server: `npm run dev`
2. Note the network URL shown in terminal (e.g., `https://192.168.1.3:5173/`)
3. On Quest 2 browser:
   - Navigate to the HTTPS URL
   - Accept self-signed certificate warning
   - Click "Enter VR" button
4. Use thumbsticks to move and rotate

## Learning Resources

The `docs/r3f-learnings.md` file contains comprehensive documentation on:
- React Three Fiber fundamentals
- WebXR implementation patterns
- Controller input handling details
- Best practices and common pitfalls

Refer to this document when implementing new XR features or troubleshooting issues.
