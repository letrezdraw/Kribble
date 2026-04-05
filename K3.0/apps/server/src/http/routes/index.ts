import { FastifyInstance } from 'fastify';
import authRoutes from './auth.routes.js';
import roomRoutes from './room.routes.js';

export function registerRoutes(app: FastifyInstance): void {
  // Register auth routes under /auth prefix
  app.register(authRoutes, { prefix: '/auth' });
  
  // Register room routes under /rooms prefix
  app.register(roomRoutes, { prefix: '/rooms' });
}
