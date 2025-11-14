import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame, useLoader } from '@react-three/fiber'
import { useXRInputSourceState } from '@react-three/xr'
import { Text } from '@react-three/drei'
import * as THREE from 'three'
import { TextureLoader, Shape, EdgesGeometry } from 'three'

// Temp vectors/matrix to avoid allocations in useFrame
const headPos = new THREE.Vector3()
const tmpForward = new THREE.Vector3()
const tmpFlat = new THREE.Vector3()
const panelPos = new THREE.Vector3()
const upVec = new THREE.Vector3(0, 1, 0)
const lookMatrix = new THREE.Matrix4()

/**
 * ObjectPalette - Main component for Feature 3
 * Manages palette UI, button detection, and object selection
 */

interface FurnitureItem {
  id: string
  name: string
  category: 'bed' | 'table' | 'wardrobe' | 'appliances'
  image: string
  hasModel: boolean
  modelPath?: string
}

// Mock furniture data (same as desktop menu)
const furnitureData: FurnitureItem[] = [
  // Bed category
  { id: 'bed', name: 'Bed', category: 'bed', image: '/asset/images/bed.png', hasModel: true, modelPath: '/asset/bed.glb' },
  { id: 'sofa', name: 'Sofa', category: 'bed', image: '/asset/images/sofa.png', hasModel: true, modelPath: '/asset/sofa.glb' },
  { id: 'mattress', name: 'Mattress', category: 'bed', image: '/asset/images/mattress.png', hasModel: false },
  { id: 'bunk-bed', name: 'Bunk Bed', category: 'bed', image: '/asset/images/bunk-bed.png', hasModel: false },
  
  // Table category
  { id: 'round-table', name: 'Round Table', category: 'table', image: '/asset/images/round-table.png', hasModel: true, modelPath: '/asset/round-table.glb' },
  { id: 'table', name: 'Dining Table', category: 'table', image: '/asset/images/table.png', hasModel: true, modelPath: '/asset/s/table.glb' },
  { id: 'coffee-table', name: 'Coffee Table', category: 'table', image: '/asset/images/coffee-table.png', hasModel: false },
  { id: 'desk', name: 'Desk', category: 'table', image: '/asset/images/desk.png', hasModel: false },
  { id: 'side-table', name: 'Side Table', category: 'table', image: '/asset/images/table.png', hasModel: false },
  
  // Wardrobe category
  { id: 'wardrobe-1', name: 'Modern Wardrobe', category: 'wardrobe', image: '/asset/images/bed.png', hasModel: false },
  { id: 'wardrobe-2', name: 'Classic Wardrobe', category: 'wardrobe', image: '/asset/images/bed.png', hasModel: false },
  { id: 'closet', name: 'Closet', category: 'wardrobe', image: '/asset/images/bed.png', hasModel: false },
  { id: 'dresser', name: 'Dresser', category: 'wardrobe', image: '/asset/images/bed.png', hasModel: false },
  
  // Appliances category
  { id: 'tv', name: 'TV', category: 'appliances', image: '/asset/images/tv.png', hasModel: true, modelPath: '/asset/tv.glb' },
  { id: 'refrigerator', name: 'Refrigerator', category: 'appliances', image: '/asset/images/tv.png', hasModel: false },
  { id: 'microwave', name: 'Microwave', category: 'appliances', image: '/asset/images/tv.png', hasModel: false },
  { id: 'washing-machine', name: 'Washing Machine', category: 'appliances', image: '/asset/images/tv.png', hasModel: false },
  { id: 'dishwasher', name: 'Dishwasher', category: 'appliances', image: '/asset/images/tv.png', hasModel: false },
]

type Category = 'all' | 'bed' | 'table' | 'wardrobe' | 'appliances'

interface ObjectPaletteProps {
  isVisible: boolean
  onTogglePalette: () => void
  onSelectTv: () => void
  onSelectBed: () => void
  onSelectSofa: () => void
  onSelectRoundTable: () => void
  onExitDrawMode: () => void
  isDrawMode: boolean
}

