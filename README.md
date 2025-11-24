# XRCC - AR Furniture Placement

## Project Overview

XRCC is a web-based Augmented Reality (AR) application developed for the XRCC hackathon. It allows users to visualize and place virtual furniture models in their real-world environment using WebXR and React Three Fiber. The app supports both AR mode on mobile devices for immersive placement and a desktop preview mode for design exploration.

Key goals:
- Enable easy furniture placement in AR
- Provide a intuitive interface for selecting and manipulating objects
- Showcase modern web technologies for XR experiences

## Features

- **AR Hit Testing**: Place furniture accurately on real-world surfaces using device cameras
- **Furniture Library**: Pre-loaded 3D models including sofas, tables, beds, TVs, and more
- **Desktop Mode**: Interactive 3D scene with orbit controls for previewing layouts
- **Object Palette**: User-friendly menu to select and add furniture items
- **Responsive Design**: Works on mobile and desktop browsers
- **Landing Page**: Engaging introduction to the app with smooth animations

## Tech Stack

- **React** with **TypeScript** - For building the UI and managing state
- **Vite** - Fast build tool and development server
- **Three.js** - Core 3D rendering engine
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Helpful abstractions and components for R3F
- **@react-three/xr** - WebXR integration for AR/VR support
- **Leva** (or similar) - For potential controls/debugging
- **Tailwind CSS** or custom styles - For UI styling

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- A modern web browser (Chrome/Safari recommended for WebXR)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd xrcc
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:5173`.

## Usage

### AR Mode (Mobile)
1. Open the app on a compatible mobile device (iOS Safari or Android Chrome)
2. Tap "Enter AR" to start the AR session
3. Grant camera permissions
4. Point your device at a surface; a placement indicator will appear
5. Select furniture from the palette and tap to place
6. Use gestures to rotate/scale if supported

### Desktop Mode
1. Open the app in a desktop browser
2. Use mouse to orbit, zoom, and pan the 3D scene
3. Select and add furniture via the desktop menu
4. Preview layouts in a virtual room environment

### Furniture Assets
- 3D models (.glb format) for various furniture items
- Images for thumbnails in the object palette
- Loaded dynamically for performance

## Deployment

The project is configured for deployment on Netlify:

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy to Netlify:
   - Connect your GitHub repo to Netlify
   - Set build command: `npm run build`
   - Publish directory: `dist`

For other platforms, adjust the `vite.config.ts` accordingly.

## Demo

- Live Demo: [Link to deployed site]
- AR Testing: Use on mobile with WebXR support
- Desktop Preview: Full 3D interaction available

## Development Notes

- Ensure HTTPS for WebXR features in development (use `npm run dev -- --https`)
- Test AR on physical devices; emulators may not fully support hit testing
- Furniture models are in `public/asset/`; add new ones by placing .glb files and thumbnails
- Components like `ARHitTestManager.tsx` handle placement logic
- `ThreeDScene.tsx` manages the main 3D canvas

## Resources

- [React Three Fiber Documentation](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction)
- [WebXR API](https://developer.mozilla.org/en-US/docs/Web/API/WebXR_Device_API)
- [Three.js Examples](https://threejs.org/examples/)
- Hackathon Context: Refer to `context-on-xrcc-hackathon.md` for project inspiration

## Contributing

Feel free to open issues or pull requests. For hackathon improvements, focus on:
- Adding more furniture models
- Enhancing UI/UX
- Improving AR stability

## License

MIT License - see LICENSE file for details.
