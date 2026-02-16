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

## Testing Checklist

After fixes, test:
- [ ] Draw 3 strokes, undo 2, redo 1 - should show 2 strokes
- [ ] Zoom to 200%, draw line - should appear at cursor position
- [ ] Rotate 90°, draw horizontal line - should appear horizontal in view
- [ ] Set opacity to 50%, draw over existing stroke - should see through
- [ ] Create 3 layers, draw on each, toggle visibility - should show/hide correctly
- [ ] Mobile: Pinch zoom, pan, draw - should work smoothly

## Implementation Order

1. Fix getPos() coordinate transformation (Issue #2, #3)
2. Fix undo/redo (Issue #1)
3. Fix opacity rendering (Issue #4)
4. Add wheel zoom (Issue #5)
5. Fix layers panel UI (Issue #6)
