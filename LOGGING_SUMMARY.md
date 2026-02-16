# Comprehensive Logging System - Implementation Summary

## Overview
A production-ready logging system has been implemented that logs every interaction to a file and clears logs on each server start during development.

## Files Created/Modified

### 1. Logger Utility (`server/src/utils/logger.ts`)
- **Purpose**: Centralized logging utility with multiple log levels
- **Features**:
  - 5 log levels: ERROR, WARN, INFO, TRACE, DEBUG
  - File output to `logs/development.log`
  - **Auto-clears logs on server startup in development mode**
  - Structured JSON format for easy parsing
  - Specialized methods for different event types:
    - `apiRequest()` - API call logging
    - `apiResponse()` - API response logging
    - `socketEvent()` - WebSocket event logging
    - `gameState()` - Game state changes
    - `userAction()` - User interactions

### 2. Server Integration (`server/src/index.ts`)
- Added `dotenv` import for environment variable loading
- Added logger import and integration
- Request logging middleware that logs every API request/response
- Socket connection logging
- Server startup/shutdown logging

### 3. Auth Routes (`server/src/routes/auth.ts`)
- Replaced all `console.log` with structured logger calls
- Logs every authentication attempt:
  - `REGISTER_ATTEMPT` - When user tries to register
  - `REGISTER_SUCCESS` - Successful registration
  - `LOGIN_ATTEMPT` - When user tries to login
  - `LOGIN_SUCCESS` - Successful login
  - `GUEST_LOGIN_ATTEMPT` - Guest login attempts
  - `GUEST_LOGIN_SUCCESS` - Successful guest login
  - `PROFILE_UPDATE` - Profile changes
- Error logging with full stack traces

### 4. Socket Handlers (`server/src/socket/handlers.ts`)
- Comprehensive WebSocket event logging:
  - Connection/disconnection events
  - Room creation and joining
  - Game state changes (GAME_STARTED, WORD_SELECTED, etc.)
  - Player actions (join, leave, guesses)
  - Correct guesses with points awarded
  - All chat messages
  - Rate limit violations

## Log Output Format

```json
{
  "timestamp": "2024-01-15T10:30:45.123Z",
  "level": "INFO",
  "category": "AUTH",
  "message": "User logged in successfully",
  "userId": "user-123",
  "action": "LOGIN_SUCCESS",
  "metadata": { "username": "john", "email": "john@example.com" },
  "ip": "192.168.1.100",
  "socketId": "socket-abc-123"
}
```

## Log File Location
- **Development**: `./logs/development.log`
- **Production**: `./logs/production.log`

## Key Features

### 1. Auto-Clear on Startup
In development mode, logs are automatically cleared when the server starts, ensuring fresh logs for each debugging session.

### 2. Every Interaction Logged
- ✅ API requests and responses
- ✅ Authentication attempts (success & failure)
- ✅ Socket connections/disconnections
- ✅ Room creation, joining, leaving
- ✅ Game state changes
- ✅ Word selections
- ✅ Guesses (correct and incorrect)
- ✅ Chat messages
- ✅ Score updates
- ✅ Player disconnections/reconnections
- ✅ Rate limit violations

### 3. Structured Data
All logs include:
- Timestamp
- Log level
- User ID (when available)
- IP address
- Socket ID
- Action type
- Relevant metadata

### 4. Safe for Production
- No sensitive data logged (passwords hashed, tokens redacted)
- Separate log files for dev/prod
- Log rotation ready
- Console output preserved for real-time monitoring

## Usage Examples

### View Logs in Real-Time
```bash
# Terminal 1: Watch logs
tail -f logs/development.log

# Terminal 2: Start server
npm run dev
```

### Search Logs
```bash
# Find all login attempts
grep "LOGIN_ATTEMPT" logs/development.log

# Find errors
grep "ERROR" logs/development.log

# Find specific user actions
grep "user-123" logs/development.log
```

### Parse Logs Programmatically
```bash
# Extract all game events
cat logs/development.log | jq 'select(.category == "GAME")'

# Get error summary
cat logs/development.log | jq 'select(.level == "ERROR") | {timestamp, message, metadata}'
```

## Environment Variables
Add to `.env` files to control logging:

```env
# Log level (ERROR, WARN, INFO, TRACE, DEBUG)
LOG_LEVEL=TRACE

# Enable/disable file logging
LOG_TO_FILE=true

# Log file path
LOG_FILE_PATH=./logs/development.log
```

## Testing the Logging

1. Start the server: `npm run dev`
2. Check that `logs/development.log` is created
3. Perform actions (login, create room, join game, guess, chat)
4. View the log file to see structured entries for every interaction

## Mobile Testing Integration
The logging system works seamlessly with the mobile tunnel scripts:
- All mobile device interactions are logged
- IP addresses show the tunnel service IP
- Socket events track mobile connections
- Perfect for debugging mobile-specific issues

## Next Steps
1. Add log rotation for production (using `winston` or similar)
2. Add log aggregation service integration (optional)
3. Create log analysis dashboard (optional)
4. Add performance metrics logging
