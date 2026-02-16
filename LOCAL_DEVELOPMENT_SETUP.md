# Local Development Setup Guide

## Overview
This guide explains how to run the Kribble project locally for development without affecting production deployments.

## Architecture
- **Client**: Vite React app (runs on port 5173 by default)
- **Server**: Express + Socket.IO (runs on port 3001 by default)
- **Database**: SQLite (local file)

## Quick Start

### 1. Install Dependencies
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server && npm install

# Install client dependencies
cd client && npm install
```

### 2. Environment Configuration
The project uses environment files for different environments:

- **Development**: `client/.env.development` (already configured)
  - `VITE_API_URL=http://localhost:3001`
  - `VITE_SOCKET_URL=http://localhost:3001`

- **Production**: `client/.env.production` (uses relative URLs for same-origin)

### 3. Start the Server
```bash
cd server
npm run dev
# Server runs on http://localhost:3001
```

### 4. Start the Client (in a new terminal)
```bash
cd client
npm run dev
# Client runs on http://localhost:5173
```

### 5. Open in Browser
Navigate to: `http://localhost:5173`

## How It Works

### Client → Server Communication
1. **API Requests**: Client uses `VITE_API_URL` (http://localhost:3001) for REST API calls
2. **Socket.IO**: Client connects to same URL for real-time communication
3. **CORS**: Server allows requests from `localhost:5173` in development mode

### Environment Variables
| Variable | Development | Production |
|----------|-------------|------------|
| `VITE_API_URL` | `http://localhost:3001` | `''` (relative) |
| `VITE_SOCKET_URL` | `http://localhost:3001` | `''` (relative) |

## Server CORS Configuration
The server automatically configures CORS based on `NODE_ENV`:

**Development** (`NODE_ENV !== 'production'`):
- Allows: `localhost:5173`, `localhost:3000`, `localhost:4173`
- Also allows: `127.0.0.1` variants

**Production** (`NODE_ENV === 'production'`):
- Uses `CORS_ORIGIN` environment variable if set
- Otherwise allows all origins (`*`) for same-origin deployments

## Common Issues

### "Cannot connect to server"
- Ensure server is running on port 3001
- Check that `client/.env.development` has correct URL
- Verify no firewall blocking the connection

### CORS errors
- Server must be running before client
- Check server logs for CORS origin warnings

### Port conflicts
If ports are already in use:
- **Client**: Change in `client/vite.config.ts`
- **Server**: Set `PORT` environment variable

## Production Deployment
No code changes needed! The same codebase works for production:

1. **Render/Railway**: Set `CORS_ORIGIN` if needed, or leave empty for same-origin
2. **Environment**: Set `NODE_ENV=production`
3. **Build**: Client builds to `client/dist`, served by Express

## Files Modified for Local Development
- `client/.env.development` - Development API URL
- `client/.env.production` - Production (relative URLs)
- `client/src/services/api.ts` - Uses `VITE_API_URL`
- `client/src/contexts/SocketContext.tsx` - Uses `VITE_API_URL`
- `server/src/index.ts` - CORS configuration for development

## No Production Impact
✅ All production URLs remain unchanged
✅ No hardcoded production URLs in code
✅ Environment-based configuration
✅ Same codebase works for dev and prod
