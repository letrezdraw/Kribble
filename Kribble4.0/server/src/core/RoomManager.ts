/**
 * Kribble V2 - Room Manager
 * Handles room lifecycle, creation, joining, and cleanup
 */

import { v4 as uuidv4 } from 'uuid';
import { Room, Player, RoomSettings, RoomPhase, PlayerConnectionState } from '../types/game.js';
import { logger } from '../utils/logger.js';

// Server state storage
const rooms = new Map<string, Room>();
const socketToUser = new Map<string, string>();
const userToRoom = new Map<string, string>();

// Constants
const RECONNECT_GRACE_PERIOD = 30000; // 30 seconds
const ROOM_CLEANUP_INTERVAL = 60000; // 1 minute
const MAX_ROOM_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a unique room ID (short code for sharing)
 */
function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  // Check for collision
  if (rooms.has(result)) {
    return generateRoomId();
  }
  return result;
}

/**
 * Get default room settings
 */
function getDefaultSettings(): RoomSettings {
  return {
    maxPlayers: 8,
    roundTime: 80,
    wordSelectionTime: 15,
    totalRounds: 3,
    hints: 3,
    wordCount: 3,
    categories: ['all'],
    isPrivate: false,
    language: 'English',
    gameMode: 'Normal',
  };
}


/**
 * Create a new room
 */
export function createRoom(
  socketId: string,
  userId: string,
  username: string,
  avatarId: string = '👤',
  roomName: string,
  settings?: Partial<RoomSettings>
): Room | null {
  // Force leave current room first (prevent teleport bug)
  forceLeaveCurrentRoom(userId);
  
  const roomId = generateRoomId();
  const now = Date.now();
  
  const room: Room = {
    id: roomId,
    name: roomName,
    phase: 'waiting',
    hostId: userId,

    players: new Map(),
    drawerOrder: [],
    currentDrawerIndex: 0,
    roundNumber: 1,
    totalRounds: settings?.totalRounds || 3,
    turnTimer: settings?.roundTime || 80,
    wordSelectionTimer: settings?.wordSelectionTime || 15,
    turnTimerInterval: null,
    wordSelectionInterval: null,
    currentWord: null,
    wordOptions: [],
    wordHints: [],
    hintsRemaining: settings?.hints || 3,
    turnAwards: [],
    canvasHistory: [], // Legacy - deprecated
    canvasRedoHistory: [],
    commandHistory: [], // New Canvas Command Protocol
    settings: {
      ...getDefaultSettings(),
      ...settings,
    },
    createdAt: now,
    updatedAt: now,
  };
  
  // Add creator as first player (host)
  const host: Player = {
    userId,
    username,
    avatarId,
    socketId,
    connected: true,
    connectionState: 'connected',
    score: 0,
    isHost: true,
    isDrawer: false,
    guessedThisTurn: false,
    disconnectAt: null,
    joinAt: now,
  };
  
  room.players.set(userId, host);
  rooms.set(roomId, room);
  socketToUser.set(socketId, userId);
  userToRoom.set(userId, roomId);
  
  logger.info('ROOM', 'Room created', {
    roomId,
    hostId: userId,
    username,
    settings: room.settings,
  });
  
  return room;
}

/**
 * Join an existing room
 */
