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
    - Position mode
- Toggle between the modes by using the ‘A’ button on right controller
- The default mode is rotate mode
- We will implement the modes one by one

### Rotate mode behaviour

- A single axis appears centred on the object when object is in rotate mode.
- The axes should look like normal 3D axes rays
- The axis appears perpendicular to the plane on which the object is placed
- The axis color needs to be yellow for rotate mode
- Object can only be rotated along this axis
    - In technical terms the rotation is being done around the axis which is perpendicular to the plane but the visual effect is that the object stays attached to the plane at its base
- The axes need to be always be visible even if the object is bigger than the axes (axis length must change size of object but there must be a minimum length of 0.5m)
- Rotation is done by pointing at the axis and holding the grip button
    - Holding and dragging up (positive direction of the axis) rotates the object counter clockwise when viewed from above the axis
    - Holding and dragging down (negative direction of the axis) rotates the object clockwise when viewed from above the axis

### Scale mode behaviour

- A single axis appears centred on the object when object is in rotate mode.
- The axes should look like normal 3D axes rays
- The axis appears perpendicular to the plane on which the object is placed
- The axis color needs to be green for scale mode
- The axes need to be always be visible even if the object is bigger than the axes (axis length must change size of object but there must be a minimum length of 0.5m)
- Scaling is done by pointing at the axis and holding the grip button
    - Holding and dragging up (positive direction of the axis) increases the size
    - Holding and dragging down (negative direction of the axis) decreases the size
- The dimension ratio is to be maintained at the original ratio when scaling. So all dimensions are scaled equally.

### Position mode behaviour

- Two perpendicular axes appear centred on the selected objected
- The axes correspond to the x and y direction of the plane in which the object was created
    - This means the axes are parallel to the plane of creation (not global X and Y)
- The axes should look like normal 3D axes rays
- The axis color should be red for position mode
- Moving a created object is only allowed along the plane in which it was created
- The axes need to be always be visible even if the object is bigger than the axes (axis length must change size of object but there must be a minimum length of 0.5m)
- On pointing at any axis using controller and holding with the grip button, I should be able to drag the object up and down that axis by moving my hand along the direction of that axis
- The object moves in the direction my hand moves
- For example
    - An object is created on the wall
    - On selecting that object, X and Y axes appear centred on that object, parallel to the wall plane
    - I can point at X axis, click and hold grip button to drag along the direction of the axis to move the object