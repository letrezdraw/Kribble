import { api } from './api';
import type { ServerMessage, ClientMessage } from '@kribble/shared-types';

type MessageHandler<T extends ServerMessage = ServerMessage> = (data: T) => void;

class SocketService {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private connectionId: string | null = null;
  private activeRoomCode: string | null = null;

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return;
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
    this.isConnecting = true;

    try {
      this.ws = new WebSocket(`${wsUrl}/ws`);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;

        const token = api.getToken();
        if (token) {
          this.send({ type: 'auth' as const, token });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as ServerMessage;
          this.handleMessage(data);
        } catch (error) {
          // Invalid JSON - ignore
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.attemptReconnect();
      };

      this.ws.onerror = () => {
        this.isConnecting = false;
      };
    } catch (error) {
      this.isConnecting = false;
      this.attemptReconnect();
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnect
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  private handleMessage<T extends ServerMessage>(data: T) {
    // Connection ID
    if (data.type === 'connected') {
      this.connectionId = data.connectionId;
    }

    // Auto-resync after auth
    if (data.type === 'auth:success' && this.activeRoomCode) {
      this.send({ type: 'room:resync' as const, code: this.activeRoomCode });
    }

    const handlers = this.handlers.get(data.type);
    if (handlers) {
      handlers.forEach((handler) => (handler as MessageHandler<T>)(data));
    }

    // Wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => (handler as MessageHandler<T>)(data));
    }
  }

  send<T extends ClientMessage>(msg: T) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on<T extends ServerMessage['type']>(type: T, handler: MessageHandler<Extract<ServerMessage, {type: T}>>): () => void;
  on(type: '*', handler: MessageHandler<ServerMessage>): () => void;
  on(type: string, handler: Function): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    return () => {
      this.off(type, handler);
    };
  }

  off(type: string, handler: Function) {
    const handlers = this.handlers.get(type);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionId(): string | null {
    return this.connectionId;
  }

  setActiveRoomCode(roomCode: string | null) {
    this.activeRoomCode = roomCode;
  }
}

export const socketService = new SocketService();
