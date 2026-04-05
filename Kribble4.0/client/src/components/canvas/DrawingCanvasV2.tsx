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
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStrokeIdRef = useRef<string | null>(null);
  
  // Initialize CanvasEngine
  const {
    canvasReady,
    isSynced,
    pendingSync,
    commandCount,
    startStroke,
    addPoints,
    endStroke,
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

  // Handle pointer down
  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (!isDrawer || !canvasReady) return;

    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);

    const pos = getPointerPos(e.nativeEvent);
    if (!pos) return;

    const strokeId = startStroke(activeTool, brushColor, brushSize, brushOpacity, pos);
    currentStrokeIdRef.current = strokeId;
    /* First point is in START_STROKE; avoid duplicate ADD_POINTS on pointer down */

    setIsDrawing(true);
  }, [isDrawer, canvasReady, activeTool, brushColor, brushSize, brushOpacity, startStroke, addPoints, getPointerPos]);

  // Handle pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDrawing || !isDrawer || !currentStrokeIdRef.current) return;

      e.preventDefault();

      const ne = e.nativeEvent;
      const events =
        typeof ne.getCoalescedEvents === 'function' ? ne.getCoalescedEvents() : [ne];
      const pts: Point[] = [];
      for (const ev of events) {
        const p = getPointerPos(ev);
        if (p) pts.push(p);
      }
      if (pts.length) addPoints(currentStrokeIdRef.current, pts);
    },
    [isDrawing, isDrawer, addPoints, getPointerPos]
  );

  // Handle pointer up
  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDrawing || !currentStrokeIdRef.current) return;
    
    e.preventDefault();
    
    // End stroke
    endStroke(currentStrokeIdRef.current);
    currentStrokeIdRef.current = null;
    setIsDrawing(false);
  }, [isDrawing, endStroke]);

  // Handle clear
  const handleClear = useCallback(() => {
    clearCanvas();
    onClear?.();
  }, [clearCanvas, onClear]);

  // Handle undo
  const handleUndo = useCallback(() => {
    undo();
    onUndo?.();
  }, [undo, onUndo]);

  // Handle redo
  const handleRedo = useCallback(() => {
    redo();
    onRedo?.();
  }, [redo, onRedo]);

  // Keyboard shortcuts
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

  return (
    <div 
      ref={containerRef}
      className={clsx('drawing-canvas-container', isMobile && 'mobile')}
    >
      {/* Sync Status Indicator */}
      {pendingSync && (
        <div className="canvas-sync-status syncing">
          <span className="sync-spinner">⟳</span>
          Syncing canvas...
        </div>
      )}
      {!pendingSync && isSynced && (
        <div className="canvas-sync-status synced">
          ✓ Canvas synced ({commandCount} commands)
        </div>
      )}
      
      {/* Canvas Stack */}
      <div className="canvas-stack">
        {/* Static Canvas - Committed Strokes */}
        <canvas
          ref={staticCanvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="canvas-layer static-canvas"
          style={{ willChange: 'transform' }} // GPU acceleration
        />
        
        {/* Live Canvas - Active Stroke Preview */}
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
            willChange: 'transform', // GPU acceleration
          }}
        />

      </div>
      
      {/* Controls */}
      {isDrawer && (
        <div className="canvas-controls">
          <button 
            className="canvas-btn" 
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            ↩ Undo
          </button>
          <button 
            className="canvas-btn" 
            onClick={handleRedo}
            title="Redo (Ctrl+Shift+Z)"
          >
            ↪ Redo
          </button>
          <button 
            className="canvas-btn danger" 
            onClick={handleClear}
            title="Clear Canvas"
          >
            ✕ Clear
          </button>
        </div>
      )}
      
      {/* Info */}
      <div className="canvas-info">
        <span>Tool: {activeTool}</span>
        <span>Size: {brushSize}px</span>
        <span>Opacity: {Math.round(brushOpacity * 100)}%</span>
      </div>
    </div>
  );
}
