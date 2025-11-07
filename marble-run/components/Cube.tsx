'use client';

import { useRef } from 'react';
import { useBox } from '@react-three/cannon';
import { Mesh } from 'three';

interface CubeProps {
  position: [number, number, number];
  onClick?: (event: any) => void;
  isEraserMode?: boolean;
}

export default function Cube({ position, onClick, isEraserMode = false }: CubeProps) {
  const [ref] = useBox<Mesh>(() => ({
    mass: 0, // Static cube
    position,
    args: [0.5, 0.5, 0.5], // width, height, depth
    restitution: 0.3,
    friction: 0.6,
  }));

  const handlePointerDown = (event: any) => {
    if (isEraserMode && onClick) {
      onClick(event);
    }
  };

  return (
    <mesh 
      ref={ref} 
      castShadow 
      receiveShadow
      onPointerDown={handlePointerDown}
    >
      <boxGeometry args={[0.5, 0.5, 0.5]} />
      <meshStandardMaterial 
        color={isEraserMode ? "#ff6b6b" : "#4ecdc4"} 
        metalness={0.2} 
        roughness={0.5}
        opacity={isEraserMode ? 0.8 : 1}
        transparent={isEraserMode}
      />
    </mesh>
  );
}

