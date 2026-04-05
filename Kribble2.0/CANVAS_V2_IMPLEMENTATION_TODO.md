# Canvas V2 Implementation TODO

## Completed ✅

### Core Engine
- [x] CanvasEngineV2 - Main canvas engine with pressure sensitivity
- [x] ViewportEngine - Clip Studio-style pan/zoom/rotate viewport
- [x] CommandStack - Undo/redo with sequential command tracking
- [x] Command types (Stroke, Fill, Clear)

### Input Systems
- [x] Pointer Events - Full pressure sensitivity support
- [x] TouchGestureHandler - Pinch zoom, rotate, pan gestures
- [x] ShortcutManager - Keyboard shortcuts for tools

### Sync System
- [x] CommandSync - Multiplayer command synchronization

### React Integration
- [x] CanvasV2 component - React wrapper for the engine
- [x] Feature flag system (USE_CANVAS_V2)

### Constants & Types
- [x] Logical canvas dimensions (1200x900 - 3:4 landscape)
- [x] Brush configuration
- [x] Performance configuration
- [x] All TypeScript types

## In Progress 🔄

- [ ] Build verification
- [ ] Integration testing

## Feature Flags (constants.ts)

```
typescript
export const USE_CANVAS_V2 = true; // Master flag
```

## To Enable/Disable

Edit `Kribble2.0/Kribble-Client/src/canvas/v2/constants.ts`:
```
typescript
export const USE_CANVAS_V2 = false; // Use V1
```

## Architecture Notes

### Golden Rule: DO NOT TOUCH WORKING ENGINE
- CanvasEngineV1 remains untouched
- V2 is a completely separate system
- Feature flag controls which is used

### Key Features Implemented

1. **Fixed Logical Canvas (1200x900)**
   - Device-independent coordinate system
   - No stretching across devices

2. **Clip Studio-Style Viewport**
   - Pan, zoom, rotate support
   - Smooth transformations
   - Screen ↔ Logical coordinate conversion

3. **Pressure Sensitivity**
   - Real stylus support via Pointer Events
   - Pressure-based brush width
   - Fallback for mouse (0.5 pressure)

4. **Deterministic Sync**
   - Command-based synchronization
   - Sequential undo/redo
   - Late joiner replay support

5. **Tools**
   - Brush with pressure
   - Eraser
   - Fill (bucket)
   - Clear canvas

## Next Steps

1. Test the canvas in browser
2. Connect to multiplayer socket
3. Add remaining tools (shapes)
4. Optimize performance
