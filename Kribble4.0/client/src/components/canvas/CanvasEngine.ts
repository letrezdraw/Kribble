/**
 * CanvasEngine - Command-based canvas rendering system
 * 
 * Implements the unified Canvas Command Protocol for deterministic replay,
 * perfect sync, and production-grade canvas replication.
 * 
 * Architecture:
 * - Dual-layer rendering: Static canvas (committed strokes) + Live canvas (active preview)
 * - Command history for replay and sync
 * - Deterministic rendering - replay commands from start = identical canvas
 */

import type { 
  CanvasCommand, 
  CanvasCommandType, 
  StartStrokePayload, 
  AddPointsPayload, 
  EndStrokePayload,
  FillPayload,
  Point,
  Stroke,
  ToolType
} from './types';

interface CanvasEngineOptions {
  staticCanvas: HTMLCanvasElement;
  liveCanvas: HTMLCanvasElement;
  onStrokeComplete?: (stroke: Stroke) => void;
  onCommandApplied?: (command: CanvasCommand) => void;
}

interface ActiveStroke {
  id: string;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  points: Point[];
}

export class CanvasEngine {
  // RAF for throttled live rendering
  private renderLiveRafRef: number | null = null;

  // Canvas contexts
  private staticCtx: CanvasRenderingContext2D;
  private liveCtx: CanvasRenderingContext2D;
  
  // Stroke storage
  private strokes: Map<string, Stroke> = new Map();
  private activeStrokes: Map<string, ActiveStroke> = new Map();
  
  // Command history for replay/sync
  private commandHistory: CanvasCommand[] = [];
  private redoStack: CanvasCommand[] = [];
  
  // Batching for ADD_POINTS
  private pendingPoints: Map<string, Point[]> = new Map();
  private batchTimer: number | null = null;
  private readonly BATCH_INTERVAL = 16; // ~60fps
  
  /**
   * Schedule live stroke render using RAF (anti-flicker)
   */
  private scheduleLiveRender(stroke: ActiveStroke): void {
    if (this.renderLiveRafRef !== null) {
      cancelAnimationFrame(this.renderLiveRafRef);
    }
    this.renderLiveRafRef = requestAnimationFrame(() => {
      this.renderLiveStroke(stroke);
      this.renderLiveRafRef = null;
    });
  }
  
  // Callbacks
  private onStrokeComplete?: (stroke: Stroke) => void;
  private onCommandApplied?: (command: CanvasCommand) => void;
  
  // Settings
  private isDrawing: boolean = false;

  constructor(options: CanvasEngineOptions) {
    const staticCtx = options.staticCanvas.getContext('2d');
    const liveCtx = options.liveCanvas.getContext('2d');
    
    if (!staticCtx || !liveCtx) {
      throw new Error('Failed to get canvas contexts');
    }
    
    this.staticCtx = staticCtx;
    this.liveCtx = liveCtx;
    this.onStrokeComplete = options.onStrokeComplete;
    this.onCommandApplied = options.onCommandApplied;
    
    // Setup canvas defaults
    this.setupCanvasDefaults();
  }

  private setupCanvasDefaults(): void {
    // Match the original canvas feel: crisp raster drawing instead of smoothed vector strokes.
    this.staticCtx.imageSmoothingEnabled = false;
    this.liveCtx.imageSmoothingEnabled = false;
    this.staticCtx.lineCap = 'butt';
    this.staticCtx.lineJoin = 'miter';
    this.liveCtx.lineCap = 'butt';
    this.liveCtx.lineJoin = 'miter';
  }

  /**
   * Apply a canvas command - the core of the command protocol
   * This is the single entry point for all canvas operations
   */
  applyCommand(command: CanvasCommand): void {
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
        
      case 'TOOL_UPDATE':
        // Tool updates are handled by the UI, not the engine
        break;
        
      default:
        console.warn('[CanvasEngine] Unknown command type:', (command as any).type);
    }
    
