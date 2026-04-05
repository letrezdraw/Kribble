# Canvas Input & Game Mechanics Fixes

## Critical Issues to Fix

### 1. Canvas Input Separation
- [ ] Create input state machine (IDLE, DRAWING, PANNING, ZOOMING)
- [ ] Separate drawing vs navigation modes clearly
- [ ] Fix touch: prevent drawing during pan/zoom gestures
- [ ] Fix pen: prevent drawing when using zoom/pan shortcuts
- [ ] Fix right-click: block completely, use for context menu only
- [ ] Fix pen tap: prevent random stroke from center

### 2. Photoshop-Style Shortcuts
- [ ] B - Brush tool
- [ ] E - Eraser tool
- [ ] M - Marquee/Rectangle tool
- [ ] L - Line tool
- [ ] T - Text tool
- [ ] G - Fill/Bucket tool
- [ ] [ / ] - Decrease/Increase brush size
- [ ] X - Swap foreground/background colors
- [ ] Ctrl+Z / Cmd+Z - Undo
- [ ] Ctrl+Shift+Z / Cmd+Shift+Z - Redo
- [ ] Space + Drag - Pan
- [ ] Ctrl+Space + Drag - Zoom
- [ ] Ctrl+0 - Reset zoom
- [ ] Ctrl++ / Ctrl+- - Zoom in/out
- [ ] Delete/Backspace - Clear canvas (with confirm)

### 3. Touch & Mobile Improvements
- [ ] Move touch handlers to viewport level (not just canvas)
- [ ] Two-finger pan anywhere in viewport
- [ ] Pinch zoom anywhere in viewport
- [ ] Single finger draw only when in drawing mode
- [ ] Prevent drawing during multi-touch gestures

### 4. Game Mechanics Fixes
- [ ] Fix chat: Only show "<username> guessed the word" during turn
- [ ] Fix chat: Show points only at round end
- [ ] Add round-end scoreboard display
- [ ] Add game-end final scoreboard
- [ ] Fix game stuck at final round

### 5. Pen/Tablet Support
- [ ] Proper pressure sensitivity handling
- [ ] Pen barrel button = right click (context menu)
- [ ] Pen eraser end = eraser tool
- [ ] Hover detection (don't draw on hover)
- [ ] Palm rejection improvements

## Files to Modify
1. `client/src/components/canvas/DrawingCanvas.tsx` - Main input handling
2. `client/src/components/canvas/DrawingCanvas.css` - Touch-action styles
3. `client/src/components/canvas/types.ts` - Add input state types
4. `server/src/socket/handlers.ts` - Fix message broadcasting
5. `client/src/pages/GameRoom.tsx` - Add scoreboard UI
6. `client/src/contexts/GameContext.tsx` - Handle game states
