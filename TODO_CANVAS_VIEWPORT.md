# Canvas Viewport Implementation Plan

## Goal
Implement a canvas inside a viewport that allows:
- Rotation, zoom, and pan
- Drawing at cursor position (not viewport center)
- Fix cursor/stroke coordinate drift issue

## Status: ✅ COMPLETED

## Files Modified

### 1. client/src/components/canvas/DrawingCanvas.css ✅
- [x] Added `.canvas-viewport` class - the outer container with overflow:hidden
- [x] Added `.canvas-inner` class - the inner container that gets the CSS transform
- [x] Updated canvas elements to fixed 800x800 size
- [x] Added `transform-origin: center center` for proper rotation

### 2. client/src/components/canvas/coordinates.ts ✅
- [x] Added `screenToCanvas` function that:
  - Takes screen coordinates (clientX, clientY)
  - Gets the viewport element position
  - Applies inverse transform: un-translate → un-rotate → un-scale
  - Returns canvas coordinates (x, y on the 800x800 canvas)
- [x] Updated `getPos` and `getPosFromEvent` to use the new transform logic
- [x] Added `canvasToScreen` function for UI positioning

### 3. client/src/components/canvas/DrawingCanvas.tsx ✅
- [x] Restructured JSX with viewport → inner wrapper → canvases
- [x] Applied CSS transform to `.canvas-inner`: `translate(translateX, translateY) rotate(rotation) scale(scale)`
- [x] Fixed coordinate functions to use `transformRef.current`
- [x] Fixed panning cursor feedback (moved to `.canvas-inner`)
- [x] All pointer events now use proper coordinate conversion

## Transform Math Implementation

### CSS Transform (applied to canvas-inner):
```css
transform: translate(translateX, translateY) rotate(rotation) scale(scale);
```

### Inverse Transform (screen to canvas):
1. **Reverse translation**: 
   - relX = screenX - viewportCenterX - translateX
   - relY = screenY - viewportCenterY - translateY

2. **Reverse rotation**:
   - rotationRad = (rotation * π) / 180
   - rotatedX = relX * cos(-θ) - relY * sin(-θ)
   - rotatedY = relX * sin(-θ) + relY * cos(-θ)

3. **Reverse scale**:
   - canvasX = rotatedX / scale + CANVAS_SIZE / 2
   - canvasY = rotatedY / scale + CANVAS_SIZE / 2

## Testing Checklist
- [x] Draw at different zoom levels - strokes appear at cursor
- [x] Draw at different pan positions - strokes appear at cursor  
- [x] Draw at different rotation angles - strokes appear at cursor
- [x] Zoom in/out - canvas zooms properly
- [x] Pan - canvas moves in drag direction
- [x] Rotate - canvas rotates around center
- [x] Combined transforms work correctly


## Transform Math Details

### CSS Transform (applied to canvas-inner):
```
css
transform: translate(translateX, translateY) rotate(rotation) scale(scale);
```

### Inverse Transform (screen to canvas):
1. **Reverse translation**: 
   - canvasX = (screenX - translateX) / scale
   - canvasY = (screenY - translateY) / scale

2. **Reverse rotation** (if rotation != 0):
   - Convert rotation to radians
   - Apply counter-rotation around the center point
   - canvasX = cos(-θ) * (x - cx) - sin(-θ) * (y - cy) + cx
   - canvasY = sin(-θ) * (x - cx) + cos(-θ) * (y - cy) + cy

3. **Reverse scale** is already handled in step 1

### Canvas Center Calculation:
- Need to calculate the center of the canvas in screen coordinates
- This depends on the viewport size and current transform

## Implementation Notes

1. The viewport should be the size of the container
2. The inner canvas container holds the 800x800 canvases
3. When transforming, we transform the inner container, not individual canvases
4. Coordinate conversion must account for:
   - The canvas being centered in the viewport (if smaller)
   - Current transform state (translate, scale, rotation)
   - Viewport boundaries

## Testing Checklist
- [ ] Draw at different zoom levels - strokes should appear at cursor
- [ ] Draw at different pan positions - strokes should appear at cursor
- [ ] Draw at different rotation angles - strokes should appear at cursor
- [ ] Zoom in/out - canvas should zoom toward/from cursor
- [ ] Pan - canvas should move in drag direction
- [ ] Rotate - canvas should rotate around center
- [ ] Combined transforms should work correctly
