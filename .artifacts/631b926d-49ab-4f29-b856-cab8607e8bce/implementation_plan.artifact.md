# Implementation Plan - Update Game Menu Buttons with Local Assets

This plan outlines the steps to replace the current game menu buttons and icons with the new high-quality local assets provided in `public/ui-buttons/`. We will also ensure the layout is clean and free of overlapping elements.

## User Review Required

> [!IMPORTANT]
> The new buttons are PNG images that likely contain their own styling (text, shadows, icons). Using them directly instead of `GameButton` will change the interactive feel unless we add transition/active effects.

## Proposed Changes

### UI Assets & Components

#### [MODIFY] [GameUI.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/ui/GameUI.jsx)
- **MainMenu Component**:
    - Replace the "PLAY NOW" `GameButton` with an image-based button using `/ui-buttons/play-button.png`.
    - Replace the bottom row of buttons (Guide, Characters, Settings, Quit) with their respective local PNG assets:
        - Guide: `/ui-buttons/how-to-play-button.png`
        - Characters: `/ui-buttons/character-button.png`
        - Settings: `/ui-buttons/settings-button.png`
        - Quit: `/ui-buttons/quit-button.png`
    - Apply hover and active scale/translation effects to maintain the "game-like" feel.
    - Adjust the `gap` and `padding` to prevent overlapping on smaller screens.
- **GameHUD Component**:
    - Update `menuIcon` and `taskIcon` to use the local assets:
        - `menuIcon`: `/ui-buttons/settings-button.png` (or keep existing if no direct replacement)
        - `taskIcon`: `/ui-buttons/task-list-button.png`
    - Adjust sizes as the new assets might be larger than the previous icons.

## Verification Plan

### Manual Verification
- Launch the game and check the `MainMenu`.
- Verify all buttons point to the correct new assets.
- Test the game on different screen sizes (simulated) to ensure no overlapping.
- Check the `GameHUD` during gameplay to see the new task list button.
- Confirm that the buttons are still interactive (clickable).
