import { useEffect, useRef } from 'react';

import { GameEvents } from '@/constants/Events';
import { useCanvas } from '@/contexts/canvas';
import { useRoom } from '@/contexts/room';
import { socket } from '@/contexts/socket';
import { CanvasAction, CanvasOperation } from '@/types/canvas';
import { Coordinate } from '@/types/common';

import { convertOptionKeyToCanvasActionKey, OptionKey } from '../Option/utils';

export interface OptionConfig {
  type?: OptionKey;
  color: string;
  brushSize: number;
}

const useCanvasActions = (optionConfig?: OptionConfig) => {
  const {
    room: { id: roomId },
  } = useRoom();
  const { drawing } = useCanvas();

  const optionConfigRef = useRef(optionConfig);
  const roomIdRef = useRef(roomId);
  optionConfigRef.current = optionConfig;
  roomIdRef.current = roomId;

  /** Normalized polyline pending network send (same space as LINE emits). */
  const pendingPolylineRef = useRef<Coordinate[]>([]);
  const rafFlushIdRef = useRef<number | null>(null);

  const flushNetworkBatch = (isFinal: boolean) => {
    const pts = pendingPolylineRef.current;
    if (pts.length < 2) {
      if (isFinal) pendingPolylineRef.current = [];
      return;
    }

    const oc = optionConfigRef.current;
    const rid = roomIdRef.current;
    const batchPoints = [...pts];

    const actionType =
      oc?.type === OptionKey.ERASER
        ? CanvasAction.BATCH_ERASE
        : CanvasAction.BATCH_LINE;

    const canvasOperation: CanvasOperation = {
      actionType,
      points: batchPoints,
      color: oc?.color,
      size: oc?.brushSize,
    };

    socket.emit(GameEvents.EMIT_GAME_CANVAS_OPERATION, {
      canvasOperation,
      roomId: rid,
    });

    const last = batchPoints[batchPoints.length - 1]!;
    pendingPolylineRef.current = isFinal ? [] : [last];
  };

  const scheduleNetworkFlush = () => {
    if (rafFlushIdRef.current != null) return;
    rafFlushIdRef.current = requestAnimationFrame(() => {
      rafFlushIdRef.current = null;
      flushNetworkBatch(false);
    });
  };

  const cancelScheduledFlush = () => {
    if (rafFlushIdRef.current != null) {
      cancelAnimationFrame(rafFlushIdRef.current);
      rafFlushIdRef.current = null;
    }
  };

  useEffect(
    () => () => {
      cancelScheduledFlush();
      pendingPolylineRef.current = [];
    },
    []
  );

  const onPointerDrag = (from: Coordinate, to: Coordinate) => {
    if (!drawing) return;
    const flooredFrom = drawing.normalizeCoordinate(from);
    const flooredTo = drawing.normalizeCoordinate(to);
    const performOperation = () => {
      switch (optionConfig?.type) {
        case OptionKey.PENCIL:
          drawing?.loadOperations([
            {
              actionType: CanvasAction.LINE,
              points: [flooredFrom, flooredTo],
              color: optionConfig.color,
              size: optionConfig.brushSize,
            },
          ]);
          break;
        case OptionKey.ERASER:
          drawing?.loadOperations([
            {
              actionType: CanvasAction.ERASE,
              points: [flooredFrom, flooredTo],
              size: optionConfig.brushSize,
            },
          ]);
          break;
        default:
          return false;
      }
      return true;
    };

    const isOperationDone = performOperation();
    if (!isOperationDone) return;

    const buf = pendingPolylineRef.current;
    if (buf.length === 0) {
      buf.push(flooredFrom, flooredTo);
    } else {
      const last = buf[buf.length - 1]!;
      const sameStart =
        Math.abs(last.x - flooredFrom.x) < 1e-9 &&
        Math.abs(last.y - flooredFrom.y) < 1e-9;
      if (sameStart) {
        buf.push(flooredTo);
      } else {
        buf.push(flooredFrom, flooredTo);
      }
    }

    scheduleNetworkFlush();
  };

  const onPointerDragEnd = () => {
    cancelScheduledFlush();
    flushNetworkBatch(true);
  };

  const onPointerClick = (point: Coordinate) => {
    if (!drawing) return;
    const flooredPoint: Coordinate = drawing?.normalizeCoordinate(point);
    const performOperation = () => {
      switch (optionConfig?.type) {
        case OptionKey.FILL:
          drawing?.loadOperations([
            {
              actionType: CanvasAction.FILL,
              points: [flooredPoint],
              color: optionConfig.color,
            },
          ]);
          break;
        default:
          return false;
      }
      return true;
    };

    const isOperationDone = performOperation();
    if (!isOperationDone) return;

    const canvasAction = convertOptionKeyToCanvasActionKey(optionConfig?.type);
    if (!canvasAction) return;
    socket.emit(GameEvents.EMIT_GAME_CANVAS_OPERATION, {
      roomId,
      canvasOperation: {
        actionType: canvasAction,
        points: [flooredPoint],
        color: optionConfig?.color,
        size: optionConfig?.brushSize,
      },
    });
  };

  if (!optionConfig) return undefined;
  return { onPointerDrag, onPointerDragEnd, onPointerClick };
};

export default useCanvasActions;
