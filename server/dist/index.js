import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
// Import routes and handlers
import { authRoutes, cleanupExpiredGuests } from './routes/auth.js';
import { roomRoutes } from './routes/rooms.js';
import { userRoutes } from './routes/users.js';
import { wordRoutes } from './routes/words.js';
import { setupSocketHandlers } from './socket/handlers.js';
import { initDatabase } from './db/index.js';
import { startCleanupScheduler } from './data/rooms.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const httpServer = createServer(app);
// Environment-based CORS
const isProduction = process.env.NODE_ENV === 'production';
const corsOrigins = isProduction
    ? [process.env.CORS_ORIGIN || 'https://kribble.onrender.com', '*']
    : ['http://localhost:5173', 'http://localhost:3000'];
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
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Setup Socket.io handlers
setupSocketHandlers(io);
// Store io instance for use in routes
app.set('io', io);
// Track connected users
const connectedSockets = new Set();
io.on('connection', (socket) => {
    connectedSockets.add(socket.id);
    console.log(`[Online] User connected. Total: ${connectedSockets.size}`);
    socket.on('disconnect', () => {
        connectedSockets.delete(socket.id);
        console.log(`[Online] User disconnected. Total: ${connectedSockets.size}`);
    });
});
// API endpoint for real online count
app.get('/api/users/online/count', (req, res) => {
    res.json({
        count: connectedSockets.size,
        timestamp: new Date().toISOString()
    });
});
// Initialize database
initDatabase();
// Start cleanup scheduler for room maintenance
const cleanupInterval = startCleanupScheduler(5 * 60 * 1000); // Run every 5 minutes
// Start guest user cleanup scheduler (run every hour)
const guestCleanupInterval = setInterval(() => {
    cleanupExpiredGuests();
}, 60 * 60 * 1000); // Run every hour
// Run initial guest cleanup
cleanupExpiredGuests();
// Serve static frontend files in production
if (isProduction) {
    const clientDistPath = path.join(__dirname, '../../client/dist');
    // Check if dist folder exists
    if (fs.existsSync(clientDistPath)) {
        // Serve static files
        app.use(express.static(clientDistPath));
        // Serve index.html for all non-API routes (SPA support)
        app.get('*', (req, res) => {
            // Don't serve index.html for API routes
            if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io/')) {
                return res.status(404).json({ message: 'Not found' });
            }
            res.sendFile(path.join(clientDistPath, 'index.html'));
        });
        console.log(`[Static] Serving frontend from: ${clientDistPath}`);
    }
    else {
        console.warn(`[Static] Client dist not found at: ${clientDistPath}`);
    }
}
// Start server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
    console.log(`CORS origins: ${JSON.stringify(corsOrigins)}`);
    console.log(`Room cleanup scheduler started (every 5 minutes)`);
    console.log(`Guest user cleanup scheduler started (every hour)`);
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
export { io };
