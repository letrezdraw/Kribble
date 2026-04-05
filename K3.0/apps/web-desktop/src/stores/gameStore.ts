import { create } from 'zustand';

interface User {
  id: string;
  displayName: string;
  avatar?: string;
  isGuest: boolean;
}

interface Player {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  score: number;
  isReady: boolean;
  isDrawer: boolean;
  hasGuessedCorrectly: boolean;
}

interface Room {
  id: string;
  code: string;
  name: string;
  maxPlayers: number;
  isPrivate: boolean;
  status: string;
  players: Player[];
}

interface GameState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // Room state
  currentRoom: Room | null;
  rooms: Room[];
  
  // Game state
  gamePhase: string;
  currentDrawerId: string | null;
  currentWord: string | null;
  wordOptions: string[] | null;
  roundTime: number;
  currentRound: number;
  maxRounds: number;
  
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setAuthenticated: (isAuthenticated: boolean) => void;
  setCurrentRoom: (room: Room | null) => void;
  setRooms: (rooms: Room[]) => void;
  updateRoom: (room: Room) => void;
  setGamePhase: (phase: string) => void;
  setCurrentDrawerId: (drawerId: string | null) => void;
  setCurrentWord: (word: string | null) => void;
  setWordOptions: (options: string[] | null) => void;
  setRoundTime: (time: number) => void;
  setCurrentRound: (round: number) => void;
  setMaxRounds: (rounds: number) => void;
  setConnected: (isConnected: boolean) => void;
  setConnecting: (isConnecting: boolean) => void;
  reset: () => void;
}

const initialState = {
  user: null,
  isAuthenticated: false,
  currentRoom: null,
  rooms: [],
  gamePhase: 'lobby',
  currentDrawerId: null,
  currentWord: null,
  wordOptions: null,
  roundTime: 60,
  currentRound: 1,
  maxRounds: 5,
  isConnected: false,
  isConnecting: false,
};

export const useGameStore = create<GameState>((set) => ({
  ...initialState,
  
  setUser: (user) => set({ user }),
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setCurrentRoom: (currentRoom) => set({ currentRoom }),
  setRooms: (rooms) => set({ rooms }),
  updateRoom: (room) => set((state) => ({
    currentRoom: state.currentRoom?.id === room.id ? room : state.currentRoom,
    rooms: state.rooms.map((r) => r.id === room.id ? room : r),
  })),
  setGamePhase: (gamePhase) => set({ gamePhase }),
  setCurrentDrawerId: (currentDrawerId) => set({ currentDrawerId }),
  setCurrentWord: (currentWord) => set({ currentWord }),
  setWordOptions: (wordOptions) => set({ wordOptions }),
  setRoundTime: (roundTime) => set({ roundTime }),
  setCurrentRound: (currentRound) => set({ currentRound }),
  setMaxRounds: (maxRounds) => set({ maxRounds }),
  setConnected: (isConnected) => set({ isConnected }),
  setConnecting: (isConnecting) => set({ isConnecting }),
  reset: () => set(initialState),
}));
