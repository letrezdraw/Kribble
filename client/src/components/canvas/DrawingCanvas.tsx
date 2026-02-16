import { useEffect, useRef, useCallback, useState } from 'react';
import { clsx } from 'clsx';
import { useSocket } from '../../contexts/SocketContext';
import './DrawingCanvas.css';

import type { Point, Stroke, Transform, ToolType, DrawingCanvasProps } from './types';
import { getPos, getPosFromEvent, getTouchDistance } from './coordinates';
import {
  initCanvas,
  setupBrush,
  setupEraser,
  drawPreviewShape,
  drawStroke,
  redrawAllStrokes,
  drawText,
  floodFill,
  drawShape,
} from './drawingTools';

import { TransformControls } from './TransformControls';
import { TextInputOverlay } from './TextInput';
import { BrushSettingsMenu } from './BrushSettingsMenu';

const CANVAS_SIZE = 800;

// Brush settings type
interface BrushSettings {
  minSpacing: number;
  spacingMultiplier: number;
  interpolationThreshold: number;
  pressureSmoothing: number;
  showLivePreview: boolean;
}

const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  minSpacing: 0.1,
  spacingMultiplier: 0.02,
  interpolationThreshold: 1.01,
  pressureSmoothing: 0.35,
  showLivePreview: true,
};

