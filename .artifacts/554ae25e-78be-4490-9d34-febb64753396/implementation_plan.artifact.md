# Implementation Plan - Fix Book UI Alignment and Page-Turning

Fix the visual UI alignment of the sketchbook to make it fill more of the screen on mobile devices (especially in landscape mode) and fix the page-turning logic to match the reference implementation behavior.

## User Review Required

> [!IMPORTANT]
> The book size will be increased significantly on mobile devices to provide a more immersive experience. The navigation arrows will be slightly adjusted to accommodate this larger size.

## Proposed Changes

### UI Styles

#### [MODIFY] [index.css](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/styles/index.css)
- Update `.sketchbook-stage` to use more screen real estate, especially on landscape mobile.
- Increase the scale of the `.sketchbook` component and adjust its aspect ratio handling.
- Add better shadows and a subtle "paper" feel to the book.
- Fix the mirroring issue during page flips by ensuring the back face image is correctly oriented.
- Improve arrow button positioning and styling for a more "stunning" look.

### Game UI Components

#### [MODIFY] [GameUI.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/ui/GameUI.jsx)
- Refine the `SketchbookModal` component's structure to better support the updated styles.
- Ensure the `turn` function correctly handles the back face of the flipping page.
- Optimize the `riffle` effect for better visual feedback.

## Verification Plan

### Manual Verification
- Open the sketchbook on a mobile device (or emulator) in landscape mode.
- Verify that the book fills most of the screen and is properly centered.
- Flip pages left and right and verify that the animation is smooth and the content is not mirrored or incorrectly displayed.
- Check the visual quality of the shadows and overall UI "stunningness".
