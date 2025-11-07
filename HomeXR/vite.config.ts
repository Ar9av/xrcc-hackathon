import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // Required for WebXR on Quest 2
  ],
  server: {
    host: true, // Expose to network
    port: 5173,
  },
  // Fix multiple Three.js instances issue
  resolve: {
    dedupe: ['three', '@react-three/fiber']
  }
})
