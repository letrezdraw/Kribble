import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database type detection
const DATABASE_URL = process.env.DATABASE_URL;
export const isPostgres = !!DATABASE_URL;

// Database instances
let pgPool: any = null;

// Simple file-based database for development (no native dependencies)
class FileDB {
  private dataPath: string;
  private data: any = {};
  
  constructor(dataPath: string) {
    this.dataPath = dataPath;
    this.load();
  }
  
  private load() {
    try {
      if (existsSync(this.dataPath)) {
        const content = readFileSync(this.dataPath, 'utf-8');
        this.data = JSON.parse(content);
        // Ensure all required properties exist
        this.data.users = this.data.users || {};
        this.data.word_categories = this.data.word_categories || {};
        this.data.player_stats = this.data.player_stats || {};
        this.data.match_history = this.data.match_history || [];
        this.data.daily_challenges = this.data.daily_challenges || {};
        this.data.achievements = this.data.achievements || {};
      } else {
        this.data = {
          users: {},
          word_categories: {},
          player_stats: {},
          match_history: [],
          daily_challenges: {},
          achievements: {}
        };
        this.save();
      }
    } catch (e) {
      console.error('[DB] Error loading file DB:', e);
      this.data = { users: {}, word_categories: {}, player_stats: {}, match_history: [], daily_challenges: {}, achievements: {} };
    }
  }

  
  private save() {
    try {
      writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (e) {
      console.error('[DB] Error saving file DB:', e);
    }
  }
  
  // SQLite-compatible interface
  prepare(sql: string) {
    const lowerSql = sql.toLowerCase();
    
    return {
      get: (...params: any[]) => {
        // SELECT single row
        if (lowerSql.includes('from users')) {
          if (lowerSql.includes('where id =')) {
            return this.data.users[params[0]] || null;
          }
          if (lowerSql.includes('where email =') || lowerSql.includes('where username =')) {
            for (const user of Object.values(this.data.users)) {
              const u = user as any;
              if (lowerSql.includes('email') && u.email === params[0]) return u;
              if (lowerSql.includes('username') && u.username === params[0]) return u;
            }
            return null;
          }
          if (lowerSql.includes('count(*)')) {
            return { count: Object.keys(this.data.users).length };
          }
        }
        if (lowerSql.includes('from word_categories')) {
          if (lowerSql.includes('where id =')) {
            return this.data.word_categories[params[0]] || null;
          }
          if (lowerSql.includes('select id, name')) {
            return Object.values(this.data.word_categories).map((c: any) => ({ id: c.id, name: c.name }));
          }
          if (lowerSql.includes('select words')) {
            return Object.values(this.data.word_categories).map((c: any) => ({ words: JSON.stringify(c.words) }));
          }
          if (lowerSql.includes('count(*)')) {
            return { count: Object.keys(this.data.word_categories).length };
          }
        }
        if (lowerSql.includes('from player_stats')) {
          return this.data.player_stats[params[0]] || null;
        }
        if (lowerSql.includes('from achievements')) {
          const userId = params[0];
          return this.data.achievements[userId] || null;
        }
        return null;
      },
      
      all: (...params: any[]) => {
        // SELECT multiple rows
        if (lowerSql.includes('from match_history')) {
          const userId = params[0];
          const limit = params[1] || 20;
          return this.data.match_history
            .filter((m: any) => m.user_id === userId)
            .sort((a: any, b: any) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
            .slice(0, limit);
        }
        if (lowerSql.includes('from word_categories')) {
          return Object.values(this.data.word_categories).map((c: any) => ({ words: JSON.stringify(c.words) }));
        }
        if (lowerSql.includes('from users')) {
          // Leaderboard query
          const users = Object.values(this.data.users).map((u: any) => ({
            ...u,
            games_played: this.data.player_stats[u.id]?.games_played || 0,
            games_won: this.data.player_stats[u.id]?.games_won || 0,
            total_score: this.data.player_stats[u.id]?.total_score || 0
          }));
          return users.sort((a: any, b: any) => b.xp - a.xp).slice(0, params[0] || 100);
        }
        if (lowerSql.includes('from achievements')) {
          const userId = params[0];
          return this.data.achievements[userId] ? Object.values(this.data.achievements[userId]) : [];
        }
        return [];
      },
      
      run: (...params: any[]) => {
        // INSERT or UPDATE
        if (lowerSql.includes('insert into users')) {
          const [id, username, email, password, avatar_id, level, xp, is_guest, expires_at] = params;
          this.data.users[id] = {
            id, username, email, password, avatar_id, level, xp, is_guest, expires_at,
            created_at: new Date().toISOString()
          };
          this.save();
          return { lastInsertRowid: id, changes: 1 };
        }

        if (lowerSql.includes('update users')) {
          const userId = params[params.length - 1];
          if (this.data.users[userId]) {
            if (lowerSql.includes('username')) this.data.users[userId].username = params[0];
            if (lowerSql.includes('avatar_id')) this.data.users[userId].avatar_id = params[0];
            if (lowerSql.includes('settings')) this.data.users[userId].settings = params[0];
            this.save();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
        if (lowerSql.includes('insert into word_categories')) {
          const [id, name, words] = params;
          this.data.word_categories[id] = { id, name, words: JSON.parse(words) };
          this.save();
          return { lastInsertRowid: id, changes: 1 };
        }
        if (lowerSql.includes('insert into player_stats')) {
          const [userId, gamesPlayed, gamesWon, totalScore, wordsDrawn, wordsGuessed, totalPlayTime, currentStreak, bestStreak, lastPlayedAt] = params;
          this.data.player_stats[userId] = {
            user_id: userId, games_played: gamesPlayed, games_won: gamesWon,
            total_score: totalScore, words_drawn: wordsDrawn, words_guessed: wordsGuessed,
            total_play_time: totalPlayTime, current_streak: currentStreak,
            best_streak: bestStreak, last_played_at: lastPlayedAt,
            updated_at: new Date().toISOString()
          };
          this.save();
          return { changes: 1 };
        }
        if (lowerSql.includes('insert into match_history')) {
          const [id, userId, roomId, gameMode, score, position, wordsGuessed, wordsDrawn, playTime, won] = params;
          this.data.match_history.push({
            id, user_id: userId, room_id: roomId, game_mode: gameMode,
            score, position, words_guessed: wordsGuessed, words_drawn: wordsDrawn,
            play_time: playTime, won, played_at: new Date().toISOString()
          });
          // Keep only last 50 per user
          const userMatches = this.data.match_history.filter((m: any) => m.user_id === userId);
          if (userMatches.length > 50) {
            const toRemove = userMatches.slice(50).map((m: any) => m.id);
            this.data.match_history = this.data.match_history.filter((m: any) => !toRemove.includes(m.id));
          }
          this.save();
          return { lastInsertRowid: id, changes: 1 };
        }
        if (lowerSql.includes('insert into achievements')) {
          const [userId, achievementId, title, description, icon] = params;
          if (!this.data.achievements[userId]) {
            this.data.achievements[userId] = {};
          }
          this.data.achievements[userId][achievementId] = {
            user_id: userId,
            achievement_id: achievementId,
            title,
            description,
            icon,
            unlocked_at: new Date().toISOString()
          };
          this.save();
          return { lastInsertRowid: 1, changes: 1 };
        }
        return { lastInsertRowid: 1, changes: 1 };
      }
    };
  }
  
  exec(sql: string) {
    // CREATE TABLE - just log, tables are implicit
    console.log('[DB] Exec:', sql.substring(0, 50) + '...');
  }
}

// FileDB instance for development
let fileDb: FileDB | null = null;

// Initialize PostgreSQL
async function initPostgres() {
  if (!DATABASE_URL) throw new Error('DATABASE_URL not set');
  
  const { Pool } = await import('pg');
  pgPool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionTimeoutMillis: 10000, // 10 second timeout
    idleTimeoutMillis: 30000,
    max: 10
  });
  
  // Test connection with timeout
  const connectPromise = pgPool.connect();
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('PostgreSQL connection timeout')), 10000)
  );
  
  const client = await Promise.race([connectPromise, timeoutPromise]);
  console.log('[DB] PostgreSQL connected successfully');
  (client as any).release();
  
  return pgPool;
}


