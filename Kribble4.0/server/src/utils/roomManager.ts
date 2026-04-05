/**
 * Room Manager - Proper Multiplayer State Management
 * Fixes: Ghost rooms, sticky joins, offline/online tracking
 */

import { v4 as uuidv4 } from 'uuid';
import { rooms, getRoom, deleteRoom, createRoom, Room, Player, RoomSettings } from '../data/rooms.js';
import { logger } from './logger.js';

// Maps for tracking state
const socketToRoom = new Map<string, string>();      // socketId -> roomId
const userToRoom = new Map<string, string>();        // userId -> roomId
const socketToUser = new Map<string, string>();      // socketId -> userId

// Grace periods
const RECONNECT_WINDOW = 60000; // 60 seconds for reconnection
const ROOM_DELETE_DELAY = 30000; // 30 seconds to delete empty room

// Timers
const pendingRemovals = new Map<string, NodeJS.Timeout>(); // userId -> timeout
const roomDeleteTimers = new Map<string, NodeJS.Timeout>(); // roomId -> timeout

/**
 * Create a new room with proper cleanup of previous room
 */
export function createNewRoom(
  socketId: string,
  userId: string,
  username: string,
  roomName: string,
  settings: Partial<RoomSettings>
): { room: Room; player: Player } | null {
  // CRITICAL: Force leave any existing room first
  forceLeaveRoom(socketId, userId);

  // Create new room
  const room = createRoom(roomName, settings);
  
  // Create host player
  const player: Player = {
    id: userId,
    socketId: socketId,
    username: username || 'Player',
    avatarId: '👤',
    score: 0,
    isDrawer: false,
    isHost: true,
    connected: true,
    lastSeen: Date.now(),
  };

  room.players.push(player);
  
  // Track mappings
  socketToRoom.set(socketId, room.id);
  userToRoom.set(userId, room.id);
  socketToUser.set(socketId, userId);

  logger.info('ROOM', 'Room created', { 
    roomId: room.id, 
    userId, 
    username,
    previousRoomCleaned: true 
  });

  return { room, player };
}

/**
 * Join a room with proper duplicate prevention
 */
export function joinExistingRoom(
  socketId: string,
  userId: string,
  username: string,
  roomId: string
): { success: boolean; room?: Room; player?: Player; error?: string; isRejoin?: boolean } {
  
  // Check if already in this room (reconnection)
  const currentRoomId = userToRoom.get(userId);
  if (currentRoomId === roomId) {
    const room = getRoom(roomId);
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    // Find existing player
    const existingPlayer = room.players.find(p => p.id === userId);
    if (existingPlayer) {
      // Update socket and mark as reconnected
      existingPlayer.socketId = socketId;
      existingPlayer.connected = true;
      existingPlayer.lastSeen = Date.now();
      
      // Clear any pending removal
      clearPendingRemoval(userId);
      
      // Update mappings
      socketToRoom.set(socketId, roomId);
      socketToUser.set(socketId, userId);

      logger.info('ROOM', 'Player reconnected', { 
        roomId, 
        userId, 
        username: existingPlayer.username 
      });

      return { 
        success: true, 
        room, 
        player: existingPlayer, 
        isRejoin: true 
      };
    }
  }

  // If in different room, leave it first
  if (currentRoomId && currentRoomId !== roomId) {
    logger.info('ROOM', 'Leaving previous room before joining new one', {
      userId,
      previousRoom: currentRoomId,
      newRoom: roomId
    });
    forceLeaveRoom(socketId, userId);
  }

  // Get target room
  const room = getRoom(roomId);
  if (!room) {
    return { success: false, error: 'Room not found' };
  }

  // Check if room is full (only count connected players)
  const connectedPlayers = room.players.filter(p => p.connected).length;
  if (connectedPlayers >= room.maxPlayers) {
    return { success: false, error: 'Room is full' };
  }

  // Check if player already exists (disconnected state)
  const existingPlayer = room.players.find(p => p.id === userId);
  if (existingPlayer) {
    // Reactivate player
    existingPlayer.socketId = socketId;
    existingPlayer.connected = true;
    existingPlayer.lastSeen = Date.now();
    
    clearPendingRemoval(userId);
    
    socketToRoom.set(socketId, roomId);
    userToRoom.set(userId, roomId);
    socketToUser.set(socketId, userId);

    return { 
      success: true, 
      room, 
      player: existingPlayer, 
      isRejoin: true 
    };
  }

  // Create new player
  const player: Player = {
    id: userId,
    socketId: socketId,
    username: username || `Player${room.players.length + 1}`,
    avatarId: '👤',
    score: 0,
    isDrawer: false,
    isHost: room.players.length === 0,
    connected: true,
    lastSeen: Date.now(),
  };

  room.players.push(player);
  
  // Track mappings
  socketToRoom.set(socketId, roomId);
  userToRoom.set(userId, roomId);
  socketToUser.set(socketId, userId);

  // Cancel room deletion if scheduled
  cancelRoomDeletion(roomId);

  logger.info('ROOM', 'Player joined room', { 
    roomId, 
    userId, 
    username: player.username,
    totalPlayers: room.players.length 
  });

  return { success: true, room, player, isRejoin: false };
}

