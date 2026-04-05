import { initDatabase } from './db/prismaClient.js';
import { initRedis } from './db/redisClient.js';
import { createHttpServer } from './http/server.js';
import { createWebSocketServer } from './ws/wsServer.js';

async function bootstrap() {
  const server = createHttpServer();
  
  // Create WebSocket server attached to HTTP server
  createWebSocketServer(server.server);

  // Get port from environment or default
  const port = parseInt(process.env.PORT || '4000', 10);
  const host = process.env.HOST || '0.0.0.0';

  try {
    // Initialize database
    console.log('Initializing database...');
    await initDatabase();
    console.log('Database connected');

    // Initialize Redis (optional - continue if failed)
    try {
      await initRedis();
      console.log('Redis connected');
    } catch (error) {
      console.warn('Redis connection failed, continuing without Redis:', error);
    }

    // Start server
    await server.listen({ port, host });
    console.log(`Server listening on http://${host}:${port}`);
    console.log(`WebSocket available at ws://${host}:${port}/ws`);
    console.log(`Health check: http://${host}:${port}/health`);

  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

bootstrap();
