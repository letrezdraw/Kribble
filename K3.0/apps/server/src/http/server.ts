import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyJwt from '@fastify/jwt';
import { registerRoutes } from './routes/index.js';
import { isDatabaseReady } from '../db/prismaClient.js';
import { isRedisReady } from '../db/redisClient.js';

export function createHttpServer() {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const app = Fastify({ 
    logger: true,
  });

  // Register CORS
  app.register(cors, { 
    origin: allowedOrigins,
    credentials: true,
  });

  // Register rate limiting
  app.register(rateLimit, { 
    max: 100, 
    timeWindow: '1 minute',
  });

  // Register JWT
  app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || 'kribble-dev-secret-change-in-production',
  });

  // Authenticate decorator
  app.decorate('authenticate', async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ message: 'Unauthorized' });
    }
  });

  // Health check endpoint
  app.get('/health', async () => ({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Readiness check endpoint (DB + Redis)
  app.get('/ready', async (_request, reply) => {
    const [database, redis] = await Promise.all([isDatabaseReady(), isRedisReady()]);
    const ready = database && redis;

    if (!ready) {
      return reply.status(503).send({
        status: 'not_ready',
        checks: { database, redis },
        timestamp: new Date().toISOString(),
      });
    }

    return reply.send({
      status: 'ready',
      checks: { database, redis },
      timestamp: new Date().toISOString(),
    });
  });

  app.setErrorHandler((error, request, reply) => {
    request.log.error(
      {
        err: error,
        method: request.method,
        url: request.url,
      },
      'Unhandled request error'
    );

    if (reply.sent) return;
    reply.status(500).send({ message: 'Internal server error' });
  });

  // Register API routes
  registerRoutes(app);

  return app;
}
