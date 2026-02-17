import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { getWordsByCategory, addMatchHistory, updatePlayerStats, incrementPlayerStat, getPlayerStats } from '../db/index.js';
import { rooms, getRoom, deleteRoom, createRoom, Room, Player, RoomSettings, GameState } from '../data/rooms.js';
import { guessRateLimiter, chatRateLimiter, drawRateLimiter } from '../utils/rateLimiter.js';
import { validateMessage, validateUsername } from '../utils/profanityFilter.js';
import { logger } from '../utils/logger.js';
import { 
  encodeMessage, 
  decodeMessage, 
  compactStroke, 
  expandStroke,
  batchStrokes,
  unbatchStrokes,
  shouldUseBinary,
  calculateSavings 
} from '@kribble/shared';




// Socket to room mapping
const socketToRoom: Map<string, string> = new Map();

// Track active timers per room
const roomTimers = new Map<string, NodeJS.Timeout>();
// Track hint timers per room
const roomHintTimers = new Map<string, NodeJS.Timeout[]>();


// Track pending join operations to prevent race conditions
const pendingJoins = new Map<string, boolean>();

// Track rooms pending deletion (grace period)
const roomsPendingDeletion = new Map<string, NodeJS.Timeout>();
// Track players pending removal (grace period for reconnection)
const playersPendingRemoval = new Map<string, NodeJS.Timeout>();
// Track drawer disconnection state
const drawerDisconnectionState = new Map<string, {
  disconnectedAt: number;
  pausedTimer: NodeJS.Timeout | null;
  drawingData: any;
}>();

// Reconnection windows
const RECONNECT_WINDOW_NORMAL = 60000; // 60 seconds for regular players
const RECONNECT_WINDOW_DRAWER = 90000; // 90 seconds for drawer (pauses round)

// Helper function to deduplicate players by userId
function deduplicatePlayers(room: Room, keepSocketId: string): void {
  if (!room || !room.players) return;
  
  const seenUserIds = new Map<string, number>(); // userId -> index to keep
  
  // First pass: identify duplicates and keep the one matching keepSocketId
  const indicesToRemove: number[] = [];
  
  for (let i = 0; i < room.players.length; i++) {
    const player = room.players[i];
    // Only deduplicate players with actual userIds (not guest player- IDs)
    if (!player.id || player.id.startsWith('player-')) continue;
    
    if (seenUserIds.has(player.id)) {
      // This is a duplicate - check if we should keep this one or the previous
      const existingIndex = seenUserIds.get(player.id)!;
      const existingPlayer = room.players[existingIndex];
      
      // Keep the one that matches keepSocketId, or the non-disconnected one
      if (player.socketId === keepSocketId) {
        // Keep current, mark existing for removal
        indicesToRemove.push(existingIndex);
        seenUserIds.set(player.id, i);
      } else if (existingPlayer.socketId === keepSocketId) {
        // Keep existing, mark current for removal
        indicesToRemove.push(i);
      } else if (player.disconnected && !existingPlayer.disconnected) {
        // Keep existing (connected), mark current for removal
        indicesToRemove.push(i);
      } else if (!player.disconnected && existingPlayer.disconnected) {
        // Keep current (connected), mark existing for removal
        indicesToRemove.push(existingIndex);
        seenUserIds.set(player.id, i);
      } else {
        // Both same status, keep the newer one (higher index)
        indicesToRemove.push(existingIndex);
        seenUserIds.set(player.id, i);
      }
    } else {
      seenUserIds.set(player.id, i);
    }
  }
  
  // Remove duplicates (in reverse order to maintain indices)
  if (indicesToRemove.length > 0) {
    console.log('[deduplicatePlayers] Removing duplicate entries at indices:', indicesToRemove);
    // Sort in descending order
    indicesToRemove.sort((a, b) => b - a);
    for (const index of indicesToRemove) {
      const removed = room.players.splice(index, 1)[0];
      console.log('[deduplicatePlayers] Removed duplicate player:', removed.username, 'socket:', removed.socketId);
    }
  }
}


// Expanded word list with meaningful words from around the world
const globalWords = [
  // Animals
  'elephant', 'giraffe', 'penguin', 'dolphin', 'butterfly', 'kangaroo', 'octopus', 'rhinoceros',
  'hippopotamus', 'crocodile', 'flamingo', 'peacock', 'tiger', 'lion', 'zebra', 'panda',
  'koala', 'sloth', 'hedgehog', 'raccoon', 'squirrel', 'owl', 'eagle', 'falcon',
  // Food & Drinks
  'pizza', 'sushi', 'tacos', 'pasta', 'burger', 'sandwich', 'salad', 'pancakes',
  'croissant', 'donut', 'ice cream', 'chocolate', 'watermelon', 'pineapple', 'avocado',
  'spaghetti', 'lasagna', 'curry', 'ramen', 'dim sum', 'croissant', 'macaron', 'cheesecake',
  // Objects & Technology
  'airplane', 'bicycle', 'rocket', 'submarine', 'helicopter', 'train', 'motorcycle',
  'computer', 'smartphone', 'camera', 'telescope', 'microscope', 'robot', 'drone',
  'umbrella', 'backpack', 'suitcase', 'watch', 'glasses', 'headphones', 'microphone',
  // Nature & Places
  'mountain', 'volcano', 'waterfall', 'rainbow', 'desert', 'island', 'cave', 'glacier',
  'forest', 'meadow', 'canyon', 'beach', 'ocean', 'river', 'lake', 'aurora',
  'pyramid', 'castle', 'skyscraper', 'bridge', 'lighthouse', 'windmill', 'temple',
  // Activities & Sports
  'swimming', 'cycling', 'skateboarding', 'surfing', 'skiing', 'basketball', 'tennis',
  'gymnastics', 'archery', 'fencing', 'rowing', 'climbing', 'dancing', 'singing',
  'painting', 'gardening', 'cooking', 'reading', 'writing', 'photography',
  // Fantasy & Characters
  'dragon', 'unicorn', 'mermaid', 'wizard', 'fairy', 'pirate', 'ninja', 'superhero',
  'vampire', 'werewolf', 'ghost', 'alien', 'dinosaur', 'monster', 'robot', 'cyborg',
  // Everyday Items
  'guitar', 'piano', 'violin', 'trumpet', 'saxophone', 'harmonica', 'accordion',
  'paintbrush', 'easel', 'scissors', 'compass', 'telescope', 'binoculars', 'kite',
  'balloon', 'fireworks', 'candle', 'lantern', 'mirror', 'clock', 'calendar',
  // Professions
  'astronaut', 'chef', 'doctor', 'firefighter', 'pilot', 'scientist', 'artist',
  'musician', 'teacher', 'detective', 'farmer', 'mechanic', 'veterinarian', 'architect',
  // Transportation
  'hot air balloon', 'sailboat', 'cruise ship', 'spaceship', 'hoverboard', 'segway',
  'scooter', 'skateboard', 'rollerblades', 'snowmobile', 'tractor', 'bulldozer',
  // Weather & Natural Phenomena
  'thunderstorm', 'tornado', 'hurricane', 'earthquake', 'tsunami', 'eclipse',
  'meteor', 'comet', 'constellation', 'galaxy', 'nebula', 'black hole',
  // Emotions & Abstract
  'happiness', 'adventure', 'mystery', 'surprise', 'celebration', 'friendship',
  'victory', 'peace', 'harmony', 'creativity', 'imagination', 'wonder', 'magic'
];

// Helper functions
function generateWord(categories: string[] = ['all']): string {
  // Use global word list instead of database for more variety
  return globalWords[Math.floor(Math.random() * globalWords.length)];
}

function generateWordOptions(count: number = 5): string[] {
  const options: string[] = [];
  const usedIndices = new Set<number>();
  
  while (options.length < count && usedIndices.size < globalWords.length) {
    const index = Math.floor(Math.random() * globalWords.length);
    if (!usedIndices.has(index)) {
      usedIndices.add(index);
      options.push(globalWords[index]);
    }
  }
  
  return options;
}

