/**
 * Kribble V2 - Production-Level Multiplayer Architecture
 * Core Type Definitions
 */

// Room lifecycle phases
export type RoomPhase =
  | "waiting"      // Lobby, waiting for players
  | "starting"     // Game is starting
  | "wordSelection" // Drawer selecting word
  | "drawing"      // Active drawing phase
  | "turnEnd"      // Turn ended, showing results
  | "roundEnd"     // Round ended, showing scoreboard
  | "gameEnd";     // Game over, final rankings

// Player connection states
export type PlayerConnectionState =
  | "connected"    // Online and active
  | "offline"      // Disconnected, grace period
  | "removed";     // Removed from room

// Stroke point for drawing
export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number; // For pen tablet support
}

// Complete stroke data
export interface Stroke {
  id: string;
  userId: string;    // Who drew this stroke
  color: string;
  size: number;
  tool: string;      // brush, eraser, etc.
  points: StrokePoint[];
  timestamp: number;
}

// ==========================================
// CANVAS COMMAND PROTOCOL TYPES
// ==========================================

export type CanvasCommandType = 
  | 'START_STROKE'
  | 'ADD_POINTS'
  | 'END_STROKE'
  | 'CLEAR_CANVAS'
  | 'UNDO'
  | 'REDO'
  | 'TOOL_UPDATE'
  | 'FILL';

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface CanvasCommand {
  id: string;            // unique command id (UUID)
  roomId: string;
  userId: string;
  type: CanvasCommandType;
  timestamp: number;
  payload: CanvasCommandPayload;
}

export type CanvasCommandPayload =
  | StartStrokePayload
  | AddPointsPayload
  | EndStrokePayload
  | ClearCanvasPayload
  | UndoPayload
  | RedoPayload
  | ToolUpdatePayload
  | FillPayload;

export interface StartStrokePayload {
  strokeId: string;
  tool: string;
  color: string;
  size: number;
  opacity: number;
  startPoint: Point;
}

export interface AddPointsPayload {
  strokeId: string;
  points: Point[];
}

export interface EndStrokePayload {
  strokeId: string;
}

export interface ClearCanvasPayload {
  // No additional data needed
}

export interface UndoPayload {
  // No additional data needed - server tracks history
}

export interface RedoPayload {
  // No additional data needed - server tracks history
}

export interface ToolUpdatePayload {
  tool: string;
  color?: string;
  size?: number;
  opacity?: number;
}

export interface FillPayload {
  x: number;
  y: number;
  color: string;
  tolerance?: number;
}

// Player data - identity based (NOT socket-based)

export interface Player {
  userId: string;           // Permanent identity
  username: string;
  avatarId: string;
  socketId: string | null;  // Current socket (null if offline)
  connected: boolean;
  connectionState: PlayerConnectionState;
  score: number;
  isHost: boolean;
  isDrawer: boolean;
  guessedThisTurn: boolean;
  disconnectAt: number | null; // Timestamp when disconnected
  joinAt: number;              // Timestamp when joined
}

// Room settings
export interface RoomSettings {
  maxPlayers: number;
  roundTime: number;        // Seconds for drawing
  wordSelectionTime: number; // Seconds to select word
  totalRounds: number;
  hints: number;
  wordCount: number;        // Number of word options to show
  categories: string[];
  isPrivate: boolean;
  password?: string;
  language: string;
  gameMode: string;
}


// Core room data structure
export interface Room {
  id: string;
  name: string;             // Room display name
  phase: RoomPhase;
  hostId: string;           // userId of host

  
  // Players stored by userId (Map for O(1) access)
  players: Map<string, Player>;
  
  // Turn management
  drawerOrder: string[];    // Ordered userIds for drawing
  currentDrawerIndex: number;
  
  // Round management
  roundNumber: number;
  totalRounds: number;
  
  // Timers
  turnTimer: number;        // Current turn time remaining
  wordSelectionTimer: number; // Current word selection time
  turnTimerInterval: NodeJS.Timeout | null;
  wordSelectionInterval: NodeJS.Timeout | null;
  
  // Game state
  currentWord: string | null;
  wordOptions: string[];   // Words for drawer to choose from
  wordHints: string[];     // Revealed hints
  hintsRemaining: number;
  turnAwards: TurnAward[];
  
  // Canvas - Legacy stroke storage (deprecated, use commandHistory)
  canvasHistory: Stroke[]; // All strokes for replay
  canvasRedoHistory: Stroke[]; // Redo stack for stroke-based sync
  
  // Canvas Command Protocol - New unified system
  commandHistory: CanvasCommand[]; // All commands for deterministic replay
  
  // Settings
  settings: RoomSettings;
  
  // Metadata
  createdAt: number;
  updatedAt: number;
}


// Server-side storage
export interface ServerState {
  rooms: Map<string, Room>;
  socketToUser: Map<string, string>; // socketId -> userId
  userToRoom: Map<string, string>;   // userId -> roomId
}

// Game events for client
export interface GameEvent {
  type: string;
  payload: unknown;
  timestamp: number;
}

// Score entry
export interface ScoreEntry {
  userId: string;
  username: string;
  score: number;
  avatarId: string;
  rank: number;
}

// Turn result
export interface TurnResult {
  word: string;
  scores: ScoreEntry[];
  correctGuessers: string[]; // userIds who guessed correctly
}

export interface TurnAward {
  userId: string;
  username: string;
  points: number;
}

// Round result
export interface RoundResult {
  roundNumber: number;
  word: string;
  scores: ScoreEntry[];
  turnResults: TurnResult[];
}

// Game result
export interface GameResult {
  rankings: ScoreEntry[];
  totalRounds: number;
  duration: number; // seconds
}
