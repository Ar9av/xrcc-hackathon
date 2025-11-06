# React 3 fiber features exploration

The objective of this project is to build basic features to explore and understand how react three fiber works. We will build proof of concept implementations of some features and document the learnings

## Feature 1 - Physics for object interaction with each other and player

- Currently there are 4 cubes placed in the scene
- I want you to make all those cubes rigid so that the stay in place and other objects cannot pass through them
- Now add some small balls to the space that are solid but I should be able to pick up the balls and throw them with physics. The balls should not fall through the floor.
- Pick up/hold mechanic - this should work when I press the grip button on the left or right controller. I should be able to pick up and throw the balls by doing the throwing action and releasing the grip button.
- The balls should collide with the cubes bounce naturally with all the

## Feature 2 - New object creation and object  palette

- Goal of this feature is to give the user the ability to open an object palette to select an object and then create new objects in the world
- The object palette provides two object types
    - Block - a simple cube
    - Plank - a long cuboid in the shape of a plank
- The object palette is opened by pressing the ‘Y’ button on the left controller. Pressing Y again closes the palette
- An object is selected from the palette by pointing with controller and clicking trigger button on the right or left controller. For this pointing we need rays coming out of the controller.
- Once object is selected, we are in draw mode and the object palette is closed.
- Selected Object is added to the world by pressing the trigger on the controller when in draw mode. The object is created at the position of the controller on which the trigger is clicked
- Exit draw mode by pressing X on left controller

## Feature 3 - Object scale, position and rotation change

- In this feature I want to add the ability to change the position, scale and rotation of the created objects
- Pointing and pressing trigger selects an object
- There are 3 modes for a selected object corresponding to the 3 transformations
    - position mode
    - Scale mode
    - rotation mode
- Toggle between the modes by using the ‘A’ button on right controller
- In the selected state, there needs to be axes appearing on the object centre (similar to axes appearing on objects selected in unity or any other 3D software)
- Pointing anywhere else and clicking deselects the object

### Position mode behaviour

- The axes should look like normal 3D axes
- The axis orientation is relative to the environment. This means X, Y and Z directions are fixed regardless of how the object is rotated
- The axes need to be always be visible even if the object is bigger than the axes
- On pointing at any axis using controller and clicking with the trigger button, I should be able to drag the object up and down that axis by moving my hand in the up or down direction of that axis

### Scale mode behaviour

- The axes should look like normal 3D axes
- The axis orientation is relative to the Object. This means X, Y and Z directions change as the object is rotated
- The initial orientation of the axis should be in the X,Y and Z direction of the block objects
- The axes need to be always be visible even if the object is bigger than the axes
- On pointing at any axis using controller and clicking with the trigger button, I should be able to change the size of the object along that access by dragging up or down (up increases and down decreases size)

### Rotate mode behaviour

- The axes should look like circular access typically used in something like unity rotate tool
- The axis orientation is relative to the environment. This means X, Y and Z directions are fixed regardless of how the object is rotated
- The axes need to be always be visible even if the object is bigger than the axes
- On pointing at any axis using controller and clicking with the trigger button, I should be able to rotate the object along that access by dragging up or down (up rotates clockwise and down rotates anti clockwise)