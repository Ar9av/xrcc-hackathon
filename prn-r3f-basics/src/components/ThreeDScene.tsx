import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Mesh, Group } from 'three'
import * as THREE from 'three'

export function FloatingFurniture() {
  const groupRef = useRef<Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.1
      groupRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.2
    }
  })

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Sofa */}
      <mesh position={[-1, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[1.5, 0.5, 0.8]} />
        <meshStandardMaterial color="#8b5cf6" emissive="#8b5cf6" emissiveIntensity={0.3} />
      </mesh>
      {/* Table */}
      <mesh position={[1, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.05, 32]} />
        <meshStandardMaterial color="#6366f1" emissive="#6366f1" emissiveIntensity={0.3} />
      </mesh>
      {/* Bed */}
      <mesh position={[0, 0, 1]} rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[2, 0.3, 1.5]} />
        <meshStandardMaterial color="#ec4899" emissive="#ec4899" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}

export function ParticleField() {
  const particlesRef = useRef<THREE.Points>(null)
  const count = 200
  const positions = new Float32Array(count * 3)

  for (let i = 0; i < count * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 20
  }

  useFrame((state) => {
    if (particlesRef.current) {
      particlesRef.current.rotation.y = state.clock.elapsedTime * 0.1
      particlesRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.2) * 0.1
    }
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#6366f1" transparent opacity={0.6} />
    </points>
  )
}

export function AnimatedGrid() {
  const gridRef = useRef<Mesh>(null)

  useFrame((state) => {
    if (gridRef.current) {
      gridRef.current.rotation.z = Math.sin(state.clock.elapsedTime * 0.2) * 0.05
    }
  })

  return (
    <mesh ref={gridRef} position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[10, 10, 20, 20]} />
      <meshBasicMaterial
        color="#6366f1"
        wireframe
        transparent
        opacity={0.2}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

