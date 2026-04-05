/**
 * useCanvasEngine - Professional Canvas Command Protocol Integration
 * 
 * This hook provides a complete canvas synchronization system using the
 * unified Canvas Command Protocol. It replaces the legacy stroke-based
 * system with deterministic command-based replication.
 * 
 * Features:
 * - Real-time command streaming
 * - Deterministic replay for late joiners
 * - Perfect sync across all clients
 * - Undo/redo with command history
 * - 60fps batching for smooth performance
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useState,
  type RefObject,
} from 'react';
import { CanvasEngine } from '../CanvasEngine';
import type { 
  CanvasCommand, 
  StartStrokePayload, 
  AddPointsPayload, 
  EndStrokePayload,
  FillPayload,
  Point,
  ToolType,
  Stroke
} from '../types';

interface UseCanvasEngineOptions {
  socket: any;
  staticCanvasRef: RefObject<HTMLCanvasElement | null>;
  liveCanvasRef: RefObject<HTMLCanvasElement | null>;
  isDrawer: boolean;
  roomId?: string;
  userId?: string;
  onStrokeComplete?: (stroke: Stroke) => void;
  onSyncComplete?: () => void;
}

export interface UseCanvasEngineReturn {
  /** True after both canvases are mounted and CanvasEngine is constructed */
  canvasReady: boolean;
  engine: CanvasEngine | null;
  isSynced: boolean;
  pendingSync: boolean;
  commandCount: number;
  applyLocalCommand: (command: CanvasCommand) => void;
  startStroke: (tool: ToolType, color: string, size: number, opacity: number, startPoint?: Point) => string;
  addPoints: (strokeId: string, points: Point[]) => void;
  endStroke: (strokeId: string) => void;
  fill: (x: number, y: number, color: string, tolerance?: number) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  exportCanvas: () => string;
}

