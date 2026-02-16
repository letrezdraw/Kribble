# Mobile Testing Scripts

These scripts help you expose your local Kribble development server to the internet for testing on mobile devices.

## Quick Start

### Option 1: Simple Batch Script (Easiest)
```bash
npm run tunnel
```
This opens ngrok in a new window. Just copy the HTTPS URL and update your `.env` file.

### Option 2: PowerShell Script (Advanced)
```bash
npm run tunnel:ps
```
Interactive script that:
- Checks if servers are running
- Configures ngrok automatically
- Updates your `.env.development.local` file
- Supports multiple tunnel providers

### Option 3: Direct ngrok
```bash
npm run tunnel:ngrok
```
If you already have ngrok configured and just want to start it.

### Get Your Local IP
```bash
npm run ip
```
Shows your local IP for WiFi testing (phone must be on same network).

## Setup

1. **Install ngrok:**
   ```bash
   choco install ngrok
   # OR download from https://ngrok.com/download
   ```

2. **Configure ngrok:**
   ```bash
   ngrok config add-authtoken YOUR_TOKEN
   ```
   Get your token from: https://dashboard.ngrok.com/get-started/your-authtoken

3. **Start your dev servers:**
   ```bash
   npm run dev
   ```

4. **Run the tunnel script:**
   ```bash
   npm run tunnel
   ```

5. **Update environment file:**
   Copy the ngrok HTTPS URL to `client/.env.development.local`:
   ```env
   VITE_API_URL=https://xxxx.ngrok.io
   VITE_SOCKET_URL=https://xxxx.ngrok.io
   ```

6. **Restart frontend dev server** to pick up new env vars

7. **Access from phone:**
   - Via local WiFi: `http://YOUR_PC_IP:5173`
   - Via ngrok: `https://xxxx.ngrok.io`

## Files

- `mobile-tunnel.bat` - Simple Windows batch script
- `mobile-tunnel.ps1` - Full-featured PowerShell script
- `README.md` - This file

## Troubleshooting

| Issue | Solution |
|-------|----------|
| ngrok not found | Install with `choco install ngrok` |
| CORS errors | Update `server/.env.development` CORS_ORIGIN with ngrok URL |
| WebSocket fails | Use `wss://` instead of `ws://` for HTTPS tunnels |
| Connection refused | Check Windows Firewall, allow ports 3001 and 5173 |
| Phone can't connect | Ensure phone and PC are on same WiFi |

## Alternative: Local IP Only

If you don't need internet access, just use your local IP:

```bash
# Get your IP
npm run ip

# Access from phone on same WiFi
http://192.168.x.x:5173
```

No tunnel needed, but only works on same network.