// Initialize FileDB (development)
async function initFileDB() {
  // Ensure data directory exists
  const dataDir = join(__dirname, '../../data');
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  
  const dbPath = join(dataDir, 'database.json');
  fileDb = new FileDB(dbPath);
  
  console.log('[DB] File-based database initialized at:', dbPath);
  return fileDb;
}

// Initialize database
export async function initDatabase() {
  console.log('[DB] Initializing database...');
  console.log('[DB] Mode:', isPostgres ? 'PostgreSQL (Production)' : 'FileDB (Development)');
  
  try {
    if (isPostgres) {
      await initPostgres();
    } else {
      await initFileDB();
    }

    
    // Run migrations with timeout
    const migrationPromise = (async () => {
      const { runMigrations, seedDefaultCategories } = await import('./migrate.js');
      await runMigrations(isPostgres ? pgPool : fileDb, isPostgres);
      await seedDefaultCategories(isPostgres ? pgPool : fileDb, isPostgres);
    })();
    
    const migrationTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database migration timeout')), 30000)
    );
    
    await Promise.race([migrationPromise, migrationTimeout]);
    
    console.log('[DB] Database ready');
  } catch (error) {
    console.error('[DB] Database initialization failed:', error);
    // Fall back to FileDB if PostgreSQL fails
    if (isPostgres) {
      console.log('[DB] Falling back to FileDB...');
      await initFileDB();
      const { runMigrations, seedDefaultCategories } = await import('./migrate.js');
      await runMigrations(fileDb, false);
      await seedDefaultCategories(fileDb, false);
      console.log('[DB] FileDB fallback ready');
    } else {
      throw error;
    }
  }
}


