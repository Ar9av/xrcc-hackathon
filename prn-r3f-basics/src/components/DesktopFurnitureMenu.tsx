import './DesktopFurnitureMenu.css'

interface DesktopFurnitureMenuProps {
  onSelectTable: () => void
  onSelectBed: () => void
  onSelectSofa: () => void
  onSelectRoundTable: () => void
  onCancelSelection: () => void
  selectedObjectType: 'table' | 'bed' | 'sofa' | 'round-table' | null
}

export function DesktopFurnitureMenu({
  onSelectTable,
  onSelectBed,
  onSelectSofa,
  onSelectRoundTable,
  onCancelSelection,
  selectedObjectType
}: DesktopFurnitureMenuProps) {
  return (
    <div className="desktop-furniture-menu">
      <div className="menu-header">
        <h3>Place Furniture</h3>
      </div>
      <div className="menu-items">
        <button
          className={`menu-item ${selectedObjectType === 'table' ? 'selected' : ''}`}
          onClick={selectedObjectType === 'table' ? onCancelSelection : onSelectTable}
          title={selectedObjectType === 'table' ? 'Cancel Selection' : 'Place Table'}
        >
          <div className="icon-container">
            <img src="/asset/images/table.png" alt="Table" className="furniture-icon" />
          </div>
          <span className="item-label">Table</span>
        </button>
        
        <button
          className={`menu-item ${selectedObjectType === 'bed' ? 'selected' : ''}`}
          onClick={selectedObjectType === 'bed' ? onCancelSelection : onSelectBed}
          title={selectedObjectType === 'bed' ? 'Cancel Selection' : 'Place Bed'}
        >
          <div className="icon-container">
            <img src="/asset/images/bed.png" alt="Bed" className="furniture-icon" />
          </div>
          <span className="item-label">Bed</span>
        </button>
        
        <button
          className={`menu-item ${selectedObjectType === 'sofa' ? 'selected' : ''}`}
          onClick={selectedObjectType === 'sofa' ? onCancelSelection : onSelectSofa}
          title={selectedObjectType === 'sofa' ? 'Cancel Selection' : 'Place Sofa'}
        >
          <div className="icon-container">
            <img src="/asset/images/sofa.png" alt="Sofa" className="furniture-icon" />
          </div>
          <span className="item-label">Sofa</span>
        </button>
        
        <button
          className={`menu-item ${selectedObjectType === 'round-table' ? 'selected' : ''}`}
          onClick={selectedObjectType === 'round-table' ? onCancelSelection : onSelectRoundTable}
          title={selectedObjectType === 'round-table' ? 'Cancel Selection' : 'Place Round Table'}
        >
          <div className="icon-container">
            <img src="/asset/images/round-table.png" alt="Round Table" className="furniture-icon" />
          </div>
          <span className="item-label">Round Table</span>
        </button>
      </div>
      {selectedObjectType && (
        <div className="menu-hint">
          Click on the ground to place {selectedObjectType}
        </div>
      )}
    </div>
  )
}

