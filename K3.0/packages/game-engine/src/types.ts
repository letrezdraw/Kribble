export type GamePhase = 
  | 'lobby'
  | 'starting'
  | 'wordSelection'
  | 'drawing'
  | 'guessing'
  | 'roundEnd'
  | 'gameEnd';

export interface Player {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  score: number;
  isReady: boolean;
  hasGuessedCorrectly: boolean;
}

export interface GameRoom {
  id: string;
  code: string;
  name: string;
  hostId: string;
  players: Player[];
  maxPlayers: number;
  roundTime: number;
  currentRound: number;
  maxRounds: number;
  phase: GamePhase;
  currentDrawerId?: string;
  currentWord?: string;
  wordOptions?: string[];
  roundStartTime?: number;
}

export interface GameContext {
  room: GameRoom;
  updateRoom: (room: GameRoom) => void;
  broadcast: (message: unknown) => void;
  broadcastToRoom: (roomId: string, message: unknown) => void;
}

export interface GameState {
  readonly phase: GamePhase;
  enter(context: GameContext): Promise<void>;
  update(context: GameContext): Promise<void>;
  exit(context: GameContext): Promise<void>;
}

export interface LobbyState extends GameState {
  phase: 'lobby';
}

export interface StartingState extends GameState {
  phase: 'starting';
}

export interface WordSelectionState extends GameState {
  phase: 'wordSelection';
}

export interface DrawingState extends GameState {
  phase: 'drawing';
}

export interface GuessingState extends GameState {
  phase: 'guessing';
}

export interface RoundEndState extends GameState {
  phase: 'roundEnd';
}

export interface GameEndState extends GameState {
  phase: 'gameEnd';
}
