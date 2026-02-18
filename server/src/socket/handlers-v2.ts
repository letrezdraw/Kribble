/**
 * Kribble V2 - Production-Level Socket Handlers
 * Authoritative, reconnect-safe, identity-based multiplayer
 */

import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger.js';
import { validateUsername, validateMessage } from '../utils/profanityFilter.js';
import { guessRateLimiter, chatRateLimiter, drawRateLimiter } from '../utils/rateLimiter.js';

// Core modules
import {
  createRoom,
  joinRoom,
  handleDisconnect,
  handleIntentionalLeave,
  getRoom,
  getActiveRooms,
  getPlayerBySocket,
  getRoomIdByUser,
  forceLeaveCurrentRoom,
} from '../core/RoomManager.js';

import {
  startGame,
  transitionToWordSelection,
  startDrawingPhase,
  processGuess,
  revealHint,
  endTurn,
  endRound,
  endGame,
  resetGame,
  storeStroke,
  getCanvasHistory,
  clearCanvas,
} from '../core/GameStateMachine.js';

import { Room, Player, Stroke, StrokePoint } from '../types/game.js';

// Helper to serialize player for client
function serializePlayer(player: Player) {
  return {
    userId: player.userId,
    username: player.username,
    avatarId: player.avatarId,
    score: player.score,
    isHost: player.isHost,
    isDrawer: player.isDrawer,
    connected: player.connected,
    connectionState: player.connectionState,
  };
}

