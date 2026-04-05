import { Pool, PoolClient } from 'pg';

class DatabaseService {
  private pool: Pool | null = null;
  private useDatabase: boolean = false;

  constructor() {
    this.useDatabase = process.env.USE_DATABASE === 'true';
    
    if (this.useDatabase && process.env.DATABASE_URL) {
      this.pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });
      
      console.log('DatabaseService: PostgreSQL pool initialized');
    } else {
      console.log('DatabaseService: Running in memory-only mode');
    }
  }

  async initialize(): Promise<void> {
    if (!this.pool) return;

    try {
      const client = await this.pool.connect();
      
      // Create tables if they don't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS rooms (
          id VARCHAR(10) PRIMARY KEY,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_rooms_updated ON rooms(updated_at);
        
        CREATE TABLE IF NOT EXISTS game_states (
          room_id VARCHAR(10) PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
          data JSONB NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      client.release();
      console.log('DatabaseService: Tables initialized');
    } catch (error) {
      console.error('DatabaseService: Failed to initialize tables:', error);
      throw error;
    }
  }

  async getRoom(roomId: string): Promise<any | null> {
    if (!this.pool) return null;

    try {
      const result = await this.pool.query(
        'SELECT data FROM rooms WHERE id = $1',
        [roomId]
      );
      return result.rows[0]?.data || null;
    } catch (error) {
      console.error('DatabaseService: Error getting room:', error);
      return null;
    }
  }

  async saveRoom(roomId: string, data: any): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.query(
        `INSERT INTO rooms (id, data, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (id) 
         DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
        [roomId, JSON.stringify(data)]
      );
    } catch (error) {
      console.error('DatabaseService: Error saving room:', error);
    }
  }

  async deleteRoom(roomId: string): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.query('DELETE FROM rooms WHERE id = $1', [roomId]);
    } catch (error) {
      console.error('DatabaseService: Error deleting room:', error);
    }
  }

  async getAllRooms(): Promise<any[]> {
    if (!this.pool) return [];

    try {
      const result = await this.pool.query('SELECT id, data FROM rooms');
      return result.rows.map((row: { id: string; data: any }) => ({ id: row.id, ...row.data }));

    } catch (error) {
      console.error('DatabaseService: Error getting all rooms:', error);
      return [];
    }
  }

  async getGameState(roomId: string): Promise<any | null> {
    if (!this.pool) return null;

    try {
      const result = await this.pool.query(
        'SELECT data FROM game_states WHERE room_id = $1',
        [roomId]
      );
      return result.rows[0]?.data || null;
    } catch (error) {
      console.error('DatabaseService: Error getting game state:', error);
      return null;
    }
  }

  async saveGameState(roomId: string, data: any): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.query(
        `INSERT INTO game_states (room_id, data, updated_at) 
         VALUES ($1, $2, CURRENT_TIMESTAMP)
         ON CONFLICT (room_id) 
         DO UPDATE SET data = $2, updated_at = CURRENT_TIMESTAMP`,
        [roomId, JSON.stringify(data)]
      );
    } catch (error) {
      console.error('DatabaseService: Error saving game state:', error);
    }
  }

  async deleteGameState(roomId: string): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.query('DELETE FROM game_states WHERE room_id = $1', [roomId]);
    } catch (error) {
      console.error('DatabaseService: Error deleting game state:', error);
    }
  }

  async cleanupOldRooms(maxAgeHours: number = 24): Promise<void> {
    if (!this.pool) return;

    try {
      await this.pool.query(
        'DELETE FROM rooms WHERE updated_at < CURRENT_TIMESTAMP - INTERVAL \'1 hour\' * $1',
        [maxAgeHours]
      );
      console.log(`DatabaseService: Cleaned up rooms older than ${maxAgeHours} hours`);
    } catch (error) {
      console.error('DatabaseService: Error cleaning up old rooms:', error);
    }
  }

  async query(text: string, params?: any[]): Promise<any> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    return this.pool.query(text, params);
  }

  async getClient(): Promise<PoolClient | null> {
    if (!this.pool) return null;
    return this.pool.connect();
  }

  isConnected(): boolean {
    return this.pool !== null;
  }
}

export default new DatabaseService();
