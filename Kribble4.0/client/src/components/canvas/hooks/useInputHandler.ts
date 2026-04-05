import { useRef, useCallback, useState } from 'react';
import type { Point, Transform, ToolType, InputState, PointerData } from '../types';
import { getPosFromEvent, getTouchDistance } from '../coordinates';

export interface UseInputHandlerOptions {
  isDrawer: boolean;
  activeTool: ToolType;
  brushSize: number;
  brushColor: string;
  transform: Transform;
  setTransform: React.Dispatch<React.SetStateAction<Transform>>;
  onToolChange?: (tool: ToolType) => void;
  onBrushSizeChange?: (size: number) => void;
  onBrushColorChange?: (color: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  onStartDrawing?: (pos: Point, pressure: number) => void;
  onDrawMove?: (pos: Point, pressure: number) => void;
  onEndDrawing?: () => void;
  onStartPan?: (pos: Point) => void;
  onPanMove?: (pos: Point) => void;
  onEndPan?: () => void;
  onStartZoom?: (pos: Point, initialScale: number) => void;
  onZoomMove?: (pos: Point) => void;
  onEndZoom?: () => void;
  onContextMenu?: (pos: Point) => void;
  onTextInput?: (pos: Point) => void;
  onFill?: (pos: Point) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}


export function useInputHandler({
  isDrawer,
  activeTool,
  brushSize,
  brushColor,
  transform,
  setTransform,
  onToolChange,
  onBrushSizeChange,
  onBrushColorChange,
  onUndo,
  onRedo,
  onClear,
  onStartDrawing,
  onDrawMove,
  onEndDrawing,
  onStartPan,
  onPanMove,
  onEndPan,
  onStartZoom,
  onZoomMove,
  onEndZoom,
  onContextMenu,
  onTextInput,
  onFill,
  containerRef,
}: UseInputHandlerOptions) {
  const isTypingTarget = useCallback((target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;

    const tagName = target.tagName;
    return (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      tagName === 'SELECT' ||
      target.isContentEditable
    );
  }, []);

  const [inputState, setInputState] = useState<InputState>('idle');
  const inputStateRef = useRef<InputState>('idle');
  const activePointersRef = useRef<Map<number, PointerData>>(new Map());
  const keysPressedRef = useRef<Set<string>>(new Set());
  const previousToolRef = useRef<ToolType | null>(null);
  const panStartRef = useRef<Point | null>(null);
  const zoomStartRef = useRef<{ x: number; y: number; initialScale: number } | null>(null);
  const lastTouchDistanceRef = useRef<number | null>(null);
  const isGestureActiveRef = useRef<boolean>(false);

  // Sync input state ref
  const setInputStateWithRef = useCallback((state: InputState) => {
    setInputState(state);
    inputStateRef.current = state;
  }, []);

  // Check if space is pressed
  const isSpacePressed = useCallback(() => keysPressedRef.current.has(' '), []);
  const isCtrlPressed = useCallback(() => 
    keysPressedRef.current.has('control') || keysPressedRef.current.has('meta'), 
  []);

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2 || (e.pointerType === 'pen' && e.button === 0)) {
      e.preventDefault();
    }

    const isPen = e.pointerType === 'pen';
    const isTouch = e.pointerType === 'touch';
    const isMouse = e.pointerType === 'mouse';
    const isEraser = isPen && e.button === 5;
    const isBarrelButton = isPen && e.button === 2;

    // Track pointer
    const pointerData: PointerData = {
      id: e.pointerId,
      type: isPen ? 'pen' : isTouch ? 'touch' : 'mouse',
      x: e.clientX,
      y: e.clientY,
      pressure: e.pressure || 1,
      buttons: e.buttons,
      isPrimary: e.isPrimary,
      timestamp: Date.now(),
    };
    activePointersRef.current.set(e.pointerId, pointerData);

