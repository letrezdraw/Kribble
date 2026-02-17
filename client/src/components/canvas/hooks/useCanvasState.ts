import { useRef, useCallback } from 'react';
import type { Stroke, ToolType, Point } from '../types';
import { drawStroke, drawShape, redrawAllStrokes, clearCanvas, floodFill } from '../drawingTools';

interface CanvasState {
  strokes: Stroke[];
  redoStack: Stroke[];
}

export interface UseCanvasStateOptions {

  staticCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  liveCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  socket: any;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
}

export function useCanvasState({
  staticCtxRef,
  liveCtxRef,
  socket,
  onUndo,
  onRedo,
  onClear,
}: UseCanvasStateOptions) {
  const canvasStateRef = useRef<CanvasState>({ strokes: [], redoStack: [] });
  const currentStrokeRef = useRef<Point[]>([]);
  const currentStrokeIdRef = useRef<string>('');
  const syncedPointCountRef = useRef<number>(0);
  const lastSyncTimeRef = useRef<number>(0);

  const clearLiveCanvas = useCallback(() => {
    if (!liveCtxRef.current) return;
    liveCtxRef.current.clearRect(0, 0, 800, 800);
  }, [liveCtxRef]);

  const clearCanvasInternal = useCallback((emit: boolean = true) => {
    if (!staticCtxRef.current) return;
    
    const { strokes } = canvasStateRef.current;
    if (strokes.length > 0) {
      canvasStateRef.current.redoStack = [{
        id: 'clear-snapshot-' + Date.now(),
        tool: 'clear',
        points: [],
        color: '',
        size: 0,
        opacity: 1,
        clearedStrokes: [...strokes]
      }];
    }
    
    clearCanvas(staticCtxRef.current);
    clearLiveCanvas();
    canvasStateRef.current.strokes = [];
    
    if (emit) {
      socket?.emit('draw:clear');
      onClear?.();
    }
  }, [socket, onClear, clearLiveCanvas, staticCtxRef]);

  const undoInternal = useCallback((emit: boolean = true) => {
    const { strokes, redoStack } = canvasStateRef.current;
    
    const clearSnapshot = redoStack.find(s => s.tool === 'clear' && s.clearedStrokes);
    if (clearSnapshot && clearSnapshot.clearedStrokes) {
      canvasStateRef.current.strokes = [...clearSnapshot.clearedStrokes];
      canvasStateRef.current.redoStack = [];
      redrawAllStrokes(staticCtxRef.current!, canvasStateRef.current.strokes);
      clearLiveCanvas();
      
      if (emit) {
        socket?.emit('draw:undo');
        onUndo?.();
      }
      return;
    }
    
    if (strokes.length === 0) return;
    
    const removed = strokes.pop()!;
    redoStack.push(removed);
    redrawAllStrokes(staticCtxRef.current!, strokes);
    clearLiveCanvas();
    
    if (emit) {
      socket?.emit('draw:undo');
      onUndo?.();
    }
  }, [socket, onUndo, clearLiveCanvas, staticCtxRef]);

  const redoInternal = useCallback((emit: boolean = true) => {
    const { strokes, redoStack } = canvasStateRef.current;
    if (redoStack.length === 0) return;
    
    const stroke = redoStack.pop()!;
    strokes.push(stroke);
    drawStroke(staticCtxRef.current!, stroke);
    
    if (emit) {
      socket?.emit('draw:redo');
      onRedo?.();
    }
  }, [socket, onRedo, staticCtxRef]);

  const addStroke = useCallback((stroke: Stroke, emit: boolean = true) => {
    canvasStateRef.current.strokes.push(stroke);
    canvasStateRef.current.redoStack = [];
    
    if (emit && socket) {
      socket.emit('draw:stroke', { stroke });
    }
  }, [socket]);

  const syncStrokeChunk = useCallback((
    activeTool: ToolType,
    brushColor: string,
    brushSize: number,
    isDrawing: boolean
  ) => {
    if (!socket || !isDrawing) return;
    
    const now = Date.now();
    if (now - lastSyncTimeRef.current < 50) return;
    lastSyncTimeRef.current = now;
    
    const points = currentStrokeRef.current;
    const lastSynced = syncedPointCountRef.current;
    
    if (points.length > lastSynced + 2) {
      const chunk = points.slice(lastSynced);
      syncedPointCountRef.current = points.length;
      
      socket.emit('draw:stroke:chunk', {
        strokeId: currentStrokeIdRef.current,
        points: chunk.map(p => ({ x: p.x, y: p.y, pressure: (p as any).pressure })),
        tool: activeTool,
        color: brushColor,
        size: brushSize,
      });
    }
  }, [socket]);

  return {
    canvasStateRef,
    currentStrokeRef,
    currentStrokeIdRef,
    syncedPointCountRef,
    clearLiveCanvas,
    clearCanvasInternal,
    undoInternal,
    redoInternal,
    addStroke,
    syncStrokeChunk,
  };
}
