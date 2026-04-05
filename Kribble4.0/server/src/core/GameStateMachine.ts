/**
 * Kribble V2 - Game State Machine
 * Authoritative phase transitions and game flow
 */

import { Room, RoomPhase, Player, Stroke } from '../types/game.js';
import { logger } from '../utils/logger.js';
import { getRoom, cleanupRoom } from './RoomManager.js';

// Word list (expanded)
const globalWords = [
  // Animals
  'elephant', 'giraffe', 'penguin', 'dolphin', 'butterfly', 'kangaroo', 'octopus', 'rhinoceros',
  'hippopotamus', 'crocodile', 'flamingo', 'peacock', 'tiger', 'lion', 'zebra', 'panda',
  'koala', 'sloth', 'hedgehog', 'raccoon', 'squirrel', 'owl', 'eagle', 'falcon',
  // Food & Drinks
  'pizza', 'sushi', 'tacos', 'pasta', 'burger', 'sandwich', 'salad', 'pancakes',
  'croissant', 'donut', 'ice cream', 'chocolate', 'watermelon', 'pineapple', 'avocado',
  'spaghetti', 'lasagna', 'curry', 'ramen', 'dim sum', 'macaron', 'cheesecake',
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

/**
 * Generate random word options
 */
function generateWordOptions(count: number = 3): string[] {
  const options: string[] = [];
  const used = new Set<string>();
  
  while (options.length < count && used.size < globalWords.length) {
    const word = globalWords[Math.floor(Math.random() * globalWords.length)];
    if (!used.has(word)) {
      used.add(word);
      options.push(word);
    }
  }
  
  return options;
}

/**
 * Generate word hints (revealed letters)
 */
function generateHints(word: string, count: number): string[] {
  const hints: string[] = new Array(word.length).fill('_');
  const revealedIndices = new Set<number>();
  
  // Always reveal first letter as first hint
  if (word.length > 0) {
    revealedIndices.add(0);
    hints[0] = word[0];
  }
  
  // Reveal additional random letters
  while (revealedIndices.size < Math.min(count + 1, word.length)) {
    const index = Math.floor(Math.random() * word.length);
    if (!revealedIndices.has(index)) {
      revealedIndices.add(index);
      hints[index] = word[index];
    }
  }
  
  return hints;
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Reset guessed flags for all players
 */
function resetGuessedFlags(room: Room): void {
  for (const player of room.players.values()) {
    player.guessedThisTurn = false;
  }
}

/**
 * Get connected players count
 */
function getConnectedPlayers(room: Room): number {
  return Array.from(room.players.values()).filter(p => p.connected).length;
}

/**
 * Check if all non-drawer players have guessed correctly
 */
function allNonDrawersGuessed(room: Room): boolean {
  const nonDrawers = Array.from(room.players.values()).filter(p => !p.isDrawer && p.connected);
  if (nonDrawers.length === 0) return false;
  return nonDrawers.every(p => p.guessedThisTurn);
}

/**
 * Calculate scores for current turn
 */
function getTurnAwards(room: Room): { userId: string; username: string; points: number }[] {
  return [...room.turnAwards];
}

/**
 * Start the game
 */
export function startGame(room: Room): boolean {
  if (room.phase !== 'waiting') {
    logger.warn('GAME', 'Cannot start game: not in waiting phase', { roomId: room.id, phase: room.phase });
    return false;
  }
  
  const connectedPlayers = getConnectedPlayers(room);
  if (connectedPlayers < 1) {
    logger.warn('GAME', 'Cannot start game: not enough players', { roomId: room.id, connectedPlayers });
    return false;
  }
  
  // Solo mode — pick a word and enter drawing (same as multiplayer after selection)
  if (connectedPlayers === 1) {
    room.settings.gameMode = 'solo';
    const player = Array.from(room.players.values()).find((p) => p.connected);
    if (!player) {
      logger.warn('GAME', 'Solo start: no connected player', { roomId: room.id });
      return false;
    }
    for (const p of room.players.values()) {
      p.isDrawer = false;
    }
    player.isDrawer = true;
    room.drawerOrder = [player.userId];
    room.currentDrawerIndex = 0;
    room.roundNumber = 1;
    room.totalRounds = room.settings.totalRounds;

    const options = generateWordOptions(room.settings.wordCount || 3);
    room.wordOptions = options;
    const word = options[Math.floor(Math.random() * options.length)] || globalWords[0];
    // startDrawingPhase only transitions from wordSelection; multiplayer goes waiting → … → wordSelection → drawing.
    room.phase = 'wordSelection';
    const drew = startDrawingPhase(room, word);
    if (!drew) {
      room.phase = 'waiting';
      logger.error(
        'GAME',
        'Solo start: failed to enter drawing phase',
        new Error('startDrawingPhase returned false'),
        { roomId: room.id }
      );
      return false;
    }

    logger.info('GAME', 'Solo mode started with word', { roomId: room.id, userId: player.userId });
    return true;
  }
  
  // Multiplayer mode
  room.phase = 'starting';
  room.roundNumber = 1;
  room.totalRounds = room.settings.totalRounds;
  
  // Create drawer order (shuffle player IDs)
  room.drawerOrder = shuffle(Array.from(room.players.keys()).filter(id => {
    const p = room.players.get(id);
    return p && p.connected;
  }));
  room.currentDrawerIndex = 0;
  
  logger.info('GAME', 'Game starting', {
    roomId: room.id,
    players: room.drawerOrder.length,
    rounds: room.totalRounds,
  });
  
  // Transition to word selection
  transitionToWordSelection(room);
  return true;
}

/**
 * Transition to word selection phase
 */
export function transitionToWordSelection(room: Room): void {
  // Clear any existing timers
  if (room.turnTimerInterval) {
    clearInterval(room.turnTimerInterval);
    room.turnTimerInterval = null;
  }
  
  room.phase = 'wordSelection';
  room.currentWord = null;
  room.wordHints = [];
  room.hintsRemaining = room.settings.hints;
  room.canvasHistory = []; // Clear canvas for new turn
  room.canvasRedoHistory = [];
  
  // Set drawer
  const drawerId = room.drawerOrder[room.currentDrawerIndex];
  const drawer = room.players.get(drawerId);
  
  if (!drawer || !drawer.connected) {
    // Drawer is offline, skip to next
    logger.warn('GAME', 'Drawer offline, skipping', { roomId: room.id, drawerId });
    skipToNextDrawer(room);
    return;
  }
  
  // Reset drawer flags
  for (const player of room.players.values()) {
    player.isDrawer = false;
  }
  drawer.isDrawer = true;
  
  // Generate word options
  room.wordOptions = generateWordOptions(room.settings.wordCount || 3);
  
  logger.info('GAME', 'Word selection phase', {
    roomId: room.id,
    drawerId,
    drawerName: drawer.username,
    options: room.wordOptions,
  });
}

/**
 * Skip to next drawer (when current drawer is offline)
 */
export function skipToNextDrawer(room: Room): void {
  room.currentDrawerIndex++;
  
  if (room.currentDrawerIndex >= room.drawerOrder.length) {
    // All drawers done, end round
    endRound(room);
    return;
  }
  
  transitionToWordSelection(room);
}

/**
 * Start drawing phase (word selected)
 */
export function startDrawingPhase(room: Room, word: string): boolean {
  if (room.phase !== 'wordSelection') {
    logger.warn('GAME', 'Cannot start drawing: not in word selection', { roomId: room.id, phase: room.phase });
    return false;
  }
  
  room.phase = 'drawing';
  room.currentWord = word.toLowerCase().trim();
  room.wordHints = new Array(room.currentWord.length).fill('_');
  room.hintsRemaining = room.settings.hints;
  room.turnTimer = room.settings.roundTime;
  room.turnAwards = [];
  
  resetGuessedFlags(room);
  
  logger.info('GAME', 'Drawing phase started', {
    roomId: room.id,
    word: room.currentWord,
    drawerId: room.drawerOrder[room.currentDrawerIndex],
  });
  
  return true;
}

/**
 * Process a guess
 */
export function processGuess(room: Room, userId: string, guess: string): { correct: boolean; points?: number; alreadyGuessed?: boolean } {
  if (room.phase !== 'drawing') {
    return { correct: false };
  }
  
  const player = room.players.get(userId);
  if (!player || !player.connected) {
    return { correct: false };
  }
  
  // Don't allow drawer to guess
  if (player.isDrawer) {
    return { correct: false };
  }
  
  // Check if already guessed correctly this turn
  if (player.guessedThisTurn) {
    return { correct: false, alreadyGuessed: true };
  }
  
  const guessLower = guess.toLowerCase().trim();
  const wordLower = room.currentWord || '';
  
  if (guessLower === wordLower) {
    // Correct guess!
    player.guessedThisTurn = true;
    
    // Calculate points based on guess order
    const correctGuessers = Array.from(room.players.values())
      .filter(p => p.guessedThisTurn && !p.isDrawer)
      .length;
    
    const basePoints = Math.max(100 - ((correctGuessers - 1) * 10), 10);
    const timeBonus = Math.floor(room.turnTimer / 10);
    const totalPoints = basePoints + timeBonus;
    
    player.score += totalPoints;
    room.turnAwards.push({
      userId: player.userId,
      username: player.username,
      points: totalPoints,
    });
    
    logger.info('GAME', 'Correct guess', {
      roomId: room.id,
      userId,
      username: player.username,
      guessOrder: correctGuessers,
      points: totalPoints,
    });
    
    return { correct: true, points: totalPoints };
  }
  
  return { correct: false };
}

/**
 * Reveal a hint
 */
export function revealHint(room: Room): string[] | null {
  if (room.phase !== 'drawing' || !room.currentWord) {
    return null;
  }
  
  if (room.hintsRemaining <= 0) {
    return null;
  }
  
  const word = room.currentWord;
  const hiddenIndices: number[] = [];
  
  // Find indices that are still hidden
  for (let i = 0; i < word.length; i++) {
    if (room.wordHints[i] === '_') {
      hiddenIndices.push(i);
    }
  }
  
  if (hiddenIndices.length === 0) {
    return null;
  }
  
  // Reveal random hidden letter
  const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
  room.wordHints[randomIndex] = word[randomIndex];
  room.hintsRemaining--;
  
  logger.info('GAME', 'Hint revealed', {
    roomId: room.id,
    hintsRemaining: room.hintsRemaining,
    currentHints: room.wordHints.join(' '),
  });
  
  return [...room.wordHints];
}

/**
 * End current turn
 */
export function endTurn(room: Room): void {
  if (room.phase !== 'drawing') return;
  
  room.phase = 'turnEnd';
  
  // Clear timer
  if (room.turnTimerInterval) {
    clearInterval(room.turnTimerInterval);
    room.turnTimerInterval = null;
  }
  
  // Calculate final scores
  const awards = getTurnAwards(room);
  
  logger.info('GAME', 'Turn ended', {
    roomId: room.id,
    round: room.roundNumber,
    drawerIndex: room.currentDrawerIndex,
    word: room.currentWord,
    awards,
  });
  
  // Check if more drawers in this round
  room.currentDrawerIndex++;
}

/**
 * End current round
 */
export function endRound(room: Room): void {
  room.phase = 'roundEnd';
  
  // Clear any timers
  if (room.turnTimerInterval) {
    clearInterval(room.turnTimerInterval);
    room.turnTimerInterval = null;
  }
  
  logger.info('GAME', 'Round ended', {
    roomId: room.id,
    round: room.roundNumber,
    totalRounds: room.totalRounds,
  });
  
}

/**
 * End the game
 */
export function endGame(room: Room): void {
  room.phase = 'gameEnd';
  
  // Clear all timers
  if (room.turnTimerInterval) {
    clearInterval(room.turnTimerInterval);
    room.turnTimerInterval = null;
  }
  if (room.wordSelectionInterval) {
    clearInterval(room.wordSelectionInterval);
    room.wordSelectionInterval = null;
  }
  
  // Calculate final rankings
  const rankings = Array.from(room.players.values())
    .map(p => ({
      userId: p.userId,
      username: p.username,
      score: p.score,
      avatarId: p.avatarId,
      rank: 0, // Will be set after sorting
    }))
    .sort((a, b) => b.score - a.score)
    .map((p, index) => ({ ...p, rank: index + 1 }));
  
  logger.info('GAME', 'Game ended', {
    roomId: room.id,
    rankings: rankings.map(r => ({ username: r.username, score: r.score, rank: r.rank })),
  });
}

/**
 * Reset game for play again
 */
export function resetGame(room: Room): boolean {
  if (room.phase !== 'gameEnd') {
    logger.warn('GAME', 'Cannot reset: not in gameEnd phase', { roomId: room.id, phase: room.phase });
    return false;
  }
  
  room.phase = 'waiting';
  room.roundNumber = 1;
  room.currentDrawerIndex = 0;
  room.drawerOrder = [];
  room.currentWord = null;
  room.wordOptions = [];
  room.wordHints = [];
  room.hintsRemaining = room.settings.hints;
  room.turnTimer = room.settings.roundTime;
  room.wordSelectionTimer = room.settings.wordSelectionTime;
  room.canvasHistory = [];
  room.canvasRedoHistory = [];
  
  // Reset player scores and flags
  for (const player of room.players.values()) {
    player.score = 0;
    player.isDrawer = false;
    player.guessedThisTurn = false;
  }
  
  logger.info('GAME', 'Game reset', { roomId: room.id });
  return true;
}

/**
 * Store a stroke
 */
export function storeStroke(room: Room, stroke: Stroke): void {
  room.canvasHistory.push(stroke);
}

/**
 * Get canvas history for replay
 */
export function getCanvasHistory(room: Room): Stroke[] {
  return [...room.canvasHistory];
}

/**
 * Clear canvas
 */
export function clearCanvas(room: Room): void {
  room.canvasHistory = [];
  room.canvasRedoHistory = [];
}