// Query helpers
export async function query(sql: string, params: any[] = []): Promise<any> {
  if (isPostgres) {
    // Convert ? placeholders to $1, $2, etc. for PostgreSQL
    let pgSql = sql;
    let paramIndex = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${paramIndex++}`);
    }
    const result = await pgPool.query(pgSql, params);
    return result.rows;
  } else {
    // FileDB - use prepare interface
    const lowerSql = sql.trim().toLowerCase();
    if (lowerSql.startsWith('select')) {
      if (lowerSql.includes('limit 1') || (lowerSql.includes('where') && !lowerSql.includes('order'))) {
        return fileDb!.prepare(sql).get(...params);
      }
      return fileDb!.prepare(sql).all(...params);
    } else {
      return fileDb!.prepare(sql).run(...params);
    }
  }
}

export async function queryOne(sql: string, params: any[] = []): Promise<any> {
  const result = await query(sql, params);
  return Array.isArray(result) ? result[0] : result;
}

export async function run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
  if (isPostgres) {
    let pgSql = sql;
    let paramIndex = 1;
    while (pgSql.includes('?')) {
      pgSql = pgSql.replace('?', `$${paramIndex++}`);
    }
    const result = await pgPool.query(pgSql, params);
    return { 
      lastID: result.rows[0]?.id,
      changes: result.rowCount 
    };
  } else {
    const result = fileDb!.prepare(sql).run(...params);
    return {
      lastID: result.lastInsertRowid,
      changes: result.changes
    };
  }
}

// Legacy db interface for compatibility
export const db = {
  prepare: (sql: string) => {
    if (isPostgres) {
      // PostgreSQL prepare interface
      return {
        get: async (...params: any[]) => {
          const result = await queryOne(sql, params);
          return result || null;
        },
        all: async (...params: any[]) => {
          const result = await query(sql, params);
          return Array.isArray(result) ? result : [];
        },
        run: async (...params: any[]) => {
          return run(sql, params);
        }
      };
    } else {
      // FileDB uses sync interface
      return fileDb!.prepare(sql);
    }
  },
  exec: async (sql: string) => {
    if (isPostgres) {
      await pgPool.query(sql);
    } else {
      fileDb!.exec(sql);
    }
  }
};

// Player Stats Functions
export async function getPlayerStats(userId: string): Promise<any> {
  const stats = await queryOne(
    'SELECT * FROM player_stats WHERE user_id = ?',
    [userId]
  );
  
  if (!stats) {
    return {
      userId,
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      wordsDrawn: 0,
      wordsGuessed: 0,
      totalPlayTime: 0,
      currentStreak: 0,
      bestStreak: 0,
      lastPlayedAt: null
    };
  }
  
  return {
    userId: stats.user_id,
    gamesPlayed: stats.games_played,
    gamesWon: stats.games_won,
    totalScore: stats.total_score,
    wordsDrawn: stats.words_drawn,
    wordsGuessed: stats.words_guessed,
    totalPlayTime: stats.total_play_time,
    currentStreak: stats.current_streak,
    bestStreak: stats.best_streak,
    lastPlayedAt: stats.last_played_at
  };
}

export async function updatePlayerStats(userId: string, updates: Partial<any>): Promise<void> {
  const current = await getPlayerStats(userId);
  const updated = { ...current, ...updates };
  
  await run(`
    INSERT INTO player_stats (
      user_id, games_played, games_won, total_score, words_drawn, 
      words_guessed, total_play_time, current_streak, best_streak, last_played_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      games_played = excluded.games_played,
      games_won = excluded.games_won,
      total_score = excluded.total_score,
      words_drawn = excluded.words_drawn,
      words_guessed = excluded.words_guessed,
      total_play_time = excluded.total_play_time,
      current_streak = excluded.current_streak,
      best_streak = excluded.best_streak,
      last_played_at = excluded.last_played_at,
      updated_at = CURRENT_TIMESTAMP
  `, [
    userId, updated.gamesPlayed, updated.gamesWon, updated.totalScore,
    updated.wordsDrawn, updated.wordsGuessed, updated.totalPlayTime,
    updated.currentStreak, updated.bestStreak, updated.lastPlayedAt
  ]);
}

export async function incrementPlayerStat(userId: string, field: string, value: number = 1): Promise<void> {
  const stats = await getPlayerStats(userId);
  const updatedValue = (stats[field] || 0) + value;
  
  const fieldMap: Record<string, string> = {
    gamesPlayed: 'games_played',
    gamesWon: 'games_won',
    totalScore: 'total_score',
    wordsDrawn: 'words_drawn',
    wordsGuessed: 'words_guessed',
    totalPlayTime: 'total_play_time',
    currentStreak: 'current_streak',
    bestStreak: 'best_streak'
  };
  
  const dbField = fieldMap[field] || field;
  
  await run(`
    INSERT INTO player_stats (user_id, ${dbField}, last_played_at) 
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id) DO UPDATE SET
      ${dbField} = ${dbField} + ?,
      last_played_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
  `, [userId, updatedValue, value]);
}

// Match History Functions
export async function addMatchHistory(userId: string, match: any): Promise<void> {
  const matchId = uuidv4();
  
  await run(`
    INSERT INTO match_history (
      id, user_id, room_id, game_mode, score, position, 
      words_guessed, words_drawn, play_time, won
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    matchId, userId, match.roomId, match.gameMode, match.score || 0,
    match.position, match.wordsGuessed || 0, match.wordsDrawn || 0,
    match.playTime || 0, match.won || false
  ]);
  
  // Keep only last 50 matches
  const matches = await query(
    'SELECT id FROM match_history WHERE user_id = ? ORDER BY played_at DESC',
    [userId]
  );
  
  if (Array.isArray(matches) && matches.length > 50) {
    const idsToDelete = matches.slice(50).map((m: any) => m.id);
    if (isPostgres) {
      await pgPool.query(
        'DELETE FROM match_history WHERE id = ANY($1)',
        [idsToDelete]
      );
    } else {
      // FileDB handles this automatically in the insert
    }
  }
}

