# Drawing System Files - Complete Reference

This document lists all code files related to drawing and real-time sharing in the Kribble application.

## 🎨 Canvas Components (Client-Side)

### Main Canvas Components
| File | Purpose | Status |
|------|---------|--------|
| `client/src/components/canvas/DrawingCanvas.tsx` | Legacy main canvas component (currently in use) | ⚠️ Legacy |
| `client/src/components/canvas/DrawingCanvasV2.tsx` | **NEW** Canvas Command Protocol version | ✅ New |
| `client/src/components/canvas/DrawingCanvas.css` | Styles for legacy canvas | ⚠️ Legacy |
| `client/src/components/canvas/DrawingCanvasV2.css` | **NEW** Styles for V2 | ✅ New |
| `client/src/components/canvas/CanvasEngine.ts` | **NEW** Command protocol engine with dual-layer rendering | ✅ New |

### Canvas UI Components
| File | Purpose |
|------|---------|
| `client/src/components/canvas/BrushSettingsMenu.tsx` | Brush size/color/opacity settings UI |
| `client/src/components/canvas/BrushSettingsMenu.css` | Styles for brush settings |
| `client/src/components/canvas/TextInput.tsx` | Text tool input overlay |
| `client/src/components/canvas/TextInput.css` | Styles for text input |
| `client/src/components/canvas/TransformControls.tsx` | Canvas zoom/pan/rotate controls |
| `client/src/components/canvas/TransformControls.css` | Styles for transform controls |

### Canvas Utilities
| File | Purpose |
|------|---------|
| `client/src/components/canvas/drawingTools.ts` | Core drawing functions (drawStroke, drawShape, floodFill, redrawAllStrokes, clearCanvas) |
| `client/src/components/canvas/coordinates.ts` | Coordinate transformation utilities (screen to canvas, canvas to screen) |
| `client/src/components/canvas/keyboardShortcuts.ts` | Keyboard shortcut definitions and handling |
| `client/src/components/canvas/types.ts` | TypeScript types for canvas (Stroke, Point, ToolType, CanvasCommand, etc.) |
| `client/src/components/canvas/index.ts` | Export barrel for canvas module |

## 🪝 Canvas Hooks (React Integration)

| File | Purpose | Status |
|------|---------|--------|
| `client/src/components/canvas/hooks/useSocketEvents.ts` | **Legacy** socket event handling (draw:stroke, draw:clear, etc.) | ⚠️ Legacy |
| `client/src/components/canvas/hooks/useCanvasEngine.ts` | **NEW** Canvas Command Protocol hook (canvas:command, canvas:sync) | ✅ New |
| `client/src/components/canvas/hooks/useCanvasState.ts` | Canvas state management (strokes, redoStack) |
| `client/src/components/canvas/hooks/useDrawingOperations.ts` | Drawing operation logic (startStroke, addPoint, endStroke) |
| `client/src/components/canvas/hooks/useInputHandler.ts` | Input handling (mouse, touch, pen, keyboard) |
| `client/src/components/canvas/hooks/index.ts` | Hook exports |

## 🔌 Socket & Real-Time Sharing (Server-Side)

### Main Socket Handlers
| File | Purpose |
|------|---------|
| `server/src/socket/handlers.ts` | **Primary** socket event handlers including:<br>- `draw:stroke` (legacy)<br>- `draw:clear` (legacy)<br>- `draw:undo`/`draw:redo` (legacy)<br>- `canvas:command` (**NEW** - unified command protocol)<br>- `canvas:sync` (**NEW** - command history sync) |
| `server/src/socket/handlers-v2.ts` | Alternative/experimental socket handlers |

### Room & State Management
| File | Purpose |
|------|---------|
| `server/src/data/rooms.ts` | Room data structure including:<br>- `canvasState: Stroke[]` (legacy)<br>- `commandHistory: CanvasCommand[]` (**NEW**) |
| `server/src/utils/roomManager.ts` | Room management utilities (create, join, leave, disconnect handling) |
| `server/src/utils/redis.ts` | Redis persistence for room state including command history |
| `server/src/utils/rateLimiter.ts` | Rate limiting for drawing events (drawRateLimiter) |

