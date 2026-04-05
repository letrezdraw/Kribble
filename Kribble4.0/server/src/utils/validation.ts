/**
 * Server-Side Validation & Anti-Cheat System
 * Validates all game actions to prevent client-side cheating
 */

import { logger } from './logger.js';
import { redis } from './redis.js';

// Validation result type
export interface ValidationResult {
  valid: boolean;
  error?: string;
  code?: string;
}

// Drawing action types
export type DrawingAction = 
  | 'stroke'
  | 'clear'
  | 'undo'
  | 'redo'
  | 'fill'
  | 'shape';

// Game action types
export type GameAction =
  | 'guess'
  | 'chat'
  | 'hint'
  | 'start'
  | 'join'
  | 'leave'
  | 'kick';

// Rate limit windows (in seconds)
const RATE_LIMITS = {
  DRAW: { max: 300, window: 60 },      // 300 strokes per minute
  GUESS: { max: 20, window: 60 },      // 20 guesses per minute
  CHAT: { max: 30, window: 60 },       // 30 messages per minute
  HINT: { max: 3, window: 60 },        // 3 hints per minute
  JOIN: { max: 5, window: 60 },        // 5 room joins per minute
  START: { max: 3, window: 60 },       // 3 game starts per minute
};

// Drawing constraints
const DRAWING_CONSTRAINTS = {
  MAX_STROKE_POINTS: 10000,           // Max points per stroke
  MAX_STROKES_PER_TURN: 1000,         // Max strokes per turn
  MIN_POINT_DISTANCE: 0.5,            // Minimum distance between points
  MAX_POINT_DISTANCE: 100,              // Maximum distance between points (prevents teleporting)
  MAX_CANVAS_SIZE: 800,               // Canvas dimensions
  VALID_TOOLS: ['brush', 'eraser', 'fill', 'rect', 'circle', 'line', 'text'],
  VALID_COLORS: /^#[0-9A-Fa-f]{6}$/,   // Hex color format
  MIN_BRUSH_SIZE: 1,
  MAX_BRUSH_SIZE: 100,
  MIN_OPACITY: 0,
  MAX_OPACITY: 1,
};

// Game constraints
const GAME_CONSTRAINTS = {
  MIN_WORD_LENGTH: 2,
  MAX_WORD_LENGTH: 50,
  MAX_GUESS_LENGTH: 100,
  MAX_CHAT_LENGTH: 500,
  VALID_PHASES: ['lobby', 'selection', 'drawing', 'turnEnd', 'roundEnd', 'gameEnd', 'freeDraw'],
};

/**
 * Validate drawing action
 */
export async function validateDrawingAction(
  action: DrawingAction,
  data: any,
  context: {
    userId: string;
    roomId: string;
    isDrawer: boolean;
    gamePhase: string;
  }
): Promise<ValidationResult> {
  // Check if user is drawer
  if (!context.isDrawer) {
    return {
      valid: false,
      error: 'Only the drawer can draw',
      code: 'NOT_DRAWER',
    };
  }

  // Check game phase
  if (context.gamePhase !== 'drawing' && context.gamePhase !== 'freeDraw') {
    return {
      valid: false,
      error: 'Can only draw during drawing phase',
      code: 'WRONG_PHASE',
    };
  }

  // Rate limiting
  const rateLimit = await redis.checkRateLimit(
    `draw:${context.userId}`,
    RATE_LIMITS.DRAW.max,
    RATE_LIMITS.DRAW.window
  );

  if (!rateLimit.allowed) {
    return {
      valid: false,
      error: 'Drawing too fast, please slow down',
      code: 'RATE_LIMITED',
    };
  }

  // Validate based on action type
  switch (action) {
    case 'stroke':
      return validateStroke(data);
    case 'clear':
      return validateClear(data);
    case 'undo':
    case 'redo':
      return { valid: true };
    case 'fill':
      return validateFill(data);
    case 'shape':
      return validateShape(data);
    default:
      return {
        valid: false,
        error: 'Unknown drawing action',
        code: 'UNKNOWN_ACTION',
      };
  }
}

/**
 * Validate stroke data
 */
