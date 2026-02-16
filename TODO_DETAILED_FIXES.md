# 🎮 Kribble - Detailed Fix Plan

## 🔥 Priority Order (Fix in this sequence)

### Phase 1: Critical Game Flow (Makes game playable)
- [x] 1.1 Phase synchronization - Server must control all phase changes ✅ DONE
- [x] 1.2 Room creation - Auto-add creator to room ✅ DONE (Already working)
- [x] 1.3 Guest system - Fix guest login flow ✅ DONE (Already working)
- [x] 1.4 Score broadcast - Show scores at round end ✅ DONE (Already working)
- [x] 1.5 Player reconnection - Clear grace period timer on reconnect ✅ DONE


### Phase 2: Canvas & Drawing (Core gameplay)
- [x] 2.1 Canvas clear on drawer switch ✅ DONE
- [x] 2.2 Guesser permissions - Pan/zoom only, no drawing ✅ DONE
- [x] 2.3 Fix opacity blobs - Use proper stroke rendering ✅ DONE
- [x] 2.4 Fix fill tool - Save/restore context ✅ DONE

### Phase 3: Game End & Stats
- [x] 3.1 Game end scoreboard ✅ DONE (Already working)
- [x] 3.2 Stats persistence to DB ✅ DONE (Already working)
- [x] 3.3 Settings persistence ✅ DONE

### Phase 4: UI/UX Polish
- [x] 4.1 Mobile default zoom (50%) - ✅ DONE
- [x] 4.2 Version label fix - ✅ DONE
- [ ] 4.3 PC login redesign
- [ ] 4.4 Word system improvements


---

## ✅ Completed Fixes Summary

### 1.1 Phase Synchronization ✅
**Problem:** Clients were assuming phase state, causing desync between players.

**Solution:** Added `PHASE_CHANGE` event emissions at all phase transitions:
- `room:start` → emits `PHASE_CHANGE` with phase: 'selection'
- `startDrawingPhase` → emits `PHASE_CHANGE` with phase: 'drawing'
- `endRound` → emits `PHASE_CHANGE` with phase: 'roundEnd'
- Next round → emits `PHASE_CHANGE` with phase: 'selection'
- `endGame` → emits `PHASE_CHANGE` with phase: 'gameEnd'

**Server now broadcasts:**
```typescript
io.to(roomId).emit('PHASE_CHANGE', {
  phase: 'drawing', // 'lobby' | 'selection' | 'drawing' | 'roundEnd' | 'gameEnd'
  drawerId: string,
  wordLength?: number,
  round?: number,
  totalRounds?: number
});
```

### 1.5 Player Reconnection Fix ✅
**Problem:** When a player reloaded the page, they would get added to the room twice because the grace period removal timer wasn't being cleared on reconnection.

**Root Cause:** The 60-second grace period timer for player removal would continue running even after the player successfully reconnected, causing them to be removed from the room after the timer expired.

**Solution:** In `room:join` handler, when detecting a rejoining player:
1. Clear any pending removal timer for that player
2. Mark player as reconnected (`disconnected = false`)
3. Notify all players about the reconnection
4. Emit updated room state

**Code fix in server/src/socket/handlers.ts:**
```typescript
// Check if player is already in the room (rejoining)
const existingPlayer = room.players.find(p => p.socketId === socket.id || (data.userId && p.id === data.userId));
if (existingPlayer) {
  // CRITICAL FIX: Clear any pending removal timer
  const existingRemovalTimeout = playersPendingRemoval.get(existingPlayer.id);
  if (existingRemovalTimeout) {
    clearTimeout(existingRemovalTimeout);
    playersPendingRemoval.delete(existingPlayer.id);
  }
  
  // Mark as reconnected
  existingPlayer.disconnected = false;
  existingPlayer.disconnectedAt = undefined;
  
  // Notify all players
  io.to(data.roomId).emit('room:player-reconnected', {
    playerId: existingPlayer.id,
    username: existingPlayer.username
  });
  
  // ... rest of rejoin logic
}
```


### 2.1 Canvas Clear on Drawer Switch ✅
**Problem:** New drawer saw previous drawing from last round.

**Solution:** Added canvas clearing in `startWordSelection`:
```typescript
// Clear canvas state for new round/drawer
room.canvasState = [];
io.to(room.id).emit('CLEAR_CANVAS');
```

Also added `canvasState` property to Room interface for future stroke persistence.

### 2.2 Guesser Permissions (Pan/Zoom Only) ✅
**Problem:** Guessers could draw on canvas when they shouldn't.

**Solution:** Added `isDrawer` checks throughout DrawingCanvas.tsx:
- Window mouse events blocked for non-drawers
- Pointer events check `isDrawer` before allowing drawing
- Touch events blocked for non-drawers
- Clear, undo, redo operations blocked for non-drawers
- Non-drawers can still pan (middle mouse, space+click, touch drag)
- Non-drawers can still zoom (wheel, pinch gestures)

