# WebXR Sample (Three.js + Vite)

Minimal WebXR starter supporting both VR and AR using Three.js.

## Quick start

```bash
# from this folder
npm install
npm run dev
```

Open the printed local URL. For AR, use a device with WebXR AR support and open the HTTPS URL (see Deploy section).

## Features
- VR and AR buttons (via Three.js `VRButton`/`ARButton`)
- Simple scene with a spinning cube
- AR hit-test with reticle; tap/trigger to place cubes
- Vite dev server for fast iteration

## Scripts
- `npm run dev`: start dev server
- `npm run build`: production build
- `npm run preview`: preview production build

## Deploy (for AR over HTTPS)
AR requires a secure context. Options:
- Use `npm run build` and host `dist/` on any static host with HTTPS
- Use GitHub Pages/Netlify/Vercel and open on a mobile device supporting WebXR

## Notes
- Not all devices/browsers support WebXR AR. Chrome/Android with WebXR and ARCore is commonly supported.
- If AR button is disabled, try a supported device/browser or ensure HTTPS.

## Files
- `index.html`: basic page shell
- `src/main.js`: Three.js scene + WebXR setup
- `src/style.css`: minimal UI styles
- `vite.config.js`: Vite configuration

## License
MIT

