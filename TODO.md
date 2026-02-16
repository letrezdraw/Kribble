# Kribble Game - Issues & Fixes TODO

## Critical Issues (High Priority)

### 1. Undo/Redo Not Working
**Status**: ✅ FIXED
**Description**: Undo/redo buttons don't actually undo or redo strokes
**Fix Applied**:
- Rewrote undoInternal() to find last stroke chronologically across all visible layers
- Fixed redoInternal() to restore stroke to active layer and redraw
- Both functions now properly call redrawAllStrokes() after state changes
- Socket events trigger correct redraws via drawStroke()

### 2. Canvas Transform - Mouse Input Misalignment
**Status**: ✅ FIXED (v2)
**Description**: When zoomed/rotated, cursor position doesn't match drawing position
**Fix Applied**:
- Fixed getPos() to use containerRef instead of canvasRef (transform is on parent div)
- Added displayToCanvasRatio to properly map between display size and canvas coordinates
- Order: inverse scale → inverse translation → inverse rotation
- Mouse coordinates now correctly map to canvas space regardless of transform


### 3. Canvas Rotation - Drawing Not Aligned
**Status**: ✅ FIXED
**Description**: Rotating view 90° causes horizontal lines to draw as vertical
**Fix Applied**:
- getPos() now applies inverse rotation to mouse coordinates
- Drawing coordinates are properly transformed before being stored
- Visual rotation and drawing coordinates are now aligned

## Medium Priority Issues

### 4. Brush Opacity & Eraser Fix
**Status**: ✅ FIXED
**Description**: 
- Opacity values sent (0.01, 0.18, 0.34) but strokes appear solid
- Eraser was erasing canvas background (showing transparent/white holes)
**Fix Applied**:
- Added ctx.save() and ctx.restore() around all drawing operations
- drawStroke(), drawShape(), drawPreviewShape(), addText() all use save/restore
- globalAlpha is now properly preserved and restored for each stroke
- **Eraser fix**: Changed from `destination-out` (erases to transparent) to painting with background color `#f8fafc`
- Eraser now properly "paints over" strokes with background color instead of erasing canvas


### 5. Zoom with Mouse Wheel / Pinch Gesture
**Status**: ✅ FIXED
**Description**: Can't zoom with scroll wheel or pinch gesture
**Fix Applied**:
- Added onWheel handler to canvas for mouse zoom (scroll up/down)
- Pinch zoom already implemented for mobile (two-finger gesture)
- Zoom centers on canvas center point

### 6. Layers Panel UI Too Small
**Status**: ✅ FIXED
**Description**: Layer buttons (delete, reorder) require horizontal scrolling
**Fix Applied**:
- Increased panel width from 200px to 280px
- Reorganized layer controls into vertical layout
- Made layer name input wider with proper styling
- Buttons now show text labels (↑ Up, ↓ Down, 🗑️ Delete)


## Low Priority / Nice to Have

### 7. Mobile Touch Improvements
- [ ] Better touch detection
- [ ] Prevent scroll when drawing
- [ ] Larger touch targets for tools

### 8. Canvas Background
- [ ] Add grid pattern option
- [ ] Transparent background option

## Recently Completed (Game Logic Fixes)

### 9. Automatic Hint System
**Status**: ✅ FIXED
**Description**: Hints were clickable but should reveal automatically over time
**Fix Applied**:
- Server now schedules automatic hint revelations at calculated intervals during drawing phase
- Hints reveal word characters one by one based on round time and hint count settings
- Client shows non-clickable hint display with "X hints remaining" tooltip
- Chat message announces when hints are revealed

### 10. Canvas Clear on Drawer Change
**Status**: ✅ FIXED
**Description**: Canvas wasn't clearing when new drawer started their turn
**Fix Applied**:
- Server emits `CLEAR_CANVAS` event when drawer changes
- Client listens for `CLEAR_CANVAS` and clears local canvas state
- Canvas now broadcasts clear to ALL players including the sender (using `io.to()` instead of `socket.to()`)

