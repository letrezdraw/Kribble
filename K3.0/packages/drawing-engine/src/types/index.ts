// Drawing Engine Type Definitions

export interface Point {
  x: number;
  y: number;
  pressure?: number;
  timestamp: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  brushSize: number;
  brushType: BrushType;
}

export type BrushType = 'pen' | 'pencil' | 'marker' | 'eraser';

export interface ViewportState {
  offsetX: number;
  offsetY: number;
  scale: number;
  rotation: number;
}

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
}

export interface DrawingCommand {
  id: string;
  type: 'stroke' | 'clear' | 'undo' | 'redo' | 'layer';
  timestamp: number;
  userId: string;
}

export interface StrokeCommand extends DrawingCommand {
  type: 'stroke';
  action: 'start' | 'update' | 'end';
  stroke: Stroke;
}

export interface ClearCommand extends DrawingCommand {
  type: 'clear';
}

export interface LayerCommand extends DrawingCommand {
  type: 'layer';
  action: 'add' | 'remove' | 'update';
  layer: Layer;
}
