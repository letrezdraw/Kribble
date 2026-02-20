// Local types to replace shared module imports

export interface PlayerStats {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  wordsDrawn: number;
  wordsGuessed: number;
  totalPlayTime: number;
  currentStreak: number;
  bestStreak: number;
  lastPlayedAt: string | null;
}

export interface MatchHistory {
  id: string;
  roomName: string;
  placement: number;
  players: number;
  xpGained: number;
  playedAt: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  avatarId: string;
  level: number;
  xp: number;
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished';
  settings: GameSettings;
  createdAt: string;
}

export interface Player {
  id: string;
  username: string;
  avatarId: string;
  isHost: boolean;
  isReady: boolean;
  score: number;
}

export interface GameSettings {
  maxPlayers: number;
  drawTime: number;
  rounds: number;
  wordCategories: string[];
  isPrivate: boolean;
  password?: string;
}

export interface WordCategory {
  id: string;
  name: string;
  words: string[];
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  completed: boolean;
  reward: number;
  expiresAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  username: string;
  avatarId: string;
  level: number;
  xp: number;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  winRate: number;
  rank: number;
}
