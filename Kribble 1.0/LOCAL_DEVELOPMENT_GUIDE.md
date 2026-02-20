# Local Development Guide - Kribble

## 🎯 Quick Start (TL;DR)

Your project is **already configured** for local development! Just run:

```bash
# Terminal 1 - Start Server
cd server
npm run dev

# Terminal 2 - Start Client
cd client
npm run dev
```

Then open http://localhost:5173 in your browser.

## ✅ Current Configuration Status

### What's Already Working

| Component | Status | Configuration |
|-----------|--------|---------------|
| API URL | ✅ | Uses `VITE_API_URL` env var, falls back to empty (proxy) |
| Socket URL | ✅ | Uses `VITE_SOCKET_URL` env var, falls back to empty (proxy) |
| CORS | ✅ | Server allows localhost:5173, 3000, 4173 |
| Vite Proxy | ✅ | Auto-proxies /api and /socket.io to :3001 |
| Type Definitions | ✅ | Vite env types defined in `vite-env.d.ts` |

### Files Already Configured

1. **Client API** (`client/src/services/api.ts`):
   ```typescript
   const API_URL = import.meta.env.VITE_API_URL || '';
   ```

2. **Client Socket** (`client/src/contexts/SocketContext.tsx`):
   ```typescript
   const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';
   ```

3. **Server CORS** (`server/src/index.ts`):
   ```typescript
   const corsOrigins = isProduction 
     ? (process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : ['*'])
     : ['http://localhost:5173', 'http://localhost:3000', ...];
   ```

4. **Vite Config** (`client/vite.config.ts`):
   ```typescript
   server: {
     proxy: {
       '/api': { target: 'http://localhost:3001', changeOrigin: true },
       '/socket.io': { target: 'http://localhost:3001', ws: true },
     },
   }
   ```

## 🚀 Development Modes

### Mode 1: Vite Proxy (Recommended - Simplest)

**How it works:** Vite dev server proxies API calls to your backend automatically.

**Setup:**
1. No environment files needed!
2. Start server: `cd server && npm run dev` (port 3001)
3. Start client: `cd client && npm run dev` (port 5173)
4. Open http://localhost:5173

**Pros:**
- ✅ Zero configuration
- ✅ No CORS issues
- ✅ Hot reload works perfectly
- ✅ Same as production paths

**Cons:**
- ❌ Can't test on mobile devices on same network
- ❌ Can't run client and server on different machines

### Mode 2: Explicit URLs (For Mobile/Network Testing)

**How it works:** Set explicit URLs to connect to server.

**Setup:**
1. Create `client/.env.local`:
   ```env
   VITE_API_URL=http://localhost:3001
   VITE_SOCKET_URL=http://localhost:3001
   ```

2. Start services as normal

3. For mobile testing, use your IP:
   ```env
   VITE_API_URL=http://192.168.1.100:3001
   VITE_SOCKET_URL=http://192.168.1.100:3001
   ```

**Pros:**
- ✅ Works across network (mobile testing)
- ✅ Can run on different machines
- ✅ More explicit control

**Cons:**
- ❌ Need to manage environment files
- ❌ CORS must be properly configured
- ❌ Must restart Vite after changes

### Mode 3: Production Build Locally

**How it works:** Build client and serve from server (true production simulation).

**Setup:**
1. Build client:
   ```bash
   cd client
   npm run build
   ```

2. Start server in production mode:
   ```bash
   cd server
   NODE_ENV=production npm start
   ```

3. Open http://localhost:3001

**Pros:**
- ✅ Exact production behavior
- ✅ Tests production build
- ✅ No CORS issues (same-origin)

**Cons:**
- ❌ No hot reload
- ❌ Must rebuild after changes
- ❌ Slower development cycle

## 🔧 Environment Files Reference

### Client Environment Files

| File | Purpose | Commit to Git? |
|------|---------|----------------|
| `.env.development` | Dev defaults (empty = use proxy) | ✅ Yes |
| `.env.production` | Production defaults (empty = same-origin) | ✅ Yes |
| `.env.local` | Local overrides (your machine only) | ❌ No |
| `.env.development.local` | Dev-specific overrides | ❌ No |

### Server Environment Variables

Create `server/.env` (not committed):
```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=./data/kribble.db

# Auth
JWT_SECRET=your-secret-key-here

# Optional: Redis (for new features)
REDIS_URL=redis://localhost:6379

# Optional: CORS override
# CORS_ORIGIN=http://localhost:5173
```

## 🐛 Troubleshooting

### Problem: "Cannot connect to server"

**Symptoms:** API calls fail, socket won't connect, CORS errors

**Checklist:**

1. **Is server running?**
   ```bash
   curl http://localhost:3001/api/health
   # Should return: {"status":"ok",...}
   ```

2. **Check server logs:**
   - Look for "Server running on port 3001"
   - Look for CORS origins list

3. **Check browser console:**
   - CORS errors = server not allowing your origin
   - Connection refused = server not running
   - 404 errors = wrong API path

4. **Verify ports:**
   - Server should be on :3001
   - Client should be on :5173
   - No other services using these ports

### Problem: "Still connecting to production"

**Symptoms:** API calls go to render.com or railway.app

**Solutions:**

