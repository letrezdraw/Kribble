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

import cors, { CorsOptions } from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import helmet from 'helmet';
import { createServer } from 'http';
import pino from 'pino';
import { Server } from 'socket.io';

import SocketService from '@/services/socket/SocketService';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'development'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined
});

/** Split comma-separated origin lists from env (trim, drop empty). */
function parseOriginsList(...values: (string | undefined)[]): string[] {
  const out: string[] = [];
  for (const v of values) {
    if (!v?.trim()) continue;
    for (const part of v.split(',')) {
      const t = part.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

const app = express();
const httpServer = createServer(app);

const isProduction = process.env.NODE_ENV === 'production';

// CORS + Socket.IO: honor CLIENT_URL and legacy DOODLE_* vars from Kribble-Server/.env & docs.
const explicitOrigins = parseOriginsList(
  process.env.CLIENT_URL,
  process.env.DOODLE_CLIENT_URL,
  process.env.NETLIFY_DOODLE_CLIENT_URL
);
const clientOrigins =
  explicitOrigins.length > 0 ? explicitOrigins : ['*'];
const allowAnyOrigin = clientOrigins.includes('*');

const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS || 1);
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', Number.isNaN(trustProxyHops) ? 1 : trustProxyHops);
}

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:']
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowAnyOrigin || clientOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    logger.warn({ origin }, 'Blocked CORS origin');
    callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: !allowAnyOrigin
};

app.use(cors(corsOptions));

const generalLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    logger.warn({ ip: req.ip }, 'Rate limit exceeded');
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later.'
      }
    });
  }
});

app.use(generalLimiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

app.get('/health/detailed', (_req, res) => {
  const memoryUsage = process.memoryUsage();

  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV,
    memory: {
      used: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`
    }
  });
});

app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });

  next();
});

const io = new Server(httpServer, {
  cors: {
    origin: allowAnyOrigin ? true : clientOrigins,
    methods: ['GET', 'POST'],
    credentials: !allowAnyOrigin
  },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['websocket', 'polling'],
  maxHttpBufferSize: 1e6
});

const socketConnectionHistory = new Map<string, number[]>();
const SOCKET_RATE_WINDOW_MS = 60 * 1000;
const SOCKET_MAX_CONNECTIONS_PER_WINDOW = 10;
const SOCKET_RATE_SWEEP_INTERVAL_MS = 5 * 60 * 1000;

const pruneSocketHistory = (ip: string, now: number) => {
  const history = socketConnectionHistory.get(ip) || [];
  const recentHistory = history.filter(
    (timestamp) => now - timestamp <= SOCKET_RATE_WINDOW_MS
  );

  if (recentHistory.length > 0) {
    socketConnectionHistory.set(ip, recentHistory);
  } else {
    socketConnectionHistory.delete(ip);
  }

  return recentHistory;
};

setInterval(() => {
  const now = Date.now();
  socketConnectionHistory.forEach((_value, ip) => {
    pruneSocketHistory(ip, now);
  });
}, SOCKET_RATE_SWEEP_INTERVAL_MS).unref();

io.use((socket, next) => {
  const clientIp = socket.handshake.address || 'unknown';
  const now = Date.now();
  const recentHistory = pruneSocketHistory(clientIp, now);

  if (recentHistory.length >= SOCKET_MAX_CONNECTIONS_PER_WINDOW) {
    logger.warn(
      { ip: clientIp, id: socket.id },
      'Socket connection rate limit exceeded'
    );
    next(
      new Error('Too many socket connection attempts. Please retry shortly.')
    );
    return;
  }

  recentHistory.push(now);
  socketConnectionHistory.set(clientIp, recentHistory);

  logger.info({ ip: clientIp, id: socket.id }, 'Socket connection accepted');
  next();
});

app.use((req, res) => {
  logger.warn({ url: req.url, method: req.method }, 'Route not found');
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'The requested resource was not found.'
    }
  });
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    next(err);
    return;
  }

  logger.error(
    {
      err: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method
    },
    'Unhandled error'
  );

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'An internal error occurred.' : err.message,
      ...(!isProduction && { stack: err.stack })
    }
  });
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught Exception');
  setTimeout(() => {
    process.exit(1);
  }, 1000);
});

let shuttingDown = false;
const gracefulShutdown = (signal: string) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  logger.info({ signal }, 'Starting graceful shutdown...');

  io.close(() => {
    logger.info('Socket.io closed');

    httpServer.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  });

  setTimeout(() => {
    logger.error('Forced shutdown due to timeout');
    process.exit(1);
  }, 30000).unref();
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

const PORT = Number(process.env.PORT) || 5000;

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📊 Health check: http://localhost:${PORT}/health`);
  logger.info(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(
    {
      allowAnyOrigin,
      origins: allowAnyOrigin ? ['*'] : clientOrigins
    },
    'CORS / Socket.IO browser origins'
  );

  SocketService.start(io);
  logger.info('🔌 Socket.io service started');
});

httpServer.on('error', (error) => {
  logger.fatal({ error }, 'Failed to start HTTP server');
  process.exit(1);
});
