# Marble Run - Next.js + Three.js Physics Simulation

A 3D physics-based marble run game built with Next.js, React Three Fiber, and Cannon.js physics engine.

## Features

### MVP (Current)
- ✅ **Ball Generation**: Create balls that fall with realistic gravity
- ✅ **Cube Placement**: Place static cubes as obstacles/platforms
- ✅ **Physics Interactions**: Balls and cubes collide with realistic physics
- ✅ **Interactive Controls**: Click to place objects, generate balls randomly
- ✅ **Camera Controls**: Orbit, zoom, and pan around the scene

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## How to Use

1. **Select Tool**: Choose between "Place Cube" or "Place Ball" from the control panel
2. **Place Objects**: Click on the ground plane to place the selected object
3. **Generate Balls**: Click "Generate Ball" to create a ball at a random position above the scene
4. **Camera Controls**:
   - **Left Click + Drag**: Rotate camera around the scene
   - **Right Click + Drag**: Pan the camera
   - **Scroll**: Zoom in/out

## Project Structure

```
marble-run/
├── app/
│   ├── page.tsx          # Main page component
│   └── layout.tsx        # Root layout
├── components/
│   ├── Scene.tsx         # Main 3D scene with physics
│   ├── Ball.tsx          # Ball component with physics
│   ├── Cube.tsx          # Cube component with physics
│   └── Ground.tsx        # Ground plane component
└── tasks.md              # Development checklist and roadmap
```

## Technologies

- **Next.js 16**: React framework with App Router
- **React Three Fiber**: React renderer for Three.js
- **@react-three/cannon**: Physics integration for R3F
- **@react-three/drei**: Useful helpers and abstractions
- **Three.js**: 3D graphics library
- **TypeScript**: Type safety
- **Tailwind CSS**: Styling

## Future Enhancements

See `tasks.md` for the complete roadmap of planned features including:
- Advanced physics controls
- Object manipulation (drag, delete, rotate)
- Save/load functionality
- Visual improvements
- Gameplay features (goals, scoring)

## Development Notes

- Physics engine: Cannon.js (via @react-three/cannon)
- Gravity: -9.81 m/s² (realistic Earth gravity)
- Ball properties: Mass = 1, Restitution = 0.6 (bouncy)
- Cube properties: Static (mass = 0), Restitution = 0.3
