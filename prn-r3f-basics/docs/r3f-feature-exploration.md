# React 3 fiber features exploration

The objective of this project is to build basic features to explore and understand how react three fiber works. We will build proof of concept implementations of some features and document the learnings

## Feature 1 - Physics for object interaction with each other and player

- Currently there are 4 cubes placed in the scene
- I want you to make all those cubes rigid so that the stay in place and other objects cannot pass through them
- Now add some small balls to the space that are solid but I should be able to pick up the balls and throw them with physics. The balls should not fall through the floor.
- Pick up/hold mechanic - this should work when I press the grip button on the left or right controller. I should be able to pick up and throw the balls by doing the throwing action and releasing the grip button.
- The balls should collide with the cubes bounce naturally with all the

## Feature 2 - placing objects on planes detected in AR

- Exact example implementation which detects the objects/planes in AR and places objects on it has been included in prn-r3f-basics/docs/ar-example.html
- The goal is to implement the exact same experience like the above example
    - A cursor at the position where detected plane intersects with line of sight of headset user
    - Pressing trigger places an object at that position on that plan
- For the sake of this example, the object can just be a simple pyramid
- Make sure the object is placed on the plane on the side facing the user
    - so the pyramid must point to the user wearing headset.
    - The base of the pyramid must be on the plane
- Meta’s documentation - https://developers.meta.com/horizon/documentation/web/webxr-mixed-reality#plane-detection

## Feature 3 - Object palette

- Goal of this feature is to give the user the ability to open an object palette to select an object and which they can use to add to the world using feature 2
- The object palette provides two object types
    - Block - a simple cube
    - Pyramid - a simple pyramid
- The object palette is opened by pressing the ‘Y’ button on the left controller. Pressing Y again closes the palette
- The palette appears in front of the user wearing headset. The position can be fixed after it appears. Does not need any dynamic tracking of headset. Position only changes if the palette is closed and re-opened.
- An object is selected from the palette by pointing with controller and clicking trigger button on the right or left controller. For this pointing we need rays coming out of the controller.
- Once object is selected, we are in draw mode and the cursor becomes visible for placing the object (cursor should not be visible when not in draw mode)
- Selected Object is added to the world by pressing the trigger on the controller when in draw mode.
- The object is created at the cursor exactly like feature 2 implementation. The base of the object is on the plane and it is placed on the side of the plane facing the user
- Exit draw mode by pressing X on left controller

## Feature 4 - Object selection and modification

- In this feature I want to add the ability to
    - Select an object that has been created
    - Delete selected object
    - Rotate the object
    - Change the size (scale) the object
    - change the position

## 4.1 Object Selection and deleting an object

- Pointing at created objects and pressing trigger button selects an object
- For pointing we have already implemented object
- Visual feedback for currently selected object is based on the “axes” that appear for the modification. This will be implemented in next section.
- Pointing anywhere else (that is not on any created object) and clicking trigger deselects the object currently selected object
- pressing ‘B’ on right controller deletes the currently selected object

## 4.2 Modifying an object

- There are 3 modes for modifying an object
    - Rotate mode
    - Scale mode
    - Move mode
- Toggle between the modes by using the ‘A’ button on right controller
- The default mode is rotate mode
- We will implement the modes one by one
- Now that we are implementing these edit modes, we can remove the existing yellow wireframe visualisation for selected object from feature 4.1
- While we are implementing modes one by one, the toggle button should toggle only between all the modes that have been implemented so far.

### Rotate mode behaviour

Visual description 

- A flat ring (ringGeometry) appears centred on the object when object is in rotate mode. The ring should be big enough to completely surround the object
- The ring is parallel to the plane on which object is placed but vertically in the middle of the object’s height
- The ring is yellow in colour
- The ring need to be always be visible even if the object is bigger than the axes (the ring must scale with the size of the object. This will be important once we implement scale mode)

Rotation behaviour details

- Object can only be rotated parallel to the plane on which the object is placed
- Rotation is done by moving the right or left thumb stick
    - Holding the thumb stick to the right rotates the object clock wise as seen from above (positive Y direction of the plane on which object is placed)
    - Holding the thumb stick to the left rotates the object counter clock wise as seen from above (positive Y direction of the plane on which object is placed)
- Rotation sensitivity
    - The rotation is smooth and real time as the thumb stick is pushed and held in either direction
    - The rotation speed is 30 degrees per second

### Scale mode behaviour

Visual description

- A slider component appears above the object in scale mode
- The slider can be simulated as a thin cone (coneGeometry) with a torus (torusGeometry) that moves along the cone as the slider that signifies changing size
- The cone is 1 meter in length, 20cm in diameter at the base
- The torus has a dynamic inner diameter which changes as it slides up and done the cone.
    - inner diameter =  x * cone_diameter/cone_height where x is the distance of the torus centre from the tip of the cone. Distance from tip can be calculated as cone_height - (distance from base)
    - Outer diameter of torus is always inner diameter + 20cm (meaning the torus is 10 cm thick)
- Cone is light green in color and the torus is dark green in color
- This slider component always appears above the selected object in terms of local coordinates of the object (about 30 cm above)
- But the orientation of the slider is always along the global Y axis with the tip of the cone pointing down and base pointing up.
- The torus always starts at the middle of the cone

Scaling behaviour details

- Scaling is done by moving the right or left thumb stick
    - Holding thumb stick forward increases the size
    - Holding thumb stick backwards decreases the size
- The dimension ratio is to be maintained at the original ratio when scaling. So all dimensions are scaled equally.
- The torus moves up (towards the base of the cone) when increasing size and moves down to the tip when decreasing size.
- The torus stops at maximum scale at the base of the cone and at minimum scale at the tip of the cone
- The maximum increase in size allowed is 25% above the default rendering scale and the minimum is 25% below the default scale with which it is getting rendered right now
- Slider sensitivity should be such that it moves from minimum to maximum position in 4 seconds
- The position of the slider (cone+torus) must change as the size of the object changes so that slider doesn’t get hidden
- The scaling should smooth and real time as the slider moves

### Move mode behaviour

Visual description

- Two perpendicular axes appear centred on the selected objected.
- The axes correspond to the x and y direction of the plane in which the object was created
    - This means the axes are parallel to the plane of creation (not global X and Y)
    - The rotation of the axis can be relative to the object’s orientation (X and Y needs to be along the object’s local X and Y)
    - But the axes are not on the plane, they are vertically in the middle of the object’s height on that plane
- The axes should look like normal 3D axes rays (line + cone at the end)
- The axis color should be red
- The axis position must move along with the object while it is moved so that it always stays centred
- The axes must be big enough to be visible beyond the object’s X and Y dimension
- The axes must scale with object size so that they are always visible

Move behaviour

- Moving a created object is only allowed along the plane in which it was created
- How to move an object
    - When in move mode, hold the grip button and drag your hand along the X and Y axis shown in move mode (local to object’s x and y)
    - Both X and Y components of hand movement along the X and Y axis are translated to object movement along those axes
    - on leaving the grip button the object stops moving but remains in move mode
- The distance to move the object along each axis is determined by the distance of hand from the point where the grip button was pressed along the plane of the object
- For example
    - An object is created on the wall
    - On selecting that object, X and Y axes appear centred on that object, parallel to the wall plane
    - I can hold the grip button to drag along the X axis that appeared to move the object to along that axis
- The moving should be smooth and real time with the movement of the hand