import { WebSocket } from 'ws';

export interface Connection {
  ws: WebSocket;
  userId: string;
  roomId?: string;
  isAuthenticated: boolean;
  lastPing: number;
}

class ConnectionManager {
  private connections: Map<string, Connection> = new Map();
  private roomConnections: Map<string, Set<string>> = new Map();

  addConnection(ws: WebSocket, userId: string): string {
    const connectionId = this.generateConnectionId();
    
    this.connections.set(connectionId, {
      ws,
      userId,
      isAuthenticated: false,
      lastPing: Date.now(),
    });

    return connectionId;
  }

  removeConnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      // Remove from room if in one
      if (connection.roomId) {
        this.removeFromRoom(connectionId, connection.roomId);
      }
      this.connections.delete(connectionId);
    }
  }

  authenticateConnection(connectionId: string, userId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.userId = userId;
      connection.isAuthenticated = true;
    }
  }

  joinRoom(connectionId: string, roomId: string): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;

    // Leave current room if in one
    if (connection.roomId) {
      this.removeFromRoom(connectionId, connection.roomId);
    }

    // Join new room
    connection.roomId = roomId;

    if (!this.roomConnections.has(roomId)) {
      this.roomConnections.set(roomId, new Set());
    }
    this.roomConnections.get(roomId)!.add(connectionId);
  }

  removeFromRoom(connectionId: string, roomId: string): void {
    const roomConnections = this.roomConnections.get(roomId);
    if (roomConnections) {
      roomConnections.delete(connectionId);
      if (roomConnections.size === 0) {
        this.roomConnections.delete(roomId);
      }
    }

    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.roomId = undefined;
    }
  }

  getConnection(connectionId: string): Connection | undefined {
    return this.connections.get(connectionId);
  }

  getConnectionByUserId(userId: string): Connection | undefined {
    for (const connection of this.connections.values()) {
      if (connection.userId === userId) {
        return connection;
      }
    }
    return undefined;
  }

  getRoomConnections(roomId: string): Connection[] {
    const connectionIds = this.roomConnections.get(roomId);
    if (!connectionIds) return [];

    const result: Connection[] = [];
    for (const connectionId of connectionIds) {
      const connection = this.connections.get(connectionId);
      if (connection) {
        result.push(connection);
      }
    }
    return result;
  }

  broadcastToRoom(roomId: string, message: unknown): void {
    const connections = this.getRoomConnections(roomId);
    
    const messageStr = typeof message === 'string' 
      ? message 
      : JSON.stringify(message);

    for (const connection of connections) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(messageStr);
      }
    }
  }

  broadcastToAll(message: unknown): void {
    const messageStr = typeof message === 'string' 
      ? message 
      : JSON.stringify(message);

    for (const connection of this.connections.values()) {
      if (connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(messageStr);
      }
    }
  }

  updatePing(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastPing = Date.now();
    }
  }

  getStaleConnections(timeoutMs: number = 30000): string[] {
    const stale: string[] = [];
    const now = Date.now();

    for (const [id, connection] of this.connections.entries()) {
      if (now - connection.lastPing > timeoutMs) {
        stale.push(id);
      }
    }

    return stale;
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  private generateConnectionId(): string {
    return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

// Singleton instance
export const connectionManager = new ConnectionManager();