1. **Clear browser cache:**
   - DevTools > Network > Disable cache (checkmark)
   - Or hard refresh: Ctrl+Shift+R (Windows) / Cmd+Shift+R (Mac)

2. **Check environment files:**
   ```bash
   # Should be empty or localhost
   cat client/.env.local
   cat client/.env.development.local
   ```

3. **Clear localStorage:**
   ```javascript
   // In browser console
   localStorage.clear();
   location.reload();
   ```

4. **Restart Vite:**
   - Stop client dev server
   - Start again: `npm run dev`

5. **Check for hardcoded URLs in your code:**
   ```bash
   grep -r "onrender.com\|railway.app" client/src/
   ```

### Problem: "CORS errors in browser"

**Symptoms:** Requests blocked, CORS policy errors

**Solutions:**

1. **Verify server CORS config:**
   - Check `server/src/index.ts` includes your client URL
   - Default includes: 5173, 3000, 4173

2. **If using custom port:**
   ```typescript
   // Add to server/src/index.ts
   : ['http://localhost:5173', 'http://localhost:3000', 
      'http://localhost:YOUR_PORT', ...]
   ```

3. **If using explicit URLs (Mode 2):**
   - Ensure `VITE_API_URL` matches server port
   - Check server is actually running on that port

### Problem: "Mobile device can't connect"

**Symptoms:** Works on computer, fails on phone/tablet

**Solutions:**

1. **Use Mode 2 (Explicit URLs):**
   ```env
   # client/.env.local
   VITE_API_URL=http://YOUR_COMPUTER_IP:3001
   VITE_SOCKET_URL=http://YOUR_COMPUTER_IP:3001
   ```

2. **Find your IP:**
   ```bash
   # Windows
   ipconfig
   
   # Mac/Linux
   ifconfig | grep "inet "
   ```

3. **Ensure same network:**
   - Computer and mobile must be on same WiFi
   - Test: `ping YOUR_COMPUTER_IP` from another device

4. **Check firewall:**
   - Allow Node.js through Windows Firewall
   - Temporarily disable firewall for testing

## 📱 Mobile Development Tips

### Using the Mobile Tunnel Script

The project includes a PowerShell script for mobile testing:

```bash
# Run from project root
./scripts/mobile-tunnel.ps1
```

This creates a tunnel to expose your local server publicly.

### Manual Mobile Testing

1. **Get your computer's IP address** (e.g., 192.168.1.100)

2. **Create `client/.env.local`:**
   ```env
   VITE_API_URL=http://192.168.1.100:3001
   VITE_SOCKET_URL=http://192.168.1.100:3001
   ```

3. **Update server CORS** (if needed):
   ```typescript
   : ['http://localhost:5173', 'http://192.168.1.100:5173', ...]
   ```

4. **Start services:**
   ```bash
   cd server && npm run dev
   cd client && npm run dev
   ```

5. **On mobile device:**
   - Open http://192.168.1.100:5173
   - Or use the network IP shown in Vite startup

## 🔍 Verifying Your Setup

Run this checklist:

```bash
# 1. Server health check
curl http://localhost:3001/api/health

# 2. Check server CORS config
# (Look in server console output for "CORS origins:")

# 3. Check client env
cd client
npm run dev
# Look for "Local: http://localhost:5173" in output

# 4. Browser check
# Open http://localhost:5173
# Open DevTools > Network
# Verify API calls go to :3001 (or same origin if using proxy)
```

## 🎓 Understanding the Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Client (Vite) │         │  Server (Node)  │
│   localhost:5173│         │  localhost:3001 │
│                 │         │                 │
│  ┌───────────┐  │         │  ┌───────────┐  │
│  │  React    │  │◄────────►│  │  Express  │  │
│  │  (UI)     │  │  Proxy   │  │  (API)    │  │
│  └───────────┘  │  /api    │  └───────────┘  │
│                 │  /socket │                 │
│  ┌───────────┐  │         │  ┌───────────┐  │
│  │  Socket   │◄─┼─────────┼──┤  Socket   │  │
│  │  .io      │  │ WebSocket│  │  .io      │  │
│  └───────────┘  │         │  └───────────┘  │
└─────────────────┘         └─────────────────┘
         │
         │ Hot Reload
         ▼
   Vite Dev Server
```

## 📝 Common Commands

```bash
# Start development (Proxy Mode)
cd server && npm run dev
cd client && npm run dev

# Start with explicit URLs (Mode 2)
# (Create .env.local first)
cd server && npm run dev
cd client && npm run dev

# Build for production
cd client && npm run build
cd server && NODE_ENV=production npm start

# Test production build locally
cd client && npm run build
cd server && npm start
# Open http://localhost:3001

# Clear everything and restart
cd client && rm -rf node_modules dist && npm install
cd server && rm -rf node_modules data && npm install
```

## ✅ Summary

Your project is **already properly configured** for local development:

- ✅ No hardcoded production URLs
- ✅ Environment-based configuration
- ✅ Vite proxy for seamless development
- ✅ CORS configured for common ports
- ✅ Type definitions in place
- ✅ Documentation complete

**If you're still having issues**, they're likely due to:
1. Cached browser data (clear cache/localStorage)
2. Server not running on expected port
3. Custom code with hardcoded URLs (check your additions)
4. Firewall/network issues (for mobile testing)

**The URL configuration is complete and working!** 🚀