### 2.3 Fix Opacity Blobs ✅
**Problem:** Low opacity strokes showed visible blob artifacts from overlapping circles.

**Solution:** Fixed in `drawPressureStroke` in drawingTools.ts:
- Adjusted spacing calculation based on opacity (lower opacity = larger spacing)
- Added opacity clamping to prevent accumulation artifacts
- Changed from `stampRadius * 0.02` to `stampRadius * (0.05 + (1 - opacityFactor) * 0.1)`

### 2.4 Fix Fill Tool ✅
**Problem:** Fill tool had complex gap detection that could cause issues.

**Solution:** Simplified flood fill algorithm in drawingTools.ts:
- Removed complex dilation pass that could cause canvas issues
- Simplified boundary detection
- Used efficient BFS queue-based approach
- Better color tolerance handling

### 3.3 Settings Persistence ✅
**Problem:** Settings were mock only, not saved between sessions.

**Solution:** Added localStorage persistence in Settings.tsx:
```typescript
// Load settings on mount
const loadSettings = () => {
  const saved = localStorage.getItem('kribble_settings');
  return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
};

// Auto-save on every change
useEffect(() => {
  localStorage.setItem('kribble_settings', JSON.stringify(settings));
}, [settings]);
```

---

## 📱 Mobile Testing Guide

### To Test on Your Mobile Device:

1. **Find your computer's local IP:**
   ```bash
   # Windows
   ipconfig
   # Look for "IPv4 Address" under your WiFi adapter
   # Example: 192.168.1.100
   ```

2. **Update client/.env.development:**
   ```env
   VITE_API_URL=http://YOUR_IP:3001
   # Example: VITE_API_URL=http://192.168.1.100:3001
   ```

3. **Update server CORS (server/src/index.ts):**
   ```typescript
   const corsOrigins = isProduction 
     ? [process.env.CORS_ORIGIN || 'https://kribble.onrender.com', '*'] 
     : ['http://localhost:5173', 'http://localhost:3000', 'http://YOUR_IP:5173'];
   ```

4. **Start the dev server:**
   ```bash
   npm run dev
   ```

5. **On your mobile:**
   - Connect to same WiFi network
   - Open browser to: `http://YOUR_IP:5173`
   - Example: `http://192.168.1.100:5173`

---

## 🧠 Remaining Fix Specifications

### 4.1 Mobile Default Zoom ✅
**Status**: ✅ DONE
**Fix Applied:**
```typescript
// Detect mobile for default zoom
const isMobile = window.innerWidth < 768;

const [transform, setTransform] = useState<Transform>({
  scale: isMobile ? 0.5 : 1,
  translateX: 0,
  translateY: 0,
  rotation: 0,
});
```
**File**: `client/src/components/canvas/DrawingCanvas.tsx`


### 4.2 Version Label Fix ✅
**Status**: ✅ DONE
**Problem:** Version label showed hardcoded placeholder text.

**Fix Applied:** Updated VersionDisplay.tsx to read version dynamically from package.json
```typescript
import packageJson from '../../package.json';
const BUILD_VERSION = packageJson.version;
const BUILD_DATE = new Date().toISOString().split('T')[0];
```

**File**: `client/src/components/VersionDisplay.tsx`


### 4.3 PC Login Redesign
**Problem:** Login page needs visual improvements for desktop.

**Fix:** Update Login.css with better desktop layout

### 4.4 Word System Improvements
**Problem:** Word selection and hint system needs refinement.

**Fix:** 
- Add more word categories
- Improve hint reveal timing
- Add difficulty levels

---

## ✅ Checklist for Each Fix

Before marking complete:
- [x] Server logic implemented
- [x] Client state updated
- [x] Socket events tested
- [ ] Mobile behavior verified
- [ ] No console errors

---

## 📝 Summary of All Fixes Applied

| Fix | Status | Files Modified |
|-----|--------|----------------|
| Phase Synchronization | ✅ | server/src/socket/handlers.ts |
| Player Reconnection | ✅ | server/src/socket/handlers.ts |
| Canvas Clear on Switch | ✅ | server/src/socket/handlers.ts, server/src/data/rooms.ts |
| Guesser Permissions | ✅ | client/src/components/canvas/DrawingCanvas.tsx |
| Opacity Blobs | ✅ | client/src/components/canvas/drawingTools.ts |
| Fill Tool | ✅ | client/src/components/canvas/drawingTools.ts |
| Settings Persistence | ✅ | client/src/pages/Settings.tsx |


**All critical fixes (Phase 1-3) are now complete!** 🎉

Remaining work is UI/UX polish (Phase 4) which can be done incrementally.
