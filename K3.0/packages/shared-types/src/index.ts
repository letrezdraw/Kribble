// Shared types for Kribble 3.0
// This package contains types shared between client and server

export interface User {
  id: string;
  email?: string;
  displayName: string;
  avatar?: string;
  createdAt: Date;
  isGuest: boolean;
}

export interface Room {
  id: string;
  code: string;
  name: string;
  maxPlayers: number;
  players: RoomPlayer[];
  isPrivate: boolean;
  createdAt: Date;
}

export interface RoomPlayer {
  id: string;
  userId: string;
  displayName: string;
  avatar?: string;
  score: number;
  isReady: boolean;
  isDrawer: boolean;
  hasGuessedCorrectly: boolean;
}

export interface GameState {
  phase: 'lobby' | 'starting' | 'wordSelection' | 'drawing' | 'guessing' | 'roundEnd' | 'gameEnd';
  currentRound: number;
  maxRounds: number;
  currentDrawerId?: string;
  currentWord?: string;
  wordOptions?: string[];
  roundTime: number;
  roundStartTime?: number;
}

export interface Stroke {
  id: string;
  userId: string;
  points: Point[];
  color: string;
  brushSize: number;
  timestamp: number;
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

// WebSocket message types
export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'room:join'; code: string }
  | { type: 'room:resync'; code: string }
  | { type: 'room:leave'; code: string }
  | { type: 'stroke:start'; points: Point[]; color: string; brushSize: number }
  | { type: 'stroke:update'; points: Point[] }
  | { type: 'stroke:end' }
  | { type: 'guess'; code: string; text: string }
  | { type: 'chat'; text: string }
  | { type: 'player:ready'; code: string; isReady: boolean }
  | { type: 'word:select'; code: string; word: string }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'connected'; connectionId: string }
  | { type: 'auth:success'; userId: string; user: User }
  | { type: 'auth:error'; message: string }
  | { type: 'room:joined'; room: Room }
  | { type: 'room:left' }
  | { type: 'room:updated'; room: Room }
  | { type: 'room:state'; room: Room }
  | { type: 'game:phase'; phase: GameState['phase'] }
  | { type: 'game:wordSelection'; drawerId: string; options: string[] }
  | { type: 'game:yourWord'; word: string }
  | { type: 'game:drawing'; drawerId: string; wordLength: number }
  | { type: 'game:roundEnd'; scores: { playerId: string; score: number }[] }
  | { type: 'game:end'; winner: { playerId: string; displayName: string; score: number }; finalScores: { playerId: string; displayName: string; score: number }[] }
  | { type: 'stroke:new'; stroke: Stroke }
  | { type: 'player:joined'; player: RoomPlayer }
  | { type: 'player:left'; playerId: string }
  | { type: 'guess:correct'; playerId: string; displayName: string }
  | { type: 'guess:wrong'; playerId: string }
  | { type: 'chat'; playerId: string; displayName: string; text: string }
  | { type: 'pong' }
  | { type: 'error'; message: string };
