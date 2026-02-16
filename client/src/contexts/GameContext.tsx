import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';


export interface Player {
  id: string;
  username: string;
  avatarId: string;
  score: number;
  isDrawer: boolean;
  isHost: boolean;
}

export interface Room {
  id: string;
  name: string;
  players: Player[];
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





export type GamePhase = 'lobby' | 'selection' | 'drawing' | 'roundEnd' | 'gameEnd' | 'freeDraw';

export interface GameState {
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  currentDrawer: Player | null;
  currentWord: string;
  wordHints: string[];
  hintsRemaining: number;
  timeRemaining: number;
  scores: { playerId: string; score: number }[];
  isFreeDraw: boolean;
  wordOptions: string[];
  selectionTimeRemaining: number;
}


interface GameContextType {
  room: Room | null;
  gameState: GameState;
  isDrawer: boolean;
  isHost: boolean;
  rankings: { playerId: string; username: string; score: number; avatarId: string }[] | null;
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

const initialGameState: GameState = {
  phase: 'lobby',
  currentRound: 0,
  totalRounds: 6,
  currentDrawer: null,
  currentWord: '',
  wordHints: [],
  hintsRemaining: 3,
  timeRemaining: 0,
  scores: [],
  isFreeDraw: false,
  wordOptions: [],
  selectionTimeRemaining: 0,
};


export function GameProvider({ children }: { children: ReactNode }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const [room, setRoom] = useState<Room | null>(null);

  const [gameState, setGameState] = useState<GameState>(initialGameState);
  const [isDrawer, setIsDrawer] = useState(false);
  const [isHost, setIsHost] = useState(false);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [rankings, setRankings] = useState<{ playerId: string; username: string; score: number; avatarId: string }[] | null>(null);

  const createRoom = useCallback((name: string, settings: Partial<RoomSettings>) => {
    socket?.emit('room:create', { name, settings, username: user?.username, userId: user?.id });
  }, [socket, user]);


  const joinRoom = useCallback((roomId: string, password?: string, joinByCode?: boolean) => {
    socket?.emit('room:join', { roomId, password, username: user?.username, userId: user?.id, joinByCode });
  }, [socket, user]);




  const leaveRoom = useCallback(() => {
    socket?.emit('room:leave');
    setRoom(null);
    setGameState(initialGameState);
    setIsDrawer(false);
    setIsHost(false);
    setCurrentPlayerId(null);
    setRankings(null);
  }, [socket]);

  const startGame = useCallback(() => {
    console.log('Start Game clicked, emitting room:start');
    socket?.emit('room:start');
  }, [socket]);

  const submitGuess = useCallback((guess: string) => {
    socket?.emit('guess:submit', { guess });
  }, [socket]);

  const requestHint = useCallback(() => {
    socket?.emit('hint:request');
  }, [socket]);

  const kickPlayer = useCallback((playerId: string) => {
    socket?.emit('room:kick', { playerId });
  }, [socket]);

  const playAgain = useCallback(() => {
    socket?.emit('game:play-again');
    setRankings(null);
  }, [socket]);

  const selectWord = useCallback((word: string) => {
    console.log('[GameContext] Selecting word:', word);
    socket?.emit('game:select-word', { word });
  }, [socket]);


  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    socket.on('room:created', (data: { room: Room & { gameState?: any }; currentPlayerId: string }) => {
      console.log('[GameContext] room:created received:', data);
      setRoom(data.room);
      setCurrentPlayerId(data.currentPlayerId);
      const currentPlayer = data.room.players.find(p => p.id === data.currentPlayerId);
      setIsHost(currentPlayer?.isHost || false);
      // Ensure game starts in lobby phase
      setGameState(prev => ({
        ...initialGameState,
        phase: 'lobby',
        totalRounds: data.room.settings?.rounds || 3,
      }));
    });



    socket.on('room:joined', (data: { room: Room & { gameState?: any }; currentPlayerId?: string }) => {
      console.log('[GameContext] room:joined received:', data);
      setRoom(data.room);
      if (data.currentPlayerId) {
        setCurrentPlayerId(data.currentPlayerId);
        const currentPlayer = data.room.players.find(p => p.id === data.currentPlayerId);
        setIsHost(currentPlayer?.isHost || false);
      }
      // Set game state based on room's current state
      const roomPhase = data.room.gameState?.phase || 'lobby';
      setGameState(prev => ({
        ...initialGameState,
        phase: roomPhase,
        currentRound: data.room.gameState?.currentRound || 0,
        totalRounds: data.room.settings?.rounds || 3,
      }));
    });



    socket.on('room:player-joined', (data: { player: Player }) => {
      console.log('[GameContext] room:player-joined received:', data);
      setRoom(prev => {
        if (!prev) return null;
        // Check if player already exists
        const exists = prev.players.find(p => p.id === data.player.id);
        if (exists) {
          console.log('[GameContext] Player already exists, not adding');
          return prev;
        }
        return {
          ...prev,
          players: [...prev.players, data.player]
        };
      });
    });


    socket.on('room:player-left', (data: { playerId: string }) => {
      console.log('[GameContext] room:player-left received:', data);
      setRoom(prev => prev ? {
        ...prev,
        players: prev.players.filter(p => p.id !== data.playerId)
      } : null);
    });

    socket.on('room:host-changed', (data: { newHostId: string; newHostName: string }) => {
      console.log('[GameContext] room:host-changed received:', data);
      setRoom(prev => {
        if (!prev) return null;
        const updatedPlayers = prev.players.map(p => ({
          ...p,
          isHost: p.id === data.newHostId
        }));
        // Check if current player became host
        const currentPlayer = updatedPlayers.find(p => p.id === currentPlayerId);
        if (currentPlayer?.isHost) {
          setIsHost(true);
        } else {
          setIsHost(false);
        }
        return {
          ...prev,
          players: updatedPlayers
        };
      });
    });


    socket.on('room:settings-updated', (data: { settings: RoomSettings; maxPlayers: number }) => {
      console.log('[GameContext] room:settings-updated received:', data);
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          settings: data.settings,
          maxPlayers: data.maxPlayers
        };
      });
    });

    socket.on('room:players-updated', (data: { players: Player[] }) => {

      console.log('[GameContext] room:players-updated received:', data);
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: data.players
        };
      });
    });




    socket.on('game:starting', (data: { round: number; totalRounds: number }) => {
      setGameState(prev => ({
        ...prev,
        phase: 'selection',
        currentRound: data.round,
        totalRounds: data.totalRounds,
      }));
    });

    socket.on('game:word-selection', (data: { drawer: Player; wordOptions: string[]; selectionTime: number }) => {
      console.log('[GameContext] game:word-selection received:', data);
      setGameState(prev => ({
        ...prev,
        phase: 'selection',
        currentDrawer: data.drawer,
        wordOptions: data.wordOptions,
        selectionTimeRemaining: data.selectionTime,
      }));
      setIsDrawer(data.drawer.id === currentPlayerId);
    });


    socket.on('game:free-draw', () => {
      setGameState(prev => ({
        ...prev,
        phase: 'freeDraw',
        isFreeDraw: true,
      }));
      setIsDrawer(true);
    });

    socket.on('game:word-selected', (data: { word: string; blanks: string; hints: number }) => {
      setGameState(prev => ({
        ...prev,
        phase: 'drawing',
        currentWord: data.word,
        wordHints: data.blanks.split(''),
        hintsRemaining: data.hints,
      }));
    });

    socket.on('game:drawer-changed', (data: { drawer: Player }) => {
      setGameState(prev => ({
        ...prev,
        currentDrawer: data.drawer,
      }));
      setIsDrawer(data.drawer.id === currentPlayerId);
    });

    socket.on('game:timer-update', (data: { timeRemaining: number }) => {
      setGameState(prev => ({
        ...prev,
        timeRemaining: data.timeRemaining,
      }));
    });

    socket.on('game:selection-timer', (data: { timeRemaining: number }) => {
      setGameState(prev => ({
        ...prev,
        selectionTimeRemaining: data.timeRemaining,
      }));
    });


    socket.on('game:hint-update', (data: { hints: string[]; hintsRemaining: number }) => {
      console.log('[GameContext] game:hint-update received:', data);
      setGameState(prev => ({
        ...prev,
        wordHints: data.hints,
        hintsRemaining: data.hintsRemaining,
      }));
    });


    socket.on('game:guess-correct', (data: { playerId: string; username: string; word: string; points: number }) => {
      console.log('[GameContext] game:guess-correct received:', data);
      
      // Update scores in gameState
      setGameState(prev => {
        const existingScore = prev.scores.find(s => s.playerId === data.playerId);
        const newScores = existingScore 
          ? prev.scores.map(s => s.playerId === data.playerId ? { ...s, score: s.score + data.points } : s)
          : [...prev.scores, { playerId: data.playerId, score: data.points }];
        return {
          ...prev,
          scores: newScores
        };
      });
      
      // Also update room.players so the player list shows updated scores
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map(p => 
            p.id === data.playerId 
              ? { ...p, score: p.score + data.points }
              : p
          )
        };
      });
    });


    socket.on('game:round-end', (data: { word: string; scores: { playerId: string; score: number }[] }) => {
      console.log('[GameContext] game:round-end received:', data);
      setGameState(prev => ({
        ...prev,
        phase: 'roundEnd',
        currentWord: data.word,
        scores: data.scores,
      }));
      // Update room.players with final scores from round
      setRoom(prev => {
        if (!prev) return null;
        return {
          ...prev,
          players: prev.players.map(p => {
            const scoreData = data.scores.find(s => s.playerId === p.id);
            return scoreData ? { ...p, score: scoreData.score } : p;
          })
        };
      });
      setIsDrawer(false);
    });


    socket.on('game:end', (data: { finalScores: { playerId: string; username: string; score: number; avatarId: string }[]; rankings: any[] }) => {
      setGameState(prev => ({
        ...prev,
        phase: 'gameEnd',
        scores: data.finalScores.map(s => ({ playerId: s.playerId, score: s.score })),
      }));
      setRankings(data.rankings);
    });

    socket.on('game:reset', (data: { room: Room }) => {
      setRoom(data.room);
      setGameState(initialGameState);
      setIsDrawer(false);
      setRankings(null);
    });

    return () => {
      socket.off('room:created');
      socket.off('room:joined');
      socket.off('room:player-joined');
      socket.off('room:player-left');
      socket.off('room:host-changed');
      socket.off('room:settings-updated');
      socket.off('room:players-updated');


      socket.off('game:starting');
      socket.off('game:word-selection');

      socket.off('game:free-draw');

      socket.off('game:word-selected');
      socket.off('game:drawer-changed');
      socket.off('game:timer-update');
      socket.off('game:selection-timer');
      socket.off('game:hint-update');

      socket.off('game:guess-correct');

      socket.off('game:round-end');
      socket.off('game:end');
      socket.off('game:reset');
    };
  }, [socket, currentPlayerId]);

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
