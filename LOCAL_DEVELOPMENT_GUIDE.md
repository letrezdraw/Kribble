# Local Development Guide

This guide explains how to run the Kribble project locally for development without affecting production configurations.

## Quick Start

### 1. Start the Server

```bash
cd server

# Install dependencies (if not already done)
npm install

# The server will automatically use .env.development
npm run dev
```

Server will start on `http://localhost:3001`

### 2. Start the Client

```bash
cd client

# Install dependencies (if not already done)
npm install

# The client will automatically use .env.development
npm run dev
```

Client will start on `http://localhost:5173`

### 3. Open in Browser

Navigate to `http://localhost:5173`

The client will automatically connect to the local server at `http://localhost:3001`

## Environment Files Explained

### Client Environment Files

| File | Purpose | When Used |
|------|---------|-----------|
| `.env.development` | Local development settings | `npm run dev` |
| `.env.production` | Production build settings | `npm run build` |

### Server Environment Files

| File | Purpose | When Used |
|------|---------|-----------|
| `.env.development` | Local development settings | `npm run dev` (when NODE_ENV=development) |
| `.env.example` | Template for creating `.env` | Reference only |

## How It Works

### Client (Vite)

Vite automatically loads environment files based on the current mode:

- **Development mode** (`npm run dev`): Loads `.env.development`
- **Production mode** (`npm run build`): Loads `.env.production`

The client uses these variables:
- `VITE_API_URL`: Base URL for API requests
- `VITE_SOCKET_URL`: Base URL for Socket.io connections

### Server (Node.js)

The server uses `dotenv` to load environment variables. In development, it will use `.env.development`.

The server uses these variables:
- `PORT`: Server port (default: 3001)
- `DATABASE_URL`: Database connection string
- `JWT_SECRET`: Secret for JWT tokens
- `CORS_ORIGIN`: Allowed frontend origin

## Customizing Ports

### Change Server Port

Edit `server/.env.development`:
```env
PORT=3002
```

Then update `client/.env.development`:
```env
VITE_API_URL=http://localhost:3002
VITE_SOCKET_URL=http://localhost:3002
```

### Change Client Port

Edit `client/package.json` and modify the dev script:
```json
"dev": "vite --port 3000"
```

Then update `server/.env.development`:
```env
CORS_ORIGIN=http://localhost:3000
```

## Common Issues

### CORS Errors

If you see CORS errors in the browser console:

1. Check that `CORS_ORIGIN` in `server/.env.development` matches your client URL
2. Ensure the server was restarted after changing `.env` files

### Connection Refused

If the client can't connect to the server:

1. Verify the server is running: `curl http://localhost:3001/api/health`
2. Check that `VITE_API_URL` in `client/.env.development` matches the server port
3. Restart both client and server after changing environment files

### Environment Variables Not Loading

If changes to `.env` files don't take effect:

1. **Client**: Restart the Vite dev server (`npm run dev`)
2. **Server**: Restart the Node.js server

## Production vs Development

### Development (Local)
- SQLite database (local file)
- Separate client and server ports
- Debug logging enabled
- CORS allows localhost

### Production (Render/Railway)
- PostgreSQL database
- Same-origin requests (client served by server)
- Debug logging disabled
- CORS configured for production domain

## Switching Between Environments

### To test production build locally:

1. Build the client:
   ```bash
   cd client
   npm run build
   ```

2. The server will serve the built client from `client/dist`

3. Start the server in production mode:
   ```bash
   cd server
   NODE_ENV=production npm start
   ```

4. Access at `http://localhost:3001`

## Security Notes

- **Never commit `.env` files** with real secrets
- `.env.example` files are safe to commit (they contain templates)
- `.env.development` and `.env.production` are tracked in git for convenience
- For production, always use environment variables set in your hosting platform (Render, Railway, etc.)

## Troubleshooting Checklist

- [ ] Server is running (`npm run dev` in server directory)
- [ ] Client is running (`npm run dev` in client directory)
- [ ] Ports match between client and server config
- [ ] CORS origin is correctly set
- [ ] No other services using the same ports
- [ ] Environment files are properly formatted (no spaces around `=`)

## Need Help?

Check the logs:
- Server logs appear in the terminal where you ran `npm run dev`
- Client logs appear in the browser console (F12 → Console)
- Network requests can be debugged in browser DevTools → Network tab