export function joinRoom(
  socketId: string,
  userId: string,
  username: string,
  avatarId: string = '👤',
  roomId: string
): { room: Room; player: Player; isReconnect: boolean } | null {
  const room = rooms.get(roomId);
  if (!room) {
    logger.warn('ROOM', 'Join failed: Room not found', { roomId, userId });
    return null;
  }
  
  // Check if room is full
  if (room.players.size >= room.settings.maxPlayers) {
    logger.warn('ROOM', 'Join failed: Room full', { roomId, userId, maxPlayers: room.settings.maxPlayers });
    return null;
  }
  
  // Check if player already in room (reconnect)
  const existingPlayer = room.players.get(userId);
  if (existingPlayer) {
    // Only treat this as a reconnect if the previous session is actually offline.
    if (existingPlayer.connected && existingPlayer.socketId && existingPlayer.socketId !== socketId) {
      logger.warn('ROOM', 'Join failed: Duplicate active player session', {
        roomId,
        userId,
        username: existingPlayer.username,
        existingSocketId: existingPlayer.socketId,
        newSocketId: socketId,
      });
      return null;
    }

    // Reconnect
    existingPlayer.socketId = socketId;
    existingPlayer.connected = true;
    existingPlayer.connectionState = 'connected';
    existingPlayer.disconnectAt = null;
    
    socketToUser.set(socketId, userId);
    userToRoom.set(userId, roomId);
    
    logger.info('ROOM', 'Player reconnected', {
      roomId,
      userId,
      username: existingPlayer.username,
    });
    
    return { room, player: existingPlayer, isReconnect: true };
  }
  
  // New player
  forceLeaveCurrentRoom(userId);
  
  const now = Date.now();
  const player: Player = {
    userId,
    username,
    avatarId,
    socketId,
    connected: true,
    connectionState: 'connected',
    score: 0,
    isHost: false,
    isDrawer: false,
    guessedThisTurn: false,
    disconnectAt: null,
    joinAt: now,
  };
  
  room.players.set(userId, player);
  room.updatedAt = now;
  socketToUser.set(socketId, userId);
  userToRoom.set(userId, roomId);
  
  logger.info('ROOM', 'Player joined', {
    roomId,
    userId,
    username,
    totalPlayers: room.players.size,
  });
  
  return { room, player, isReconnect: false };
}

/**
 * Force leave current room (prevents teleport bug)
 */
export function forceLeaveCurrentRoom(userId: string): void {
  const existingRoomId = userToRoom.get(userId);
  if (!existingRoomId) return;
  
  const room = rooms.get(existingRoomId);
  if (!room) {
    userToRoom.delete(userId);
    return;
  }
  
  const player = room.players.get(userId);
  if (player) {
    // If host, promote next player
    if (player.isHost && room.players.size > 1) {
      const nextHost = Array.from(room.players.values()).find(p => p.userId !== userId);
      if (nextHost) {
        nextHost.isHost = true;
        room.hostId = nextHost.userId;
        logger.info('ROOM', 'Host promoted', {
          roomId: existingRoomId,
          newHostId: nextHost.userId,
          oldHostId: userId,
        });
      }
    }
    
    room.players.delete(userId);
    logger.info('ROOM', 'Player removed from previous room', {
      roomId: existingRoomId,
      userId,
      remainingPlayers: room.players.size,
    });
  }
  
  userToRoom.delete(userId);
  
  // Clean up empty rooms
  if (room.players.size === 0) {
    cleanupRoom(existingRoomId);
  }
}

/**
 * Handle player disconnect (grace period)
 */
export function handleDisconnect(socketId: string): { roomId: string; userId: string; player: Player } | null {
  const userId = socketToUser.get(socketId);
  if (!userId) return null;
  
  const roomId = userToRoom.get(userId);
  if (!roomId) return null;
  
  const room = rooms.get(roomId);
  if (!room) return null;
  
  const player = room.players.get(userId);
  if (!player) return null;
  
  // Mark as offline (don't delete - grace period for reconnect)
  player.socketId = null;
  player.connected = false;
  player.connectionState = 'offline';
  player.disconnectAt = Date.now();
  
  socketToUser.delete(socketId);
  
  logger.info('ROOM', 'Player disconnected (grace period started)', {
    roomId,
    userId,
    username: player.username,
    gracePeriod: RECONNECT_GRACE_PERIOD,
  });
  
  return { roomId, userId, player };
}

/**
 * Handle intentional leave (immediate removal)
 */
export function handleIntentionalLeave(socketId: string): { roomId: string; userId: string; player: Player; roomEmpty: boolean } | null {
  const userId = socketToUser.get(socketId);
  if (!userId) return null;
  
  const roomId = userToRoom.get(userId);
  if (!roomId) return null;
  
  const room = rooms.get(roomId);
  if (!room) return null;
  
  const player = room.players.get(userId);
  if (!player) return null;
  
  // Remove immediately
  room.players.delete(userId);
  userToRoom.delete(userId);
  socketToUser.delete(socketId);
  
  // Handle host transfer
  if (player.isHost && room.players.size > 0) {
    const nextHost = Array.from(room.players.values())[0];
    nextHost.isHost = true;
    room.hostId = nextHost.userId;
  }
  
  const roomEmpty = room.players.size === 0;
  if (roomEmpty) {
    cleanupRoom(roomId);
  }
  
  logger.info('ROOM', 'Player left intentionally', {
    roomId,
    userId,
    username: player.username,
    roomEmpty,
  });
  
  return { roomId, userId, player, roomEmpty };
}

