import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  reconnecting: boolean;
  connectionError: string | null;
  reconnect: () => void;
  clearError: () => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  useEffect(() => {
    // Use environment variable for socket URL (set in .env.development or .env.production)
    // Falls back to empty string for same-origin requests in production
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || '';



    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    newSocket.on('connect', () => {
      setConnected(true);
      setReconnecting(false);
      setConnectionError(null);
      setReconnectAttempts(0);
      console.log('Socket connected');
    });

    newSocket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        setConnectionError('Server disconnected. Please reconnect.');
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      setConnectionError('Failed to connect to server. Retrying...');
      setReconnectAttempts(prev => prev + 1);
      if (reconnectAttempts >= 5) {
        setReconnecting(false);
        setConnectionError('Unable to connect. Please check your connection and try again.');
      }
    });

    newSocket.on('reconnect', (attemptNumber) => {
      console.log('Reconnected after', attemptNumber, 'attempts');
      setReconnecting(false);
      setConnectionError(null);
      setReconnectAttempts(0);
    });

    newSocket.on('reconnect_attempt', (attemptNumber) => {
      console.log('Reconnection attempt', attemptNumber);
      setReconnecting(true);
    });

    newSocket.on('reconnect_failed', () => {
      setReconnecting(false);
      setConnectionError('Failed to reconnect. Please try again later.');
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [reconnectAttempts]);

  const reconnect = useCallback(() => {
    if (socket) {
      setReconnecting(true);
      setConnectionError(null);
      socket.connect();
    }
  }, [socket]);

  const clearError = useCallback(() => {
    setConnectionError(null);
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, reconnecting, connectionError, reconnect, clearError }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
