# K3.0 - Getting Started Guide

## Prerequisites

Before running K3.0, make sure you have:
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **PostgreSQL** (v14 or higher) - for database
- **Redis** (v6 or higher) - for caching/pub-sub

---

## Quick Start (Local Development)

### Option 1: Using Docker (Recommended)

The easiest way to start all services:

```
bash
# Navigate to K3.0 directory
cd K3.0

# Start PostgreSQL and Redis using docker-compose
docker-compose up -d

# This starts:
# - PostgreSQL on localhost:5432
# - Redis on localhost:6379
```

### Option 2: Manual Setup

If you prefer running databases locally:

1. **Start PostgreSQL:**
   
```
bash
   # On macOS with Homebrew
   brew services start postgresql
   
   # On Ubuntu/Debian
   sudo systemctl start postgresql
   
```

2. **Start Redis:**
   
```
bash
   # On macOS with Homebrew
   brew services start redis
   
   # On Ubuntu/Debian
   sudo systemctl start redis
   
```

3. **Create the database:**
   
```bash
   createdb kribble
   
```

---

## Environment Setup

### 1. Copy environment file

```
bash
cp .env.example .env
```

### 2. Update .env with your values

```
env
# Server
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# Database - UPDATE THIS
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/kribble

# Redis - UPDATE THIS  
REDIS_URL=redis://localhost:6379

# JWT Secret - CHANGE IN PRODUCTION
JWT_SECRET=your-dev-secret-key

# Allowed CORS origins (comma-separated)
CORS_ORIGIN=http://localhost:5173,http://localhost:5174
```

**Note:** Update `DATABASE_URL` with your PostgreSQL username and password.

---

## Install Dependencies

```
bash
# From K3.0 root directory
npm install
```

This will install dependencies for all workspaces (server, web-desktop, web-mobile, and packages).

---

## Database Setup

```
bash
# Navigate to server
cd apps/server

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push
```

---

## Running the Application

### Start the Server

```
bash
# From K3.0 root or apps/server directory
npm run dev --workspace=@kribble/server

# Or directly
cd apps/server
npm run dev
```

The server will start on `http://localhost:4000`

### Start the Web Desktop Client

```
bash
# Open a new terminal
npm run dev --workspace=@kribble/web-desktop
```

The web app will start on `http://localhost:5173`

### Start All Services (Concurrent)

```
bash
# From K3.0 root
npm run dev
```

This starts:
- Server on port 4000
- Web Desktop on port 5173
- Web Mobile on port 5174

---

## Verify It's Working

1. **Health Check:**
   
```
   http://localhost:4000/health
   
```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Web App:**
   
```
   http://localhost:5173
   
```
   Should show the Kribble home page.

3. **API Test - Create Guest User:**
   
```
bash
   curl -X POST http://localhost:4000/auth/guest \
     -H "Content-Type: application/json" \
     -d '{"displayName":"TestPlayer"}'
   
```

---

## Common Issues

### "Cannot find module" errors
```bash
# Rebuild all packages
npm run build
```

### Database connection errors
- Verify PostgreSQL is running: `pg_isready`
- Check your `DATABASE_URL` in `.env`
- Make sure the database exists: `createdb kribble`

### Redis connection errors
- Verify Redis is running: `redis-cli ping`
- Should return: `PONG`

### Port already in use
- Server defaults to port 4000
- Web Desktop defaults to port 5173
- Change in `.env` or use a different terminal

---

## Project Structure

```
K3.0/
├── apps/
│   ├── server/          # Backend API & WebSocket server
│   ├── web-desktop/    # Desktop web app (React + Vite)
│   └── web-mobile/      # Mobile web app
├── packages/
│   ├── drawing-engine/  # Canvas drawing logic
│   ├── game-engine/    # Game state machine
│   └── shared-types/   # Shared TypeScript types
├── docker-compose.yml   # Docker services
└── .env.example        # Environment template
```

---

## Next Steps

After getting it running:

1. **Explore the UI** - Go to http://localhost:5173
2. **Test authentication** - Click "Play as Guest"
3. **Create a room** - Click "Create New Room"
4. **Test multiplayer** - Open in two browser windows

---

## Production Deployment

For production deployment, see:
- `K3.0/PRODUCTION_PLAN.md` - Full production guide
- `K3.0/docker-compose.yml` - Container orchestration