export async function getMatchHistory(userId: string, limit: number = 20): Promise<any[]> {
  const matches = await query(
    'SELECT * FROM match_history WHERE user_id = ? ORDER BY played_at DESC LIMIT ?',
    [userId, limit]
  );
  
  return (Array.isArray(matches) ? matches : []).map(m => ({
    id: m.id,
    roomId: m.room_id,
    gameMode: m.game_mode,
    score: m.score,
    position: m.position,
    wordsGuessed: m.words_guessed,
    wordsDrawn: m.words_drawn,
    playTime: m.play_time,
    won: m.won,
    playedAt: m.played_at
  }));
}

// Leaderboard Functions
export async function getLeaderboard(limit: number = 100): Promise<any[]> {
  const users = await query(`
    SELECT u.id, u.username, u.avatar_id, u.level, u.xp,
           COALESCE(ps.games_played, 0) as games_played,
           COALESCE(ps.games_won, 0) as games_won,
           COALESCE(ps.total_score, 0) as total_score
    FROM users u
    LEFT JOIN player_stats ps ON u.id = ps.user_id
    ORDER BY u.xp DESC, COALESCE(ps.total_score, 0) DESC
    LIMIT ?
  `, [limit]);
  
  const entries = (Array.isArray(users) ? users : []).map((user: any, index: number) => {
    const winRate = user.games_played > 0 
      ? Math.round((user.games_won / user.games_played) * 100) 
      : 0;
    
    return {
      userId: user.id,
      username: user.username,
      avatarId: user.avatar_id,
      level: user.level,
      xp: user.xp,
      gamesPlayed: user.games_played,
      gamesWon: user.games_won,
      totalScore: user.total_score,
      winRate,
      rank: index + 1
    };
  });
  
  return entries;
}