function generateHints(word: string, count: number): string[] {
  const hints: string[] = new Array(word.length).fill('_');
  const revealedIndices = new Set<number>();
  
  while (revealedIndices.size < Math.min(count, word.length)) {
    const index = Math.floor(Math.random() * word.length);
    if (!revealedIndices.has(index)) {
      revealedIndices.add(index);
      hints[index] = word[index];
    }
  }
  
  return hints;
}

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    logger.socketEvent('connection', socket.id, { timestamp: new Date().toISOString() });
    console.log('[Socket] Client connected:', socket.id);

    // Debug: Log all incoming events
    socket.onAny((eventName, ...args) => {
      logger.trace('SOCKET', `Event: ${eventName}`, { args: args.length > 0 ? args : undefined }, undefined, socket.id);
      console.log(`[Socket ${socket.id}] Event: ${eventName}`, args);
    });


    // Room management
    socket.on('room:create', (data: { name: string; settings: Partial<RoomSettings>; username?: string; userId?: string }) => {
      logger.socketEvent('room:create', socket.id, { roomName: data.name, username: data.username, userId: data.userId });
      console.log('[room:create] Creating room:', data.name, 'username:', data.username, 'userId:', data.userId);
      
      // Validate username
      const usernameValidation = validateUsername(data.username || 'Player1');
      if (!usernameValidation.valid) {
        logger.warn('SOCKET', 'Room creation failed: Invalid username', { username: data.username, error: usernameValidation.error });
        socket.emit('room:error', { message: usernameValidation.error });
        return;
      }

      
      // Check if socket is already in a room - leave it first
      const existingRoomId = socketToRoom.get(socket.id);
      if (existingRoomId) {
        logger.trace('SOCKET', 'Leaving existing room before creating new one', { existingRoomId }, data.userId, socket.id);
        console.log('[room:create] Socket already in room:', existingRoomId, '- leaving first');
        const existingRoom = getRoom(existingRoomId);
        if (existingRoom) {
          // Remove player from existing room
          const playerIndex = existingRoom.players.findIndex(p => p.socketId === socket.id);
          if (playerIndex !== -1) {
            existingRoom.players.splice(playerIndex, 1);
            io.to(existingRoomId).emit('room:player-left', { 
              playerId: existingRoom.players[playerIndex]?.id,
              username: data.username || 'Player'
            });
          }
        }
        socket.leave(existingRoomId);
        socketToRoom.delete(socket.id);
      }
      
      const room = createRoom(data.name, data.settings);
      logger.gameState(room.id, 'ROOM_CREATED', { roomName: data.name, host: data.username, settings: data.settings });

      
      // Ensure room starts in lobby phase
      room.gameState.phase = 'lobby';
      room.gameState.currentRound = 0;
      room.gameState.currentDrawerIndex = -1;
      room.gameState.currentWord = '';
      
      // Create the host player with provided username or default
      // Use actual userId if provided, otherwise generate a player ID
      const hostPlayer: Player = {
        id: data.userId || `player-${uuidv4()}`,
        socketId: socket.id,
        username: data.username || `Player1`,
        avatarId: '👤',
        score: 0,
        isDrawer: false,
        isHost: true,
      };
      
      room.players.push(hostPlayer);
      logger.userAction(hostPlayer.id, 'HOST_JOINED', { roomId: room.id, username: hostPlayer.username });
      console.log('[room:create] Added host player:', hostPlayer.id, 'Total players:', room.players.length);
      
      socket.join(room.id);

      socketToRoom.set(socket.id, room.id);
      
      // Notify all clients that room list changed
      io.emit('room:updated');
      
      // Send room data with the host player included
      socket.emit('room:created', { 
        room: { 
          id: room.id, 
          name: room.name, 
          players: room.players.map(p => ({ 
            id: p.id, 
            username: p.username, 
            avatarId: p.avatarId, 
            score: p.score, 
            isDrawer: p.isDrawer, 
            isHost: p.isHost 
          })),
          maxPlayers: room.maxPlayers, 
          settings: room.settings,
          gameState: room.gameState // Include game state to confirm lobby phase
        },
        currentPlayerId: hostPlayer.id,
        password: room.password // Send password so creator can auto-join
      });
      
      console.log('[room:create] Room created in lobby phase:', room.id);
    });


    socket.on('room:join', (data: { roomId: string; password?: string; username?: string; joinByCode?: boolean; userId?: string }) => {
      logger.socketEvent('room:join', socket.id, { roomId: data.roomId, username: data.username, userId: data.userId, joinByCode: data.joinByCode });
      console.log('[room:join] Attempting to join room:', data.roomId, 'username:', data.username, 'userId:', data.userId, 'joinByCode:', data.joinByCode);

      // CRITICAL FIX: Prevent race condition - check if join is already in progress for this user
      if (data.userId && pendingJoins.has(data.userId)) {
        logger.warn('SOCKET', 'Join already in progress, ignoring duplicate', { userId: data.userId, roomId: data.roomId });
        console.log('[room:join] Join already in progress for user:', data.userId, 'ignoring duplicate request');
        return;
      }

      
      // Mark join as in progress
      if (data.userId) {
        pendingJoins.set(data.userId, true);
      }

      // Validate username if provided
      if (data.username) {
        const usernameValidation = validateUsername(data.username);
        if (!usernameValidation.valid) {
          logger.warn('SOCKET', 'Join failed: Invalid username', { username: data.username, error: usernameValidation.error });
          // Clear pending join on error
          if (data.userId) {
            pendingJoins.delete(data.userId);
          }
          socket.emit('room:error', { message: usernameValidation.error });
          return;
        }
      }


      
      // Try to find room by exact match first, then by partial match (for room code joining)
      let room = getRoom(data.roomId);
      
      // If not found and joinByCode is true, try to find room that starts with the provided code
      if (!room && data.joinByCode) {
        const partialMatch = Array.from(rooms.values()).find(r => r.id.startsWith(data.roomId));
        if (partialMatch) {
          console.log('[room:join] Found room by partial match:', partialMatch.id);
          room = partialMatch;
        }
      }
      
      // Cancel pending deletion if room was empty
      const pendingTimeout = roomsPendingDeletion.get(data.roomId);
      if (pendingTimeout) {
        console.log('[room:join] Cancelling pending deletion for room:', data.roomId);
        clearTimeout(pendingTimeout);
        roomsPendingDeletion.delete(data.roomId);
      }

      
      if (!room) {
        logger.warn('SOCKET', 'Join failed: Room not found', { roomId: data.roomId });
        console.log('[room:join] Room not found:', data.roomId);
        // Clear pending join on error
        if (data.userId) {
          pendingJoins.delete(data.userId);
        }
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }



      // Check if player is already in the room (by socket ID or user ID)
      const existingPlayer = room.players.find(p => p.socketId === socket.id || (data.userId && p.id === data.userId));
      if (existingPlayer) {
        console.log('[room:join] Player already in room (rejoining):', existingPlayer.id);
        
        // CRITICAL FIX: Remove any old disconnected entries for this userId to prevent duplicates
        if (data.userId) {
          const oldEntries = room.players.filter(p => p.id === data.userId && p.socketId !== socket.id);
          for (const oldEntry of oldEntries) {
            console.log('[room:join] Removing old disconnected entry for player:', oldEntry.username, 'socket:', oldEntry.socketId);
            const oldIndex = room.players.findIndex(p => p.socketId === oldEntry.socketId);
            if (oldIndex !== -1) {
              room.players.splice(oldIndex, 1);
            }
            // Clear any pending removal timer for old entry
            const oldRemovalTimeout = playersPendingRemoval.get(oldEntry.id);
            if (oldRemovalTimeout) {
              clearTimeout(oldRemovalTimeout);
              playersPendingRemoval.delete(oldEntry.id);
            }
          }
        }
        
        // CRITICAL FIX: Clear any pending removal timer for this player
        const existingRemovalTimeout = playersPendingRemoval.get(existingPlayer.id);
        if (existingRemovalTimeout) {
          console.log('[room:join] Clearing pending removal timer for reconnected player:', existingPlayer.username);
          clearTimeout(existingRemovalTimeout);
          playersPendingRemoval.delete(existingPlayer.id);
        }
        
        // Mark player as reconnected (no longer disconnected)
        existingPlayer.disconnected = false;
        existingPlayer.disconnectedAt = undefined;
        
        // Update socket ID in case it changed
        existingPlayer.socketId = socket.id;
        socketToRoom.set(socket.id, data.roomId);
        socket.join(data.roomId);
        
        // Deduplicate players to ensure no duplicates
        deduplicatePlayers(room, socket.id);
        
        // Clear pending join lock
        if (data.userId) {
          pendingJoins.delete(data.userId);
        }
        
        // Notify all players that player reconnected
        io.to(data.roomId).emit('room:player-reconnected', {
          playerId: existingPlayer.id,
          username: existingPlayer.username
        });
        io.emit('room:updated');
        
        socket.emit('room:joined', { 
          room: { 
            id: room.id, 
            name: room.name, 
            players: room.players.map(p => ({ id: p.id, username: p.username, avatarId: p.avatarId, score: p.score, isDrawer: p.isDrawer, isHost: p.isHost })),
            maxPlayers: room.maxPlayers, 
            settings: room.settings 
          },
          currentPlayerId: existingPlayer.id
        });
        return;
      }

      
      // Check password for private rooms (skip if joining by room code or player is already in room)
      if (room.isPrivate && room.password && !data.joinByCode) {
        if (data.password !== room.password) {
          logger.warn('SOCKET', 'Join failed: Incorrect password', { roomId: data.roomId, userId: data.userId });
          console.log('[room:join] Incorrect password for room:', data.roomId);
          // Clear pending join on error
          if (data.userId) {
            pendingJoins.delete(data.userId);
          }
          socket.emit('room:error', { message: 'Incorrect password' });
          return;
        }
      }

      
      if (room.players.length >= room.maxPlayers) {
        logger.warn('SOCKET', 'Join failed: Room is full', { roomId: data.roomId, currentPlayers: room.players.length, maxPlayers: room.maxPlayers });
        console.log('[room:join] Room is full:', data.roomId);
        // Clear pending join on error
        if (data.userId) {
          pendingJoins.delete(data.userId);
        }
        socket.emit('room:error', { message: 'Room is full' });
        return;
      }


      
      // CRITICAL FIX: Double-check for existing player by userId to prevent race condition duplicates
      if (data.userId) {
        const existingPlayerById = room.players.find(p => p.id === data.userId);
        if (existingPlayerById) {
          console.log('[room:join] RACE CONDITION: Player with userId already exists, treating as rejoin:', data.userId);
          
          // CRITICAL FIX: Remove any old disconnected entries for this userId to prevent duplicates
          const oldEntries = room.players.filter(p => p.id === data.userId && p.socketId !== socket.id);
          for (const oldEntry of oldEntries) {
            console.log('[room:join] Removing old disconnected entry for player:', oldEntry.username, 'socket:', oldEntry.socketId);
            const oldIndex = room.players.findIndex(p => p.socketId === oldEntry.socketId);
            if (oldIndex !== -1) {
              room.players.splice(oldIndex, 1);
            }
            // Clear any pending removal timer for old entry
            const oldRemovalTimeout = playersPendingRemoval.get(oldEntry.id);
            if (oldRemovalTimeout) {
              clearTimeout(oldRemovalTimeout);
              playersPendingRemoval.delete(oldEntry.id);
            }
          }
          
          // Clear any pending removal timer
          const existingRemovalTimeout = playersPendingRemoval.get(existingPlayerById.id);
          if (existingRemovalTimeout) {
            clearTimeout(existingRemovalTimeout);
            playersPendingRemoval.delete(existingPlayerById.id);
          }
          
          // Mark as reconnected
          existingPlayerById.disconnected = false;
          existingPlayerById.disconnectedAt = undefined;
          existingPlayerById.socketId = socket.id;
          
          socketToRoom.set(socket.id, data.roomId);
          socket.join(data.roomId);
          
          // Deduplicate players to ensure no duplicates
          deduplicatePlayers(room, socket.id);
          
          // Clear pending join lock
          if (data.userId) {
            pendingJoins.delete(data.userId);
          }
          
          io.to(data.roomId).emit('room:player-reconnected', {
            playerId: existingPlayerById.id,
            username: existingPlayerById.username
          });
          io.emit('room:updated');
          
          socket.emit('room:joined', { 
            room: { 
              id: room.id, 
              name: room.name, 
              players: room.players.map(p => ({ id: p.id, username: p.username, avatarId: p.avatarId, score: p.score, isDrawer: p.isDrawer, isHost: p.isHost })),
              maxPlayers: room.maxPlayers, 
              settings: room.settings 
            },
            currentPlayerId: existingPlayerById.id
          });
          return;
        }

      }

      
      // Use actual userId if provided, otherwise generate a player ID
      const player: Player = {
        id: data.userId || `player-${uuidv4()}`,
        socketId: socket.id,
        username: data.username || `Player${room.players.length + 1}`,
        avatarId: '👤',
        score: 0,
        isDrawer: false,
        isHost: room.players.length === 0,
      };

      
      room.players.push(player);
      logger.userAction(player.id, 'PLAYER_JOINED', { roomId: room.id, username: player.username, totalPlayers: room.players.length });
      console.log('[room:join] Added player:', player.id, 'Total players:', room.players.length);

      // Deduplicate players to ensure no duplicates after adding new player
      deduplicatePlayers(room, socket.id);
      
      // Clear pending join lock after successful join
      if (data.userId) {
        pendingJoins.delete(data.userId);
      }

      
      socket.join(data.roomId);
      socketToRoom.set(socket.id, data.roomId);

      
      // Check if game is already in progress
      const isGameInProgress = room.gameState.phase !== 'lobby' && room.gameState.phase !== 'gameEnd';
      
      // Notify player
      socket.emit('room:joined', { 
        room: { 
          id: room.id, 
          name: room.name, 
          players: room.players.map(p => ({ id: p.id, username: p.username, avatarId: p.avatarId, score: p.score, isDrawer: p.isDrawer, isHost: p.isHost })),
          maxPlayers: room.maxPlayers, 
          settings: room.settings,
          gameState: isGameInProgress ? {
            phase: room.gameState.phase,
            currentRound: room.gameState.currentRound,
            currentTurn: room.gameState.currentTurn,
            totalRounds: room.gameState.totalRounds,
            currentWord: room.gameState.currentWord,
            wordHints: room.gameState.wordHints,
            hintsRemaining: room.gameState.hintsRemaining,
            timeRemaining: room.gameState.timeRemaining,
            drawerId: room.players[room.gameState.currentDrawerIndex]?.id
          } : undefined
        },
        currentPlayerId: player.id,
        isRejoiningGame: isGameInProgress
      });
      
      // If game is in progress, send additional game state events
      if (isGameInProgress) {
        console.log('[room:join] Player rejoining active game, sending game state');
        
        // Send current word state (with blanks for non-drawers)
        const isDrawer = player.isDrawer;
        socket.emit('game:word-selected', {
          word: isDrawer ? room.gameState.currentWord : room.gameState.currentWord,
          blanks: room.gameState.wordHints.join(' '),
          hints: room.gameState.hintsRemaining,
          drawTime: room.settings.roundTime,
          isRejoin: true
        });
        
        // Send current timer
        socket.emit('game:timer-update', { 
          timeRemaining: room.gameState.timeRemaining 
        });
        
        // Send phase change to put them in the right UI state
        socket.emit('PHASE_CHANGE', {
          phase: room.gameState.phase,
          round: room.gameState.currentRound,
          turn: room.gameState.currentTurn,
          totalRounds: room.gameState.totalRounds,
          drawerId: room.players[room.gameState.currentDrawerIndex]?.id
        });
        
        // If in drawing phase, send current canvas state if available
        if (room.gameState.phase === 'drawing' && room.canvasState && room.canvasState.length > 0) {
          console.log('[room:join] Sending canvas state to rejoining player');
          socket.emit('canvas:sync', { strokes: room.canvasState });
        }
      }

      
      // Notify others
      socket.to(data.roomId).emit('room:player-joined', { player: { id: player.id, username: player.username, avatarId: player.avatarId, score: player.score, isDrawer: player.isDrawer, isHost: player.isHost } });
      
      // Notify all clients that room list changed
      io.emit('room:updated');
      
      logger.info('SOCKET', 'Player joined room successfully', { roomId: data.roomId, playerId: player.id, username: player.username });
      console.log('[room:join] Player joined room successfully:', data.roomId);
    });


    socket.on('room:leave', () => {
      handlePlayerLeave(socket, io, true); // true = intentional leave
    });

    socket.on('room:start', () => {
      logger.socketEvent('room:start', socket.id, { action: 'game_start_request' });
      console.log('[room:start] received from socket:', socket.id);
      const roomId = socketToRoom.get(socket.id);
      console.log('[room:start] Room ID from socketToRoom:', roomId);
      if (!roomId) {
        logger.warn('SOCKET', 'Game start failed: No room found for socket', { socketId: socket.id });
        console.log('[room:start] No room ID found for socket');
        return;
      }
      
      const room = getRoom(roomId);
      console.log('[room:start] Room found:', room?.id, 'Players:', room?.players.length);
      if (!room) {
        logger.warn('SOCKET', 'Game start failed: Room not found', { roomId });
        console.log('[room:start] Room not found');
        return;
      }
      
      // Check if solo play (only 1 player) OR host selected solo mode
      const isSolo = room.players.length === 1 || room.settings.gameMode === 'solo';
      
      if (isSolo) {
        logger.gameState(roomId, 'SOLO_MODE_STARTED', { playerCount: room.players.length });
        console.log('[room:start] Solo play detected - entering free draw mode');
        room.gameState.phase = 'freeDraw';

        
        // Make room private when starting solo
        room.isPrivate = true;
        
        // Set the single player as drawer
        const player = room.players[0];
        player.isDrawer = true;
        
        io.to(roomId).emit('game:free-draw', { 
          message: 'Free Draw Mode - Relax and draw!',
          isPublic: false // Signal that room is now private
        });
        
        // Notify all clients that room list changed (room is now private)
        io.emit('room:updated');
        return;
      }

      
      // Multiplayer - normal game mode
      room.gameState.phase = 'selection';
      room.gameState.currentRound = 1;
      room.gameState.currentDrawerIndex = 0;
      
      logger.gameState(roomId, 'GAME_STARTED', { round: 1, totalRounds: room.settings.rounds, playerCount: room.players.length });
      console.log('[room:start] Emitting game:starting to room:', roomId);

      io.to(roomId).emit('game:starting', { round: room.gameState.currentRound, totalRounds: room.settings.rounds });
      
      // Broadcast phase change to all clients
      io.to(roomId).emit('PHASE_CHANGE', {
        phase: 'selection',
        round: room.gameState.currentRound,
        totalRounds: room.settings.rounds,
        drawerId: room.players[0]?.id
      });
      
      // Start word selection phase for first drawer
      startWordSelection(room, io);

    });

    // Handle word selection from drawer - MOVED INSIDE CONNECTION BLOCK
    socket.on('game:select-word', (data: { word: string }) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      const room = getRoom(roomId);
      if (!room) return;
      
      // Verify sender is the drawer
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player || !player.isDrawer) {
        logger.warn('SOCKET', 'Word selection failed: Not the drawer', { socketId: socket.id, roomId });
        socket.emit('room:error', { message: 'Only the drawer can select the word' });
        return;
      }
      
      // Verify we're in selection phase
      if (room.gameState.phase !== 'selection') {
        logger.warn('SOCKET', 'Word selection failed: Not in selection phase', { roomId, currentPhase: room.gameState.phase });
        socket.emit('room:error', { message: 'Not in word selection phase' });
        return;
      }
      
      // Set the selected word
      room.gameState.currentWord = data.word;
      logger.gameState(roomId, 'WORD_SELECTED', { word: data.word, drawer: player.username });
      console.log('[game:select-word] Drawer selected word:', data.word);
      
      // Start drawing phase
      startDrawingPhase(room, io);
    });


    // Drawing events with MessagePack binary protocol support
    socket.on('draw:stroke', (data: { stroke: any }) => {
      // Rate limiting
      if (!drawRateLimiter.canProceed(socket.id)) {
        return; // Silently drop excess strokes
      }
      
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      const room = getRoom(roomId);
      if (room) {
        // Store stroke in room canvas state for rejoining players
        if (!room.canvasState) {
          room.canvasState = [];
        }
        room.canvasState.push(data.stroke);
      }
      
      // Use compact binary format for stroke data (60% size reduction)
      const compactData = compactStroke(data.stroke);
      const encoded = encodeMessage({ playerId: socket.id, stroke: compactData });
      
      // Log bandwidth savings in development
      if (process.env.NODE_ENV !== 'production') {
        const savings = calculateSavings({ playerId: socket.id, stroke: data.stroke }, encoded);
        if (savings.savingsPercent > 30) {
          logger.trace('SOCKET', 'MessagePack bandwidth savings', savings);
        }
      }
      
      // Broadcast binary data to other players
      socket.to(roomId).emit('draw:stroke:binary', encoded);
    });

    // Handle binary stroke data from clients (for clients that support it)
    socket.on('draw:stroke:binary', (buffer: Uint8Array) => {
      // Rate limiting
      if (!drawRateLimiter.canProceed(socket.id)) {
        return;
      }
      
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      try {
        // Decode binary message
        const decoded = decodeMessage<{ playerId: string; stroke: (string | number)[] }>(buffer);
        const stroke = expandStroke(decoded.stroke);
        
        const room = getRoom(roomId);
        if (room) {
          if (!room.canvasState) {
            room.canvasState = [];
          }
          room.canvasState.push(stroke);
        }
        
        // Forward to other players
        socket.to(roomId).emit('draw:stroke:binary', buffer);
      } catch (error) {
        logger.error('SOCKET', 'Failed to decode binary stroke', error as Error);
      }
    });


    // Chunked stroke transmission for live preview
    socket.on('draw:stroke:chunk', (data: { strokeId: string; points: any[]; tool: string; color: string; size: number }) => {
      // Rate limiting for chunks (more lenient)
      if (!drawRateLimiter.canProceed(socket.id)) {
        return;
      }
      
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      // Broadcast chunk to other players for live preview
      socket.to(roomId).emit('draw:stroke:chunk', { 
        playerId: socket.id, 
        strokeId: data.strokeId,
        points: data.points,
        tool: data.tool,
        color: data.color,
        size: data.size
      });
    });

    socket.on('draw:clear', () => {

      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      // Broadcast to ALL players including sender (so drawer sees canvas clear too)
      io.to(roomId).emit('draw:clear', { playerId: socket.id });
    });


    socket.on('draw:undo', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      socket.to(roomId).emit('draw:undo', { playerId: socket.id });
    });

    socket.on('draw:redo', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      socket.to(roomId).emit('draw:redo', { playerId: socket.id });
    });

    // Game events
    socket.on('guess:submit', (data: { guess: string }) => {
      logger.socketEvent('guess:submit', socket.id, { guess: data.guess });
      console.log('[guess:submit] Received from socket:', socket.id, 'guess:', data.guess);
      
      // Rate limiting
      if (!guessRateLimiter.canProceed(socket.id)) {
        logger.warn('SOCKET', 'Guess rate limit exceeded', { socketId: socket.id });
        console.log('[guess:submit] Rate limit exceeded for socket:', socket.id);
        socket.emit('chat:system', { message: 'Too many guesses. Please slow down.' });
        return;
      }

      
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) {
        console.log('[guess:submit] No room found for socket');
        return;
      }
      
      const room = getRoom(roomId);
      if (!room) {
        console.log('[guess:submit] Room not found:', roomId);
        return;
      }
      
      if (room.gameState.phase !== 'drawing') {
        console.log('[guess:submit] Not in drawing phase, current phase:', room.gameState.phase);
        return;
      }
      
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        console.log('[guess:submit] Player not found in room');
        return;
      }
      
      console.log('[guess:submit] Player found:', player.username, 'isDrawer:', player.isDrawer);
      
      // Don't allow drawer to guess (but allow in chat via chat:message)
      if (player.isDrawer) {
        console.log('[guess:submit] Drawer tried to guess, ignoring');
        return;
      }
      
      // Check if player already guessed correctly this round
      if (player.hasGuessedCorrectly) {
        console.log('[guess:submit] Player already guessed correctly this round');
        return;
      }
      
      // Validate guess
      if (!data.guess || data.guess.trim().length === 0) {
        console.log('[guess:submit] Empty guess, ignoring');
        return;
      }
      
      if (data.guess.length > 100) {
        console.log('[guess:submit] Guess too long, ignoring');
        socket.emit('chat:system', { message: 'Guess too long (max 100 characters)' });
        return;
      }
      
      // Check guess
      const guessLower = data.guess.toLowerCase().trim();
      const wordLower = room.gameState.currentWord.toLowerCase().trim();
      
      console.log('[guess:submit] Comparing guess:', guessLower, 'with word:', wordLower);

      
      if (guessLower === wordLower) {
        // Correct guess - mark player and award points immediately
        player.hasGuessedCorrectly = true;
        
        // Track guess order for scoring (first guesser gets more points)
        const guessOrder = room.players.filter(p => p.hasGuessedCorrectly && !p.isDrawer).length;
        
        // Calculate points immediately based on guess order and time remaining
        const basePoints = Math.max(100 - ((guessOrder - 1) * 10), 10); // First: 100, Second: 90, etc.
        const timeBonus = Math.floor(room.gameState.timeRemaining / 10);
        const totalPoints = basePoints + timeBonus;
        
        // Award points immediately
        player.score += totalPoints;
        
        logger.gameState(roomId, 'CORRECT_GUESS', { 
          playerId: player.id, 
          username: player.username, 
          guessOrder, 
          points: totalPoints,
          word: room.gameState.currentWord 
        });
        console.log('[guess:submit] CORRECT GUESS! Player:', player.username, 'Guess order:', guessOrder, 'Points:', totalPoints);

        
        // Emit chat message for correct guess
        io.to(roomId).emit('chat:message', { 
          playerId: 'system', 
          username: 'System', 
          message: `${player.username} guessed the word! (+${totalPoints} pts)`, 
          timestamp: new Date(),
          isCorrect: true
        });
        
        // Emit to ALL players in room with actual points and updated scores
        io.to(roomId).emit('game:guess-correct', {
          playerId: player.id, 
          username: player.username, 
          word: room.gameState.currentWord,
          points: totalPoints,
          scores: room.players.map(p => ({ playerId: p.id, score: p.score }))
        });
        
        // Also emit updated player list so everyone sees new scores
        io.to(roomId).emit('room:players-updated', { 
          players: room.players.map(p => ({ 
            id: p.id, 
            username: p.username, 
            avatarId: p.avatarId, 
            score: p.score, 
            isDrawer: p.isDrawer, 
            isHost: p.isHost 
          })) 
        });

        
        console.log('[guess:submit] guess-correct event emitted to room:', roomId);
        
        // Check if all non-drawer players have guessed correctly
        const nonDrawerPlayers = room.players.filter(p => !p.isDrawer);
        const allGuessedCorrectly = nonDrawerPlayers.every(p => p.hasGuessedCorrectly);
        
        if (allGuessedCorrectly) {
          logger.gameState(roomId, 'ALL_GUESSED_CORRECTLY', { roundEnding: true });
          console.log('[guess:submit] All players guessed correctly! Ending round early');
          // Clear the timer
          const timer = roomTimers.get(roomId);
          if (timer) {
            clearInterval(timer);
            roomTimers.delete(roomId);
          }
          // End round immediately - points will be awarded there
          endRound(room, io);
        }
      } else {
        logger.trace('SOCKET', 'Wrong guess', { playerId: player.id, guess: data.guess }, player.id);

        // Wrong guess - send to chat (broadcast to ALL including sender)
        console.log('[guess:submit] Wrong guess, broadcasting to all players in room:', roomId);
        io.to(roomId).emit('chat:message', { 
          playerId: player.id, 
          username: player.username, 
          message: data.guess, 
          timestamp: new Date() 
        });
        console.log('[guess:submit] Wrong guess broadcast complete');
      }
    });


    socket.on('hint:request', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      const room = getRoom(roomId);
      if (!room || room.gameState.hintsRemaining <= 0) return;
      
      room.gameState.hintsRemaining--;
      room.gameState.wordHints = generateHints(room.gameState.currentWord, 3 - room.gameState.hintsRemaining);
      
      io.to(roomId).emit('game:hint-update', { hints: room.gameState.wordHints, hintsRemaining: room.gameState.hintsRemaining });
    });

    socket.on('chat:message', (data: { message: string }) => {
      logger.socketEvent('chat:message', socket.id, { message: data.message });
      console.log('[chat:message] Received from socket:', socket.id, 'message:', data.message);
      
      // Rate limiting
      if (!chatRateLimiter.canProceed(socket.id)) {
        logger.warn('SOCKET', 'Chat rate limit exceeded', { socketId: socket.id });
        console.log('[chat:message] Rate limit exceeded for socket:', socket.id);
        socket.emit('chat:system', { message: 'Too many messages. Please slow down.' });
        return;
      }

      
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) {
        console.log('[chat:message] No room found for socket');
        return;
      }
      
      const room = getRoom(roomId);
      if (!room) {
        console.log('[chat:message] Room not found:', roomId);
        return;
      }
      
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        console.log('[chat:message] Player not found in room');
        return;
      }
      
      // Validate and censor message
      const messageValidation = validateMessage(data.message);
      if (!messageValidation.valid) {
        socket.emit('chat:system', { message: messageValidation.error });
        return;
      }
      
      const censoredMessage = messageValidation.censored || data.message;
      
      console.log('[chat:message] Broadcasting to ALL players in room:', roomId, 'from player:', player.username);
      
      // Broadcast to ALL players in room (including sender for consistency)
      // The client will handle deduplication
      io.to(roomId).emit('chat:message', { 
        playerId: player.id, 
        username: player.username, 
        message: censoredMessage, 
        timestamp: new Date() 
      });
      
      console.log('[chat:message] Broadcast complete to all players');
    });


    socket.on('room:update-settings', (data: { roomId: string; settings: Partial<RoomSettings> & { maxPlayers?: number } }) => {
      console.log('[room:update-settings] Received:', data);
      
      // Use roomId from the payload
      const roomId = data.roomId;
      if (!roomId) {
        console.log('[room:update-settings] No roomId provided in data');
        return;
      }

      
      const room = getRoom(roomId);
      if (!room) {
        console.log('[room:update-settings] Room not found:', roomId);
        return;
      }
      
      // Verify the sender is in the room and is the host
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        console.log('[room:update-settings] Player not found in room');
        socket.emit('room:error', { message: 'You are not in this room' });
        return;
      }
      
      if (!player.isHost) {
        console.log('[room:update-settings] Only host can update settings');
        socket.emit('room:error', { message: 'Only host can update settings' });
        return;
      }

      
      // Update settings
      if (data.settings.roundTime !== undefined) {
        room.settings.roundTime = Math.max(30, Math.min(300, data.settings.roundTime));
        room.gameState.timeRemaining = room.settings.roundTime;
      }
      
      if (data.settings.rounds !== undefined) {
        room.settings.rounds = Math.max(1, Math.min(20, data.settings.rounds));
        room.gameState.totalRounds = room.settings.rounds;
      }
      
      if (data.settings.maxPlayers !== undefined) {
        room.maxPlayers = Math.max(2, Math.min(16, data.settings.maxPlayers));
      }
      
      if (data.settings.hints !== undefined) {
        room.settings.hints = Math.max(0, Math.min(5, data.settings.hints));
        room.gameState.hintsRemaining = room.settings.hints;
      }
      
      if (data.settings.categories !== undefined) {
        room.settings.categories = data.settings.categories.slice(0, 10);
      }
      
      if (data.settings.gameMode !== undefined) {
        room.settings.gameMode = data.settings.gameMode;
      }
      
      if (data.settings.wordCount !== undefined) {
        room.settings.wordCount = Math.max(1, Math.min(5, data.settings.wordCount));
      }
      
      if (data.settings.language !== undefined) {
        room.settings.language = data.settings.language;
      }

      
      console.log('[room:update-settings] Settings updated:', {
        roundTime: room.settings.roundTime,
        rounds: room.settings.rounds,
        maxPlayers: room.maxPlayers,
        hints: room.settings.hints,
        categories: room.settings.categories.length,
        gameMode: room.settings.gameMode
      });

      
      // Notify all players in the room
      io.to(roomId).emit('room:settings-updated', {
        settings: room.settings,
        maxPlayers: room.maxPlayers
      });
      
      // Also emit updated player list to refresh UI
      io.to(roomId).emit('room:players-updated', { 
        players: room.players.map(p => ({ 
          id: p.id, 
          username: p.username, 
          avatarId: p.avatarId, 
          score: p.score, 
          isDrawer: p.isDrawer, 
          isHost: p.isHost 
        })) 
      });
    });

    socket.on('game:play-again', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      const room = getRoom(roomId);
      if (!room) return;
      
      // Reset game state
      room.gameState = {
        phase: 'lobby',
        currentRound: 1,
        currentTurn: 1,
        currentDrawerIndex: -1,
        currentWord: '',
        wordHints: [],
        hintsRemaining: 3,
        timeRemaining: 0,
        totalRounds: room.settings.rounds,
        totalTurns: room.players.length * room.settings.rounds,
        drawnPlayerIds: [], // Reset - no one has drawn in new game
      };


      
      // Reset player scores and flags
      room.players.forEach(p => {
        p.score = 0;
        p.isDrawer = false;
      });
      
      io.to(roomId).emit('game:reset', { room: {
        id: room.id,
        name: room.name,
        players: room.players.map(p => ({
          id: p.id,
          username: p.username,
          avatarId: p.avatarId,
          score: p.score,
          isDrawer: p.isDrawer,
          isHost: p.isHost
        })),
        maxPlayers: room.maxPlayers,
        settings: room.settings
      }});
    });


    socket.on('disconnect', () => {
      logger.socketEvent('disconnect', socket.id, { timestamp: new Date().toISOString() });
      console.log('[Socket] Client disconnected:', socket.id);
      handlePlayerLeave(socket, io, false); // false = disconnect (grace period)
    });
  });
}


