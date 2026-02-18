import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

export interface Player {
  userId: string;
  username: string;
  avatarId: string;
  score: number;
  isDrawer: boolean;
  isHost: boolean;
  connected: boolean;
  connectionState: 'connected' | 'offline' | 'removed';
}

export interface Room {
  id: string;
  name: string;
  hostId: string;
  phase: 'waiting' | 'starting' | 'wordSelection' | 'drawing' | 'turnEnd' | 'roundEnd' | 'gameEnd';
  players: Player[];
  drawerOrder: string[];
  currentDrawerIndex: number;
  roundNumber: number;
  totalRounds: number;
  turnTimer: number;
  wordSelectionTimer: number;
  currentWord: string | null;
  wordHints: string[];
  hintsRemaining: number;
  wordOptions: string[];
  maxPlayers: number;
  settings: RoomSettings;
}

export interface RoomSettings {
  roundTime: number;
  rounds: number;
  categories: string[];
  isPrivate: boolean;
  password?: string;
  maxPlayers?: number;
  hints?: number;
  wordCount?: number;
  gameMode?: string;
  language?: string;
}

export type GamePhase = 'waiting' | 'starting' | 'wordSelection' | 'drawing' | 'turnEnd' | 'roundEnd' | 'gameEnd';

export interface GameState {
  phase: GamePhase;
  roundNumber: number;
  totalRounds: number;
  currentDrawer: Player | null;
  currentWord: string;
  wordHints: string[];
  hintsRemaining: number;
  turnTimer: number;
  wordSelectionTimer: number;
  scores: { userId: string; score: number }[];
  wordOptions: string[];
}

