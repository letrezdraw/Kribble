import type { ToolType } from './types';

// Photoshop-style keyboard shortcuts
export interface ShortcutAction {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  action: (ctx: ShortcutContext) => void;
  description: string;
  category: 'tool' | 'navigation' | 'edit' | 'view';
}

export interface ShortcutContext {
  setTool: (tool: ToolType) => void;
  setBrushSize: (size: number) => void;
  setBrushColor: (color: string) => void;
  undo: () => void;
  redo: () => void;
  clear: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  pan: (dx: number, dy: number) => void;
  currentTool: ToolType;
  brushSize: number;
  brushColor: string;
  isSpacePressed: boolean;
  isCtrlPressed: boolean;
  isShiftPressed: boolean;
}

// Tool shortcuts (single key, no modifiers)
export const toolShortcuts: Record<string, ToolType> = {
  'b': 'brush',
  'e': 'eraser',
  'm': 'rect',      // Marquee in Photoshop
  'r': 'rect',      // Rectangle
  'c': 'circle',    // Circle
  'l': 'line',      // Line
  't': 'text',      // Text
  'g': 'fill',      // Paint bucket/fill
};

// Brush size shortcuts
export const brushSizeShortcuts = {
  increase: [']', '}'],
  decrease: ['[', '{'],
  step: 2,
  min: 1,
  max: 100,
};

// Opacity shortcuts (number keys 1-0 = 10%-100%)
export const opacityShortcuts: Record<string, number> = {
  '1': 0.1, '2': 0.2, '3': 0.3, '4': 0.4, '5': 0.5,
  '6': 0.6, '7': 0.7, '8': 0.8, '9': 0.9, '0': 1.0,
};

// Color shortcuts
export const colorShortcuts: Record<string, string> = {
  'd': '#000000',  // Default black
  'x': 'swap',     // Swap foreground/background
};

// Navigation shortcuts
export const navigationShortcuts = {
  zoomIn: ['=', '+', 'Equal', 'Plus'],
  zoomOut: ['-', '_', 'Minus', 'Underscore'],
  resetZoom: ['0'],
  fitToScreen: ['0'], // Ctrl+0
  actualPixels: ['1'], // Ctrl+1
};

// Edit shortcuts
export const editShortcuts = {
  undo: { key: 'z', ctrl: true, shift: false },
  redo: { key: 'z', ctrl: true, shift: true },
  redoAlt: { key: 'y', ctrl: true },
  clear: { key: 'Delete' },
  clearAlt: { key: 'Backspace' },
};

// View shortcuts
export const viewShortcuts = {
  toggleGrid: { key: 'g', ctrl: true },
  toggleRulers: { key: 'r', ctrl: true },
};

// Create all shortcuts configuration
export function createShortcuts(ctx: ShortcutContext): ShortcutAction[] {
  return [
    // Tool selection
    { key: 'b', action: () => ctx.setTool('brush'), description: 'Brush tool', category: 'tool' },
    { key: 'e', action: () => ctx.setTool('eraser'), description: 'Eraser tool', category: 'tool' },
    { key: 'm', action: () => ctx.setTool('rect'), description: 'Rectangle tool', category: 'tool' },
    { key: 'r', action: () => ctx.setTool('rect'), description: 'Rectangle tool', category: 'tool' },
    { key: 'c', action: () => ctx.setTool('circle'), description: 'Circle tool', category: 'tool' },
    { key: 'l', action: () => ctx.setTool('line'), description: 'Line tool', category: 'tool' },
    { key: 't', action: () => ctx.setTool('text'), description: 'Text tool', category: 'tool' },
    { key: 'g', action: () => ctx.setTool('fill'), description: 'Fill tool', category: 'tool' },
    
    // Brush size
    { key: ']', action: () => ctx.setBrushSize(Math.min(100, ctx.brushSize + 2)), description: 'Increase brush size', category: 'tool' },
    { key: '[', action: () => ctx.setBrushSize(Math.max(1, ctx.brushSize - 2)), description: 'Decrease brush size', category: 'tool' },
    
    // Color swap
    { key: 'x', action: () => {
      const newColor = ctx.brushColor === '#000000' ? '#ffffff' : '#000000';
      ctx.setBrushColor(newColor);
    }, description: 'Swap foreground/background color', category: 'tool' },
    
    // Edit operations
    { key: 'z', ctrl: true, shift: false, action: () => ctx.undo(), description: 'Undo', category: 'edit' },
    { key: 'z', ctrl: true, shift: true, action: () => ctx.redo(), description: 'Redo', category: 'edit' },
    { key: 'y', ctrl: true, action: () => ctx.redo(), description: 'Redo (alternate)', category: 'edit' },
    { key: 'Delete', action: () => ctx.clear(), description: 'Clear canvas', category: 'edit' },
    { key: 'Backspace', action: () => ctx.clear(), description: 'Clear canvas', category: 'edit' },
    
    // View operations
    { key: '=', ctrl: true, action: () => ctx.zoomIn(), description: 'Zoom in', category: 'view' },
    { key: '+', ctrl: true, action: () => ctx.zoomIn(), description: 'Zoom in', category: 'view' },
    { key: '-', ctrl: true, action: () => ctx.zoomOut(), description: 'Zoom out', category: 'view' },
    { key: '0', ctrl: true, action: () => ctx.resetZoom(), description: 'Reset zoom', category: 'view' },
  ];
}

// Check if a keyboard event matches a shortcut
export function matchesShortcut(event: KeyboardEvent, shortcut: ShortcutAction): boolean {
  const key = event.key.toLowerCase();
  const shortcutKey = shortcut.key.toLowerCase();
  
  if (key !== shortcutKey) return false;
  
  const ctrl = event.ctrlKey || event.metaKey;
  const shift = event.shiftKey;
  const alt = event.altKey;
  
  if (shortcut.ctrl !== undefined && shortcut.ctrl !== ctrl) return false;
  if (shortcut.shift !== undefined && shortcut.shift !== shift) return false;
  if (shortcut.alt !== undefined && shortcut.alt !== alt) return false;
  
  return true;
}

// Get shortcut display text
export function getShortcutDisplay(shortcut: ShortcutAction): string {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push('Ctrl');
  if (shortcut.shift) parts.push('Shift');
  if (shortcut.alt) parts.push('Alt');
  if (shortcut.meta) parts.push('Cmd');
  parts.push(shortcut.key.toUpperCase());
  return parts.join('+');
}

// Help text for all shortcuts
export const shortcutHelpText = `
TOOL SHORTCUTS:
  B - Brush
  E - Eraser
  M/R - Rectangle
  C - Circle
  L - Line
  T - Text
  G - Fill

BRUSH:
  [ / ] - Decrease/Increase size
  X - Swap colors (Black/White)

EDIT:
  Ctrl+Z - Undo
  Ctrl+Shift+Z / Ctrl+Y - Redo
  Delete/Backspace - Clear canvas

VIEW:
  Ctrl++ / Ctrl+- - Zoom in/out
  Ctrl+0 - Reset zoom
  Space+Drag - Pan
  Ctrl+Space+Drag - Zoom
`;
