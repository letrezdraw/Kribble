import { WebSocketServer as WSServer } from 'ws';
import { Server } from 'http';
import { connectionManager } from './connectionManager.js';
import { handleMessage } from './handlers/messageRouter.js';

export function createWebSocketServer(httpServer: Server) {
  const wss = new WSServer({ 
    server: httpServer,
    path: '/ws',
  });

  wss.on('connection', (ws, req) => {
    // Extract connection info from request
    const userId = `user_${Date.now()}`;
    
    // Add connection to manager
    const connectionId = connectionManager.addConnection(ws, userId);
    
    console.log(`New WebSocket connection: ${connectionId}`);

    const authTimeout = setTimeout(() => {
      const connection = connectionManager.getConnection(connectionId);
      if (connection && !connection.isAuthenticated) {
        ws.send(JSON.stringify({ type: 'auth:error', message: 'Authentication timeout' }));
        ws.close(4001, 'Authentication required');
      }
    }, 10000);

    ws.on('message', (data) => {
      const message = data.toString();
      void handleMessage(connectionId, message);
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
      console.log(`WebSocket connection closed: ${connectionId}`);
      connectionManager.removeConnection(connectionId);
    });

    ws.on('error', (error) => {
      clearTimeout(authTimeout);
      console.error(`WebSocket error: ${error.message}`);
      connectionManager.removeConnection(connectionId);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      connectionId,
    }));
  });

  // Start heartbeat interval
  setInterval(() => {
    const staleConnections = connectionManager.getStaleConnections(30000);
    
    for (const connectionId of staleConnections) {
      const connection = connectionManager.getConnection(connectionId);
      if (connection) {
        // Send ping
        connection.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }
  }, 10000);

  return wss;
}
