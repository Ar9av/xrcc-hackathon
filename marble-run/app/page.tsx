'use client';

import { useState } from 'react';
import Scene, { xrStore } from '@/components/Scene';

export default function Home() {
  const [showXRButtons, setShowXRButtons] = useState(false);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      {/* XR Features Toggle */}
      <button
        onClick={() => setShowXRButtons(!showXRButtons)}
        style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: showXRButtons ? '#10b981' : '#6b7280',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
        }}
      >
        {showXRButtons ? 'Hide XR Buttons' : 'Show XR Buttons'}
      </button>

      {/* VR/AR Entry Buttons - outside Canvas like prn-r3f-basics */}
      {showXRButtons && (
        <>
          <button
            onClick={() => xrStore.enterVR()}
            style={{
              position: 'absolute',
              top: '60px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
              backgroundColor: '#8b5cf6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            Enter VR
          </button>

          <button
            onClick={() => xrStore.enterAR()}
            style={{
              position: 'absolute',
              top: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              padding: '10px 20px',
              fontSize: '16px',
              cursor: 'pointer',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
          >
            Enter AR
          </button>
        </>
      )}

      <main className="w-full h-screen">
        <Scene />
      </main>
    </div>
  );
}
