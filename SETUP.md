# Kribble Project Setup Guide

## Overview
This document provides instructions to complete the setup of the Kribble multiplayer drawing game after the fixes have been applied.

## Changes Made

### Phase 1: Critical Infrastructure Fixes ✅
1. **Created `shared/` workspace** - Shared TypeScript types for client/server communication
2. **Fixed SocketContext** - Changed from `window.location.origin` to `http://localhost:3001`
3. **Fixed GameContext** - Changed socket listeners from `useCallback` to `useEffect` (critical bug fix!)
4. **Verified main.tsx** - Provider setup is correct

### Phase 2: Server Improvements ✅
1. **Added database layer** (`server/src/db/index.ts`)
   - SQLite database with better-sqlite3
   - Tables: users, matches, match_players, word_categories, achievements
   - Default word categories with 100+ words
2. **Updated auth routes** to use database
3. **Added missing routes**:
   - `/api/users` - User profiles, stats, history, leaderboard
   - `/api/words` - Word categories and word lists
4. **Updated socket handlers** to use database for word generation

### Phase 3: Client Improvements ✅
1. **Created DrawingCanvas component** with Fabric.js
   - Real-time drawing synchronization
   - Brush, eraser tools
   - Undo/clear functionality
2. **Updated GameRoom** to use new DrawingCanvas
3. **Added UI components**:
   - Input component with validation styling
   - Card component
   - Modal component with animations

## Installation Steps

### 1. Install Root Dependencies
```bash
cd d:/Save/Git/Repos/Kribble
npm install
```

### 2. Install Server Dependencies
```bash
cd server
npm install
```

### 3. Install Client Dependencies
```bash
cd ../client
npm install
```

### 4. Install Shared Dependencies
```bash
cd ../shared
npm install
```

### 5. Build Shared Package
```bash
npm run build
```

### 6. Create Data Directory
```bash
cd ../server
mkdir data
```

## Running the Application

### Development Mode (Recommended)
From the root directory:
```bash
npm run dev
```

This will start:
- Server on http://localhost:3001
- Client on http://localhost:5173

### Individual Servers
Server only:
```bash
npm run dev:server
```

Client only:
```bash
npm run dev:client
```

## Project Structure
```
kribble/
├── client/          # React + Vite frontend
├── server/          # Node.js + Express + Socket.io backend
│   ├── src/
│   │   ├── db/      # Database layer (SQLite)
│   │   ├── routes/  # API routes
│   │   └── socket/  # Socket.io handlers
│   └── data/        # SQLite database file
├── shared/          # Shared TypeScript types
└── package.json     # Workspace root
```

## Key Features Implemented
- ✅ User authentication (register/login)
- ✅ Room creation and joining
- ✅ Real-time drawing with Fabric.js
- ✅ Drawing synchronization across clients
- ✅ Word guessing system
- ✅ Timer and round management
- ✅ Score tracking
- ✅ Chat system
- ✅ Player list with roles (host/drawer)

## Remaining TODOs
- [ ] Add more drawing tools (shapes, text)
- [ ] Implement player profiles with stats
- [ ] Add XP/leveling system
- [ ] Add achievements
- [ ] Implement match history
- [ ] Add sound effects
- [ ] Add mobile responsiveness improvements
- [ ] Add reconnection logic
- [ ] Add profanity filter
- [ ] Implement private rooms with passwords

## Troubleshooting

### TypeScript Errors
The TypeScript errors shown in the editor will resolve after running `npm install` in each workspace.

### Database Issues
If you encounter database errors:
1. Ensure the `server/data/` directory exists
2. Delete `server/data/kribble.db` to reset the database
3. Restart the server

### Socket Connection Issues
- Ensure server is running on port 3001
- Check that CORS is properly configured in `server/src/index.ts`
- Verify client is connecting to `http://localhost:3001`

## Environment Variables (Optional)
Create a `.env` file in the server directory:
```
JWT_SECRET=your-secret-key-here
PORT=3001
```

## Next Steps
1. Run the installation commands above
2. Start the development server with `npm run dev`
3. Open http://localhost:5173 in your browser
4. Register a new account and test the game!
