import { WebSocket } from 'ws';
import { createHmac, timingSafeEqual } from 'crypto';
import { connectionManager, Connection } from '../connectionManager.js';
import * as roomService from '../../services/room.service.js';
import * as gameEngineService from '../../services/game-engine.service.js';

interface WSMessage {
  type: string;
  [key: string]: unknown;
}

interface JwtPayload {
  id?: string;
  sub?: string;
  exp?: number;
}

function decodeJwtPayload(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as JwtPayload;
    return payload;
  } catch {
    return null;
  }
}

function verifyJwtHs256(token: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [headerB64, payloadB64, signatureB64] = parts;
  const secret = process.env.JWT_SECRET || 'kribble-dev-secret-change-in-production';
  const signingInput = `${headerB64}.${payloadB64}`;
  const expectedSignature = createHmac('sha256', secret).update(signingInput).digest('base64url');

  const signatureBuf = Buffer.from(signatureB64, 'utf-8');
  const expectedBuf = Buffer.from(expectedSignature, 'utf-8');
  if (signatureBuf.length !== expectedBuf.length || !timingSafeEqual(signatureBuf, expectedBuf)) {
    return null;
  }

  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    return null;
  }

  return payload;
}

async function resolveAuthorizedRoom(connection: Connection, roomCode: string) {
  const room = await roomService.getRoomByCode(roomCode.toUpperCase());
  if (!room) return null;

  const isMember = room.players.some((player) => player.userId === connection.userId);
  if (!isMember) return null;

  if (connection.roomId && connection.roomId !== room.id) return null;
  return room;
}

async function isAuthorizedForBoundRoom(connection: Connection): Promise<boolean> {
  if (!connection.roomId || !connection.isAuthenticated) return false;
  const room = await roomService.getRoomById(connection.roomId);
  if (!room) return false;
  return room.players.some((player) => player.userId === connection.userId);
}

