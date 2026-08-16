# Fix GLTF Textures, Mobile Joystick, and Animal SFX Volume

This plan addresses Three.js console errors, mobile control interactivity, and audio volume consistency.

## Proposed Changes

### [Asset Loading]

#### [MODIFY] [localAssets.js](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/utils/localAssets.js)
* Update `resolveAssetUrl` to return the original path for GLTF/GLB/OBJ/MTL models and their dependencies. This prevents `blob:` URLs from breaking relative texture loading and fixes the `Security Error`. The Service Worker already handles caching for these assets.

### [Mobile Controls]

#### [MODIFY] [Controls.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/controls/Controls.jsx)
* In `setupTouchControls`, prioritize `onJoystick` and `onJump` checks before the `isUI` check. This ensures that touches on the joystick/jump button are handled as game input even if they are technically part of the HUD.

#### [MODIFY] [GameUI.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/ui/GameUI.jsx)
* Remove `data-ui-hud="true"` from `Joystick` and `JumpButton` to avoid being flagged as blocking UI elements in the touch handler.
* Ensure `Joystick` knob animation uses smooth transitions when released.

### [Animal SFX Volume]

#### [MODIFY] [Animals.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/components/Animals.jsx)
* Update `GLTFAnimal` to store a `volume` state.
* Add `updateVolume(volume)` method to `GLTFAnimal` to dynamically change sound volume.
* Update `playSound` to use the stored volume.
* Update `loadGLTFAnimals` to accept an initial volume.

#### [MODIFY] [MiniZooGame.jsx](file:///C:/laragon/www/GitHub/bulusan-zoo-adventure-game/src/game/MiniZooGame.jsx)
* Pass the initial SFX volume to `loadGLTFAnimals`.
* Add a listener or update logic to call `updateVolume` on all animals when the game settings (SFX volume) change.

## Verification Plan

### Automated Tests
* N/A (Manual verification on device/emulator is required for touch and audio).

### Manual Verification
* **GLTF Textures:** Open the game and check the console for `THREE.GLTFLoader: Couldn't load texture` errors. Verify models (statue, houses, animals) render with textures.
* **Joystick:** Test on a mobile device or Chrome dev tools (mobile emulation). Drag the joystick and verify movement. Ensure the knob returns to center.
* **SFX Volume:** Change the SFX volume in Settings. Swipe/Feed animals and verify the sound volume matches the setting. Ensure 0% volume actually mutes the animal sounds.
