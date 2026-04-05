import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { clsx } from 'clsx';
import { useSocket } from '../../contexts/SocketContext';
import './DrawingCanvas.css';

import type { Point, Stroke, Transform, ToolType, DrawingCanvasProps } from './types';
import { initCanvas, initBackgroundCanvas, drawText } from './drawingTools';
import { createShortcuts, matchesShortcut } from './keyboardShortcuts';
import type { ShortcutContext } from './keyboardShortcuts';

import { TransformControls } from './TransformControls';
import { TextInputOverlay } from './TextInput';
import { useCanvasState, useInputHandler, useSocketEvents, useDrawingOperations } from './hooks';

const CANVAS_SIZE = 800;

interface ExtendedDrawingCanvasProps extends DrawingCanvasProps {
  onToolChange?: (tool: ToolType) => void;
  onBrushSizeChange?: (size: number) => void;
  onBrushColorChange?: (color: string) => void;
  isMobile?: boolean;
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
}: ExtendedDrawingCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const backgroundCanvasRef = useRef<HTMLCanvasElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);
  const backgroundCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const staticCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const liveCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const { socket } = useSocket();

  // UI state
  const [showTransformControls, setShowTransformControls] = useState(false);
  const [textInput, setTextInput] = useState<{ visible: boolean; x: number; y: number; value: string }>({
    visible: false,
    x: 0,
    y: 0,
    value: '',
  });
  const [contextMenu, setContextMenu] = useState<{ isOpen: boolean; x: number; y: number }>({
    isOpen: false,
    x: 0,
    y: 0,
  });

  // Transform state
  const [transform, setTransform] = useState<Transform>({
    scale: isMobile ? 0.5 : 1.0,
    translateX: 0,
    translateY: 0,
    rotation: 0,
  });

  // Canvas state hook
  const {
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
  } = useCanvasState({
    staticCtxRef,
    liveCtxRef,
    socket,
    onUndo,
    onRedo,
    onClear,
  });

  // Drawing operations hook
  const {
    startDrawing,
    continueDrawing,
    endDrawing,
    handleFill,
    renderLiveStroke,
  } = useDrawingOperations({
    liveCtxRef,
    staticCtxRef,
    currentStrokeRef,
    shapeStartRef: useRef<Point | null>(null),
    smoothedPressureRef: useRef<number>(1),
    brushSize,
    brushColor,
    brushOpacity,
    activeTool,
    shapeType,
    transform,
  });

  // Input handler hook
  const {
    inputState,
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
  } = useInputHandler({
    isDrawer,
    activeTool,
    brushSize,
    brushColor,
    transform,
    setTransform,
    onToolChange,
    onBrushSizeChange,
    onBrushColorChange,
    onUndo: () => undoInternal(true),
    onRedo: () => redoInternal(true),
    onClear: () => {
      if (confirm('Clear the canvas?')) clearCanvasInternal(true);
    },

    onStartDrawing: (pos, pressure) => {
      currentStrokeIdRef.current = Date.now().toString();
      syncedPointCountRef.current = 0;
      startDrawing(pos, pressure);
    },
    onDrawMove: (pos, pressure) => {
      continueDrawing(pos, pressure);
      syncStrokeChunk(activeTool, brushColor, brushSize, true);
    },
    onEndDrawing: () => {
      const stroke = endDrawing();
      if (stroke) {
        addStroke(stroke, true);
      }
    },
    onStartPan: () => {},
    onPanMove: () => {},
    onEndPan: () => {},
    onStartZoom: () => {},
    onZoomMove: () => {},
    onEndZoom: () => {},
    onContextMenu: (pos) => {
      setContextMenu({ isOpen: true, x: pos.x, y: pos.y });
    },
    onTextInput: (pos) => {
      setTextInput({ visible: true, x: pos.x, y: pos.y, value: '' });
    },
    onFill: (pos) => {
      const stroke = handleFill(pos);
      if (stroke) {
        addStroke(stroke, true);
        socket?.emit('draw:stroke', { stroke });
      }
    },
    containerRef,
  });

  // Socket events hook
  useSocketEvents({
    socket,
    staticCtxRef,
    liveCtxRef,
    canvasStateRef,
    clearLiveCanvas,
    onClear,
    onUndo,
    onRedo,
  });

  // Initialize canvases
  useEffect(() => {
    if (!backgroundCanvasRef.current || !staticCanvasRef.current || !liveCanvasRef.current) return;

    const backgroundCanvas = backgroundCanvasRef.current;
    const staticCanvas = staticCanvasRef.current;
    const liveCanvas = liveCanvasRef.current;

    // Initialize background canvas
    backgroundCanvas.width = CANVAS_SIZE;
    backgroundCanvas.height = CANVAS_SIZE;
    backgroundCtxRef.current = initBackgroundCanvas(backgroundCanvas);

    // Initialize static canvas
    staticCanvas.width = CANVAS_SIZE;
    staticCanvas.height = CANVAS_SIZE;
    staticCtxRef.current = initCanvas(staticCanvas);

    // Initialize live canvas
    liveCanvas.width = CANVAS_SIZE;
    liveCanvas.height = CANVAS_SIZE;
    const liveCtx = liveCanvas.getContext('2d')!;
    liveCtx.lineCap = 'round';
    liveCtx.lineJoin = 'round';
    liveCtxRef.current = liveCtx;

    // Expose controls globally
    (window as any).canvasControls = {
      clear: () => clearCanvasInternal(true),
      undo: () => undoInternal(true),
      redo: () => redoInternal(true),
      zoomIn: () => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) })),
      zoomOut: () => setTransform(prev => ({ ...prev, scale: Math.max(0.01, prev.scale / 1.2) })),
      resetTransform: () => setTransform({ scale: isMobile ? 0.5 : 1.0, translateX: 0, translateY: 0, rotation: 0 }),
      rotate: (dir: 'cw' | 'ccw') => setTransform(prev => ({ ...prev, rotation: prev.rotation + (dir === 'cw' ? 90 : -90) })),
    };
  }, [isMobile, clearCanvasInternal, undoInternal, redoInternal]);

  // Keyboard shortcuts
  const shortcutContext = useMemo<ShortcutContext>(() => ({
    setTool: (tool) => onToolChange?.(tool),
    setBrushSize: (size) => onBrushSizeChange?.(size),
    setBrushColor: (color) => onBrushColorChange?.(color),
    undo: () => undoInternal(true),
    redo: () => redoInternal(true),
    clear: () => {
      if (confirm('Clear the canvas?')) clearCanvasInternal(true);
    },
    zoomIn: () => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) })),
    zoomOut: () => setTransform(prev => ({ ...prev, scale: Math.max(0.01, prev.scale / 1.2) })),
    resetZoom: () => setTransform({ scale: isMobile ? 0.5 : 1.0, translateX: 0, translateY: 0, rotation: 0 }),
    pan: (dx, dy) => setTransform(prev => ({
      ...prev,
      translateX: prev.translateX + dx,
      translateY: prev.translateY + dy,
    })),
    currentTool: activeTool,
    brushSize,
    brushColor,
    isSpacePressed: false,
    isCtrlPressed: false,
    isShiftPressed: false,
  }), [activeTool, brushSize, brushColor, isMobile, onToolChange, onBrushSizeChange, onBrushColorChange, clearCanvasInternal, undoInternal, redoInternal]);

  useEffect(() => {
    const shortcuts = createShortcuts(shortcutContext);

    const onKeyDown = (e: KeyboardEvent) => {
      handleKeyDown(e);

      // Only process drawing shortcuts if user is a drawer
      // Non-drawers (guessers) should not trigger canvas actions
      if (!isDrawer) return;

      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      for (const shortcut of shortcuts) {
        if (matchesShortcut(e, shortcut)) {
          e.preventDefault();
          shortcut.action(shortcutContext);
          return;
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      handleKeyUp(e);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [shortcutContext, handleKeyDown, handleKeyUp, isDrawer]);


  // Add text to canvas
  const addText = useCallback((x: number, y: number, text: string) => {
    if (!staticCtxRef.current || !socket) return;

    const stroke: Stroke = {
      id: Date.now().toString(),
      tool: 'text',
      points: [{ x, y, pressure: 1 }],
      color: brushColor,
      size: brushSize * 2,
      opacity: 1,
      text,
    };

    drawText(staticCtxRef.current, x, y, text, brushColor, brushSize * 2, 1);
    addStroke(stroke, true);
  }, [brushColor, brushSize, socket, addStroke]);


  // Close context menu
  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isOpen: false }));
  }, []);

  // Transform style
  const transformStyle = {
    transform: `translate(${transform.translateX}px, ${transform.translateY}px) scale(${transform.scale}) rotate(${transform.rotation}deg)`,
  };

  return (
    <div
      ref={containerRef}
      className={clsx('canvas-container', { 'is-drawing': inputState === 'drawing' })}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Viewport with transform */}
      <div className="canvas-viewport">
        <div className="canvas-inner" style={transformStyle}>
          {/* Background layer - white, locked */}
          <canvas
            ref={backgroundCanvasRef}
            className="canvas-background"
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
          />

          {/* Static layer - all completed strokes */}
          <canvas
            ref={staticCanvasRef}
            className="canvas-static"
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
          />

          {/* Live layer - current stroke preview */}
          <canvas
            ref={liveCanvasRef}
            className={clsx('canvas-live', {
              'is-drawing': inputState === 'drawing',
              'is-panning': inputState === 'panning',
              'view-only': !isDrawer,
            })}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerLeave}
            onWheel={handleWheel}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="canvas-controls">
        <button
          className="canvas-control-btn"
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))}
          title="Zoom In"
        >
          +
        </button>
        <button
          className="canvas-control-btn"
          onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.01, prev.scale / 1.2) }))}
          title="Zoom Out"
        >
          -
        </button>
        <button
          className="canvas-control-btn"
          onClick={() => setShowTransformControls(!showTransformControls)}
          title="Transform Controls"
        >
          ⌘
        </button>
      </div>

      {/* Transform Controls Modal */}
      {showTransformControls && (
        <TransformControls
          transform={transform}
          show={showTransformControls}
          onToggle={() => setShowTransformControls(!showTransformControls)}
          onZoomIn={() => setTransform(prev => ({ ...prev, scale: Math.min(3, prev.scale * 1.2) }))}
          onZoomOut={() => setTransform(prev => ({ ...prev, scale: Math.max(0.01, prev.scale / 1.2) }))}
          onReset={() => setTransform({ scale: isMobile ? 0.5 : 1.0, translateX: 0, translateY: 0, rotation: 0 })}
          onRotate={(dir) => setTransform(prev => ({ ...prev, rotation: prev.rotation + (dir === 'cw' ? 90 : -90) }))}
        />
      )}


      {/* Text Input Overlay */}
      {textInput.visible && (
        <TextInputOverlay
          visible={textInput.visible}
          x={textInput.x}
          y={textInput.y}
          value={textInput.value}
          color={brushColor}
          size={brushSize * 2}
          onChange={(value) => setTextInput(prev => ({ ...prev, value }))}
          onSubmit={() => {
            if (textInput.value.trim()) {
              addText(textInput.x, textInput.y, textInput.value);
            }
            setTextInput(prev => ({ ...prev, visible: false, value: '' }));
          }}
          onCancel={() => setTextInput(prev => ({ ...prev, visible: false, value: '' }))}
        />
      )}


      {/* Context Menu */}
      {contextMenu.isOpen && (
        <div
          className="canvas-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={closeContextMenu}
        >
          <div className="menu-item" onClick={() => { undoInternal(true); closeContextMenu(); }}>
            Undo
          </div>
          <div className="menu-item" onClick={() => { redoInternal(true); closeContextMenu(); }}>
            Redo
          </div>
          <div className="menu-item" onClick={() => { clearCanvasInternal(true); closeContextMenu(); }}>
            Clear
          </div>
          <div className="menu-divider" />
          <div className="menu-item" onClick={() => {
            setTransform({ scale: isMobile ? 0.5 : 1.0, translateX: 0, translateY: 0, rotation: 0 });
            closeContextMenu();
          }}>
            Reset View
          </div>
        </div>
      )}
    </div>
  );
}
