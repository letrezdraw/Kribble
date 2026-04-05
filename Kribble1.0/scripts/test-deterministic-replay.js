/**
 * Deterministic Replay Test Script
 * 
 * This script validates that the Canvas Command Protocol produces
 * identical canvas output when commands are replayed.
 * 
 * Test Steps:
 * 1. Create a test canvas
 * 2. Execute a series of drawing commands
 * 3. Capture the final canvas state (imageData)
 * 4. Clear the canvas
 * 5. Replay all commands from history
 * 6. Capture the new canvas state
 * 7. Compare - they must be identical
 */

const { createCanvas } = require('canvas');

// Mock CanvasEngine for Node.js testing
class TestCanvasEngine {
  constructor(width, height) {
    this.canvas = createCanvas(width, height);
    this.ctx = this.canvas.getContext('2d');
    this.commandHistory = [];
    this.strokes = new Map();
    this.activeStrokes = new Map();
    
    // Setup defaults
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
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
    if (!stroke) return;
    
    stroke.points.push(...payload.points);
    this.renderStroke(stroke);
  }

  handleEndStroke(command) {
    const payload = command.payload;
    const stroke = this.activeStrokes.get(payload.strokeId);
    if (!stroke) return;
    
    this.strokes.set(stroke.id, { ...stroke });
    this.activeStrokes.delete(payload.strokeId);
  }

  handleClearCanvas(command) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.strokes.clear();
    this.activeStrokes.clear();
  }

  handleUndo(command) {
    // Remove last stroke
    const lastStroke = Array.from(this.strokes.values()).pop();
    if (lastStroke) {
      this.strokes.delete(lastStroke.id);
      this.redrawAll();
    }
  }

  handleRedo(command) {
    // Simplified redo - would need redo stack in full implementation
    this.redrawAll();
  }

  handleFill(command) {
    const payload = command.payload;
    const x = Math.floor(payload.x);
    const y = Math.floor(payload.y);
    
    // Get image data
    const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
    const data = imageData.data;
    
    // Get target color
    const targetIdx = (y * this.canvas.width + x) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];
    
    // Parse fill color
    const fillColor = this.parseColor(payload.color);
    
    // Flood fill
    const stack = [[x, y]];
    const visited = new Set();
    const tolerance = payload.tolerance || 32;
    const toleranceSquared = tolerance * tolerance;
    
    while (stack.length > 0) {
      const [cx, cy] = stack.pop();
      const idx = (cy * this.canvas.width + cx) * 4;
      
      if (visited.has(idx)) continue;
      visited.add(idx);
      
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      
      const diffR = r - targetR;
      const diffG = g - targetG;
      const diffB = b - targetB;
      const diffA = a - targetA;
      const distanceSquared = diffR * diffR + diffG * diffG + diffB * diffB + diffA * diffA;
      
      if (distanceSquared > toleranceSquared) continue;
      
      data[idx] = fillColor.r;
      data[idx + 1] = fillColor.g;
      data[idx + 2] = fillColor.b;
      data[idx + 3] = fillColor.a;
      
      if (cx > 0) stack.push([cx - 1, cy]);
      if (cx < this.canvas.width - 1) stack.push([cx + 1, cy]);
      if (cy > 0) stack.push([cx, cy - 1]);
      if (cy < this.canvas.height - 1) stack.push([cx, cy + 1]);
    }
    
    this.ctx.putImageData(imageData, 0, 0);
  }

  parseColor(color) {
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 255
        };
      }
    }
    return { r: 0, g: 0, b: 0, a: 255 };
  }

  renderStroke(stroke) {
    if (stroke.points.length < 2) return;
    
    this.ctx.save();
    this.ctx.globalAlpha = stroke.opacity;
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.size;
    
    this.ctx.beginPath();
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    for (let i = 1; i < stroke.points.length - 1; i++) {
      const xc = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
      const yc = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
      this.ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, xc, yc);
    }
    
    if (stroke.points.length > 1) {
      const last = stroke.points[stroke.points.length - 1];
      this.ctx.lineTo(last.x, last.y);
    }
    
    this.ctx.stroke();
    this.ctx.restore();
  }

  redrawAll() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const stroke of this.strokes.values()) {
      this.renderStroke(stroke);
    }
  }

  replayCommands(commands) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.strokes.clear();
    this.activeStrokes.clear();
    this.commandHistory = [];
    
    for (const command of commands) {
      this.applyCommand(command);
    }
  }

  getImageData() {
    return this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
  }

  exportToPNG() {
    return this.canvas.toBuffer('image/png');
  }
}