### 11. Fill Tool Undo Support
**Status**: ✅ FIXED
**Description**: Fill tool (paint bucket) didn't support undo/redo - filling would be lost when undoing
**Fix Applied**:
- Added `canvasState?: Uint8ClampedArray` property to Stroke interface for fill tool
- Modified `floodFill()` to return void but store canvas state before applying fill
- Modified `drawStroke()` to handle fill tool by restoring canvas state from stored ImageData
- Modified `clearCanvas()` to NOT fill with background color (let strokes redraw naturally)
- Updated `DrawingCanvas.tsx` to capture canvas state BEFORE applying fill and store it in stroke
- Fill operations now properly undo by restoring the canvas to its pre-fill state

### 12. Rejoin Game During Active Round

**Status**: ✅ FIXED
**Description**: Players who reload/rejoin during active game went to waiting room instead of joining game
**Fix Applied**:
- Server detects when player joins during active game phase (not lobby or gameEnd)
- Sends `isRejoiningGame: true` flag with room:joined event
- Server emits game state: `gameState`, `word-selected`, `timer-update`, `PHASE_CHANGE`
- Server sends `canvas:sync` with current strokes to restore drawing
- Client GameContext handles rejoin state and skips lobby overlay
- Client DrawingCanvas listens for `canvas:sync` to restore strokes

### 12. Guest Login 500 Error
**Status**: ✅ FIXED
**Description**: Guest login returned 500 error after deployment
**Fix Applied**:
- FileDB user insert handler updated to accept all 9 parameters (id, username, email, password, avatar_id, level, xp, is_guest, expires_at)
- Previously only handled 7 parameters, causing SQL error for guest users

### 13. TypeScript Compilation Error
**Status**: ✅ FIXED
**Description**: Build failed with `Cannot find name 'endTurn'` error
**Fix Applied**:
- Added `endTurn(room: Room, io: Server)` function to handlers.ts
- Function properly ends current turn and transitions to round end or next drawer

### 14. DrawingCanvas.tsx Missing Functions
**Status**: ✅ FIXED
**Description**: TypeScript errors - missing functions: `undoInternal`, `redoInternal`, `applyTapering`, `samplePointsForStorage`, `handleTouchEnd`, `undo`, `redo`, `zoomIn`, `zoomOut`, `resetTransform`, `rotate`, `clearCanvas`
**Fix Applied**:
- Added `applyTapering()` - applies pressure tapering at end of strokes
- Added `samplePointsForStorage()` - reduces point count for efficient storage
- Added `handleTouchEnd()` - handles touch end events for mobile drawing
- Added `undoInternal()` and `redoInternal()` - core undo/redo logic
- Added `undo()`, `redo()`, `clearCanvas()` - public API functions with drawer checks
- Added `zoomIn()`, `zoomOut()`, `resetTransform()`, `rotate()` - view transformation functions
- Added `handlePointerDown()`, `handlePointerMove()`, `handlePointerUp()` - pointer event handlers
- Added `handleWheel()` - mouse wheel zoom handler
- Added `addText()` - text tool implementation
- Fixed file truncation issue - all functions now properly defined

## Testing Checklist


After fixes, test:
- [x] Draw 3 strokes, undo 2, redo 1 - should show 2 strokes
- [x] Zoom to 200%, draw line - should appear at cursor position
- [x] Rotate 90°, draw horizontal line - should appear horizontal in view
- [x] Set opacity to 50%, draw over existing stroke - should see through
- [x] Create 3 layers, draw on each, toggle visibility - should show/hide correctly
- [x] Mobile: Pinch zoom, pan, draw - should work smoothly
- [x] Join game during active round - should see current drawing and word hints
- [x] Wait for hint - should reveal automatically without clicking
- [x] New drawer starts - canvas should clear for everyone
- [x] Guest login - should work without 500 error


## Implementation Order

1. Fix getPos() coordinate transformation (Issue #2, #3)
2. Fix undo/redo (Issue #1)
3. Fix opacity rendering (Issue #4)
4. Add wheel zoom (Issue #5)
5. Fix layers panel UI (Issue #6)