function validateStroke(data: any): ValidationResult {
  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      error: 'Invalid stroke data',
      code: 'INVALID_DATA',
    };
  }

  const { tool, color, size, opacity, points } = data;

  // Validate tool
  if (!DRAWING_CONSTRAINTS.VALID_TOOLS.includes(tool)) {
    return {
      valid: false,
      error: `Invalid tool: ${tool}`,
      code: 'INVALID_TOOL',
    };
  }

  // Validate color (hex format)
  if (!DRAWING_CONSTRAINTS.VALID_COLORS.test(color)) {
    return {
      valid: false,
      error: 'Invalid color format',
      code: 'INVALID_COLOR',
    };
  }

  // Validate brush size
  if (typeof size !== 'number' || size < DRAWING_CONSTRAINTS.MIN_BRUSH_SIZE || size > DRAWING_CONSTRAINTS.MAX_BRUSH_SIZE) {
    return {
      valid: false,
      error: `Brush size must be between ${DRAWING_CONSTRAINTS.MIN_BRUSH_SIZE} and ${DRAWING_CONSTRAINTS.MAX_BRUSH_SIZE}`,
      code: 'INVALID_SIZE',
    };
  }

  // Validate opacity
  if (typeof opacity !== 'number' || opacity < DRAWING_CONSTRAINTS.MIN_OPACITY || opacity > DRAWING_CONSTRAINTS.MAX_OPACITY) {
    return {
      valid: false,
      error: 'Opacity must be between 0 and 1',
      code: 'INVALID_OPACITY',
    };
  }

  // Validate points
  if (!Array.isArray(points) || points.length === 0) {
    return {
      valid: false,
      error: 'Stroke must have at least one point',
      code: 'NO_POINTS',
    };
  }

  if (points.length > DRAWING_CONSTRAINTS.MAX_STROKE_POINTS) {
    return {
      valid: false,
      error: `Stroke has too many points (max ${DRAWING_CONSTRAINTS.MAX_STROKE_POINTS})`,
      code: 'TOO_MANY_POINTS',
    };
  }

  // Validate each point
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    
    if (!point || typeof point !== 'object') {
      return {
        valid: false,
        error: `Invalid point at index ${i}`,
        code: 'INVALID_POINT',
      };
    }

    const { x, y, pressure } = point;

    // Check coordinates are numbers within canvas bounds
    if (typeof x !== 'number' || typeof y !== 'number') {
      return {
        valid: false,
        error: `Point ${i} has invalid coordinates`,
        code: 'INVALID_COORDINATES',
      };
    }

    if (x < 0 || x > DRAWING_CONSTRAINTS.MAX_CANVAS_SIZE || y < 0 || y > DRAWING_CONSTRAINTS.MAX_CANVAS_SIZE) {
      return {
        valid: false,
        error: `Point ${i} is outside canvas bounds`,
        code: 'OUT_OF_BOUNDS',
      };
    }

    // Check pressure if provided
    if (pressure !== undefined) {
      if (typeof pressure !== 'number' || pressure < 0 || pressure > 1) {
        return {
          valid: false,
          error: `Point ${i} has invalid pressure`,
          code: 'INVALID_PRESSURE',
        };
      }
    }

    // Check distance from previous point (prevent teleporting)
    if (i > 0) {
      const prev = points[i - 1];
      const distance = Math.sqrt(Math.pow(x - prev.x, 2) + Math.pow(y - prev.y, 2));
      
      if (distance > DRAWING_CONSTRAINTS.MAX_POINT_DISTANCE) {
        return {
          valid: false,
          error: `Point ${i} is too far from previous point`,
          code: 'TELEPORT_DETECTED',
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate clear action
 */
function validateClear(data: any): ValidationResult {
  // Clear doesn't need special validation
  return { valid: true };
}

/**
 * Validate fill action
 */
function validateFill(data: any): ValidationResult {
  const { x, y, color } = data;

  if (typeof x !== 'number' || typeof y !== 'number') {
    return {
      valid: false,
      error: 'Fill position must be valid coordinates',
      code: 'INVALID_FILL_POSITION',
    };
  }

  if (x < 0 || x > DRAWING_CONSTRAINTS.MAX_CANVAS_SIZE || y < 0 || y > DRAWING_CONSTRAINTS.MAX_CANVAS_SIZE) {
    return {
      valid: false,
      error: 'Fill position is outside canvas bounds',
      code: 'FILL_OUT_OF_BOUNDS',
    };
  }

  if (!DRAWING_CONSTRAINTS.VALID_COLORS.test(color)) {
    return {
      valid: false,
      error: 'Invalid fill color',
      code: 'INVALID_FILL_COLOR',
    };
  }

  return { valid: true };
}

/**
 * Validate shape action
 */
function validateShape(data: any): ValidationResult {
  const { shapeType, startPoint, endPoint, color, size } = data;

  const validShapes = ['rect', 'circle', 'line'];
  if (!validShapes.includes(shapeType)) {
    return {
      valid: false,
      error: `Invalid shape type: ${shapeType}`,
      code: 'INVALID_SHAPE',
    };
  }

  if (!startPoint || !endPoint) {
    return {
      valid: false,
      error: 'Shape must have start and end points',
      code: 'MISSING_SHAPE_POINTS',
    };
  }

  // Validate points are within bounds
  for (const point of [startPoint, endPoint]) {
    if (point.x < 0 || point.x > DRAWING_CONSTRAINTS.MAX_CANVAS_SIZE || 
        point.y < 0 || point.y > DRAWING_CONSTRAINTS.MAX_CANVAS_SIZE) {
      return {
        valid: false,
        error: 'Shape points are outside canvas bounds',
        code: 'SHAPE_OUT_OF_BOUNDS',
      };
    }
  }

  if (!DRAWING_CONSTRAINTS.VALID_COLORS.test(color)) {
    return {
      valid: false,
      error: 'Invalid shape color',
      code: 'INVALID_SHAPE_COLOR',
    };
  }

  if (typeof size !== 'number' || size < DRAWING_CONSTRAINTS.MIN_BRUSH_SIZE || size > DRAWING_CONSTRAINTS.MAX_BRUSH_SIZE) {
    return {
      valid: false,
      error: 'Invalid shape size',
      code: 'INVALID_SHAPE_SIZE',
    };
  }

  return { valid: true };
}

/**
 * Validate game action
 */
export async function validateGameAction(
  action: GameAction,
  data: any,
  context: {
    userId: string;
    roomId: string;
    isHost: boolean;
    isDrawer: boolean;
    gamePhase: string;
  }
): Promise<ValidationResult> {
  switch (action) {
    case 'guess':
      return validateGuess(data, context);
    case 'chat':
      return validateChat(data, context);
    case 'hint':
      return validateHint(data, context);
    case 'start':
      return validateStart(data, context);
    case 'join':
      return validateJoin(data, context);
    case 'leave':
      return { valid: true };
    case 'kick':
      return validateKick(data, context);
    default:
      return {
        valid: false,
        error: 'Unknown game action',
        code: 'UNKNOWN_ACTION',
      };
  }
}

/**
 * Validate guess submission
 */
async function validateGuess(
  data: any,
  context: {
    userId: string;
    isDrawer: boolean;
    gamePhase: string;
  }
): Promise<ValidationResult> {
  // Check game phase
  if (context.gamePhase !== 'drawing') {
    return {
      valid: false,
      error: 'Can only guess during drawing phase',
      code: 'WRONG_PHASE',
    };
  }

  // Drawer can't guess
  if (context.isDrawer) {
    return {
      valid: false,
      error: 'Drawer cannot guess',
      code: 'DRAWER_CANNOT_GUESS',
    };
  }

  // Rate limiting
  const rateLimit = await redis.checkRateLimit(
    `guess:${context.userId}`,
    RATE_LIMITS.GUESS.max,
    RATE_LIMITS.GUESS.window
  );

  if (!rateLimit.allowed) {
    return {
      valid: false,
      error: 'Too many guesses, please slow down',
      code: 'RATE_LIMITED',
    };
  }

  // Validate guess text
  const { guess } = data;
  if (!guess || typeof guess !== 'string') {
    return {
      valid: false,
      error: 'Guess must be a string',
      code: 'INVALID_GUESS_TYPE',
    };
  }

  if (guess.length === 0) {
    return {
      valid: false,
      error: 'Guess cannot be empty',
      code: 'EMPTY_GUESS',
    };
  }

  if (guess.length > GAME_CONSTRAINTS.MAX_GUESS_LENGTH) {
    return {
      valid: false,
      error: `Guess too long (max ${GAME_CONSTRAINTS.MAX_GUESS_LENGTH} characters)`,
      code: 'GUESS_TOO_LONG',
    };
  }

  // Check for valid characters (alphanumeric, spaces, hyphens)
  const validGuessPattern = /^[a-zA-Z0-9\s\-]+$/;
  if (!validGuessPattern.test(guess)) {
    return {
      valid: false,
      error: 'Guess contains invalid characters',
      code: 'INVALID_GUESS_CHARS',
    };
  }

  return { valid: true };
}

/**
 * Validate chat message
 */
async function validateChat(
  data: any,
  context: {
    userId: string;
  }
): Promise<ValidationResult> {
  // Rate limiting
  const rateLimit = await redis.checkRateLimit(
    `chat:${context.userId}`,
    RATE_LIMITS.CHAT.max,
    RATE_LIMITS.CHAT.window
  );

  if (!rateLimit.allowed) {
    return {
      valid: false,
      error: 'Too many messages, please slow down',
      code: 'RATE_LIMITED',
    };
  }

  // Validate message
  const { message } = data;
  if (!message || typeof message !== 'string') {
    return {
      valid: false,
      error: 'Message must be a string',
      code: 'INVALID_MESSAGE_TYPE',
    };
  }

  if (message.length === 0) {
    return {
      valid: false,
      error: 'Message cannot be empty',
      code: 'EMPTY_MESSAGE',
    };
  }

  if (message.length > GAME_CONSTRAINTS.MAX_CHAT_LENGTH) {
    return {
      valid: false,
      error: `Message too long (max ${GAME_CONSTRAINTS.MAX_CHAT_LENGTH} characters)`,
      code: 'MESSAGE_TOO_LONG',
    };
  }

  return { valid: true };
}

/**
 * Validate hint request
 */
async function validateHint(
  data: any,
  context: {
    userId: string;
    isDrawer: boolean;
    gamePhase: string;
  }
): Promise<ValidationResult> {
  // Only drawer can request hints
  if (!context.isDrawer) {
    return {
      valid: false,
      error: 'Only the drawer can request hints',
      code: 'NOT_DRAWER',
    };
  }

  // Check game phase
  if (context.gamePhase !== 'drawing') {
    return {
      valid: false,
      error: 'Can only request hints during drawing phase',
      code: 'WRONG_PHASE',
    };
  }

  // Rate limiting
  const rateLimit = await redis.checkRateLimit(
    `hint:${context.userId}`,
    RATE_LIMITS.HINT.max,
    RATE_LIMITS.HINT.window
  );

  if (!rateLimit.allowed) {
    return {
      valid: false,
      error: 'Too many hint requests',
      code: 'RATE_LIMITED',
    };
  }

  return { valid: true };
}

/**
 * Validate game start
 */
async function validateStart(
  data: any,
  context: {
    userId: string;
    isHost: boolean;
    gamePhase: string;
  }
): Promise<ValidationResult> {
  // Only host can start
  if (!context.isHost) {
    return {
      valid: false,
      error: 'Only the host can start the game',
      code: 'NOT_HOST',
    };
  }

  // Check game phase
  if (context.gamePhase !== 'lobby') {
    return {
      valid: false,
      error: 'Game can only be started from lobby',
      code: 'WRONG_PHASE',
    };
  }

  // Rate limiting
  const rateLimit = await redis.checkRateLimit(
    `start:${context.userId}`,
    RATE_LIMITS.START.max,
    RATE_LIMITS.START.window
  );

  if (!rateLimit.allowed) {
    return {
      valid: false,
      error: 'Too many start attempts',
      code: 'RATE_LIMITED',
    };
  }

  return { valid: true };
}

/**
 * Validate room join
 */
async function validateJoin(
  data: any,
  context: {
    userId: string;
  }
): Promise<ValidationResult> {
  // Rate limiting
  const rateLimit = await redis.checkRateLimit(
    `join:${context.userId}`,
    RATE_LIMITS.JOIN.max,
    RATE_LIMITS.JOIN.window
  );

  if (!rateLimit.allowed) {
    return {
      valid: false,
      error: 'Too many join attempts, please slow down',
      code: 'RATE_LIMITED',
    };
  }

  return { valid: true };
}

/**
 * Validate kick action
 */
function validateKick(
  data: any,
  context: {
    userId: string;
    isHost: boolean;
  }
): ValidationResult {
  // Only host can kick
  if (!context.isHost) {
    return {
      valid: false,
      error: 'Only the host can kick players',
      code: 'NOT_HOST',
    };
  }

  // Can't kick yourself
  if (data.playerId === context.userId) {
    return {
      valid: false,
      error: 'Cannot kick yourself',
      code: 'CANNOT_KICK_SELF',
    };
  }

  return { valid: true };
}

/**
 * Validate word selection
 */
export function validateWordSelection(
  word: string,
  options: string[],
  context: {
    isDrawer: boolean;
    gamePhase: string;
  }
): ValidationResult {
  // Only drawer can select
  if (!context.isDrawer) {
    return {
      valid: false,
      error: 'Only the drawer can select the word',
      code: 'NOT_DRAWER',
    };
  }

  // Check game phase
  if (context.gamePhase !== 'selection') {
    return {
      valid: false,
      error: 'Can only select word during selection phase',
      code: 'WRONG_PHASE',
    };
  }

  // Validate word is in options
  if (!options.includes(word)) {
    return {
      valid: false,
      error: 'Selected word is not in the options',
      code: 'INVALID_WORD_OPTION',
    };
  }

  // Validate word format
  if (!word || typeof word !== 'string') {
    return {
      valid: false,
      error: 'Word must be a string',
      code: 'INVALID_WORD_TYPE',
    };
  }

  if (word.length < GAME_CONSTRAINTS.MIN_WORD_LENGTH || word.length > GAME_CONSTRAINTS.MAX_WORD_LENGTH) {
    return {
      valid: false,
      error: `Word length must be between ${GAME_CONSTRAINTS.MIN_WORD_LENGTH} and ${GAME_CONSTRAINTS.MAX_WORD_LENGTH}`,
      code: 'INVALID_WORD_LENGTH',
    };
  }

  return { valid: true };
}

/**
 * Validate room settings
 */
export function validateRoomSettings(settings: any): ValidationResult {
  if (!settings || typeof settings !== 'object') {
    return {
      valid: false,
      error: 'Settings must be an object',
      code: 'INVALID_SETTINGS',
    };
  }

  const { roundTime, rounds, maxPlayers, hints, categories, gameMode, wordCount, language } = settings;

  // Validate round time (30-300 seconds)
  if (roundTime !== undefined) {
    if (typeof roundTime !== 'number' || roundTime < 30 || roundTime > 300) {
      return {
        valid: false,
        error: 'Round time must be between 30 and 300 seconds',
        code: 'INVALID_ROUND_TIME',
      };
    }
  }

  // Validate rounds (1-20)
  if (rounds !== undefined) {
    if (typeof rounds !== 'number' || rounds < 1 || rounds > 20) {
      return {
        valid: false,
        error: 'Rounds must be between 1 and 20',
        code: 'INVALID_ROUNDS',
      };
    }
  }

  // Validate max players (2-16)
  if (maxPlayers !== undefined) {
    if (typeof maxPlayers !== 'number' || maxPlayers < 2 || maxPlayers > 16) {
      return {
        valid: false,
        error: 'Max players must be between 2 and 16',
        code: 'INVALID_MAX_PLAYERS',
      };
    }
  }

  // Validate hints (0-5)
  if (hints !== undefined) {
    if (typeof hints !== 'number' || hints < 0 || hints > 5) {
      return {
        valid: false,
        error: 'Hints must be between 0 and 5',
        code: 'INVALID_HINTS',
      };
    }
  }

  // Validate categories (array of strings)
  if (categories !== undefined) {
    if (!Array.isArray(categories) || categories.length > 10) {
      return {
        valid: false,
        error: 'Categories must be an array with max 10 items',
        code: 'INVALID_CATEGORIES',
      };
    }
  }

  // Validate game mode
  if (gameMode !== undefined) {
    const validModes = ['classic', 'solo', 'teams'];
    if (!validModes.includes(gameMode)) {
      return {
        valid: false,
        error: 'Invalid game mode',
        code: 'INVALID_GAME_MODE',
      };
    }
  }

  // Validate word count (1-5)
  if (wordCount !== undefined) {
    if (typeof wordCount !== 'number' || wordCount < 1 || wordCount > 5) {
      return {
        valid: false,
        error: 'Word count must be between 1 and 5',
        code: 'INVALID_WORD_COUNT',
      };
    }
  }

  // Validate language
  if (language !== undefined) {
    const validLanguages = ['en', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja', 'ko'];
    if (!validLanguages.includes(language)) {
      return {
        valid: false,
        error: 'Invalid language',
        code: 'INVALID_LANGUAGE',
      };
    }
  }

  return { valid: true };
}

/**
 * Log validation failure for monitoring
 */
export function logValidationFailure(
  action: string,
  userId: string,
  result: ValidationResult,
  data?: any
): void {
  logger.warn('VALIDATION', `Validation failed for ${action}`, {
    userId,
    error: result.error,
    code: result.code,
    data: process.env.NODE_ENV === 'development' ? data : undefined,
  });
}

// Export constraints for reference
export {
  RATE_LIMITS,
  DRAWING_CONSTRAINTS,
  GAME_CONSTRAINTS,
};
