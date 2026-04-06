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
  const engineRef = useRef<CanvasEngine | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [isSynced, setIsSynced] = useState(false);
  const [pendingSync, setPendingSync] = useState(false);
  const [commandCount, setCommandCount] = useState(0);

  const pendingPointsRef = useRef<Map<string, Point[]>>(new Map());
  const flushRafRef = useRef<number | null>(null);
  const scheduledStrokeIdRef = useRef<string | null>(null);
  const activeStrokeIdRef = useRef<string | null>(null);

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

  const flushPendingPoints = useCallback((strokeId: string) => {
    const pending = pendingPointsRef.current.get(strokeId);
    if (!pending || pending.length === 0) return;

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

    engineRef.current?.applyCommand(command);
    socket?.emit('canvas:command', { command });
    pendingPointsRef.current.set(strokeId, []);
  }, [roomId, userId, socket]);

  const cancelScheduledFlush = useCallback(() => {
    if (flushRafRef.current != null) {
      cancelAnimationFrame(flushRafRef.current);
      flushRafRef.current = null;
    }
    scheduledStrokeIdRef.current = null;
  }, []);

  const resetLocalCanvasState = useCallback(() => {
    cancelScheduledFlush();
    pendingPointsRef.current.clear();
    activeStrokeIdRef.current = null;
    setCommandCount(0);
    setIsSynced(false);
    setPendingSync(false);
    engineRef.current?.replayCommands([]);
  }, [cancelScheduledFlush]);

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

  useEffect(() => {
    if (!socket || !canvasReady || !engineRef.current) return;

    const handleCanvasCommand = (data: { playerId: string; command: CanvasCommand }) => {
      if (data.playerId === userId) return;
      engineRef.current?.applyCommand(data.command);
    };

    const handleCanvasSync = (data: { commands?: CanvasCommand[]; strokes?: Stroke[] }) => {
      setPendingSync(true);

      try {
        let nextCommandCount = 0;

        if (Array.isArray(data.commands)) {
          nextCommandCount = data.commands.length;
          engineRef.current?.replayCommands(data.commands);
          console.log('[CANVAS] Synced via command history:', data.commands.length, 'commands');
        } else if (Array.isArray(data.strokes)) {
          const commands = strokesToCommands(data.strokes, roomId || '', userId || '');
          nextCommandCount = commands.length;
          engineRef.current?.replayCommands(commands);
          console.log('[CANVAS] Synced via legacy strokes:', data.strokes.length, 'strokes');
        } else {
          engineRef.current?.replayCommands([]);
          console.log('[CANVAS] Sync payload empty; canvas cleared');
        }

        pendingPointsRef.current.clear();
        activeStrokeIdRef.current = null;
        setCommandCount(nextCommandCount);
        setIsSynced(true);
        setPendingSync(false);
        onSyncComplete?.();
      } catch (error) {
        console.error('[CANVAS] Sync failed:', error);
        setPendingSync(false);
      }
    };

    socket.on('canvas:command', handleCanvasCommand);
    socket.on('canvas:sync', handleCanvasSync);

    if (roomId) {
      socket.emit('canvas:request-sync', { roomId });
    }

    return () => {
      socket.off('canvas:command', handleCanvasCommand);
      socket.off('canvas:sync', handleCanvasSync);
    };
  }, [socket, roomId, userId, onSyncComplete, canvasReady]);

  useEffect(() => {
    if (!canvasReady) return;
    resetLocalCanvasState();
  }, [canvasReady, roomId, isDrawer, resetLocalCanvasState]);

  const applyLocalCommand = useCallback((command: CanvasCommand) => {
    if (!isDrawer) {
      console.warn('[CANVAS] Only drawer can send commands');
      return;
    }

    engineRef.current?.applyCommand(command);
    socket?.emit('canvas:command', { command });
  }, [isDrawer, socket]);

  const startStroke = useCallback((tool: ToolType, color: string, size: number, opacity: number, startPoint?: Point): string => {
    if (!isDrawer) return '';

    cancelScheduledFlush();

    const strokeId = `stroke-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    activeStrokeIdRef.current = strokeId;
    pendingPointsRef.current.set(strokeId, []);

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

  const endStroke = useCallback((strokeId: string) => {
    if (!isDrawer) return;

    cancelScheduledFlush();
    flushPendingPoints(strokeId);

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

    pendingPointsRef.current.delete(strokeId);
    if (activeStrokeIdRef.current === strokeId) {
      activeStrokeIdRef.current = null;
    }
  }, [isDrawer, roomId, userId, applyLocalCommand, flushPendingPoints, cancelScheduledFlush]);

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

function strokesToCommands(strokes: Stroke[], roomId: string, userId: string): CanvasCommand[] {
  const commands: CanvasCommand[] = [];

  for (const stroke of strokes) {
    const timestamp = Date.now();

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
