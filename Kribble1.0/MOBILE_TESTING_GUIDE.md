# Mobile Testing Guide - Expose Localhost to Internet

This guide explains how to test your Kribble app on mobile devices during development.

## Quick Options Comparison

| Tool | Setup Time | URL Type | Free Tier | Best For |
|------|-----------|----------|-----------|----------|
| **ngrok** | 2 min | Random/Static | Yes | Quick testing |
| **Cloudflare Tunnel** | 10 min | Permanent | Yes | Regular testing |
| **LocalTunnel** | 0 min | Random | Yes | One-time use |
| **Tailscale** | 5 min | Private IP | Yes | Team testing |

---

## Option 1: ngrok (Recommended)

### Installation
```bash
# Windows (Chocolatey)
choco install ngrok

# Or download from https://ngrok.com/download
```

### Setup
1. Sign up at https://ngrok.com
2. Get your authtoken from dashboard
3. Configure:
```bash
ngrok config add-authtoken YOUR_TOKEN
```

### Usage for Kribble

Since you have TWO servers (Frontend: 5173, Backend: 3001), you need both exposed:

**Terminal 1 - Backend:**
```bash
ngrok http 3001
```
Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)

**Update `.env.development`:**
```env
VITE_API_URL=https://abc123.ngrok.io
VITE_SOCKET_URL=https://abc123.ngrok.io
```

**Terminal 2 - Frontend:**
```bash
cd client
npm run dev
```

**Access from phone:**
- Use the ngrok HTTPS URL
- Or use your PC's local IP: `http://192.168.x.x:5173`

### Get Static Domain (Free)
```bash
# Reserve at https://dashboard.ngrok.com/cloud-edge/domains
ngrok http --domain=your-name.ngrok-free.app 3001
```

---

## Option 2: Cloudflare Tunnel (Permanent URL)

### Installation
```bash
# Windows
# Download from https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
```

### Setup
```bash
# Login
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create kribble-dev

# Configure routes
cloudflared tunnel route dns kribble-dev kribble-api.yourdomain.com

# Run tunnel
cloudflared tunnel run kribble-dev
```

**Pros:** Free permanent URL, no session limits

---

## Option 3: LocalTunnel (No Install)

```bash
# Backend
npx localtunnel --port 3001

# Frontend (separate terminal)
npx localtunnel --port 5173
```

**Pros:** Zero setup, instant
**Cons:** Random URLs every time

---

## Option 4: Tailscale (Private Network)

Best for secure testing across multiple devices.

```bash
# Install: https://tailscale.com/download
tailscale up

# Get your IP
tailscale ip -4
# Returns: 100.x.x.x

# Access from phone
# Install Tailscale app, login, access 100.x.x.x:5173
```

---

## Finding Your Local IP

```bash
# Windows
ipconfig | findstr "IPv4"

# macOS/Linux
ifconfig | grep "inet "
```

Use this IP on devices connected to the same WiFi:
- Frontend: `http://192.168.x.x:5173`
- Backend: `http://192.168.x.x:3001`

---

## Automated Scripts (New!)

We've created automated scripts to make this even easier:

### Quick Start with Scripts:
```bash
# Simple batch script (easiest)
npm run tunnel

# Or full PowerShell script with auto-configuration
npm run tunnel:ps

# Just get your local IP
npm run ip
```

### What the scripts do:
1. Check if ngrok is installed
2. Start the tunnel on port 3001
3. Auto-detect your local IP
4. Guide you through updating environment files
5. Open ngrok in a new window

See `scripts/README.md` for detailed usage.

---

## Recommended Workflow for Kribble

### For Quick Mobile Testing (Manual):
```bash
# 1. Start backend
cd server && npm run dev

# 2. In new terminal, expose backend
ngrok http 3001

# 3. Copy the HTTPS URL and update client/.env.development.local:
# VITE_API_URL=https://xxxx.ngrok.io
# VITE_SOCKET_URL=https://xxxx.ngrok.io

# 4. Start frontend
cd client && npm run dev

# 5. On your phone, open:
# - The ngrok URL for API testing
# - Or http://YOUR_PC_IP:5173 for the app
```

### For Quick Mobile Testing (Using Scripts):
```bash
# 1. Start all dev servers
npm run dev

# 2. In new terminal, run tunnel script
npm run tunnel

# 3. Follow the prompts to update .env file
# 4. Restart frontend if needed
# 5. Access from phone using the displayed IP or ngrok URL
```


### For Regular Development:
Set up **Cloudflare Tunnel** once with a permanent domain, then just run:
```bash
cloudflared tunnel run kribble-dev
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| CORS errors | Update `server/.env.development` CORS_ORIGIN with ngrok URL |
| WebSocket fails | Use `wss://` instead of `ws://` for HTTPS tunnels |
| Connection refused | Check firewall, allow ports 3001 and 5173 |
| Phone can't connect | Ensure phone and PC are on same WiFi |

---

## Security Note

⚠️ **Never commit tunnel URLs to git!**  
Use `.env.development.local` (already in `.gitignore`) for temporary URLs.