    // Store in history (except for ADD_POINTS which are batched)
    if (command.type !== 'ADD_POINTS') {
      this.commandHistory.push(command);
    }
    
    // Notify callback
    this.onCommandApplied?.(command);
  }

  /**
   * Replay all commands from history - used for sync and reconnect
   */
  replayCommands(commands: CanvasCommand[]): void {
    // Clear current state
    this.clearAll();
    this.commandHistory = [];
    this.redoStack = [];
    
    // Replay each command in order
    for (const command of commands) {
      this.applyCommand(command);
    }
  }

  /**
   * Start a new stroke
   */
  private handleStartStroke(command: CanvasCommand): void {
    const payload = command.payload as StartStrokePayload;
    
    // Create active stroke
    const activeStroke: ActiveStroke = {
      id: payload.strokeId,
      tool: payload.tool,
      color: payload.color,
      size: payload.size,
      opacity: payload.opacity,
      points: payload.startPoint ? [payload.startPoint] : []
    };
    
    this.activeStrokes.set(payload.strokeId, activeStroke);
    this.isDrawing = true;
    
    // Initialize pending points batch
    this.pendingPoints.set(payload.strokeId, []);
    
    // Start batch timer if not running
    this.startBatchTimer();

    if (activeStroke.points.length > 0) {
      this.scheduleLiveRender(activeStroke);
    }
  }

  /**
   * Add points to an active stroke
   */
  private handleAddPoints(command: CanvasCommand): void {
    const payload = command.payload as AddPointsPayload;
    const activeStroke = this.activeStrokes.get(payload.strokeId);
    
    if (!activeStroke) {
      console.warn('[CanvasEngine] ADD_POINTS for unknown stroke:', payload.strokeId);
      return;
    }
    
    // Add points to active stroke
    for (const point of payload.points) {
      activeStroke.points.push(point);
    }
    
    // Throttled render via RAF for smoothness/no flicker
    this.scheduleLiveRender(activeStroke);
  }

  /**
   * End a stroke and commit to static canvas
   */
  private handleEndStroke(command: CanvasCommand): void {
    const payload = command.payload as EndStrokePayload;
    const activeStroke = this.activeStrokes.get(payload.strokeId);
    
    if (!activeStroke) {
      console.warn('[CanvasEngine] END_STROKE for unknown stroke:', payload.strokeId);
      return;
    }
    
    // Flush any pending points
    this.flushPendingPoints(payload.strokeId);
    
    // Create final stroke object
    const stroke: Stroke = {
      id: activeStroke.id,
      tool: activeStroke.tool,
      points: [...activeStroke.points],
      color: activeStroke.color,
      size: activeStroke.size,
      opacity: activeStroke.opacity
    };

    // Store in permanent strokes
    this.strokes.set(stroke.id, stroke);
    
    // Render to static canvas
    this.renderStaticStroke(stroke);
    
    // Clear from active strokes
    this.activeStrokes.delete(payload.strokeId);
    this.pendingPoints.delete(payload.strokeId);
    
    // Clear live canvas (with RAF for smooth fade)
    this.clearLiveCanvas();
    
    this.isDrawing = false;
    
    // Notify callback
    this.onStrokeComplete?.(stroke);
    
    // Stop batch timer if no more active strokes
    if (this.activeStrokes.size === 0) {
      this.stopBatchTimer();
    }
  }

  /**
   * Handle fill tool - flood fill algorithm
   */
  private handleFill(command: CanvasCommand): void {
    const payload = command.payload as FillPayload;
    
    // Get canvas dimensions
    const width = this.staticCtx.canvas.width;
    const height = this.staticCtx.canvas.height;
    
    // Get image data
    const imageData = this.staticCtx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Target position
    const startX = Math.floor(payload.x);
    const startY = Math.floor(payload.y);
    
    // Get target color at click position
    const targetIdx = (startY * width + startX) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];
    
    // Parse fill color
    const fillColor = this.parseColor(payload.color);
    
    // Don't fill if clicking on same color
    if (targetR === fillColor.r && targetG === fillColor.g && 
        targetB === fillColor.b && targetA === fillColor.a) {
      return;
    }
    
    // Flood fill using stack-based approach (non-recursive)
    const stack: [number, number][] = [[startX, startY]];
    const tolerance = payload.tolerance || 32;
    const toleranceSquared = tolerance * tolerance;
    
    // Visited set to avoid reprocessing
    const visited = new Set<number>();
    
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const idx = (y * width + x) * 4;
      
      // Skip if visited
      if (visited.has(idx)) continue;
      visited.add(idx);
      
      // Check if this pixel matches target color (with tolerance)
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
      
      // Fill this pixel
      data[idx] = fillColor.r;
      data[idx + 1] = fillColor.g;
      data[idx + 2] = fillColor.b;
      data[idx + 3] = fillColor.a;
      
      // Add neighbors
      if (x > 0) stack.push([x - 1, y]);
      if (x < width - 1) stack.push([x + 1, y]);
      if (y > 0) stack.push([x, y - 1]);
      if (y < height - 1) stack.push([x, y + 1]);
    }
    
    // Put image data back
    this.staticCtx.putImageData(imageData, 0, 0);
  }

  /**
   * Parse hex color to RGBA
   */
  private parseColor(color: string): { r: number; g: number; b: number; a: number } {
    // Handle hex colors
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 6) {
        return {
          r: parseInt(hex.slice(0, 2), 16),
          g: parseInt(hex.slice(2, 4), 16),
          b: parseInt(hex.slice(4, 6), 16),
          a: 255
        };
      } else if (hex.length === 3) {
        return {
          r: parseInt(hex[0] + hex[0], 16),
          g: parseInt(hex[1] + hex[1], 16),
          b: parseInt(hex[2] + hex[2], 16),
          a: 255
        };
      }
    }
    
    // Handle rgb/rgba
    if (color.startsWith('rgb')) {
      const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
      if (match) {
        return {
          r: parseInt(match[1]),
          g: parseInt(match[2]),
          b: parseInt(match[3]),
          a: match[4] ? Math.round(parseFloat(match[4]) * 255) : 255
        };
      }
    }
    
    // Default to black
    return { r: 0, g: 0, b: 0, a: 255 };
  }

  /**
   * Clear the entire canvas
   */
  private handleClearCanvas(command: CanvasCommand): void {
    // Store current strokes for undo if needed
    if (this.strokes.size > 0) {
      const clearCommand: CanvasCommand = {
        ...command,
        payload: {
          ...command.payload,
          clearedStrokes: Array.from(this.strokes.values())
        }
      };
      // Replace the command in history
      const index = this.commandHistory.findIndex(c => c.id === command.id);
      if (index !== -1) {
        this.commandHistory[index] = clearCommand;
      }
    }
    
    this.clearAll();
  }

  /**
   * Undo the last stroke
   */
  private handleUndo(command: CanvasCommand): void {
    // Find last stroke command
    for (let i = this.commandHistory.length - 1; i >= 0; i--) {
      const cmd = this.commandHistory[i];
      if (cmd.type === 'START_STROKE') {
        // Remove this stroke group from history
        const strokeId = (cmd.payload as StartStrokePayload).strokeId;
        
        // Move to redo stack
        this.redoStack.push(cmd);
        
        // Remove the stroke
        this.strokes.delete(strokeId);
        
        // Redraw all remaining strokes
        this.redrawAllStrokes();
        break;
      } else if (cmd.type === 'CLEAR_CANVAS') {
        // Restore cleared strokes
        const payload = cmd.payload as any;
        if (payload.clearedStrokes) {
          for (const stroke of payload.clearedStrokes) {
            this.strokes.set(stroke.id, stroke);
          }
          this.redrawAllStrokes();
        }
        break;
      } else if (cmd.type === 'FILL') {
        // For fill, we need to replay all commands except the fill
        // This is a simplified approach - in production, you'd store the pre-fill state
        this.redrawAllStrokes();
        break;
      }
    }
  }

  /**
   * Redo the last undone stroke
   */
  private handleRedo(command: CanvasCommand): void {
    if (this.redoStack.length === 0) return;
    
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    
    if (cmd.type === 'START_STROKE') {
      // Replay this stroke
      this.applyCommand(cmd);
      
      // Find and replay associated ADD_POINTS and END_STROKE
      const strokeId = (cmd.payload as StartStrokePayload).strokeId;
      
      for (const historyCmd of this.commandHistory) {
        if (historyCmd.type === 'ADD_POINTS' || historyCmd.type === 'END_STROKE') {
          const payload = historyCmd.payload as any;
          if (payload.strokeId === strokeId) {
            this.applyCommand(historyCmd);
          }
        }
      }
    } else if (cmd.type === 'FILL') {
      this.applyCommand(cmd);
    }
  }

  /**
   * Render a stroke to the live canvas (for active/preview strokes)
   */
  private renderLiveStroke(stroke: ActiveStroke): void {
    this.clearLiveCanvas();

    if (stroke.points.length === 0) return;

    this.liveCtx.save();
    this.setupContextForTool(this.liveCtx, stroke.tool, stroke.color, stroke.size, stroke.opacity);
    this.renderOriginalStyleStroke(this.liveCtx, stroke.points, stroke.tool, stroke.size);
    this.liveCtx.restore();
  }

  /**
   * Render a stroke to the static canvas (committed strokes)
   */
  private renderStaticStroke(stroke: Stroke): void {
    this.staticCtx.save();
    this.setupContextForTool(this.staticCtx, stroke.tool, stroke.color, stroke.size, stroke.opacity);
    this.renderOriginalStyleStroke(this.staticCtx, stroke.points, stroke.tool, stroke.size);
    this.staticCtx.restore();
  }

  /**
   * Setup canvas context for a specific tool
   */
  private setupContextForTool(
    ctx: CanvasRenderingContext2D, 
    tool: ToolType | 'shape', 
    color: string, 
    size: number, 
    opacity: number
  ): void {
    ctx.globalAlpha = opacity;
    
    switch (tool) {
      case 'eraser':
        ctx.globalCompositeOperation = 'destination-out';
        ctx.lineWidth = size;
        break;
        
      case 'brush':
      case 'shape':
      default:
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = size;
        break;
    }
  }

  /**
   * Recreate the original Kribble 2.0 brush feel by rasterizing each segment
   * as repeated square stamps along the path.
   */
  private renderOriginalStyleStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    tool: ToolType | 'shape',
    strokeSize: number
  ): void {
    if (points.length === 0) return;

    const size = Math.max(1, Math.round(strokeSize));

    if (points.length === 1) {
      this.plotOriginalPixel(ctx, points[0], size, tool === 'eraser');
      return;
    }

    for (let i = 1; i < points.length; i++) {
      this.drawOriginalSegment(ctx, points[i - 1], points[i], size, tool === 'eraser');
    }
  }

  private drawOriginalSegment(
    ctx: CanvasRenderingContext2D,
    from: Point,
    to: Point,
    size: number,
    isEraser: boolean
  ): void {
    let x1 = Math.floor(from.x);
    let y1 = Math.floor(from.y);
    const x2 = Math.floor(to.x);
    const y2 = Math.floor(to.y);

    const dx = Math.abs(x2 - x1);
    const dy = Math.abs(y2 - y1);
    const sx = x1 < x2 ? 1 : -1;
    const sy = y1 < y2 ? 1 : -1;
    let err = dx - dy;

    while (true) {
      this.plotOriginalPixel(ctx, { x: x1, y: y1 }, size, isEraser);

      if (x1 === x2 && y1 === y2) {
        break;
      }

      const err2 = err * 2;
      if (err2 > -dy) {
        err -= dy;
        x1 += sx;
      }
      if (err2 < dx) {
        err += dx;
        y1 += sy;
      }
    }
  }

  private plotOriginalPixel(
    ctx: CanvasRenderingContext2D,
    point: Point,
    size: number,
    isEraser: boolean
  ): void {
    const radius = Math.floor(size / 2);
    const x = Math.floor(point.x) - radius;
    const y = Math.floor(point.y) - radius;

    if (isEraser) {
      ctx.clearRect(x, y, size, size);
      return;
    }

    ctx.fillRect(x, y, size, size);
  }

  /**
   * Start the batch timer for ADD_POINTS
   */
  private startBatchTimer(): void {
    if (this.batchTimer !== null) return;
    
    this.batchTimer = window.setInterval(() => {
      this.flushAllPendingPoints();
    }, this.BATCH_INTERVAL);
  }

  /**
   * Stop the batch timer
   */
  private stopBatchTimer(): void {
    if (this.batchTimer !== null) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Flush pending points for a specific stroke
   */
  private flushPendingPoints(strokeId: string): void {
    const pending = this.pendingPoints.get(strokeId);
    if (!pending || pending.length === 0) return;
    
    // Points are already rendered via live canvas
    // This is mainly for any server-side batching needs
    this.pendingPoints.set(strokeId, []);
  }

  /**
   * Flush all pending points
   */
  private flushAllPendingPoints(): void {
    for (const strokeId of this.pendingPoints.keys()) {
      this.flushPendingPoints(strokeId);
    }
  }

  /**
   * Clear the live canvas
   */
  private clearLiveCanvas(): void {
    this.liveCtx.clearRect(0, 0, this.liveCtx.canvas.width, this.liveCtx.canvas.height);
  }

  /**
   * Clear the static canvas
   */
  private clearStaticCanvas(): void {
    this.staticCtx.clearRect(0, 0, this.staticCtx.canvas.width, this.staticCtx.canvas.height);
  }

  /**
   * Clear all canvases and state
   */
  private clearAll(): void {
    if (this.renderLiveRafRef !== null) {
      cancelAnimationFrame(this.renderLiveRafRef);
      this.renderLiveRafRef = null;
    }
    this.clearStaticCanvas();
    this.clearLiveCanvas();
    this.strokes.clear();
    this.activeStrokes.clear();
    this.pendingPoints.clear();
    this.redoStack = [];
    this.isDrawing = false;
    this.stopBatchTimer();
  }

  /**
   * Redraw all committed strokes
   */
  private redrawAllStrokes(): void {
    this.clearStaticCanvas();
    
    for (const stroke of this.strokes.values()) {
      this.renderStaticStroke(stroke);
    }
  }

  // ==================== Public API ====================

  /**
   * Get all committed strokes
   */
  getStrokes(): Stroke[] {
    return Array.from(this.strokes.values());
  }

  /**
   * Get command history
   */
  getCommandHistory(): CanvasCommand[] {
    return [...this.commandHistory];
  }

  /**
   * Check if currently drawing
   */
  getIsDrawing(): boolean {
    return this.isDrawing;
  }

  /**
   * Get active stroke IDs
   */
  getActiveStrokeIds(): string[] {
    return Array.from(this.activeStrokes.keys());
  }

  /**
   * Export canvas as data URL
   */
  exportCanvas(): string {
    // Create a temporary canvas to combine static and live
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.staticCtx.canvas.width;
    tempCanvas.height = this.staticCtx.canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (!tempCtx) return '';
    
    // Draw static canvas
    tempCtx.drawImage(this.staticCtx.canvas, 0, 0);
    
    // Draw live canvas on top
    tempCtx.drawImage(this.liveCtx.canvas, 0, 0);
    
    return tempCanvas.toDataURL('image/png');
  }

  /**
   * Destroy the engine and cleanup
   */
  destroy(): void {
    this.stopBatchTimer();
    this.clearAll();
  }
}
