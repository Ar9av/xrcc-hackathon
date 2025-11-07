# Marble Run Development Tasks

## MVP (Minimum Viable Product) - ✅ Completed

### Phase 1: Project Setup
- [x] Create Next.js project structure with TypeScript
- [x] Install React Three Fiber and dependencies
- [x] Install physics engine (@react-three/cannon)
- [x] Set up basic project structure

### Phase 2: Core Components
- [x] Create Scene component with Canvas setup
- [x] Implement Ball component with physics (gravity, collision)
- [x] Implement Cube component with physics (static objects)
- [x] Create Ground plane for physics simulation
- [x] Set up lighting and camera controls

### Phase 3: User Interactions
- [x] Add UI controls panel
- [x] Implement tool selection (cube vs ball vs eraser)
- [x] Add click-to-place functionality (works anywhere on ground)
- [x] Add "Generate Ball" button for random ball generation
- [x] Configure physics properties (restitution, friction)
- [x] Add bounce control slider (0-1 range)
- [x] Add "Clear All Balls" functionality
- [x] Add cube eraser tool (click to delete cubes)
- [x] Add X, Y, Z coordinate display (visual indicator + numerical)
- [x] Add height slider for cube placement (0-5m range)

### Phase 4: Basic Features
- [x] Ball falls with gravity
- [x] Ball and cube collision detection
- [x] Physics interactions between objects
- [x] Visual feedback (shadows, materials)
- [x] Dynamic bounce control (affects newly created balls)

### Phase 4.5: WebXR Support
- [x] Install @react-three/xr package
- [x] Add XR store and wrap Canvas with XR component
- [x] Add PlayerRig for VR locomotion (head-relative movement)
- [x] Add VR/AR entry buttons (Enter VR, Enter AR, Exit XR)
- [x] Implement controller interaction for placing objects
- [x] Controller trigger to place/erase objects in VR

## Future Enhancements 🚀

### Phase 5: Advanced Physics
- [ ] Add velocity control for balls
- [ ] Implement different ball sizes
- [ ] Add different cube sizes
- [ ] Create dynamic cubes (can be moved/destroyed)
- [ ] Add rotation controls for placed objects

### Phase 6: Enhanced Interactions
- [ ] Drag and drop objects
- [x] Delete objects on click (eraser tool implemented)
- [ ] Undo/redo functionality
- [ ] Object properties panel (mass, restitution, etc.)
- [ ] Grid snapping for precise placement

### Phase 7: Visual Improvements
- [ ] Better materials and textures
- [ ] Particle effects on collisions
- [ ] Trail effects for moving balls
- [ ] Environment map/reflections
- [ ] Better lighting setup (HDR, shadows)

### Phase 8: Gameplay Features
- [ ] Goal/target system
- [ ] Score tracking
- [ ] Time limits
- [ ] Multiple ball types (different properties)
- [ ] Obstacle types (ramps, walls, etc.)

### Phase 9: Save/Load System
- [ ] Save scene configurations
- [ ] Load saved configurations
- [ ] Export/import functionality
- [ ] Share links

### Phase 10: Performance & Optimization
- [ ] Object pooling for balls
- [ ] LOD (Level of Detail) for distant objects
- [ ] Culling optimization
- [ ] Performance monitoring

---

## Current Status
**MVP Complete + Enhancements!** ✅

The marble run is functional with:
- Ball generation with gravity
- Cube placement anywhere on the ground (fixed click detection)
- Physics interactions
- Bounce control slider (0-1 range)
- Clear all balls button
- Enhanced UI controls with object counts

**Recent Updates:**
- ✅ Fixed cube placement to work anywhere on the ground plane
- ✅ Added bounce/restitution slider for controlling ball bounciness
- ✅ Added "Clear All Balls" button to remove all balls while keeping cubes
- ✅ Added cube eraser tool - click on cubes to delete them
- ✅ Added X, Y, Z coordinate display with visual indicator (colored axes) and numerical display
- ✅ Added height slider for cube placement (0-5m range) - cubes can now be placed at different heights
- ✅ **WebXR Support Added!** - Full VR/AR compatibility with controller interactions
  - Enter VR/AR modes with dedicated buttons
  - VR locomotion with left controller thumbstick (head-relative movement)
  - Right controller trigger to place objects in VR
  - Snap rotation with right thumbstick (45-degree increments)

Ready for testing and further enhancements!

