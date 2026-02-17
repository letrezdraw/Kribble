export { default as DrawingCanvas } from './DrawingCanvas';
export type { DrawingCanvasProps, Point, Stroke, Transform, ToolType, InputState, InputContext, PointerData } from './types';
export { createShortcuts, matchesShortcut, getShortcutDisplay, shortcutHelpText, toolShortcuts } from './keyboardShortcuts';
export type { ShortcutAction, ShortcutContext } from './keyboardShortcuts';

// Hooks
export { useCanvasState, useInputHandler, useSocketEvents, useDrawingOperations } from './hooks';
export type { 
  UseCanvasStateOptions, 
  UseInputHandlerOptions, 
  UseSocketEventsOptions, 
  UseDrawingOperationsOptions 
} from './hooks';
