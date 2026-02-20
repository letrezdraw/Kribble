// Legacy Drawing Canvas (stroke-based)
export { default as DrawingCanvas } from './DrawingCanvas';

// New Drawing Canvas V2 (command-based protocol)
export { default as DrawingCanvasV2 } from './DrawingCanvasV2';

// Canvas Engine for command protocol
export { CanvasEngine } from './CanvasEngine';

// Types
export type { DrawingCanvasProps, Point, Stroke, Transform, ToolType, InputState, InputContext, PointerData } from './types';
export type { 
  CanvasCommand, 
  CanvasCommandType, 
  StartStrokePayload, 
  AddPointsPayload, 
  EndStrokePayload,
  ClearCanvasPayload,
  UndoPayload,
  RedoPayload,
  ToolUpdatePayload,
  CommandHistory
} from './types';

// Keyboard shortcuts
export { createShortcuts, matchesShortcut, getShortcutDisplay, shortcutHelpText, toolShortcuts } from './keyboardShortcuts';
export type { ShortcutAction, ShortcutContext } from './keyboardShortcuts';

// Hooks
export { 
  useCanvasState, 
  useInputHandler, 
  useSocketEvents, 
  useDrawingOperations,
  useCanvasEngine 
} from './hooks';
export type { 
  UseCanvasStateOptions, 
  UseInputHandlerOptions, 
  UseSocketEventsOptions, 
  UseDrawingOperationsOptions,
  UseCanvasEngineReturn
} from './hooks';