/**
 * Clean up and delete a room
 */
export function cleanupRoom(roomId: string): void {
  const room = rooms.get(roomId);
  if (!room) return;
  
  // Clear all timers
  if (room.turnTimerInterval) {
    clearInterval(room.turnTimerInterval);
  }
  if (room.wordSelectionInterval) {
    clearInterval(room.wordSelectionInterval);
  }
  
  // Remove all player mappings
  for (const [userId] of room.players) {
    userToRoom.delete(userId);
  }
  
  rooms.delete(roomId);
  
  logger.info('ROOM', 'Room cleaned up', { roomId });
}

/**
 * Get room by ID
 */
export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

/**
 * Get all active rooms (for lobby listing)
 */
export function getActiveRooms(): Room[] {
  return Array.from(rooms.values()).filter(room => {
    // Keep rooms visible if they still have live players or reconnectable players.
    const connectedPlayers = Array.from(room.players.values()).filter(p => p.connected).length;
    const reconnectingPlayers = Array.from(room.players.values()).filter(
      p => p.connectionState === 'offline'
    ).length;
    return room.phase === 'waiting' || connectedPlayers > 0 || reconnectingPlayers > 0;
  });
}

/**
 * Get player by socket ID
 */
export function getPlayerBySocket(socketId: string): { room: Room; player: Player } | null {
  const userId = socketToUser.get(socketId);
  if (!userId) return null;
  
  const roomId = userToRoom.get(userId);
  if (!roomId) return null;
  
  const room = rooms.get(roomId);
  if (!room) return null;
  
  const player = room.players.get(userId);
  if (!player) return null;
  
  return { room, player };
}

/**
 * Get room ID by user ID
 */
export function getRoomIdByUser(userId: string): string | undefined {
  return userToRoom.get(userId);
}

/**
 * Periodic cleanup of stale rooms and offline players
 */
export function runCleanup(): void {
  const now = Date.now();
  
  for (const [roomId, room] of rooms) {
    // Remove offline players past grace period
    for (const [userId, player] of room.players) {
      if (player.connectionState === 'offline' && player.disconnectAt) {
        const offlineDuration = now - player.disconnectAt;
        if (offlineDuration > RECONNECT_GRACE_PERIOD) {
          // Remove player
          room.players.delete(userId);
          userToRoom.delete(userId);
          
          logger.info('ROOM', 'Offline player removed after grace period', {
            roomId,
            userId,
            offlineDuration,
          });
          
          // Handle host transfer
          if (player.isHost && room.players.size > 0) {
            const nextHost = Array.from(room.players.values())[0];
            nextHost.isHost = true;
            room.hostId = nextHost.userId;
          }
        }
      }
    }
    
    // Delete empty rooms
    if (room.players.size === 0) {
      cleanupRoom(roomId);
      continue;
    }
    
    // Delete very old rooms only when they are effectively abandoned.
    const roomAge = now - room.createdAt;
    const connectedPlayers = Array.from(room.players.values()).filter(p => p.connected).length;
    if (roomAge > MAX_ROOM_AGE && connectedPlayers === 0) {
      logger.warn('ROOM', 'Deleting old room', { roomId, roomAge });
      cleanupRoom(roomId);
    }
  }
}

// Start periodic cleanup
setInterval(runCleanup, ROOM_CLEANUP_INTERVAL);

// Export server state for debugging
export function getServerStats(): { rooms: number; players: number } {
  let totalPlayers = 0;
  for (const room of rooms.values()) {
    totalPlayers += room.players.size;
  }
  return {
    rooms: rooms.size,
    players: totalPlayers,
  };
}

// Export socketToUser for use in other modules
export { socketToUser, userToRoom };
