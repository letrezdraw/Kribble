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
    disconnectedAt?: number;
    wasDrawing?: boolean;
    roundsPresent?: number[];
    scoreBeforeDisconnect?: number;
    drawingData?: any;
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
    phase: 'lobby' | 'selection' | 'drawing' | 'roundEnd' | 'gameEnd' | 'freeDraw';
    currentRound: number;
    currentDrawerIndex: number;
    currentWord: string;
    wordHints: string[];
    hintsRemaining: number;
    timeRemaining: number;
    totalRounds: number;
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
}
export declare const rooms: Map<string, Room>;
export declare function createRoom(name: string, settings?: Partial<RoomSettings>): Room;
export declare function getRoomList(): {
    id: string;
    name: string;
    players: number;
    maxPlayers: number;
    isPrivate: boolean;
    gameMode: string;
}[];
export declare function deleteRoom(roomId: string): void;
export declare function getRoom(roomId: string): Room | undefined;
/**
 * Remove rooms that have been empty for a specified duration
 * @param maxEmptyDurationMs Maximum time in milliseconds a room can be empty (default: 30 minutes)
 * @returns Array of deleted room IDs
 */
export declare function cleanupEmptyRooms(maxEmptyDurationMs?: number): string[];
/**
 * Remove old rooms regardless of player count (for periodic full cleanup)
 * @param maxAgeMs Maximum room age in milliseconds (default: 2 hours)
 * @returns Array of deleted room IDs
 */
export declare function cleanupOldRooms(maxAgeMs?: number): string[];
/**
 * Get server statistics for monitoring
 */
export declare function getServerStats(): {
    totalRooms: number;
    totalPlayers: number;
    activeGames: number;
    roomsInLobby: number;
    averagePlayersPerRoom: number;
};
/**
 * Start automatic cleanup scheduler
 * @param intervalMs Cleanup interval in milliseconds (default: 5 minutes)
 * @returns Interval ID for cleanup
 */
export declare function startCleanupScheduler(intervalMs?: number): NodeJS.Timeout;
