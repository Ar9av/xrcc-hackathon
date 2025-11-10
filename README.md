# PRN React Three Fiber XR Basics

A learning project to understand the basics of React Three Fiber (R3F) for XR (Virtual Reality and Augmented Reality) development.

## Tech Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Three.js** - 3D graphics library
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for R3F
- **@react-three/xr** - XR support for R3F (VR/AR)

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

## Features

- Basic 3D scene with lighting
- Interactive 3D objects (pink box)
- Ground plane for spatial reference
- OrbitControls for desktop viewing
- VR support with "Enter VR" button
- AR support with "Enter AR" button

## Development Notes

- The scene includes ambient and directional lighting
- Objects are positioned in 3D space (x, y, z coordinates)
- The XR store manages VR/AR session state
- OrbitControls allow camera manipulation in browser mode

## Testing XR Features

**For VR:**
- You need a WebXR-compatible browser and VR headset
- Click "Enter VR" button to start VR session

**For AR:**
- You need a WebXR-compatible browser on an AR-capable device
- Click "Enter AR" button to start AR session

## Resources

- [React Three Fiber Docs](https://docs.pmnd.rs/react-three-fiber)
- [React Three Drei Docs](https://github.com/pmndrs/drei)
- [React Three XR Docs](https://github.com/pmndrs/xr)
- [Three.js Docs](https://threejs.org/docs/)
