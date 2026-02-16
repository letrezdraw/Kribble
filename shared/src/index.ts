// Shared types for Kribble

export interface User {
  id: string;
  username: string;
  email?: string;
  avatarId: string;
  level: number;
  xp: number;
  createdAt: Date;
}

export interface Player {
  id: string;
  socketId: string;
  username: string;
  avatarId: string;
  score: number;
  isDrawer: boolean;
  isHost: boolean;
  hasGuessedCorrectly?: boolean;
}


export interface RoomSettings {
  roundTime: number;
  rounds: number;
  categories: string[];
  maxPlayers: number;
  isPrivate: boolean;
  password?: string;
}

export type GamePhase = 'lobby' | 'selection' | 'drawing' | 'roundEnd' | 'gameEnd' | 'freeDraw';


export interface GameState {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  currentDrawerIndex: number;
  currentWord: string;
  wordHints: string[];
  hintsRemaining: number;
  timeRemaining: number;
  isFreeDraw?: boolean;
}


export interface Room {
  id: string;
  name: string;
  players: Player[];
  maxPlayers: number;
  settings: RoomSettings;
  gameState: GameState;
  isPrivate: boolean;
  password?: string;
  createdAt: Date;
}

export interface ChatMessage {
  id: string;
  playerId: string;
  username: string;
  message: string;
  isCorrect?: boolean;
  isSystem?: boolean;
  timestamp: Date;
}

export interface Stroke {
  id: string;
  tool: 'brush' | 'eraser' | 'line' | 'rectangle' | 'circle' | 'text';
  points: { x: number; y: number }[];
  color: string;
  size: number;
  opacity: number;
  timestamp: number;
}

export interface WordCategory {
  id: string;
  name: string;
  words: string[];
}

// Ranking System
export type RankTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'legend' | 'professional' | 'goat';

export interface RankInfo {
  tier: RankTier;
  name: string;
  icon: string;
  color: string;
  minLevel: number;
  maxLevel: number;
}

export interface PlayerStats {
  userId: string;
  gamesPlayed: number;
  gamesWon: number;
  totalScore: number;
  wordsDrawn: number;
  wordsGuessed: number;
  totalPlayTime: number; // in minutes
  currentStreak: number;
  bestStreak: number;
  lastPlayedAt?: Date;
}

export interface MatchHistory {
  id: string;
  userId: string;
  roomName: string;
  players: number;
  score: number;
  placement: number;
  wordsDrawn: number;
  wordsGuessed: number;
  xpGained: number;
  playedAt: Date;
  duration: number; // in minutes
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarId: string;
  level: number;
  xp: number;
  tier: RankTier;
  gamesPlayed: number;
  totalScore: number;
  winRate: number;
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  reward: number; // XP reward
  progress: number;
  target: number;
  completed: boolean;
  expiresAt: Date;
}

export interface OnlinePlayer {
  id: string;
  username: string;
  avatarId: string;
  level: number;
  tier: RankTier;
  status: 'online' | 'in-game' | 'spectating';
  currentRoom?: string;
}


// Socket Events
export interface ServerToClientEvents {
  'room:created': (data: { room: Room; currentPlayerId: string; password?: string }) => void;
  'room:joined': (data: { room: Room; currentPlayerId?: string }) => void;
  'room:player-joined': (data: { player: Player }) => void;
  'room:player-left': (data: { playerId: string }) => void;
  'room:host-changed': (data: { newHostId: string; newHostName: string }) => void;
  'room:players-updated': (data: { players: Player[] }) => void;
  'room:settings-updated': (data: { settings: RoomSettings; maxPlayers: number }) => void;
  'room:error': (data: { message: string }) => void;
  'room:updated': () => void;
  'game:starting': (data: { round: number; totalRounds: number }) => void;
  'game:free-draw': (data: { message: string }) => void;
  'game:word-selected': (data: { word: string; blanks: string; hints: number }) => void;
  'game:drawer-changed': (data: { drawer: Player }) => void;
  'game:timer-update': (data: { timeRemaining: number }) => void;
  'game:guess-correct': (data: { playerId: string; username: string; word: string; points: number }) => void;
  'game:round-end': (data: { word: string; scores: { playerId: string; score: number }[] }) => void;
  'game:end': (data: { finalScores: { playerId: string; username: string; score: number; avatarId: string }[]; rankings: { playerId: string; username: string; score: number; avatarId: string }[]; playAgain?: boolean }) => void;
  'game:hint-update': (data: { hints: string[]; hintsRemaining: number }) => void;
  'game:reset': (data: { room: Room }) => void;
  'draw:stroke': (data: { playerId: string; stroke: Stroke }) => void;
  'draw:clear': (data: { playerId: string }) => void;
  'draw:undo': (data: { playerId: string }) => void;
  'draw:redo': (data: { playerId: string }) => void;
  'chat:message': (data: ChatMessage) => void;
  'chat:system': (data: { message: string }) => void;
  'room:list': (data: { rooms: Room[] }) => void;
}


export interface ClientToServerEvents {
  'room:create': (data: { name: string; settings: Partial<RoomSettings>; username?: string }) => void;
  'room:join': (data: { roomId: string; password?: string; username?: string }) => void;
  'room:leave': () => void;
  'room:start': () => void;
  'room:kick': (data: { playerId: string }) => void;
  'room:update-settings': (data: { roomId: string; settings: Partial<RoomSettings> & { maxPlayers?: number } }) => void;
  'draw:stroke': (data: { stroke: Stroke }) => void;
  'draw:clear': () => void;
  'draw:undo': () => void;
  'draw:redo': () => void;
  'guess:submit': (data: { guess: string }) => void;
  'hint:request': () => void;
  'chat:message': (data: { message: string }) => void;
  'game:play-again': () => void;
}
