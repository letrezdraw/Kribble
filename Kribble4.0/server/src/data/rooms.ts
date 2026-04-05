import { v4 as uuidv4 } from 'uuid';
import type { CanvasCommand } from '@kribble/shared';


export interface Player {

  id: string;
  socketId: string;
  username: string;
  avatarId: string;
  score: number;
  isDrawer: boolean;
  isHost: boolean;
  hasGuessedCorrectly?: boolean;
  disconnected?: boolean;
  // Connection state tracking
  connected?: boolean;
  lastSeen?: number;
  // Enhanced reconnection fields
  disconnectedAt?: number;
  wasDrawing?: boolean;
  roundsPresent?: number[];
  scoreBeforeDisconnect?: number;
  drawingData?: any;
  hasDrawnThisRound?: boolean; // Track if player has drawn in current round
}






export interface RoomSettings {
  roundTime: number;
  rounds: number;
  categories: string[];
  isPrivate?: boolean;
  password?: string;
  maxPlayers?: number;
  hints?: number;
  gameMode?: string;
  wordCount?: number;
  language?: string;
}



export interface GameState {
  phase: 'lobby' | 'selection' | 'drawing' | 'turnEnd' | 'roundEnd' | 'gameEnd' | 'freeDraw';
  currentRound: number;
  currentTurn: number; // Turn within current round (1 to playerCount)
  currentDrawerIndex: number;
  currentWord: string;
  wordHints: string[];
  hintsRemaining: number;
  timeRemaining: number;
  totalRounds: number;
  totalTurns: number; // Total turns in entire game (rounds * players)
  drawnPlayerIds: string[]; // Track which players have drawn in current round
}



export interface Room {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
  settings: RoomSettings;
  gameState: GameState;
  createdAt: Date;
  canvasState?: any[]; // Legacy: Store canvas strokes for persistence (deprecated)
  canvasRedoState?: any[]; // Legacy redo stack for stroke-based canvas sync
  // Canvas Command Protocol: Command history for deterministic replay
  commandHistory?: CanvasCommand[];
}



// Shared in-memory room storage
export const rooms = new Map<string, Room>();

// Helper functions
export function createRoom(name: string, settings: Partial<RoomSettings> = {}): Room {
  const roomId = `room-${uuidv4()}`;
  const room: Room = {
    id: roomId,
    name,
    players: [],
    maxPlayers: settings.maxPlayers || 8,
    isPrivate: settings.isPrivate || false,
    password: settings.password,
    settings: {
      roundTime: settings.roundTime || 60,
      rounds: settings.rounds || 6,
      categories: settings.categories || ['all'],
      isPrivate: settings.isPrivate || false,
      hints: settings.hints || 2,
      gameMode: settings.gameMode || 'normal',
    },

    gameState: {
      phase: 'lobby',
      currentRound: 1,
      currentTurn: 1,
      currentDrawerIndex: -1,
      currentWord: '',
      wordHints: [],
      hintsRemaining: 3,
      timeRemaining: settings.roundTime || 60,
      totalRounds: settings.rounds || 3,
      totalTurns: 0, // Will be calculated when game starts based on player count
      drawnPlayerIds: [], // Initialize empty - no one has drawn yet
    },


    createdAt: new Date(),
    canvasState: [],
    canvasRedoState: [],
  };
  
  rooms.set(roomId, room);
  return room;
}

export function getRoomList() {
  const roomList = Array.from(rooms.values()).map((room) => {
    // Only count connected players (not in grace period)
    const connectedPlayers = room.players.filter(p => !p.disconnected).length;
    console.log(`[getRoomList] Room ${room.id}: ${connectedPlayers} connected players (${room.players.length} total)`);
    return {
      id: room.id,
      name: room.name,
      players: connectedPlayers,
      maxPlayers: room.maxPlayers,
      isPrivate: room.isPrivate,
      gameMode: 'Casual',
    };
  });
  console.log(`[getRoomList] Total rooms: ${roomList.length}`);
  return roomList;
}



