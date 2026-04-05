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

export type ToolType = 'brush' | 'eraser' | 'rect' | 'circle' | 'line' | 'text' | 'fill' | 'clear';

// Input state machine for proper gesture separation
export type InputState = 'idle' | 'drawing' | 'panning' | 'zooming' | 'gesturing';

export interface InputContext {
  state: InputState;
  pointerType: 'mouse' | 'pen' | 'touch' | 'none';
  isSpacePressed: boolean;
  isCtrlPressed: boolean;
  isAltPressed: boolean;
  isShiftPressed: boolean;
  activePointers: Map<number, PointerData>;
  gestureStartDistance?: number;
  gestureStartScale?: number;
  gestureStartCenter?: Point;
}

export interface PointerData {
  id: number;
  type: 'mouse' | 'pen' | 'touch';
  x: number;
  y: number;
  pressure: number;
  buttons: number;
  isPrimary: boolean;
  timestamp: number;
}

// Keyboard shortcut definitions
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: string;
  description: string;
}




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
  isLive?: boolean; // Flag for live stroke preview
  canvasState?: Uint8ClampedArray; // Canvas ImageData for fill tool undo support
  clearedStrokes?: Stroke[]; // Stores all strokes for clear/undo support
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

// ==========================================
// CANVAS COMMAND PROTOCOL TYPES
// ==========================================

export type CanvasCommandType = 
  | 'START_STROKE'
  | 'ADD_POINTS'
  | 'END_STROKE'
  | 'CLEAR_CANVAS'
  | 'UNDO'
  | 'REDO'
  | 'TOOL_UPDATE'
  | 'FILL';

export interface CanvasCommand {
  id: string;
  roomId: string;
  userId: string;
  type: CanvasCommandType;
  timestamp: number;
  payload: CanvasCommandPayload;
}

export type CanvasCommandPayload = 
  | StartStrokePayload
  | AddPointsPayload
  | EndStrokePayload
  | ClearCanvasPayload
  | UndoPayload
  | RedoPayload
  | ToolUpdatePayload
  | FillPayload;

export interface StartStrokePayload {
  strokeId: string;
  tool: ToolType;
  color: string;
  size: number;
  opacity: number;
  startPoint: Point;
}

export interface AddPointsPayload {
  strokeId: string;
  points: Point[];
}

export interface EndStrokePayload {
  strokeId: string;
}

export interface ClearCanvasPayload {
  clearedStrokes?: Stroke[];
}

export interface UndoPayload {
  strokeId?: string;
}

export interface RedoPayload {
  strokeId?: string;
}

export interface ToolUpdatePayload {
  tool: ToolType;
  color?: string;
  size?: number;
  opacity?: number;
}

export interface FillPayload {
  x: number;
  y: number;
  color: string;
  tolerance?: number;
}

export interface CommandHistory {
  commands: CanvasCommand[];
  redoStack: CanvasCommand[];
}
