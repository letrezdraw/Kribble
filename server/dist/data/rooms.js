import { v4 as uuidv4 } from 'uuid';
// Shared in-memory room storage
export const rooms = new Map();
// Helper functions
export function createRoom(name, settings = {}) {
    const roomId = `room-${uuidv4()}`;
    const room = {
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
            currentDrawerIndex: -1,
            currentWord: '',
            wordHints: [],
            hintsRemaining: 3,
            timeRemaining: settings.roundTime || 60,
            totalRounds: settings.rounds || 6,
        },
        createdAt: new Date(),
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
export function deleteRoom(roomId) {
    rooms.delete(roomId);
}
export function getRoom(roomId) {
    return rooms.get(roomId);
}
// Cleanup functions for server maintenance
/**
 * Remove rooms that have been empty for a specified duration
 * @param maxEmptyDurationMs Maximum time in milliseconds a room can be empty (default: 30 minutes)
 * @returns Array of deleted room IDs
 */
export function cleanupEmptyRooms(maxEmptyDurationMs = 30 * 60 * 1000) {
    const now = new Date();
    const deletedRooms = [];
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
export function cleanupOldRooms(maxAgeMs = 2 * 60 * 60 * 1000) {
    const now = new Date();
    const deletedRooms = [];
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
export function getServerStats() {
    let totalPlayers = 0;
    let activeGames = 0;
    let roomsInLobby = 0;
    for (const room of rooms.values()) {
        totalPlayers += room.players.length;
        if (room.gameState.phase === 'lobby') {
            roomsInLobby++;
        }
        else {
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
export function startCleanupScheduler(intervalMs = 5 * 60 * 1000) {
    console.log(`[startCleanupScheduler] Starting room cleanup every ${intervalMs / 1000}s`);
    return setInterval(() => {
        const emptyDeleted = cleanupEmptyRooms(30 * 60 * 1000); // 30 min for empty rooms
        const oldDeleted = cleanupOldRooms(2 * 60 * 60 * 1000); // 2 hours for all rooms
        const stats = getServerStats();
        console.log(`[cleanupScheduler] Cleanup complete. Empty: ${emptyDeleted.length}, Old: ${oldDeleted.length}`);
        console.log(`[cleanupScheduler] Stats: ${stats.totalRooms} rooms, ${stats.totalPlayers} players, ${stats.activeGames} active games`);
    }, intervalMs);
}
