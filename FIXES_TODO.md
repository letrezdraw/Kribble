# Kribble Fixes TODO

## Critical Fixes

### 1. Shared Types (shared/src/index.ts) ✅ COMPLETED
- [x] Add `hasGuessedCorrectly?: boolean` to Player interface
- [x] Add 'freeDraw' to GamePhase type
- [x] Add `totalRounds` to GameState interface
- [x] Update ServerToClientEvents with all missing handlers
- [x] Update ClientToServerEvents with all missing handlers

### 2. Server Improvements (server/src/socket/handlers.ts) ✅ COMPLETED
- [x] Add rate limiting for guesses and chat
- [x] Add profanity filter
- [x] Improve error handling
- [x] Add input validation for guesses and messages
- [x] Fix timer cleanup on early round end
- [x] Add room settings update handler

### 3. Client GameContext (client/src/contexts/GameContext.tsx) ✅ COMPLETED
- [x] Add `room:settings-updated` handler
- [x] Improve state synchronization
- [x] Add error handling for socket events

### 4. Client GameRoom (client/src/pages/GameRoom.tsx) ✅ COMPLETED
- [x] Add input validation for settings
- [x] Fix settings save/update synchronization
- [x] Improve chat message deduplication
- [x] Add loading states


### 5. New Utilities ✅ COMPLETED
- [x] Create rate limiter utility (server/src/utils/rateLimiter.ts)
- [x] Create profanity filter utility (server/src/utils/profanityFilter.ts)
- [x] Create validation utilities (integrated in profanityFilter.ts)

### 6. Testing
- [ ] Test all game flows
- [ ] Verify TypeScript compilation
- [ ] Test multiplayer scenarios

## Summary of Changes Made

### Server-side:
1. **shared/src/index.ts** - Updated all TypeScript interfaces to match actual usage
2. **server/src/utils/rateLimiter.ts** - New utility for rate limiting socket events
3. **server/src/utils/profanityFilter.ts** - New utility for filtering inappropriate content
4. **server/src/socket/handlers.ts** - Added rate limiting, profanity filtering, input validation, and improved error handling

### Client-side:
1. **client/src/contexts/GameContext.tsx** - Added `room:settings-updated` handler and improved state sync

### Key Fixes:
- Chat rate limiting: 3 messages per second
- Guess rate limiting: 5 guesses per second
- Draw stroke rate limiting: 60 strokes per second
- Profanity filtering for usernames and chat messages
- Input validation for empty/too long guesses and messages
- Timer properly clears when all players guess correctly
- Room settings can be updated by host in real-time
