# Kribble V2 - Production-Level Multiplayer Architecture

## ✅ COMPLETE - All Files Updated for V2 Compatibility

### Files Changed to Match V2 Architecture:

#### Server-Side (V2 Core)
1. **server/src/types/game.ts** - Core types with `userId` identity, `RoomPhase`, `PlayerConnectionState`
2. **server/src/core/RoomManager.ts** - Identity-based room management (NOT socket-based)
3. **server/src/core/GameStateMachine.ts** - Deterministic game state machine
4. **server/src/socket/handlers-v2.ts** - Production-level socket handlers with:
   - `lobby:get-rooms` for room listing
   - `room:create` with proper response format
   - `room:join` with join-by-code support
   - All game events updated to V2 format

#### Client-Side (Updated for V2)
1. **client/src/contexts/GameContext.tsx** - Updated interfaces:
   - `Player.userId` instead of `Player.id`
   - `Room` with all V2 properties (phase, roundNumber, turnTimer, etc.)
   - Socket events updated to V2 format (`game:started`, `game:drawing-started`, etc.)

2. **client/src/pages/Lobby.tsx** - Fixed room listing:
   - Uses `lobby:get-rooms` socket event instead of HTTP API
   - Proper `Room` interface with `playerCount` instead of `players`
   - Join by code uses uppercase 6-char code directly

3. **client/src/pages/mobile/LobbyMobile.tsx** - Same fixes as Lobby.tsx

4. **client/src/components/CreateRoomModal.tsx** - Updated response handler:
   - Changed from `currentPlayerId` to `userId` and `isHost`

5. **client/src/pages/mobile/CreateRoomMobile.tsx** - Same fixes

6. **client/src/pages/GameRoom.tsx** - Updated for V2 game flow:
   - New game phases (`waiting`, `wordSelection`, `drawing`, etc.)
   - `turnTimer` and `wordSelectionTimer` instead of old timer names
   - `userId` instead of `playerId` for all references

## Key V2 Changes Summary

### Identity-Based System (NOT Socket-Based)
- Players identified by `userId` (permanent) not `socketId` (temporary)
- Reconnect grace period: 30 seconds
- Host transfer on disconnect

### Room Codes
- Format: 6-character uppercase (e.g., "ABC123")
- No "room-" prefix needed

### Game Phases
```
waiting → starting → wordSelection → drawing → turnEnd → roundEnd → gameEnd
```

### Socket Events (V2 Format)
- `lobby:get-rooms` → `lobby:rooms`
- `room:create` → `room:created` (with `userId`, `isHost`)
- `room:join` → `room:joined` (with `isReconnect`)
- `game:start` → `game:started`
- `game:word-selection` → `game:drawing-started`
- `game:player-guessed` (new format with scores array)

## Server Status
✅ Running on port 3001 with V2 architecture

## Testing Checklist
- [ ] Create room appears in lobby within 3 seconds
- [ ] Join by 6-char code works
- [ ] Room listing shows all waiting rooms
- [ ] Game starts correctly
- [ ] Word selection phase works
- [ ] Drawing and guessing works
- [ ] Scores update correctly
- [ ] Player reconnect works

## If Issues Persist
Check browser console for socket connection errors and verify all files are using `userId` not `playerId` or `id`.
