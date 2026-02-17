/**
 * Redis Client for Session and Room State Persistence
 * Provides scalable storage for game state, sessions, and leaderboards
 */

import Redis from 'ioredis';
import { logger } from './logger.js';

// Redis connection configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Key prefixes for organization
const KEY_PREFIXES = {
  SESSION: 'session:',
  ROOM: 'room:',
  ROOM_PLAYERS: 'room:players:',
  ROOM_STATE: 'room:state:',
  LEADERBOARD: 'leaderboard:',
  RATE_LIMIT: 'ratelimit:',
  CACHE: 'cache:',
  SETTINGS: 'settings:',
  ACHIEVEMENTS: 'achievements:',
  MATCH_HISTORY: 'match:',
} as const;

// TTL constants (in seconds)
const TTL = {
  SESSION: 24 * 60 * 60, // 24 hours
  ROOM: 2 * 60 * 60, // 2 hours (room expires if inactive)
  ROOM_STATE: 30 * 60, // 30 minutes for active game state
  CACHE: 5 * 60, // 5 minutes for general cache
  RATE_LIMIT: 60, // 1 minute for rate limiting windows
  LEADERBOARD: 60, // 1 minute cache for leaderboards
} as const;

class RedisClient {
  private client: Redis | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.initialize();
  }

  private initialize() {
    try {
      this.client = new Redis(REDIS_URL, {
        retryStrategy: (times) => {
          this.reconnectAttempts = times;
          if (times > this.maxReconnectAttempts) {
            logger.error('REDIS', 'Max reconnection attempts reached', new Error('Redis connection failed'));
            return null; // Stop retrying
          }
          const delay = Math.min(times * 50, 2000);
          logger.warn('REDIS', `Reconnecting in ${delay}ms... (attempt ${times})`);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        showFriendlyErrorStack: process.env.NODE_ENV !== 'production',
      });

      this.client.on('connect', () => {
        logger.info('REDIS', 'Connected to Redis');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      });

      this.client.on('error', (err) => {
        logger.error('REDIS', 'Redis error', err);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        logger.warn('REDIS', 'Redis connection closed');
        this.isConnected = false;
      });

    } catch (error) {
      logger.error('REDIS', 'Failed to initialize Redis client', error as Error);
      this.client = null;
    }
  }

  /**
   * Check if Redis is connected and available
   */
  isReady(): boolean {
    return this.isConnected && this.client !== null && this.client.status === 'ready';
  }

  /**
   * Get the Redis client instance
   */
  getClient(): Redis | null {
    return this.client;
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Store user session
   */
  async setSession(sessionId: string, userData: {
    userId: string;
    username: string;
    email?: string;
    avatarId?: string;
    isGuest: boolean;
    socketId?: string;
    lastActivity: number;
  }): Promise<void> {
    if (!this.isReady()) return;

    const key = `${KEY_PREFIXES.SESSION}${sessionId}`;
    try {
      await this.client!.setex(
        key,
        TTL.SESSION,
        JSON.stringify(userData)
      );
      logger.trace('REDIS', 'Session stored', { sessionId, userId: userData.userId });
    } catch (error) {
      logger.error('REDIS', 'Failed to store session', error as Error);
    }
  }

  /**
   * Get user session
   */
  async getSession(sessionId: string): Promise<{
    userId: string;
    username: string;
    email?: string;
    avatarId?: string;
    isGuest: boolean;
    socketId?: string;
    lastActivity: number;
  } | null> {
    if (!this.isReady()) return null;

    const key = `${KEY_PREFIXES.SESSION}${sessionId}`;
    try {
      const data = await this.client!.get(key);
      if (!data) return null;

      // Refresh TTL on access
      await this.client!.expire(key, TTL.SESSION);
      
      return JSON.parse(data);
    } catch (error) {
      logger.error('REDIS', 'Failed to get session', error as Error);
      return null;
    }
  }

  /**
   * Delete user session
   */
  async deleteSession(sessionId: string): Promise<void> {
    if (!this.isReady()) return;

    const key = `${KEY_PREFIXES.SESSION}${sessionId}`;
    try {
      await this.client!.del(key);
      logger.trace('REDIS', 'Session deleted', { sessionId });
    } catch (error) {
      logger.error('REDIS', 'Failed to delete session', error as Error);
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    if (!this.isReady()) return;

    const key = `${KEY_PREFIXES.SESSION}${sessionId}`;
    try {
      const exists = await this.client!.exists(key);
      if (exists) {
        await this.client!.expire(key, TTL.SESSION);
      }
    } catch (error) {
      logger.error('REDIS', 'Failed to update session activity', error as Error);
    }
  }

  // ==================== ROOM MANAGEMENT ====================

  /**
   * Store room data
   */
  async setRoom(roomId: string, roomData: {
    id: string;
    name: string;
    hostId: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
    settings: any;
    createdAt: number;
    updatedAt: number;
  }): Promise<void> {
    if (!this.isReady()) return;

    const key = `${KEY_PREFIXES.ROOM}${roomId}`;
    try {
      await this.client!.setex(
        key,
        TTL.ROOM,
        JSON.stringify(roomData)
      );
      logger.trace('REDIS', 'Room stored', { roomId });
    } catch (error) {
      logger.error('REDIS', 'Failed to store room', error as Error);
    }
  }

  /**
   * Get room data
   */
  async getRoom(roomId: string): Promise<any | null> {
    if (!this.isReady()) return null;

    const key = `${KEY_PREFIXES.ROOM}${roomId}`;
    try {
      const data = await this.client!.get(key);
      if (!data) return null;

      // Refresh TTL on access
      await this.client!.expire(key, TTL.ROOM);
      
      return JSON.parse(data);
    } catch (error) {
      logger.error('REDIS', 'Failed to get room', error as Error);
      return null;
    }
  }

  /**
   * Delete room
   */
  async deleteRoom(roomId: string): Promise<void> {
    if (!this.isReady()) return;

    try {
      const pipeline = this.client!.pipeline();
      
      // Delete all room-related keys
      pipeline.del(`${KEY_PREFIXES.ROOM}${roomId}`);
      pipeline.del(`${KEY_PREFIXES.ROOM_PLAYERS}${roomId}`);
      pipeline.del(`${KEY_PREFIXES.ROOM_STATE}${roomId}`);
      
      await pipeline.exec();
      logger.trace('REDIS', 'Room deleted', { roomId });
    } catch (error) {
      logger.error('REDIS', 'Failed to delete room', error as Error);
    }
  }

  /**
   * Store room players
   */
  async setRoomPlayers(roomId: string, players: any[]): Promise<void> {
    if (!this.isReady()) return;

    const key = `${KEY_PREFIXES.ROOM_PLAYERS}${roomId}`;
    try {
      await this.client!.setex(
        key,
        TTL.ROOM,
        JSON.stringify(players)
      );
    } catch (error) {
      logger.error('REDIS', 'Failed to store room players', error as Error);
    }
  }

  /**
   * Get room players
   */
  async getRoomPlayers(roomId: string): Promise<any[] | null> {
    if (!this.isReady()) return null;

    const key = `${KEY_PREFIXES.ROOM_PLAYERS}${roomId}`;
    try {
      const data = await this.client!.get(key);
      if (!data) return null;

      await this.client!.expire(key, TTL.ROOM);
      return JSON.parse(data);
    } catch (error) {
      logger.error('REDIS', 'Failed to get room players', error as Error);
      return null;
    }
  }

  /**
   * Store active game state
   */
  async setGameState(roomId: string, gameState: {
    phase: string;
    currentRound: number;
    currentTurn: number;
    currentDrawerIndex: number;
    currentWord: string;
    wordHints: string[];
    hintsRemaining: number;
    timeRemaining: number;
    canvasState?: any[];
    strokes?: any[];
  }): Promise<void> {
    if (!this.isReady()) return;

    const key = `${KEY_PREFIXES.ROOM_STATE}${roomId}`;
    try {
      await this.client!.setex(
        key,
        TTL.ROOM_STATE,
        JSON.stringify(gameState)
      );
      logger.trace('REDIS', 'Game state stored', { roomId, phase: gameState.phase });
    } catch (error) {
      logger.error('REDIS', 'Failed to store game state', error as Error);
    }
  }

  /**
   * Get active game state
   */
  async getGameState(roomId: string): Promise<any | null> {
    if (!this.isReady()) return null;

    const key = `${KEY_PREFIXES.ROOM_STATE}${roomId}`;
    try {
      const data = await this.client!.get(key);
      if (!data) return null;

      await this.client!.expire(key, TTL.ROOM_STATE);
      return JSON.parse(data);
    } catch (error) {
      logger.error('REDIS', 'Failed to get game state', error as Error);
      return null;
    }
  }

  // ==================== LEADERBOARD ====================

  /**
   * Update player score on leaderboard
   */
  async updateLeaderboard(userId: string, username: string, score: number): Promise<void> {
    if (!this.isReady()) return;

    try {
      // Add to global leaderboard
      await this.client!.zadd(
        `${KEY_PREFIXES.LEADERBOARD}global`,
        score,
        JSON.stringify({ userId, username })
      );

      // Set TTL on leaderboard
      await this.client!.expire(`${KEY_PREFIXES.LEADERBOARD}global`, TTL.LEADERBOARD);
      
      logger.trace('REDIS', 'Leaderboard updated', { userId, score });
    } catch (error) {
      logger.error('REDIS', 'Failed to update leaderboard', error as Error);
    }
  }

  /**
   * Get top players from leaderboard
   */
  async getLeaderboard(limit: number = 100): Promise<Array<{ userId: string; username: string; score: number }>> {
    if (!this.isReady()) return [];

    try {
      const results = await this.client!.zrevrange(
        `${KEY_PREFIXES.LEADERBOARD}global`,
        0,
        limit - 1,
        'WITHSCORES'
      );

      const leaderboard: Array<{ userId: string; username: string; score: number }> = [];
      for (let i = 0; i < results.length; i += 2) {
        const data = JSON.parse(results[i]);
        leaderboard.push({
          userId: data.userId,
          username: data.username,
          score: parseInt(results[i + 1], 10),
        });
      }

      return leaderboard;
    } catch (error) {
      logger.error('REDIS', 'Failed to get leaderboard', error as Error);
      return [];
    }
  }

  /**
   * Get player rank
   */
  async getPlayerRank(userId: string): Promise<number | null> {
    if (!this.isReady()) return null;

    try {
      const rank = await this.client!.zrevrank(`${KEY_PREFIXES.LEADERBOARD}global`, userId);
      return rank !== null ? rank + 1 : null; // 1-based ranking
    } catch (error) {
      logger.error('REDIS', 'Failed to get player rank', error as Error);
      return null;
    }
  }

  // ==================== RATE LIMITING ====================

  /**
   * Check rate limit for an action
   */
  async checkRateLimit(key: string, maxRequests: number, windowSeconds: number): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
  }> {
    if (!this.isReady()) {
      // Allow if Redis is down (fail open)
      return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowSeconds * 1000 };
    }

    const fullKey = `${KEY_PREFIXES.RATE_LIMIT}${key}`;
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - windowSeconds;

    try {
      // Remove old entries outside the window
      await this.client!.zremrangebyscore(fullKey, 0, windowStart);

      // Count current requests in window
      const currentCount = await this.client!.zcard(fullKey);

      if (currentCount >= maxRequests) {
        // Get the oldest request to calculate reset time
        const oldest = await this.client!.zrange(fullKey, 0, 0, 'WITHSCORES');
        const resetTime = (parseInt(oldest[1], 10) + windowSeconds) * 1000;

        return {
          allowed: false,
          remaining: 0,
          resetTime,
        };
      }

      // Add current request
      await this.client!.zadd(fullKey, now, `${now}-${Math.random()}`);
      await this.client!.expire(fullKey, windowSeconds);

      return {
        allowed: true,
        remaining: maxRequests - currentCount - 1,
        resetTime: (now + windowSeconds) * 1000,
      };
    } catch (error) {
      logger.error('REDIS', 'Rate limit check failed', error as Error);
      // Fail open
      return { allowed: true, remaining: maxRequests, resetTime: Date.now() + windowSeconds * 1000 };
    }
  }

  // ==================== CACHE ====================

  /**
   * Set cached value
   */
  async setCache(key: string, value: any, ttl: number = TTL.CACHE): Promise<void> {
    if (!this.isReady()) return;

    const fullKey = `${KEY_PREFIXES.CACHE}${key}`;
    try {
      await this.client!.setex(fullKey, ttl, JSON.stringify(value));
    } catch (error) {
      logger.error('REDIS', 'Failed to set cache', error as Error);
    }
  }

  /**
   * Get cached value
   */
  async getCache<T>(key: string): Promise<T | null> {
    if (!this.isReady()) return null;

    const fullKey = `${KEY_PREFIXES.CACHE}${key}`;
    try {
      const data = await this.client!.get(fullKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('REDIS', 'Failed to get cache', error as Error);
      return null;
    }
  }

  /**
   * Delete cached value
   */
  async deleteCache(key: string): Promise<void> {
    if (!this.isReady()) return;

    const fullKey = `${KEY_PREFIXES.CACHE}${key}`;
    try {
      await this.client!.del(fullKey);
    } catch (error) {
      logger.error('REDIS', 'Failed to delete cache', error as Error);
    }
  }

  // ==================== SETTINGS ====================

  /**
   * Store user settings
   */
  async setUserSettings(userId: string, settings: any): Promise<void> {
    if (!this.isReady()) return;

    const key = `${KEY_PREFIXES.SETTINGS}${userId}`;
    try {
      await this.client!.set(key, JSON.stringify(settings));
      logger.trace('REDIS', 'User settings stored', { userId });
    } catch (error) {
      logger.error('REDIS', 'Failed to store user settings', error as Error);
    }
  }

  /**
   * Get user settings
   */
  async getUserSettings(userId: string): Promise<any | null> {
    if (!this.isReady()) return null;

    const key = `${KEY_PREFIXES.SETTINGS}${userId}`;
    try {
      const data = await this.client!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('REDIS', 'Failed to get user settings', error as Error);
      return null;
    }
  }

  // ==================== ACHIEVEMENTS ====================

  /**
   * Store user achievements
   */
  async setUserAchievements(userId: string, achievements: any): Promise<void> {
    if (!this.isReady()) return;

    const key = `${KEY_PREFIXES.ACHIEVEMENTS}${userId}`;
    try {
      await this.client!.set(key, JSON.stringify(achievements));
    } catch (error) {
      logger.error('REDIS', 'Failed to store achievements', error as Error);
    }
  }

  /**
   * Get user achievements
   */
  async getUserAchievements(userId: string): Promise<any | null> {
    if (!this.isReady()) return null;

    const key = `${KEY_PREFIXES.ACHIEVEMENTS}${userId}`;
    try {
      const data = await this.client!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('REDIS', 'Failed to get achievements', error as Error);
      return null;
    }
  }

  // ==================== MATCH HISTORY ====================

  /**
   * Store match data for replay
   */
  async storeMatch(matchId: string, matchData: {
    roomId: string;
    players: any[];
    strokes: any[];
    word: string;
    startTime: number;
    endTime: number;
    winnerId?: string;
  }): Promise<void> {
    if (!this.isReady()) return;

    const key = `${KEY_PREFIXES.MATCH_HISTORY}${matchId}`;
    try {
      await this.client!.setex(
        key,
        7 * 24 * 60 * 60, // 7 days retention
        JSON.stringify(matchData)
      );
      logger.trace('REDIS', 'Match stored for replay', { matchId });
    } catch (error) {
      logger.error('REDIS', 'Failed to store match', error as Error);
    }
  }

  /**
   * Get match data for replay
   */
  async getMatch(matchId: string): Promise<any | null> {
    if (!this.isReady()) return null;

    const key = `${KEY_PREFIXES.MATCH_HISTORY}${matchId}`;
    try {
      const data = await this.client!.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('REDIS', 'Failed to get match', error as Error);
      return null;
    }
  }

  // ==================== UTILITY ====================

  /**
   * Get all active room IDs
   */
  async getActiveRooms(): Promise<string[]> {
    if (!this.isReady()) return [];

    try {
      const keys = await this.client!.keys(`${KEY_PREFIXES.ROOM}*`);
      return keys.map(key => key.replace(KEY_PREFIXES.ROOM, ''));
    } catch (error) {
      logger.error('REDIS', 'Failed to get active rooms', error as Error);
      return [];
    }
  }

  /**
   * Get server statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    activeRooms: number;
    activeSessions: number;
    memoryUsage: string;
  }> {
    if (!this.isReady()) {
      return {
        connected: false,
        activeRooms: 0,
        activeSessions: 0,
        memoryUsage: 'N/A',
      };
    }

    try {
      const [roomKeys, sessionKeys, info] = await Promise.all([
        this.client!.keys(`${KEY_PREFIXES.ROOM}*`),
        this.client!.keys(`${KEY_PREFIXES.SESSION}*`),
        this.client!.info('memory'),
      ]);

      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1].trim() : 'Unknown';

      return {
        connected: true,
        activeRooms: roomKeys.length,
        activeSessions: sessionKeys.length,
        memoryUsage,
      };
    } catch (error) {
      logger.error('REDIS', 'Failed to get stats', error as Error);
      return {
        connected: true,
        activeRooms: 0,
        activeSessions: 0,
        memoryUsage: 'Error',
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; latency: number }> {
    if (!this.isReady()) {
      return { healthy: false, latency: -1 };
    }

    const start = Date.now();
    try {
      await this.client!.ping();
      return {
        healthy: true,
        latency: Date.now() - start,
      };
    } catch (error) {
      return {
        healthy: false,
        latency: -1,
      };
    }
  }

  /**
   * Close connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.isConnected = false;
      logger.info('REDIS', 'Redis connection closed');
    }
  }
}

// Export singleton instance
export const redis = new RedisClient();

// Export for testing
export { RedisClient, KEY_PREFIXES, TTL };