function handlePlayerLeave(socket: Socket, io: Server, isIntentional: boolean = false) {
  logger.socketEvent('player:leave', socket.id, { intentional: isIntentional });
  console.log('[handlePlayerLeave] Socket leaving:', socket.id, 'intentional:', isIntentional);
  
  const roomId = socketToRoom.get(socket.id);
  if (!roomId) {
    logger.trace('SOCKET', 'Leave failed: No room found for socket', { socketId: socket.id });
    console.log('[handlePlayerLeave] No room found for socket');
    return;
  }

  
  const room = getRoom(roomId);
  if (!room) {
    console.log('[handlePlayerLeave] Room not found:', roomId);
    socketToRoom.delete(socket.id);
    return;
  }
  
  const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
  if (playerIndex === -1) {
    console.log('[handlePlayerLeave] Player not found in room');
    socketToRoom.delete(socket.id);
    return;
  }
  
  const player = room.players[playerIndex];
  const wasHost = player.isHost;
  const wasDrawer = player.isDrawer;
  const playerId = player.id;
  
  logger.userAction(playerId, 'PLAYER_LEAVE', { 
    username: player.username, 
    isHost: wasHost, 
    isDrawer: wasDrawer, 
    intentional: isIntentional,
    roomId 
  });
  console.log('[handlePlayerLeave] Player found:', player.username, 'isHost:', wasHost, 'isDrawer:', wasDrawer, 'index:', playerIndex);

  
  // If intentional leave, remove player immediately (no grace period)
  if (isIntentional) {
    logger.info('SOCKET', 'Intentional leave - removing player immediately', { playerId, username: player.username });
    console.log('[handlePlayerLeave] Intentional leave - removing player immediately:', player.username);

    
    // Remove player from room immediately
    room.players.splice(playerIndex, 1);
    
    // If host left and there are remaining players, promote next player to host
    if (wasHost && room.players.length > 0) {
      const newHost = room.players[0];
      newHost.isHost = true;
      console.log('[handlePlayerLeave] HOST LEFT - promoting new host:', newHost.username, 'ID:', newHost.id);
      
      io.to(roomId).emit('room:host-changed', { 
        newHostId: newHost.id, 
        newHostName: newHost.username 
      });
    }
    
    // Notify others
    io.to(roomId).emit('room:player-left', { 
      playerId: playerId,
      username: player.username
    });
    io.emit('room:updated');
    
    // Clean up socket mapping
    socket.leave(roomId);
    socketToRoom.delete(socket.id);
    
    // If room is empty, schedule deletion
    if (room.players.length === 0) {
      const existingTimeout = roomsPendingDeletion.get(roomId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      console.log('[handlePlayerLeave] Room empty after intentional leave, scheduling deletion in 30s:', roomId);
      const timeout = setTimeout(() => {
        const checkRoom = getRoom(roomId);
        if (checkRoom && checkRoom.players.length === 0) {
          console.log('[handlePlayerLeave] Deleting empty room after grace period:', roomId);
          deleteRoom(roomId);
          io.emit('room:updated');
        }
        roomsPendingDeletion.delete(roomId);
      }, 30000);
      
      roomsPendingDeletion.set(roomId, timeout);
    }
    
    return; // Early return - intentional leave handled
  }
  
  // Store enhanced disconnection data (for disconnect grace period)
  player.disconnected = true;
  player.disconnectedAt = Date.now();
  player.wasDrawing = wasDrawer;
  player.scoreBeforeDisconnect = player.score;
  
  // Track rounds present (for scoring)
  if (!player.roundsPresent) {
    player.roundsPresent = [];
  }
  if (room.gameState.phase === 'drawing' || room.gameState.phase === 'selection') {
    player.roundsPresent.push(room.gameState.currentRound);
  }
  
  console.log('[handlePlayerLeave] Marked player as disconnected:', player.username, 'at:', player.disconnectedAt);

  
  // SPECIAL HANDLING FOR DRAWER DISCONNECTION
  if (wasDrawer && room.gameState.phase === 'drawing') {
    logger.gameState(roomId, 'DRAWER_DISCONNECTED', { playerId, username: player.username });
    console.log('[handlePlayerLeave] DRAWER DISCONNECTED - pausing round:', player.username);

    
    // Pause the round timer
    const timer = roomTimers.get(roomId);
    if (timer) {
      clearInterval(timer);
      roomTimers.delete(roomId);
    }
    
    // Store drawer disconnection state
    drawerDisconnectionState.set(roomId, {
      disconnectedAt: Date.now(),
      pausedTimer: null,
      drawingData: player.drawingData
    });
    
    // Notify all players that drawer disconnected and round is paused
    io.to(roomId).emit('game:drawer-disconnected', {
      playerId: playerId,
      username: player.username,
      message: `${player.username} disconnected! Round paused. Waiting for reconnection...`,
      reconnectWindow: RECONNECT_WINDOW_DRAWER
    });
    
    // Set timeout to end round if drawer doesn't return
    const drawerTimeout = setTimeout(() => {
      const currentRoom = getRoom(roomId);
      if (!currentRoom) {
        drawerDisconnectionState.delete(roomId);
        return;
      }
      
      const currentPlayer = currentRoom.players.find(p => p.id === playerId);
      
      // Check if drawer reconnected
      if (currentPlayer && !currentPlayer.disconnected) {
        console.log('[handlePlayerLeave] Drawer reconnected within window:', currentPlayer.username);
        drawerDisconnectionState.delete(roomId);
        return;
      }
      
      // Drawer didn't reconnect - cancel the round
      console.log('[handlePlayerLeave] Drawer did not reconnect, cancelling round');
      drawerDisconnectionState.delete(roomId);
      
      // Mark this round as AFK for the drawer
      io.to(roomId).emit('game:round-cancelled', {
        reason: 'drawer-disconnected',
        message: `${player.username} did not return. Round cancelled - no points awarded.`,
        afkPlayerId: playerId
      });
      
      // Remove the drawer from the room
      const drawerIndex = currentRoom.players.findIndex(p => p.id === playerId);
      if (drawerIndex !== -1) {
        currentRoom.players.splice(drawerIndex, 1);
      }
      
      // If room still has players, continue to next round
      if (currentRoom.players.length > 0) {
        // Promote new host if needed
        if (wasHost && currentRoom.players.length > 0) {
          currentRoom.players[0].isHost = true;
        }
        
        // Move to next round
        setTimeout(() => {
          if (currentRoom.gameState.currentRound >= currentRoom.settings.rounds) {
            endGame(currentRoom, io);
          } else {
            currentRoom.gameState.currentRound++;
            currentRoom.gameState.phase = 'selection';
            io.to(roomId).emit('game:starting', { 
              round: currentRoom.gameState.currentRound, 
              totalRounds: currentRoom.settings.rounds 
            });
            startWordSelection(currentRoom, io);
          }
        }, 3000);
      }
      
      io.to(roomId).emit('room:players-updated', {
        players: currentRoom.players.map(p => ({
          id: p.id,
          username: p.username,
          avatarId: p.avatarId,
          score: p.score,
          isDrawer: p.isDrawer,
          isHost: p.isHost
        }))
      });
      io.emit('room:updated');
      
    }, RECONNECT_WINDOW_DRAWER);
    
    // Store the timeout in the disconnection state
    const state = drawerDisconnectionState.get(roomId);
    if (state) {
      state.pausedTimer = drawerTimeout;
    }
    
    socket.leave(roomId);
    socketToRoom.delete(socket.id);
    return; // Early return for drawer - special handling above
  }
  
  // NORMAL PLAYER DISCONNECTION (non-drawer)
  // Notify others that player disconnected (but still in grace period)
  io.to(roomId).emit('room:player-disconnected', { 
    playerId: playerId,
    username: player.username,
    message: `${player.username} disconnected (reconnecting...)`,
    reconnectWindow: RECONNECT_WINDOW_NORMAL
  });
  io.emit('room:updated');
  
  // Don't remove player immediately - give grace period for reconnection
  socket.leave(roomId);
  socketToRoom.delete(socket.id);
  
  // Clear any existing pending removal for this player
  const existingRemovalTimeout = playersPendingRemoval.get(playerId);
  if (existingRemovalTimeout) {
    clearTimeout(existingRemovalTimeout);
  }
  
  // Schedule player removal after grace period (60 seconds for reconnection)
  console.log('[handlePlayerLeave] Scheduling player removal in 60s:', player.username);
  const removalTimeout = setTimeout(() => {
    // Check if player has reconnected
    const currentRoom = getRoom(roomId);
    if (!currentRoom) {
      playersPendingRemoval.delete(playerId);
      return;
    }
    
    const currentPlayerIndex = currentRoom.players.findIndex(p => p.id === playerId);
    if (currentPlayerIndex === -1) {
      // Player already removed (shouldn't happen)
      playersPendingRemoval.delete(playerId);
      return;
    }
    
    const currentPlayer = currentRoom.players[currentPlayerIndex];
    
    // If player reconnected (socket ID changed or disconnected flag cleared)
    if (!currentPlayer.disconnected || currentPlayer.socketId !== socket.id) {
      console.log('[handlePlayerLeave] Player reconnected, not removing:', currentPlayer.username);
      currentPlayer.disconnected = false;
      playersPendingRemoval.delete(playerId);
      return;
    }
    
    // Player didn't reconnect - remove them
    console.log('[handlePlayerLeave] Grace period expired, removing player:', currentPlayer.username);
    currentRoom.players.splice(currentPlayerIndex, 1);
    
    // If host left and there are remaining players, promote next player to host
    if (wasHost && currentRoom.players.length > 0) {
      const newHost = currentRoom.players[0];
      newHost.isHost = true;
      console.log('[handlePlayerLeave] HOST LEFT - promoting new host:', newHost.username, 'ID:', newHost.id);
      
      io.to(roomId).emit('room:host-changed', { 
        newHostId: newHost.id, 
        newHostName: newHost.username 
      });
    }
    
    // Notify others - only send to connected players
    io.to(roomId).emit('room:player-left', { 
      playerId: playerId,
      username: player.username,
      wasAfk: true,
      roundsPresent: currentPlayer.roundsPresent || []
    });
    io.emit('room:updated');
    
    // If room has no connected players, schedule deletion
    const connectedPlayers = currentRoom.players.filter(p => !p.disconnected).length;
    if (connectedPlayers === 0) {
      const existingTimeout = roomsPendingDeletion.get(roomId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }
      
      console.log('[handlePlayerLeave] Room empty, scheduling deletion in 30s:', roomId);
      const timeout = setTimeout(() => {
        const checkRoom = getRoom(roomId);
        if (checkRoom && checkRoom.players.length === 0) {
          console.log('[handlePlayerLeave] Deleting empty room after grace period:', roomId);
          deleteRoom(roomId);
          io.emit('room:updated');
        }
        roomsPendingDeletion.delete(roomId);
      }, 30000);
      
      roomsPendingDeletion.set(roomId, timeout);
    }
    
    playersPendingRemoval.delete(playerId);
  }, RECONNECT_WINDOW_NORMAL); // 60 second grace period for reconnection
  
  playersPendingRemoval.set(playerId, removalTimeout);
}

// Resume round timer after drawer reconnection
function resumeRoundTimer(room: Room, io: Server) {
  const roomId = room.id;
  
  // Clear any existing timer
  const existingTimer = roomTimers.get(roomId);
  if (existingTimer) {
    clearInterval(existingTimer);
  }
  
  // Start new timer
  const timer = setInterval(() => {
    room.gameState.timeRemaining--;
    io.to(roomId).emit('game:timer-update', { timeRemaining: room.gameState.timeRemaining });
    
    if (room.gameState.timeRemaining <= 0) {
      clearInterval(timer);
      roomTimers.delete(roomId);
      endRound(room, io);
    }
  }, 1000);
  
  roomTimers.set(roomId, timer);
}

// Word selection timer (shorter than draw time)
const wordSelectionTimers = new Map<string, NodeJS.Timeout>();
const wordSelectionCountdowns = new Map<string, NodeJS.Timeout>();

function startWordSelection(room: Room, io: Server) {
  // Clear any existing timers
  const existingTimer = roomTimers.get(room.id);
  if (existingTimer) {
    clearInterval(existingTimer);
    roomTimers.delete(room.id);
  }
  
  const wordSelectTimer = wordSelectionTimers.get(room.id);
  if (wordSelectTimer) {
    clearTimeout(wordSelectTimer);
    wordSelectionTimers.delete(room.id);
  }
  
  const existingCountdown = wordSelectionCountdowns.get(room.id);
  if (existingCountdown) {
    clearInterval(existingCountdown);
    wordSelectionCountdowns.delete(room.id);
  }
  
  // Clear canvas state for new round/drawer
  room.canvasState = [];
  io.to(room.id).emit('draw:clear');
  console.log('[startWordSelection] Canvas cleared for new drawer');

  // DRAWER ROTATION SYSTEM: Track who has drawn this round
  // Get list of players who haven't drawn yet in this round
  const availableDrawers = room.players.filter(p => !room.gameState.drawnPlayerIds.includes(p.id));
  
  let drawer: Player;
  
  if (availableDrawers.length === 0) {
    // All players have drawn - reset for next round
    room.gameState.drawnPlayerIds = [];
    console.log('[startWordSelection] All players have drawn, resetting drawer tracking for new round');
    
    // Select first player for new round
    room.gameState.currentDrawerIndex = 0;
    drawer = room.players[0];
  } else {
    // Select next available drawer (first player who hasn't drawn)
    // Find the index of the first available drawer
    const nextDrawerIndex = room.players.findIndex(p => p.id === availableDrawers[0].id);
    room.gameState.currentDrawerIndex = nextDrawerIndex;
    drawer = availableDrawers[0];
  }
  
  // Mark this player as having drawn
  room.gameState.drawnPlayerIds.push(drawer.id);
  
  // Reset drawer flags and set new drawer
  room.players.forEach(p => p.isDrawer = false);
  drawer.isDrawer = true;
  
  console.log('[startWordSelection] Drawer selected:', drawer.username, 'ID:', drawer.id, 'Drawn this round:', room.gameState.drawnPlayerIds.length, '/', room.players.length);


  
  // Generate 5 word options for drawer
  const wordOptions = generateWordOptions(5);
  
  // Store selection time remaining
  let selectionTimeRemaining = 15;
  
  // Emit drawer change with word options
  io.to(room.id).emit('game:word-selection', { 
    drawer: { 
      id: drawer.id, 
      username: drawer.username,
      avatarId: drawer.avatarId,
      isHost: drawer.isHost
    },
    wordOptions: wordOptions,
    selectionTime: selectionTimeRemaining
  });
  
  // Also emit updated player list so UI shows drawer indicator
  io.to(room.id).emit('room:players-updated', { 
    players: room.players.map(p => ({ 
      id: p.id, 
      username: p.username, 
      avatarId: p.avatarId, 
      score: p.score, 
      isDrawer: p.isDrawer, 
      isHost: p.isHost 
    })) 
  });
  
  // Start countdown timer to broadcast remaining time every second
  const countdownTimer = setInterval(() => {
    selectionTimeRemaining--;
    io.to(room.id).emit('game:selection-timer', { timeRemaining: selectionTimeRemaining });
    
    if (selectionTimeRemaining <= 0) {
      clearInterval(countdownTimer);
      wordSelectionCountdowns.delete(room.id);
    }
  }, 1000);
  
  wordSelectionCountdowns.set(room.id, countdownTimer);
  
  // Start word selection timer (15 seconds)
  const selectionTimer = setTimeout(() => {
    wordSelectionTimers.delete(room.id);
    // If drawer didn't select, auto-select first word
    const selectedWord = wordOptions[0];
    room.gameState.currentWord = selectedWord;
    console.log('[startWordSelection] Time up! Auto-selected word:', selectedWord);
    startDrawingPhase(room, io);
  }, 15000); // 15 seconds
  
  wordSelectionTimers.set(room.id, selectionTimer);
}

function startDrawingPhase(room: Room, io: Server) {
  // Clear word selection timer if still running
  const wordSelectTimer = wordSelectionTimers.get(room.id);
  if (wordSelectTimer) {
    clearTimeout(wordSelectTimer);
    wordSelectionTimers.delete(room.id);
  }
  
  // Clear any existing hint timers
  const existingHintTimers = roomHintTimers.get(room.id);
  if (existingHintTimers) {
    existingHintTimers.forEach(timer => clearTimeout(timer));
    roomHintTimers.delete(room.id);
  }
  
  // Reset hasGuessedCorrectly flag for all players
  room.players.forEach(p => {
    p.hasGuessedCorrectly = false;
  });
  
  // Set phase to drawing
  room.gameState.phase = 'drawing';
  
  room.gameState.wordHints = new Array(room.gameState.currentWord.length).fill('_');
  room.gameState.hintsRemaining = room.settings.hints || 3;
  room.gameState.timeRemaining = room.settings.roundTime;
  
  const drawer = room.players[room.gameState.currentDrawerIndex];
  
  // Broadcast phase change to all clients FIRST
  io.to(room.id).emit('PHASE_CHANGE', {
    phase: 'drawing',
    drawerId: drawer?.id,
    wordLength: room.gameState.currentWord.length,
    round: room.gameState.currentRound
  });
  
  // Emit to DRAWER with full word
  io.to(drawer.socketId).emit('game:word-selected', { 
    word: room.gameState.currentWord, 
    blanks: room.gameState.wordHints.join(' '), 
    hints: room.gameState.hintsRemaining,
    drawTime: room.settings.roundTime,
    isDrawer: true
  });
  
  // Emit to ALL OTHER PLAYERS with blanks only
  // Use io.except() to exclude the drawer
  io.except(drawer.socketId).emit('game:word-selected', { 
    word: room.gameState.currentWord, 
    blanks: room.gameState.wordHints.join(' '), 
    hints: room.gameState.hintsRemaining,
    drawTime: room.settings.roundTime,
    isDrawer: false
  });



  // Set up automatic hint revelation
  const hintsCount = room.settings.hints || 3;
  const roundTime = room.settings.roundTime;
  const hintTimers: NodeJS.Timeout[] = [];
  
  if (hintsCount > 0 && room.gameState.currentWord.length > 0) {
    // Calculate intervals for hint revelation
    // Distribute hints evenly throughout the round (excluding first and last 10 seconds)
    const usableTime = Math.max(roundTime - 20, roundTime * 0.5); // At least 50% of round time
    const intervalBetweenHints = usableTime / (hintsCount + 1);
    
    console.log(`[startDrawingPhase] Setting up ${hintsCount} automatic hints for word "${room.gameState.currentWord}"`);
    console.log(`[startDrawingPhase] Round time: ${roundTime}s, interval: ${intervalBetweenHints.toFixed(1)}s`);
    
    for (let i = 0; i < hintsCount; i++) {
      const hintDelay = 10000 + (intervalBetweenHints * 1000 * (i + 1)); // Start after 10s, then intervals
      
      const hintTimer = setTimeout(() => {
        // Only reveal hint if still in drawing phase
        if (room.gameState.phase !== 'drawing') {
          console.log(`[autoHint] Skipping hint ${i + 1} - not in drawing phase`);
          return;
        }
        
        // Generate and reveal a new hint
        const word = room.gameState.currentWord;
        const hiddenIndices: number[] = [];
        
        // Find indices that are still hidden
        for (let j = 0; j < word.length; j++) {
          if (room.gameState.wordHints[j] === '_') {
            hiddenIndices.push(j);
          }
        }
        
        if (hiddenIndices.length === 0) {
          console.log(`[autoHint] No more hidden characters to reveal`);
          return;
        }
        
        // Randomly select one hidden character to reveal
        const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
        room.gameState.wordHints[randomIndex] = word[randomIndex];
        room.gameState.hintsRemaining--;
        
        console.log(`[autoHint] Revealed character at position ${randomIndex}: "${word[randomIndex]}"`);
        console.log(`[autoHint] Current hints: ${room.gameState.wordHints.join(' ')}, remaining: ${room.gameState.hintsRemaining}`);
        
        // Broadcast hint update to all players
        io.to(room.id).emit('game:hint-update', { 
          hints: room.gameState.wordHints, 
          hintsRemaining: room.gameState.hintsRemaining 
        });
        
        // Also emit a system message about the hint
        io.to(room.id).emit('chat:message', {
          playerId: 'system',
          username: 'System',
          message: `💡 Hint revealed! The word now shows: ${room.gameState.wordHints.join(' ')}`,
          timestamp: new Date(),
          isSystem: true
        });
        
      }, hintDelay);
      
      hintTimers.push(hintTimer);
      console.log(`[startDrawingPhase] Scheduled hint ${i + 1} at ${(hintDelay / 1000).toFixed(1)}s`);
    }
    
    roomHintTimers.set(room.id, hintTimers);
  }
  
  // Start draw timer and store reference
  const timer = setInterval(() => {
    room.gameState.timeRemaining--;
    io.to(room.id).emit('game:timer-update', { timeRemaining: room.gameState.timeRemaining });
    
    if (room.gameState.timeRemaining <= 0) {
      clearInterval(timer);
      roomTimers.delete(room.id);
      endTurn(room, io);
    }

  }, 1000);
  
  roomTimers.set(room.id, timer);
}


function startNewRound(room: Room, io: Server) {
  // Start word selection for next drawer
  startWordSelection(room, io);
}

function endTurn(room: Room, io: Server) {
  // Clear timer if still running
  const timer = roomTimers.get(room.id);
  if (timer) {
    clearInterval(timer);
    roomTimers.delete(room.id);
  }
  
  // Clear hint timers
  const hintTimers = roomHintTimers.get(room.id);
  if (hintTimers) {
    hintTimers.forEach(t => clearTimeout(t));
    roomHintTimers.delete(room.id);
  }

  // Clear canvas state and notify clients
  room.canvasState = [];
  io.to(room.id).emit('game:round:end');

  room.gameState.phase = 'turnEnd';

  
  // Broadcast phase change to all clients
  io.to(room.id).emit('PHASE_CHANGE', {
    phase: 'turnEnd',
    round: room.gameState.currentRound,
    word: room.gameState.currentWord
  });
  
  // Calculate and award points based on guess order
  const correctGuessers = room.players.filter(p => p.hasGuessedCorrectly && !p.isDrawer);
  const timeRemaining = room.gameState.timeRemaining;
  
  correctGuessers.forEach((player, index) => {
    const basePoints = Math.max(100 - (index * 10), 10);
    const timeBonus = Math.floor(timeRemaining / 10);
    const totalPoints = basePoints + timeBonus;
    player.score += totalPoints;
    console.log(`[endTurn] Awarded ${totalPoints} points to ${player.username}`);
  });
  
  // Emit turn end with results
  io.to(room.id).emit('game:turn-end', { 
    word: room.gameState.currentWord, 
    scores: room.players.map(p => ({ playerId: p.id, score: p.score })),
    turnPoints: correctGuessers.map((p, index) => ({
      playerId: p.id,
      username: p.username,
      points: Math.max(100 - (index * 10), 10) + Math.floor(timeRemaining / 10),
      position: index + 1
    }))
  });

  // Check if round is complete (all players have drawn)
  const isRoundComplete = room.gameState.currentTurn >= room.players.length;
  
  if (isRoundComplete) {
    // Round complete - show round scoreboard
    console.log(`[endTurn] Round ${room.gameState.currentRound} complete!`);
    setTimeout(() => {
      endRound(room, io);
    }, 3000);
  } else {
    // Continue to next turn in same round
    room.gameState.currentTurn++;
    console.log(`[endTurn] Starting turn ${room.gameState.currentTurn} of round ${room.gameState.currentRound}`);
    
    setTimeout(() => {
      room.gameState.phase = 'selection';
      io.to(room.id).emit('game:starting', { 
        round: room.gameState.currentRound, 
        turn: room.gameState.currentTurn,
        totalRounds: room.settings.rounds 
      });
      
      io.to(room.id).emit('PHASE_CHANGE', {
        phase: 'selection',
        round: room.gameState.currentRound,
        turn: room.gameState.currentTurn,
        totalRounds: room.settings.rounds,
        drawerId: room.players[room.gameState.currentDrawerIndex]?.id
      });
      
      startWordSelection(room, io);
    }, 3000);
  }
}

function endRound(room: Room, io: Server) {

  // Clear timer if still running
  const timer = roomTimers.get(room.id);
  if (timer) {
    clearInterval(timer);
    roomTimers.delete(room.id);
  }
  
  // Clear hint timers
  const hintTimers = roomHintTimers.get(room.id);
  if (hintTimers) {
    hintTimers.forEach(t => clearTimeout(t));
    roomHintTimers.delete(room.id);
  }

  // Clear canvas state and notify clients
  room.canvasState = [];
  io.to(room.id).emit('game:round:end');

  // Reset drawer tracking for the round that just ended
  room.gameState.drawnPlayerIds = [];
  console.log(`[endRound] Round ${room.gameState.currentRound} ended - reset drawer tracking`);
  
  room.gameState.phase = 'roundEnd';


  
  // Broadcast phase change to all clients
  io.to(room.id).emit('PHASE_CHANGE', {
    phase: 'roundEnd',
    round: room.gameState.currentRound,
    word: room.gameState.currentWord
  });
  
  // Calculate and award points based on guess order

  // First correct guess gets 100 + time bonus, second gets 90, third gets 80, etc.
  const correctGuessers = room.players.filter(p => p.hasGuessedCorrectly && !p.isDrawer);
  const timeRemaining = room.gameState.timeRemaining;
  
  correctGuessers.forEach((player, index) => {
    const basePoints = Math.max(100 - (index * 10), 10); // First: 100, Second: 90, Third: 80...
    const timeBonus = Math.floor(timeRemaining / 10);
    const totalPoints = basePoints + timeBonus;
    player.score += totalPoints;
    console.log(`[endRound] Awarded ${totalPoints} points to ${player.username} (base: ${basePoints}, time bonus: ${timeBonus})`);
  });
  
  // If no one guessed correctly, drawer gets penalty or no points
  const drawer = room.players.find(p => p.isDrawer);
  if (drawer && correctGuessers.length === 0) {
    console.log(`[endRound] No one guessed correctly - drawer ${drawer.username} gets no points`);
  }
  
  io.to(room.id).emit('game:round-end', { 
    word: room.gameState.currentWord, 
    scores: room.players.map(p => ({ playerId: p.id, score: p.score })),
    roundPoints: correctGuessers.map((p, index) => ({
      playerId: p.id,
      username: p.username,
      points: Math.max(100 - (index * 10), 10) + Math.floor(timeRemaining / 10),
      position: index + 1
    }))
  });

  
  // Check if game should end
  if (room.gameState.currentRound >= room.settings.rounds) {
    endGame(room, io);
  } else {
    // Start next round after delay
    room.gameState.currentRound++;
    room.gameState.phase = 'selection';
    io.to(room.id).emit('game:starting', { round: room.gameState.currentRound, totalRounds: room.settings.rounds });
    
    // Broadcast phase change to all clients
    io.to(room.id).emit('PHASE_CHANGE', {
      phase: 'selection',
      round: room.gameState.currentRound,
      totalRounds: room.settings.rounds,
      drawerId: room.players[room.gameState.currentDrawerIndex]?.id
    });
    
    setTimeout(() => {
      startNewRound(room, io);
    }, 5000);
  }

}

async function endGame(room: Room, io: Server) {
  room.gameState.phase = 'gameEnd';
  logger.gameState(room.id, 'GAME_ENDED', { 
    round: room.gameState.currentRound, 
    finalScores: room.players.map(p => ({ id: p.id, username: p.username, score: p.score }))
  });
  
  // Broadcast phase change to all clients
  io.to(room.id).emit('PHASE_CHANGE', {
    phase: 'gameEnd',
    round: room.gameState.currentRound,
    totalRounds: room.settings.rounds
  });

  
  const rankings = room.players

    .map(p => ({ playerId: p.id, username: p.username, score: p.score, avatarId: p.avatarId }))
    .sort((a, b) => b.score - a.score);
  
  // Track match duration
  const matchDuration = Math.floor((Date.now() - room.createdAt.getTime()) / 60000);
  
    // Award XP and save stats for all players
    for (const player of room.players) {
      const position = rankings.findIndex(r => r.playerId === player.id);
      const isWinner = position === 0;
      const xpGained = Math.max(10, 100 - (position * 20));
      
      logger.userAction(player.id, 'GAME_END_STATS', { 
        username: player.username, 
        position: position + 1, 
        score: player.score, 
        xpGained, 
        isWinner 
      });
      console.log(`[endGame] Player ${player.username} gained ${xpGained} XP, position: ${position + 1}`);

    
    // Get current stats
    const currentStats = await getPlayerStats(player.id);
    
    // Update player stats
    const newStats = {
      gamesPlayed: currentStats.gamesPlayed + 1,
      gamesWon: currentStats.gamesWon + (isWinner ? 1 : 0),
      totalScore: currentStats.totalScore + player.score,
      totalPlayTime: currentStats.totalPlayTime + matchDuration,
      currentStreak: isWinner ? currentStats.currentStreak + 1 : 0,
      bestStreak: Math.max(currentStats.bestStreak, isWinner ? currentStats.currentStreak + 1 : 0),
      lastPlayedAt: new Date().toISOString()
    };
    
    await updatePlayerStats(player.id, newStats);
    
    // Add to match history
    await addMatchHistory(player.id, {
      roomName: room.name,
      players: room.players.length,
      score: player.score,
      placement: position + 1,
      wordsDrawn: player.isDrawer ? 1 : 0, // Simplified - track actual words drawn
      wordsGuessed: 0, // Would need to track during game
      xpGained: xpGained,
      duration: matchDuration
    });
  }

  
  io.to(room.id).emit('game:end', { 
    finalScores: room.players.map(p => ({ playerId: p.id, username: p.username, score: p.score, avatarId: p.avatarId })),
    rankings,
    playAgain: true
  });
}
