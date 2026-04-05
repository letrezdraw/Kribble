/**
 * Kribble 2.0 - Automated Test Bot
 * Simulates 4-5 players joining, chatting, and playing the game
 * 
 * Usage: node scripts/test-bot.js [roomId] [numBots=4]
 */

const { io } = require('socket.io-client');

// Configuration
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:5000';
const NUM_BOTS = parseInt(process.argv[3]) || 4;
const ROOM_ID = process.argv[2] || null;

// Bot names and colors
const BOT_PROFILES = [
  { name: 'Bot_Alpha', color: '#FF6B6B', avatar: 'bot1' },
  { name: 'Bot_Beta', color: '#4ECDC4', avatar: 'bot2' },
  { name: 'Bot_Gamma', color: '#45B7D1', avatar: 'bot3' },
  { name: 'Bot_Delta', color: '#96CEB4', avatar: 'bot4' },
  { name: 'Bot_Epsilon', color: '#FFEAA7', avatar: 'bot5' },
];

// Sample words for guessing
const SAMPLE_GUESSES = [
  'house', 'tree', 'car', 'dog', 'cat', 'sun', 'moon', 'star',
  'flower', 'bird', 'fish', 'book', 'phone', 'computer', 'music',
  'pizza', 'coffee', 'beach', 'mountain', 'river', 'forest',
  'happy', 'sad', 'angry', 'excited', 'tired', 'hungry', 'sleepy',
  'running', 'jumping', 'swimming', 'flying', 'dancing', 'singing',
  'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink',
  'circle', 'square', 'triangle', 'heart', 'star', 'diamond',
  'apple', 'banana', 'grape', 'orange', 'strawberry', 'watermelon',
];

// Logger utility
class Logger {
  constructor(botName) {
    this.botName = botName;
    this.logs = [];
  }

  log(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      bot: this.botName,
      level,
      message,
      data,
    };
    this.logs.push(logEntry);
    
    const color = {
      info: '\x1b[36m',    // Cyan
      success: '\x1b[32m', // Green
      warning: '\x1b[33m', // Yellow
      error: '\x1b[31m',   // Red
      event: '\x1b[35m',   // Magenta
      reset: '\x1b[0m',
    };

    console.log(
      `${color[level] || color.info}[${timestamp}] [${this.botName}] ${message}${color.reset}`
    );
    if (data) {
      console.log('  Data:', JSON.stringify(data, null, 2));
    }
  }

  info(message, data) { this.log('info', message, data); }
  success(message, data) { this.log('success', message, data); }
  warning(message, data) { this.log('warning', message, data); }
  error(message, data) { this.log('error', message, data); }
  event(message, data) { this.log('event', message, data); }

  getLogs() {
    return this.logs;
  }
}

// Bot class
class GameBot {
  constructor(profile, index) {
    this.profile = profile;
    this.index = index;
    this.socket = null;
    this.logger = new Logger(profile.name);
    this.roomId = null;
    this.userId = null;
    this.isConnected = false;
    this.isDrawing = false;
    this.currentWord = null;
    this.gameStatus = 'LOBBY';
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.logger.info('Connecting to server...', { url: SERVER_URL });

      this.socket = io(SERVER_URL, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.userId = this.socket.id;
        this.logger.success('Connected!', { userId: this.userId });
        this.setupEventListeners();
        resolve();
      });