export async function handleMessage(connectionId: string, message: string): Promise<void> {
  const connection = connectionManager.getConnection(connectionId);
  if (!connection) return;

  try {
    const data: WSMessage = JSON.parse(message);
    
    switch (data.type) {
      case 'auth':
        handleAuth(connectionId, connection, data);
        break;
      case 'room:join':
        await handleRoomJoin(connectionId, connection, data);
        break;
      case 'room:leave':
        handleRoomLeave(connectionId, connection, data);
        break;
      case 'room:resync':
        await handleRoomResync(connectionId, connection, data);
        break;
      case 'player:ready':
        await handlePlayerReady(connectionId, connection, data);
        break;
      case 'stroke:start':
        await handleStrokeStart(connectionId, connection, data);
        break;
      case 'stroke:update':
        await handleStrokeUpdate(connectionId, connection, data);
        break;
      case 'stroke:end':
        await handleStrokeEnd(connectionId, connection, data);
        break;
      case 'guess':
        await handleGuess(connectionId, connection, data);
        break;
      case 'word:select':
        await handleWordSelect(connectionId, connection, data);
        break;
      case 'ping':
        handlePing(connectionId);
        break;
      default:
        console.log(`Unknown message type: ${data.type}`);
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
}

function handleAuth(connectionId: string, connection: Connection, data: WSMessage): void {
  const token = data.token as string;
  if (!token) {
    sendError(connection, 'auth:error', 'No token provided');
    return;
  }

  const payload = verifyJwtHs256(token);
  const userId = payload?.id ?? payload?.sub;
  if (userId) {
    connectionManager.authenticateConnection(connectionId, userId);
    connection.ws.send(JSON.stringify({ type: 'auth:success', userId }));
  } else {
    sendError(connection, 'auth:error', 'Invalid token payload');
  }
}

async function handleRoomJoin(connectionId: string, connection: Connection, data: WSMessage): Promise<void> {
  const roomCode = data.code as string;
  if (!roomCode || !connection.isAuthenticated) {
    sendError(connection, 'error', 'Authentication required to join room');
    return;
  }

  const room = await resolveAuthorizedRoom(connection, roomCode);
  if (!room) {
    sendError(connection, 'error', 'Room not found or access denied');
    return;
  }

  connectionManager.joinRoom(connectionId, room.id);

  const state = await gameEngineService.getRoomState(room.code, (message) => {
    connectionManager.broadcastToRoom(room.id, message);
  });
  if (state) {
    connection.ws.send(
      JSON.stringify({
        type: 'room:state',
        room: state.room,
      })
    );
  }
  
  connectionManager.broadcastToRoom(room.id, {
    type: 'player:joined',
    userId: connection.userId,
  });
}

async function handleRoomResync(connectionId: string, connection: Connection, data: WSMessage): Promise<void> {
  const roomCode = data.code as string;
  if (!roomCode || !connection.isAuthenticated) {
    sendError(connection, 'error', 'Authentication required to resync room');
    return;
  }

  const room = await resolveAuthorizedRoom(connection, roomCode);
  if (!room) {
    sendError(connection, 'error', 'Room not found or access denied');
    return;
  }

  connectionManager.joinRoom(connectionId, room.id);

  const state = await gameEngineService.getRoomState(room.code, (message) => {
    connectionManager.broadcastToRoom(room.id, message);
  });
  if (!state) {
    sendError(connection, 'error', 'Unable to resync room state');
    return;
  }

  connection.ws.send(
    JSON.stringify({
      type: 'room:state',
      room: state.room,
    })
  );
}

function handleRoomLeave(connectionId: string, connection: Connection, _data: WSMessage): void {
  if (!connection.roomId || !connection.isAuthenticated) return;

  const roomId = connection.roomId;
  connectionManager.removeFromRoom(connectionId, roomId);

  connectionManager.broadcastToRoom(roomId, {
    type: 'player:left',
    userId: connection.userId,
  });
}

async function handlePlayerReady(connectionId: string, connection: Connection, data: WSMessage): Promise<void> {
  if (!connection.roomId || !connection.isAuthenticated) return;
  if (!(await isAuthorizedForBoundRoom(connection))) {
    sendError(connection, 'error', 'Room access denied');
    return;
  }

  const isReady = data.isReady as boolean;
  const roomCode = data.code as string | undefined;
  if (!roomCode) {
    sendError(connection, 'error', 'Room code is required');
    return;
  }
  if (!(await resolveAuthorizedRoom(connection, roomCode))) {
    sendError(connection, 'error', 'Room not found or access denied');
    return;
  }

  const result = await gameEngineService.syncPlayerReady(roomCode, connection.userId, isReady, (message) => {
    connectionManager.broadcastToRoom(connection.roomId!, message);
  });
  if (!result) {
    sendError(connection, 'error', 'Unable to update ready state');
    return;
  }

  connectionManager.broadcastToRoom(result.roomId, {
    type: 'player:ready',
    userId: connection.userId,
    isReady,
  });
}

async function handleStrokeStart(connectionId: string, connection: Connection, data: WSMessage): Promise<void> {
  if (!connection.roomId || !connection.isAuthenticated) return;
  if (!(await isAuthorizedForBoundRoom(connection))) {
    sendError(connection, 'error', 'Room access denied');
    return;
  }

  // Broadcast stroke start to room
  connectionManager.broadcastToRoom(connection.roomId, {
    type: 'stroke:start',
    userId: connection.userId,
    points: data.points,
    color: data.color,
    brushSize: data.brushSize,
  });
}

async function handleStrokeUpdate(connectionId: string, connection: Connection, data: WSMessage): Promise<void> {
  if (!connection.roomId || !connection.isAuthenticated) return;
  if (!(await isAuthorizedForBoundRoom(connection))) {
    sendError(connection, 'error', 'Room access denied');
    return;
  }

  // Broadcast stroke update to room
  connectionManager.broadcastToRoom(connection.roomId, {
    type: 'stroke:update',
    userId: connection.userId,
    points: data.points,
  });
}

async function handleStrokeEnd(connectionId: string, connection: Connection, _data: WSMessage): Promise<void> {
  if (!connection.roomId || !connection.isAuthenticated) return;
  if (!(await isAuthorizedForBoundRoom(connection))) {
    sendError(connection, 'error', 'Room access denied');
    return;
  }

  // Broadcast stroke end to room
  connectionManager.broadcastToRoom(connection.roomId, {
    type: 'stroke:end',
    userId: connection.userId,
  });
}

async function handleGuess(connectionId: string, connection: Connection, data: WSMessage): Promise<void> {
  if (!connection.roomId || !connection.isAuthenticated) return;
  if (!(await isAuthorizedForBoundRoom(connection))) {
    sendError(connection, 'error', 'Room access denied');
    return;
  }

  const guess = data.text as string;
  const roomCode = data.code as string | undefined;
  if (!roomCode) {
    sendError(connection, 'error', 'Room code is required');
    return;
  }
  const room = await resolveAuthorizedRoom(connection, roomCode);
  if (!room) {
    sendError(connection, 'error', 'Room not found or access denied');
    return;
  }

  if (!guess) return;

  const result = await gameEngineService.submitGuess(roomCode, connection.userId, guess, (message) => {
    connectionManager.broadcastToRoom(connection.roomId!, message);
  });
  if (!result) return;

  if (result.isCorrect) {
    connectionManager.broadcastToRoom(result.roomId, {
      type: 'guess:correct',
      playerId: connection.userId,
      displayName: connection.userId,
    });
    return;
  }

  connectionManager.broadcastToRoom(result.roomId, {
    type: 'guess:wrong',
    playerId: connection.userId,
  });

  connectionManager.broadcastToRoom(result.roomId, {
    type: 'guess',
    userId: connection.userId,
    text: guess,
  });
}

async function handleWordSelect(connectionId: string, connection: Connection, data: WSMessage): Promise<void> {
  if (!connection.roomId || !connection.isAuthenticated) return;
  if (!(await isAuthorizedForBoundRoom(connection))) {
    sendError(connection, 'error', 'Room access denied');
    return;
  }

  const word = data.word as string;
  const roomCode = data.code as string | undefined;
  if (!roomCode) {
    sendError(connection, 'error', 'Room code is required');
    return;
  }
  const room = await resolveAuthorizedRoom(connection, roomCode);
  if (!room) {
    sendError(connection, 'error', 'Room not found or access denied');
    return;
  }

  if (!word) return;

  const result = await gameEngineService.selectWord(roomCode, connection.userId, word, (message) => {
    connectionManager.broadcastToRoom(connection.roomId!, message);
  });
  if (!result) {
    sendError(connection, 'error', 'Invalid word selection');
    return;
  }

  connectionManager.broadcastToRoom(result.roomId, {
    type: 'word:selected',
    userId: connection.userId,
    wordLength: word.length,
  });
}

function handlePing(connectionId: string): void {
  connectionManager.updatePing(connectionId);
  
  const connection = connectionManager.getConnection(connectionId);
  if (connection) {
    connection.ws.send(JSON.stringify({ type: 'pong' }));
  }
}

function sendError(connection: Connection, type: string, message: string): void {
  connection.ws.send(JSON.stringify({
    type,
    message,
  }));
}
