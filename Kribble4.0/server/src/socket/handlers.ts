import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { getWordsByCategory, addMatchHistory, updatePlayerStats, incrementPlayerStat, getPlayerStats } from '../db/index.js';
import { rooms, getRoom, deleteRoom, createRoom, Room, Player, RoomSettings, GameState } from '../data/rooms.js';
import { guessRateLimiter, chatRateLimiter, drawRateLimiter } from '../utils/rateLimiter.js';
import { validateMessage, validateUsername } from '../utils/profanityFilter.js';
import { logger } from '../utils/logger.js';
import { redis } from '../utils/redis.js';
import { validateDrawingAction, validateGameAction, logValidationFailure } from '../utils/validation.js';
import { checkAchievements, trackGameMetrics, AchievementUnlock } from '../utils/achievements.js';
import { 
  encodeMessage, 
  decodeMessage, 
  compactStroke, 
  expandStroke,
  batchStrokes,
  unbatchStrokes,
  shouldUseBinary,
  calculateSavings,
  type CanvasCommand,
  type CanvasCommandType
} from '@kribble/shared';

import {
  createNewRoom,
  joinExistingRoom,
  handleDisconnect,
  handleIntentionalLeave,
  getRoomList as getManagedRoomList,
  getServerStats as getManagedServerStats
} from '../utils/roomManager.js';

