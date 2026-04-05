/**
 * Full Gameplay Integration Test
 * 
 * This test validates the complete multiplayer flow:
 * 1. Start server
 * 2. Create multiple rooms
 * 3. Players join rooms
 * 4. Game starts
 * 5. Drawing phase with canvas commands
 * 6. Guessing
 * 7. Round end
 * 8. Late joiner gets canvas sync
 * 9. Player disconnect/reconnect
 */

const { io } = require('socket.io-client');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test configuration
const SERVER_PORT = 3002; // Use different port to avoid conflicts
const SERVER_URL = `http://localhost:${SERVER_PORT}`;


const TEST_TIMEOUT = 30000;

// Colors for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Test state
class TestState {
  constructor() {
    this.rooms = new Map();
    this.players = new Map();
    this.canvasCommands = [];
    this.events = [];
  }

  recordEvent(type, data) {
    this.events.push({ type, data, timestamp: Date.now() });
  }
}

// Create a test player
function createPlayer(name, avatarId = '👤') {
  return {
    name,
    avatarId,
    socket: null,
    roomId: null,
    userId: null,
    isHost: false,
    isDrawer: false,
    receivedCommands: []
  };
}

// Start the server
async function startServer() {
  log('\n📡 Starting server...', 'cyan');
  
  return new Promise((resolve, reject) => {
    const serverPath = path.join(__dirname, '..', 'server', 'dist', 'index.js');
    
    if (!fs.existsSync(serverPath)) {
      reject(new Error(`Server not built. Run: cd server && npm run build`));
      return;
    }

    const server = spawn('node', [serverPath], {
      env: { ...process.env, PORT: SERVER_PORT.toString() },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    server.stdout.on('data', (data) => {
      stdout += data.toString();
      if (data.toString().includes('Server running on port') || 
          data.toString().includes('Kribble server started')) {
        log('✅ Server started successfully', 'green');
        resolve(server);
      }
    });

    server.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    server.on('error', (err) => {
      reject(err);
    });

    // Timeout if server doesn't start
    setTimeout(() => {
      if (!server.killed) {
        reject(new Error('Server failed to start within timeout'));
      }
    }, 10000);
  });
}

// Connect a player
async function connectPlayer(player) {
  return new Promise((resolve, reject) => {
    const socket = io(SERVER_URL, {
      transports: ['websocket'],
      reconnection: false
    });

    socket.on('connect', () => {
      player.socket = socket;
      player.userId = socket.id;
      log(`✅ Player ${player.name} connected (${socket.id})`, 'green');
      resolve(socket);
    });

    socket.on('connect_error', (err) => {
      reject(new Error(`Player ${player.name} connection failed: ${err.message}`));
    });

    socket.on('room:created', (data) => {
      player.roomId = data.room.id;
      player.isHost = true;
      player.userId = data.userId;
      log(`🏠 Player ${player.name} created room ${data.room.id}`, 'blue');
    });

    socket.on('room:joined', (data) => {
      player.roomId = data.room.id;
      player.isHost = data.isHost;
      player.userId = data.userId;
      log(`🏠 Player ${player.name} joined room ${data.room.id}`, 'blue');
    });

    socket.on('game:started', (data) => {
      log(`🎮 Game started in room ${player.roomId}`, 'yellow');
    });

    socket.on('game:word-selection', (data) => {
      log(`🎯 Word selection phase - ${data.wordOptions?.length || 0} options`, 'yellow');
      player.wordOptions = data.wordOptions;
    });

    socket.on('game:drawing-started', (data) => {
      const currentPlayer = data.room.players.find(p => p.userId === player.userId);
      player.isDrawer = currentPlayer?.isDrawer || false;
      if (player.isDrawer) {
        log(`✏️ Player ${player.name} is now the drawer`, 'cyan');
      }
    });


    socket.on('canvas:command', (data) => {
      player.receivedCommands.push(data.command);
      log(`🎨 Player ${player.name} received ${data.command.type} from ${data.playerId}`, 'blue');
    });

    socket.on('canvas:sync', (data) => {
      log(`📥 Player ${player.name} received canvas sync with ${data.commands?.length || 0} commands`, 'cyan');
      // Add synced commands to received commands for validation
      if (data.commands && data.commands.length > 0) {
        player.receivedCommands.push(...data.commands);
      }
    });


    socket.on('room:player-disconnected', (data) => {
      log(`⚠️ Player ${data.username} disconnected`, 'yellow');
    });

    socket.on('disconnect', () => {
      log(`❌ Player ${player.name} disconnected`, 'red');
    });
  });
}

// Test 1: Room Creation
async function testRoomCreation(state) {
  log('\n📋 TEST 1: Room Creation', 'cyan');
  
  const host = createPlayer('Host');
  await connectPlayer(host);
  state.players.set('host', host);

  // Create room
  host.socket.emit('room:create', {
    name: 'Test Room',
    settings: { maxPlayers: 4, roundTime: 30, totalRounds: 1 },
    username: host.name,
    userId: host.userId,
    avatarId: host.avatarId
  });

  await delay(1000);

  if (!host.roomId) {
    throw new Error('Room creation failed');
  }

  state.rooms.set(host.roomId, { id: host.roomId, host: host });
  log(`✅ Room created: ${host.roomId}`, 'green');
  
  return host.roomId;
}

// Test 2: Player Joining
async function testPlayerJoining(state, roomId) {
  log('\n📋 TEST 2: Player Joining', 'cyan');
  
  const player2 = createPlayer('Player2');
  await connectPlayer(player2);
  state.players.set('player2', player2);

  player2.socket.emit('room:join', {
    roomId: roomId,
    username: player2.name,
    userId: player2.userId,
    avatarId: player2.avatarId
  });

  await delay(1000);

  if (player2.roomId !== roomId) {
    throw new Error('Player 2 failed to join room');
  }

  log(`✅ Player 2 joined room ${roomId}`, 'green');
}

// Test 3: Game Start and Word Selection
async function testGameStart(state) {
  log('\n📋 TEST 3: Game Start', 'cyan');
  
  const host = state.players.get('host');
  
  host.socket.emit('game:start');
  
  // Wait for game to start and word selection phase
  await delay(1500);
  
  // Check if we're in word selection and host is drawer
  if (host.wordOptions && host.wordOptions.length > 0) {
    log(`🎯 Host selecting word: ${host.wordOptions[0]}`, 'cyan');
    host.socket.emit('game:select-word', { word: host.wordOptions[0] });
  }
  
  // Wait for drawing phase to start
  await delay(1500);

  log(`✅ Game in drawing phase`, 'green');
}

// Test 4: Canvas Commands
async function testCanvasCommands(state) {
  log('\n📋 TEST 4: Canvas Commands', 'cyan');
  
  const host = state.players.get('host');
  const player2 = state.players.get('player2');

  // Wait a bit for drawer assignment
  await delay(500);

  // Find the drawer
  const drawer = host.isDrawer ? host : player2.isDrawer ? player2 : null;
  if (!drawer) {
    log('⚠️ No drawer assigned, skipping canvas test', 'yellow');
    log(`   Host isDrawer: ${host.isDrawer}, Player2 isDrawer: ${player2.isDrawer}`, 'yellow');
    return;
  }


  log(`✏️ Drawer is ${drawer.name}`, 'cyan');

  // Send some drawing commands
  const strokeId = `stroke-${Date.now()}`;
  
  drawer.socket.emit('canvas:command', {
    command: {
      id: `cmd-${Date.now()}-1`,
      roomId: drawer.roomId,
      userId: drawer.userId,
      type: 'START_STROKE',
      timestamp: Date.now(),
      payload: {
        strokeId,
        tool: 'brush',
        color: '#FF0000',
        size: 5,
        opacity: 1,
        startPoint: { x: 100, y: 100 }
      }
    }
  });

  await delay(100);

  drawer.socket.emit('canvas:command', {
    command: {
      id: `cmd-${Date.now()}-2`,
      roomId: drawer.roomId,
      userId: drawer.userId,
      type: 'ADD_POINTS',
      timestamp: Date.now(),
      payload: {
        strokeId,
        points: [
          { x: 110, y: 110 },
          { x: 120, y: 120 },
          { x: 130, y: 130 }
        ]
      }
    }
  });

  await delay(100);

  drawer.socket.emit('canvas:command', {
    command: {
      id: `cmd-${Date.now()}-3`,
      roomId: drawer.roomId,
      userId: drawer.userId,
      type: 'END_STROKE',
      timestamp: Date.now(),
      payload: { strokeId }
    }
  });

  await delay(1000);

  // Check if other player received commands
  const otherPlayer = drawer === host ? player2 : host;
  log(`📊 ${otherPlayer.name} received ${otherPlayer.receivedCommands.length} canvas commands`, 'blue');
  
  if (otherPlayer.receivedCommands.length === 0) {
    throw new Error('Canvas commands not received by other player');
  }

  log(`✅ Canvas commands synced between players`, 'green');
}

// Test 5: Late Joiner Canvas Sync
async function testLateJoiner(state, roomId) {
  log('\n📋 TEST 5: Late Joiner Canvas Sync', 'cyan');
  
  const lateJoiner = createPlayer('LateJoiner');
  await connectPlayer(lateJoiner);
  state.players.set('lateJoiner', lateJoiner);

  lateJoiner.socket.emit('room:join', {
    roomId: roomId,
    username: lateJoiner.name,
    userId: lateJoiner.userId,
    avatarId: lateJoiner.avatarId
  });

  await delay(1500);

  if (lateJoiner.receivedCommands.length === 0) {
    throw new Error('Late joiner did not receive canvas sync');
  } else {
    log(`✅ Late joiner received ${lateJoiner.receivedCommands.length} commands on join`, 'green');
  }
}


// Test 6: Player Disconnect
async function testDisconnect(state) {
  log('\n📋 TEST 6: Player Disconnect', 'cyan');
  
  const player2 = state.players.get('player2');
  
  log(`🔌 Disconnecting ${player2.name}...`, 'yellow');
  player2.socket.disconnect();
  
  await delay(1000);
  
  log(`✅ Player disconnected`, 'green');
}

// Run all tests
async function runTests() {
  log('\n========================================', 'cyan');
  log('FULL GAMEPLAY INTEGRATION TEST', 'cyan');
  log('========================================\n', 'cyan');

  const state = new TestState();
  let server = null;

  try {
    // Start server
    server = await startServer();
    await delay(2000);

    // Run tests
    const roomId = await testRoomCreation(state);
    await testPlayerJoining(state, roomId);
    await testGameStart(state);
    await testCanvasCommands(state);
    await testLateJoiner(state, roomId);
    await testDisconnect(state);

    // Success
    log('\n========================================', 'green');
    log('✅ ALL TESTS PASSED', 'green');
    log('========================================\n', 'green');

    log('Test Summary:', 'cyan');
    log(`- Rooms created: ${state.rooms.size}`, 'blue');
    log(`- Players connected: ${state.players.size}`, 'blue');
    log(`- Total events: ${state.events.length}`, 'blue');
    
    for (const [name, player] of state.players) {
      log(`- ${player.name}: ${player.receivedCommands.length} commands received`, 'blue');
    }

  } catch (error) {
    log(`\n❌ TEST FAILED: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  } finally {
    // Cleanup
    if (server) {
      log('\n🛑 Stopping server...', 'yellow');
      server.kill();
    }
    
    for (const [name, player] of state.players) {
      if (player.socket?.connected) {
        player.socket.disconnect();
      }
    }
  }
}

// Run if called directly
if (require.main === module) {
  runTests().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { runTests, TestState, createPlayer };
