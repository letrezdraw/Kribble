export interface Point {
  x: number;
  y: number;
  pressure?: number;
  timestamp?: number;
  tiltX?: number;
  tiltY?: number;
}



export interface Transform {
  scale: number;
  translateX: number;
  translateY: number;
  rotation: number;
}

export type ToolType = 'brush' | 'eraser' | 'rect' | 'circle' | 'line' | 'text' | 'fill';


export interface Stroke {
  id: string;
  tool: ToolType | 'shape';
  points: Point[];
  color: string;
  size: number;
  opacity: number;
  shapeType?: 'rect' | 'circle' | 'line';
  startPoint?: Point;
  endPoint?: Point;
  text?: string;
  pressureData?: number[]; // Array of pressure values for each point
}


export interface CanvasState {
  strokes: Stroke[];
  redoStack: Stroke[];
  isDrawing: boolean;
  isPanning: boolean;
  transform: Transform;
}

export interface DrawingCanvasProps {
  isDrawer: boolean;
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  activeTool: ToolType;
  shapeType?: 'rect' | 'circle' | 'line';
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
}
