-- Kribble Database Schema
-- Works for both PostgreSQL and SQLite

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE,
  password VARCHAR(255),
  avatar_id VARCHAR(50) DEFAULT '👤',
  level INTEGER DEFAULT 1,
  xp INTEGER DEFAULT 0,
  is_guest BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Word categories table
CREATE TABLE IF NOT EXISTS word_categories (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  words TEXT NOT NULL -- JSON array stored as text
);

-- Player stats table
CREATE TABLE IF NOT EXISTS player_stats (
  user_id VARCHAR(36) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  games_played INTEGER DEFAULT 0,
  games_won INTEGER DEFAULT 0,
  total_score INTEGER DEFAULT 0,
  words_drawn INTEGER DEFAULT 0,
  words_guessed INTEGER DEFAULT 0,
  total_play_time INTEGER DEFAULT 0, -- in seconds
  current_streak INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  last_played_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Match history table
CREATE TABLE IF NOT EXISTS match_history (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id VARCHAR(50),
  game_mode VARCHAR(50),
  score INTEGER DEFAULT 0,
  position INTEGER,
  words_guessed INTEGER DEFAULT 0,
  words_drawn INTEGER DEFAULT 0,
  play_time INTEGER DEFAULT 0, -- in seconds
  won BOOLEAN DEFAULT FALSE,
  played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily challenges table
CREATE TABLE IF NOT EXISTS daily_challenges (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_date DATE NOT NULL,
  challenge_id VARCHAR(50) NOT NULL,
  title VARCHAR(100) NOT NULL,
  description TEXT,
  target INTEGER NOT NULL,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  reward INTEGER DEFAULT 0,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, challenge_date, challenge_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_guest_expires ON users(is_guest, expires_at) WHERE is_guest = TRUE;
CREATE INDEX IF NOT EXISTS idx_match_history_user_id ON match_history(user_id);
CREATE INDEX IF NOT EXISTS idx_match_history_played_at ON match_history(played_at);
CREATE INDEX IF NOT EXISTS idx_daily_challenges_user_date ON daily_challenges(user_id, challenge_date);
CREATE INDEX IF NOT EXISTS idx_player_stats_xp ON users(xp DESC);
