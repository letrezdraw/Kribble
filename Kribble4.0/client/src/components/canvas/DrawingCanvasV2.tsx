/**
 * DrawingCanvasV2 - Professional Canvas with Command Protocol
 *
 * This is the next-generation drawing canvas using the unified
 * Canvas Command Protocol for perfect synchronization across all clients.
 *
 * Features:
 * - Real-time command streaming
 * - Deterministic replay for late joiners
 * - 60fps smooth drawing with pressure support
 * - Dual-layer rendering (static + live)
 * - Professional tool system
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { useCanvasEngine } from './hooks/useCanvasEngine';
import type { ToolType, Point } from './types';
import './DrawingCanvas.css';
import './DrawingCanvasV2.css';

const CANVAS_SIZE = 800;

interface DrawingCanvasV2Props {
  isDrawer: boolean;
  brushColor: string;
  brushSize: number;
  brushOpacity: number;
  activeTool: ToolType;
  roomId?: string;
  onUndo?: () => void;
  onRedo?: () => void;
  onClear?: () => void;
  isMobile?: boolean;
}

function formatToolLabel(tool: ToolType): string {
  switch (tool) {
    case 'rect':
      return 'Rectangle';
    case 'circle':
      return 'Circle';
    case 'line':
      return 'Line';
    case 'brush':
      return 'Brush';
    case 'eraser':
      return 'Eraser';
    case 'fill':
      return 'Fill';
    case 'text':
      return 'Text';
    case 'clear':
      return 'Clear';
    default:
      return tool;
  }
}

export default function DrawingCanvasV2({
  isDrawer,
  brushColor,
  brushSize,
  brushOpacity,
  activeTool,
  roomId,
  onUndo,
  onRedo,
  onClear,
  isMobile = false,
}: DrawingCanvasV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const staticCanvasRef = useRef<HTMLCanvasElement>(null);
  const liveCanvasRef = useRef<HTMLCanvasElement>(null);

  const { socket } = useSocket();
  const { user } = useAuth();

  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeIdRef = useRef<string | null>(null);

  const {
    canvasReady,
    isSynced,
    pendingSync,
    commandCount,
    startStroke,
    addPoints,
    endStroke,
    fill,
    clearCanvas,
    undo,
    redo,
  } = useCanvasEngine({
    socket,
    staticCanvasRef,
    liveCanvasRef,
    isDrawer,
    roomId,
    userId: user?.id,
    onStrokeComplete: (stroke) => {
      console.log('[CANVAS] Stroke completed:', stroke.id, 'with', stroke.points.length, 'points');
    },
    onSyncComplete: () => {
      console.log('[CANVAS] Sync complete! Canvas is ready.');
    },
  });

  const getPointerPos = useCallback((e: PointerEvent): Point | null => {
    const canvas = staticCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
      pressure: e.pressure || 0.5,
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isDrawer || !canvasReady) return;

    e.preventDefault();

    const pos = getPointerPos(e.nativeEvent);
    if (!pos) return;

    if (activeTool === 'fill') {
      fill(pos.x, pos.y, brushColor);
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);

    const strokeId = startStroke(activeTool, brushColor, brushSize, brushOpacity, pos);
    currentStrokeIdRef.current = strokeId;
    setIsDrawing(true);
  }, [isDrawer, canvasReady, activeTool, brushColor, brushSize, brushOpacity, startStroke, fill, getPointerPos]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing || !isDrawer || !currentStrokeIdRef.current) return;

      e.preventDefault();

      const nativeEvent = e.nativeEvent;
      const events =
        typeof nativeEvent.getCoalescedEvents === 'function'
          ? nativeEvent.getCoalescedEvents()
          : [nativeEvent];
      const points: Point[] = [];

      for (const event of events) {
        const point = getPointerPos(event);
        if (point) points.push(point);
      }

      if (points.length > 0) {
        addPoints(currentStrokeIdRef.current, points);
      }
    },
    [isDrawing, isDrawer, addPoints, getPointerPos]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !currentStrokeIdRef.current) return;

    e.preventDefault();
    endStroke(currentStrokeIdRef.current);
    currentStrokeIdRef.current = null;
    setIsDrawing(false);
  }, [isDrawing, endStroke]);

  const handleClear = useCallback(() => {
    clearCanvas();
    onClear?.();
  }, [clearCanvas, onClear]);

  const handleUndo = useCallback(() => {
    undo();
    onUndo?.();
  }, [undo, onUndo]);

  const handleRedo = useCallback(() => {
    redo();
    onRedo?.();
  }, [redo, onRedo]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isDrawer) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawer, handleUndo, handleRedo]);

  const statusLabel = !canvasReady
    ? 'Preparing canvas...'
    : pendingSync
      ? 'Syncing canvas...'
      : isSynced
        ? `Canvas synced (${commandCount} commands)`
        : 'Live canvas ready';

  const statusTone = !canvasReady || pendingSync ? 'syncing' : 'synced';
  const modeLabel = isDrawer ? 'Drawer controls active' : 'Viewer mode';
  const toolLabel = formatToolLabel(activeTool);

  return (
    <div
      ref={containerRef}
      className={clsx('drawing-canvas-container', isMobile && 'mobile')}
    >
      <div className={clsx('canvas-sync-status', statusTone)}>
        {(pendingSync || !canvasReady) ? (
          <span className="sync-spinner" aria-hidden="true">↻</span>
        ) : (
          <span className="sync-check" aria-hidden="true">✓</span>
        )}
        <span>{statusLabel}</span>
      </div>

      <div className="canvas-mode-chip">{modeLabel}</div>

      <div className="canvas-stack">
        {!canvasReady && (
          <div className="canvas-loading" aria-live="polite">
            <div className="spinner" />
            <span>Initializing drawing engine...</span>
          </div>
        )}

        <canvas
          ref={staticCanvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="canvas-layer static-canvas"
          style={{ willChange: 'transform' }}
        />

        <canvas
          ref={liveCanvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="canvas-layer live-canvas"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            touchAction: 'none',
            cursor: isDrawer ? 'crosshair' : 'default',
            willChange: 'transform',
          }}
        />
      </div>

      {isDrawer && (
        <div className="canvas-controls">
          <button
            className="canvas-btn"
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
            disabled={!canvasReady || pendingSync}
          >
            ↩ Undo
          </button>
          <button
            className="canvas-btn"
            onClick={handleRedo}
            title="Redo (Ctrl+Shift+Z)"
            disabled={!canvasReady || pendingSync}
          >
            ↪ Redo
          </button>
          <button
            className="canvas-btn danger"
            onClick={handleClear}
            title="Clear Canvas"
            disabled={!canvasReady || pendingSync}
          >
            ✕ Clear
          </button>
        </div>
      )}

      <div className="canvas-info">
        <span>Tool: {toolLabel}</span>
        <span>Size: {brushSize}px</span>
        <span>Opacity: {Math.round(brushOpacity * 100)}%</span>
      </div>
    </div>
  );
}
