import type { Point, Stroke, ViewportState, Layer, DrawingCommand } from './types/index.js';

export class DrawingEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private viewport: ViewportState;
  private layers: Layer[];
  private activeLayerId: string;
  private activeStroke: Stroke | null = null;
  private commandStack: DrawingCommand[] = [];
  private redoStack: DrawingCommand[] = [];
  private isDrawing = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get 2D context');
    }
    this.ctx = ctx;
    this.viewport = {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
    };
    this.layers = [{
      id: 'default',
      name: 'Layer 1',
      visible: true,
      opacity: 1,
      locked: false,
    }];
    this.activeLayerId = 'default';
    
    this.setupCanvas();
  }

  private setupCanvas(): void {
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      this.canvas.width = this.canvas.clientWidth * dpr;
      this.canvas.height = this.canvas.clientHeight * dpr;
      this.ctx.scale(dpr, dpr);
      this.render();
    };
    
    resize();
    window.addEventListener('resize', resize);
  }

  // Viewport methods
  zoomAt(x: number, y: number, delta: number): void {
    const scaleFactor = delta > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, this.viewport.scale * scaleFactor));
    
    this.viewport.offsetX = x - (x - this.viewport.offsetX) * (newScale / this.viewport.scale);
    this.viewport.offsetY = y - (y - this.viewport.offsetY) * (newScale / this.viewport.scale);
    this.viewport.scale = newScale;
    
    this.render();
  }

  pan(dx: number, dy: number): void {
    this.viewport.offsetX += dx;
    this.viewport.offsetY += dy;
    this.render();
  }

  resetViewport(): void {
    this.viewport = {
      offsetX: 0,
      offsetY: 0,
      scale: 1,
      rotation: 0,
    };
    this.render();
  }

  // Drawing methods
  startStroke(point: Point, color: string, brushSize: number): void {
    this.isDrawing = true;
    this.activeStroke = {
      id: `stroke-${Date.now()}`,
      points: [point],
      color,
      brushSize,
      brushType: 'pen',
    };
  }

  updateStroke(point: Point): void {
    if (!this.isDrawing || !this.activeStroke) return;
    this.activeStroke.points.push(point);
    this.render();
  }

  endStroke(): void {
    if (!this.isDrawing || !this.activeStroke) return;
    this.isDrawing = false;
    
    // Add to command stack
    const command: DrawingCommand = {
      id: this.activeStroke.id,
      type: 'stroke',
      timestamp: Date.now(),
      userId: 'local',
    };
    this.commandStack.push(command);
    this.redoStack = [];
    
    this.activeStroke = null;
    this.render();
  }

  clear(): void {
    this.commandStack = [];
    this.redoStack = [];
    this.render();
  }

  undo(): void {
    const command = this.commandStack.pop();
    if (command) {
      this.redoStack.push(command);
      this.render();
    }
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (command) {
      this.commandStack.push(command);
      this.render();
    }
  }

  // Layer methods
  addLayer(name: string): string {
    const id = `layer-${Date.now()}`;
    this.layers.push({
      id,
      name,
      visible: true,
      opacity: 1,
      locked: false,
    });
    return id;
  }

  removeLayer(id: string): void {
    if (this.layers.length <= 1) return;
    this.layers = this.layers.filter(l => l.id !== id);
    if (this.activeLayerId === id) {
      this.activeLayerId = this.layers[0].id;
    }
  }

  setActiveLayer(id: string): void {
    this.activeLayerId = id;
  }

  // Render method
  render(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    
    // Clear canvas
    this.ctx.save();
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
    
    // Apply viewport transform
    this.ctx.save();
    this.ctx.translate(this.viewport.offsetX, this.viewport.offsetY);
    this.ctx.scale(this.viewport.scale, this.viewport.scale);
    this.ctx.rotate(this.viewport.rotation);
    
    // Draw all strokes from command stack (simplified)
    // In a full implementation, this would render stored strokes
    
    // Draw active stroke
    if (this.activeStroke) {
      this.drawStroke(this.activeStroke);
    }
    
    this.ctx.restore();
  }

  private drawStroke(stroke: Stroke): void {
    if (stroke.points.length < 2) return;
    
    this.ctx.beginPath();
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.brushSize;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    for (let i = 1; i < stroke.points.length; i++) {
      const p0 = stroke.points[i - 1];
      const p1 = stroke.points[i];
      
      // Simple line interpolation
      this.ctx.lineTo(p1.x, p1.y);
    }
    
    this.ctx.stroke();
  }

  // Export/Import
  exportCommands(): DrawingCommand[] {
    return [...this.commandStack];
  }

  importCommands(commands: DrawingCommand[]): void {
    this.commandStack = [...commands];
    this.redoStack = [];
    this.render();
  }

  getViewport(): ViewportState {
    return { ...this.viewport };
  }

  getLayers(): Layer[] {
    return [...this.layers];
  }
}
