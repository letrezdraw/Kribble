# 🚀 Full Render Deployment Guide

## Overview
This guide will deploy both backend API and frontend to Render with PostgreSQL database.

## 📋 Prerequisites
- GitHub account with Kribble repo pushed
- Render account (free tier works!)

---

## Step 1: Push Latest Code to GitHub

```bash
git add .
git commit -m "Prepare for Render deployment"
git push origin main
```

---

## Step 2: Deploy to Render (Blueprint Method)

### Option A: Use render.yaml (Recommended)

1. Go to [dashboard.render.com](https://dashboard.render.com)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repo
4. Render will automatically read `render.yaml` and create:
   - ✅ PostgreSQL database
   - ✅ Backend API service
   - ✅ Frontend static site

### Option B: Manual Setup

#### 2.1 Create PostgreSQL Database
1. **New +** → **PostgreSQL**
2. Name: `kribble-db`
3. Database: `kribble`
4. User: `kribble`
5. Plan: **Free**
6. Click **Create Database**

#### 2.2 Create Backend Web Service
1. **New +** → **Web Service**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `kribble-api`
   - **Runtime**: Node
   - **Build Command**: `cd server && npm install && npm run build`
   - **Start Command**: `cd server && npm start`
   - **Plan**: Free

4. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   JWT_SECRET=your-random-secret-key-here
   CORS_ORIGIN=*
   DATABASE_URL=(auto-filled from database)
   ```

5. Click **Create Web Service**

#### 2.3 Create Frontend Static Site
1. **New +** → **Static Site**
2. Connect your GitHub repo
3. Configure:
   - **Name**: `kribble-game`
   - **Build Command**: `cd client && npm install && npm run build`
   - **Publish Directory**: `./client/dist`
   - **Plan**: Free

4. **Environment Variables**:
   ```
   VITE_API_URL=https://kribble-api.onrender.com
   ```

5. Click **Create Static Site**

---

## Step 3: Verify Deployment

### Check Backend Health
Visit: `https://kribble-api.onrender.com/api/health`

Should return:
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T..."
}
```

### Check Frontend
Visit: `https://kribble-game.onrender.com`

Should show the Kribble landing page!

---

## Step 4: Update CORS (After Both Deploy)

Once both services are live, update backend CORS:

1. Go to **kribble-api** service
2. **Environment** tab
3. Edit `CORS_ORIGIN`:
   ```
   CORS_ORIGIN=https://kribble-game.onrender.com
   ```
4. Click **Save Changes**

---

## 🔧 Troubleshooting

### Build Fails: "Cannot find module"
- Check that `client/src/types/index.ts` exists
- Verify no imports from `../../../shared/`

### Database Connection Error
- Check `DATABASE_URL` is set correctly
- Verify database is "Available" in Render dashboard

### CORS Errors in Browser
- Update `CORS_ORIGIN` to match your frontend URL
- Include `https://` prefix

### 502 Bad Gateway
- Backend may be crashing
- Check logs in Render dashboard

---

## 📁 Files Created for Deployment

| File | Purpose |
|------|---------|
| `render.yaml` | Render blueprint configuration |
| `railway.toml` | Railway config (alternative) |
| `client/src/types/index.ts` | Local types (no shared module) |
| `server/src/db/index.ts` | Dual database support |
| `DEPLOY_GUIDE.md` | General deployment guide |

---

## 🎉 Success!

Your Kribble game is now live on Render with:
- ✅ PostgreSQL database (production)
- ✅ Node.js backend API
- ✅ React frontend
- ✅ Free tier hosting

**URLs:**
- API: `https://kribble-api.onrender.com`
- Game: `https://kribble-game.onrender.com`