// Pressure-sensitive point interface
interface PressurePoint extends Point {
  pressure: number;
  tiltX?: number;
  tiltY?: number;
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
  onBrushOpacityChange,
}: DrawingCanvasProps & {
  onToolChange?: (tool: ToolType) => void;
  onBrushSizeChange?: (size: number) => void;
  onBrushColorChange?: (color: string) => void;
  onBrushOpacityChange?: (opacity: number) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const liveCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const { socket } = useSocket();

  // RAF rendering state
  const needsRenderRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Gesture state machine for mobile
  type GestureState = 'idle' | 'drawing' | 'panning' | 'zooming' | 'multi-touch';
  const [gestureState, setGestureState] = useState<GestureState>('idle');
  
  // Legacy states for compatibility
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [isZooming, setIsZooming] = useState(false);
  const [isBrushSizing, setIsBrushSizing] = useState(false);
  const [displaySize, setDisplaySize] = useState({ width: CANVAS_SIZE, height: CANVAS_SIZE });
  const [showTransformControls, setShowTransformControls] = useState(false);

  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    rotation: 0,
  });
  
  // Use ref to always have latest transform for coordinate calculations
  const transformRef = useRef<Transform>(transform);
  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);


  const strokesRef = useRef<Stroke[]>([]);
  const redoStackRef = useRef<Stroke[]>([]);
  const currentStrokeRef = useRef<PressurePoint[]>([]);
  const lastRenderedIndexRef = useRef<number>(0);
  const shapeStartRef = useRef<Point | null>(null);

  const panStartRef = useRef<Point | null>(null);
  const zoomStartRef = useRef<{ x: number; y: number; initialScale: number } | null>(null);
  const brushSizeStartRef = useRef<{ x: number; initialSize: number } | null>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);
  const currentPressureRef = useRef<number>(1);
  const smoothedPressureRef = useRef<number>(1);
  const isPenActiveRef = useRef<boolean>(false);
  const keysPressedRef = useRef<Set<string>>(new Set());
  
  // Pressure smoothing constant (0-1, higher = more smoothing)
  const PRESSURE_SMOOTHING = 0.35;

  // Pressure curve with minimum stroke size (2-5px) and tapering support
  const MIN_STROKE_SIZE_PX = 3; // Minimum stroke size in pixels
  const applyPressureCurve = (pressure: number, isTapering: boolean = false): number => {
    const clampedPressure = Math.max(0, Math.min(1, pressure));
    if (isTapering) {
      // When tapering, go to 0
      return clampedPressure;
    }
    // Normal pressure: map to range [minSize, maxSize]
    const minRatio = Math.min(0.3, (MIN_STROKE_SIZE_PX * 2) / brushSize);
    return minRatio + Math.pow(clampedPressure, 0.7) * (1 - minRatio);
  };

  const [textInput, setTextInput] = useState({ visible: false, x: 0, y: 0, value: '' });
  
  // Brush settings with right-click menu
  const [brushSettings, setBrushSettings] = useState<BrushSettings>(DEFAULT_BRUSH_SETTINGS);
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  // Initialize canvases - ONLY ONCE on mount
  useEffect(() => {
    if (!staticCanvasRef.current || !liveCanvasRef.current) return;
    
    const staticCanvas = staticCanvasRef.current;
    const liveCanvas = liveCanvasRef.current;
    
    // Set canvas size to match display size for proper coordinate mapping
    staticCanvas.width = CANVAS_SIZE;
    staticCanvas.height = CANVAS_SIZE;
    liveCanvas.width = CANVAS_SIZE;
    liveCanvas.height = CANVAS_SIZE;
    
    // Canvases are sized via CSS to 800x800, no need to set style dimensions
    
    staticCtxRef.current = initCanvas(staticCanvas);

    
    const liveCtx = liveCanvas.getContext('2d')!;
    liveCtx.lineCap = 'round';
    liveCtx.lineJoin = 'round';
    liveCtxRef.current = liveCtx;
    
    liveCanvas.style.touchAction = 'none';
    
    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);


  // Separate effect for pointerrawupdate listener
  useEffect(() => {
    if (!liveCanvasRef.current) return;
    
    const liveCanvas = liveCanvasRef.current;
    
    const handleRawUpdate = (e: PointerEvent) => {
      if (!isDrawing) return;
      processPointerEvent(e);
    };
    
    // @ts-ignore
    liveCanvas.addEventListener('pointerrawupdate', handleRawUpdate);
    
    return () => {
      // @ts-ignore
      liveCanvas.removeEventListener('pointerrawupdate', handleRawUpdate);
    };
  }, [isDrawing]);

  // Handle resize - update display size for coordinate calculations
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      // Use the actual container dimensions, not min dimension
      // This ensures the canvas fills the available space
      setDisplaySize({ width: rect.width, height: rect.height });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);


  // Socket events
  useEffect(() => {
    if (!socket) return;

    socket.on('draw:stroke', (data: { playerId: string; stroke: Stroke }) => {
      if (data.playerId === socket.id) return;
      strokesRef.current.push(data.stroke);
      drawStroke(staticCtxRef.current!, data.stroke);
    });

    socket.on('draw:clear', () => {
      strokesRef.current = [];
      redoStackRef.current = [];
      redrawAllStrokes(staticCtxRef.current!, []);
      clearLiveCanvas();
    });

    socket.on('draw:undo', () => undoInternal());
    socket.on('draw:redo', () => redoInternal());

    return () => {
      socket.off('draw:stroke');
      socket.off('draw:clear');
      socket.off('draw:undo');
      socket.off('draw:redo');
    };
  }, [socket]);

  // Keyboard shortcuts - Photoshop style
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Track pressed keys
      keysPressedRef.current.add(e.key.toLowerCase());
      const keys = keysPressedRef.current;
      
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Tool shortcuts
      switch (e.key.toLowerCase()) {
        case 'b': // Brush
          e.preventDefault();
          onToolChange?.('brush');
          return;
        case 'e': // Eraser
          e.preventDefault();
          onToolChange?.('eraser');
          return;
        case 'm': // Marquee/Rectangle
          e.preventDefault();
          onToolChange?.('rect');
          return;
        case 'l': // Lasso/Circle
          e.preventDefault();
          onToolChange?.('circle');
          return;
        case 't': // Type/Text
          e.preventDefault();
          onToolChange?.('text');
          return;
        case 'g': // Paint Bucket/Fill
          e.preventDefault();
          onToolChange?.('fill');
          return;
        case 'v': // Move/Pan mode
          e.preventDefault();
          // Space is already handled in pointer events
          return;
      }

      // Brush size shortcuts [ and ]
      if (e.key === '[') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift + [ = decrease opacity
          onBrushOpacityChange?.(Math.max(1, brushOpacity - 10));
        } else {
          // [ = decrease brush size
          onBrushSizeChange?.(Math.max(1, brushSize - 2));
        }
        return;
      }
      if (e.key === ']') {
        e.preventDefault();
        if (e.shiftKey) {
          // Shift + ] = increase opacity
          onBrushOpacityChange?.(Math.min(100, brushOpacity + 10));
        } else {
          // ] = increase brush size
          onBrushSizeChange?.(Math.min(100, brushSize + 2));
        }
        return;
      }

      // Opacity shortcuts 0-9
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        const opacity = e.key === '0' ? 100 : parseInt(e.key) * 10;
        onBrushOpacityChange?.(opacity);
        return;
      }

      // X - Swap foreground/background (toggle black/white)
      if (e.key.toLowerCase() === 'x') {
        e.preventDefault();
        const newColor = brushColor === '#000000' ? '#ffffff' : '#000000';
        onBrushColorChange?.(newColor);
        return;
      }

      // View shortcuts with Ctrl/Cmd
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              redo();
            } else {
              undo();
            }
            return;
          case 'y':
            e.preventDefault();
            redo();
            return;
          case '=':
          case '+':
            e.preventDefault();
            zoomIn();
            return;
          case '-':
            e.preventDefault();
            zoomOut();
            return;
          case '0':
            e.preventDefault();
            resetTransform();
            return;
          case '[':
            e.preventDefault();
            rotate('ccw');
            return;
          case ']':
            e.preventDefault();
            rotate('cw');
            return;
        }
      }

      // Delete/Backspace - Clear canvas
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (confirm('Clear the canvas?')) {
          clearCanvas();
        }
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
  }, [brushColor, brushSize, brushOpacity, onToolChange, onBrushSizeChange, onBrushColorChange, onBrushOpacityChange]);

  // Clear live canvas helper
  const clearLiveCanvas = useCallback(() => {
    if (!liveCtxRef.current || !liveCanvasRef.current) return;
    liveCtxRef.current.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }, []);

  // Render stroke immediately to live canvas - only render NEW points since last render
  const renderStrokeImmediate = useCallback((ctx: CanvasRenderingContext2D, points: PressurePoint[]) => {
    if (points.length < 2) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const baseRadius = brushSize / 2;
    const minSpacing = brushSettings.minSpacing;
    const spacingMult = brushSettings.spacingMultiplier;
    const interpThreshold = brushSettings.interpolationThreshold;

    // Get the starting point - either from last rendered position or first point
    let lastStamp: PressurePoint;
    let startIndex: number;
    
    if (lastRenderedIndexRef.current > 0 && lastRenderedIndexRef.current < points.length) {
      // Continue from where we left off
      lastStamp = points[lastRenderedIndexRef.current];
      startIndex = lastRenderedIndexRef.current + 1;
    } else {
      // Start fresh
      lastStamp = points[0];
      startIndex = 1;
    }

    for (let i = startIndex; i < points.length; i++) {
      const p = points[i];

      const dx = p.x - lastStamp.x;
      const dy = p.y - lastStamp.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      const mappedPressure = applyPressureCurve(p.pressure, false);

      const stampRadius = baseRadius * mappedPressure;

      // spacing based on settings
      const spacing = Math.max(minSpacing, stampRadius * spacingMult);

      if (dist < spacing) continue;

      // Interpolation based on settings threshold
      if (dist > spacing * interpThreshold) {
        const steps = Math.floor(dist / spacing);
        for (let j = 1; j <= steps; j++) {
          const t = j / steps;
          const interpX = lastStamp.x + dx * t;
          const interpY = lastStamp.y + dy * t;
          const interpPressure = lastStamp.pressure + (p.pressure - lastStamp.pressure) * t;
          const interpMappedPressure = applyPressureCurve(interpPressure, false);

          const interpStampRadius = baseRadius * interpMappedPressure;
          const interpOpacity = brushOpacity * interpMappedPressure;

          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = activeTool === 'eraser' ? '#f8fafc' : brushColor;
          ctx.globalAlpha = activeTool === 'eraser' ? 1 : interpOpacity;

          ctx.beginPath();
          ctx.arc(interpX, interpY, interpStampRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      } else {
        // Single stamp for small gaps
        const opacity = brushOpacity * mappedPressure;

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = activeTool === 'eraser' ? '#f8fafc' : brushColor;
        ctx.globalAlpha = activeTool === 'eraser' ? 1 : opacity;

        ctx.beginPath();
        ctx.arc(p.x, p.y, stampRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      lastStamp = p;
    }

    // Update the last rendered index
    lastRenderedIndexRef.current = points.length - 1;
  }, [activeTool, brushColor, brushSize, brushOpacity, brushSettings]);

  // Schedule render using RAF or immediate based on settings
  const scheduleRender = useCallback(() => {
    const ctx = liveCtxRef.current;
    const points = currentStrokeRef.current;
    if (!ctx || points.length < 2) return;

    // If live preview enabled, render immediately for instant feedback
    if (brushSettings.showLivePreview) {
      renderStrokeImmediate(ctx, points);
      return;
    }

    // Otherwise use RAF for batching
    if (needsRenderRef.current) return;

    needsRenderRef.current = true;
    rafIdRef.current = requestAnimationFrame(() => {
      needsRenderRef.current = false;
      renderStrokeImmediate(ctx, points);
    });
  }, [brushSettings.showLivePreview, renderStrokeImmediate]);

  // Window mouse events for drawing outside canvas
  useEffect(() => {
    if (!isDrawing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!liveCtxRef.current) return;
      // Use transformRef to get latest transform state
      const pos = getPosFromEvent(e, containerRef, transformRef.current);

      
      const pointerEvent = e as unknown as PointerEvent;
      const pressure = pointerEvent.pressure !== undefined && pointerEvent.pressure > 0 
        ? pointerEvent.pressure 
        : 1;
      
      const pressurePoint: PressurePoint = {
        x: pos.x,
        y: pos.y,
        pressure: pressure,
      };
      
      currentStrokeRef.current.push(pressurePoint);
      
      // Render immediately for live feedback
      if (brushSettings.showLivePreview) {
        renderStrokeImmediate(liveCtxRef.current, currentStrokeRef.current);
      } else {
        scheduleRender();
      }
    };

    const handleMouseUp = () => {
      // End drawing - save stroke before clearing
      if (!isDrawing) return;
      
      // Save the stroke if we have points (same logic as handlePointerUp)
      if (currentStrokeRef.current.length > 0 && staticCtxRef.current && liveCtxRef.current && socket) {
        let stroke: Stroke;
        if (['rect', 'circle', 'line'].includes(activeTool)) {
          const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1] || { x: 0, y: 0, pressure: 1 };
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
        } else if (activeTool === 'brush' || activeTool === 'eraser') {
          // Apply tapering at the end of stroke
          const points = currentStrokeRef.current;
          const taperedPoints = applyTapering(points);
          
          stroke = {
            id: Date.now().toString(),
            tool: activeTool as ToolType,
            points: samplePointsForStorage(taperedPoints),
            color: brushColor,
            size: brushSize,
            opacity: brushOpacity,
            pressureData: taperedPoints.map(p => p.pressure),
          };

          drawStroke(staticCtxRef.current, stroke);
        }

        // Only save and emit if we created a stroke
        if (stroke!) {
          strokesRef.current.push(stroke);
          redoStackRef.current = [];
          socket.emit('draw:stroke', { stroke });
        }
      }

      setIsDrawing(false);
      clearLiveCanvas();
      currentStrokeRef.current = [];
      lastRenderedIndexRef.current = 0;
      shapeStartRef.current = null;
      isPenActiveRef.current = false;
      currentPressureRef.current = 1;
      smoothedPressureRef.current = 1;
    };


    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

  }, [isDrawing, activeTool, brushSize, brushColor, brushOpacity, transform, scheduleRender, brushSettings.showLivePreview, renderStrokeImmediate]);

  // Touch gesture state for mobile
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const touchStartDistanceRef = useRef<number | null>(null);
  const touchStartTransformRef = useRef<Transform | null>(null);
  const touchStartCenterRef = useRef<{ x: number; y: number } | null>(null);
  const isTouchDrawingRef = useRef(false);
  const activeTouchesRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Global window events for panning, zooming, and brush sizing
  useEffect(() => {
    if (!isPanning && !isZooming && !isBrushSizing) return;

    const handleMove = (e: MouseEvent) => {
      if (isPanning && panStartRef.current) {
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setTransform((prev) => ({
          ...prev,
          translateX: prev.translateX + dx * 0.5,
          translateY: prev.translateY + dy * 0.5,
        }));
        panStartRef.current = { x: e.clientX, y: e.clientY };
      } else if (isZooming && zoomStartRef.current) {
        // Scrubby zoom: drag left/right to zoom in/out
        const dx = e.clientX - zoomStartRef.current.x;
        const zoomFactor = Math.exp(dx * 0.01);
        const newScale = Math.max(0.1, Math.min(5, zoomStartRef.current.initialScale * zoomFactor));
        setTransform((prev) => ({
          ...prev,
          scale: newScale,
        }));
      } else if (isBrushSizing && brushSizeStartRef.current && onBrushSizeChange) {
        // HUD brush sizing: drag left/right to decrease/increase size
        const dx = e.clientX - brushSizeStartRef.current.x;
        const newSize = Math.max(1, Math.min(100, brushSizeStartRef.current.initialSize + dx * 0.5));
        onBrushSizeChange(Math.round(newSize));
      }
    };

    const handleEnd = () => {
      setIsPanning(false);
      setIsZooming(false);
      setIsBrushSizing(false);
      panStartRef.current = null;
      zoomStartRef.current = null;
      brushSizeStartRef.current = null;
    };

    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleEnd);
    document.addEventListener('pointercancel', handleEnd);
    document.addEventListener('pointerleave', handleEnd);
    window.addEventListener('blur', handleEnd);

    return () => {
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleEnd);
      document.removeEventListener('pointercancel', handleEnd);
      document.removeEventListener('pointerleave', handleEnd);
      window.removeEventListener('blur', handleEnd);
    };




  }, [isPanning, isZooming, isBrushSizing, onBrushSizeChange]);

  // Mobile touch handlers for pinch-zoom and pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isDrawer) return;
    
    const touches = e.touches;
    
    // Track all active touches
    activeTouchesRef.current.clear();
    for (let i = 0; i < touches.length; i++) {
      activeTouchesRef.current.set(touches[i].identifier, {
        x: touches[i].clientX,
        y: touches[i].clientY
      });
    }
    
    if (touches.length === 1) {
      // Single touch - check if we should start drawing
      // Only draw if not currently in a multi-touch gesture
      if (gestureState === 'idle' || gestureState === 'drawing') {
        const touch = touches[0];
        touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
        isTouchDrawingRef.current = true;
        setGestureState('drawing');
        
        // Start drawing
        const pos = getPos(e as unknown as React.MouseEvent, containerRef, transformRef.current);
        setIsDrawing(true);
        shapeStartRef.current = pos;
        currentStrokeRef.current = [{ 
          x: pos.x, 
          y: pos.y, 
          pressure: 1,
        }];
      }
    } else if (touches.length === 2) {
      // Two finger touch - start pinch zoom/pan gesture
      // Cancel any ongoing drawing
      if (isDrawing) {
        setIsDrawing(false);
        isTouchDrawingRef.current = false;
        clearLiveCanvas();
        currentStrokeRef.current = [];
        lastRenderedIndexRef.current = 0;
        shapeStartRef.current = null;
      }
      
      setGestureState('multi-touch');
      isTouchDrawingRef.current = false;
      touchStartDistanceRef.current = getTouchDistance(touches);
      touchStartTransformRef.current = { ...transformRef.current };
      
      // Calculate center point of the two touches for panning
      touchStartCenterRef.current = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      };
    } else if (touches.length > 2) {
      // 3+ fingers - ignore
      setGestureState('multi-touch');
      isTouchDrawingRef.current = false;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDrawer) return;
    e.preventDefault(); // Prevent scrolling
    
    const touches = e.touches;
    
    // Update tracked touches
    for (let i = 0; i < touches.length; i++) {
      activeTouchesRef.current.set(touches[i].identifier, {
        x: touches[i].clientX,
        y: touches[i].clientY
      });
    }
    
    // If we have 2+ fingers, ensure we're in multi-touch mode and NOT drawing
    if (touches.length >= 2 && gestureState === 'drawing') {
      // Cancel drawing immediately when second finger touches
      setIsDrawing(false);
      isTouchDrawingRef.current = false;
      clearLiveCanvas();
      currentStrokeRef.current = [];
      lastRenderedIndexRef.current = 0;
      shapeStartRef.current = null;
      setGestureState('multi-touch');
      
      // Initialize zoom/pan tracking
      touchStartDistanceRef.current = getTouchDistance(touches);
      touchStartTransformRef.current = { ...transformRef.current };
      touchStartCenterRef.current = {
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
      };
      return;
    }
    
    if (touches.length === 1 && gestureState === 'drawing' && isDrawing) {
      // Single touch drawing - only if we're in drawing mode
      const touch = touches[0];
      const pos = getPos(e as unknown as React.MouseEvent, containerRef, transformRef.current);
      
      const pressurePoint: PressurePoint = {
        x: pos.x,
        y: pos.y,
        pressure: 1,
      };
      
      currentStrokeRef.current.push(pressurePoint);
      
      if (activeTool === 'brush' || activeTool === 'eraser') {
        scheduleRender();
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
    } else if (touches.length === 2 && touchStartDistanceRef.current && touchStartTransformRef.current) {
      // Two finger pinch zoom and pan
      const currentDistance = getTouchDistance(touches);
      const scaleFactor = currentDistance / touchStartDistanceRef.current;
      
      // Calculate current center point
      const currentCenterX = (touches[0].clientX + touches[1].clientX) / 2;
      const currentCenterY = (touches[0].clientY + touches[1].clientY) / 2;
      
      const startTransform = touchStartTransformRef.current;
      const newScale = Math.max(0.25, Math.min(4, startTransform.scale * scaleFactor));
      
      // Calculate pan delta
      const viewportRect = containerRef.current?.getBoundingClientRect();
      if (viewportRect && touchStartCenterRef.current) {
        const viewportCenterX = viewportRect.left + viewportRect.width / 2;
        const viewportCenterY = viewportRect.top + viewportRect.height / 2;
        
        // Calculate how much the center has moved (pan)
        const panDeltaX = currentCenterX - touchStartCenterRef.current.x;
        const panDeltaY = currentCenterY - touchStartCenterRef.current.y;
        
        // Calculate zoom adjustment to keep zoom centered on the pinch point
        const scaleRatio = newScale / startTransform.scale;
        const zoomAdjustX = (touchStartCenterRef.current.x - viewportCenterX - startTransform.translateX) * (scaleRatio - 1);
        const zoomAdjustY = (touchStartCenterRef.current.y - viewportCenterY - startTransform.translateY) * (scaleRatio - 1);
        
        setTransform({
          ...startTransform,
          scale: newScale,
          translateX: startTransform.translateX + panDeltaX + zoomAdjustX,
          translateY: startTransform.translateY + panDeltaY + zoomAdjustY,
        });
      } else {
        setTransform({
          ...startTransform,
          scale: newScale,
        });
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDrawer) return;
    
    const touches = e.touches;
    
    // Remove ended touches from tracking
    const changedTouches = e.changedTouches;
    for (let i = 0; i < changedTouches.length; i++) {
      activeTouchesRef.current.delete(changedTouches[i].identifier);
    }
    
    // If no touches left, end everything
    if (touches.length === 0) {
      // End drawing if we were drawing
      if (gestureState === 'drawing' && isDrawing) {
        if (!staticCtxRef.current || !liveCtxRef.current || !socket) return;
        
        setIsDrawing(false);
        isTouchDrawingRef.current = false;
        setGestureState('idle');

        let stroke: Stroke;
        if (['rect', 'circle', 'line'].includes(activeTool)) {
          const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1] || { x: 0, y: 0, pressure: 1 };
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
        } else if (activeTool === 'brush' || activeTool === 'eraser') {
          const points = currentStrokeRef.current;
          if (points.length > 0) {
            const taperedPoints = applyTapering(points);
            
            stroke = {
              id: Date.now().toString(),
              tool: activeTool as ToolType,
              points: samplePointsForStorage(taperedPoints),
              color: brushColor,
              size: brushSize,
              opacity: brushOpacity,
              pressureData: taperedPoints.map(p => p.pressure),
            };

            drawStroke(staticCtxRef.current, stroke);
          } else {
            stroke = null as any;
          }
        } else {
          stroke = null as any;
        }

        if (stroke) {
          strokesRef.current.push(stroke);
          redoStackRef.current = [];
          socket.emit('draw:stroke', { stroke });
        }

        clearLiveCanvas();
        currentStrokeRef.current = [];
        lastRenderedIndexRef.current = 0;
        shapeStartRef.current = null;
      } else if (gestureState === 'multi-touch') {
        // End multi-touch gesture
        setGestureState('idle');
      }
      
      // Reset all touch refs
      touchStartRef.current = null;
      touchStartDistanceRef.current = null;
      touchStartTransformRef.current = null;
      touchStartCenterRef.current = null;
      isTouchDrawingRef.current = false;
      activeTouchesRef.current.clear();
    } else if (touches.length === 1 && gestureState === 'multi-touch') {
      // Went from 2+ fingers to 1 - transition back to idle
      // Don't immediately start drawing, wait for new touch start
      setGestureState('idle');
      touchStartDistanceRef.current = null;
      touchStartTransformRef.current = null;
      touchStartCenterRef.current = null;
      isTouchDrawingRef.current = false;
    }
  };


  // Process pointer event - NO INTERPOLATION (handled by distance-based stamping)
  const processPointerEvent = (e: PointerEvent) => {
    if (!isDrawing) return;
    
    // @ts-ignore
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    
    for (const ev of events) {
      // Use transformRef to get latest transform state
      const pos = getPosFromEvent(ev, containerRef, transformRef.current);

      
      const isPen = ev.pointerType === 'pen';
      let rawPressure: number;
      
      if (isPen) {
        if (ev.pressure > 0) {
          rawPressure = ev.pressure;
        } else {
          rawPressure = smoothedPressureRef.current > 0.1 
            ? smoothedPressureRef.current 
            : 0.5;
        }
      } else {
        rawPressure = 1;
      }
      
      const prevSmoothed = smoothedPressureRef.current;
      const newSmoothed = prevSmoothed + (rawPressure - prevSmoothed) * PRESSURE_SMOOTHING;
      smoothedPressureRef.current = newSmoothed;
      currentPressureRef.current = newSmoothed;
      
      const pressurePoint: PressurePoint = {
        x: pos.x,
        y: pos.y,
        pressure: newSmoothed,
        tiltX: (ev as any).tiltX,
        tiltY: (ev as any).tiltY,
      };
      
      // NO INTERPOLATION - distance-based stamping handles gaps
      currentStrokeRef.current.push(pressurePoint);
    }
    
    if (activeTool === 'brush' || activeTool === 'eraser') {
      scheduleRender();
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
  };

  // Pointer event handler for pen tablet support
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !staticCtxRef.current || !liveCtxRef.current) return;
    
    // RIGHT CLICK - Show context menu only, don't draw
    if (e.button === 2) {
      e.preventDefault();
      setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY });
      return;
    }

    // Close context menu if clicking on canvas while menu is open
    if (contextMenu.isOpen) {
      setContextMenu({ ...contextMenu, isOpen: false });
    }
    
    const isPen = e.pointerType === 'pen';

    isPenActiveRef.current = isPen;
    
    const rawPressure = isPen && e.pressure > 0 
      ? e.pressure 
      : (isPen ? 0.5 : 1);
    
    currentPressureRef.current = rawPressure;
    smoothedPressureRef.current = rawPressure;

    // Check for modifier keys
    const hasCtrl = e.ctrlKey || e.metaKey;
    const hasAlt = e.altKey;
    const hasSpace = keysPressedRef.current.has(' ');

    // Ctrl + Space + Left Click = Scrubby Zoom
    if (hasCtrl && hasSpace && e.button === 0) {
      e.preventDefault();
      setIsZooming(true);
      zoomStartRef.current = { 
        x: e.clientX, 
        y: e.clientY, 
        initialScale: transform.scale 
      };
      return;
    }

    // Ctrl + Alt + Right Click = HUD Brush Size
    if (hasCtrl && hasAlt && e.button === 2) {
      e.preventDefault();
      setIsBrushSizing(true);
      brushSizeStartRef.current = {
        x: e.clientX,
        initialSize: brushSize
      };
      return;
    }

    // Middle mouse button or Space + Left Click = Pan (works with mouse and pen)
    if (e.button === 1 || (e.button === 0 && hasSpace)) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }


    e.preventDefault();
    // Use transformRef to get latest transform state
    const pos = getPos(e as unknown as React.MouseEvent, containerRef, transformRef.current);

    const liveCtx = liveCtxRef.current;

    if (activeTool === 'text') {
      setTextInput({ visible: true, x: pos.x, y: pos.y, value: '' });
      return;
    }

    if (activeTool === 'fill') {
      floodFill(staticCtxRef.current, pos.x, pos.y, brushColor, brushOpacity);
      const stroke: Stroke = {
        id: Date.now().toString(),
        tool: 'fill',
        points: [{ x: pos.x, y: pos.y, pressure: 1 }],
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
      };
      strokesRef.current.push(stroke);
      redoStackRef.current = [];
      socket?.emit('draw:stroke', { stroke });
      return;
    }

    setIsDrawing(true);
    
    shapeStartRef.current = pos;
    currentStrokeRef.current = [{ 
      x: pos.x, 
      y: pos.y, 
      pressure: smoothedPressureRef.current,
      tiltX: (e as any).tiltX,
      tiltY: (e as any).tiltY,
    }];
    
    liveCtx.lineCap = 'round';
    liveCtx.lineJoin = 'round';
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Handle panning
    if (isPanning) {
      e.preventDefault();
      if (!panStartRef.current) return;
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setTransform((prev) => ({
        ...prev,
        translateX: prev.translateX + dx * 0.5,
        translateY: prev.translateY + dy * 0.5,
      }));
      panStartRef.current = { x: e.clientX, y: e.clientY };
      return;
    }

    // Handle zooming
    if (isZooming && zoomStartRef.current) {
      e.preventDefault();
      const dx = e.clientX - zoomStartRef.current.x;
      const zoomFactor = Math.exp(dx * 0.01);
      const newScale = Math.max(0.1, Math.min(5, zoomStartRef.current.initialScale * zoomFactor));
      setTransform((prev) => ({
        ...prev,
        scale: newScale,
      }));
      return;
    }

    // Handle brush sizing
    if (isBrushSizing && brushSizeStartRef.current && onBrushSizeChange) {
      e.preventDefault();
      const dx = e.clientX - brushSizeStartRef.current.x;
      const newSize = Math.max(1, Math.min(100, brushSizeStartRef.current.initialSize + dx * 0.5));
      onBrushSizeChange(Math.round(newSize));
      return;
    }

    if (e.pointerType === 'touch' && e.isPrimary === false) {
      return;
    }

    if (!isDrawing || !liveCtxRef.current) return;
    e.preventDefault();

    // @ts-ignore
    const events = e.nativeEvent.getCoalescedEvents ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    
    for (const ev of events) {
      // Use transformRef to get latest transform state
      const pos = getPosFromEvent(ev, containerRef, transformRef.current);

      
      const isPen = ev.pointerType === 'pen';
      let rawPressure: number;
      
      if (isPen) {
        if (ev.pressure > 0) {
          rawPressure = ev.pressure;
        } else {
          rawPressure = smoothedPressureRef.current > 0.1 
            ? smoothedPressureRef.current 
            : 0.5;
        }
      } else {
        rawPressure = 1;
      }
      
      const prevSmoothed = smoothedPressureRef.current;
      const newSmoothed = prevSmoothed + (rawPressure - prevSmoothed) * PRESSURE_SMOOTHING;
      smoothedPressureRef.current = newSmoothed;
      currentPressureRef.current = newSmoothed;
      
      const pressurePoint: PressurePoint = {
        x: pos.x,
        y: pos.y,
        pressure: newSmoothed,
        tiltX: (ev as any).tiltX,
        tiltY: (ev as any).tiltY,
      };
      
      // NO INTERPOLATION - distance-based stamping handles gaps
      currentStrokeRef.current.push(pressurePoint);
    }
    
    if (activeTool === 'brush' || activeTool === 'eraser') {
      scheduleRender();
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
    // End panning
    if (isPanning) {
      setIsPanning(false);
      panStartRef.current = null;
      return;
    }

    // End zooming
    if (isZooming) {
      setIsZooming(false);
      zoomStartRef.current = null;
      return;
    }

    // End brush sizing
    if (isBrushSizing) {
      setIsBrushSizing(false);
      brushSizeStartRef.current = null;
      return;
    }

    if (!isDrawing || !staticCtxRef.current || !liveCtxRef.current || !socket) return;

    setIsDrawing(false);

    let stroke: Stroke;
    if (['rect', 'circle', 'line'].includes(activeTool)) {
      const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1] || { x: 0, y: 0, pressure: 1 };
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
      // Apply tapering at the end of stroke - gradually reduce pressure to 0
      const points = currentStrokeRef.current;
      const taperedPoints = applyTapering(points);
      
      stroke = {
        id: Date.now().toString(),
        tool: activeTool as ToolType,
        points: samplePointsForStorage(taperedPoints),
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
        pressureData: taperedPoints.map(p => p.pressure),
      };

      drawStroke(staticCtxRef.current, stroke);
    }

    strokesRef.current.push(stroke);
    redoStackRef.current = [];
    socket.emit('draw:stroke', { stroke });

    clearLiveCanvas();
    currentStrokeRef.current = [];
    lastRenderedIndexRef.current = 0;
    shapeStartRef.current = null;
    isPenActiveRef.current = false;
    currentPressureRef.current = 1;
    smoothedPressureRef.current = 1;
  };

  // Apply tapering at the end of stroke - gradually reduce pressure to 0
  const applyTapering = (points: PressurePoint[]): PressurePoint[] => {
    if (points.length < 3) return points;
    
    const TAPER_LENGTH = 15; // Number of points to taper
    const startTaperIdx = Math.max(0, points.length - TAPER_LENGTH);
    
    return points.map((p, i) => {
      if (i < startTaperIdx) {
        return p; // No change for points before taper zone
      }
      
      // Calculate taper factor: 1.0 at start of taper zone, 0.0 at end
      const taperProgress = (i - startTaperIdx) / TAPER_LENGTH;
      const taperFactor = 1 - Math.pow(taperProgress, 0.5); // Ease out curve
      
      return {
        ...p,
        pressure: p.pressure * taperFactor,
      };
    });
  };

  // Helper to reduce point count for storage
  const samplePointsForStorage = (points: PressurePoint[]): Point[] => {
    if (points.length <= 30) {
      return points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure }));
    }
    
    const sampled: Point[] = [points[0]];
    let lastSampledIdx = 0;
    
    for (let i = 1; i < points.length - 1; i++) {
      const p = points[i];
      const lastSampled = points[lastSampledIdx];
      const dx = p.x - lastSampled.x;
      const dy = p.y - lastSampled.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      const pressureDiff = Math.abs(p.pressure - lastSampled.pressure);
      const hasPressureChange = pressureDiff > 0.15;
      
      const avgPressure = (p.pressure + lastSampled.pressure) / 2;
      const adaptiveSpacing = Math.max(1.5, brushSize * 0.08 * (0.5 + avgPressure));
      
      if (distance >= adaptiveSpacing || hasPressureChange) {
        sampled.push({ x: p.x, y: p.y, pressure: p.pressure });
        lastSampledIdx = i;
      }
    }
    
    const last = points[points.length - 1];
    const lastSampled = points[lastSampledIdx];
    if (last.x !== lastSampled.x || last.y !== lastSampled.y) {
      sampled.push({ x: last.x, y: last.y, pressure: last.pressure });
    }
    
    return sampled;
  };

  const undoInternal = useCallback(() => {
    if (strokesRef.current.length === 0) return;
    const removed = strokesRef.current.pop()!;
    redoStackRef.current.push(removed);
    redrawAllStrokes(staticCtxRef.current!, strokesRef.current);
    clearLiveCanvas();
  }, [clearLiveCanvas]);

  const redoInternal = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const stroke = redoStackRef.current.pop()!;
    strokesRef.current.push(stroke);
    drawStroke(staticCtxRef.current!, stroke);
  }, []);

  const clearCanvas = useCallback(() => {
    if (!isDrawer) return;
    strokesRef.current = [];
    redoStackRef.current = [];
    redrawAllStrokes(staticCtxRef.current!, []);
    clearLiveCanvas();
    socket?.emit('draw:clear');
    onClear?.();
  }, [isDrawer, socket, onClear, clearLiveCanvas]);

  const undo = useCallback(() => {
    if (!isDrawer) return;
    undoInternal();
    socket?.emit('draw:undo');
    onUndo?.();
  }, [isDrawer, socket, onUndo, undoInternal]);

  const redo = useCallback(() => {
    if (!isDrawer) return;
    redoInternal();
    socket?.emit('draw:redo');
    onRedo?.();
  }, [isDrawer, socket, onRedo, redoInternal]);

  const resetTransform = useCallback(() => {
    setTransform({ scale: 1, translateX: 0, translateY: 0, rotation: 0 });
  }, []);

  const zoomIn = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }));
  }, []);

  const zoomOut = useCallback(() => {
    setTransform((prev) => ({ ...prev, scale: Math.max(0.5, prev.scale / 1.2) }));
  }, []);

  const rotate = useCallback((direction: 'cw' | 'ccw') => {
    setTransform((prev) => ({
      ...prev,
      rotation: prev.rotation + (direction === 'cw' ? 90 : -90),
    }));
  }, []);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform((prev) => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale * delta)),
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

    strokesRef.current.push(stroke);
    redoStackRef.current = [];
    socket.emit('draw:stroke', { stroke });
    setTextInput({ visible: false, x: 0, y: 0, value: '' });
  };

  useEffect(() => {
    (window as any).canvasControls = {
      clear: clearCanvas,
      undo,
      redo,
      zoomIn,
      zoomOut,
      resetTransform,
      rotate,
    };
  }, [clearCanvas, undo, redo, zoomIn, zoomOut, resetTransform, rotate]);

  return (
    <div
      ref={containerRef}
      className="canvas-container"
    >
      <TransformControls
        transform={transform}
        show={showTransformControls}
        onToggle={() => setShowTransformControls(!showTransformControls)}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onReset={resetTransform}
        onRotate={rotate}
      />

      <div className="canvas-viewport">
        <div 
          className={clsx('canvas-inner', { panning: isPanning })}
          style={{
            transform: `translate(${transform.translateX}px, ${transform.translateY}px) rotate(${transform.rotation}deg) scale(${transform.scale})`,
          }}
        >

          <canvas
            ref={staticCanvasRef}
            className="canvas-static"
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
          />
          <canvas
            ref={liveCanvasRef}
            className={clsx('canvas-live', { 
              'view-only': !isDrawer 
            })}

            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />

        </div>
      </div>



      <BrushSettingsMenu
        settings={brushSettings}
        onSettingsChange={setBrushSettings}
        isOpen={contextMenu.isOpen}
        position={{ x: contextMenu.x, y: contextMenu.y }}
        onClose={() => setContextMenu({ ...contextMenu, isOpen: false })}
      />

      <TextInputOverlay
        visible={textInput.visible}
        x={textInput.x}
        y={textInput.y}
        value={textInput.value}
        color={brushColor}
        size={brushSize}
        onChange={(value) => setTextInput((prev) => ({ ...prev, value }))}
        onSubmit={() => addText(textInput.x, textInput.y, textInput.value)}
        onCancel={() => setTextInput({ visible: false, x: 0, y: 0, value: '' })}
      />
    </div>
  );
}