export function useCanvasEngine({
  socket,
  staticCanvasRef,
  liveCanvasRef,
  isDrawer,
  roomId,
  userId,
  onStrokeComplete,
  onSyncComplete,
}: UseCanvasEngineOptions): UseCanvasEngineReturn {
  // Engine reference
  const engineRef = useRef<CanvasEngine | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  
  // Sync state
  const [isSynced, setIsSynced] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const [commandCount, setCommandCount] = useState(0);
  
  const pendingPointsRef = useRef<Map<string, Point[]>>(new Map());
  const flushRafRef = useRef<number | null>(null);
  const scheduledStrokeIdRef = useRef<string | null>(null);

  // Active stroke tracking
  const activeStrokeIdRef = useRef<string | null>(null);

  // Initialize CanvasEngine after canvases exist (refs are read after layout — not .current from render)
  useLayoutEffect(() => {
    const staticCanvas = staticCanvasRef.current;
    const liveCanvas = liveCanvasRef.current;
    if (!staticCanvas || !liveCanvas) return;

    const engine = new CanvasEngine({
      staticCanvas,
      liveCanvas,
      onStrokeComplete: (stroke) => {
        onStrokeComplete?.(stroke);
      },
      onCommandApplied: () => {
        setCommandCount((prev) => prev + 1);
      },
    });

    engineRef.current = engine;
    setCanvasReady(true);

    return () => {
      engine.destroy();
      engineRef.current = null;
      setCanvasReady(false);
    };
  }, [staticCanvasRef, liveCanvasRef, onStrokeComplete]);

  // Socket event handlers for canvas sync (runs after engine exists)
  useEffect(() => {
    if (!socket || !canvasReady || !engineRef.current) return;
    
    // Handle incoming commands from other players
    const handleCanvasCommand = (data: { playerId: string; command: CanvasCommand }) => {
      // Don't apply our own commands (server excludes sender, but double-check)
      if (data.playerId === userId) return;
      
      // Apply command to local canvas
      engineRef.current?.applyCommand(data.command);
    };
    
    // Handle canvas sync on join/reconnect
    const handleCanvasSync = (data: { commands?: CanvasCommand[]; strokes?: Stroke[] }) => {
      setPendingSync(true);
      
      try {
        if (data.commands && data.commands.length > 0) {
          // New: Replay command history for deterministic sync
          engineRef.current?.replayCommands(data.commands);
          console.log('[CANVAS] Synced via command history:', data.commands.length, 'commands');
        } else if (data.strokes && data.strokes.length > 0) {
          // Legacy: Fallback to stroke array
          // Convert strokes to commands and replay
          const commands = strokesToCommands(data.strokes, roomId || '', userId || '');
          engineRef.current?.replayCommands(commands);
          console.log('[CANVAS] Synced via legacy strokes:', data.strokes.length, 'strokes');
        }
        
        setIsSynced(true);
        setPendingSync(false);
        onSyncComplete?.();
      } catch (error) {
        console.error('[CANVAS] Sync failed:', error);
        setPendingSync(false);
      }
    };
    
    // Register listeners
    socket.on('canvas:command', handleCanvasCommand);
    socket.on('canvas:sync', handleCanvasSync);
    
    // Request sync if we're joining an existing game
    if (roomId) {
      socket.emit('canvas:request-sync', { roomId });
    }
    
    return () => {
      socket.off('canvas:command', handleCanvasCommand);
      socket.off('canvas:sync', handleCanvasSync);
    };
  }, [socket, roomId, userId, onSyncComplete, canvasReady]);

  // Flush pending points for a stroke
  const flushPendingPoints = useCallback((strokeId: string) => {
    const pending = pendingPointsRef.current.get(strokeId);
    if (!pending || pending.length === 0) return;
    
    // Create ADD_POINTS command
    const command: CanvasCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: roomId || '',
      userId: userId || '',
      type: 'ADD_POINTS',
      timestamp: Date.now(),
      payload: {
        strokeId,
        points: [...pending],
      } as AddPointsPayload,
    };
    
    // Apply locally
    engineRef.current?.applyCommand(command);
    
    // Send to server
    socket?.emit('canvas:command', { command });
    
    // Clear pending
    pendingPointsRef.current.set(strokeId, []);
  }, [roomId, userId, socket]);

  const cancelScheduledFlush = useCallback(() => {
    if (flushRafRef.current != null) {
      cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }
    scheduledStrokeIdRef.current = null;
  }, []);

  useEffect(() => () => cancelScheduledFlush(), [cancelScheduledFlush]);

  const scheduleFlushStroke = useCallback(
    (strokeId: string) => {
      scheduledStrokeIdRef.current = strokeId;
      if (flushRafRef.current != null) return;
      flushRafRef.current = requestAnimationFrame(() => {
        flushRafRef.current = null;
        const sid = scheduledStrokeIdRef.current;
        scheduledStrokeIdRef.current = null;
        if (sid) flushPendingPoints(sid);
      });
    },
    [flushPendingPoints]
  );

  // Apply local command (for drawer)
  const applyLocalCommand = useCallback((command: CanvasCommand) => {
    if (!isDrawer) {
      console.warn('[CANVAS] Only drawer can send commands');
      return;
    }
    
    // Apply locally first
    engineRef.current?.applyCommand(command);
    
    // Send to server
    socket?.emit('canvas:command', { command });
  }, [isDrawer, socket]);

  // Start a new stroke
  const startStroke = useCallback((tool: ToolType, color: string, size: number, opacity: number, startPoint?: Point): string => {
    if (!isDrawer) return '';

    cancelScheduledFlush();

    const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeStrokeIdRef.current = strokeId;
    
    // Initialize pending points
    pendingPointsRef.current.set(strokeId, []);
    
    // Create START_STROKE command
    const command: CanvasCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: roomId || '',
      userId: userId || '',
      type: 'START_STROKE',
      timestamp: Date.now(),
      payload: {
        strokeId,
        tool,
        color,
        size,
        opacity,
        startPoint: startPoint || { x: 0, y: 0 },
      } as StartStrokePayload,
    };
    
    applyLocalCommand(command);
    
    return strokeId;
  }, [isDrawer, roomId, userId, applyLocalCommand, cancelScheduledFlush]);

  // Batched per animation frame: smooth local strokes without hundreds of socket.emit per second
  const addPoints = useCallback(
    (strokeId: string, points: Point[]) => {
      if (!isDrawer) return;

      const pending = pendingPointsRef.current.get(strokeId) || [];
      pending.push(...points);
      pendingPointsRef.current.set(strokeId, pending);

      scheduleFlushStroke(strokeId);
    },
    [isDrawer, scheduleFlushStroke]
  );

  // End stroke
  const endStroke = useCallback((strokeId: string) => {
    if (!isDrawer) return;

    cancelScheduledFlush();
    flushPendingPoints(strokeId);
    
    // Create END_STROKE command
    const command: CanvasCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: roomId || '',
      userId: userId || '',
      type: 'END_STROKE',
      timestamp: Date.now(),
      payload: {
        strokeId,
      } as EndStrokePayload,
    };
    
    applyLocalCommand(command);
    
    // Cleanup
    pendingPointsRef.current.delete(strokeId);
    if (activeStrokeIdRef.current === strokeId) {
      activeStrokeIdRef.current = null;
    }
  }, [isDrawer, roomId, userId, applyLocalCommand, flushPendingPoints, cancelScheduledFlush]);

  // Fill tool
  const fill = useCallback((x: number, y: number, color: string, tolerance?: number) => {
    if (!isDrawer) return;
    
    const command: CanvasCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: roomId || '',
      userId: userId || '',
      type: 'FILL',
      timestamp: Date.now(),
      payload: {
        x,
        y,
        color,
        tolerance: tolerance || 32,
      } as FillPayload,
    };
    
    applyLocalCommand(command);
  }, [isDrawer, roomId, userId, applyLocalCommand]);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (!isDrawer) return;
    
    const command: CanvasCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: roomId || '',
      userId: userId || '',
      type: 'CLEAR_CANVAS',
      timestamp: Date.now(),
      payload: {},
    };
    
    applyLocalCommand(command);
  }, [isDrawer, roomId, userId, applyLocalCommand]);

  // Undo
  const undo = useCallback(() => {
    if (!isDrawer) return;
    
    const command: CanvasCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: roomId || '',
      userId: userId || '',
      type: 'UNDO',
      timestamp: Date.now(),
      payload: {},
    };
    
    applyLocalCommand(command);
  }, [isDrawer, roomId, userId, applyLocalCommand]);

  // Redo
  const redo = useCallback(() => {
    if (!isDrawer) return;
    
    const command: CanvasCommand = {
      id: `cmd-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      roomId: roomId || '',
      userId: userId || '',
      type: 'REDO',
      timestamp: Date.now(),
      payload: {},
    };
    
    applyLocalCommand(command);
  }, [isDrawer, roomId, userId, applyLocalCommand]);

  // Export canvas
  const exportCanvas = useCallback((): string => {
    return engineRef.current?.exportCanvas() || '';
  }, []);

  return {
    canvasReady,
    engine: engineRef.current,
    isSynced,
    pendingSync,
    commandCount,
    applyLocalCommand,
    startStroke,
    addPoints,
    endStroke,
    fill,
    clearCanvas,
    undo,
    redo,
    exportCanvas,
  };
}

// Helper: Convert legacy strokes to commands
function strokesToCommands(strokes: Stroke[], roomId: string, userId: string): CanvasCommand[] {
  const commands: CanvasCommand[] = [];
  
  for (const stroke of strokes) {
    const timestamp = Date.now();
    
    // START_STROKE
    commands.push({
      id: `cmd-${timestamp}-start-${stroke.id}`,
      roomId,
      userId,
      type: 'START_STROKE',
      timestamp,
      payload: {
        strokeId: stroke.id,
        tool: stroke.tool,
        color: stroke.color,
        size: stroke.size,
        opacity: stroke.opacity,
        startPoint: stroke.points[0] || { x: 0, y: 0 },
      } as StartStrokePayload,
    });
    
    // ADD_POINTS (batch all points)
    if (stroke.points.length > 0) {
      commands.push({
        id: `cmd-${timestamp}-points-${stroke.id}`,
        roomId,
        userId,
        type: 'ADD_POINTS',
        timestamp,
        payload: {
          strokeId: stroke.id,
          points: stroke.points,
        } as AddPointsPayload,
      });
    }
    
    // END_STROKE
    commands.push({
      id: `cmd-${timestamp}-end-${stroke.id}`,
      roomId,
      userId,
      type: 'END_STROKE',
      timestamp,
      payload: {
        strokeId: stroke.id,
      } as EndStrokePayload,
    });
  }
  
  return commands;
}