    // Capture pointer
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      // Ignore capture failure
    }

    const hasSpace = isSpacePressed();
    const hasCtrl = isCtrlPressed();

    // Right click or pen barrel button = context menu
    if (e.button === 2 || isBarrelButton) {
      e.preventDefault();
      onContextMenu?.({ x: e.clientX, y: e.clientY });
      setInputStateWithRef('idle');
      return;
    }

    // Non-drawers: only pan/zoom
    if (!isDrawer) {
      if (hasSpace && hasCtrl && e.button === 0) {
        e.preventDefault();
        setInputStateWithRef('zooming');
        zoomStartRef.current = { x: e.clientX, y: e.clientY, initialScale: transform.scale };
        onStartZoom?.({ x: e.clientX, y: e.clientY }, transform.scale);
      } else if (hasSpace && e.button === 0) {
        e.preventDefault();
        setInputStateWithRef('panning');
        panStartRef.current = { x: e.clientX, y: e.clientY };
        onStartPan?.({ x: e.clientX, y: e.clientY });
      } else if (e.button === 1 || (e.button === 0 && !hasSpace)) {
        e.preventDefault();
        setInputStateWithRef('panning');
        panStartRef.current = { x: e.clientX, y: e.clientY };
        onStartPan?.({ x: e.clientX, y: e.clientY });
      }
      return;
    }

    // Pen eraser end = temporary eraser
    if (isEraser) {
      e.preventDefault();
      previousToolRef.current = activeTool;
      onToolChange?.('eraser');
      setInputStateWithRef('drawing');
      const pos = getPosFromEvent(e.nativeEvent, containerRef, transform);
      onStartDrawing?.(pos, e.pressure || 0.5);
      return;
    }

    // Navigation mode for drawer
    if (hasSpace && !hasCtrl && e.button === 0) {
      e.preventDefault();
      setInputStateWithRef('panning');
      panStartRef.current = { x: e.clientX, y: e.clientY };
      onStartPan?.({ x: e.clientX, y: e.clientY });
      return;
    }

    if (hasSpace && hasCtrl && e.button === 0) {
      e.preventDefault();
      setInputStateWithRef('zooming');
      zoomStartRef.current = { x: e.clientX, y: e.clientY, initialScale: transform.scale };
      onStartZoom?.({ x: e.clientX, y: e.clientY }, transform.scale);
      return;
    }

    if (e.button === 1) {
      e.preventDefault();
      setInputStateWithRef('panning');
      panStartRef.current = { x: e.clientX, y: e.clientY };
      onStartPan?.({ x: e.clientX, y: e.clientY });
      return;
    }

    // Drawing mode
    if (e.button === 0 && !hasSpace) {
      if (isPen && e.pressure === 0 && e.buttons === 0) {
        return; // Just hovering
      }

      e.preventDefault();
      setInputStateWithRef('drawing');

      const pos = getPosFromEvent(e.nativeEvent, containerRef, transform);

      if (activeTool === 'text') {
        onTextInput?.(pos);
        setInputStateWithRef('idle');
        return;
      }

      if (activeTool === 'fill') {
        onFill?.(pos);
        setInputStateWithRef('idle');
        return;
      }

      onStartDrawing?.(pos, isPen && e.pressure > 0 ? e.pressure : 1);
    }
  }, [isDrawer, activeTool, transform, onToolChange, onStartDrawing, onStartPan, onStartZoom, onContextMenu, onTextInput, onFill, containerRef, setInputStateWithRef, isSpacePressed, isCtrlPressed]);

  // Handle pointer move
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    // Update pointer tracking
    const existing = activePointersRef.current.get(e.pointerId);
    if (existing) {
      existing.x = e.clientX;
      existing.y = e.clientY;
      existing.pressure = e.pressure || 1;
    }

    const isPen = e.pointerType === 'pen';

    switch (inputStateRef.current) {
      case 'panning':
        e.preventDefault();
        if (!panStartRef.current) return;
        const dx = e.clientX - panStartRef.current.x;
        const dy = e.clientY - panStartRef.current.y;
        setTransform(prev => ({
          ...prev,
          translateX: prev.translateX + dx,
          translateY: prev.translateY + dy,
        }));
        panStartRef.current = { x: e.clientX, y: e.clientY };
        onPanMove?.({ x: e.clientX, y: e.clientY });
        return;

      case 'zooming':
        e.preventDefault();
        if (!zoomStartRef.current) return;
        const zoomDx = e.clientX - zoomStartRef.current.x;
        const zoomFactor = Math.exp(zoomDx * 0.01);
        const newScale = Math.max(0.01, Math.min(3, zoomStartRef.current.initialScale * zoomFactor));
        setTransform(prev => ({ ...prev, scale: newScale }));
        onZoomMove?.({ x: e.clientX, y: e.clientY });
        return;

      case 'drawing':
        e.preventDefault();
        if (isPen && e.buttons === 0) return;
        const pos = getPosFromEvent(e.nativeEvent, containerRef, transform);
        const pressure = isPen ? (e.pressure > 0 ? e.pressure : 0.5) : 1;
        onDrawMove?.(pos, pressure);
        return;

      default:
        break;
    }
  }, [transform, setTransform, onPanMove, onZoomMove, onDrawMove, containerRef]);

  // Handle pointer up
  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore release failure
    }

    const isPen = e.pointerType === 'pen';
    const isEraser = isPen && e.button === 5;

    switch (inputStateRef.current) {
      case 'panning':
        setInputStateWithRef('idle');
        panStartRef.current = null;
        onEndPan?.();
        return;

      case 'zooming':
        setInputStateWithRef('idle');
        zoomStartRef.current = null;
        onEndZoom?.();
        return;

      case 'drawing':
        setInputStateWithRef('idle');

        if (isEraser && previousToolRef.current) {
          onToolChange?.(previousToolRef.current);
          previousToolRef.current = null;
        }

        onEndDrawing?.();
        return;

      default:
        setInputStateWithRef('idle');
        return;
    }
  }, [onToolChange, onEndPan, onEndZoom, onEndDrawing, setInputStateWithRef]);

  // Handle pointer cancel/leave
  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    activePointersRef.current.delete(e.pointerId);
    handlePointerUp(e);
  }, [handlePointerUp]);

  const handlePointerLeave = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (inputStateRef.current === 'drawing') {
      handlePointerUp(e);
    }
  }, [handlePointerUp]);

  // Touch handlers for viewport-level gestures
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;

    if (touches.length === 2) {
      isGestureActiveRef.current = true;
      lastTouchDistanceRef.current = getTouchDistance(touches);
      return;
    }

    if (!isDrawer && touches.length === 1) {
      setInputStateWithRef('panning');
      panStartRef.current = { x: touches[0].clientX, y: touches[0].clientY };
      onStartPan?.({ x: touches[0].clientX, y: touches[0].clientY });
    }
  }, [isDrawer, onStartPan, setInputStateWithRef]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    const touches = e.touches;

    if (touches.length === 2 && lastTouchDistanceRef.current !== null) {
      const currentDistance = getTouchDistance(touches);
      const scaleFactor = currentDistance / lastTouchDistanceRef.current;

      setTransform(prev => ({
        ...prev,
        scale: Math.max(0.01, Math.min(3, prev.scale * scaleFactor)),
      }));

      lastTouchDistanceRef.current = currentDistance;
      return;
    }

    if (!isDrawer && touches.length === 1 && inputStateRef.current === 'panning' && panStartRef.current) {
      const touch = touches[0];
      const dx = touch.clientX - panStartRef.current.x;
      const dy = touch.clientY - panStartRef.current.y;

      setTransform(prev => ({
        ...prev,
        translateX: prev.translateX + dx,
        translateY: prev.translateY + dy,
      }));

      panStartRef.current = { x: touch.clientX, y: touch.clientY };
      onPanMove?.({ x: touch.clientX, y: touch.clientY });
    }
  }, [isDrawer, setTransform, onPanMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;

    if (touches.length < 2) {
      isGestureActiveRef.current = false;
      lastTouchDistanceRef.current = null;
    }

    if (touches.length === 0 && inputStateRef.current === 'panning') {
      setInputStateWithRef('idle');
      panStartRef.current = null;
      onEndPan?.();
    }
  }, [onEndPan, setInputStateWithRef]);

  // Wheel handler for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      ...prev,
      scale: Math.max(0.01, Math.min(3, prev.scale * delta)),
    }));
  }, [setTransform]);

  // Tool shortcuts
  const handleToolShortcut = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return; // Don't trigger with modifiers
    
    switch (e.key.toLowerCase()) {
      case 'b':
        e.preventDefault();
        onToolChange?.('brush');
        return;
      case 'e':
        e.preventDefault();
        onToolChange?.('eraser');
        return;
      case 'm':
      case 'r':
        e.preventDefault();
        onToolChange?.('rect');
        return;
      case 'c':
        e.preventDefault();
        onToolChange?.('circle');
        return;
      case 'l':
        e.preventDefault();
        onToolChange?.('line');
        return;
      case 't':
        e.preventDefault();
        onToolChange?.('text');
        return;
      case 'g':
        e.preventDefault();
        onToolChange?.('fill');
        return;
    }
  }, [onToolChange]);

  // Brush size shortcuts
  const handleBrushSizeShortcut = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    
    switch (e.key) {
      case ']':
      case '}':
        e.preventDefault();
        onBrushSizeChange?.(Math.min(100, brushSize + 2));
        return;
      case '[':
      case '{':
        e.preventDefault();
        onBrushSizeChange?.(Math.max(1, brushSize - 2));
        return;
    }
  }, [brushSize, onBrushSizeChange]);

  // Color swap shortcut
  const handleColorShortcut = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    
    if (e.key.toLowerCase() === 'x') {
      e.preventDefault();
      // Swap between black and white, or toggle
      const newColor = brushColor === '#000000' ? '#ffffff' : '#000000';
      onBrushColorChange?.(newColor);
    }
  }, [brushColor, onBrushColorChange]);

  // Edit shortcuts (undo/redo/clear)
  const handleEditShortcut = useCallback((e: KeyboardEvent) => {
    const hasCtrl = e.ctrlKey || e.metaKey;
    const hasShift = e.shiftKey;
    
    // Undo: Ctrl+Z (without shift)
    if (hasCtrl && !hasShift && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      onUndo?.();
      return;
    }
    
    // Redo: Ctrl+Shift+Z or Ctrl+Y
    if (hasCtrl && ((hasShift && e.key.toLowerCase() === 'z') || e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      onRedo?.();
      return;
    }
    
    // Clear canvas: Delete or Backspace (without modifiers)
    if (!hasCtrl && !hasShift && !e.altKey && (e.key === 'Delete' || e.key === 'Backspace')) {
      e.preventDefault();
      if (confirm('Clear the canvas? This cannot be undone.')) {
        onClear?.();
      }
      return;
    }
  }, [onUndo, onRedo, onClear]);

  // View shortcuts (zoom)
  const handleViewShortcut = useCallback((e: KeyboardEvent) => {
    const hasCtrl = e.ctrlKey || e.metaKey;
    if (!hasCtrl) return;
    
    switch (e.key) {
      case '=':
      case '+':
        e.preventDefault();
        setTransform(prev => ({
          ...prev,
          scale: Math.max(0.01, Math.min(3, prev.scale * 1.2)),
        }));
        return;
      case '-':
      case '_':
        e.preventDefault();
        setTransform(prev => ({
          ...prev,
          scale: Math.max(0.01, Math.min(3, prev.scale * 0.8)),
        }));
        return;
      case '0':
        e.preventDefault();
        setTransform(prev => ({
          ...prev,
          scale: 1,
          translateX: 0,
          translateY: 0,
          rotation: 0,
        }));
        return;
    }
  }, [setTransform]);

  // Keyboard handlers
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) {
      return;
    }

    const key = e.key.toLowerCase();
    keysPressedRef.current.add(key);

    if (e.ctrlKey || e.metaKey) keysPressedRef.current.add('control');
    if (e.shiftKey) keysPressedRef.current.add('shift');
    if (e.altKey) keysPressedRef.current.add('alt');

    // Handle shortcuts in order of priority
    handleEditShortcut(e);
    handleViewShortcut(e);
    handleToolShortcut(e);
    handleBrushSizeShortcut(e);
    handleColorShortcut(e);
  }, [handleEditShortcut, handleViewShortcut, handleToolShortcut, handleBrushSizeShortcut, handleColorShortcut, isTypingTarget]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (isTypingTarget(e.target)) {
      return;
    }

    const key = e.key.toLowerCase();
    keysPressedRef.current.delete(key);

    if (!e.ctrlKey && !e.metaKey) keysPressedRef.current.delete('control');
    if (!e.shiftKey) keysPressedRef.current.delete('shift');
    if (!e.altKey) keysPressedRef.current.delete('alt');
  }, [isTypingTarget]);


  return {
    inputState,
    inputStateRef,
    activePointersRef,
    keysPressedRef,
    previousToolRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handlePointerLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
  };
}
