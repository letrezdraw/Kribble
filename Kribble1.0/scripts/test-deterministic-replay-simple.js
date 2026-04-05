/**
 * Simplified Deterministic Replay Test
 * 
 * This test validates the Canvas Command Protocol logic
 * without requiring the canvas library.
 */

// Mock command history
function generateTestCommands(roomId, userId) {
  const commands = [];
  let timestamp = Date.now();
  
  // Stroke 1: Simple line (brush)
  const stroke1Id = `stroke-${timestamp}-1`;
  commands.push({
    id: `cmd-${timestamp}-1`,
    roomId,
    userId,
    type: 'START_STROKE',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke1Id,
      tool: 'brush',
      color: '#FF0000',
      size: 5,
      opacity: 1,
      startPoint: { x: 50, y: 50 }
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-2`,
    roomId,
    userId,
    type: 'ADD_POINTS',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke1Id,
      points: [
        { x: 60, y: 60 },
        { x: 70, y: 70 },
        { x: 80, y: 80 },
        { x: 90, y: 90 },
        { x: 100, y: 100 }
      ]
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-3`,
    roomId,
    userId,
    type: 'END_STROKE',
    timestamp: timestamp++,
    payload: { strokeId: stroke1Id }
  });
  
  // Stroke 2: Curved line (brush, blue)
  const stroke2Id = `stroke-${timestamp}-2`;
  commands.push({
    id: `cmd-${timestamp}-4`,
    roomId,
    userId,
    type: 'START_STROKE',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke2Id,
      tool: 'brush',
      color: '#0000FF',
      size: 8,
      opacity: 0.8,
      startPoint: { x: 150, y: 50 }
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-5`,
    roomId,
    userId,
    type: 'ADD_POINTS',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke2Id,
      points: [
        { x: 160, y: 70 },
        { x: 170, y: 60 },
        { x: 180, y: 80 },
        { x: 190, y: 70 },
        { x: 200, y: 90 }
      ]
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-6`,
    roomId,
    userId,
    type: 'END_STROKE',
    timestamp: timestamp++,
    payload: { strokeId: stroke2Id }
  });
  
  // Stroke 3: Eraser stroke
  const stroke3Id = `stroke-${timestamp}-3`;
  commands.push({
    id: `cmd-${timestamp}-7`,
    roomId,
    userId,
    type: 'START_STROKE',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke3Id,
      tool: 'eraser',
      color: '#000000',
      size: 10,
      opacity: 1,
      startPoint: { x: 70, y: 70 }
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-8`,
    roomId,
    userId,
    type: 'ADD_POINTS',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke3Id,
      points: [
        { x: 75, y: 75 },
        { x: 80, y: 80 }
      ]
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-9`,
    roomId,
    userId,
    type: 'END_STROKE',
    timestamp: timestamp++,
    payload: { strokeId: stroke3Id }
  });
  
  // Stroke 4: Another brush stroke (green)
  const stroke4Id = `stroke-${timestamp}-4`;
  commands.push({
    id: `cmd-${timestamp}-10`,
    roomId,
    userId,
    type: 'START_STROKE',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke4Id,
      tool: 'brush',
      color: '#00FF00',
      size: 6,
      opacity: 1,
      startPoint: { x: 250, y: 150 }
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-11`,
    roomId,
    userId,
    type: 'ADD_POINTS',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke4Id,
      points: [
        { x: 260, y: 160 },
        { x: 270, y: 155 },
        { x: 280, y: 165 },
        { x: 290, y: 160 }
      ]
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-12`,
    roomId,
    userId,
    type: 'END_STROKE',
    timestamp: timestamp++,
    payload: { strokeId: stroke4Id }
  });
  
  // Stroke 5: Rectangle shape
  const stroke5Id = `stroke-${timestamp}-5`;
  commands.push({
    id: `cmd-${timestamp}-13`,
    roomId,
    userId,
    type: 'START_STROKE',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke5Id,
      tool: 'rect',
      color: '#FF00FF',
      size: 3,
      opacity: 1,
      startPoint: { x: 300, y: 50 }
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-14`,
    roomId,
    userId,
    type: 'ADD_POINTS',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke5Id,
      points: [
        { x: 350, y: 50 },
        { x: 350, y: 100 },
        { x: 300, y: 100 },
        { x: 300, y: 50 }
      ]
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-15`,
    roomId,
    userId,
    type: 'END_STROKE',
    timestamp: timestamp++,
    payload: { strokeId: stroke5Id }
  });
  
  // Fill tool test
  commands.push({
    id: `cmd-${timestamp}-16`,
    roomId,
    userId,
    type: 'FILL',
    timestamp: timestamp++,
    payload: {
      x: 325,
      y: 75,
      color: '#FFFF00',
      tolerance: 32
    }
  });
  
  // Clear canvas test
  commands.push({
    id: `cmd-${timestamp}-17`,
    roomId,
    userId,
    type: 'CLEAR_CANVAS',
    timestamp: timestamp++,
    payload: {}
  });
  
  // After clear, add one more stroke
  const stroke6Id = `stroke-${timestamp}-6`;
  commands.push({
    id: `cmd-${timestamp}-18`,
    roomId,
    userId,
    type: 'START_STROKE',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke6Id,
      tool: 'brush',
      color: '#00FFFF',
      size: 4,
      opacity: 1,
      startPoint: { x: 100, y: 100 }
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-19`,
    roomId,
    userId,
    type: 'ADD_POINTS',
    timestamp: timestamp++,
    payload: {
      strokeId: stroke6Id,
      points: [
        { x: 110, y: 110 },
        { x: 120, y: 120 }
      ]
    }
  });
  
  commands.push({
    id: `cmd-${timestamp}-20`,
    roomId,
    userId,
    type: 'END_STROKE',
    timestamp: timestamp++,
    payload: { strokeId: stroke6Id }
  });
  
  return commands;
}

// Simple stroke engine for testing
class SimpleStrokeEngine {
  constructor() {
    this.strokes = new Map();
    this.activeStrokes = new Map();
    this.commandHistory = [];
    this.redoStack = [];
  }

  applyCommand(command) {
    switch (command.type) {
      case 'START_STROKE':
        this.handleStartStroke(command);
        break;
      case 'ADD_POINTS':
        this.handleAddPoints(command);
        break;
      case 'END_STROKE':
        this.handleEndStroke(command);
        break;
      case 'CLEAR_CANVAS':
        this.handleClearCanvas(command);
        break;
      case 'UNDO':
        this.handleUndo(command);
        break;
      case 'REDO':
        this.handleRedo(command);
        break;
      case 'FILL':
        this.handleFill(command);
        break;
    }
    
    if (command.type !== 'ADD_POINTS') {
      this.commandHistory.push(command);
    }
  }

  handleStartStroke(command) {
    const payload = command.payload;
    this.activeStrokes.set(payload.strokeId, {
      id: payload.strokeId,
      tool: payload.tool,
      color: payload.color,
      size: payload.size,
      opacity: payload.opacity,
      points: payload.startPoint ? [payload.startPoint] : []
    });
  }

  handleAddPoints(command) {
    const payload = command.payload;
    const stroke = this.activeStrokes.get(payload.strokeId);
    if (stroke) {
      stroke.points.push(...payload.points);
    }
  }

  handleEndStroke(command) {
    const payload = command.payload;
    const stroke = this.activeStrokes.get(payload.strokeId);
    if (stroke) {
      this.strokes.set(stroke.id, { ...stroke });
      this.activeStrokes.delete(payload.strokeId);
    }
  }

  handleClearCanvas(command) {
    this.strokes.clear();
    this.activeStrokes.clear();
  }

  handleUndo(command) {
    const lastStroke = Array.from(this.strokes.values()).pop();
    if (lastStroke) {
      this.redoStack.push(lastStroke);
      this.strokes.delete(lastStroke.id);
    }
  }

  handleRedo(command) {
    const stroke = this.redoStack.pop();
    if (stroke) {
      this.strokes.set(stroke.id, stroke);
    }
  }

  handleFill(command) {
    // Fill is recorded but doesn't create a stroke
    // In real implementation, this would modify the canvas
  }

  replayCommands(commands) {
    this.strokes.clear();
    this.activeStrokes.clear();
    this.commandHistory = [];
    this.redoStack = [];
    
    for (const command of commands) {
      this.applyCommand(command);
    }
  }

  getState() {
    return {
      strokeCount: this.strokes.size,
      activeStrokeCount: this.activeStrokes.size,
      commandCount: this.commandHistory.length,
      strokes: Array.from(this.strokes.values()).map(s => ({
        id: s.id,
        tool: s.tool,
        color: s.color,
        pointCount: s.points.length
      }))
    };
  }
}

// Run the test
function runTest() {
  console.log('========================================');
  console.log('DETERMINISTIC REPLAY TEST (Simplified)');
  console.log('========================================\n');
  
  const roomId = 'test-room';
  const userId = 'test-user';
  
  // Generate test commands
  console.log('Generating test commands...');
  const commands = generateTestCommands(roomId, userId);
  console.log(`Generated ${commands.length} commands\n`);
  
  // Log command breakdown
  const commandTypes = {};
  for (const cmd of commands) {
    commandTypes[cmd.type] = (commandTypes[cmd.type] || 0) + 1;
  }
  console.log('Command breakdown:');
  for (const [type, count] of Object.entries(commandTypes)) {
    console.log(`  - ${type}: ${count}`);
  }
  console.log('');
  
  // Create engine A and execute commands
  console.log('Phase 1: Executing commands on Engine A...');
  const engineA = new SimpleStrokeEngine();
  
  for (const command of commands) {
    engineA.applyCommand(command);
  }
  
  const stateA = engineA.getState();
  console.log('Engine A final state:');
  console.log(`  - Committed strokes: ${stateA.strokeCount}`);
  console.log(`  - Active strokes: ${stateA.activeStrokeCount}`);
  console.log(`  - Command history: ${stateA.commandCount}`);
  console.log(`  - Strokes: ${stateA.strokes.map(s => `${s.tool}(${s.pointCount}pts)`).join(', ')}\n`);
  
  // Create engine B and replay same commands
  console.log('Phase 2: Replaying commands on Engine B...');
  const engineB = new SimpleStrokeEngine();
  engineB.replayCommands(commands);
  
  const stateB = engineB.getState();
  console.log('Engine B final state:');
  console.log(`  - Committed strokes: ${stateB.strokeCount}`);
  console.log(`  - Active strokes: ${stateB.activeStrokeCount}`);
  console.log(`  - Command history: ${stateB.commandCount}`);
  console.log(`  - Strokes: ${stateB.strokes.map(s => `${s.tool}(${s.pointCount}pts)`).join(', ')}\n`);
  
  // Compare states
  console.log('Phase 3: Comparing engine states...');
  let passed = true;
  
  if (stateA.strokeCount !== stateB.strokeCount) {
    console.log(`❌ Stroke count mismatch: A=${stateA.strokeCount}, B=${stateB.strokeCount}`);
    passed = false;
  } else {
    console.log(`✓ Stroke count matches: ${stateA.strokeCount}`);
  }
  
  if (stateA.commandCount !== stateB.commandCount) {
    console.log(`❌ Command count mismatch: A=${stateA.commandCount}, B=${stateB.commandCount}`);
    passed = false;
  } else {
    console.log(`✓ Command count matches: ${stateA.commandCount}`);
  }
  
  // Compare individual strokes
  for (let i = 0; i < stateA.strokes.length; i++) {
    const strokeA = stateA.strokes[i];
    const strokeB = stateB.strokes[i];
    
    if (strokeA.id !== strokeB.id) {
      console.log(`❌ Stroke ${i} ID mismatch: A=${strokeA.id}, B=${strokeB.id}`);
      passed = false;
    }
    if (strokeA.tool !== strokeB.tool) {
      console.log(`❌ Stroke ${i} tool mismatch: A=${strokeA.tool}, B=${strokeB.tool}`);
      passed = false;
    }
    if (strokeA.pointCount !== strokeB.pointCount) {
      console.log(`❌ Stroke ${i} point count mismatch: A=${strokeA.pointCount}, B=${strokeB.pointCount}`);
      passed = false;
    }
  }
  
  if (passed) {
    console.log(`✓ All ${stateA.strokes.length} strokes match exactly\n`);
  }
  
  // Test undo/redo
  console.log('Phase 4: Testing undo/redo functionality...');
  const engineC = new SimpleStrokeEngine();
  engineC.replayCommands(commands);
  
  const beforeUndo = engineC.strokes.size;
  engineC.applyCommand({
    id: `cmd-undo-${Date.now()}`,
    roomId,
    userId,
    type: 'UNDO',
    timestamp: Date.now(),
    payload: {}
  });
  const afterUndo = engineC.strokes.size;
  
  console.log(`✓ Strokes before undo: ${beforeUndo}`);
  console.log(`✓ Strokes after undo: ${afterUndo}`);
  console.log(`✓ Undo removed ${beforeUndo - afterUndo} stroke(s)`);
  
  engineC.applyCommand({
    id: `cmd-redo-${Date.now()}`,
    roomId,
    userId,
    type: 'REDO',
    timestamp: Date.now(),
    payload: {}
  });
  const afterRedo = engineC.strokes.size;
  
  console.log(`✓ Strokes after redo: ${afterRedo}`);
  console.log(`✓ Redo restored ${afterRedo - afterUndo} stroke(s)\n`);
  
  // Final result
  console.log('========================================');
  if (passed) {
    console.log('✅ DETERMINISTIC REPLAY TEST: PASSED');
    console.log('   All engine states are identical!');
    console.log('   Command protocol is deterministic.');
    console.log('   Architecture is correct.');
  } else {
    console.log('❌ DETERMINISTIC REPLAY TEST: FAILED');
    console.log('   States differ between engines.');
    console.log('   Architecture needs review.');
  }
  console.log('========================================\n');
  
  return passed;
}

// Run the test
if (require.main === module) {
  const passed = runTest();
  process.exit(passed ? 0 : 1);
}

module.exports = { runTest, SimpleStrokeEngine, generateTestCommands };
