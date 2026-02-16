import { db, isPostgres } from './index.js';

// PostgreSQL-compatible schema
const postgresSchemaSQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  avatar_id TEXT DEFAULT '👤',
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  is_guest BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Word categories table
CREATE TABLE IF NOT EXISTS word_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  words TEXT NOT NULL
);

-- Player stats table
CREATE TABLE IF NOT EXISTS player_stats (
  user_id TEXT PRIMARY KEY,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  words_guessed INTEGER DEFAULT 0,
  drawings_made INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Match history table
CREATE TABLE IF NOT EXISTS match_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  result TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  mode TEXT DEFAULT 'classic',
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Daily challenges table
CREATE TABLE IF NOT EXISTS daily_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  challenge_type TEXT NOT NULL,
  description TEXT NOT NULL,
  target INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  reward_xp INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_match_history_user_id ON match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_match_history_played_at ON match_history(played_at);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_id ON daily_challenges(user_id);
`;

// SQLite-compatible schema (for FileDB)
const sqliteSchemaSQL = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  avatar_id TEXT DEFAULT '👤',
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  is_guest BOOLEAN DEFAULT 0,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- Word categories table
CREATE TABLE IF NOT EXISTS word_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  words TEXT NOT NULL
);

-- Player stats table
CREATE TABLE IF NOT EXISTS player_stats (
  user_id TEXT PRIMARY KEY,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  words_guessed INTEGER DEFAULT 0,
  drawings_made INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Match history table
CREATE TABLE IF NOT EXISTS match_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  result TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  mode TEXT DEFAULT 'classic',
  played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Daily challenges table
CREATE TABLE IF NOT EXISTS daily_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  challenge_type TEXT NOT NULL,
  description TEXT NOT NULL,
  target INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT 0,
  reward_xp INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_match_history_user_id ON match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_match_history_played_at ON match_history(played_at);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_id ON daily_challenges(user_id);
`;


// Default word categories
const defaultCategories = [
  {
    id: 'animals',
    name: 'Animals',
    words: ['cat', 'dog', 'bird', 'fish', 'lion', 'tiger', 'bear', 'horse', 'cow', 'pig', 'elephant', 'giraffe', 'zebra', 'monkey', 'penguin', 'dolphin', 'whale', 'shark', 'eagle', 'owl']
  },
  {
    id: 'food',
    name: 'Food',
    words: ['pizza', 'burger', 'pasta', 'sushi', 'salad', 'cake', 'cookie', 'bread', 'rice', 'soup', 'sandwich', 'taco', 'burrito', 'noodles', 'steak', 'chicken', 'fish', 'shrimp', 'lobster', 'crab']
  },
  {
    id: 'objects',
    name: 'Objects',
    words: ['chair', 'table', 'phone', 'computer', 'book', 'pen', 'car', 'bike', 'house', 'tree', 'flower', 'sun', 'moon', 'star', 'cloud', 'rain', 'snow', 'mountain', 'river', 'ocean']
  },
  {
    id: 'jobs',
    name: 'Jobs',
    words: ['teacher', 'doctor', 'police', 'firefighter', 'chef', 'artist', 'musician', 'actor', 'scientist', 'engineer', 'pilot', 'driver', 'farmer', 'builder', 'nurse', 'dentist', 'lawyer', 'judge', 'president', 'king']
  },
  {
    id: 'sports',
    name: 'Sports',
    words: ['soccer', 'basketball', 'tennis', 'golf', 'swimming', 'running', 'cycling', 'boxing', 'wrestling', 'gymnastics', 'skating', 'skiing', 'surfing', 'climbing', 'dancing', 'yoga', 'karate', 'fencing', 'archery', 'shooting']
  }
];

export async function runMigrations(dbInstance?: any, isPg?: boolean) {
  console.log('[DB] Running migrations...');
  
  try {
    if (isPg && process.env.DATABASE_URL) {
      // PostgreSQL migrations - use the passed pool instance
      const pool = dbInstance;
      
      if (!pool) {
        console.error('[DB] No PostgreSQL pool provided for migrations');
        return;
      }
      
      const statements = postgresSchemaSQL.split(';').filter(s => s.trim());
      for (const statement of statements) {
        if (statement.trim()) {
          try {
            await pool.query(statement);
          } catch (err: any) {
            if (!err.message?.includes('already exists') && !err.message?.includes('duplicate key')) {
              console.log('[DB] Migration warning:', err.message);
            }
          }
        }
      }
      console.log('[DB] PostgreSQL migrations completed');
    } else {
      // FileDB/SQLite migrations
      if (dbInstance) {
        const statements = sqliteSchemaSQL.split(';').filter(s => s.trim());
        for (const statement of statements) {
          if (statement.trim()) {
            try {
              dbInstance.exec(statement);
            } catch (err: any) {
              if (!err.message?.includes('already exists')) {
                console.log('[DB] Migration warning:', err.message);
              }
            }
          }
        }
        console.log('[DB] SQLite migrations completed');
      } else {
        console.log('[DB] FileDB mode - no SQL migrations needed');
      }
    }
    
    // Seed default categories
    await seedCategories(dbInstance, isPg);
    
  } catch (error) {
    console.error('[DB] Migration failed:', error);
    // Don't throw - let the app continue
  }
}


async function seedCategories(dbInstance?: any, isPg?: boolean) {
  try {
    for (const category of defaultCategories) {
      // Check if exists
      let exists = false;
      if (isPg && process.env.DATABASE_URL) {
        const pool = dbInstance;
        if (pool) {
          const result = await pool.query('SELECT id FROM word_categories WHERE id = $1', [category.id]);
          exists = result.rows.length > 0;
        }
      } else if (dbInstance) {
        const result = dbInstance.prepare('SELECT id FROM word_categories WHERE id = ?').get(category.id);
        exists = !!result;
      } else {
        const result = db.prepare('SELECT id FROM word_categories WHERE id = ?').get(category.id);
        exists = !!result;
      }
      
      if (!exists) {
        if (isPg && process.env.DATABASE_URL) {
          const pool = dbInstance;
          if (pool) {
            await pool.query(
              'INSERT INTO word_categories (id, name, words) VALUES ($1, $2, $3)',
              [category.id, category.name, JSON.stringify(category.words)]
            );
            console.log(`[DB] Seeded category: ${category.name}`);
          }
        } else if (dbInstance) {
          dbInstance.prepare('INSERT INTO word_categories (id, name, words) VALUES (?, ?, ?)').run(
            category.id, category.name, JSON.stringify(category.words)
          );
          console.log(`[DB] Seeded category: ${category.name}`);
        } else {
          db.prepare('INSERT INTO word_categories (id, name, words) VALUES (?, ?, ?)').run(
            category.id, category.name, JSON.stringify(category.words)
          );
          console.log(`[DB] Seeded category: ${category.name}`);
        }
      }
    }
    console.log('[DB] Categories seeded successfully');
  } catch (error) {
    console.error('[DB] Error seeding categories:', error);
    // Don't throw - let the app continue
  }
}


// Legacy export for compatibility
export async function seedDefaultCategories(dbInstance?: any, isPg?: boolean) {
  await seedCategories(dbInstance, isPg);
}