/**
 * Handle player disconnect - mark as offline but keep in room
 */
export function handleDisconnect(socketId: string): { 
  roomId?: string; 
  userId?: string; 
  player?: Player;
  wasHost?: boolean;
  wasDrawer?: boolean;
} {
  const roomId = socketToRoom.get(socketId);
  const userId = socketToUser.get(socketId);
  
  if (!roomId || !userId) {
    return {};
  }

  const room = getRoom(roomId);
  if (!room) {
    cleanupMappings(socketId, userId);
    return {};
  }

  const player = room.players.find(p => p.id === userId);
  if (!player) {
    cleanupMappings(socketId, userId);
    return {};
  }

  // Mark as disconnected but keep in room
  player.connected = false;
  player.disconnectedAt = Date.now();
  player.socketId = ''; // Clear socket reference
  
  const wasHost = player.isHost;
  const wasDrawer = player.isDrawer;

  // Clear socket mappings but keep user->room mapping
  socketToRoom.delete(socketId);
  socketToUser.delete(socketId);

  // Schedule removal after grace period
  schedulePlayerRemoval(userId, roomId);

  logger.info('ROOM', 'Player disconnected, grace period started', {
    roomId,
    userId,
    username: player.username,
    wasHost,
    wasDrawer
  });

  return { roomId, userId, player, wasHost, wasDrawer };
}

/**
 * Handle intentional leave - remove immediately
 * Also handles case where player disconnected first (socket mappings cleared)
 */
export function handleIntentionalLeave(socketId: string): {
  roomId?: string;
  userId?: string;
  player?: Player;
  roomEmpty?: boolean;
} {
  // First try to find by socket ID
  let roomId = socketToRoom.get(socketId);
  let userId = socketToUser.get(socketId);
  
  // If socket mappings are gone (player disconnected first), 
  // we need to find the user by checking all rooms
  if (!roomId || !userId) {
    // Search through all rooms to find a disconnected player that might be trying to leave
    for (const [id, room] of rooms.entries()) {
      const disconnectedPlayer = room.players.find(p => !p.connected && p.disconnectedAt && (Date.now() - p.disconnectedAt) < RECONNECT_WINDOW);
      if (disconnectedPlayer) {
        roomId = id;
        userId = disconnectedPlayer.id;
        logger.info('ROOM', 'Found disconnected player for intentional leave', {
          roomId,
          userId,
          username: disconnectedPlayer.username
        });
        break;
      }
    }
  }
  
  if (!roomId || !userId) {
    logger.warn('ROOM', 'Intentional leave failed: No room or user found', { socketId });
    return {};
  }

  return removePlayerFromRoom(socketId, userId, roomId, true);
}

/**
 * Force remove player from room (internal)
 */
function removePlayerFromRoom(
  socketId: string, 
  userId: string, 
  roomId: string,
  intentional: boolean
): { roomId: string; userId: string; player?: Player; roomEmpty: boolean } {
  
  const room = getRoom(roomId);
  if (!room) {
    cleanupMappings(socketId, userId);
    userToRoom.delete(userId);
    return { roomId, userId, roomEmpty: true };
  }

  // Find and remove player
  const playerIndex = room.players.findIndex(p => p.id === userId);
  if (playerIndex === -1) {
    cleanupMappings(socketId, userId);
    userToRoom.delete(userId);
    return { roomId, userId, roomEmpty: room.players.length === 0 };
  }

  const player = room.players[playerIndex];
  const wasHost = player.isHost;
  
  // Remove player
  room.players.splice(playerIndex, 1);
  
  // Promote new host if needed
  if (wasHost && room.players.length > 0) {
    const newHost = room.players[0];
    newHost.isHost = true;
    logger.info('ROOM', 'Host left, promoted new host', {
      roomId,
      oldHost: userId,
      newHost: newHost.id,
      newHostName: newHost.username
    });
  }

  // Clean up mappings
  cleanupMappings(socketId, userId);
  userToRoom.delete(userId);
  clearPendingRemoval(userId);

  const roomEmpty = room.players.length === 0;

  // If room empty, schedule deletion
  if (roomEmpty) {
    scheduleRoomDeletion(roomId);
  }

  logger.info('ROOM', 'Player removed from room', {
    roomId,
    userId,
    username: player.username,
    intentional,
    roomEmpty,
    remainingPlayers: room.players.length
  });

  return { roomId, userId, player, roomEmpty };
}

/**
 * Force leave room (for room creation)
 */
