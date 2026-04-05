import type { GameState, GameContext, GamePhase } from './types.js';
import {
  LobbyState,
  StartingState,
  WordSelectionState,
  DrawingState,
  GuessingState,
  RoundEndState,
  GameEndState,
} from './states.js';

export class GameStateMachine {
  private currentState: GameState | null = null;
  private context: GameContext | null = null;

  constructor(private roomId: string) {}

  initialize(context: GameContext): void {
    this.context = context;
    this.transitionTo('lobby');
  }

  async transitionTo(phase: GamePhase): Promise<void> {
    if (!this.context) {
      throw new Error('State machine not initialized');
    }

    // Exit current state
    if (this.currentState) {
      await this.currentState.exit(this.context);
    }

    // Create new state
    this.currentState = this.createState(phase);
    
    // Enter new state
    await this.currentState.enter(this.context);
  }

  private createState(phase: GamePhase): GameState {
    switch (phase) {
      case 'lobby':
        return new LobbyState();
      case 'starting':
        return new StartingState();
      case 'wordSelection':
        return new WordSelectionState();
      case 'drawing':
        return new DrawingState();
      case 'guessing':
        return new GuessingState();
      case 'roundEnd':
        return new RoundEndState();
      case 'gameEnd':
        return new GameEndState();
      default:
        throw new Error(`Unknown phase: ${phase}`);
    }
  }

  async update(): Promise<void> {
    if (!this.context || !this.currentState) {
      throw new Error('State machine not initialized');
    }

    await this.currentState.update(this.context);
  }

  getPhase(): GamePhase | null {
    return this.currentState?.phase ?? null;
  }
}
