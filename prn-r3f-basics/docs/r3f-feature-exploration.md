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
- An object is selected from the palette by pointing with controller and clicking trigger button on the right or left controller. For this pointing we need rays coming out of the controller.
- Once object is selected, we are in draw mode and the cursor becomes visible for placing the object (cursor should not be visible when not in draw mode)
- Selected Object is added to the world by pressing the trigger on the controller when in draw mode.
- The object is created at the cursor exactly like feature 2 implementation. The base of the object is on the plane and it is placed on the side of the plane facing the user
- Exit draw mode by pressing X on left controller

## Feature 4 - Object selection and changing scale, position and rotation

- In this feature I want to add the ability to change the position, scale and rotation of the created objects
- Pointing at created objects and pressing trigger selects an object (requires rays from the controller to be always present to select objects in the scene)
- There are 3 modes for a selected object corresponding to the 3 transformations
    - position mode
    - Scale mode
    - rotation mode
- Toggle between the modes by using the ‘A’ button on right controller
- Pointing anywhere else (not on any created object) and clicking trigger deselects the object currently selected object
- pressing ‘B’ on right controller deletes the selected object

### Position mode behaviour

- The axes should look like normal 3D axes rays
- Only two axes should appear, which correspond to the x and y direction of the plan in which the object was created. Moving a created object is only allowed along the plane in which it was created
- The axes need to be always be visible even if the object is bigger than the axes (axis length must change with a min length)
- On pointing at any axis using controller and holding with the grip button, I should be able to drag the object up and down that axis by moving my hand in the up or down direction of that axis
- For example
    - An object is created on the wall
    - On selecting that object, X and Y axes appear centred on that object, parallel to the wall plane
    - I can point at X axis, click and hold grip button to drag along the direction of the axis to move the object

### Scale mode behaviour

- The axes should look like normal 3D axes rays
- There is only one axes that appears in scale mode and it appears perpendicular to the plane on which the object is placed
- The axes need to be always be visible even if the object is bigger than the axes (axis length must change with a min length)
- On pointing at the axis using controller and holding with the grip button, I should be able to drag up and down along the axis to increase or decrease the size of the object
- The aspect ratio is to be maintained at the original ratio when scaling. So all dimensions are scaled equally.

### Rotate mode behaviour

- The axes should look like normal 3D axes rays
- There is only one axes that appears in scale mode and it appears perpendicular to the plane on which the object is placed
- Object can only be rotated along this axis
    - In technical terms the rotation is being done around the axis which is perpendicular to the plane but the visual effect is that the object stays attached to the plane at its base
- The axes need to be always be visible even if the object is bigger than the axes (axis length must change with a min length)
- On pointing at the axis using controller and holding with the grip button, I should be able to drag up and down along the axis to rotate clockwise and counter clock wise respectively