'use client';

import { useRef } from 'react';
import { usePlane } from '@react-three/cannon';
import { Mesh } from 'three';

export default function Ground() {
  const [ref] = usePlane<Mesh>(() => ({
    rotation: [-Math.PI / 2, 0, 0],
    position: [0, 0, 0],
    args: [20, 20],
  }));

  return (
    <mesh ref={ref} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#8b7355" />
    </mesh>
  );
}