// Helper to serialize room for client
function serializeRoom(room: Room) {
  return {
    id: room.id,
    phase: room.phase,
    hostId: room.hostId,
    players: Array.from(room.players.values()).map(serializePlayer),
    drawerOrder: room.drawerOrder,
    currentDrawerIndex: room.currentDrawerIndex,
    roundNumber: room.roundNumber,
    totalRounds: room.totalRounds,
    turnTimer: room.turnTimer,
    wordSelectionTimer: room.wordSelectionTimer,
    currentWord: room.currentWord,
    wordOptions: room.wordOptions,
    wordHints: room.wordHints,
    hintsRemaining: room.hintsRemaining,
    settings: room.settings,
  };
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    logger.info('SOCKET', 'Client connected', { socketId: socket.id });

    // ==========================================
    // LOBBY
    // ==========================================

    socket.on('lobby:get-rooms', () => {
      try {
        const activeRooms = getActiveRooms().map(room => ({
          id: room.id,
          name: room.name,
          hostName: room.players.get(room.hostId)?.username,
          playerCount: room.players.size,
          maxPlayers: room.settings.maxPlayers,
          phase: room.phase,
          isPrivate: room.settings.isPrivate,
          gameMode: room.settings.gameMode,
        }));
        
        socket.emit('lobby:rooms', { rooms: activeRooms });
      } catch (error) {
        logger.error('SOCKET', 'Error fetching rooms', error as Error);
        socket.emit('lobby:error', { message: 'Failed to fetch rooms' });
      }
    });

    // ==========================================
    // ROOM MANAGEMENT
    // ==========================================

    socket.on('room:create', (data: {

      name: string;
      settings?: Partial<Room['settings']>;
      username?: string;
      userId?: string;
      avatarId?: string;
    }) => {
      try {
        // Validate username
        const username = data.username || 'Player';
        const validation = validateUsername(username);
        if (!validation.valid) {
          socket.emit('room:error', { message: validation.error });
          return;
        }

        const userId = data.userId || uuidv4();
        const avatarId = data.avatarId || '👤';

        const room = createRoom(
          socket.id,
          userId,
          username,
          avatarId,
          data.name || 'Game Room',
          data.settings
        );

        if (!room) {
          socket.emit('room:error', { message: 'Failed to create room' });
          return;
        }

        socket.join(room.id);

        // Send room data to creator
        socket.emit('room:created', {
          room: serializeRoom(room),
          userId,
          isHost: true,
        });

        // Notify lobby
        io.emit('lobby:rooms-updated', {
          rooms: getActiveRooms().map(r => ({
            id: r.id,
            name: r.name,
            hostName: r.players.get(r.hostId)?.username,
            playerCount: r.players.size,
            maxPlayers: r.settings.maxPlayers,
            phase: r.phase,
          })),
        });

        logger.info('SOCKET', 'Room created', { roomId: room.id, userId });

      } catch (error) {
        logger.error('SOCKET', 'Error creating room', error as Error);
        socket.emit('room:error', { message: 'Internal error' });
      }
    });

    socket.on('room:join', (data: {
      roomId: string;
      password?: string;
      username?: string;
      userId?: string;
      avatarId?: string;
      joinByCode?: boolean;
    }) => {
      try {
        const username = data.username || 'Player';
        const validation = validateUsername(username);
        if (!validation.valid) {
          socket.emit('room:error', { message: validation.error });
          return;
        }

        const userId = data.userId || uuidv4();
        const avatarId = data.avatarId || '👤';

        // Try to find room
        let room = getRoom(data.roomId);

        // If not found and joinByCode, try partial match
        if (!room && data.joinByCode) {
          const allRooms = getActiveRooms();
          const match = allRooms.find(r => r.id.startsWith(data.roomId.toUpperCase()));
          if (match) {
            room = match;
          }
        }

        if (!room) {
          socket.emit('room:error', { message: 'Room not found' });
          return;
        }

        // Check password for private rooms
        if (room.settings.isPrivate && room.settings.password) {
          if (data.password !== room.settings.password) {
            socket.emit('room:error', { message: 'Incorrect password' });
            return;
          }
        }

        const result = joinRoom(socket.id, userId, username, avatarId, room.id);

        if (!result) {
          socket.emit('room:error', { message: 'Failed to join room' });
          return;
        }

        const { room: joinedRoom, player, isReconnect } = result;

        socket.join(joinedRoom.id);

        // Send room data to joining player
        socket.emit('room:joined', {
          room: serializeRoom(joinedRoom),
          userId,
          isHost: player.isHost,
          isReconnect,
        });

        // If game in progress (drawing phase), send canvas history to new player
        if (joinedRoom.phase === 'drawing') {
          const canvasHistory = getCanvasHistory(joinedRoom);
          socket.emit('canvas:history', { strokes: canvasHistory });
        }


        // Notify other players
        socket.to(joinedRoom.id).emit('room:player-joined', {
          player: serializePlayer(player),
          isReconnect,
        });

        // Notify lobby
        io.emit('lobby:rooms-updated', {
          rooms: getActiveRooms().map(r => ({
            id: r.id,
            name: r.name,
            hostName: r.players.get(r.hostId)?.username,
            playerCount: r.players.size,
            maxPlayers: r.settings.maxPlayers,
            phase: r.phase,
          })),
        });

        logger.info('SOCKET', 'Player joined room', {
          roomId: joinedRoom.id,
          userId,
          isReconnect,
        });

      } catch (error) {
        logger.error('SOCKET', 'Error joining room', error as Error);
        socket.emit('room:error', { message: 'Internal error' });
      }
    });

    socket.on('room:leave', () => {
      try {
        const result = handleIntentionalLeave(socket.id);
        if (!result) return;

        const { roomId, userId, player, roomEmpty } = result;

        socket.leave(roomId);

        // Get updated room to send full state
        const updatedRoom = getRoom(roomId);
        
        // Notify other players with full room state
        if (updatedRoom && !roomEmpty) {
          io.to(roomId).emit('room:player-left', {
            userId,
            username: player.username,
            newHostId: updatedRoom.hostId,
            room: serializeRoom(updatedRoom), // Send full updated room
          });
        } else {
          io.to(roomId).emit('room:player-left', {
            userId,
            username: player.username,
            newHostId: undefined,
          });
        }

        // Notify lobby
        io.emit('lobby:rooms-updated', {
          rooms: getActiveRooms().map(r => ({
            id: r.id,
            name: r.name,
            hostName: r.players.get(r.hostId)?.username,
            playerCount: r.players.size,
            maxPlayers: r.settings.maxPlayers,
            phase: r.phase,
          })),
        });

        logger.info('SOCKET', 'Player left room', { roomId, userId, roomEmpty, newHostId: updatedRoom?.hostId });

      } catch (error) {
        logger.error('SOCKET', 'Error leaving room', error as Error);
      }
    });


    socket.on('room:update-settings', (data: {
      roomId: string;
      settings: Partial<Room['settings']>;
    }) => {
      try {
        const room = getRoom(data.roomId);
        if (!room) {
          socket.emit('room:error', { message: 'Room not found' });
          return;
        }

        const player = room.players.get(getPlayerBySocket(socket.id)?.player.userId || '');
        if (!player || !player.isHost) {
          socket.emit('room:error', { message: 'Only host can update settings' });
          return;
        }

        // Update settings
        Object.assign(room.settings, data.settings);

        // Notify all players
        io.to(room.id).emit('room:settings-updated', {
          settings: room.settings,
        });

        logger.info('SOCKET', 'Room settings updated', {
          roomId: room.id,
          settings: data.settings,
        });

      } catch (error) {
        logger.error('SOCKET', 'Error updating settings', error as Error);
      }
    });

    // ==========================================
    // GAME MANAGEMENT
    // ==========================================

    socket.on('game:start', () => {
      try {
        const result = getPlayerBySocket(socket.id);
        if (!result) {
          socket.emit('game:error', { message: 'Not in a room' });
          return;
        }

        const { room, player } = result;

        if (!player.isHost) {
          socket.emit('game:error', { message: 'Only host can start game' });
          return;
        }

        const success = startGame(room);
        if (!success) {
          socket.emit('game:error', { message: 'Cannot start game' });
          return;
        }

        // Notify all players
        io.to(room.id).emit('game:started', {
          room: serializeRoom(room),
        });

        // If in word selection phase, notify drawer
        if (room.phase === 'wordSelection') {
          const drawer = room.players.get(room.drawerOrder[room.currentDrawerIndex]);
          if (drawer) {
            io.to(drawer.socketId || '').emit('game:word-selection', {
              wordOptions: room.wordOptions,
              selectionTime: room.wordSelectionTimer,
            });
          }
        }

        logger.info('SOCKET', 'Game started', { roomId: room.id });

      } catch (error) {
        logger.error('SOCKET', 'Error starting game', error as Error);
      }
    });

    socket.on('game:select-word', (data: { word: string }) => {
      try {
        const result = getPlayerBySocket(socket.id);
        if (!result) return;

        const { room, player } = result;

        if (!player.isDrawer) {
          socket.emit('game:error', { message: 'Only drawer can select word' });
          return;
        }

        const success = startDrawingPhase(room, data.word);
        if (!success) return;

        // Notify all players
        io.to(room.id).emit('game:drawing-started', {
          room: serializeRoom(room),
          wordLength: room.currentWord?.length,
        });

        // Send full word to drawer
        socket.emit('game:word-reveal', {
          word: room.currentWord,
        });

        logger.info('SOCKET', 'Word selected, drawing started', {
          roomId: room.id,
          word: data.word,
        });

      } catch (error) {
        logger.error('SOCKET', 'Error selecting word', error as Error);
      }
    });

    socket.on('game:request-hint', () => {
      try {
        const result = getPlayerBySocket(socket.id);
        if (!result) return;

        const { room, player } = result;

        // Only non-drawers can request hints
        if (player.isDrawer) return;

        const hints = revealHint(room);
        if (!hints) return;

        // Notify all players
        io.to(room.id).emit('game:hint-revealed', {
          hints,
          hintsRemaining: room.hintsRemaining,
        });

      } catch (error) {
        logger.error('SOCKET', 'Error requesting hint', error as Error);
      }
    });

    socket.on('game:play-again', () => {
      try {
        const result = getPlayerBySocket(socket.id);
        if (!result) return;

        const { room, player } = result;

        if (!player.isHost) {
          socket.emit('game:error', { message: 'Only host can reset game' });
          return;
        }

        const success = resetGame(room);
        if (!success) return;

        // Notify all players
        io.to(room.id).emit('game:reset', {
          room: serializeRoom(room),
        });

        logger.info('SOCKET', 'Game reset', { roomId: room.id });

      } catch (error) {
        logger.error('SOCKET', 'Error resetting game', error as Error);
      }
    });

    // ==========================================
    // GUESSING
    // ==========================================

    socket.on('guess:submit', (data: { guess: string }) => {
      try {
        // Rate limiting
        if (!guessRateLimiter.canProceed(socket.id)) {
          socket.emit('guess:error', { message: 'Too many guesses' });
          return;
        }

        const result = getPlayerBySocket(socket.id);
        if (!result) return;

        const { room, player } = result;

        // Validate guess
        const guessValidation = validateMessage(data.guess);
        if (!guessValidation.valid) {
          socket.emit('guess:error', { message: guessValidation.error });
          return;
        }

        const guessResult = processGuess(room, player.userId, data.guess);

        if (guessResult.correct) {
          // Notify guesser
          socket.emit('guess:correct', {
            points: guessResult.points,
            totalScore: player.score,
          });

          // Notify all players
          io.to(room.id).emit('game:player-guessed', {
            userId: player.userId,
            username: player.username,
            points: guessResult.points,
            scores: Array.from(room.players.values()).map(p => ({
              userId: p.userId,
              score: p.score,
            })),
          });

          // Check if all guessed
          const nonDrawers = Array.from(room.players.values()).filter(p => !p.isDrawer && p.connected);
          const allGuessed = nonDrawers.every(p => p.guessedThisTurn);

          if (allGuessed) {
            io.to(room.id).emit('game:all-guessed');
          }

        } else {
          // Wrong guess - broadcast to chat
          io.to(room.id).emit('chat:message', {
            userId: player.userId,
            username: player.username,
            message: data.guess,
            isGuess: true,
            timestamp: Date.now(),
          });
        }

      } catch (error) {
        logger.error('SOCKET', 'Error submitting guess', error as Error);
      }
    });

    // ==========================================
    // DRAWING
    // ==========================================

    socket.on('draw:stroke', (data: { stroke: Stroke }) => {
      try {
        console.log('[SERVER] Received draw:stroke from socket:', socket.id, 'strokeId:', data.stroke?.id);
        
        // Rate limiting
        if (!drawRateLimiter.canProceed(socket.id)) {
          console.log('[SERVER] Rate limited stroke from:', socket.id);
          return;
        }

        const result = getPlayerBySocket(socket.id);
        if (!result) {
          console.log('[SERVER] No player found for socket:', socket.id);
          return;
        }

        const { room, player } = result;
        console.log('[SERVER] Player found:', player.userId, 'isDrawer:', player.isDrawer, 'room phase:', room.phase);

        // Only drawer can draw
        if (!player.isDrawer) {
          console.log('[SERVER] Player is not drawer, rejecting stroke');
          return;
        }

        // Only during drawing phase
        if (room.phase !== 'drawing') {
          console.log('[SERVER] Room not in drawing phase, rejecting stroke');
          return;
        }

        if (!data.stroke || !data.stroke.points) {
          console.log('[SERVER] Invalid stroke data received');
          return;
        }

        const stroke: Stroke = {
          id: data.stroke.id,
          userId: player.userId,
          color: data.stroke.color,
          size: data.stroke.size,
          tool: data.stroke.tool,
          points: data.stroke.points,
          timestamp: Date.now(),
        };

        storeStroke(room, stroke);
        console.log('[SERVER] Stored stroke, broadcasting to room:', room.id);

        // Broadcast to other players (not sender)
        socket.to(room.id).emit('draw:stroke', {
          playerId: socket.id,
          stroke: data.stroke,
        });
        console.log('[SERVER] Broadcasted stroke to room:', room.id);



      } catch (error) {
        logger.error('SOCKET', 'Error handling stroke', error as Error);
      }
    });



    socket.on('draw:clear', () => {
      try {
        const result = getPlayerBySocket(socket.id);
        if (!result) return;

        const { room, player } = result;

        if (!player.isDrawer) return;

        clearCanvas(room);

        // Broadcast to all
        io.to(room.id).emit('draw:clear', { userId: player.userId });

      } catch (error) {
        logger.error('SOCKET', 'Error clearing canvas', error as Error);
      }
    });

    // ==========================================
    // CHAT
    // ==========================================

    socket.on('chat:message', (data: { message: string }) => {
      try {
        // Rate limiting
        if (!chatRateLimiter.canProceed(socket.id)) {
          socket.emit('chat:error', { message: 'Too many messages' });
          return;
        }

        const result = getPlayerBySocket(socket.id);
        if (!result) return;

        const { room, player } = result;

        // Validate message
        const validation = validateMessage(data.message);
        if (!validation.valid) {
          socket.emit('chat:error', { message: validation.error });
          return;
        }

        const censoredMessage = validation.censored || data.message;

        // Broadcast to all (including sender for consistency)
        io.to(room.id).emit('chat:message', {
          userId: player.userId,
          username: player.username,
          message: censoredMessage,
          isSystem: false,
          timestamp: Date.now(),
        });

      } catch (error) {
        logger.error('SOCKET', 'Error handling chat', error as Error);
      }
    });

    // ==========================================
    // DISCONNECT
    // ==========================================

    socket.on('disconnect', () => {
      try {
        const result = handleDisconnect(socket.id);
        if (!result) {
          logger.info('SOCKET', 'Disconnected socket not in room', { socketId: socket.id });
          return;
        }

        const { roomId, userId, player } = result;

        // Notify other players
        io.to(roomId).emit('room:player-disconnected', {
          userId,
          username: player.username,
          connectionState: player.connectionState,
        });

        logger.info('SOCKET', 'Player disconnected', {
          roomId,
          userId,
          username: player.username,
        });

      } catch (error) {
        logger.error('SOCKET', 'Error handling disconnect', error as Error);
      }
    });
  });
}