export function ObjectPalette({
  isVisible,
  onTogglePalette,
  onSelectTv,
  onSelectBed,
  onSelectSofa,
  onSelectRoundTable,
  onExitDrawMode,
  isDrawMode
}: ObjectPaletteProps) {
  return (
    <>
      {/* Palette UI - 3D panel with tv, bed, sofa, and round-table buttons */}
      <PalettePanel
        visible={isVisible}
        onSelectTv={onSelectTv}
        onSelectBed={onSelectBed}
        onSelectSofa={onSelectSofa}
        onSelectRoundTable={onSelectRoundTable}
      />

      {/* Button input controller - Y to toggle palette, X to exit draw mode */}
      <PaletteController
        onTogglePalette={onTogglePalette}
        onExitDrawMode={onExitDrawMode}
        isDrawMode={isDrawMode}
      />
    </>
  )
}

/**
 * PalettePanel - 3D UI panel with object selection buttons
 * Positioned in front of user when visible
 * Now includes category navigation and grid layout
 */
interface PalettePanelProps {
  visible: boolean
  onSelectTv: () => void
  onSelectBed: () => void
  onSelectSofa: () => void
  onSelectRoundTable: () => void
}

function PalettePanel({ visible, onSelectTv, onSelectBed, onSelectSofa, onSelectRoundTable }: PalettePanelProps) {
  const groupRef = useRef<THREE.Group>(null)
  const positioned = useRef(false)
  const [selectedCategory, setSelectedCategory] = useState<Category>('all')
  const [hoveredItems, setHoveredItems] = useState<Set<string>>(new Set())
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const [scrollOffset, setScrollOffset] = useState(0)

  // Get unique image paths
  const uniqueImages = Array.from(new Set(furnitureData.map(item => item.image)))
  
  // Load all unique textures using useLoader (must be called at top level with all paths)
  const textures = useLoader(TextureLoader, uniqueImages, undefined, (error) => {
    console.error('Failed to load textures:', error)
  })

  // Create texture map
  const textureMap = new Map<string, THREE.Texture>()
  uniqueImages.forEach((imagePath, index) => {
    if (textures[index]) {
      textureMap.set(imagePath, textures[index])
    }
  })

  // Configure textures for proper display
  useEffect(() => {
    textureMap.forEach(texture => {
      if (texture) {
        texture.flipY = true
        texture.needsUpdate = true
      }
    })
  }, [textures])

  // Debug visualization refs
  // const debugGroupRef = useRef<THREE.Group>(null)

  // Reset positioned flag when palette is hidden
  useEffect(() => {
    if (!visible) {
      positioned.current = false
      // Clear debug visualizations
      // if (debugGroupRef.current) {
      //   debugGroupRef.current.clear()
      // }
      // console.log('Resetting position flag - palette hidden (useEffect)')
    }
  }, [visible])

  useFrame((state) => {
    const panel = groupRef.current
    if (!panel || !visible) return

    // Position ONCE when visible becomes true, then keep it anchored
    if (visible && !positioned.current) {
      const camera = state.camera

      // Get head position from matrixWorld
      const position = headPos.setFromMatrixPosition(camera.matrixWorld)
      // console.log('Head position:', position.toArray())

      // Extract forward direction directly from matrixWorld (fixes WebXR bug with getWorldDirection)
      // Column 2 is the Z-axis (forward), negate because Three.js cameras look down -Z
      const forward = tmpForward.setFromMatrixColumn(camera.matrixWorld, 2).negate()
      // console.log('Forward (from matrixWorld):', forward.toArray())

      // Project forward onto horizontal plane so palette stays in front even when looking up/down
      const forwardFlat = tmpFlat.set(forward.x, 0, forward.z)
      // console.log('Forward flat (before guard):', forwardFlat.toArray(), 'lengthSq:', forwardFlat.lengthSq())

      // Guard against zero-vector when looking straight up/down
      if (forwardFlat.lengthSq() < 1e-4) {
        // console.log('Zero-vector detected, using fallback')
        forwardFlat.set(-Math.sin(camera.rotation.y), 0, -Math.cos(camera.rotation.y))
      }
      forwardFlat.normalize()
      // console.log('Forward flat (normalized):', forwardFlat.toArray())

      // Place palette 1.2m in front, slightly below eye level for comfort (larger panel)
      const target = panelPos.copy(position).addScaledVector(forwardFlat, 1.2)
      target.y = position.y - 0.15
      // console.log('Target position:', target.toArray())

      panel.position.copy(target)

      // Make panel face the head (not mimic head rotation)
      lookMatrix.lookAt(target, position, upVec)          // Make panel face the head
      panel.quaternion.setFromRotationMatrix(lookMatrix)  // Panel's +Z now points toward the head
      panel.rotateY(Math.PI)                              // Flip so the front face looks at the user

      // Create debug visualizations - arrows from camera position
      // if (debugGroupRef.current) {
      //   // Clear previous debug lines
      //   debugGroupRef.current.clear()

      //   // Use camera position as origin for arrows (not world origin)
      //   const origin = position.clone()

      //   // 1. Forward direction - YELLOW arrow from head
      //   const arrow1 = new THREE.ArrowHelper(forward.clone().normalize(), origin, 1.5, 0xffff00, 0.2, 0.1)
      //   debugGroupRef.current.add(arrow1)

      //   // 2. Forward flat (projected) - GREEN arrow from head
      //   const arrow2 = new THREE.ArrowHelper(forwardFlat.clone().normalize(), origin, 1.5, 0x00ff00, 0.2, 0.1)
      //   debugGroupRef.current.add(arrow2)

      //   // 3. Target position - RED sphere where palette will be placed
      //   const targetMarker = new THREE.Mesh(
      //     new THREE.SphereGeometry(0.1),
      //     new THREE.MeshBasicMaterial({ color: 0xff0000 })
      //   )
      //   targetMarker.position.copy(target)
      //   debugGroupRef.current.add(targetMarker)

      //   console.log('Debug: Head position:', position.toArray())
      //   console.log('Debug: Forward:', forward.toArray())
      //   console.log('Debug: Forward flat:', forwardFlat.toArray())
      //   console.log('Debug: Target position:', target.toArray())
      // }

      // console.log('Palette positioned!')
      positioned.current = true
    }
  })

  // Reset scroll when category changes
  useEffect(() => {
    setScrollOffset(0)
  }, [selectedCategory])

  // Filter furniture based on selected category
  const filteredFurniture = selectedCategory === 'all' 
    ? furnitureData
    : furnitureData.filter(item => item.category === selectedCategory)

  // Handle thumbstick scrolling - get controllers at top level
  const rightController = useXRInputSourceState('controller', 'right')
  const scrollSpeed = 0.02 // Scroll speed per frame
  
  // Grid constants for scrolling calculation
  const cols = 4
  const itemSize = 0.16
  const labelHeight = 0.04
  const labelGap = 0.02
  const padding = 0.12 // Equal padding from all edges
  
  // Calculate spacing to evenly distribute items (using panel dimensions defined later)
  // These will be recalculated in the render section with actual panel dimensions
  const calculateSpacing = (panelHeight: number, contentWidth: number) => {
    const contentHeight = panelHeight - padding * 2
    const contentWidthInner = contentWidth - padding * 2
    
    // Calculate horizontal spacing for equal gaps
    const totalItemsWidth = itemSize * cols
    const availableWidth = contentWidthInner
    const horizontalGap = (availableWidth - totalItemsWidth) / (cols + 1)
    const spacingX = itemSize + horizontalGap
    
    // Calculate vertical spacing for equal gaps
    const itemTotalHeight = itemSize + labelHeight + labelGap
    const spacingY = itemTotalHeight + (horizontalGap * 0.8) // Use similar gap for vertical, slightly smaller
    
    return { spacingX, spacingY, horizontalGap, contentHeight, contentWidthInner }
  }
  
  useFrame(() => {
    if (!visible || !rightController?.gamepad) return
    
    // Access thumbstick axes - check for both possible gamepad structures
    const gamepad = rightController.gamepad as any
    let thumbstickY = 0
    
    if (gamepad.axes && Array.isArray(gamepad.axes)) {
      thumbstickY = gamepad.axes[1] || 0
    } else if (gamepad['thumbstick-y']) {
      thumbstickY = gamepad['thumbstick-y'].value || 0
    }
    
    if (Math.abs(thumbstickY) > 0.1) { // Dead zone
      // Calculate max scroll based on current filtered items
      const panelHeight = 1.0
      const contentWidth = 1.4 - 0.35
      const { spacingY, contentHeight } = calculateSpacing(panelHeight, contentWidth)
      const maxRows = Math.floor(contentHeight / spacingY)
      const totalRows = Math.ceil(filteredFurniture.length / cols)
      const maxScroll = Math.max(0, (totalRows - maxRows) * spacingY)
      
      // Update scroll offset (invert so up scrolls up)
      const newOffset = scrollOffset - thumbstickY * scrollSpeed
      setScrollOffset(Math.max(0, Math.min(maxScroll, newOffset)))
    }
  })

  const handleItemClick = (item: FurnitureItem) => {
    if (!item.hasModel) return // Don't allow clicking locked items
    
    switch (item.id) {
      case 'tv':
        onSelectTv()
        break
      case 'bed':
        onSelectBed()
        break
      case 'sofa':
        onSelectSofa()
        break
      case 'round-table':
        onSelectRoundTable()
        break
      default:
        console.log('Selected item:', item.name)
    }
  }

  // Helper function to create rounded rectangle shape
  const createRoundedRect = (width: number, height: number, radius: number) => {
    const shape = new Shape()
    const x = -width / 2
    const y = -height / 2
    const w = width
    const h = height
    const r = radius

    shape.moveTo(x + r, y)
    shape.lineTo(x + w - r, y)
    shape.quadraticCurveTo(x + w, y, x + w, y + r)
    shape.lineTo(x + w, y + h - r)
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    shape.lineTo(x + r, y + h)
    shape.quadraticCurveTo(x, y + h, x, y + h - r)
    shape.lineTo(x, y + r)
    shape.quadraticCurveTo(x, y, x + r, y)

    return shape
  }

  // Panel dimensions
  const panelWidth = 1.4
  const panelHeight = 1.0
  const navWidth = 0.35
  const contentWidth = panelWidth - navWidth
  const cornerRadius = 0.04

  // Create rounded rectangle geometries with useMemo to avoid recreating on every render
  const { mainPanelGeometry, navPanelGeometry, contentPanelGeometry } = useMemo(() => {
    const mainPanelShape = createRoundedRect(panelWidth, panelHeight, cornerRadius)
    const mainGeo = new THREE.ShapeGeometry(mainPanelShape)
    
    const navPanelShape = createRoundedRect(navWidth - 0.02, panelHeight - 0.02, cornerRadius * 0.7)
    const navGeo = new THREE.ShapeGeometry(navPanelShape)
    
    const contentPanelShape = createRoundedRect(contentWidth - 0.02, panelHeight - 0.02, cornerRadius * 0.7)
    const contentGeo = new THREE.ShapeGeometry(contentPanelShape)
    
    return {
      mainPanelGeometry: mainGeo,
      navPanelGeometry: navGeo,
      contentPanelGeometry: contentGeo
    }
  }, [panelWidth, panelHeight, navWidth, contentWidth, cornerRadius])

  return (
    <>
      {/* Palette UI - hide with visible prop instead of returning null to ensure cleanup */}
      <group ref={groupRef} visible={visible}>
        {/* Shadow/Depth effect behind panel */}
        <mesh position={[0, -0.005, -0.01]}>
          <planeGeometry args={[panelWidth + 0.02, panelHeight + 0.02]} />
          <meshBasicMaterial color="#000000" opacity={0.3} transparent />
        </mesh>

        {/* Main panel background with rounded corners and subtle gradient effect */}
        <mesh position={[0, 0, 0]} geometry={mainPanelGeometry}>
          <meshBasicMaterial color="#2a2a2a" opacity={0.98} transparent />
        </mesh>

        {/* Border/Outline for main panel */}
        <lineSegments geometry={new EdgesGeometry(mainPanelGeometry)}>
          <lineBasicMaterial color="#3a3a3a" opacity={0.5} transparent />
        </lineSegments>

        {/* Left Navigation Panel Background with rounded corners */}
        <mesh position={[-(panelWidth - navWidth) / 2, 0, 0.002]} geometry={navPanelGeometry}>
          <meshBasicMaterial color="#1a1a1a" opacity={0.98} transparent />
        </mesh>

        {/* Divider line between nav and content */}
        <mesh position={[-(panelWidth - navWidth) / 2 + navWidth / 2, 0, 0.003]}>
          <planeGeometry args={[0.002, panelHeight]} />
          <meshBasicMaterial color="#3a3a3a" opacity={0.6} transparent />
        </mesh>

        {/* Navigation Title with underline */}
        <Text
          position={[-(panelWidth - navWidth) / 2, panelHeight / 2 - 0.12, 0.01]}
          fontSize={0.055}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.004}
          outlineColor="#000000"
          fontWeight="bold"
        >
          Furniture
        </Text>
        {/* Title underline */}
        <mesh position={[-(panelWidth - navWidth) / 2, panelHeight / 2 - 0.16, 0.01]}>
          <planeGeometry args={[navWidth - 0.1, 0.003]} />
          <meshBasicMaterial color="#4a90e2" opacity={0.8} transparent />
        </mesh>

        {/* Category Navigation Buttons */}
        {(['all', 'bed', 'table', 'wardrobe', 'appliances'] as Category[]).map((category, index) => {
          const isActive = selectedCategory === category
          const yPos = panelHeight / 2 - 0.25 - index * 0.12
          
          return (
            <group key={category} position={[-(panelWidth - navWidth) / 2, yPos, 0.01]}>
              {/* Category button background with rounded corners */}
              <mesh
                onClick={() => setSelectedCategory(category)}
                onPointerOver={() => setHoveredCategory(category)}
                onPointerOut={() => setHoveredCategory(null)}
              >
                <shapeGeometry args={[createRoundedRect(navWidth - 0.05, 0.08, 0.015)]} />
                <meshBasicMaterial 
                  color={isActive ? "#4a90e2" : hoveredCategory === category ? "#3a3a3a" : "transparent"}
                  opacity={isActive ? 0.8 : hoveredCategory === category ? 0.5 : 0}
                  transparent
                />
              </mesh>
              {/* Active indicator dot - more prominent */}
              {isActive && (
                <mesh position={[navWidth / 2 - 0.08, 0, 0.002]}>
                  <circleGeometry args={[0.012, 16]} />
                  <meshBasicMaterial color="#ffd700" />
                </mesh>
              )}
              {/* Category label */}
              <Text
                position={[0, 0, 0.003]}
                fontSize={0.036}
                color={isActive ? "#ffffff" : "#cccccc"}
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.002}
                outlineColor="#000000"
                fontWeight={isActive ? "bold" : "normal"}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </Text>
            </group>
          )
        })}

        {/* Right Content Area - Furniture Grid */}
        <group position={[(panelWidth - contentWidth) / 2, 0, 0.01]}>
          {/* Content background with rounded corners */}
          <mesh position={[0, 0, 0.001]} geometry={contentPanelGeometry}>
            <meshBasicMaterial color="#2a2a2a" opacity={0.98} transparent />
          </mesh>

          {/* Furniture items grid - with scrolling */}
          {(() => {
            // Calculate spacing with actual panel dimensions
            const panelHeight = 1.0
            const contentWidth = 1.4 - 0.35 // panelWidth - navWidth
            const { spacingX, spacingY, horizontalGap, contentHeight, contentWidthInner } = calculateSpacing(panelHeight, contentWidth)
            
            return filteredFurniture.map((item, index) => {
              const row = Math.floor(index / cols)
              const col = index % cols
              
              // Calculate positions with equal spacing from edges
              // Start from left edge with padding, then add gaps between items
              const startX = -contentWidthInner / 2 + horizontalGap + itemSize / 2
              const startY = contentHeight / 2 - padding - itemSize / 2
              
              // Position items with calculated spacing
              const x = startX + col * spacingX
              const y = startY - row * spacingY + scrollOffset // Apply scroll offset
            
            // Check if item (including label) is within content bounds
            const itemHalfSize = itemSize / 2
            
            // Bounds checking: ensure item and label stay within content area
            const leftBound = -contentWidthInner / 2
            const rightBound = contentWidthInner / 2
            const topBound = contentHeight / 2 - padding
            const bottomBound = -contentHeight / 2 + padding
            
            if (x - itemHalfSize < leftBound || 
                x + itemHalfSize > rightBound ||
                y + itemHalfSize > topBound ||
                y - itemHalfSize - labelHeight - labelGap < bottomBound) {
              return null
            }
            
            const isHovered = hoveredItems.has(item.id)
            const isLocked = !item.hasModel
            const texture = textureMap.get(item.image)
            
            // Create rounded rectangle for item button
            const itemButtonShape = createRoundedRect(itemSize, itemSize, 0.01)
            const itemButtonGeometry = new THREE.ShapeGeometry(itemButtonShape)
            
            return (
              <group key={item.id} position={[x, y, 0]}>
                {/* Item button background with rounded corners */}
                <mesh
                  onClick={() => handleItemClick(item)}
                  onPointerOver={() => setHoveredItems(prev => new Set(prev).add(item.id))}
                  onPointerOut={() => setHoveredItems(prev => {
                    const next = new Set(prev)
                    next.delete(item.id)
                    return next
                  })}
                  geometry={itemButtonGeometry}
                >
                  <meshBasicMaterial 
                    color={isHovered && !isLocked ? "#4a90e2" : isLocked ? "#1a1a1a" : "#2a2a2a"}
                    opacity={isLocked ? 0.4 : isHovered ? 0.8 : 0.6}
                    transparent
                  />
                </mesh>
                
                {/* Item button border */}
                {!isLocked && (
                  <lineSegments geometry={new EdgesGeometry(itemButtonGeometry)}>
                    <lineBasicMaterial 
                      color={isHovered ? "#6ab0ff" : "#3a3a3a"} 
                      opacity={isHovered ? 0.8 : 0.4} 
                      transparent 
                    />
                  </lineSegments>
                )}
                
                {/* Item icon with rounded background */}
                {texture && (
                  <group position={[0, 0, 0.002]}>
                    {/* Icon background */}
                    <mesh>
                      <shapeGeometry args={[createRoundedRect(itemSize * 0.9, itemSize * 0.9, 0.01)]} />
                      <meshBasicMaterial 
                        color="#1a1a1a" 
                        opacity={0.7} 
                        transparent 
                      />
                    </mesh>
                    {/* Icon - much larger */}
                    <mesh position={[0, 0, 0.001]}>
                      <planeGeometry args={[itemSize * 0.85, itemSize * 0.85]} />
                      <meshBasicMaterial 
                        map={texture}
                        transparent
                        opacity={isLocked ? 0.3 : isHovered ? 1.0 : 0.95}
                      />
                    </mesh>
                  </group>
                )}
                
                {/* Item label with more spacing */}
                <Text
                  position={[0, -itemSize / 2 - labelGap - labelHeight / 2, 0.003]}
                  fontSize={0.026}
                  color={isLocked ? "#666666" : isHovered ? "#ffffff" : "#cccccc"}
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.003}
                  outlineColor="#000000"
                  maxWidth={itemSize * 1.2}
                  fontWeight={isHovered ? "bold" : "normal"}
                >
                  {item.name}
                </Text>
              </group>
            )
            })
          })()}
        </group>
      </group>
    </>
  )
}

