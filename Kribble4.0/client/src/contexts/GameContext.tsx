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
  rounds?: number;
  totalRounds?: number;
  wordSelectionTime?: number;
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
  turnAwards: { userId: string; username: string; points: number }[];
}

interface GameContextType {
  room: Room | null;
  gameState: GameState;
  isDrawer: boolean;
  isHost: boolean;
  rankings: { userId: string; username: string; score: number; avatarId: string }[] | null;
  offlinePlayers: string[]; // List of userIds that are offline
  reconnecting: boolean;
  createRoom: (name: string, settings: Partial<RoomSettings>) => void;
  joinRoom: (roomId: string, password?: string, joinByCode?: boolean) => void;
  leaveRoom: () => void;
  startGame: () => void;
  submitGuess: (guess: string) => void;
  requestHint: () => void;
  kickPlayer: (playerId: string) => void;
  playAgain: () => void;
  selectWord: (word: string) => void;
  roomError: string | null;
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
  turnAwards: [],
};

export function GameProvider({ children }: { children: ReactNode }) {
  const { socket, reconnecting: socketReconnecting } = useSocket();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);
  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [isDrawer, setIsDrawer] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [rankings, setRankings] = useState<{ userId: string; username: string; score: number; avatarId: string }[] | null>(null);
  const [offlinePlayers, setOfflinePlayers] = useState<string[]>([]);
  const [reconnecting, setReconnecting] = useState(false);
  const [roomError, setRoomError] = useState<string | null>(null);

  const mergePlayersIntoRoom = useCallback((players: Array<Partial<Player> & { id?: string; userId?: string }>) => {
    setRoom(prev => {
      if (!prev) return null;

      const mergedPlayers = prev.players.map(existing => {
        const incoming = players.find(p => (p.userId || p.id) === existing.userId);
        if (!incoming) return existing;

        return {
          ...existing,
          userId: incoming.userId || incoming.id || existing.userId,
          username: incoming.username ?? existing.username,
          avatarId: incoming.avatarId ?? existing.avatarId,
          score: incoming.score ?? existing.score,
          isDrawer: incoming.isDrawer ?? existing.isDrawer,
          isHost: incoming.isHost ?? existing.isHost,
          connected: incoming.connected ?? existing.connected,
          connectionState: incoming.connectionState ?? existing.connectionState,
        };
      });

      const currentPlayer = mergedPlayers.find(p => p.userId === (currentUserId ?? user?.id ?? null)) || null;
      setIsDrawer(currentPlayer?.isDrawer || false);
      setIsHost(currentPlayer?.isHost || prev.hostId === (currentUserId ?? user?.id ?? null));
      setGameState(gamePrev => ({
        ...gamePrev,
        currentDrawer: mergedPlayers.find(p => p.isDrawer) || null,
        scores: mergedPlayers.map(p => ({ userId: p.userId, score: p.score })),
      }));

      return {
        ...prev,
        hostId: mergedPlayers.find(p => p.isHost)?.userId || prev.hostId,
        players: mergedPlayers,
      };
    });
  }, [currentUserId, user?.id]);

  const applyRoomSnapshot = useCallback((nextRoom: Room, explicitUserId?: string | null) => {
    const activeUserId = explicitUserId ?? currentUserId ?? user?.id ?? null;
    setRoom(nextRoom);

    const currentPlayer = nextRoom.players.find(p => p.userId === activeUserId) || null;
    setIsDrawer(currentPlayer?.isDrawer || false);
    setIsHost(nextRoom.hostId === activeUserId);

    const offline = nextRoom.players
      .filter(p => !p.connected && p.connectionState === 'offline')
      .map(p => p.userId);
    setOfflinePlayers(offline);

    setGameState(prev => ({
      ...prev,
      phase: nextRoom.phase,
      roundNumber: nextRoom.roundNumber,
      totalRounds: nextRoom.totalRounds,
      currentDrawer: nextRoom.players.find(p => p.isDrawer) || null,
      currentWord: currentPlayer?.isDrawer ? prev.currentWord : (nextRoom.currentWord || prev.currentWord || ''),
      wordHints: nextRoom.wordHints || [],
      hintsRemaining: nextRoom.hintsRemaining ?? prev.hintsRemaining,
      turnTimer: nextRoom.turnTimer,
      wordSelectionTimer: nextRoom.wordSelectionTimer,
      wordOptions: currentPlayer?.isDrawer ? prev.wordOptions : [],
      scores: nextRoom.players.map(p => ({ userId: p.userId, score: p.score })),
    }));
  }, [currentUserId, user?.id]);

  const createRoom = useCallback((name: string, settings: Partial<RoomSettings>) => {
    setRoomError(null);
    socket?.emit('room:create', { 
      name, 
      settings, 
      username: user?.username, 
      userId: user?.id,
      avatarId: user?.avatarId 
    });
  }, [socket, user]);

  const joinRoom = useCallback((roomId: string, password?: string, joinByCode?: boolean) => {
    setRoomError(null);
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
    setOfflinePlayers([]);
    setReconnecting(false);
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

  // Track socket reconnection state
  useEffect(() => {
    setReconnecting(socketReconnecting);
  }, [socketReconnecting]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // ==========================================
    // ROOM EVENTS
    // ==========================================

    socket.on('room:created', (data: { room: Room; userId: string; isHost: boolean }) => {
      setRoomError(null);
      setCurrentUserId(data.userId);
      applyRoomSnapshot(data.room, data.userId);
    });

    socket.on('room:joined', (data: { room: Room; userId: string; isHost: boolean; isReconnect: boolean }) => {
      setRoomError(null);
      setCurrentUserId(data.userId);
      applyRoomSnapshot(data.room, data.userId);
    });

    socket.on('room:error', (data: { message: string }) => {
      setRoomError(data.message);
      setRoom(null);
      setGameState(initialGameState);
      setIsDrawer(false);
      setIsHost(false);
    });

    socket.on('room:player-joined', (data: { player: Player; isReconnect: boolean; room?: Room }) => {
      if (data.room) {
        applyRoomSnapshot(data.room);
        return;
      }

      setRoom(prev => {
        if (!prev) return null;
        const exists = prev.players.find(p => p.userId === data.player.userId);
        if (exists) {
          // Player reconnected - remove from offline list
          setOfflinePlayers(prev => prev.filter(id => id !== data.player.userId));
          return {
            ...prev,
            players: prev.players.map(p => 
              p.userId === data.player.userId ? { ...data.player, connected: true, connectionState: 'connected' as const } : p
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
      // Remove from offline list if present
      setOfflinePlayers(prev => prev.filter(id => id !== data.userId));
      
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
      
      // Add to offline players list
      if (data.connectionState === 'offline') {
        setOfflinePlayers(prev => [...prev.filter(id => id !== data.userId), data.userId]);
      }
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

    socket.on('room:state', (data: { room: Room }) => {
      applyRoomSnapshot(data.room);
    });

    socket.on('room:players-updated', (data: { players: Array<Partial<Player> & { id?: string; userId?: string }> }) => {
      mergePlayersIntoRoom(data.players);
    });

    // ==========================================
    // GAME EVENTS - ALL PHASE CHANGES FROM SERVER
    // ==========================================

    socket.on('game:started', (data: { room: Room }) => {
      applyRoomSnapshot(data.room);
    });

    socket.on('game:word-selection', (data: { wordOptions: string[]; selectionTime: number }) => {
      setGameState(prev => ({
        ...prev,
        phase: 'wordSelection',
        currentWord: '',
        wordHints: [],
        wordOptions: data.wordOptions,
        wordSelectionTimer: data.selectionTime,
      }));
      setRoom(prev => prev ? { ...prev, phase: 'wordSelection', wordSelectionTimer: data.selectionTime } : prev);
    });

    socket.on('PHASE_CHANGE', (data: {
      phase: GamePhase;
      round?: number;
      turn?: number;
      totalRounds?: number;
      drawerId?: string;
      word?: string;
      wordLength?: number;
    }) => {
      setRoom(prev => {
        if (!prev) return null;

        const nextPlayers = prev.players.map(player => ({
          ...player,
          isDrawer: data.drawerId ? player.userId === data.drawerId : player.isDrawer,
        }));

        const currentPlayer = nextPlayers.find(p => p.userId === (currentUserId ?? user?.id ?? null)) || null;
        setIsDrawer(currentPlayer?.isDrawer || false);
        setIsHost(currentPlayer?.isHost || prev.hostId === (currentUserId ?? user?.id ?? null));

        setGameState(gamePrev => ({
          ...gamePrev,
          phase: data.phase,
          roundNumber: data.round ?? gamePrev.roundNumber,
          totalRounds: data.totalRounds ?? gamePrev.totalRounds,
          currentDrawer: nextPlayers.find(p => p.isDrawer) || null,
          currentWord: data.phase === 'wordSelection' ? '' : (data.word ?? gamePrev.currentWord),
          wordHints: data.phase === 'drawing' && data.wordLength
            ? new Array(data.wordLength).fill('_')
            : (data.phase === 'wordSelection' ? [] : gamePrev.wordHints),
          turnAwards: data.phase === 'turnEnd' ? gamePrev.turnAwards : [],
        }));

        return {
          ...prev,
          phase: data.phase,
          roundNumber: data.round ?? prev.roundNumber,
          totalRounds: data.totalRounds ?? prev.totalRounds,
          currentDrawerIndex: data.drawerId
            ? Math.max(0, nextPlayers.findIndex(p => p.userId === data.drawerId))
            : prev.currentDrawerIndex,
          currentWord: data.word ?? (data.phase === 'wordSelection' ? null : prev.currentWord),
          players: nextPlayers,
        };
      });
    });

    socket.on('game:drawing-started', (data: { room: Room; wordLength: number }) => {
      applyRoomSnapshot(data.room);
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

    socket.on('game:turn-end', (data: {
      word: string;
      awards: { userId: string; username: string; points: number }[];
      scores: { userId: string; score: number }[];
    }) => {
      setGameState(prev => ({
        ...prev,
        phase: 'turnEnd',
        currentWord: data.word,
        turnAwards: data.awards,
        scores: data.scores,
      }));
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          phase: 'turnEnd',
          players: prev.players.map(p => {
            const scoreData = data.scores.find(s => s.userId === p.userId);
            return scoreData ? { ...p, score: scoreData.score } : p;
          })
        };
      });
      setIsDrawer(false);
    });

    socket.on('game:round-end', (data: { word: string; scores: { userId: string; score: number }[] }) => {
      setGameState(prev => ({
        ...prev,
        phase: 'roundEnd',
        currentWord: data.word,
        scores: data.scores,
      }));
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          phase: 'roundEnd',
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
        phase: 'gameEnd',
        scores: data.finalScores.map(s => ({ userId: s.userId, score: s.score })),
      }));
      setRoom(prev => prev ? { ...prev, phase: 'gameEnd' } : prev);
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
      setOfflinePlayers([]);
    });

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:error');
      socket.off('room:player-joined');
      socket.off('room:player-left');
      socket.off('room:player-disconnected');
      socket.off('room:settings-updated');
      socket.off('room:state');
      socket.off('room:players-updated');
      socket.off('game:started');
      socket.off('game:word-selection');
      socket.off('game:drawing-started');
      socket.off('PHASE_CHANGE');
      socket.off('game:word-reveal');
      socket.off('game:timer-update');
      socket.off('game:selection-timer');
      socket.off('game:hint-revealed');
      socket.off('game:player-guessed');
      socket.off('guess:correct');
      socket.off('game:turn-end');
      socket.off('game:round-end');
      socket.off('game:end');
      socket.off('game:reset');
    };
  }, [socket, currentUserId, applyRoomSnapshot]);

  return (
    <GameContext.Provider value={{
      room,
      gameState,
      isDrawer,
      isHost,
      rankings,
      offlinePlayers,
      reconnecting,
      createRoom,
      joinRoom,
      leaveRoom,
      startGame,
      submitGuess,
      requestHint,
      kickPlayer,
      playAgain,
      selectWord,
      roomError,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}
