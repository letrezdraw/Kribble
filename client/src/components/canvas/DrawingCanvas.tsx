import { useEffect, useRef, useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { useSocket } from '../../contexts/SocketContext';
import './DrawingCanvas.css';

import type { Point, Stroke, Transform, ToolType, DrawingCanvasProps } from './types';
import { getPos, getPosFromEvent, getTouchDistance } from './coordinates';
import {
  initCanvas,
  initBackgroundCanvas,
  drawPreviewShape,
  drawStroke,
  redrawAllStrokes,
  drawText,
  floodFill,
  drawShape,
  clearCanvas,
} from './drawingTools';


import { TransformControls } from './TransformControls';
import { TextInputOverlay } from './TextInput';

const CANVAS_SIZE = 800;

// Chunk size for multiplayer sync
const SYNC_CHUNK_SIZE = 10;
const SYNC_INTERVAL_MS = 50;

interface PressurePoint extends Point {
  pressure: number;
  tiltX?: number;
  tiltY?: number;
}

interface CanvasState {
  strokes: Stroke[];
  redoStack: Stroke[];
}

export default function DrawingCanvas({
  isDrawer,
  brushColor,
  brushSize,
  brushOpacity,
  activeTool,
  shapeType = 'rect',
  onUndo,
  onRedo,
  onClear,
  onToolChange,
  onBrushSizeChange,
  onBrushColorChange,
  isMobile = false,
}: DrawingCanvasProps & {
  onToolChange?: (tool: ToolType) => void;
  onBrushSizeChange?: (size: number) => void;
  onBrushColorChange?: (color: string) => void;
  isMobile?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const staticCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const liveCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const { socket } = useSocket();


  // Canvas state
  const canvasStateRef = useRef<CanvasState>({ strokes: [], redoStack: [] });
  const currentStrokeRef = useRef<PressurePoint[]>([]);
  const currentStrokeIdRef = useRef<string>('');
  
  // UI state
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [showTransformControls, setShowTransformControls] = useState(false);
  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: '' });
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  // Transform - mobile 50%, desktop 100%
  const [transform, setTransform] = useState<Transform>({
    scale: isMobile ? 0.5 : 1.0,
    translateX: 0,
    translateY: 0,
    rotation: 0,
  });

  const transformRef = useRef<Transform>(transform);
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  // Refs for drawing
  const shapeStartRef = useRef<Point | null>(null);
  const panStartRef = useRef<Point | null>(null);
  const zoomStartRef = useRef<{ x: number; y: number; initialScale: number } | null>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);
  const smoothedPressureRef = useRef<number>(1);
  const keysPressedRef = useRef<Set<string>>(new Set());
  const lastSyncTimeRef = useRef<number>(0);
  const syncedPointCountRef = useRef<number>(0);

  // Initialize canvases
  useEffect(() => {
    if (!backgroundCanvasRef.current || !staticCanvasRef.current || !liveCanvasRef.current) return;
    
    const backgroundCanvas = backgroundCanvasRef.current;
    const staticCanvas = staticCanvasRef.current;
    const liveCanvas = liveCanvasRef.current;
    
    // Initialize background canvas (white, locked, never cleared)
    backgroundCanvas.width = CANVAS_SIZE;
    backgroundCanvas.height = CANVAS_SIZE;
    backgroundCtxRef.current = initBackgroundCanvas(backgroundCanvas);
    
    // Initialize drawing canvas (transparent, all drawing happens here)
    staticCanvas.width = CANVAS_SIZE;
    staticCanvas.height = CANVAS_SIZE;
    staticCtxRef.current = initCanvas(staticCanvas);
    
    // Initialize live canvas (preview strokes)
    liveCanvas.width = CANVAS_SIZE;
    liveCanvas.height = CANVAS_SIZE;
    const liveCtx = liveCanvas.getContext('2d')!;
    liveCtx.lineCap = 'round';
    liveCtx.lineJoin = 'round';
    liveCtxRef.current = liveCtx;
    
    liveCanvas.style.touchAction = 'none';

    
    // FIX: Add native touch event listeners with { passive: false } to allow preventDefault
    const handleTouchStartNative = (e: TouchEvent) => {
      e.preventDefault();
      const touches = e.touches;
      
      if (!isDrawer) {
        if (touches.length === 1) {
          setIsPanning(true);
          panStartRef.current = { x: touches[0].clientX, y: touches[0].clientY };
        } else if (touches.length === 2) {
          lastTouchDistanceRef.current = getTouchDistance(touches);
        }
        return;
      }
      
      if (touches.length === 1) {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pos = getPos({ clientX: touches[0].clientX, clientY: touches[0].clientY } as React.MouseEvent, containerRef, transformRef.current);
        setIsDrawing(true);
        shapeStartRef.current = pos;
        currentStrokeRef.current = [{ x: pos.x, y: pos.y, pressure: 1 }];
        currentStrokeIdRef.current = Date.now().toString();
        syncedPointCountRef.current = 0;
      } else if (touches.length === 2) {
        setIsDrawing(false);
        clearLiveCanvas();
        currentStrokeRef.current = [];
        lastTouchDistanceRef.current = getTouchDistance(touches);
      }
    };

    const handleTouchMoveNative = (e: TouchEvent) => {
      e.preventDefault();
      const touches = e.touches;
      
      if (!isDrawer) {
        if (touches.length === 1 && isPanning && panStartRef.current) {
          const touch = touches[0];
          const dx = touch.clientX - panStartRef.current.x;
          const dy = touch.clientY - panStartRef.current.y;
          setTransform(prev => ({
            ...prev,
            translateX: prev.translateX + dx * 0.5,
            translateY: prev.translateY + dy * 0.5,
          }));
          panStartRef.current = { x: touch.clientX, y: touch.clientY };
        } else if (touches.length === 2 && lastTouchDistanceRef.current) {
          const currentDistance = getTouchDistance(touches);
          const scaleFactor = currentDistance / lastTouchDistanceRef.current;
          setTransform(prev => ({
            ...prev,
            scale: Math.max(0.01, Math.min(3, prev.scale * scaleFactor)),
          }));
        }
        return;
      }
      
      if (touches.length === 1 && isDrawing) {
        const pos = getPos({ clientX: touches[0].clientX, clientY: touches[0].clientY } as React.MouseEvent, containerRef, transformRef.current);
        
        currentStrokeRef.current.push({ x: pos.x, y: pos.y, pressure: 1 });
        
        if (activeTool === 'brush' || activeTool === 'eraser') {
          renderLiveStroke();
          syncStrokeChunk();
        } else if (['rect', 'circle', 'line'].includes(activeTool)) {
          clearLiveCanvas();
          const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1];
          drawPreviewShape(
            liveCtxRef.current!,
            shapeStartRef.current!,
            endPos,
            activeTool as 'rect' | 'circle' | 'line',
            brushColor,
            brushSize,
            brushOpacity
          );
        }
      }
    };

    const handleTouchEndNative = (e: TouchEvent) => {
      const touches = e.touches;
      
      if (!isDrawer) {
        if (touches.length === 0) {
          setIsPanning(false);
          panStartRef.current = null;
          lastTouchDistanceRef.current = null;
        }
        return;
      }
      
      if (touches.length === 0) {
        if (isDrawing && staticCtxRef.current && liveCtxRef.current && socket) {
          setIsDrawing(false);
          
          let stroke: Stroke;
          if (['rect', 'circle', 'line'].includes(activeTool)) {
            const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1] || shapeStartRef.current!;
            stroke = {
              id: Date.now().toString(),
              tool: 'shape',
              shapeType: activeTool as 'rect' | 'circle' | 'line',
              points: [],
              startPoint: shapeStartRef.current!,
              endPoint: { x: endPos.x, y: endPos.y },
              color: brushColor,
              size: brushSize,
              opacity: brushOpacity,
            };
            drawShape(staticCtxRef.current, stroke);
          } else {
            stroke = {
              id: Date.now().toString(),
              tool: activeTool as ToolType,
              points: currentStrokeRef.current.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
              color: brushColor,
              size: brushSize,
              opacity: brushOpacity,
            };
            drawStroke(staticCtxRef.current, stroke);
          }
          
          canvasStateRef.current.strokes.push(stroke);
          canvasStateRef.current.redoStack = [];
          socket.emit('draw:stroke', { stroke });
          
          clearLiveCanvas();
          currentStrokeRef.current = [];
          shapeStartRef.current = null;
        }
      }
    };
    
    // Add native event listeners with { passive: false }
    liveCanvas.addEventListener('touchstart', handleTouchStartNative, { passive: false });
    liveCanvas.addEventListener('touchmove', handleTouchMoveNative, { passive: false });
    liveCanvas.addEventListener('touchend', handleTouchEndNative, { passive: false });
    
    // Expose controls

    (window as any).canvasControls = {
      clear: clearCanvasInternal,
      undo: undoInternal,
      redo: redoInternal,
      zoomIn: () => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) })),
      zoomOut: () => setTransform(prev => ({ ...prev, scale: Math.max(0.01, prev.scale / 1.2) })),
      resetTransform: () => setTransform({ scale: isMobile ? 0.5 : 1.0, translateX: 0, translateY: 0, rotation: 0 }),
      rotate: (dir: 'cw' | 'ccw') => setTransform(prev => ({ ...prev, rotation: prev.rotation + (dir === 'cw' ? 90 : -90) })),
    };
  }, [isMobile]);

  // Clear live canvas
  const clearLiveCanvas = useCallback(() => {
    if (!liveCtxRef.current) return;
    liveCtxRef.current.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }, []);

  // Render live stroke
  const renderLiveStroke = useCallback(() => {
    if (!liveCtxRef.current || currentStrokeRef.current.length < 2) return;
    
    const ctx = liveCtxRef.current;
    const points = currentStrokeRef.current;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const baseRadius = brushSize / 2;
    const spacing = Math.max(1, baseRadius * 0.1);
    
    let lastPoint = points[0];
    
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const dx = p.x - lastPoint.x;
      const dy = p.y - lastPoint.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < spacing) continue;
      
      const pressure = p.pressure || 1;
      const radius = baseRadius * (0.2 + pressure * 0.8);
      const alpha = brushOpacity * pressure;
      
      // FIX: Use destination-out for eraser to actually erase pixels
      if (activeTool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = brushColor;
        ctx.globalAlpha = alpha;
      }
      
      // Draw circle at point
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Interpolate if gap is large
      if (dist > spacing * 2) {
        const steps = Math.floor(dist / spacing);
        for (let j = 1; j < steps; j++) {
          const t = j / steps;
          const ix = lastPoint.x + dx * t;
          const iy = lastPoint.y + dy * t;
          ctx.beginPath();
          ctx.arc(ix, iy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      lastPoint = p;
    }
  }, [activeTool, brushColor, brushSize, brushOpacity]);


  // Sync stroke chunk to server
  const syncStrokeChunk = useCallback(() => {
    if (!socket || !isDrawing) return;
    
    const now = Date.now();
    if (now - lastSyncTimeRef.current < SYNC_INTERVAL_MS) return;
    lastSyncTimeRef.current = now;
    
    const points = currentStrokeRef.current;
    const lastSynced = syncedPointCountRef.current;
    
    if (points.length > lastSynced + 2) {
      const chunk = points.slice(lastSynced);
      syncedPointCountRef.current = points.length;
      
      socket.emit('draw:stroke:chunk', {
        strokeId: currentStrokeIdRef.current,
        points: chunk.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
        tool: activeTool,
        color: brushColor,
        size: brushSize,
      });
    }
  }, [socket, isDrawing, activeTool, brushColor, brushSize]);

  // Process pointer event
  const processPointerEvent = useCallback((e: PointerEvent) => {
    if (!isDrawing || !isDrawer) return;
    
    const pos = getPosFromEvent(e, containerRef, transformRef.current);
    const isPen = e.pointerType === 'pen';
    let rawPressure = isPen ? (e.pressure > 0 ? e.pressure : 0.5) : 1;
    
    // Smooth pressure
    const prevSmoothed = smoothedPressureRef.current;
    const newSmoothed = prevSmoothed + (rawPressure - prevSmoothed) * 0.35;
    smoothedPressureRef.current = newSmoothed;
    
    const pressurePoint: PressurePoint = {
      x: pos.x,
      y: pos.y,
      pressure: newSmoothed,
      tiltX: (e as any).tiltX,
      tiltY: (e as any).tiltY,
    };
    
    currentStrokeRef.current.push(pressurePoint);
    
    // Render to live canvas
    if (activeTool === 'brush' || activeTool === 'eraser') {
      renderLiveStroke();
    } else if (['rect', 'circle', 'line'].includes(activeTool)) {
      if (liveCtxRef.current) {
        clearLiveCanvas();
        const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1];
        drawPreviewShape(
          liveCtxRef.current,
          shapeStartRef.current!,
          endPos,
          activeTool as 'rect' | 'circle' | 'line',
          brushColor,
          brushSize,
          brushOpacity
        );
      }
    }
    
    // Sync to other players
    syncStrokeChunk();
  }, [isDrawing, isDrawer, activeTool, brushColor, brushSize, brushOpacity, renderLiveStroke, clearLiveCanvas, syncStrokeChunk]);

  // Pointer raw update
  useEffect(() => {
    if (!liveCanvasRef.current || !isDrawing) return;
    
    const liveCanvas = liveCanvasRef.current;
    const handleRawUpdate = (e: PointerEvent) => processPointerEvent(e);
    
    // @ts-ignore
    liveCanvas.addEventListener('pointerrawupdate', handleRawUpdate);
    return () => {
      // @ts-ignore
      liveCanvas.removeEventListener('pointerrawupdate', handleRawUpdate);
    };
  }, [isDrawing, processPointerEvent]);

  // Socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('draw:stroke', (data: { playerId: string; stroke: Stroke }) => {
      if (data.playerId === socket.id) return;
      canvasStateRef.current.strokes.push(data.stroke);
      drawStroke(staticCtxRef.current!, data.stroke);
    });

    socket.on('draw:stroke:chunk', (data: { playerId: string; points: Point[]; tool: ToolType; color: string; size: number }) => {
      if (data.playerId === socket.id) return;
      if (liveCtxRef.current) {
        renderChunkToCanvas(liveCtxRef.current, data.points, data.tool, data.color, data.size);
      }
    });

    socket.on('draw:clear', () => clearCanvasInternal(false));
    
    socket.on('game:round:end', () => {
      clearCanvasInternal(false);
      canvasStateRef.current = { strokes: [], redoStack: [] };
    });

    socket.on('draw:undo', () => undoInternal(false));
    socket.on('draw:redo', () => redoInternal(false));

    socket.on('canvas:sync', (data: { strokes: Stroke[] }) => {
      if (data.strokes?.length > 0) {
        canvasStateRef.current.strokes = data.strokes;
        canvasStateRef.current.redoStack = [];
        redrawAllStrokes(staticCtxRef.current!, data.strokes);
      }
    });

    return () => {
      socket.off('draw:stroke');
      socket.off('draw:stroke:chunk');
      socket.off('draw:clear');
      socket.off('game:round:end');
      socket.off('draw:undo');
      socket.off('draw:redo');
      socket.off('canvas:sync');
    };
  }, [socket]);

  // Render chunk from other players
  const renderChunkToCanvas = (ctx: CanvasRenderingContext2D, points: Point[], tool: ToolType, color: string, size: number) => {
    if (points.length < 2) return;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    const baseRadius = size / 2;
    
    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const prev = points[i - 1];
      const pressure = (p as any).pressure || 1;
      const radius = baseRadius * (0.2 + pressure * 0.8);
      
      // FIX: Use destination-out for eraser to actually erase pixels
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = color;
        ctx.globalAlpha = 1;
      }
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Interpolate
      const dx = p.x - prev.x;
      const dy = p.y - prev.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const spacing = radius * 0.5;
      
      if (dist > spacing) {
        const steps = Math.floor(dist / spacing);
        for (let j = 1; j < steps; j++) {
          const t = j / steps;
          const ix = prev.x + dx * t;
          const iy = prev.y + dy * t;
          ctx.beginPath();
          ctx.arc(ix, iy, radius, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  };


  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysPressedRef.current.add(e.key.toLowerCase());
      
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'b': e.preventDefault(); onToolChange?.('brush'); return;
        case 'e': e.preventDefault(); onToolChange?.('eraser'); return;
        case 'm': e.preventDefault(); onToolChange?.('rect'); return;
        case 'l': e.preventDefault(); onToolChange?.('circle'); return;
        case 't': e.preventDefault(); onToolChange?.('text'); return;
        case 'g': e.preventDefault(); onToolChange?.('fill'); return;
      }

      // Brush size
      if (e.key === '[') {
        e.preventDefault();
        onBrushSizeChange?.(Math.max(1, brushSize - 2));
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        onBrushSizeChange?.(Math.min(100, brushSize + 2));
        return;
      }

      // Swap colors
      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        const newColor = brushColor === '#000000' ? '#ffffff' : '#000000';
        onBrushColorChange?.(newColor);
        return;
      }

      // Ctrl/Cmd
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z': e.preventDefault(); e.shiftKey ? redo() : undo(); return;
          case 'y': e.preventDefault(); redo(); return;
          case '=': case '+': e.preventDefault(); zoomIn(); return;
          case '-': e.preventDefault(); zoomOut(); return;
          case '0': e.preventDefault(); resetTransform(); return;
        }
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (confirm('Clear the canvas?')) handleClearCanvas();
        return;
      }

    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressedRef.current.delete(e.key.toLowerCase());
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [brushColor, brushSize, onToolChange, onBrushSizeChange, onBrushColorChange]);

  // Internal functions
  const clearCanvasInternal = useCallback((emit: boolean = true) => {
    if (!staticCtxRef.current) return;
    
    // Save current strokes to redo stack before clearing (for undo support)
    const { strokes } = canvasStateRef.current;
    if (strokes.length > 0) {
      // Store a snapshot of all strokes for undo
      canvasStateRef.current.redoStack = [{
        id: 'clear-snapshot-' + Date.now(),
        tool: 'clear',
        points: [],
        color: '',
        size: 0,
        opacity: 1,
        // Store all strokes that were cleared
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
  }, [socket, onClear, clearLiveCanvas]);



  const undoInternal = useCallback((emit: boolean = true) => {
    const { strokes, redoStack } = canvasStateRef.current;
    
    // Check if there's a clear snapshot to restore
    const clearSnapshot = redoStack.find(s => s.tool === 'clear' && s.clearedStrokes);
    if (clearSnapshot && clearSnapshot.clearedStrokes) {
      // Restore all cleared strokes
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
  }, [socket, onUndo, clearLiveCanvas]);


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
  }, [socket, onRedo]);

  // Public functions
  const handleClearCanvas = useCallback(() => {
    if (!isDrawer) return;
    clearCanvasInternal(true);
  }, [isDrawer, clearCanvasInternal]);


  const undo = useCallback(() => {
    if (!isDrawer) return;
    undoInternal(true);
  }, [isDrawer, undoInternal]);

  const redo = useCallback(() => {
    if (!isDrawer) return;
    redoInternal(true);
  }, [isDrawer, redoInternal]);

  const zoomIn = useCallback(() => {
    setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform(prev => ({ ...prev, scale: Math.max(0.01, prev.scale / 1.2) }));
  }, []);

  const resetTransform = useCallback(() => {
    setTransform({ scale: isMobile ? 0.5 : 1.0, translateX: 0, translateY: 0, rotation: 0 });
  }, [isMobile]);

  // Touch handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    const touches = e.touches;
    
    if (!isDrawer) {
      if (touches.length === 1) {
        setIsPanning(true);
        panStartRef.current = { x: touches[0].clientX, y: touches[0].clientY };
      } else if (touches.length === 2) {
        lastTouchDistanceRef.current = getTouchDistance(touches);
      }
      return;
    }
    
    if (touches.length === 1) {
      const pos = getPos(e as unknown as React.MouseEvent, containerRef, transformRef.current);
      setIsDrawing(true);
      shapeStartRef.current = pos;
      currentStrokeRef.current = [{ x: pos.x, y: pos.y, pressure: 1 }];
      currentStrokeIdRef.current = Date.now().toString();
      syncedPointCountRef.current = 0;
    } else if (touches.length === 2) {
      setIsDrawing(false);
      clearLiveCanvas();
      currentStrokeRef.current = [];
      lastTouchDistanceRef.current = getTouchDistance(touches);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;
    
    if (!isDrawer) {
      if (touches.length === 1 && isPanning && panStartRef.current) {
        const touch = touches[0];
        const dx = touch.clientX - panStartRef.current.x;
        const dy = touch.clientY - panStartRef.current.y;
        setTransform(prev => ({
          ...prev,
          translateX: prev.translateX + dx * 0.5,
          translateY: prev.translateY + dy * 0.5,
        }));
        panStartRef.current = { x: touch.clientX, y: touch.clientY };
      } else if (touches.length === 2 && lastTouchDistanceRef.current) {
        const currentDistance = getTouchDistance(touches);
        const scaleFactor = currentDistance / lastTouchDistanceRef.current;
        setTransform(prev => ({
          ...prev,
          scale: Math.max(0.01, Math.min(3, prev.scale * scaleFactor)),
        }));
      }
      return;
    }
    
    if (touches.length === 1 && isDrawing) {
      const touch = touches[0];
      const pos = getPos(e as unknown as React.MouseEvent, containerRef, transformRef.current);
      
      currentStrokeRef.current.push({ x: pos.x, y: pos.y, pressure: 1 });
      
      if (activeTool === 'brush' || activeTool === 'eraser') {
        renderLiveStroke();
        syncStrokeChunk();
      } else if (['rect', 'circle', 'line'].includes(activeTool)) {
        clearLiveCanvas();
        const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1];
        drawPreviewShape(
          liveCtxRef.current!,
          shapeStartRef.current!,
          endPos,
          activeTool as 'rect' | 'circle' | 'line',
          brushColor,
          brushSize,
          brushOpacity
        );
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touches = e.touches;
    
    if (!isDrawer) {
      if (touches.length === 0) {
        setIsPanning(false);
        panStartRef.current = null;
        lastTouchDistanceRef.current = null;
      }
      return;
    }
    
    if (touches.length === 0) {
      if (isDrawing && staticCtxRef.current && liveCtxRef.current && socket) {
        setIsDrawing(false);
        
        let stroke: Stroke;
        if (['rect', 'circle', 'line'].includes(activeTool)) {
          const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1] || shapeStartRef.current!;
          stroke = {
            id: Date.now().toString(),
            tool: 'shape',
            shapeType: activeTool as 'rect' | 'circle' | 'line',
            points: [],
            startPoint: shapeStartRef.current!,
            endPoint: { x: endPos.x, y: endPos.y },
            color: brushColor,
            size: brushSize,
            opacity: brushOpacity,
          };
          drawShape(staticCtxRef.current, stroke);
        } else {
          stroke = {
            id: Date.now().toString(),
            tool: activeTool as ToolType,
            points: currentStrokeRef.current.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
            color: brushColor,
            size: brushSize,
            opacity: brushOpacity,
          };
          drawStroke(staticCtxRef.current, stroke);
        }
        
        canvasStateRef.current.strokes.push(stroke);
        canvasStateRef.current.redoStack = [];
        socket.emit('draw:stroke', { stroke });
        
        clearLiveCanvas();
        currentStrokeRef.current = [];
        shapeStartRef.current = null;
      }
    }
  };

  // Pointer handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) {
      if (e.button === 0 || e.button === 1) {
        e.preventDefault();
        setIsPanning(true);
        panStartRef.current = { x: e.clientX, y: e.clientY };
      }
      return;
    }

    if (e.button === 2) {
      e.preventDefault();
      setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
      return;
    }

    if (contextMenu.isOpen) {
      setContextMenu({ ...contextMenu, isOpen: false });
    }
    
    const isPen = e.pointerType === 'pen';
    smoothedPressureRef.current = isPen && e.pressure > 0 ? e.pressure : 1;
    
    const hasCtrl = e.ctrlKey || e.metaKey;
    const hasSpace = keysPressedRef.current.has(' ');

    if (hasCtrl && hasSpace && e.button === 0) {
      e.preventDefault();
      setIsZooming(true);
      zoomStartRef.current = { x: e.clientX, y: e.clientY, initialScale: transform.scale };
      return;
    }

    if (e.button === 1 || (e.button === 0 && hasSpace)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    e.preventDefault();
    const pos = getPos(e as unknown as React.MouseEvent, containerRef, transformRef.current);

    if (activeTool === 'text') {
      setTextInput({ visible: true, x: pos.x, y: pos.y, value: '' });
      return;
    }

    if (activeTool === 'fill') {
      const canvasState = staticCtxRef.current!.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE).data;
      floodFill(staticCtxRef.current!, pos.x, pos.y, brushColor, brushOpacity);
      const stroke: Stroke = {
        id: Date.now().toString(),
        tool: 'fill',
        points: [{ x: pos.x, y: pos.y, pressure: 1 }],
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
        canvasState: new Uint8ClampedArray(canvasState),
      };
      canvasStateRef.current.strokes.push(stroke);
      canvasStateRef.current.redoStack = [];
      socket?.emit('draw:stroke', { stroke });
      return;
    }

    setIsDrawing(true);
    shapeStartRef.current = pos;
    currentStrokeRef.current = [{ x: pos.x, y: pos.y, pressure: smoothedPressureRef.current }];
    currentStrokeIdRef.current = Date.now().toString();
    syncedPointCountRef.current = 0;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      e.preventDefault();
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform(prev => ({
        ...prev,
        translateX: prev.translateX + dx * 0.5,
        translateY: prev.translateY + dy * 0.5,
      }));
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    if (!isDrawer && !isZooming) return;

    if (isZooming && zoomStartRef.current) {
      e.preventDefault();
      const dx = e.clientX - zoomStartRef.current.x;
      const zoomFactor = Math.exp(dx * 0.01);
      const newScale = Math.max(0.01, Math.min(3, zoomStartRef.current.initialScale * zoomFactor));
      setTransform(prev => ({ ...prev, scale: newScale }));
      return;
    }

    if (!isDrawing || !liveCtxRef.current) return;
    e.preventDefault();

    const pos = getPosFromEvent(e.nativeEvent, containerRef, transformRef.current);
    const isPen = e.pointerType === 'pen';
    let rawPressure = isPen ? (e.pressure > 0 ? e.pressure : 0.5) : 1;
    
    const prevSmoothed = smoothedPressureRef.current;
    const newSmoothed = prevSmoothed + (rawPressure - prevSmoothed) * 0.35;
    smoothedPressureRef.current = newSmoothed;
    
    currentStrokeRef.current.push({
      x: pos.x,
      y: pos.y,
      pressure: newSmoothed,
    });
    
    if (activeTool === 'brush' || activeTool === 'eraser') {
      renderLiveStroke();
      syncStrokeChunk();
    } else if (['rect', 'circle', 'line'].includes(activeTool)) {
      clearLiveCanvas();
      const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1];
      drawPreviewShape(
        liveCtxRef.current,
        shapeStartRef.current!,
        endPos,
        activeTool as 'rect' | 'circle' | 'line',
        brushColor,
        brushSize,
        brushOpacity
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }

    if (isZooming) {
      setIsZooming(false);
      zoomStartRef.current = null;
      return;
    }

    if (!isDrawing || !staticCtxRef.current || !liveCtxRef.current || !socket) return;

    setIsDrawing(false);

    let stroke: Stroke;
    if (['rect', 'circle', 'line'].includes(activeTool)) {
      const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1] || shapeStartRef.current!;
      stroke = {
        id: Date.now().toString(),
        tool: 'shape',
        shapeType: activeTool as 'rect' | 'circle' | 'line',
        points: [],
        startPoint: shapeStartRef.current!,
        endPoint: { x: endPos.x, y: endPos.y },
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
      };
      drawShape(staticCtxRef.current, stroke);
    } else {
      stroke = {
        id: Date.now().toString(),
        tool: activeTool as ToolType,
        points: currentStrokeRef.current.map(p => ({ x: p.x, y: p.y, pressure: p.pressure })),
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
      };
      drawStroke(staticCtxRef.current, stroke);
    }

    canvasStateRef.current.strokes.push(stroke);
    canvasStateRef.current.redoStack = [];
    socket.emit('draw:stroke', { stroke });

    clearLiveCanvas();
    currentStrokeRef.current = [];
    shapeStartRef.current = null;
    smoothedPressureRef.current = 1;
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.01, Math.min(3, prev.scale * delta)),
    }));
  };

  const addText = (x: number, y: number, text: string) => {
    if (!staticCtxRef.current || !socket) return;

    drawText(staticCtxRef.current, x, y, text, brushColor, brushSize, brushOpacity);

    const stroke: Stroke = {
      id: Date.now().toString(),
      tool: 'text',
      points: [],
      color: brushColor,
      size: brushSize,
      opacity: brushOpacity,
      startPoint: { x, y },
      text,
    };

    canvasStateRef.current.strokes.push(stroke);
    canvasStateRef.current.redoStack = [];
    socket.emit('draw:stroke', { stroke });
    setTextInput({ visible: false, x: 0, y: 0, value: '' });
  };

  return (
    <div ref={containerRef} className="canvas-container">
      <TransformControls
        transform={transform}
        show={showTransformControls}
        onToggle={() => setShowTransformControls(!showTransformControls)}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetTransform}
        onRotate={(dir) => setTransform(prev => ({ ...prev, rotation: prev.rotation + (dir === 'cw' ? 90 : -90) }))}
      />

      <div className="canvas-viewport">
        <div 
          className={clsx('canvas-inner', { panning: isPanning })}
          style={{
            transform: `translate(${transform.translateX}px, ${transform.translateY}px) rotate(${transform.rotation}deg) scale(${transform.scale})`,
          }}
        >
          {/* Background layer - white, locked, never touched */}
          <canvas
            ref={backgroundCanvasRef}
            className="canvas-background"
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
          />
          {/* Drawing layer - all strokes drawn here */}
          <canvas
            ref={staticCanvasRef}
            className="canvas-static"
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
          />
          {/* Live layer - preview strokes */}
          <canvas
            ref={liveCanvasRef}
            className={clsx('canvas-live', { 'view-only': !isDrawer })}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          />

        </div>
      </div>

      {contextMenu.isOpen && (
        <div 
          className="context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu({ ...contextMenu, isOpen: false })}
        >
          <div className="menu-item" onClick={() => { undo(); setContextMenu({ ...contextMenu, isOpen: false }); }}>Undo</div>
          <div className="menu-item" onClick={() => { redo(); setContextMenu({ ...contextMenu, isOpen: false }); }}>Redo</div>
          <div className="menu-item danger" onClick={() => { handleClearCanvas(); setContextMenu({ ...contextMenu, isOpen: false }); }}>Clear</div>

        </div>
      )}

      <TextInputOverlay
        visible={textInput.visible}
        x={textInput.x}
        y={textInput.y}
        value={textInput.value}
        color={brushColor}
        size={brushSize}
        onChange={(value) => setTextInput(prev => ({ ...prev, value }))}
        onSubmit={() => addText(textInput.x, textInput.y, textInput.value)}
        onCancel={() => setTextInput({ visible: false, x: 0, y: 0, value: '' })}
      />
    </div>
  );
}