interface GameContextType {
  room: Room | null;
  gameState: GameState;
  isDrawer: boolean;
  isHost: boolean;
  rankings: { userId: string; username: string; score: number; avatarId: string }[] | null;
  createRoom: (name: string, settings: Partial<RoomSettings>) => void;
  joinRoom: (roomId: string, password?: string, joinByCode?: boolean) => void;
  leaveRoom: () => void;
  startGame: () => void;
  submitGuess: (guess: string) => void;
  requestHint: () => void;
  kickPlayer: (playerId: string) => void;
  playAgain: () => void;
  selectWord: (word: string) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

// CRITICAL: Always sync phase from server room data
// NEVER derive phase from other state
const initialGameState: GameState = {
  phase: 'waiting',
  roundNumber: 1,
  totalRounds: 3,
  currentDrawer: null,
  currentWord: '',
  wordHints: [],
  hintsRemaining: 3,
  turnTimer: 80,
  wordSelectionTimer: 15,
  scores: [],
  wordOptions: [],
};

export function GameProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [isDrawer, setIsDrawer] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rankings, setRankings] = useState<{ userId: string; username: string; score: number; avatarId: string }[] | null>(null);

  const createRoom = useCallback((name: string, settings: Partial<RoomSettings>) => {
    socket?.emit('room:create', { 
      name, 
      settings, 
      username: user?.username, 
      userId: user?.id,
      avatarId: user?.avatarId 
    });
  }, [socket, user]);

  const joinRoom = useCallback((roomId: string, password?: string, joinByCode?: boolean) => {
    socket?.emit('room:join', { 
      roomId, 
      password, 
      username: user?.username, 
      userId: user?.id, 
      avatarId: user?.avatarId,
      joinByCode 
    });
  }, [socket, user]);

  const leaveRoom = useCallback(() => {
    socket?.emit('room:leave');
    // CRITICAL: Reset ALL state when leaving
    setRoom(null);
    setGameState(initialGameState);
    setIsDrawer(false);
    setIsHost(false);
    setCurrentUserId(null);
    setRankings(null);
  }, [socket]);

  const startGame = useCallback(() => {
    socket?.emit('game:start');
  }, [socket]);

  const submitGuess = useCallback((guess: string) => {
    socket?.emit('guess:submit', { guess });
  }, [socket]);

  const requestHint = useCallback(() => {
    socket?.emit('game:request-hint');
  }, [socket]);

  const kickPlayer = useCallback((playerId: string) => {
    socket?.emit('room:kick', { playerId });
  }, [socket]);

  const playAgain = useCallback(() => {
    socket?.emit('game:play-again');
    setRankings(null);
  }, [socket]);

  const selectWord = useCallback((word: string) => {
    socket?.emit('game:select-word', { word });
  }, [socket]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // ==========================================
    // ROOM EVENTS
    // ==========================================

    socket.on('room:created', (data: { room: Room; userId: string; isHost: boolean }) => {
      setRoom(data.room);
      setCurrentUserId(data.userId);
      setIsHost(data.isHost);
      // CRITICAL: Use server-authoritative phase
      setGameState({
        ...initialGameState,
        phase: data.room.phase,
        roundNumber: data.room.roundNumber,
        totalRounds: data.room.totalRounds,
      });
    });

    socket.on('room:joined', (data: { room: Room; userId: string; isHost: boolean; isReconnect: boolean }) => {
      // CRITICAL: Always use server room data as absolute truth
      setRoom(data.room);
      setCurrentUserId(data.userId);
      setIsHost(data.isHost);
      
      const currentPlayer = data.room.players.find(p => p.userId === data.userId);
      setIsDrawer(currentPlayer?.isDrawer || false);
      
      // CRITICAL: Reset ALL state first, then apply server data
      // This prevents stale state from affecting the new room
      setGameState({
        ...initialGameState,
        // ONLY use server-authoritative values
        phase: data.room.phase,
        roundNumber: data.room.roundNumber,
        totalRounds: data.room.totalRounds,
        turnTimer: data.room.turnTimer,
        wordSelectionTimer: data.room.wordSelectionTimer,
        currentWord: data.room.currentWord || '',
        wordHints: data.room.wordHints || [],
        hintsRemaining: data.room.hintsRemaining ?? 3,
        wordOptions: data.room.wordOptions || [],
      });
    });

    socket.on('room:player-joined', (data: { player: Player; isReconnect: boolean }) => {
      setRoom(prev => {
        if (!prev) return null;
        const exists = prev.players.find(p => p.userId === data.player.userId);
        if (exists) {
          return {
            ...prev,
            players: prev.players.map(p => 
              p.userId === data.player.userId ? data.player : p
            )
          };
        }
        return {
          ...prev,
          players: [...prev.players, data.player]
        };
      });
    });

    socket.on('room:player-left', (data: { userId: string; newHostId?: string; room?: Room }) => {
      // If server sent full room state, use it (authoritative)
      if (data.room) {
        setRoom(data.room);
        if (data.newHostId === currentUserId) {
          setIsHost(true);
        }
        return;
      }
      
      // Fallback: manual update if no room data
      setRoom(prev => {
        if (!prev) return null;
        const newRoom = {
          ...prev,
          players: prev.players.filter(p => p.userId !== data.userId),
        };
        if (data.newHostId) {
          newRoom.hostId = data.newHostId;
          newRoom.players = newRoom.players.map(p => ({
            ...p,
            isHost: p.userId === data.newHostId
          }));
          if (data.newHostId === currentUserId) {
            setIsHost(true);
          }
        }
        return newRoom;
      });
    });


    socket.on('room:player-disconnected', (data: { userId: string; username: string; connectionState: string }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map(p => 
            p.userId === data.userId 
              ? { ...p, connected: false, connectionState: data.connectionState as any }
              : p
          )
        };
      });
    });

    socket.on('room:settings-updated', (data: { settings: RoomSettings }) => {
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          settings: data.settings,
        };
      });
    });

    // ==========================================
    // GAME EVENTS - ALL PHASE CHANGES FROM SERVER
    // ==========================================

    socket.on('game:started', (data: { room: Room }) => {
      // CRITICAL: Use full room snapshot from server
      setRoom(data.room);
      setGameState(prev => ({
        ...prev,
        phase: data.room.phase, // Server-authoritative
        roundNumber: data.room.roundNumber,
        totalRounds: data.room.totalRounds,
        wordOptions: data.room.wordOptions,
        wordSelectionTimer: data.room.wordSelectionTimer,
      }));
      const currentPlayer = data.room.players.find(p => p.userId === currentUserId);
      setIsDrawer(currentPlayer?.isDrawer || false);
    });

    socket.on('game:word-selection', (data: { wordOptions: string[]; selectionTime: number }) => {
      setGameState(prev => ({
        ...prev,
        phase: 'wordSelection', // Server explicitly changed phase
        wordOptions: data.wordOptions,
        wordSelectionTimer: data.selectionTime,
      }));
    });

    socket.on('game:drawing-started', (data: { room: Room; wordLength: number }) => {
      // CRITICAL: Use full room snapshot
      setRoom(data.room);
      setGameState(prev => ({
        ...prev,
        phase: 'drawing', // Server-authoritative
        currentWord: data.room.currentWord || '',
        wordHints: data.room.wordHints,
        hintsRemaining: data.room.hintsRemaining,
        turnTimer: data.room.turnTimer,
      }));
      const currentPlayer = data.room.players.find(p => p.userId === currentUserId);
      setIsDrawer(currentPlayer?.isDrawer || false);
    });

    socket.on('game:word-reveal', (data: { word: string }) => {
      // Only drawer receives this
      setGameState(prev => ({
        ...prev,
        currentWord: data.word,
      }));
    });

    socket.on('game:timer-update', (data: { timeRemaining: number }) => {
      setGameState(prev => ({
        ...prev,
        turnTimer: data.timeRemaining,
      }));
    });

    socket.on('game:selection-timer', (data: { timeRemaining: number }) => {
      setGameState(prev => ({
        ...prev,
        wordSelectionTimer: data.timeRemaining,
      }));
    });

    socket.on('game:hint-revealed', (data: { hints: string[]; hintsRemaining: number }) => {
      setGameState(prev => ({
        ...prev,
        wordHints: data.hints,
        hintsRemaining: data.hintsRemaining,
      }));
    });

    socket.on('game:player-guessed', (data: { 
      userId: string; 
      username: string; 
      points: number;
      scores: { userId: string; score: number }[];
    }) => {
      setGameState(prev => ({
        ...prev,
        scores: data.scores,
      }));
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map(p => {
            const scoreData = data.scores.find(s => s.userId === p.userId);
            return scoreData ? { ...p, score: scoreData.score } : p;
          })
        };
      });
    });

    socket.on('guess:correct', (data: { points: number; totalScore: number }) => {
      // Personal confirmation only
    });

    socket.on('game:round-end', (data: { word: string; scores: { userId: string; score: number }[] }) => {
      setGameState(prev => ({
        ...prev,
        phase: 'roundEnd', // Server-authoritative
        currentWord: data.word,
        scores: data.scores,
      }));
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map(p => {
            const scoreData = data.scores.find(s => s.userId === p.userId);
            return scoreData ? { ...p, score: scoreData.score } : p;
          })
        };
      });
      setIsDrawer(false);
    });

    socket.on('game:end', (data: { finalScores: { userId: string; username: string; score: number; avatarId: string }[]; rankings: any[] }) => {
      setGameState(prev => ({
        ...prev,
        phase: 'gameEnd', // Server-authoritative
        scores: data.finalScores.map(s => ({ userId: s.userId, score: s.score })),
      }));
      setRankings(data.rankings);
    });

    socket.on('game:reset', (data: { room: Room }) => {
      // CRITICAL: Full reset to waiting state
      setRoom(data.room);
      setGameState({
        ...initialGameState,
        phase: data.room.phase, // Should be 'waiting'
      });
      setIsDrawer(false);
      setRankings(null);
      setIsHost(data.room.hostId === currentUserId);
    });

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:player-joined');
      socket.off('room:player-left');
      socket.off('room:player-disconnected');
      socket.off('room:settings-updated');
      socket.off('game:started');
      socket.off('game:word-selection');
      socket.off('game:drawing-started');
      socket.off('game:word-reveal');
      socket.off('game:timer-update');
      socket.off('game:selection-timer');
      socket.off('game:hint-revealed');
      socket.off('game:player-guessed');
      socket.off('guess:correct');
      socket.off('game:round-end');
      socket.off('game:end');
      socket.off('game:reset');
    };
  }, [socket, currentUserId]);

  return (
    <GameContext.Provider value={{
      room,
      gameState,
      isDrawer,
      isHost,
      rankings,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      submitGuess,
      requestHint,
      kickPlayer,
      playAgain,
      selectWord,
    }}>
      {children}
    </GameContext.Provider>
  );
}

function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

export { useGame };
