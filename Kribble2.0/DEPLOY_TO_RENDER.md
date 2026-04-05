# Deploy Kribble 2.0 to Render (Single Service)

This guide will help you deploy Kribble 2.0 as a single web service (backend + frontend combined) to Render.

## Prerequisites

1. A Render account (https://render.com)
2. Your code pushed to a Git repository (GitHub, GitLab, etc.)

## How It Works

The single service deployment:
- Builds the React frontend during Docker build
- Serves static files from the backend Express server
- WebSocket (Socket.io) runs on the same port
- **PostgreSQL database for production data persistence**
- One URL serves both API and frontend

## Database

Render automatically creates a **free PostgreSQL database** (`kribble-2-db`) with:
- Rooms table: Stores room data with JSONB
- Game states table: Stores game state data
- Automatic cleanup of old rooms (24+ hours)
- SSL connection in production

### How Database Connection Works

The connection is **automatic** - no manual steps needed:

1. **Render Blueprint** (`render.yaml`) defines the database service:
   ```yaml
   - type: postgres
     name: kribble-2-db
     ipAllowList: []
     plan: free
   ```

2. **Environment variable** `DATABASE_URL` is auto-injected into your web service:
   ```yaml
   - key: DATABASE_URL
     fromDatabase:
       name: kribble-2-db
       property: connectionString
   ```

3. **Server auto-connects** on startup (`app.ts`):
   ```typescript
   DatabaseService.initialize()
   ```

### Verify Database Connection

After deployment, check the logs:
1. Go to your service dashboard → **Logs** tab
2. Look for these messages:
   ```
   DatabaseService: PostgreSQL pool initialized
   DatabaseService: Tables initialized
   ```

### Manual Database Connection (if needed)

If you want to connect manually (e.g., for debugging):

1. **Get connection string** from Render dashboard:
   - Go to **kribble-2-db** service
   - Copy the **Internal Database URL** or **External Database URL**

2. **Connect via psql**:
   ```bash
   psql "your-database-url-here"
   ```

3. **View tables**:
   ```sql
   \dt
   SELECT * FROM rooms;
   SELECT * FROM game_states;
   ```

### Database Schema

**rooms** table:
- `id` (VARCHAR(10) PRIMARY KEY)
- `data` (JSONB) - room configuration, players, settings
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**game_states** table:
- `room_id` (VARCHAR(10) PRIMARY KEY, FK to rooms)
- `data` (JSONB) - current game state, scores, turns
- `updated_at` (TIMESTAMP)



## Deployment Steps

### Option 1: Using Render Blueprint (Recommended)

1. **Push your code to GitHub**
   ```bash
   git add .
   git commit -m "Prepare for Render deployment"
   git push origin main
   ```

2. **Go to Render Dashboard**
   - Visit https://dashboard.render.com
   - Click "New" → "Blueprint"
   - Connect your GitHub repository
   - Select the root folder (where `render.yaml` is located)


3. **Render will automatically:**
   - Create a single web service (`kribble-2`)
   - Build both client and server in one Docker image
   - Deploy with health checks
   - Provide you with a single URL

### Option 2: Manual Deployment

1. Go to https://dashboard.render.com
2. Click "New" → "Web Service"
3. Connect your repository
4. Configure:
   - **Name**: `kribble-2`
   - **Root Directory**: `Kribble-Server`

   - **Runtime**: Docker
   - **Dockerfile Path**: `./Dockerfile`
   - **Port**: 5000
5. Environment Variables (auto-set):
   - `PORT`: 5000
   - `DOODLE_CLIENT_URL`: `http://localhost:5000`
   - `NODE_ENV`: production
6. Click "Create Web Service"

## Post-Deployment

### Verify Deployment

1. **Check Health**:
   ```
   https://kribble-2.onrender.com/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Open the App**:
   Visit `https://kribble-2.onrender.com` in your browser

3. **Test Features**:
   - Create a room
   - Join from another device
   - Test drawing sync

### Troubleshooting

**Build Failures**:
- Check the build logs in Render dashboard
- Ensure `Kribble-Client` folder exists and has package.json
- Verify the Dockerfile can access `../Kribble-Client`


**404 Errors on Refresh**:
- This is handled by the catch-all route in `app.ts`
- If it doesn't work, check that the build folder exists at `../Kribble-Client/build`


**CORS Errors**:
- With single service, CORS should not be an issue
- If you see CORS errors, check `DOODLE_CLIENT_URL` is set correctly

## Free Tier Limitations

On Render's free tier:
- Service spins down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- WebSocket connections may be interrupted during spin-down

## Files Changed for Deployment

1. `Kribble-Client/package.json` - Added `build:production` script
2. `Kribble-Server/src/app.ts` - Added static file serving, `/health` endpoint, database initialization
3. `Kribble-Server/Dockerfile` - Multi-stage build that includes client build
4. `Kribble-Server/package.json` - Added `pg` and `@types/pg` dependencies
5. `Kribble-Server/src/services/db/DatabaseService.ts` - PostgreSQL database service
6. `render.yaml` - Single service + PostgreSQL database configuration
7. `DEPLOY_TO_RENDER.md` - This guide



## Next Steps

1. Commit all changes
2. Push to GitHub
3. Follow deployment steps above
4. Test the deployed application at your Render URL
