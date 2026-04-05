/* eslint-disable no-console */
import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { io, Socket as IoSocket } from 'socket.io-client';

import { SocketEvents, SocketIOEvents } from '../../constants/Events';
import useLogger from '../../hooks/useLogger';
import {
  ClientToServerEvents,
  ClientToServerEventsArgumentMap,
  ServerToClientEvents,
  SocketType,
} from '../../types/socket';
import { ErrorFromServer } from '../../utils/error';

import { useUser } from '../user';

/**
 * Local stack: Kribble 1.0 server on :3001.
 */
const DEFAULT_SERVER_ORIGIN = 'http://localhost:3001';

function isBrowserLocalDev(): boolean {
  if (import.meta.env.MODE !== 'development' || typeof window === 'undefined') {
    return false;
  }
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1';
}

function resolveSocketUrl(): string {
  const raw = import.meta.env.VITE_K2_SOCKET_URL?.trim();

  // HEURISTIC: If we're on localhost:5173, we almost certainly want localhost:3001 for the backend.
  if (typeof window !== 'undefined') {
    const h = window.location.hostname;
    const p = window.location.port;
    if ((h === 'localhost' || h === '127.0.0.1') && p === '5173') {
      return 'http://localhost:3001';
    }
  }

  if (raw) return raw;

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return DEFAULT_SERVER_ORIGIN;
}

const SOCKET_URL = resolveSocketUrl();
const SOCKET_RECONNECT_ATTEMPTS = Number(
  import.meta.env.VITE_SOCKET_RECONNECT_ATTEMPTS || 25
);

/** Shared typed client (ACK required in types for RPC-style emits). */
export const socket: SocketType = io(SOCKET_URL, {
  autoConnect: false,
  reconnectionAttempts: SOCKET_RECONNECT_ATTEMPTS,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 8000,
  timeout: 20000,
});

/**
 * Emit without waiting for a server ACK. Typed `Socket` expects a response handler for every
 * client→server event; high-frequency events (canvas) must not use `asyncEmitEvent` or ACKs.
 */
export const emitFireAndForget = <T extends keyof ClientToServerEvents>(
  event: T,
  payload: ClientToServerEventsArgumentMap[T]['payload']
): void => {
  (socket as unknown as IoSocket).emit(event as string, payload);
};

const ACK_TIMEOUT_MS = Number(import.meta.env.VITE_SOCKET_ACK_TIMEOUT_MS || 10000);

export enum SocketConnectionState {
  CONNECTING,
  RECONNECTING,
  CONNECTED,
  ERROR,
}

interface SocketContextType {
  socketConnectionState: SocketConnectionState;
  socketId: string | null;
  registerEvent: <T extends keyof ServerToClientEvents>(
    event: T,
    listener: ServerToClientEvents[T]
  ) => void;
  unregisterEvent: <T extends keyof ServerToClientEvents>(
    event: T,
    listener: ServerToClientEvents[T]
  ) => void;
  asyncEmitEvent: <T extends keyof ClientToServerEvents>(
    event: T,
    payload: ClientToServerEventsArgumentMap[T]['payload']
  ) => Promise<
    NonNullable<ClientToServerEventsArgumentMap[T]['response']['data']>
  >;
}

const SocketContext = createContext<SocketContextType>({
  socketConnectionState: SocketConnectionState.CONNECTING,
  socketId: null,
  registerEvent: () => {},
  unregisterEvent: () => {},
  asyncEmitEvent: () =>
    Promise.reject(new Error('Emitter not initialized yet!')),
});

const SocketProvider = ({ children }: PropsWithChildren) => {
  const { updateUser, clearSocketIdentity } = useUser();
  const { logClientEmit } = useLogger();
  const [socketConnectionState, setSocketConnectionState] =
    useState<SocketConnectionState>(SocketConnectionState.CONNECTING);

  const handleConnectAttempt = () => {
    setSocketConnectionState(SocketConnectionState.RECONNECTING);
  };

  const handleConnect = () => {
    console.info('Connected to server!');
    updateUser('id', socket.id ?? '');
    setSocketConnectionState(SocketConnectionState.CONNECTED);
  };

  const handleConnectError = () => {
    if (import.meta.env.MODE === 'development') {
      // eslint-disable-next-line no-console
      console.error(
        `[Kribble] Cannot reach game server at ${SOCKET_URL}. Start Kribble server on port 3001.`
      );
    }
    setSocketConnectionState(SocketConnectionState.ERROR);
    clearSocketIdentity();
  };

  const handleDisconnect = (reason: string) => {
    if (import.meta.env.MODE === 'development') {
      // eslint-disable-next-line no-console
      console.warn('[socket] disconnected:', reason);
    }
    clearSocketIdentity();
    setSocketConnectionState(SocketConnectionState.RECONNECTING);
  };

  const handleReconnectFailed = () => {
    setSocketConnectionState(SocketConnectionState.ERROR);
    clearSocketIdentity();
  };

  const registerEvent: SocketContextType['registerEvent'] = (
    event,
    listener
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.on(event, listener as any);
  };

  const unregisterEvent: SocketContextType['unregisterEvent'] = (
    event,
    listener
  ) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    socket.off(event, listener as any);
  };

  const asyncEmitEvent = async <T extends keyof ClientToServerEvents>(
    event: T,
    payload: ClientToServerEventsArgumentMap[T]['payload']
  ) => {
    const data = await (new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new ErrorFromServer('Request timeout. Please try again.'));
      }, ACK_TIMEOUT_MS);

      const args = [
        payload,
        (response: ClientToServerEventsArgumentMap[T]['response']) => {
          clearTimeout(timeout);
          const { data, error } = response;
          if (import.meta.env.MODE === 'development') {
            logClientEmit(event, response);
          }

          if (error || data === undefined) {
            reject(new ErrorFromServer(error?.message));
            return;
          }

          resolve(data);
        },
      ] as Parameters<ClientToServerEvents[T]>;

      socket.emit(event, ...args);
    }) as Promise<ClientToServerEventsArgumentMap[T]['response']['data']>);

    if (!data) {
      throw new ErrorFromServer('Something went wrong!');
    }

    return data;
  };

  useEffect(() => {
    setSocketConnectionState(SocketConnectionState.CONNECTING);
    socket.on(SocketEvents.ON_CONNECT, handleConnect);
    socket.on(SocketEvents.ON_CONNECT_ERROR, handleConnectError);
    socket.on(SocketEvents.ON_DISCONNECT, handleDisconnect);
    socket.io.on(SocketIOEvents.ON_RECONNECT_ATTEMPT, handleConnectAttempt);
    socket.io.on(SocketIOEvents.ON_RECONNECT_FAILED, handleReconnectFailed);
    socket.connect();

    return () => {
      socket.off(SocketEvents.ON_CONNECT, handleConnect);
      socket.off(SocketEvents.ON_CONNECT_ERROR, handleConnectError);
      socket.off(SocketEvents.ON_DISCONNECT, handleDisconnect);
      socket.io.off(SocketIOEvents.ON_RECONNECT_ATTEMPT, handleConnectAttempt);
      socket.io.off(SocketIOEvents.ON_RECONNECT_FAILED, handleReconnectFailed);
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socketConnectionState,
        socketId: socket.id || null,
        registerEvent,
        unregisterEvent,
        asyncEmitEvent,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => useContext(SocketContext);

export default SocketProvider;