export function deleteRoom(roomId: string) {
  rooms.delete(roomId);
}

export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

// Cleanup functions for server maintenance

/**
 * Remove rooms that have been empty for a specified duration
 * @param maxEmptyDurationMs Maximum time in milliseconds a room can be empty (default: 30 minutes)
 * @returns Array of deleted room IDs
 */
export function cleanupEmptyRooms(maxEmptyDurationMs: number = 30 * 60 * 1000): string[] {
  const now = new Date();
  const deletedRooms: string[] = [];
  
  for (const [roomId, room] of rooms.entries()) {
    // Check if room is empty
    if (room.players.length === 0) {
      const roomAge = now.getTime() - room.createdAt.getTime();
      
      // Delete if room has been empty for longer than max duration
      if (roomAge > maxEmptyDurationMs) {
        rooms.delete(roomId);
        deletedRooms.push(roomId);
        console.log(`[cleanupEmptyRooms] Deleted empty room: ${roomId} (age: ${Math.floor(roomAge / 1000)}s)`);
      }
    }
  }
  
  return deletedRooms;
}

/**
 * Remove old rooms regardless of player count (for periodic full cleanup)
 * @param maxAgeMs Maximum room age in milliseconds (default: 2 hours)
 * @returns Array of deleted room IDs
 */
export function cleanupOldRooms(maxAgeMs: number = 2 * 60 * 60 * 1000): string[] {
  const now = new Date();
  const deletedRooms: string[] = [];
  
  for (const [roomId, room] of rooms.entries()) {
    const roomAge = now.getTime() - room.createdAt.getTime();
    
    if (roomAge > maxAgeMs) {
      rooms.delete(roomId);
      deletedRooms.push(roomId);
      console.log(`[cleanupOldRooms] Deleted old room: ${roomId} (age: ${Math.floor(roomAge / 60000)}min)`);
    }
  }
  
  return deletedRooms;
}

/**
 * Get server statistics for monitoring
 */
export function getServerStats(): {
  totalRooms: number;
  totalPlayers: number;
  activeGames: number;
  roomsInLobby: number;
  averagePlayersPerRoom: number;
} {
  let totalPlayers = 0;
  let activeGames = 0;
  let roomsInLobby = 0;
  
  for (const room of rooms.values()) {
    totalPlayers += room.players.length;
    
    if (room.gameState.phase === 'lobby') {
      roomsInLobby++;
    } else {
      activeGames++;
    }
  }
  
  const totalRooms = rooms.size;
  const averagePlayersPerRoom = totalRooms > 0 ? totalPlayers / totalRooms : 0;
  
  return {
    totalRooms,
    totalPlayers,
    activeGames,
    roomsInLobby,
    averagePlayersPerRoom: Math.round(averagePlayersPerRoom * 10) / 10,
  };
}

/**
 * Start automatic cleanup scheduler
 * @param intervalMs Cleanup interval in milliseconds (default: 5 minutes)
 * @returns Interval ID for cleanup
 */
export function startCleanupScheduler(intervalMs: number = 5 * 60 * 1000): NodeJS.Timeout {
  console.log(`[startCleanupScheduler] Starting room cleanup every ${intervalMs / 1000}s`);
  
  return setInterval(() => {
    const emptyDeleted = cleanupEmptyRooms(30 * 60 * 1000); // 30 min for empty rooms
    const oldDeleted = cleanupOldRooms(2 * 60 * 60 * 1000); // 2 hours for all rooms
    
    const stats = getServerStats();
    console.log(`[cleanupScheduler] Cleanup complete. Empty: ${emptyDeleted.length}, Old: ${oldDeleted.length}`);
    console.log(`[cleanupScheduler] Stats: ${stats.totalRooms} rooms, ${stats.totalPlayers} players, ${stats.activeGames} active games`);
  }, intervalMs);
}
