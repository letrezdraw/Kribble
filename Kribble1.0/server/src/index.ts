import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';

import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';


// Import routes and handlers
import { authRoutes, cleanupExpiredGuests } from './routes/auth.js';
import { roomRoutes } from './routes/rooms.js';
import { userRoutes } from './routes/users.js';
import { wordRoutes } from './routes/words.js';
// Removed old Kribble 1.0 socket handlers:
// import { setupSocketHandlers } from './socket/handlers-v2.js';

import SocketService from './k2/services/socket/SocketService.js';
import { setLobbyBroadcastIo } from './k2/utils/lobbyBroadcast.js';

import { initDatabase } from './db/index.js';
import { startCleanupScheduler } from './data/rooms.js';
import { logger } from './utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const userId = (req as any).user?.id || 'anonymous';
  
  logger.apiRequest(req.method, req.path, userId, req.body, req.ip);
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.apiResponse(req.method, req.path, res.statusCode, duration, userId);
  });
  
  next();
});


// Environment-based CORS configuration
// In development: allow common Vite ports (5173, 3000, 4173) and any localhost
// In production: use CORS_ORIGIN env var or allow all (for Render/Railway same-origin)
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigins = isProduction 
  ? (process.env.CORS_ORIGIN ? [process.env.CORS_ORIGIN] : ['*'])
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173', 'http://127.0.0.1:5173', 'http://127.0.0.1:3000'];



const io = new Server(httpServer, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    credentials: true,
  },
});

// Middleware - CORS must be before other middleware
app.use(cors({
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Handle preflight requests for all routes
app.options('*', cors());

app.use(express.json());

// API Routes - Order matters: specific routes before parameterized ones
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/words', wordRoutes);
// Mount user routes last to avoid conflicts with specific endpoints like /leaderboard
app.use('/api/users', userRoutes);

// Health check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});


// TODO: Temporarily disable K2 handlers to use v1 handlers for compatibility
// SocketService.start(io);
// setLobbyBroadcastIo(io);

// Enable v1 handlers for Kribble1.0 client compatibility
import { setupSocketHandlers } from './socket/handlers.js';
setupSocketHandlers(io);

// Store io instance for use in routes
app.set('io', io);

// Track connected users
const connectedSockets = new Set<string>();

// Log server startup
logger.info('SERVER', 'Server initialization started', { port: process.env.PORT || 3001 });


io.on('connection', (socket: Socket) => {
  connectedSockets.add(socket.id);
  logger.socketEvent('connect', socket.id, { total: connectedSockets.size });
  console.log(`[Online] User connected. Total: ${connectedSockets.size}`);
  
  socket.on('disconnect', (reason) => {
    connectedSockets.delete(socket.id);
    logger.socketEvent('disconnect', socket.id, { reason, total: connectedSockets.size });
    console.log(`[Online] User disconnected. Total: ${connectedSockets.size}`);
  });
});



// API endpoint for real online count
app.get('/api/users/online/count', (req: Request, res: Response) => {
  res.json({ 
    count: connectedSockets.size,
    timestamp: new Date().toISOString()
  });
});


// Initialize database and then start server
async function startServer() {
  try {
    // Initialize database first with timeout protection
    const dbInitPromise = initDatabase();
    const dbTimeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database initialization timeout')), 45000)
    );
    
    try {
      await Promise.race([dbInitPromise, dbTimeoutPromise]);
    } catch (dbError) {
      console.error('[Server] Database initialization failed or timed out:', dbError);
      console.log('[Server] Continuing with limited functionality...');
    }
    
    // Start cleanup scheduler for room maintenance
    const cleanupInterval = startCleanupScheduler(5 * 60 * 1000); // Run every 5 minutes


    // Start guest user cleanup scheduler (run every hour)
    const guestCleanupInterval = setInterval(() => {
      cleanupExpiredGuests();
    }, 60 * 60 * 1000); // Run every hour

    // Run initial guest cleanup
    cleanupExpiredGuests();

    // Start server
    const PORT = process.env.PORT || 3001;
    httpServer.listen(PORT, () => {
      logger.info('SERVER', 'Server started successfully', { 
        port: PORT, 
        environment: isProduction ? 'production' : 'development',
        corsOrigins 
      });
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
      console.log(`CORS origins: ${JSON.stringify(corsOrigins)}`);
      console.log(`Room cleanup scheduler started (every 5 minutes)`);
      console.log(`Guest user cleanup scheduler started (every hour)`);
      console.log(`Log file: ${process.cwd()}/logs/development.log`);
    });


    // Graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      clearInterval(cleanupInterval);
      clearInterval(guestCleanupInterval);
      httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      clearInterval(cleanupInterval);
      clearInterval(guestCleanupInterval);
      httpServer.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('SERVER', 'Failed to start server', error as Error);
    console.error('[Server] Failed to start:', error);
    process.exit(1);
  }

}

// Start the server
startServer();


// Serve static frontend files in production
if (isProduction) {
  // Try multiple possible paths for the client dist folder
  const possiblePaths = [
    path.join(__dirname, '../../client/dist'),  // Local dev / monorepo
    path.join(__dirname, '../client/dist'),      // Alternative structure
    path.join(process.cwd(), 'client/dist'),     // Render deployment
    path.join(process.cwd(), '../client/dist'),  // Another Render possibility
  ];
  
  let clientDistPath = '';
  for (const testPath of possiblePaths) {
    console.log(`[SPA] Checking path: ${testPath} - exists: ${fs.existsSync(testPath)}`);
    if (fs.existsSync(testPath)) {
      clientDistPath = testPath;
      break;
    }
  }
  
  console.log(`[SPA] Production mode detected`);
  console.log(`[SPA] __dirname: ${__dirname}`);
  console.log(`[SPA] process.cwd(): ${process.cwd()}`);
  console.log(`[SPA] Selected client dist path: ${clientDistPath}`);
  
  // Check if dist folder exists
  if (clientDistPath && fs.existsSync(clientDistPath)) {

    // List files in dist for debugging
    try {
      const files = fs.readdirSync(clientDistPath);
      console.log(`[SPA] Files in dist: ${files.join(', ')}`);
    } catch (e) {
      console.error(`[SPA] Error reading dist: ${e}`);
    }
    
    // Serve static files with proper path filtering
    app.use(express.static(clientDistPath, {
      // Don't serve index.html for API routes - let them fall through
      index: false
    }));
    
    // SPA catch-all: Serve index.html for all non-API, non-socket.io, non-file routes
    app.get('*', (req: Request, res: Response) => {
      console.log(`[SPA] Catch-all route hit: ${req.method} ${req.path}`);
      
      // Skip API and socket.io routes
      if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
        console.log(`[SPA] Skipping API/socket.io route: ${req.path}`);
        return res.status(404).json({ message: 'Not found' });
      }
      
      // Skip if it's a file request (has extension)
      if (req.path.match(/\.[a-zA-Z0-9]+$/)) {
        console.log(`[SPA] Skipping file request: ${req.path}`);
        return res.status(404).json({ message: 'Not found' });
      }
      
      console.log(`[SPA] Serving index.html for: ${req.path}`);
      // Serve index.html for SPA routes
      res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
        if (err) {
          console.error(`[SPA] Error serving index.html: ${err}`);
          res.status(500).send('Error loading application');
        }
      });
    });

    
    console.log(`[Static] Serving frontend from: ${clientDistPath}`);
  } else {
    console.warn(`[Static] Client dist not found at: ${clientDistPath}`);
  }
}





export { io };