/**
 * PaletteController - Handles Y and X button input detection
 * Y button: Toggle palette visibility
 * X button: Exit draw mode
 */
interface PaletteControllerProps {
  onTogglePalette: () => void
  onExitDrawMode: () => void
  isDrawMode: boolean
}

function PaletteController({ onTogglePalette, onExitDrawMode, isDrawMode }: PaletteControllerProps) {
  const leftController = useXRInputSourceState('controller', 'left')
  const previousYState = useRef(false)
  const previousXState = useRef(false)

  useFrame(() => {
    if (!leftController?.gamepad) return

    // Y button detection for palette toggle
    const yButton = leftController.gamepad['y-button']
    const isYPressed = yButton?.state === 'pressed'

    // Edge detection: trigger only on press (false → true transition)
    if (isYPressed && !previousYState.current) {
      // console.log('Y button pressed - toggling palette')
      onTogglePalette()
    }
    previousYState.current = isYPressed

    // X button detection for exiting draw mode (only active in draw mode)
    if (isDrawMode) {
      const xButton = leftController.gamepad['x-button']
      const isXPressed = xButton?.state === 'pressed'

      // Edge detection: trigger only on press (false → true transition)
      if (isXPressed && !previousXState.current) {
        // console.log('X button pressed - exiting draw mode')
        onExitDrawMode()
      }
      previousXState.current = isXPressed
    } else {
      // Reset X button state when not in draw mode
      previousXState.current = false
    }
  })

  return null
}