      this.socket.on('connect_error', (error) => {
        this.logger.error('Connection error', { error: error.message });
        reject(error);
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        this.logger.warning('Disconnected', { reason });
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  setupEventListeners() {
    // Room events
    this.socket.on('doodler-join', (data) => {
      this.logger.event('Player joined', data);
    });

    this.socket.on('doodler-leave', (data) => {
      this.logger.event('Player left', data);
    });

    // Game events
    this.socket.on('game-status-updated', (data) => {
      this.logger.event('Game status updated', data);
      this.gameStatus = data.game?.status || this.gameStatus;
      
      if (data.game?.options?.word) {
        this.currentWord = data.game.options.word;
      }

      // Auto-guess if not drawing
      if (this.gameStatus === 'DRAWING' && !this.isDrawing) {
        setTimeout(() => this.makeGuess(), Math.random() * 5000 + 2000);
      }
    });

    this.socket.on('game-hunch', (data) => {
      this.logger.event('Received hunch', data);
    });

    this.socket.on('game-canvas-operation', (data) => {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.01) {
        this.logger.event('Canvas operation', { type: data.operation?.type });
      }
    });

    // Error handling
    this.socket.on('error', (error) => {
      this.logger.error('Socket error', error);
    });
  }

  async setDoodler() {
    return new Promise((resolve) => {
      this.logger.info('Setting doodler...');
      
      this.socket.emit('set-doodler', {
        name: this.profile.name,
        avatar: this.profile.avatar,
      }, (response) => {
        if (response?.error) {
          this.logger.error('Failed to set doodler', response.error);
          resolve(false);
        } else {
          this.logger.success('Doodler set', response);
          resolve(true);
        }
      });

      setTimeout(() => resolve(false), 5000);
    });
  }

  async joinPublicRoom() {
    return new Promise((resolve) => {
      this.logger.info('Joining public room...');
      
      this.socket.emit('add-doodler-to-public-room', (response) => {
        if (response?.error) {
          this.logger.error('Failed to join public room', response.error);
          resolve(false);
        } else {
          this.roomId = response?.room?.id;
          this.logger.success('Joined public room', { roomId: this.roomId });
          resolve(true);
        }
      });

      setTimeout(() => resolve(false), 5000);
    });
  }

  async joinPrivateRoom(roomId) {
    return new Promise((resolve) => {
      this.logger.info('Joining private room...', { roomId });
      
      this.socket.emit('add-doodler-to-private-room', roomId, (response) => {
        if (response?.error) {
          this.logger.error('Failed to join private room', response.error);
          resolve(false);
        } else {
          this.roomId = response?.room?.id;
          this.logger.success('Joined private room', { roomId: this.roomId });
          resolve(true);
        }
      });

      setTimeout(() => resolve(false), 5000);
    });
  }

  async createPrivateRoom() {
    return new Promise((resolve) => {
      this.logger.info('Creating private room...');
      
      this.socket.emit('create-private-room', (response) => {
        if (response?.error) {
          this.logger.error('Failed to create room', response.error);
          resolve(false);
        } else {
          this.roomId = response?.room?.id;
          this.logger.success('Created private room', { roomId: this.roomId });
          resolve(true);
        }
      });

      setTimeout(() => resolve(false), 5000);
    });
  }

  async startGame() {
    return new Promise((resolve) => {
      this.logger.info('Starting game...');
      
      this.socket.emit('game-start-private-game', (response) => {
        if (response?.error) {
          this.logger.error('Failed to start game', response.error);
          resolve(false);
        } else {
          this.logger.success('Game started!');
          resolve(true);
        }
      });

      setTimeout(() => resolve(false), 5000);
    });
  }

  makeGuess() {
    if (!this.roomId || this.isDrawing) return;

    const guess = SAMPLE_GUESSES[Math.floor(Math.random() * SAMPLE_GUESSES.length)];
    this.logger.info('Making guess...', { guess });

    this.socket.emit('game-hunch', {
      roomId: this.roomId,
      message: guess,
    }, (response) => {
      if (response?.error) {
        this.logger.error('Guess failed', response.error);
      } else {
        this.logger.success('Guess sent', { guess, correct: response?.correct });
      }
    });
  }

  sendChat(message) {
    if (!this.roomId) return;

    this.socket.emit('game-hunch', {
      roomId: this.roomId,
      message: message || 'Hello from bot!',
    });
  }

  drawRandomStroke() {
    if (!this.isDrawing || !this.roomId) return;

    // Simulate a simple drawing stroke
    const canvasWidth = 800;
    const canvasHeight = 600;
    const startX = Math.random() * canvasWidth;
    const startY = Math.random() * canvasHeight;
    const endX = startX + (Math.random() - 0.5) * 100;
    const endY = startY + (Math.random() - 0.5) * 100;

    this.socket.emit('game-canvas-operation', {
      roomId: this.roomId,
      operation: {
        type: 'line',
        start: { x: startX, y: startY },
        end: { x: endX, y: endY },
        color: this.profile.color,
        width: Math.random() * 5 + 2,
      },
    });
  }

  disconnect() {
    this.logger.info('Disconnecting...');
    if (this.socket) {
      this.socket.disconnect();
    }
    this.isConnected = false;
  }

  getLogs() {
    return this.logger.getLogs();
  }
}

// Main test runner
async function runTest() {
  console.log('\n========================================');
  console.log('  KRIBBLE 2.0 - AUTOMATED TEST BOT');
  console.log('========================================\n');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Bots: ${NUM_BOTS}`);
  console.log(`Room: ${ROOM_ID || 'Auto-create'}\n`);

  const bots = [];
  const logs = [];

  try {
    // Create and connect all bots
    for (let i = 0; i < NUM_BOTS; i++) {
      const profile = BOT_PROFILES[i % BOT_PROFILES.length];
      const bot = new GameBot(profile, i);
      
      console.log(`\n--- Initializing ${profile.name} ---`);
      await bot.connect();
      await bot.setDoodler();
      
      bots.push(bot);
      
      // Small delay between bots
      await new Promise(r => setTimeout(r, 500));
    }

    // Join rooms
    if (ROOM_ID) {
      // Join existing room
      for (const bot of bots) {
        await bot.joinPrivateRoom(ROOM_ID);
      }
    } else {
      // First bot creates room, others join
      await bots[0].createPrivateRoom();
      const roomId = bots[0].roomId;
      
      for (let i = 1; i < bots.length; i++) {
        await bots[i].joinPrivateRoom(roomId);
      }
    }

    // Wait a bit then start game (first bot only)
    console.log('\n--- Waiting 3 seconds before starting game ---');
    await new Promise(r => setTimeout(r, 3000));
    
    await bots[0].startGame();

    // Run for 60 seconds
    console.log('\n--- Running game simulation for 60 seconds ---');
    
    const startTime = Date.now();
    const duration = 60000; // 60 seconds
    
    while (Date.now() - startTime < duration) {
      // Random bot activities
      for (const bot of bots) {
        // Random chat
        if (Math.random() < 0.1) {
          bot.sendChat(`Hello from ${bot.profile.name}!`);
        }
        
        // Random drawing (if drawing)
        if (bot.isDrawing && Math.random() < 0.3) {
          bot.drawRandomStroke();
        }
      }
      
      await new Promise(r => setTimeout(r, 1000));
    }

    // Collect logs
    for (const bot of bots) {
      logs.push({
        botName: bot.profile.name,
        logs: bot.getLogs(),
      });
    }

    // Save logs to file
    const fs = require('fs');
    const logFile = `test-bot-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));
    console.log(`\n✅ Logs saved to: ${logFile}`);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
  } finally {
    // Cleanup
    console.log('\n--- Cleaning up ---');
    for (const bot of bots) {
      bot.disconnect();
    }
  }

  console.log('\n========================================');
  console.log('  TEST COMPLETE');
  console.log('========================================\n');
}

// Run the test
runTest().catch(console.error);
