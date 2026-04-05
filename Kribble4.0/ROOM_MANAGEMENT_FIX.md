# Room Management Fix - Production Critical Issue

## Problem Summary

The multiplayer room system had critical bugs causing:
1. **Ghost Rooms**: Rooms persisting after all players left
2. **Sticky Joins**: Players getting teleported back to old rooms
3. **No Offline Status**: Disconnected players not marked as offline
4. **Room State Corruption**: Multiple players with same userId in one room

## Root Causes

1. **No proper state tracking**: Socket ID and User ID mappings were not maintained separately
2. **Incomplete cleanup**: Players weren't removed from all tracking maps on leave/disconnect
3. **No grace period for reconnection**: Players removed immediately on disconnect
4. **Race conditions**: Multiple join requests could create duplicate player entries

## Solution Implemented

### 1. New Room Manager (`server/src/utils/roomManager.ts`)

Created a centralized room state management system with:

```typescript
// Three separate maps for proper state tracking
const socketToRoom = new Map<string, string>();  // socketId -> roomId
const userToRoom = new Map<string, string>();    // userId -> roomId  
const socketToUser = new Map<string, string>();  // socketId -> userId
```

**Key Features:**
- **Force leave on room creation**: Automatically leaves previous room before creating new one
- **Proper disconnect handling**: Marks player as `connected: false` but keeps in room
- **Grace period**: 60 seconds for reconnection before removing player
- **Empty room cleanup**: 30 seconds after last player leaves
- **Host promotion**: Automatically promotes new host when current host leaves

### 2. Updated Player Interface (`server/src/data/rooms.ts`)

Added new fields for connection tracking:

```typescript
export interface Player {
  // ... existing fields ...
  connected?: boolean;      // Online/offline status
  lastSeen?: number;        // Timestamp of last activity
  disconnectedAt?: number;  // When player disconnected
}
```

### 3. Updated Socket Handlers (`server/src/socket/handlers.ts`)

Integrated new room manager with:

- **room:create**: Forces leave of existing room before creating new one
- **room:join**: Proper duplicate detection and reconnection handling
- **room:leave**: Immediate removal with host promotion
- **disconnect**: Marks offline, starts grace period timer

### 4. New Events for Frontend

- `player:status`: Broadcasts when player goes offline/online
- `room:player-reconnected`: Notifies when player returns
- `game:drawer-disconnected`: Special handling for drawer disconnect

## How It Works Now

### Creating a Room
1. Force leave any existing room (cleanup all state)
2. Create new room with player as host
3. Set `connected: true` and `lastSeen: timestamp`
4. Update all tracking maps

### Joining a Room
1. Check if already in this room (reconnection)
2. If in different room, force leave first
3. Check for existing player entry (disconnected state)
4. Update socket ID and mark as `connected: true`
5. Clear any pending removal timers

### Disconnecting
1. Mark player as `connected: false`
2. Set `disconnectedAt: timestamp`
3. Clear socket mappings (keep user->room mapping)
4. Broadcast `player:status` event to others
5. Start 60-second grace period timer

### Reconnecting
1. Find player by userId in room
2. Update socket ID and mark `connected: true`
3. Clear grace period timer
4. Broadcast `room:player-reconnected` event

### Leaving Intentionally
1. Remove player from room immediately
2. Promote new host if needed
3. Clean up all tracking maps
4. If room empty, schedule deletion in 30s

## Testing Checklist

- [ ] Create room → Leave → Create new room (no sticky join)
- [ ] Join room → Disconnect → Reconnect (grace period works)
- [ ] Two players in room → One disconnects → Other sees offline status
- [ ] Host leaves → New host auto-promoted
- [ ] All players leave → Room deleted after 30s
- [ ] Drawer disconnects during drawing → Round paused → Reconnect resumes

## Files Changed

1. `server/src/utils/roomManager.ts` - NEW: Centralized room management
2. `server/src/data/rooms.ts` - Added `connected` and `lastSeen` fields
3. `server/src/socket/handlers.ts` - Integrated new room manager

## Migration Notes

- No database migration needed (in-memory state only)
- Existing rooms will be cleared on server restart
- Frontend should handle new `player:status` event for offline indicators