function forceLeaveRoom(socketId: string, userId: string): void {
  const currentRoomId = userToRoom.get(userId);
  if (!currentRoomId) return;

  const room = getRoom(currentRoomId);
  if (!room) {
    userToRoom.delete(userId);
    socketToRoom.delete(socketId);
    return;
  }

  // Remove from room
  const playerIndex = room.players.findIndex(p => p.id === userId);
  if (playerIndex !== -1) {
    const player = room.players[playerIndex];
    const wasHost = player.isHost;
    
    room.players.splice(playerIndex, 1);
    
    // Promote new host
    if (wasHost && room.players.length > 0) {
      room.players[0].isHost = true;
    }
  }

  // Clean up
  userToRoom.delete(userId);
  socketToRoom.delete(socketId);
  socketToUser.delete(socketId);
  clearPendingRemoval(userId);

  // Check if room should be deleted
  if (room.players.length === 0) {
    scheduleRoomDeletion(currentRoomId);
  }

  logger.info('ROOM', 'Force left room for new creation', {
    userId,
    oldRoomId: currentRoomId
  });
}

/**
 * Schedule player removal after grace period
 */
function schedulePlayerRemoval(userId: string, roomId: string): void {
  // Clear existing timer
  clearPendingRemoval(userId);

  const timer = setTimeout(() => {
    const room = getRoom(roomId);
    if (!room) {
      pendingRemovals.delete(userId);
      userToRoom.delete(userId);
      return;
    }

    const player = room.players.find(p => p.id === userId);
    if (!player) {
      pendingRemovals.delete(userId);
      userToRoom.delete(userId);
      return;
    }

    // Only remove if still disconnected
    if (!player.connected) {
      logger.info('ROOM', 'Grace period expired, removing player', {
        roomId,
        userId,
        username: player.username
      });

      // Find any socket mapping for this user
      let socketId = '';
      for (const [sid, uid] of socketToUser.entries()) {
        if (uid === userId) {
          socketId = sid;
          break;
        }
      }

      removePlayerFromRoom(socketId, userId, roomId, false);
    }

    pendingRemovals.delete(userId);
  }, RECONNECT_WINDOW);

  pendingRemovals.set(userId, timer);
}

/**
 * Schedule room deletion
 */
function scheduleRoomDeletion(roomId: string): void {
  cancelRoomDeletion(roomId);

  const timer = setTimeout(() => {
    const room = getRoom(roomId);
    if (!room) {
      roomDeleteTimers.delete(roomId);
      return;
    }

    // Only delete if still empty
    if (room.players.length === 0) {
      logger.info('ROOM', 'Deleting empty room', { roomId });
      deleteRoom(roomId);
    }

    roomDeleteTimers.delete(roomId);
  }, ROOM_DELETE_DELAY);

  roomDeleteTimers.set(roomId, timer);
}

/**
 * Cancel room deletion
 */
function cancelRoomDeletion(roomId: string): void {
  const timer = roomDeleteTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    roomDeleteTimers.delete(roomId);
  }
}

/**
 * Clear pending removal timer
 */
function clearPendingRemoval(userId: string): void {
  const timer = pendingRemovals.get(userId);
  if (timer) {
    clearTimeout(timer);
    pendingRemovals.delete(userId);
  }
}

/**
 * Clean up socket mappings
 */
function cleanupMappings(socketId: string, userId: string): void {
  socketToRoom.delete(socketId);
  socketToUser.delete(socketId);
}

/**
 * Get room list with accurate player counts
 */
export function getRoomList() {
  return Array.from(rooms.values()).map(room => {
    const connectedPlayers = room.players.filter(p => p.connected).length;
    const totalPlayers = room.players.length;
    
    return {
      id: room.id,
      name: room.name,
      players: connectedPlayers,
      totalPlayers,
      maxPlayers: room.maxPlayers,
      isPrivate: room.isPrivate,
      gameMode: room.settings.gameMode || 'normal',
    };
  });
}

/**
 * Get server stats
 */
export function getServerStats() {
  let totalPlayers = 0;
  let connectedPlayers = 0;
  let activeGames = 0;
  let roomsInLobby = 0;

  for (const room of rooms.values()) {
    totalPlayers += room.players.length;
    connectedPlayers += room.players.filter(p => p.connected).length;
    
    if (room.gameState.phase === 'lobby') {
      roomsInLobby++;
    } else {
      activeGames++;
    }
  }

  return {
    totalRooms: rooms.size,
    totalPlayers,
    connectedPlayers,
    activeGames,
    roomsInLobby,
    pendingRemovals: pendingRemovals.size,
    scheduledRoomDeletions: roomDeleteTimers.size,
  };
}

/**
 * Debug: Get all mappings
 */
export function getDebugInfo() {
  return {
    socketToRoom: Array.from(socketToRoom.entries()),
    userToRoom: Array.from(userToRoom.entries()),
    socketToUser: Array.from(socketToUser.entries()),
    pendingRemovals: Array.from(pendingRemovals.keys()),
    roomDeleteTimers: Array.from(roomDeleteTimers.keys()),
  };
}

/**
 * Cleanup on server shutdown
 */
export function cleanupAll(): void {
  for (const timer of pendingRemovals.values()) {
    clearTimeout(timer);
  }
  for (const timer of roomDeleteTimers.values()) {
    clearTimeout(timer);
  }
  pendingRemovals.clear();
  roomDeleteTimers.clear();
  socketToRoom.clear();
  userToRoom.clear();
  socketToUser.clear();
}

// Export maps for socket handlers (read-only access)
export { socketToRoom, userToRoom, socketToUser };
