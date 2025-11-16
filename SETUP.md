# Setup Instructions

## About DecoratAR

DecoratAR is an XR (Extended Reality) application that allows users to visualize and place furniture in augmented and virtual reality environments. Built for the XRCC hackathon, this application leverages WebXR technology to provide immersive furniture placement experiences.

## Prerequisites

- Node.js (v18 or higher)
- npm (comes with Node.js)

## Tech Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **Three.js** - 3D graphics library
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers for R3F
- **@react-three/xr** - XR support for R3F (VR/AR)

## Running the Application

### Step 1: Extract the ZIP file
Extract the contents of the ZIP file to a directory of your choice.

### Step 2: Install dependencies
Open a terminal in the extracted folder and run:
```bash
npm install
```

### Step 3: Start the development server
```bash
npm run dev
```

### Step 4: Access the application
Open your browser and navigate to:
- `https://localhost:5173` (HTTPS is required for WebXR features)
- Accept the self-signed certificate warning if prompted

### Step 5: Build for production (optional)
To create a production build:
```bash
npm run build
```

The built files will be in the `dist` folder. You can serve them using any static file server.

## Docker Setup

If you prefer to run the application using Docker, see the `Dockerfile` in the root directory.

### Using Docker

Build the Docker image:
```bash
docker build -t decoratar .
```

Run the container:
```bash
docker run -p 5173:5173 decoratar
```

Access the application at `https://localhost:5173`