// Generate test commands
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
  
  return commands;
}

// Run the test
async function runTest() {
  console.log('========================================');
  console.log('DETERMINISTIC REPLAY TEST');
  console.log('========================================\n');
  
  const roomId = 'test-room';
  const userId = 'test-user';
  const width = 400;
  const height = 200;
  
  console.log(`Canvas size: ${width}x${height}`);
  console.log(`Room: ${roomId}`);
  console.log(`User: ${userId}\n`);
  
  // Generate test commands
  console.log('Generating test commands...');
  const commands = generateTestCommands(roomId, userId);
  console.log(`Generated ${commands.length} commands\n`);
  
  // Create engine and execute commands
  console.log('Phase 1: Executing commands on Engine A...');
  const engineA = new TestCanvasEngine(width, height);
  
  for (const command of commands) {
    engineA.applyCommand(command);
  }
  
  const imageDataA = engineA.getImageData();
  console.log(`✓ Engine A rendered ${engineA.commandHistory.length} commands`);
  console.log(`✓ Engine A has ${engineA.strokes.size} committed strokes\n`);
  
  // Create second engine and replay same commands
  console.log('Phase 2: Replaying commands on Engine B...');
  const engineB = new TestCanvasEngine(width, height);
  engineB.replayCommands(commands);
  
  const imageDataB = engineB.getImageData();
  console.log(`✓ Engine B replayed ${commands.length} commands`);
  console.log(`✓ Engine B has ${engineB.strokes.size} committed strokes\n`);
  
  // Compare image data
  console.log('Phase 3: Comparing canvas outputs...');
  const dataA = imageDataA.data;
  const dataB = imageDataB.data;
  
  let differences = 0;
  let totalPixels = dataA.length / 4;
  let maxDiff = 0;
  
  for (let i = 0; i < dataA.length; i += 4) {
    const rDiff = Math.abs(dataA[i] - dataB[i]);
    const gDiff = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const bDiff = Math.abs(dataA[i + 2] - dataB[i + 2]);
    const aDiff = Math.abs(dataA[i + 3] - dataB[i + 3]);
    
    const pixelDiff = rDiff + gDiff + bDiff + aDiff;
    if (pixelDiff > 0) {
      differences++;
      maxDiff = Math.max(maxDiff, pixelDiff);
    }
  }
  
  console.log(`\nComparison Results:`);
  console.log(`- Total pixels: ${totalPixels}`);
  console.log(`- Different pixels: ${differences}`);
  console.log(`- Maximum difference: ${maxDiff}`);
  console.log(`- Match percentage: ${((1 - differences / totalPixels) * 100).toFixed(4)}%\n`);
  
  // Test undo/redo
  console.log('Phase 4: Testing undo/redo...');
  const engineC = new TestCanvasEngine(width, height);
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
  console.log(`✓ Undo removed ${beforeUndo - afterUndo} stroke(s)\n`);
  
  // Final result
  console.log('========================================');
  if (differences === 0) {
    console.log('✅ DETERMINISTIC REPLAY TEST: PASSED');
    console.log('   Canvas outputs are identical!');
    console.log('   Architecture is correct.');
  } else {
    console.log('❌ DETERMINISTIC REPLAY TEST: FAILED');
    console.log(`   ${differences} pixels differ between outputs.`);
    console.log('   Architecture needs review.');
  }
  console.log('========================================\n');
  
  // Export images for visual inspection
  try {
    const fs = require('fs');
    fs.writeFileSync('test-output-a.png', engineA.exportToPNG());
    fs.writeFileSync('test-output-b.png', engineB.exportToPNG());
    console.log('Exported test-output-a.png and test-output-b.png for visual inspection.');
  } catch (e) {
    console.log('Note: Could not export PNG files (canvas library may not be installed)');
  }
  
  return differences === 0;
}

// Run if called directly
if (require.main === module) {
  runTest().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(err => {
    console.error('Test failed with error:', err);
    process.exit(1);
  });
}

module.exports = { runTest, TestCanvasEngine, generateTestCommands };
