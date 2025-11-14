import { useState } from 'react'
import './DesktopFurnitureMenu.css'

interface FurnitureItem {
  id: string
  name: string
  category: 'bed' | 'table' | 'wardrobe' | 'appliances'
  image: string
  hasModel: boolean
  modelPath?: string
}

// Mock furniture data
const furnitureData: FurnitureItem[] = [
  // Bed category
  { id: 'bed', name: 'Bed', category: 'bed', image: '/asset/images/bed.png', hasModel: true, modelPath: '/asset/bed.glb' },
  { id: 'sofa', name: 'Sofa', category: 'bed', image: '/asset/images/sofa.png', hasModel: true, modelPath: '/asset/sofa.glb' },
  { id: 'mattress', name: 'Mattress', category: 'bed', image: '/asset/images/bed.png', hasModel: false },
  { id: 'bunk-bed', name: 'Bunk Bed', category: 'bed', image: '/asset/images/bed.png', hasModel: false },
  
  // Table category
  { id: 'round-table', name: 'Round Table', category: 'table', image: '/asset/images/round-table.png', hasModel: true, modelPath: '/asset/round-table.glb' },
  { id: 'table', name: 'Dining Table', category: 'table', image: '/asset/images/table.png', hasModel: true, modelPath: '/asset/s/table.glb' },
  { id: 'coffee-table', name: 'Coffee Table', category: 'table', image: '/asset/images/table.png', hasModel: false },
  { id: 'desk', name: 'Desk', category: 'table', image: '/asset/images/table.png', hasModel: false },
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

interface DesktopFurnitureMenuProps {
  onSelectTv: () => void
  onSelectBed: () => void
  onSelectSofa: () => void
  onSelectRoundTable: () => void
  onCancelSelection: () => void
  selectedObjectType: 'tv' | 'bed' | 'sofa' | 'round-table' | null
}

export function DesktopFurnitureMenu({
  onSelectTv,
  onSelectBed,
  onSelectSofa,
  onSelectRoundTable,
  onCancelSelection,
  selectedObjectType
}: DesktopFurnitureMenuProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>('all')

  // Filter furniture based on selected category
  const filteredFurniture = selectedCategory === 'all' 
    ? furnitureData // Show all items in "all"
    : furnitureData.filter(item => item.category === selectedCategory) // Show all items in selected category

  const handleItemClick = (item: FurnitureItem) => {
    // Map furniture items to existing handlers
    switch (item.id) {
      case 'tv':
        if (selectedObjectType === 'tv') {
          onCancelSelection()
        } else {
          onSelectTv()
        }
        break
      case 'bed':
        if (selectedObjectType === 'bed') {
          onCancelSelection()
        } else {
          onSelectBed()
        }
        break
      case 'sofa':
        if (selectedObjectType === 'sofa') {
          onCancelSelection()
        } else {
          onSelectSofa()
        }
        break
      case 'round-table':
        if (selectedObjectType === 'round-table') {
          onCancelSelection()
        } else {
          onSelectRoundTable()
        }
        break
      default:
        // For items without handlers, just log for now
        console.log('Selected item:', item.name)
    }
  }

  const getSelectedItemId = () => {
    switch (selectedObjectType) {
      case 'tv': return 'tv'
      case 'bed': return 'bed'
      case 'sofa': return 'sofa'
      case 'round-table': return 'round-table'
      default: return null
    }
  }

  return (
    <div className="desktop-furniture-menu">
      {/* Left Navigation Panel */}
      <div className="menu-nav">
        <h3 className="nav-title">Furniture</h3>
        <nav className="nav-list">
          <button
            className={`nav-item ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            All
          </button>
          <button
            className={`nav-item ${selectedCategory === 'bed' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('bed')}
          >
            Bed
          </button>
          <button
            className={`nav-item ${selectedCategory === 'table' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('table')}
          >
            Table
          </button>
          <button
            className={`nav-item ${selectedCategory === 'wardrobe' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('wardrobe')}
          >
            Wardrobe
          </button>
          <button
            className={`nav-item ${selectedCategory === 'appliances' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('appliances')}
          >
            Appliances
          </button>
        </nav>
      </div>

      {/* Right Content Panel */}
      <div className="menu-content">
        <div className="content-items">
          {filteredFurniture.length > 0 ? (
            filteredFurniture.map((item) => {
              const isSelected = getSelectedItemId() === item.id
              const isLocked = !item.hasModel
              return (
                <button
                  key={item.id}
                  className={`content-item ${isSelected ? 'selected' : ''} ${isLocked ? 'locked' : ''}`}
                  onClick={() => !isLocked && handleItemClick(item)}
                  disabled={isLocked}
                  title={isLocked ? `${item.name} (Coming soon)` : isSelected ? 'Cancel Selection' : `Place ${item.name}`}
                >
                  <div className="item-icon-container">
                    <img src={item.image} alt={item.name} className="item-icon" />
                  </div>
                  <span className="item-name">{item.name}</span>
                </button>
              )
            })
          ) : (
            <div className="empty-state">
              <p>No furniture available in this category</p>
            </div>
          )}
        </div>
        {selectedObjectType && (
          <div className="menu-hint">
            Click on the ground to place {selectedObjectType}
          </div>
        )}
      </div>
    </div>
  )
}

