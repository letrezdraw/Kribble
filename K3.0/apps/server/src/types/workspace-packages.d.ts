declare module '@kribble/game-engine' {
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

  export class GameStateMachine {
    constructor(roomId: string);
    initialize(context: GameContext): void;
    transitionTo(phase: GamePhase): Promise<void>;
    update(): Promise<void>;
    getPhase(): GamePhase | null;
  }
}

declare module '@kribble/shared-types' {
  export type ServerMessage = Record<string, unknown>;
}
