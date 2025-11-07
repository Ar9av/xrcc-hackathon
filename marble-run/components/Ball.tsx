'use client';

import { useRef } from 'react';
import { useSphere } from '@react-three/cannon';
import { Mesh } from 'three';

interface BallProps {
  position: [number, number, number];
  restitution?: number;
}

export default function Ball({ position, restitution = 0.6 }: BallProps) {
  const [ref] = useSphere<Mesh>(() => ({
    mass: 1,
    position,
    args: [0.25], // radius
    restitution, // bounciness - set correctly on creation
    friction: 0.4,
  }));

  return (
    <mesh ref={ref} castShadow receiveShadow>
      <sphereGeometry args={[0.25, 32, 32]} />
      <meshStandardMaterial color="#ff6b6b" metalness={0.3} roughness={0.4} />
    </mesh>
  );
}

