# Refine and Fix Game Menu UI

This plan aims to professionalize the Game Menu UI by fixing overlapping elements, improving the visual design, and matching the "Character Selection" button style as requested.

## User Review Required

> [!IMPORTANT]
> The new design will feature the selected character in 3D directly on the Main Menu. This requires the `Character3DPreview` to be active on the main menu, which might increase initial load time slightly but significantly improves "production value".

## Proposed Changes

### [Component] UI Components
#### [MODIFY] [UIComponents.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/ui/UIComponents.jsx)
- Add `GameButton` component: A professional, game-style button with a thick bottom shadow and "press" animation, matching the user's preferred style.
- Support various color themes (Emerald, Rose, Amber, Slate, etc.).

### [Component] Game UI
#### [MODIFY] [GameUI.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/ui/GameUI.jsx)
- **Redesign `MainMenu`**:
    - **Visuals**: Add the 3D character preview to the center stage.
    - **Layout**: Reorganize the top banner, center character, and bottom navigation to prevent overlapping on small screens.
    - **Buttons**: Replace `MenuButton3D` with the new `GameButton` for a more consistent and professional look.
    - **Responsiveness**: Use better Tailwind classes to handle different screen heights (landscape vs portrait).
- **Redesign `WoodenTitle`**: Make it more responsive to prevent it from taking too much vertical space on mobile.

## Verification Plan

### Automated Tests
- N/A (UI visual changes)

### Manual Verification
- Launch the game in the browser/emulator.
- Verify that the Main Menu looks clean and professional.
- Test on different screen sizes (mobile view in Chrome DevTools) to ensure no overlapping.
- Verify the 3D character preview updates when a different character is selected.
- Confirm the new "GameButton" style matches the Character Selection screen.
