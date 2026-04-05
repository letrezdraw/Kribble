/**
 * K2GameRoomProvider
 * 
 * Bridges Kribble 1.0 auth user into the Kribble 2.0 multiplayer engine.
 * 
 * It:
 * 1. Seeds localStorage with the K1 user's name so K2 UserProvider picks it up
 * 2. Calls set-doodler via socket once connected so the K2 server registers the player
 * 3. Then provides K2 socket/room/game/canvas contexts to children
 */
import React, { ReactNode, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

// Import K2 providers & hooks
import UserProvider, { useUser } from './contexts/user';
import K2SocketProvider, { useSocket, SocketConnectionState, emitFireAndForget } from './contexts/socket';
import RoomProvider from './contexts/room';
import GameProvider from './contexts/game';
import { DoodlerEvents } from './constants/Events';

interface K2GameRoomProviderProps {
  children: ReactNode;
}

/** Reads K1 auth user and syncs it to K2 UserContext + registers with server */
function K1UserBridge({ children }: { children: ReactNode }) {
  const { user: k1User } = useAuth();
  const { user: k2User, updateUser } = useUser();
  const { socketConnectionState, socketId, asyncEmitEvent } = useSocket();
  const [isRegistered, setIsRegistered] = React.useState(false);
  const lastRegisteredSocketId = useRef<string | null>(null);

  // Sync K1 username into K2 user context
  useEffect(() => {
    if (k1User?.username && k2User.name !== k1User.username) {
      updateUser('name', k1User.username);
      localStorage.setItem('name', k1User.username);
    }
  }, [k1User?.username]);

  // Once K2 socket connects, register as doodler
  useEffect(() => {
    if (socketConnectionState !== SocketConnectionState.CONNECTED || !socketId) {
      return;
    }
    
    if (lastRegisteredSocketId.current === socketId) return;

    const name = k1User?.username || k2User.name || 'Player';

    asyncEmitEvent(DoodlerEvents.EMIT_SET_DOODLER, {
      name,
      avatar: k2User.avatar,
    }).then((data) => {
      // Update K2 user ID with the socket-assigned ID from server
      if (data?.id) updateUser('id', data.id);
      lastRegisteredSocketId.current = socketId;
      setIsRegistered(true);
    }).catch((err) => {
      console.error('[K1UserBridge] set-doodler failed, trying get-doodler', err);
      asyncEmitEvent(DoodlerEvents.EMIT_GET_DOODLER, undefined)
        .then((data) => { 
          if (data?.id) updateUser('id', data.id);
          lastRegisteredSocketId.current = socketId;
          setIsRegistered(true);
        })
        .catch((err2) => {
          console.error('[K1UserBridge] Registration failed:', err2);
          setIsRegistered(true); 
        });
    });
  }, [socketConnectionState]);

  if (!isRegistered) {
    return (
      <div className="joining-overlay">
        <div className="loader"></div>
        <p>Initializing multiplayer identity...</p>
      </div>
    );
  }

  return <>{children}</>;
}

/** Full K2 provider stack */
function K2Stack({ children }: { children: ReactNode }) {
  const { user: k1User } = useAuth();
  return (
    <UserProvider>
      <K2SocketProvider>
        <K1UserBridge>
          <RoomProvider>
            <GameProvider>
              {children}
            </GameProvider>
          </RoomProvider>
        </K1UserBridge>
      </K2SocketProvider>
    </UserProvider>
  );
}

export default function K2GameRoomProvider({ children }: K2GameRoomProviderProps) {
  const { user: k1User } = useAuth();
  
  // Pre-seed localStorage before UserProvider mounts so it reads correct name
  if (k1User?.username) {
    localStorage.setItem('name', k1User.username);
  }

  return <K2Stack>{children}</K2Stack>;
}
