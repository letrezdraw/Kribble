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
- One URL serves both API and frontend

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
   - Select the `Kribble 2.0` folder (or root if that's where `render.yaml` is)

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
   - **Root Directory**: `doodle-server-main`
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
- Ensure `doodle-client-main` folder exists and has package.json
- Verify the Dockerfile can access `../doodle-client-main`

**404 Errors on Refresh**:
- This is handled by the catch-all route in `app.ts`
- If it doesn't work, check that the build folder exists at `../doodle-client-main/build`

**CORS Errors**:
- With single service, CORS should not be an issue
- If you see CORS errors, check `DOODLE_CLIENT_URL` is set correctly

## Free Tier Limitations

On Render's free tier:
- Service spins down after 15 minutes of inactivity
- First request after spin-down may take 30-60 seconds
- WebSocket connections may be interrupted during spin-down

## Files Changed for Deployment

1. `doodle-client-main/package.json` - Added `build:production` script
2. `doodle-server-main/src/app.ts` - Added static file serving and `/health` endpoint
3. `doodle-server-main/Dockerfile` - Multi-stage build that includes client build
4. `render.yaml` - Single service Render Blueprint configuration
5. `DEPLOY_TO_RENDER.md` - This guide

## Next Steps

1. Commit all changes
2. Push to GitHub
3. Follow deployment steps above
4. Test the deployed application at your Render URL