// Daily Challenges Functions
export async function getDailyChallenges(userId: string): Promise<any[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const existing = await query(
    'SELECT * FROM daily_challenges WHERE user_id = ? AND challenge_date = ?',
    [userId, today]
  );
  
  if (Array.isArray(existing) && existing.length > 0) {
    return existing.map(c => ({
      id: c.challenge_id,
      title: c.title,
      description: c.description,
      target: c.target,
      progress: c.progress,
      completed: c.completed,
      reward: c.reward,
      expiresAt: c.expires_at
    }));
  }
  
  // Generate new challenges
  const challenges = generateDailyChallenges();
  
  for (const challenge of challenges) {
    await run(`
      INSERT INTO daily_challenges (
        user_id, challenge_date, challenge_id, title, description, 
        target, reward, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId, today, challenge.id, challenge.title, challenge.description,
      challenge.target, challenge.reward, challenge.expiresAt
    ]);
  }
  
  return challenges;
}

export async function updateChallengeProgress(userId: string, challengeId: string, progress: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  const challenge = await queryOne(
    'SELECT * FROM daily_challenges WHERE user_id = ? AND challenge_date = ? AND challenge_id = ?',
    [userId, today, challengeId]
  );
  
  if (!challenge || challenge.completed) return;
  
  const newProgress = Math.min(challenge.target, progress);
  const completed = newProgress >= challenge.target;
  
  await run(`
    UPDATE daily_challenges 
    SET progress = ?, completed = ? 
    WHERE user_id = ? AND challenge_date = ? AND challenge_id = ?
  `, [newProgress, completed, userId, today, challengeId]);
}

function generateDailyChallenges(): any[] {
  const challengesPool = [
    { title: 'Win a Game', description: 'Win 1 game today', target: 1, reward: 100 },
    { title: 'Quick Guesser', description: 'Guess 5 words correctly', target: 5, reward: 150 },
    { title: 'Artist', description: 'Draw 3 words that get guessed', target: 3, reward: 150 },
    { title: 'Social Butterfly', description: 'Play 3 games', target: 3, reward: 200 },
    { title: 'High Scorer', description: 'Score 1000+ points in a game', target: 1000, reward: 250 },
    { title: 'Streak Master', description: 'Win 2 games in a row', target: 2, reward: 300 },
  ];
  
  const shuffled = [...challengesPool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, 3).map((c, i) => ({
    id: `daily-${i}`,
    ...c,
    progress: 0,
    completed: false,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }));
}

// Word Categories Functions
export async function getWordsByCategory(categoryId?: string): Promise<string[]> {
  if (categoryId && categoryId !== 'all') {
    const cat = await queryOne(
      'SELECT words FROM word_categories WHERE id = ?',
      [categoryId]
    );
    return cat ? JSON.parse(cat.words) : [];
  }
  
  const allCats = await query('SELECT words FROM word_categories');
  const allWords: string[] = [];
  
  for (const cat of (Array.isArray(allCats) ? allCats : [])) {
    allWords.push(...JSON.parse(cat.words));
  }
  
  return allWords;
}

export async function getWordCategories(): Promise<{ id: string; name: string }[]> {
  const cats = await query('SELECT id, name FROM word_categories');
  return (Array.isArray(cats) ? cats : []).map((c: any) => ({
    id: c.id,
    name: c.name
  }));
}

// Achievement Functions
export async function getAchievements(userId: string): Promise<any[]> {
  const achievements = await query(
    'SELECT * FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC',
    [userId]
  );
  
  return (Array.isArray(achievements) ? achievements : []).map(a => ({
    id: a.achievement_id,
    title: a.title,
    description: a.description,
    icon: a.icon,
    unlockedAt: a.unlocked_at
  }));
}

export async function unlockAchievement(userId: string, achievementId: string, title: string, description: string, icon: string = '🏆'): Promise<boolean> {
  // Check if already unlocked
  const existing = await queryOne(
    'SELECT * FROM achievements WHERE user_id = ? AND achievement_id = ?',
    [userId, achievementId]
  );
  
  if (existing) return false; // Already unlocked
  
  // Unlock new achievement
  await run(`
    INSERT INTO achievements (user_id, achievement_id, title, description, icon)
    VALUES (?, ?, ?, ?, ?)
  `, [userId, achievementId, title, description, icon]);
  
  return true;
}

// Achievement definitions
export const ACHIEVEMENTS = {
  FIRST_WIN: { id: 'first_win', title: 'First Victory', description: 'Win your first game', icon: '🏆' },
  WINNING_STREAK_3: { id: 'winning_streak_3', title: 'On Fire', description: 'Win 3 games in a row', icon: '🔥' },
  WINNING_STREAK_5: { id: 'winning_streak_5', title: 'Unstoppable', description: 'Win 5 games in a row', icon: '⚡' },
  MASTER_GUESSER: { id: 'master_guesser', title: 'Master Guesser', description: 'Guess 100 words correctly', icon: '🎯' },
  MASTER_ARTIST: { id: 'master_artist', title: 'Master Artist', description: 'Draw 50 words that get guessed', icon: '🎨' },
  SPEED_DEMON: { id: 'speed_demon', title: 'Speed Demon', description: 'Guess a word in under 5 seconds', icon: '⚡' },
  SOCIAL_BUTTERFLY: { id: 'social_butterfly', title: 'Social Butterfly', description: 'Play 50 games', icon: '🦋' },
  HIGH_SCORER: { id: 'high_scorer', title: 'High Scorer', description: 'Score 5000+ points in a single game', icon: '💎' },
  PERFECT_GAME: { id: 'perfect_game', title: 'Perfect Game', description: 'Win a game without anyone guessing your word', icon: '👑' },
  LOYAL_PLAYER: { id: 'loyal_player', title: 'Loyal Player', description: 'Play 7 days in a row', icon: '📅' },
};

// Check and unlock achievements based on stats
export async function checkAchievements(userId: string): Promise<string[]> {
  const stats = await getPlayerStats(userId);
  const unlocked: string[] = [];
  
  // First win
  if (stats.gamesWon >= 1) {
    const wasUnlocked = await unlockAchievement(userId, ACHIEVEMENTS.FIRST_WIN.id, ACHIEVEMENTS.FIRST_WIN.title, ACHIEVEMENTS.FIRST_WIN.description, ACHIEVEMENTS.FIRST_WIN.icon);
    if (wasUnlocked) unlocked.push(ACHIEVEMENTS.FIRST_WIN.title);
  }
  
  // Winning streak 3
  if (stats.currentStreak >= 3) {
    const wasUnlocked = await unlockAchievement(userId, ACHIEVEMENTS.WINNING_STREAK_3.id, ACHIEVEMENTS.WINNING_STREAK_3.title, ACHIEVEMENTS.WINNING_STREAK_3.description, ACHIEVEMENTS.WINNING_STREAK_3.icon);
    if (wasUnlocked) unlocked.push(ACHIEVEMENTS.WINNING_STREAK_3.title);
  }
  
  // Winning streak 5
  if (stats.currentStreak >= 5) {
    const wasUnlocked = await unlockAchievement(userId, ACHIEVEMENTS.WINNING_STREAK_5.id, ACHIEVEMENTS.WINNING_STREAK_5.title, ACHIEVEMENTS.WINNING_STREAK_5.description, ACHIEVEMENTS.WINNING_STREAK_5.icon);
    if (wasUnlocked) unlocked.push(ACHIEVEMENTS.WINNING_STREAK_5.title);
  }
  
  // Master Guesser
  if (stats.wordsGuessed >= 100) {
    const wasUnlocked = await unlockAchievement(userId, ACHIEVEMENTS.MASTER_GUESSER.id, ACHIEVEMENTS.MASTER_GUESSER.title, ACHIEVEMENTS.MASTER_GUESSER.description, ACHIEVEMENTS.MASTER_GUESSER.icon);
    if (wasUnlocked) unlocked.push(ACHIEVEMENTS.MASTER_GUESSER.title);
  }
  
  // Master Artist
  if (stats.wordsDrawn >= 50) {
    const wasUnlocked = await unlockAchievement(userId, ACHIEVEMENTS.MASTER_ARTIST.id, ACHIEVEMENTS.MASTER_ARTIST.title, ACHIEVEMENTS.MASTER_ARTIST.description, ACHIEVEMENTS.MASTER_ARTIST.icon);
    if (wasUnlocked) unlocked.push(ACHIEVEMENTS.MASTER_ARTIST.title);
  }
  
  // Social Butterfly
  if (stats.gamesPlayed >= 50) {
    const wasUnlocked = await unlockAchievement(userId, ACHIEVEMENTS.SOCIAL_BUTTERFLY.id, ACHIEVEMENTS.SOCIAL_BUTTERFLY.title, ACHIEVEMENTS.SOCIAL_BUTTERFLY.description, ACHIEVEMENTS.SOCIAL_BUTTERFLY.icon);
    if (wasUnlocked) unlocked.push(ACHIEVEMENTS.SOCIAL_BUTTERFLY.title);
  }
  
  return unlocked;
}
