'use client';

import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/cannon';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { XR, createXRStore, XROrigin, useXRControllerLocomotion, useXRInputSourceState } from '@react-three/xr';
import { Suspense, useRef, useState, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import Ball from './Ball';
import Cube from './Cube';
import Ground from './Ground';
import { Vector3 } from 'three';
import * as THREE from 'three';

// Create XR store - manages VR/AR session state
export const xrStore = createXRStore();

interface PlacedObject {
  id: string;
  type: 'ball' | 'cube';
  position: [number, number, number];
  restitution?: number;
}

function ClickableGround({ 
  onGroundClick, 
  onHover,
  mode 
}: { 
  onGroundClick: (point: Vector3) => void;
  onHover: (point: Vector3 | null) => void;
  mode: 'cube' | 'ball' | 'eraser';
}) {
  const groundRef = useRef<THREE.Mesh>(null);
  
  const handleClick = (event: any) => {
    event.stopPropagation();
    // React Three Fiber provides event.point directly from the intersection
    if (event.point) {
      onGroundClick(event.point);
    }
  };

  const handleHover = (event: any) => {
    if (event.point) {
      onHover(event.point);
    }
  };

  const handleLeave = () => {
    onHover(null);
  };

  return (
    <mesh 
      ref={groundRef} 
      onPointerDown={handleClick}
      onPointerMove={handleHover}
      onPointerLeave={handleLeave}
      position={[0, 0, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#8b7355" visible={false} />
    </mesh>
  );
}

// Visual indicator for placement position with X, Y, Z axes
function PlacementIndicator({ position, visible }: { position: Vector3 | null; visible: boolean }) {
  if (!visible || !position) return null;
  
  const axisLength = 0.3;
  
  return (
    <group position={[position.x, position.y, position.z]}>
      {/* X-axis line (red) - horizontal, pointing right */}
      <mesh position={[axisLength / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, axisLength, 8]} />
        <meshStandardMaterial color="#ff0000" />
      </mesh>
      {/* Y-axis line (green) - vertical, pointing up */}
      <mesh position={[0, axisLength / 2, 0]}>
        <cylinderGeometry args={[0.015, 0.015, axisLength, 8]} />
        <meshStandardMaterial color="#00ff00" />
      </mesh>
      {/* Z-axis line (blue) - horizontal, pointing forward */}
      <mesh position={[0, 0, axisLength / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, axisLength, 8]} />
        <meshStandardMaterial color="#0000ff" />
      </mesh>
      {/* Center sphere */}
      <mesh>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

// PlayerRig component handles VR locomotion (movement)
function PlayerRig() {
  const originRef = useRef<THREE.Group>(null);

  // Use the official hook for controller-based locomotion
  useXRControllerLocomotion(originRef as any, {
    speed: 2.0  // Movement speed (units per second)
  });

  return <XROrigin ref={originRef} />;
}

// Controller interaction handler for placing objects
function XRControllerInteraction({
  onPlaceObject,
  selectedTool,
  cubeHeight,
  ballHeight,
  bounceValue,
  setPlacedObjects,
  placedObjects,
  nextId,
  setNextId
}: {
  onPlaceObject: (position: [number, number, number]) => void;
  selectedTool: 'cube' | 'ball' | 'eraser';
  cubeHeight: number;
  ballHeight: number;
  bounceValue: number;
  setPlacedObjects: any;
  placedObjects: PlacedObject[];
  nextId: number;
  setNextId: any;
}) {
  const rightController = useXRInputSourceState('controller', 'right');
  const triggerPressed = useRef(false);

  // Handle trigger press for placing objects
  useFrame(() => {
    if (rightController?.gamepad) {
      const trigger = rightController.gamepad['xr-standard-trigger'];
      const pressed = (trigger as any)?.pressed || (trigger as any)?.value > 0.5;

      if (pressed && !triggerPressed.current) {
        triggerPressed.current = true;
        
        if (rightController.object) {
          // Get controller position and direction
          const controllerPosition = new Vector3();
          rightController.object.getWorldPosition(controllerPosition);
          
          const controllerDirection = new Vector3(0, 0, -1);
          rightController.object.getWorldDirection(controllerDirection);
          
          // Place object at raycast hit point (or at controller position + offset)
          const placePosition: [number, number, number] = [
            controllerPosition.x + controllerDirection.x * 1.5,
            selectedTool === 'cube' ? cubeHeight : ballHeight,
            controllerPosition.z + controllerDirection.z * 1.5
          ];
          
          if (selectedTool === 'eraser') {
            // Find and remove nearest cube
            const cubes = placedObjects.filter(obj => obj.type === 'cube');
            if (cubes.length > 0) {
              let nearestCube = cubes[0];
              let minDistance = Infinity;
              
              cubes.forEach(cube => {
                const distance = Math.sqrt(
                  Math.pow(cube.position[0] - placePosition[0], 2) +
                  Math.pow(cube.position[1] - placePosition[1], 2) +
                  Math.pow(cube.position[2] - placePosition[2], 2)
                );
                if (distance < minDistance) {
                  minDistance = distance;
                  nearestCube = cube;
                }
              });
              
              if (minDistance < 1.5) {
                setPlacedObjects(placedObjects.filter(obj => obj.id !== nearestCube.id));
              }
            }
          } else {
            onPlaceObject(placePosition);
          }
        }
      } else if (!pressed) {
        triggerPressed.current = false;
      }
    }
  });

  return null;
}

export default function Scene() {
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([]);
  const [selectedTool, setSelectedTool] = useState<'ball' | 'cube' | 'eraser'>('cube');
  const [nextId, setNextId] = useState(0);
  const [bounceValue, setBounceValue] = useState(0.6);
  const [cubeHeight, setCubeHeight] = useState(0.5);
  const [ballHeight, setBallHeight] = useState(2.0);
  const [hoverPosition, setHoverPosition] = useState<Vector3 | null>(null);
  const [showCoordinates, setShowCoordinates] = useState(true);

  const handleGroundClick = (point: Vector3) => {
    if (selectedTool === 'eraser') {
      // Find and remove nearest cube
      const cubes = placedObjects.filter(obj => obj.type === 'cube');
      if (cubes.length > 0) {
        let nearestCube = cubes[0];
        let minDistance = Infinity;
        
        cubes.forEach(cube => {
          const distance = Math.sqrt(
            Math.pow(cube.position[0] - point.x, 2) +
            Math.pow(cube.position[1] - point.y, 2) +
            Math.pow(cube.position[2] - point.z, 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            nearestCube = cube;
          }
        });
        
        // Remove cube if within reasonable distance (1 unit)
        if (minDistance < 1) {
          setPlacedObjects(placedObjects.filter(obj => obj.id !== nearestCube.id));
        }
      }
      return;
    }

    // Place object at clicked position
    const y = selectedTool === 'cube' ? cubeHeight : ballHeight;
    const newObject: PlacedObject = {
      id: `obj-${nextId}`,
      type: selectedTool,
      position: [point.x, y, point.z],
      restitution: selectedTool === 'ball' ? bounceValue : undefined,
    };
    
    setPlacedObjects([...placedObjects, newObject]);
    setNextId(nextId + 1);
  };

  const handleCubeClick = (event: any, cubeId: string) => {
    if (selectedTool === 'eraser') {
      event.stopPropagation();
      setPlacedObjects(placedObjects.filter(obj => obj.id !== cubeId));
    }
  };

  const handlePlaceObject = (position: [number, number, number]) => {
      const newObject: PlacedObject = {
      id: `obj-${nextId}`,
      type: selectedTool === 'eraser' ? 'cube' : selectedTool,
      position,
      restitution: selectedTool === 'ball' ? bounceValue : undefined,
    };
    
    setPlacedObjects([...placedObjects, newObject]);
    setNextId(nextId + 1);
  };

  const generateBall = () => {
    // Generate a ball at a random position above
    const newBall: PlacedObject = {
      id: `ball-${nextId}`,
      type: 'ball',
      position: [
        (Math.random() - 0.5) * 4,
        5,
        (Math.random() - 0.5) * 4,
      ],
      restitution: bounceValue,
    };
    setPlacedObjects([...placedObjects, newBall]);
    setNextId(nextId + 1);
  };

  const clearBalls = () => {
    setPlacedObjects(placedObjects.filter(obj => obj.type !== 'ball'));
  };

  return (
    <div className="relative w-full h-screen">
      <Canvas
        shadows
        gl={{ antialias: true }}
      >
        <XR store={xrStore}>
          <Suspense fallback={null}>
            <PlayerRig />

            <PerspectiveCamera makeDefault position={[5, 5, 5]} />
            <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />

            {/* Lighting */}
            <ambientLight intensity={0.5} />
            <directionalLight
              position={[10, 10, 5]}
              intensity={1}
              castShadow
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
            />

            <Physics gravity={[0, -9.81, 0]}>
              <Ground />
              <ClickableGround
                onGroundClick={handleGroundClick}
                onHover={setHoverPosition}
                mode={selectedTool}
              />

              <XRControllerInteraction
                onPlaceObject={handlePlaceObject}
                selectedTool={selectedTool}
                cubeHeight={cubeHeight}
                ballHeight={ballHeight}
                bounceValue={bounceValue}
                setPlacedObjects={setPlacedObjects}
                placedObjects={placedObjects}
                nextId={nextId}
                setNextId={setNextId}
              />
              
              {/* Placement indicator with X, Y, Z axes */}
              {(selectedTool === 'cube' || selectedTool === 'ball') && (
                <PlacementIndicator
                  position={hoverPosition ? new Vector3(hoverPosition.x, selectedTool === 'cube' ? cubeHeight : ballHeight, hoverPosition.z) : null}
                  visible={showCoordinates && hoverPosition !== null}
                />
              )}
              
              {placedObjects.map((obj) => {
                if (obj.type === 'ball') {
                  return (
                    <Ball
                      key={obj.id}
                      position={obj.position}
                      restitution={obj.restitution ?? bounceValue}
                    />
                  );
                } else {
                  return (
                    <Cube
                      key={obj.id}
                      position={obj.position}
                      onClick={(e: any) => handleCubeClick(e, obj.id)}
                      isEraserMode={selectedTool === 'eraser'}
                    />
                  );
                }
              })}
            </Physics>
          </Suspense>
        </XR>
      </Canvas>

      {/* UI Controls */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-4 shadow-lg">
        <h2 className="text-lg font-bold mb-4">Marble Run Controls</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Select Tool:</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedTool('cube')}
              className={`px-4 py-2 rounded ${
                selectedTool === 'cube'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Place Cube
            </button>
            <button
              onClick={() => setSelectedTool('ball')}
              className={`px-4 py-2 rounded ${
                selectedTool === 'ball'
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Place Ball
            </button>
            <button
              onClick={() => setSelectedTool('eraser')}
              className={`px-4 py-2 rounded ${
                selectedTool === 'eraser'
                  ? 'bg-red-500 text-white'
                  : 'bg-gray-200 text-gray-700'
              }`}
            >
              Erase Cubes
            </button>
          </div>
        </div>
        
        {selectedTool === 'cube' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Cube Height (Y): {cubeHeight.toFixed(2)}m
            </label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={cubeHeight}
              onChange={(e) => setCubeHeight(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        )}

        {selectedTool === 'ball' && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2">
              Ball Height (Y): {ballHeight.toFixed(2)}m
            </label>
            <input
              type="range"
              min="0.1"
              max="8"
              step="0.1"
              value={ballHeight}
              onChange={(e) => setBallHeight(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        )}
        
        
        <div className="mb-4">
          <label className="flex items-center gap-2 text-sm font-medium mb-2 text-black">
            <input
              type="checkbox"
              checked={showCoordinates}
              onChange={(e) => setShowCoordinates(e.target.checked)}
              className="rounded"
            />
            Show X, Y, Z Indicator
          </label>
        </div>
        
        <div className="mb-4">
          <button
            onClick={generateBall}
            className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 mb-2"
          >
            Generate Ball (Random Position)
          </button>
          <button
            onClick={clearBalls}
            className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Clear All Balls
          </button>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">
            Bounce (Restitution): {bounceValue.toFixed(2)}
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={bounceValue}
            onChange={(e) => setBounceValue(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>No Bounce</span>
            <span>Max Bounce</span>
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          {selectedTool === 'eraser' ? (
            <p className="text-red-600 font-medium">Click on cubes to delete them</p>
          ) : (
            <p>Click anywhere on the ground to place {selectedTool === 'cube' ? 'a cube' : 'a ball'}</p>
          )}
          {hoverPosition && (selectedTool === 'cube' || selectedTool === 'ball') && (
            <div className="mt-2 p-2 bg-gray-100 rounded text-xs font-mono">
              <div className="text-red-600">X: {hoverPosition.x.toFixed(2)}</div>
              <div className="text-green-600">Y: {selectedTool === 'cube' ? cubeHeight.toFixed(2) : ballHeight.toFixed(2)}</div>
              <div className="text-blue-600">Z: {hoverPosition.z.toFixed(2)}</div>
            </div>
          )}
          <p className="mt-2">Total Objects: {placedObjects.length}</p>
          <p>Balls: {placedObjects.filter(o => o.type === 'ball').length}</p>
          <p>Cubes: {placedObjects.filter(o => o.type === 'cube').length}</p>
        </div>
      </div>
    </div>
  );
}