// Use socketToRoom from roomManager for consistent state management
import { socketToRoom } from '../utils/roomManager.js';

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
    // Sort in descending order
    indicesToRemove.sort((a, b) => b - a);
    for (const index of indicesToRemove) {
      room.players.splice(index, 1);
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

function resetRoomCanvas(room: Room, io?: Server, syncClients: boolean = false): void {
  room.canvasState = [];
  room.canvasRedoState = [];
  room.commandHistory = [];

  if (io && syncClients) {
    io.to(room.id).emit('canvas:sync', { commands: [] });
  }
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
  resetRoomCanvas(room, io, true);
  io.to(room.id).emit('draw:clear');

  // DRAWER ROTATION SYSTEM: Track who has drawn this round
  // Get list of players who haven't drawn yet in this round
  const availableDrawers = room.players.filter(p => !room.gameState.drawnPlayerIds.includes(p.id));
  
  let drawer: Player;
  
  if (availableDrawers.length === 0) {
    // All players have drawn - reset for next round
    room.gameState.drawnPlayerIds = [];
    
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

  resetRoomCanvas(room, io, true);
  
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
    
    for (let i = 0; i < hintsCount; i++) {
      const hintDelay = 10000 + (intervalBetweenHints * 1000 * (i + 1)); // Start after 10s, then intervals
      
      const hintTimer = setTimeout(() => {
        // Only reveal hint if still in drawing phase
        if (room.gameState.phase !== 'drawing') {
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
          return;
        }
        
        // Randomly select one hidden character to reveal
        const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
        room.gameState.wordHints[randomIndex] = word[randomIndex];
        room.gameState.hintsRemaining--;
        
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
  resetRoomCanvas(room, io, true);
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
    setTimeout(() => {
      endRound(room, io);
    }, 3000);
  } else {
    // Continue to next turn in same round
    room.gameState.currentTurn++;
    
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
  resetRoomCanvas(room, io, true);
  io.to(room.id).emit('game:round:end');

  // Reset drawer tracking for the round that just ended
  room.gameState.drawnPlayerIds = [];
  
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
  });
  
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
      wordsDrawn: currentStats.wordsDrawn + (player.isDrawer ? 1 : 0),
      wordsGuessed: currentStats.wordsGuessed + (player.hasGuessedCorrectly ? 1 : 0),
      lastPlayedAt: new Date().toISOString()
    };
    
    await updatePlayerStats(player.id, newStats);
    
    // Check for achievements
    const unlockedAchievements = await checkAchievements(player.id, {
      gamesPlayed: newStats.gamesPlayed,
      gamesWon: newStats.gamesWon,
      totalScore: newStats.totalScore,
      totalPlayTime: newStats.totalPlayTime,
      currentStreak: newStats.currentStreak,
      bestStreak: newStats.bestStreak,
      wordsDrawn: newStats.wordsDrawn,
      wordsGuessed: newStats.wordsGuessed,
      firstGuesses: currentStats.firstGuesses || 0,
      perfectGames: currentStats.perfectGames || 0,
      comebackWins: currentStats.comebackWins || 0,
      uniquePlayers: currentStats.uniquePlayers || 0,
      friendCount: currentStats.friendCount || 0,
    });
    
    // Emit achievement unlocks to player
    if (unlockedAchievements.length > 0) {
      io.to(player.socketId).emit('achievement:unlocked', {
        achievements: unlockedAchievements,
      });
    }
    
    // Update leaderboard in Redis
    await redis.updateLeaderboard(player.id, player.username, player.score);
    
    // Add to match history
    await addMatchHistory(player.id, {
      roomName: room.name,
      players: room.players.length,
      score: player.score,
      placement: position + 1,
      wordsDrawn: player.isDrawer ? 1 : 0,
      wordsGuessed: player.hasGuessedCorrectly ? 1 : 0,
      xpGained: xpGained,
      duration: matchDuration
    });
  }

  // Clear room from Redis
  await redis.deleteRoom(room.id);
  
  io.to(room.id).emit('game:end', { 
    finalScores: room.players.map(p => ({ playerId: p.id, username: p.username, score: p.score, avatarId: p.avatarId })),
    rankings,
    playAgain: true
  });
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

function handlePlayerLeave(socket: Socket, io: Server, isIntentional: boolean = false) {
  logger.socketEvent('player:leave', socket.id, { intentional: isIntentional });
  
  const roomId = socketToRoom.get(socket.id);
  if (!roomId) {
    logger.trace('SOCKET', 'Leave failed: No room found for socket', { socketId: socket.id });
    return;
  }
  
  const room = getRoom(roomId);
  if (!room) {
    socketToRoom.delete(socket.id);
    return;
  }
  
  const playerIndex = room.players.findIndex(p => p.socketId === socket.id);
  if (playerIndex === -1) {
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
  
  // If intentional leave, remove player immediately (no grace period)
  if (isIntentional) {
    logger.info('SOCKET', 'Intentional leave - removing player immediately', { playerId, username: player.username });
    
    // Remove player from room immediately
    room.players.splice(playerIndex, 1);
    
    // If host left and there are remaining players, promote next player to host
    if (wasHost && room.players.length > 0) {
      const newHost = room.players[0];
      newHost.isHost = true;
      
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
      
      const timeout = setTimeout(() => {
        const checkRoom = getRoom(roomId);
        if (checkRoom && checkRoom.players.length === 0) {
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
  
  // SPECIAL HANDLING FOR DRAWER DISCONNECTION
  if (wasDrawer && room.gameState.phase === 'drawing') {
    logger.gameState(roomId, 'DRAWER_DISCONNECTED', { playerId, username: player.username });
    
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
        drawerDisconnectionState.delete(roomId);
        return;
      }
      
      // Drawer didn't reconnect - cancel the round
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
      currentPlayer.disconnected = false;
      playersPendingRemoval.delete(playerId);
      return;
    }
    
    // Player didn't reconnect - remove them
    currentRoom.players.splice(currentPlayerIndex, 1);
    
    // If host left and there are remaining players, promote next player to host
    if (wasHost && currentRoom.players.length > 0) {
      const newHost = currentRoom.players[0];
      newHost.isHost = true;
      
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
      
      const timeout = setTimeout(() => {
        const checkRoom = getRoom(roomId);
        if (checkRoom && checkRoom.players.length === 0) {
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

export function setupSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    logger.socketEvent('connection', socket.id, { timestamp: new Date().toISOString() });

    // Debug: Log all incoming events
    socket.onAny((eventName, ...args) => {
      logger.trace('SOCKET', `Event: ${eventName}`, { args: args.length > 0 ? args : undefined }, undefined, socket.id);
    });

    // Room management
    socket.on('room:create', (data: { name: string; settings: Partial<RoomSettings>; username?: string; userId?: string }) => {
      logger.socketEvent('room:create', socket.id, { roomName: data.name, username: data.username, userId: data.userId });
      
      // Validate username
      const usernameValidation = validateUsername(data.username || 'Player1');
      if (!usernameValidation.valid) {
        logger.warn('SOCKET', 'Room creation failed: Invalid username', { username: data.username, error: usernameValidation.error });
        socket.emit('room:error', { message: usernameValidation.error });
        return;
      }

      // Use provided userId or generate one
      const userId = data.userId || `player-${uuidv4()}`;
      
      // Use new room manager for proper state management
      const result = createNewRoom(socket.id, userId, data.username || 'Player', data.name, data.settings);
      
      if (!result) {
        socket.emit('room:error', { message: 'Failed to create room' });
        return;
      }
      
      const { room, player } = result;
      logger.gameState(room.id, 'ROOM_CREATED', { roomName: data.name, host: data.username, settings: data.settings });
      
      // Ensure room starts in lobby phase
      room.gameState.phase = 'lobby';
      room.gameState.currentRound = 0;
      room.gameState.currentDrawerIndex = -1;
      room.gameState.currentWord = '';
      
      // Persist room to Redis
      redis.setRoom(room.id, {
        id: room.id,
        name: room.name,
        hostId: player.id,
        maxPlayers: room.maxPlayers,
        isPrivate: room.isPrivate,
        password: room.password,
        settings: room.settings,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      
      // Store session
      redis.setSession(socket.id, {
        userId: player.id,
        username: player.username,
        isGuest: player.id.startsWith('player-'),
        socketId: socket.id,
        lastActivity: Date.now(),
      });
      
      logger.userAction(player.id, 'HOST_JOINED', { roomId: room.id, username: player.username });
      
      socket.join(room.id);
      
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
            isHost: p.isHost,
            connected: p.connected
          })),
          maxPlayers: room.maxPlayers, 
          settings: room.settings,
          gameState: room.gameState // Include game state to confirm lobby phase
        },
        currentPlayerId: player.id,
        password: room.password // Send password so creator can auto-join
      });
    });

    socket.on('room:join', (data: { roomId: string; password?: string; username?: string; joinByCode?: boolean; userId?: string }) => {
      logger.socketEvent('room:join', socket.id, { roomId: data.roomId, username: data.username, userId: data.userId, joinByCode: data.joinByCode });

      // Validate username if provided
      if (data.username) {
        const usernameValidation = validateUsername(data.username);
        if (!usernameValidation.valid) {
          logger.warn('SOCKET', 'Join failed: Invalid username', { username: data.username, error: usernameValidation.error });
          socket.emit('room:error', { message: usernameValidation.error });
          return;
        }
      }

      // Use provided userId or generate one
      const userId = data.userId || `player-${uuidv4()}`;

      // Try to find room by exact match first, then by partial match
      let targetRoomId = data.roomId;
      let room = getRoom(data.roomId);
      
      // If not found and joinByCode is true, try partial match
      if (!room && data.joinByCode) {
        const partialMatch = Array.from(rooms.values()).find(r => r.id.startsWith(data.roomId));
        if (partialMatch) {
          targetRoomId = partialMatch.id;
          room = partialMatch;
        }
      }
      
      if (!room) {
        logger.warn('SOCKET', 'Join failed: Room not found', { roomId: data.roomId });
        socket.emit('room:error', { message: 'Room not found' });
        return;
      }

      // Check password for private rooms
      if (room.isPrivate && room.password && !data.joinByCode) {
        if (data.password !== room.password) {
          logger.warn('SOCKET', 'Join failed: Incorrect password', { roomId: data.roomId, userId: data.userId });
          socket.emit('room:error', { message: 'Incorrect password' });
          return;
        }
      }

      // Use new room manager for proper join handling
      const result = joinExistingRoom(socket.id, userId, data.username || 'Player', targetRoomId);
      
      if (!result.success || !result.room || !result.player) {
        socket.emit('room:error', { message: result.error || 'Failed to join room' });
        return;
      }

      const joinedRoom = result.room;
      const player = result.player;
      const isRejoin = result.isRejoin || false;
      
      // Deduplicate players to prevent duplicates on reconnection/reload
      deduplicatePlayers(joinedRoom, socket.id);
      
      // Persist room players to Redis
      redis.setRoomPlayers(joinedRoom.id, joinedRoom.players);

      
      // Update session
      redis.setSession(socket.id, {
        userId: player.id,
        username: player.username,
        isGuest: player.id.startsWith('player-'),
        socketId: socket.id,
        lastActivity: Date.now(),
      });
      
      logger.userAction(player.id, isRejoin ? 'PLAYER_REJOINED' : 'PLAYER_JOINED', { 
        roomId: joinedRoom.id, 
        username: player.username, 
        totalPlayers: joinedRoom.players.length 
      });

      socket.join(targetRoomId);
      
      // Check if game is already in progress
      const isGameInProgress = joinedRoom.gameState.phase !== 'lobby' && joinedRoom.gameState.phase !== 'gameEnd';
      
      // Notify player
      socket.emit('room:joined', { 
        room: { 
          id: joinedRoom.id, 
          name: joinedRoom.name, 
          players: joinedRoom.players.map(p => ({ 
            id: p.id, 
            username: p.username, 
            avatarId: p.avatarId, 
            score: p.score, 
            isDrawer: p.isDrawer, 
            isHost: p.isHost,
            connected: p.connected
          })),
          maxPlayers: joinedRoom.maxPlayers, 
          settings: joinedRoom.settings,
          gameState: isGameInProgress ? {
            phase: joinedRoom.gameState.phase,
            currentRound: joinedRoom.gameState.currentRound,
            currentTurn: joinedRoom.gameState.currentTurn,
            totalRounds: joinedRoom.gameState.totalRounds,
            currentWord: joinedRoom.gameState.currentWord,
            wordHints: joinedRoom.gameState.wordHints,
            hintsRemaining: joinedRoom.gameState.hintsRemaining,
            timeRemaining: joinedRoom.gameState.timeRemaining,
            drawerId: joinedRoom.players[joinedRoom.gameState.currentDrawerIndex]?.id
          } : undefined
        },
        currentPlayerId: player.id,
        isRejoiningGame: isGameInProgress || isRejoin
      });
      
      // If game is in progress, send additional game state
      if (isGameInProgress) {
        const isDrawer = player.isDrawer;
        socket.emit('game:word-selected', {
          word: isDrawer ? joinedRoom.gameState.currentWord : joinedRoom.gameState.currentWord,
          blanks: joinedRoom.gameState.wordHints.join(' '),
          hints: joinedRoom.gameState.hintsRemaining,
          drawTime: joinedRoom.settings.roundTime,
          isRejoin: true
        });
        
        socket.emit('game:timer-update', { 
          timeRemaining: joinedRoom.gameState.timeRemaining 
        });
        
        socket.emit('PHASE_CHANGE', {
          phase: joinedRoom.gameState.phase,
          round: joinedRoom.gameState.currentRound,
          turn: joinedRoom.gameState.currentTurn,
          totalRounds: joinedRoom.gameState.totalRounds,
          drawerId: joinedRoom.players[joinedRoom.gameState.currentDrawerIndex]?.id
        });
        
        if (joinedRoom.gameState.phase === 'drawing') {
          socket.emit('canvas:sync', {
            commands: joinedRoom.commandHistory || [],
            strokes: (!joinedRoom.commandHistory || joinedRoom.commandHistory.length === 0)
              ? (joinedRoom.canvasState || [])
              : undefined,
          });
        }
      }

      // Notify others
      if (isRejoin) {
        io.to(targetRoomId).emit('room:player-reconnected', {
          playerId: player.id,
          username: player.username,
          connected: true
        });
      } else {
        socket.to(targetRoomId).emit('room:player-joined', { 
          player: { 
            id: player.id, 
            username: player.username, 
            avatarId: player.avatarId, 
            score: player.score, 
            isDrawer: player.isDrawer, 
            isHost: player.isHost,
            connected: true
          } 
        });
      }
      
      // Notify all clients that room list changed
      io.emit('room:updated');
      
      logger.info('SOCKET', 'Player joined room successfully', { 
        roomId: targetRoomId, 
        playerId: player.id, 
        username: player.username,
        isRejoin 
      });
    });

    socket.on('room:leave', () => {
      const result = handleIntentionalLeave(socket.id);
      
      if (result.roomId) {
        const { roomId, player, roomEmpty } = result;
        
        if (player) {
          // Notify others
          io.to(roomId).emit('room:player-left', { 
            playerId: player.id,
            username: player.username,
            intentional: true
          });
          
          // If host changed, notify
          const room = getRoom(roomId);
          if (room && room.players.length > 0) {
            const newHost = room.players[0];
            if (newHost.isHost && player.id !== newHost.id) {
              io.to(roomId).emit('room:host-changed', { 
                newHostId: newHost.id, 
                newHostName: newHost.username 
              });
            }
          }
        }
        
        socket.leave(roomId);
        io.emit('room:updated');
        
        logger.info('SOCKET', 'Player left room intentionally', { 
          roomId, 
          playerId: player?.id,
          roomEmpty 
        });
      }
    });

    socket.on('room:start', () => {
      logger.socketEvent('room:start', socket.id, { action: 'game_start_request' });
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) {
        logger.warn('SOCKET', 'Game start failed: No room found for socket', { socketId: socket.id });
        return;
      }
      
      const room = getRoom(roomId);
      if (!room) {
        logger.warn('SOCKET', 'Game start failed: Room not found', { roomId });
        return;
      }
      
      // Check if solo play (only 1 player) OR host selected solo mode
      const isSolo = room.players.length === 1 || room.settings.gameMode === 'solo';
      
      if (isSolo) {
        logger.gameState(roomId, 'SOLO_MODE_STARTED', { playerCount: room.players.length });
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
      
      // Start drawing phase
      startDrawingPhase(room, io);
    });

    // Drawing events with MessagePack binary protocol support
    socket.on('draw:stroke', async (data: { stroke: any }) => {
      // Rate limiting
      if (!drawRateLimiter.canProceed(socket.id)) {
        return; // Silently drop excess strokes
      }
      
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      const room = getRoom(roomId);
      if (!room) return;
      
      // Get player info for validation
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      
      // Validate drawing action
      const validation = await validateDrawingAction('stroke', data.stroke, {
        userId: player.id,
        roomId: roomId,
        isDrawer: player.isDrawer,
        gamePhase: room.gameState.phase,
      });
      
      if (!validation.valid) {
        logValidationFailure('draw:stroke', player.id, validation, data);
        socket.emit('room:error', { message: validation.error, code: validation.code });
        return;
      }
      
      // Store stroke in room canvas state for rejoining players
      if (!room.canvasState) {
        room.canvasState = [];
      }
      room.canvasState.push(data.stroke);
      room.canvasRedoState = [];
      
      // Persist game state to Redis
      redis.setGameState(roomId, {
        phase: room.gameState.phase,
        currentRound: room.gameState.currentRound,
        currentTurn: room.gameState.currentTurn,
        currentDrawerIndex: room.gameState.currentDrawerIndex,
        currentWord: room.gameState.currentWord,
        wordHints: room.gameState.wordHints,
        hintsRemaining: room.gameState.hintsRemaining,
        timeRemaining: room.gameState.timeRemaining,
        canvasState: room.canvasState,
      });
      
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
          room.canvasRedoState = [];
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

      const room = getRoom(roomId);
      if (room) {
        room.canvasRedoState = room.canvasState ? [...room.canvasState] : [];
        room.canvasState = [];
        room.commandHistory = [];
      }
      
      // Broadcast to ALL players including sender (so drawer sees canvas clear too)
      io.to(roomId).emit('draw:clear', { playerId: socket.id });
    });

    socket.on('draw:undo', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;

      const room = getRoom(roomId);
      if (room && room.canvasState && room.canvasState.length > 0) {
        if (!room.canvasRedoState) {
          room.canvasRedoState = [];
        }
        const removedStroke = room.canvasState.pop();
        if (removedStroke) {
          room.canvasRedoState.push(removedStroke);
        }
      }
      
      socket.to(roomId).emit('draw:undo', { playerId: socket.id });
    });

    socket.on('draw:redo', () => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;

      const room = getRoom(roomId);
      if (room && room.canvasRedoState && room.canvasRedoState.length > 0) {
        if (!room.canvasState) {
          room.canvasState = [];
        }
        const restoredStroke = room.canvasRedoState.pop();
        if (restoredStroke) {
          room.canvasState.push(restoredStroke);
        }
      }
      
      socket.to(roomId).emit('draw:redo', { playerId: socket.id });
    });

    socket.on('canvas:request-sync', (data: { roomId: string }) => {
      const room = getRoom(data.roomId);
      if (!room) return;

      socket.emit('canvas:sync', {
        commands: room.commandHistory || [],
        strokes: (!room.commandHistory || room.commandHistory.length === 0)
          ? (room.canvasState || [])
          : undefined,
      });
    });

    // ==========================================
    // CANVAS COMMAND PROTOCOL (New Unified System)
    // ==========================================
    
    socket.on('canvas:command', (data: { command: CanvasCommand }) => {
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) return;
      
      const room = getRoom(roomId);
      if (!room) return;
      
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) return;
      
      // Validate: Only drawer can send drawing commands
      if (!player.isDrawer && 
          data.command.type !== 'CLEAR_CANVAS' && 
          data.command.type !== 'UNDO' && 
          data.command.type !== 'REDO') {
        return;
      }
      
      // Validate: Only allow commands during drawing phase (or free draw)
      if (room.gameState.phase !== 'drawing' && room.gameState.phase !== 'freeDraw') {
        return;
      }
      
      // Rate limiting for drawing commands
      if ((data.command.type === 'START_STROKE' || data.command.type === 'ADD_POINTS') && 
          !drawRateLimiter.canProceed(socket.id)) {
        return; // Silently drop excess commands
      }
      
      // Initialize command history if needed
      if (!room.commandHistory) {
        room.commandHistory = [];
      }
      
      // Store command in room history (for replay/sync)
      // For ADD_POINTS, we might want to batch them server-side too
      room.commandHistory.push(data.command);
      
      // Persist to Redis
      redis.setGameState(roomId, {
        phase: room.gameState.phase,
        currentRound: room.gameState.currentRound,
        currentTurn: room.gameState.currentTurn,
        currentDrawerIndex: room.gameState.currentDrawerIndex,
        currentWord: room.gameState.currentWord,
        wordHints: room.gameState.wordHints,
        hintsRemaining: room.gameState.hintsRemaining,
        timeRemaining: room.gameState.timeRemaining,
        commandHistory: room.commandHistory,
      });
      
      // Broadcast command to all other players in room
      socket.to(roomId).emit('canvas:command', {
        playerId: player.id,
        command: data.command
      });
      
      // Log in development
      if (process.env.NODE_ENV !== 'production') {
        const payload = data.command.payload as any;
        logger.trace('SOCKET', 'canvas:command', { 
          type: data.command.type, 
          playerId: player.id,
          strokeId: payload?.strokeId 
        });
      }

    });

    // Game events

    socket.on('guess:submit', async (data: { guess: string }) => {
      logger.socketEvent('guess:submit', socket.id, { guess: data.guess });
      
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) {
        return;
      }
      
      const room = getRoom(roomId);
      if (!room) {
        return;
      }
      
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        return;
      }
      
      // Validate guess action
      const validation = await validateGameAction('guess', data, {
        userId: player.id,
        roomId: roomId,
        isHost: player.isHost,
        isDrawer: player.isDrawer,
        gamePhase: room.gameState.phase,
      });
      
      if (!validation.valid) {
        logValidationFailure('guess:submit', player.id, validation, data);
        socket.emit('chat:system', { message: validation.error });
        return;
      }
      
      // Don't allow drawer to guess (but allow in chat via chat:message)
      if (player.isDrawer) {
        return;
      }
      
      // Check if player already guessed correctly this round
      if (player.hasGuessedCorrectly) {
        return;
      }
      
      // Check guess
      const guessLower = data.guess.toLowerCase().trim();
      const wordLower = room.gameState.currentWord.toLowerCase().trim();

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
        
        // Track game metrics for achievements
        const guessTime = room.settings.roundTime - room.gameState.timeRemaining;
        trackGameMetrics(player.id, {
          guessTime,
          wasFirst: guessOrder === 1,
        });

        logger.gameState(roomId, 'CORRECT_GUESS', { 
          playerId: player.id, 
          username: player.username, 
          guessOrder, 
          points: totalPoints,
          word: room.gameState.currentWord 
        });

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

        // Check if all non-drawer players have guessed correctly
        const nonDrawerPlayers = room.players.filter(p => !p.isDrawer);
        const allGuessedCorrectly = nonDrawerPlayers.every(p => p.hasGuessedCorrectly);
        
        if (allGuessedCorrectly) {
          logger.gameState(roomId, 'ALL_GUESSED_CORRECTLY', { roundEnding: true });
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
        io.to(roomId).emit('chat:message', { 
          playerId: player.id, 
          username: player.username, 
          message: data.guess, 
          timestamp: new Date() 
        });
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

    socket.on('chat:message', async (data: { message: string }) => {
      logger.socketEvent('chat:message', socket.id, { message: data.message });
      
      const roomId = socketToRoom.get(socket.id);
      if (!roomId) {
        return;
      }
      
      const room = getRoom(roomId);
      if (!room) {
        return;
      }
      
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        return;
      }
      
      // Validate chat action
      const validation = await validateGameAction('chat', data, {
        userId: player.id,
        roomId: roomId,
        isHost: player.isHost,
        isDrawer: player.isDrawer,
        gamePhase: room.gameState.phase,
      });
      
      if (!validation.valid) {
        logValidationFailure('chat:message', player.id, validation, data);
        socket.emit('chat:system', { message: validation.error });
        return;
      }
      
      // Validate and censor message
      const messageValidation = validateMessage(data.message);
      if (!messageValidation.valid) {
        socket.emit('chat:system', { message: messageValidation.error });
        return;
      }
      
      const censoredMessage = messageValidation.censored || data.message;

      // Broadcast to ALL players in room (including sender for consistency)
      // The client will handle deduplication
      io.to(roomId).emit('chat:message', { 
        playerId: player.id, 
        username: player.username, 
        message: censoredMessage, 
        timestamp: new Date() 
      });
    });

    socket.on('room:update-settings', (data: { roomId: string; settings: Partial<RoomSettings> & { maxPlayers?: number } }) => {
      // Use roomId from the payload
      const roomId = data.roomId;
      if (!roomId) {
        return;
      }

      const room = getRoom(roomId);
      if (!room) {
        return;
      }
      
      // Verify the sender is in the room and is the host
      const player = room.players.find(p => p.socketId === socket.id);
      if (!player) {
        socket.emit('room:error', { message: 'You are not in this room' });
        return;
      }
      
      if (!player.isHost) {
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
      
      const result = handleDisconnect(socket.id);
      
      if (result.roomId && result.player) {
        const { roomId, userId, player, wasHost, wasDrawer } = result;
        
        // Notify others that player is offline (but may return)
        io.to(roomId).emit('player:status', {
          playerId: player.id,
          username: player.username,
          connected: false,
          message: `${player.username} disconnected (reconnecting...)`,
          reconnectWindow: 60000
        });
        
        io.emit('room:updated');
        
        logger.info('SOCKET', 'Player disconnected, grace period started', {
          roomId,
          userId,
          username: player.username,
          wasHost,
          wasDrawer
        });
        
        // If drawer disconnected during drawing, handle special case
        if (wasDrawer) {
          const room = getRoom(roomId);
          if (room && room.gameState.phase === 'drawing') {
            io.to(roomId).emit('game:drawer-disconnected', {
              playerId: player.id,
              username: player.username,
              message: `${player.username} disconnected! Round paused. Waiting for reconnection...`,
              reconnectWindow: 90000
            });
          }
        }
      }
    });
  });
}
