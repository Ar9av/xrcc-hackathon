# Controller guide UI tool tip

# Controller guide UI tool tip feature

## Objective

- Currently there are many functions in this app but the user does not have any guidance on how to use the app
- The objective is to add some UI tool tips which are anchored to the controllers so that any time the user looks at the controller, they know what each button does

## Requirements

- A static text tool tip should be present in front of the controller visualisation
- The tooltip must have dark grey translucent background with white text
- The tooltip text varies for different states/modes of the app. The details of the text are written in the table below

| State | Left controller tool tip | Right controller tool tip |
| --- | --- | --- |
| Default state (not in object selected state or object palette) | Y - open object palette | no tool tip |
| Object palette open state | LT - select object | RT - select object |
| Draw mode | LT - place object | RT - place object |
| Object selected - rotate mode | Thumb stick left/right - rotate<br>Y - open object palette | Thumb stick left/right - rotate<br>A - toggle mode<br>B - delete object |
| Object selected - scale mode | Thumb stick forward - increase size<br>Thumb stick back - decrease size<br>Y - open object palette | Thumb stick forward - increase size<br>Thumb stick back - decrease size<br>A - toggle mode<br>B - delete object |
| Object selected - move mode | Grip hold + drag - move object<br>Y - open object palette | Grip hold + drag - move object<br>A - toggle mode<br>B - delete object |