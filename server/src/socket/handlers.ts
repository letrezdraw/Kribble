import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { getWordsByCategory, addMatchHistory, updatePlayerStats, incrementPlayerStat, getPlayerStats } from '../db/index.js';
import { rooms, getRoom, deleteRoom, createRoom, Room, Player, RoomSettings, GameState } from '../data/rooms.js';
import { guessRateLimiter, chatRateLimiter, drawRateLimiter } from '../utils/rateLimiter.js';
import { validateMessage, validateUsername } from '../utils/profanityFilter.js';


// Socket to room mapping
const socketToRoom: Map<string, string> = new Map();

// Track active timers per room
const roomTimers = new Map<string, NodeJS.Timeout>();


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
    console.log('[Socket] Client connected:', socket.id);

    // Debug: Log all incoming events
    socket.onAny((eventName, ...args) => {
      console.log(`[Socket ${socket.id}] Event: ${eventName}`, args);
    });

    // Room management
    socket.on('room:create', (data: { name: string; settings: Partial<RoomSettings>; username?: string; userId?: string }) => {
      console.log('[room:create] Creating room:', data.name, 'username:', data.username, 'userId:', data.userId);
      
      // Validate username
      const usernameValidation = validateUsername(data.username || 'Player1');
      if (!usernameValidation.valid) {
        socket.emit('room:error', { message: usernameValidation.error });
        return;
      }
      
      // Check if socket is already in a room - leave it first
      const existingRoomId = socketToRoom.get(socket.id);
      if (existingRoomId) {
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
      console.log('[room:join] Attempting to join room:', data.roomId, 'username:', data.username, 'userId:', data.userId, 'joinByCode:', data.joinByCode);

      // Validate username if provided
      if (data.username) {
        const usernameValidation = validateUsername(data.username);
        if (!usernameValidation.valid) {
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
        console.log('[room:join] Room not found:', data.roomId);
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      // Check if player is already in the room (by socket ID or user ID)
      const existingPlayer = room.players.find(p => p.socketId === socket.id || (data.userId && p.id === data.userId));
      if (existingPlayer) {
        console.log('[room:join] Player already in room (rejoining):', existingPlayer.id);
        // Update socket ID in case it changed
        existingPlayer.socketId = socket.id;
        socketToRoom.set(socket.id, data.roomId);
        socket.join(data.roomId);
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
          console.log('[room:join] Incorrect password for room:', data.roomId);
          socket.emit('room:error', { message: 'Incorrect password' });
          return;
        }
      }


      
      if (room.players.length >= room.maxPlayers) {
        console.log('[room:join] Room is full:', data.roomId);
        socket.emit('room:error', { message: 'Room is full' });
        return;
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
      console.log('[room:join] Added player:', player.id, 'Total players:', room.players.length);
      
      socket.join(data.roomId);
      socketToRoom.set(socket.id, data.roomId);
      
      // Notify player
      socket.emit('room:joined', { 
        room: { 
          id: room.id, 
          name: room.name, 
          players: room.players.map(p => ({ id: p.id, username: p.username, avatarId: p.avatarId, score: p.score, isDrawer: p.isDrawer, isHost: p.isHost })),
          maxPlayers: room.maxPlayers, 
          settings: room.settings 
        },
        currentPlayerId: player.id
      });
      
      // Notify others
      socket.to(data.roomId).emit('room:player-joined', { player: { id: player.id, username: player.username, avatarId: player.avatarId, score: player.score, isDrawer: player.isDrawer, isHost: player.isHost } });
      
      // Notify all clients that room list changed
      io.emit('room:updated');
      
      console.log('[room:join] Player joined room successfully:', data.roomId);
    });

    socket.on('room:leave', () => {
      handlePlayerLeave(socket, io, true); // true = intentional leave
    });

    socket.on('room:start', () => {
      console.log('[room:start] received from socket:', socket.id);
      const roomId = socketToRoom.get(socket.id);
      console.log('[room:start] Room ID from socketToRoom:', roomId);
      if (!roomId) {
        console.log('[room:start] No room ID found for socket');
        return;
      }
      
      const room = getRoom(roomId);
      console.log('[room:start] Room found:', room?.id, 'Players:', room?.players.length);
      if (!room) {
        console.log('[room:start] Room not found');
        return;
      }
      
      // Check if solo play (only 1 player) OR host selected solo mode
      const isSolo = room.players.length === 1 || room.settings.gameMode === 'solo';
      
      if (isSolo) {
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
      
      console.log('[room:start] Emitting game:starting to room:', roomId);
      io.to(roomId).emit('game:starting', { round: room.gameState.currentRound, totalRounds: room.settings.rounds });
      
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
        socket.emit('room:error', { message: 'Only the drawer can select the word' });
        return;
      }
      
      // Verify we're in selection phase
      if (room.gameState.phase !== 'selection') {
        socket.emit('room:error', { message: 'Not in word selection phase' });
        return;
      }
      
      // Set the selected word
      room.gameState.currentWord = data.word;
      console.log('[game:select-word] Drawer selected word:', data.word);
      
      // Start drawing phase
      startDrawingPhase(room, io);
    });

    // Drawing events
    socket.on('draw:stroke', (data: { stroke: any }) => {
      // Rate limiting
      if (!drawRateLimiter.canProceed(socket.id)) {
        return; // Silently drop excess strokes
      }
      
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      socket.to(roomId).emit('draw:stroke', { playerId: socket.id, stroke: data.stroke });
    });


    socket.on('draw:clear', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      socket.to(roomId).emit('draw:clear', { playerId: socket.id });
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
      console.log('[guess:submit] Received from socket:', socket.id, 'guess:', data.guess);
      
      // Rate limiting
      if (!guessRateLimiter.canProceed(socket.id)) {
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
        // Correct guess - mark player but don't award points yet
        player.hasGuessedCorrectly = true;
        
        // Track guess order for round-end scoring (first guesser gets more points)
        const guessOrder = room.players.filter(p => p.hasGuessedCorrectly && !p.isDrawer).length;
        
        console.log('[guess:submit] CORRECT GUESS! Player:', player.username, 'Guess order:', guessOrder);
        
        // Emit chat message for correct guess
        io.to(roomId).emit('chat:message', { 
          playerId: 'system', 
          username: 'System', 
          message: `${player.username} guessed the word!`, 
          timestamp: new Date(),
          isCorrect: true
        });
        
        // Emit to ALL players in room - just announce, no points yet
        io.to(roomId).emit('game:guess-correct', { 

          playerId: player.id, 
          username: player.username, 
          word: room.gameState.currentWord,
          points: 0 // Don't reveal points yet
        });
        
        console.log('[guess:submit] guess-correct event emitted to room:', roomId);
        
        // Check if all non-drawer players have guessed correctly
        const nonDrawerPlayers = room.players.filter(p => !p.isDrawer);
        const allGuessedCorrectly = nonDrawerPlayers.every(p => p.hasGuessedCorrectly);
        
        if (allGuessedCorrectly) {
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
      console.log('[chat:message] Received from socket:', socket.id, 'message:', data.message);
      
      // Rate limiting
      if (!chatRateLimiter.canProceed(socket.id)) {
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
        currentRound: 0,
        currentDrawerIndex: 0,
        currentWord: '',
        wordHints: [],
        hintsRemaining: 3,
        timeRemaining: 0,
        totalRounds: room.settings.rounds,
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
      console.log('[Socket] Client disconnected:', socket.id);
      handlePlayerLeave(socket, io, false); // false = disconnect (grace period)
    });
  });
}

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


function handlePlayerLeave(socket: Socket, io: Server, isIntentional: boolean = false) {
  console.log('[handlePlayerLeave] Socket leaving:', socket.id, 'intentional:', isIntentional);
  
  const roomId = socketToRoom.get(socket.id);
  if (!roomId) {
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
  
  console.log('[handlePlayerLeave] Player found:', player.username, 'isHost:', wasHost, 'isDrawer:', wasDrawer, 'index:', playerIndex);
  
  // If intentional leave, remove player immediately (no grace period)
  if (isIntentional) {
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
  
  // Select next drawer
  room.gameState.currentDrawerIndex = (room.gameState.currentDrawerIndex + 1) % room.players.length;
  const drawer = room.players[room.gameState.currentDrawerIndex];
  
  // Reset drawer flags
  room.players.forEach(p => p.isDrawer = false);
  drawer.isDrawer = true;
  
  console.log('[startWordSelection] Drawer selected:', drawer.username, 'ID:', drawer.id);
  
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
  
  // Reset hasGuessedCorrectly flag for all players
  room.players.forEach(p => {
    p.hasGuessedCorrectly = false;
  });
  
  // Set phase to drawing
  room.gameState.phase = 'drawing';
  
  room.gameState.wordHints = new Array(room.gameState.currentWord.length).fill('_');
  room.gameState.hintsRemaining = room.settings.hints || 3;
  room.gameState.timeRemaining = room.settings.roundTime;
  
  // Emit word selected to all players
  io.to(room.id).emit('game:word-selected', { 
    word: room.gameState.currentWord, 
    blanks: room.gameState.wordHints.join(' '), 
    hints: room.gameState.hintsRemaining,
    drawTime: room.settings.roundTime
  });

  
  // Start draw timer and store reference
  const timer = setInterval(() => {
    room.gameState.timeRemaining--;
    io.to(room.id).emit('game:timer-update', { timeRemaining: room.gameState.timeRemaining });
    
    if (room.gameState.timeRemaining <= 0) {
      clearInterval(timer);
      roomTimers.delete(room.id);
      endRound(room, io);
    }
  }, 1000);
  
  roomTimers.set(room.id, timer);
}

function startNewRound(room: Room, io: Server) {
  // Start word selection for next drawer
  startWordSelection(room, io);
}

function endRound(room: Room, io: Server) {
  // Clear timer if still running
  const timer = roomTimers.get(room.id);
  if (timer) {
    clearInterval(timer);
    roomTimers.delete(room.id);
  }
  
  room.gameState.phase = 'roundEnd';
  
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
    
    setTimeout(() => {
      startNewRound(room, io);
    }, 5000);
  }
}

async function endGame(room: Room, io: Server) {
  room.gameState.phase = 'gameEnd';
  
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