## 📦 Shared Types (Client + Server)

| File | Purpose |
|------|---------|
| `shared/src/index.ts` | Shared TypeScript types:<br>- `Stroke`, `Point`, `ToolType`<br>- `CanvasCommand`, `CanvasCommandType`<br>- `StartStrokePayload`, `AddPointsPayload`, `EndStrokePayload`<br>- Socket event type definitions<br>- `ServerToClientEvents`, `ClientToServerEvents` |
| `shared/src/msgpack.ts` | MessagePack binary encoding for efficient data transfer (compactStroke, expandStroke, encodeMessage, decodeMessage) |

## 🎮 Game Room Pages (Where Canvas is Used)

| File | Purpose |
|------|---------|
| `client/src/pages/GameRoom.tsx` | Desktop game room page (uses DrawingCanvas) |
| `client/src/pages/GameRoom.css` | Desktop game room styles |
| `client/src/pages/mobile/GameRoomMobile.tsx` | Mobile game room page |
| `client/src/pages/mobile/GameRoomMobile.css` | Mobile game room styles |

## 🔗 Context Providers (Socket & Game State)

| File | Purpose |
|------|---------|
| `client/src/contexts/SocketContext.tsx` | Socket.io connection management, socket instance provider |
| `client/src/contexts/GameContext.tsx` | Game state management (current word, timer, scores, phase) |
| `client/src/contexts/AuthContext.tsx` | User authentication state (user ID, username for socket events) |

## 🎯 Drawing Data Flow

### Legacy System (Current)
```
User draws → DrawingCanvas
    ↓
useDrawingOperations / useInputHandler
    ↓
socket.emit('draw:stroke', { stroke })
    ↓
server/src/socket/handlers.ts (draw:stroke handler)
    ↓
room.canvasState.push(stroke)
    ↓
socket.to(room).emit('draw:stroke', { stroke })
    ↓
Other clients → useSocketEvents → drawStroke()
```

### New Canvas Command Protocol (Ready to Integrate)
```
User draws → DrawingCanvasV2
    ↓
useCanvasEngine.startStroke() / addPoints() / endStroke()
    ↓
socket.emit('canvas:command', { command })
    ↓
server/src/socket/handlers.ts (canvas:command handler)
    ↓
room.commandHistory.push(command)
    ↓
socket.to(room).emit('canvas:command', { command })
    ↓
Other clients → useCanvasEngine → applyCommand()
    ↓
CanvasEngine dual-layer rendering
```

## 📊 File Count Summary

| Category | Legacy Files | New Files (Command Protocol) | Total |
|----------|--------------|----------------------------|-------|
| Canvas Components | 7 | 4 | 11 |
| Canvas Hooks | 4 | 1 | 5 |
| Server Socket | 2 | 0 (modified) | 2 |
| Shared Types | 2 | 0 (modified) | 2 |
| Game Pages | 4 | 0 | 4 |
| Contexts | 3 | 0 | 3 |
| **TOTAL** | **22** | **5** | **27** |

## 🚀 Integration Status

### ✅ Completed (New System)
- `CanvasEngine.ts` - Core engine with dual-layer rendering
- `useCanvasEngine.ts` - React hook for command protocol
- `DrawingCanvasV2.tsx` - V2 component
- `DrawingCanvasV2.css` - V2 styles
- Server-side `canvas:command` handler
- Shared types for command protocol

### ⚠️ Still Using Legacy System
- `GameRoom.tsx` - Uses `DrawingCanvas` (legacy)
- `GameRoomMobile.tsx` - Uses `DrawingCanvas` (legacy)
- `useSocketEvents.ts` - Handles legacy `draw:stroke` events

### 🔧 To Complete Integration
Replace in `GameRoom.tsx` and `GameRoomMobile.tsx`:
```tsx
// From:
import { DrawingCanvas } from '../components/canvas';

// To:
import { DrawingCanvasV2 } from '../components/canvas';
```

And update props from `onStroke` to room-based sync with `roomId` and `userId`.

---

**Total Files Related to Drawing & Sharing: 27 files**
