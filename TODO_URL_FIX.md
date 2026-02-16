# URL Configuration Fix - Implementation Plan

## Problem
Hardcoded URLs prevent the project from running properly on local development. The server has production URLs hardcoded, and the client relies on same-origin requests which don't work when client and server run on separate ports during development.

## Solution
Implement environment-based configuration using `.env` files that:
1. Works seamlessly in local development (ports 5173/3001)
2. Doesn't affect production deployment
3. Requires no code changes between environments

## Implementation Steps

### Phase 1: Server Configuration
- [x] Create `server/.env.development` with local settings
- [x] Create `server/.env.example` as template
- [x] Update `server/src/index.ts` to load environment variables
- [x] Update CORS configuration to use environment variables
- [x] Add dotenv import to server

### Phase 2: Client Configuration
- [x] Create `client/.env.development` with API/Socket URLs
- [x] Create `client/.env.production` with empty strings (same-origin)
- [x] Update `client/src/services/api.ts` to use env variable
- [x] Update `client/src/contexts/SocketContext.tsx` to use env variable
- [x] Update `client/src/vite-env.d.ts` for type definitions

### Phase 3: Git Configuration
- [x] Update `.gitignore` to allow safe env files
- [x] Document which env files are tracked vs ignored

### Phase 4: Documentation
- [x] Create `LOCAL_DEVELOPMENT_GUIDE.md` with setup instructions
- [x] Update main README with development workflow

## Files to Create/Modify

### New Files
1. `server/.env.development` - Local server config
2. `server/.env.example` - Template for production
3. `client/.env.development` - Local client config
4. `client/.env.production` - Production client config
5. `LOCAL_DEVELOPMENT_GUIDE.md` - Documentation

### Modified Files
1. `server/src/index.ts` - Add dotenv, update CORS
2. `client/src/services/api.ts` - Use env variable
3. `client/src/contexts/SocketContext.tsx` - Use env variable
4. `client/src/vite-env.d.ts` - Add type definitions
5. `.gitignore` - Allow safe env files

## Testing Checklist

- [ ] Server starts on port 3001 with `npm run dev`
- [ ] Client starts on port 5173 with `npm run dev`
- [ ] API calls go to `http://localhost:3001`
- [ ] WebSocket connects to `ws://localhost:3001`
- [ ] Login works as registered user
- [ ] Login works as guest
- [ ] Room creation works
- [ ] Room joining works
- [ ] Game play works
- [ ] Production build still works (empty env vars = same-origin)

## Commands to Test

```bash
# Terminal 1 - Start Server
cd server
npm run dev

# Terminal 2 - Start Client
cd client
npm run dev

# Terminal 3 - Test API
curl http://localhost:3001/api/health
```

## Expected Behavior

### Local Development
- Server runs on `http://localhost:3001`
- Client runs on `http://localhost:5173`
- Client connects to server via explicit URLs
- CORS allows `localhost:5173`

### Production
- Server uses `CORS_ORIGIN` env var or allows all
- Client uses same-origin (relative URLs)
- No hardcoded localhost references

## Rollback Plan
If issues occur:
1. Revert to empty strings in client env files
2. Revert server CORS to hardcoded values
3. Document manual URL configuration
