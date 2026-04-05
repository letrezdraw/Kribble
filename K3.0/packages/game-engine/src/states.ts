import type { GameState, GameContext } from './types.js';

// Base state class
abstract class BaseState implements GameState {
  abstract readonly phase: GameState['phase'];

  async enter(_context: GameContext): Promise<void> {
    // Override in subclass
  }

  async update(_context: GameContext): Promise<void> {
    // Override in subclass
  }

  async exit(_context: GameContext): Promise<void> {
    // Override in subclass
  }
}

// Lobby State
export class LobbyState extends BaseState {
  readonly phase = 'lobby' as const;

  async enter(context: GameContext): Promise<void> {
    context.broadcast({
      type: 'game:phase',
      phase: 'lobby',
      room: context.room,
    });
  }

  async update(context: GameContext): Promise<void> {
    // Check if enough players and all ready
    const readyPlayers = context.room.players.filter(p => p.isReady);
    if (readyPlayers.length >= 2 && readyPlayers.length === context.room.players.length) {
      // All players ready, start game
      context.updateRoom({
        ...context.room,
        currentRound: 1,
        phase: 'starting',
      });
    }
  }
}

// Starting State
export class StartingState extends BaseState {
  readonly phase = 'starting' as const;

  async enter(context: GameContext): Promise<void> {
    context.broadcast({
      type: 'game:phase',
      phase: 'starting',
      round: context.room.currentRound,
    });
    
    // Transition to word selection after countdown
    setTimeout(() => {
      context.updateRoom({
        ...context.room,
        phase: 'wordSelection',
      });
    }, 3000);
  }
}

// Word Selection State
export class WordSelectionState extends BaseState {
  readonly phase = 'wordSelection' as const;

  async enter(context: GameContext): Promise<void> {
    // Select random drawer
    const drawerIndex = Math.floor(Math.random() * context.room.players.length);
    const drawer = context.room.players[drawerIndex];
    
    // TODO: Select word options from word list
    const wordOptions = ['apple', 'banana', 'car', 'dog', 'elephant'];
    
    context.updateRoom({
      ...context.room,
      currentDrawerId: drawer.id,
      wordOptions,
      phase: 'wordSelection',
    });

    context.broadcast({
      type: 'game:wordSelection',
      drawerId: drawer.id,
      options: wordOptions,
    });
  }

  async update(context: GameContext): Promise<void> {
    // Wait for drawer to select word
    // Transition happens when word is selected
  }
}

// Drawing State
export class DrawingState extends BaseState {
  readonly phase = 'drawing' as const;

  async enter(context: GameContext): Promise<void> {
    const drawer = context.room.players.find(p => p.id === context.room.currentDrawerId);
    
    context.updateRoom({
      ...context.room,
      phase: 'drawing',
      roundStartTime: Date.now(),
    });

    context.broadcast({
      type: 'game:drawing',
      drawerId: context.room.currentDrawerId,
      wordLength: context.room.currentWord?.length ?? 0,
    });

    // Send word only to drawer
    if (drawer) {
      context.broadcastToRoom(context.room.id, {
        type: 'game:yourWord',
        word: context.room.currentWord,
      });
    }

    // Start timer
    const timer = setTimeout(() => {
      context.updateRoom({
        ...context.room,
        phase: 'roundEnd',
      });
    }, context.room.roundTime * 1000);

    // Store timer reference for cleanup
    (context as unknown as { timer?: NodeJS.Timeout }).timer = timer;
  }

  async update(context: GameContext): Promise<void> {
    // Check if all non-drawers have guessed correctly
    const nonDrawers = context.room.players.filter(p => p.id !== context.room.currentDrawerId);
    const allGuessed = nonDrawers.every(p => p.hasGuessedCorrectly);
    
    if (allGuessed) {
      context.updateRoom({
        ...context.room,
        phase: 'roundEnd',
      });
    }
  }

  async exit(context: GameContext): Promise<void> {
    // Clear timer if exists
    const timer = (context as unknown as { timer?: NodeJS.Timeout }).timer;
    if (timer) {
      clearTimeout(timer);
    }
  }
}

// Guessing State (for client-side reference)
export class GuessingState extends BaseState {
  readonly phase = 'guessing' as const;

  async enter(context: GameContext): Promise<void> {
    context.broadcast({
      type: 'game:phase',
      phase: 'guessing',
    });
  }
}

// Round End State
export class RoundEndState extends BaseState {
  readonly phase = 'roundEnd' as const;

  async enter(context: GameContext): Promise<void> {
    // Calculate scores based on guess time
    this.calculateScores(context);

    context.broadcast({
      type: 'game:roundEnd',
      scores: context.room.players.map(p => ({
        playerId: p.id,
        score: p.score,
      })),
    });

    // Check if game should end
    if (context.room.currentRound >= context.room.maxRounds) {
      setTimeout(() => {
        context.updateRoom({
          ...context.room,
          phase: 'gameEnd',
        });
      }, 5000);
    } else {
      // Next round
      setTimeout(() => {
        context.updateRoom({
          ...context.room,
          currentRound: context.room.currentRound + 1,
          phase: 'starting',
          currentWord: undefined,
          wordOptions: undefined,
        });
      }, 5000);
    }
  }

  private calculateScores(context: GameContext): void {
    const roundTime = context.room.roundTime;
    const guessTime = Date.now() - (context.room.roundStartTime ?? Date.now());
    const timeBonus = Math.max(0, 1 - (guessTime / (roundTime * 1000)));
    
    const baseScore = 100;
    
    for (const player of context.room.players) {
      if (player.id === context.room.currentDrawerId) {
        // Drawer gets points based on how many guessed correctly
        const correctGuessers = context.room.players.filter(p => p.hasGuessedCorrectly).length;
        player.score += correctGuessers * 50;
      } else if (player.hasGuessedCorrectly) {
        // Guesser gets points based on speed
        player.score += Math.round(baseScore * (1 + timeBonus));
      }
    }
  }
}

// Game End State
export class GameEndState extends BaseState {
  readonly phase = 'gameEnd' as const;

  async enter(context: GameContext): Promise<void> {
    // Sort players by score
    const winner = [...context.room.players].sort((a, b) => b.score - a.score)[0];
    
    context.broadcast({
      type: 'game:end',
      winner: {
        playerId: winner?.id,
        displayName: winner?.displayName,
        score: winner?.score,
      },
      finalScores: context.room.players.map(p => ({
        playerId: p.id,
        displayName: p.displayName,
        score: p.score,
      })),
    });
  }
}

export { GameState };
