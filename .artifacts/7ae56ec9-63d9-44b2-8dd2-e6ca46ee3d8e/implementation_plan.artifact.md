# Implementation Plan - UI Refinement for Main Menu and Character Selection

Refine the game's UI to provide a more polished, modern, and mobile-first experience by redesigning the Main Menu and Character Selection screens.

## Proposed Changes

### Main Game Menu Redesign

- [MODIFY] [GameUI.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/ui/GameUI.jsx)
    - Remove the 3D character preview from the `MainMenu` component.
    - Adjust the layout of `MainMenu` to focus on the title and play button.
    - Reposition the secondary action buttons (Guide, Characters, Settings, Quit) for better balance.
    - Ensure the wooden title banner remains a central visual element.

### Character Selection Redesign

- [MODIFY] [GameUI.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/ui/GameUI.jsx)
    - **Proportions**: Increase the scale of the character model in `CharacterSelectModal`.
    - **Navigation**: Shrink the left/right navigation arrow buttons to be less intrusive.
    - **Typography**: Reduce the size of the character name badge and use a cleaner, more readable font style.
    - **Hierarchy**: Improve the visual weight of elements to draw focus to the character.
    - **Responsive Layout**: Adjust padding and margins to ensure the layout feels balanced on various mobile screen sizes.
    - **Visual Feedback**: Enhance the "stage" effect for the selected character.

## Verification Plan

### Automated Tests
- This is a UI-heavy change in JSX, so manual verification on a device or emulator is preferred.

### Manual Verification
- Launch the game and verify the Main Menu is clean and character-free.
- Open the Character Selection screen and verify:
    - Character model is larger and more prominent.
    - Arrow buttons are smaller.
    - Character name is smaller and cleaner.
    - Layout is responsive and well-aligned.
    - Feedback on selection (e.g., animations or highlights) is clear.
