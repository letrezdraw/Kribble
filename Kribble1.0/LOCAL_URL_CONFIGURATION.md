# Local Development URL Configuration Guide

This guide explains how the Kribble project handles URLs for local development vs production, ensuring no hardcoded URLs break your local setup.

## Overview

The project uses **environment variables** to configure API and WebSocket URLs, allowing seamless switching between:
- **Local Development**: Running on `localhost` with separate or combined client/server
- **Production**: Deployed on Render/Railway with same-origin serving

## How It Works

### Client-Side Configuration

The client uses Vite environment variables (prefixed with `VITE_`):

```typescript
// client/src/services/api.ts
const API_URL = import.meta.env.VITE_API_URL || '';

// client/src/contexts/SocketContext.tsx  
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
```

### Server-Side Configuration

The server uses standard Node.js environment variables:

```typescript
// server/src/index.ts
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigins = isProduction 
  ? (process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : ['*'])
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173'];
```

## Environment Files

### Committed to Git (Safe Defaults)

| File | Purpose |
|------|---------|
| `.env.example` | Template showing all available variables |
| `client/.env.development` | Development defaults (empty URLs for proxy) |
| `client/.env.production` | Production defaults (empty for same-origin) |

### NOT Committed to Git (Local Secrets)

| File | Purpose |
|------|---------|
| `.env` | Root server environment variables |
| `client/.env.local` | Local client overrides |
| `client/.env.development.local` | Development-specific overrides |

## Setup for Local Development

### Option 1: Using Vite Proxy (Recommended)

The `client/vite.config.ts` already includes a proxy configuration:

```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3001',
      changeOrigin: true,
    },
    '/socket.io': {
      target: 'http://localhost:3001',
      ws: true,
    },
  },
}
```

**Steps:**
1. Leave `client/.env.development` with empty URLs (default)
2. Start server: `cd server && npm run dev` (runs on :3001)
3. Start client: `cd client && npm run dev` (runs on :5173)
4. Vite automatically proxies API calls to the server

### Option 2: Separate Ports (No Proxy)

If you prefer explicit URLs:

1. Create `client/.env.local`:
```env
VITE_API_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
```

2. Update `server/src/index.ts` CORS to include your client port (already done by default)

3. Start both services

### Option 3: Production Build Locally

To test production build locally:

1. Build client: `cd client && npm run build`
2. Start server in production mode: `cd server && NODE_ENV=production npm start`
3. Server serves static files from `client/dist` on same origin

## Common Issues & Solutions

### Issue: "Cannot connect to server"

**Symptoms:** API calls fail, socket won't connect

**Solutions:**
1. Check server is running on correct port (default: 3001)
2. Verify CORS origins in `server/src/index.ts` include your client URL
3. Check browser console for CORS errors
4. Ensure environment variables are loaded (restart Vite/server after changes)

### Issue: "Hardcoded URLs in code"

**Check:** Search for patterns like:
- `http://localhost` (should use env vars)
- `kribble.onrender.com` (should use env vars)
- Port numbers like `:3001`, `:5173` (should use env vars)

**Fix:** Replace with:
```typescript
const URL = import.meta.env.VITE_API_URL || '';
// or for server
const port = process.env.PORT || 3001;
```

### Issue: "Production URLs in development"

**Symptoms:** API calls go to production instead of localhost

**Solutions:**
1. Check `client/.env.local` doesn't have production URLs
2. Verify `client/.env.development` has empty or localhost URLs
3. Clear browser cache/localStorage
4. Restart Vite dev server

## Production Deployment

### Render/Railway Configuration

Set these environment variables in your deployment platform:

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `production` | Enables production mode |
| `PORT` | `3001` | Server port (platform may override) |
| `DATABASE_URL` | (provided by platform) | PostgreSQL connection |
| `JWT_SECRET` | (generate strong secret) | Auth token signing |
| `CORS_ORIGIN` | (optional) | Specific frontend URL if needed |

**Note:** Client `VITE_API_URL` and `VITE_SOCKET_URL` should be **empty** in production because the Express server serves the client (same-origin).

## Quick Reference

### Start Development

```bash
# Terminal 1 - Server
cd server
npm run dev

# Terminal 2 - Client  
cd client
npm run dev
```

### Build for Production

```bash
# Build client
cd client
npm run build

# Server will serve client/dist in production mode
cd ../server
NODE_ENV=production npm start
```

### Environment Variable Priority (Vite)

1. `.env.[mode].local` (highest priority)
2. `.env.local`
3. `.env.[mode]` (e.g., `.env.development`)
4. `.env` (lowest priority)

## Migration from Hardcoded URLs

If you have existing hardcoded URLs:

1. **Find them:** Search for `localhost`, `render.com`, `railway.app`, port numbers
2. **Replace with:** `import.meta.env.VITE_API_URL` (client) or `process.env.PORT` (server)
3. **Add to .env files:** Create appropriate defaults
4. **Test:** Verify both local and production builds work

## Summary

✅ **No hardcoded URLs in source code** - All use environment variables  
✅ **Safe defaults committed** - `.env.development`, `.env.production`  
✅ **Local secrets ignored** - `.env.local` files in `.gitignore`  
✅ **Flexible configuration** - Works with proxy or separate ports  
✅ **Production ready** - Same-origin serving on Render/Railway
