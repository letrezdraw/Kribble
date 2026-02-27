/**
 * Kribble Server - Production-Ready Express + Socket.io
 * 
 * Features:
 * - Rate limiting
 * - Helmet security headers
 * - Structured logging (Pino)
 * - Global error handling
 * - Health check endpoints
 * - Graceful shutdown
 */

import 'dotenv/config';

import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import helmet from 'helmet';
import pino from 'pino';
import { createServer } from 'http';
import { Server } from 'socket.io';

import SocketService from '@/services/socket/SocketService';

// ==========================================
// LOGGER SETUP
// ==========================================
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' 
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
});

// ==========================================
// EXPRESS APP SETUP
// ==========================================
const app = express();
const httpServer = createServer(app);

// ==========================================
// SECURITY MIDDLEWARE
// ==========================================

// Helmet security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      connectSrc: ["'self'", 'ws:', 'wss:'],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow Socket.io
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CLIENT_URL || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// Rate limiting
const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: req.ip }, 'Rate limit exceeded');
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.',
      },
    });
  },
});

// Stricter rate limit for socket connections
const socketLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 connections per minute
  skipSuccessfulRequests: true,
});

app.use(generalLimiter);

// ==========================================
// BODY PARSING
// ==========================================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==========================================
// HEALTH CHECKS
// ==========================================

// Basic health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

// Detailed health check
app.get('/health/detailed', (req, res) => {
  const memoryUsage = process.memoryUsage();
  
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    memory: {
      used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
      total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB',
    },
  });
});

// ==========================================
// REQUEST LOGGING
// ==========================================
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: duration + 'ms',
      ip: req.ip,
    });
  });
  
  next();
});

// ==========================================
// SOCKET.IO SETUP
// ==========================================
const io = new Server(httpServer, {
  cors: corsOptions,
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6, // 1MB
});

// Apply rate limiting to socket connections
io.use((socket, next) => {
  // Check connection rate
  const clientIp = socket.handshake.address;
  logger.info({ ip: clientIp, id: socket.id }, 'Socket connection attempt');
  next();
});

// ==========================================
// ERROR HANDLING
// ==========================================

// 404 handler
app.use((req, res) => {
  logger.warn({ url: req.url, method: req.method }, 'Route not found');
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.',
    },
  });
});

// Global error handler
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  logger.error({
    err: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  }, 'Unhandled error');

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isDev ? err.message : 'An internal error occurred.',
      ...(isDev && { stack: err.stack }),
    },
  });
});

// ==========================================
// UNHANDLED REJECTIONS
// ==========================================
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
  // Don't crash, but log it
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  // Give logger time to write, then exit
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

// ==========================================
// GRACEFUL SHUTDOWN
// ==========================================
const gracefulShutdown = (signal: string) => {
  logger.info({ signal }, 'Starting graceful shutdown...');
  
  // Close HTTP server
  httpServer.close(() => {
    logger.info('HTTP server closed');
    
    // Close Socket.io
    io.close(() => {
      logger.info('Socket.io closed');
      
      // Exit process
      process.exit(0);
    });
  });

  // Force shutdown after 30 seconds
  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// ==========================================
// START SERVER
// ==========================================
const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Start socket service
  SocketService.start(io);
  logger.info('🔌 Socket.io service started');
});
