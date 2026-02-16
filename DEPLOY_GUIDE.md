# 🚀 Kribble Deployment Guide - Render

This guide will walk you through deploying Kribble to Render with PostgreSQL for production.

## 📋 Prerequisites

1. **GitHub Account** - Your code should be pushed to GitHub
2. **Render Account** - Sign up at [render.com](https://render.com)
3. **Git** - Installed locally

## 🔄 Step 1: Push Code to GitHub

```bash
# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Prepare for Render deployment - PostgreSQL + SQLite dual database support"

# Add your GitHub remote (replace with your repo)
git remote add origin https://github.com/YOUR_USERNAME/kribble.git

# Push to GitHub
git push -u origin main
```

## 🗄️ Step 2: Create Render Account & Connect GitHub

1. Go to [render.com](https://render.com) and sign up
2. Click "New +" and select "Blueprint"
3. Connect your GitHub account
4. Select your Kribble repository
5. Render will automatically detect the `render.yaml` file

## 🛠️ Step 3: Deploy with Blueprint

When you connect your repo with the blueprint:

1. **Render will automatically:**
   - Create a PostgreSQL database (free tier)
   - Create the backend web service (Node.js)
   - Create the frontend static site
   - Set up environment variables
   - Run migrations

2. **Wait for deployment** (5-10 minutes)

## 🔧 Step 4: Manual Setup (Alternative)

If you prefer manual setup instead of blueprint:

### Create PostgreSQL Database
1. In Render Dashboard, click "New +" → "PostgreSQL"
2. Name: `kribble-db`
3. Plan: Free
4. Copy the "Internal Database URL" for later

### Create Backend Service
1. Click "New +" → "Web Service"
2. Connect your GitHub repo
3. Settings:
   - **Name:** `kribble-server`
   - **Runtime:** Node
   - **Build Command:** `cd server && npm install && npm run build`
   - **Start Command:** `cd server && npm start`
   - **Plan:** Free

4. Add Environment Variables:
   ```
   NODE_ENV=production
   PORT=10000
   JWT_SECRET=(generate a random string)
   DATABASE_URL=(paste from PostgreSQL database)
   CLIENT_URL=https://kribble.onrender.com
   ```

### Create Frontend Service
1. Click "New +" → "Static Site"
2. Connect your GitHub repo
3. Settings:
   - **Name:** `kribble-client`
   - **Build Command:** `cd client && npm install && npm run build`
   - **Publish Directory:** `client/dist`
   
4. Add Environment Variable:
   ```
   VITE_API_URL=https://kribble-server.onrender.com
   ```

## 🧪 Step 5: Verify Deployment

1. **Check Backend Health:**
   ```
   https://kribble-server.onrender.com/api/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Check Frontend:**
   ```
   https://kribble-client.onrender.com
   ```
   Should load the Kribble game

3. **Test Registration/Login:**
   - Create a new account
   - Verify data persists in PostgreSQL

## 🔍 Troubleshooting

### Database Connection Issues
```bash
# Check Render logs for the server service
# Look for: "[DB] PostgreSQL connected successfully"
```

### CORS Errors
- Verify `CLIENT_URL` environment variable matches your frontend URL
- Check that CORS origins in `server/src/index.ts` include your domain

### Build Failures
```bash
# Common fixes:
cd server
npm install
npm run build

cd ../client
npm install
npm run build
```

### Socket.io Not Working
- Ensure WebSocket is enabled in Render (default for web services)
- Check that Socket.io CORS origins are configured correctly

## 🔄 Database: Development vs Production

### Development (Local)
- Uses **SQLite** automatically when `DATABASE_URL` is not set
- Data stored in `server/data/kribble.db`
- No setup required

### Production (Render)
- Uses **PostgreSQL** when `DATABASE_URL` is set
- Managed by Render
- Automatic backups on paid plans

## 📊 Monitoring

1. **Render Dashboard:**
   - View service logs
   - Monitor resource usage
   - Check deployment status

2. **Database Metrics:**
   - PostgreSQL dashboard in Render
   - Query performance
   - Connection count

## 🚀 Updating Your Deployment

```bash
# Make changes locally
git add .
git commit -m "Your changes"
git push origin main

# Render will automatically redeploy!
```

## 💰 Cost Optimization

**Free Tier Limits:**
- Web Services: 512 MB RAM, sleeps after 15 min inactivity
- PostgreSQL: 1 GB storage, 10 connections
- Static Sites: 100 GB bandwidth/month

**To prevent sleeping (free tier):**
- Use a service like [UptimeRobot](https://uptimerobot.com) to ping your API every 10 minutes

## 📝 Environment Variables Reference

| Variable | Development | Production | Description |
|----------|-------------|------------|-------------|
| `NODE_ENV` | `development` | `production` | App environment |
| `PORT` | `3001` | `10000` | Server port |
| `DATABASE_URL` | (empty) | (Render provides) | PostgreSQL connection |
| `JWT_SECRET` | any string | secure random | JWT signing key |
| `CLIENT_URL` | `http://localhost:5173` | frontend URL | CORS origin |

## 🎉 Success!

Your Kribble game is now live on Render with:
- ✅ PostgreSQL database for production
- ✅ SQLite for local development
- ✅ Auto-scaling on Render
- ✅ Free tier available

**Next Steps:**
- Share your game URL with friends
- Monitor usage in Render dashboard
- Consider upgrading for better performance
