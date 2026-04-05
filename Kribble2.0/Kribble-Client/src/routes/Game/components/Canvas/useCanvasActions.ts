import { useCallback, useEffect, useMemo, useRef } from 'react';

import { GameEvents } from '@/constants/Events';
import { useCanvas } from '@/contexts/canvas';
import { useRoom } from '@/contexts/room';
import { emitFireAndForget } from '@/contexts/socket';
import { CanvasAction, CanvasOperation } from '@/types/canvas';
import { Coordinate } from '@/types/common';
import {
  smoothToward,
  STROKE_MAX_STEP_PX,
  STROKE_SMOOTH_ALPHA,
  subdivideSegment,
} from '@/utils/strokeSmoothing';

import { convertOptionKeyToCanvasActionKey, OptionKey } from '../Option/utils';

export interface OptionConfig {
  type?: OptionKey;
  color: string;
  brushSize: number;
}

const appendNormalizedToBuffer = (
  buf: Coordinate[],
  nf: Coordinate,
  nt: Coordinate
) => {
  if (buf.length === 0) {
    buf.push(nf, nt);
    return;
  }
  const last = buf[buf.length - 1]!;
  const sameStart =
    Math.abs(last.x - nf.x) < 1e-9 && Math.abs(last.y - nf.y) < 1e-9;
  if (sameStart) buf.push(nt);
  else buf.push(nf, nt);
};

const useCanvasActions = (optionConfig?: OptionConfig) => {
  const {
    room: { id: roomId },
  } = useRoom();
  const { drawing } = useCanvas();

  const optionConfigRef = useRef(optionConfig);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  optionConfigRef.current = optionConfig;

  const pendingPolylineRef = useRef<Coordinate[]>([]);
  const rafFlushIdRef = useRef<number | null>(null);
  const flushNetworkBatchRef = useRef<(isFinal: boolean) => void>(() => {});

  const strokeOpenRef = useRef(false);
  const smoothPenRef = useRef<Coordinate | null>(null);
  const lastDrawnBitmapRef = useRef<Coordinate | null>(null);

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

    emitFireAndForget(GameEvents.EMIT_GAME_CANVAS_OPERATION, {
      canvasOperation,
      roomId: rid,
    });

    const last = batchPoints[batchPoints.length - 1]!;
    pendingPolylineRef.current = isFinal ? [] : [last];
  };

  flushNetworkBatchRef.current = flushNetworkBatch;

  const scheduleNetworkFlush = () => {
    if (rafFlushIdRef.current != null) return;
    rafFlushIdRef.current = window.setTimeout(() => {
      rafFlushIdRef.current = null;
      flushNetworkBatch(false);
    }, 33); // Throttles network emits to ~30 FPS (33ms) to prevent socket overload
  };

  const cancelScheduledFlush = () => {
    if (rafFlushIdRef.current != null) {
      window.clearTimeout(rafFlushIdRef.current);
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

  const resetStrokeGeometry = () => {
    strokeOpenRef.current = false;
    smoothPenRef.current = null;
    lastDrawnBitmapRef.current = null;
  };

  const onPointerDrag = useCallback((from: Coordinate, to: Coordinate) => {
    if (!drawing) return;
    const oc = optionConfigRef.current;
    if (!oc) return;

    switch (oc.type) {
      case OptionKey.PENCIL:
      case OptionKey.ERASER:
        break;
      default:
        return;
    }

    if (!strokeOpenRef.current) {
      strokeOpenRef.current = true;
      smoothPenRef.current = { ...from };
      lastDrawnBitmapRef.current = { ...from };
    }

    const smoothTip = smoothPenRef.current!;
    const nextSmooth = smoothToward(smoothTip, to, STROKE_SMOOTH_ALPHA);
    smoothPenRef.current = nextSmooth;

    const lastBm = lastDrawnBitmapRef.current!;
    const chain = subdivideSegment(lastBm, nextSmooth, STROKE_MAX_STEP_PX);

    for (let i = 1; i < chain.length; i++) {
      const a = chain[i - 1]!;
      const b = chain[i]!;
      const nf = drawing.normalizeCoordinate(a);
      const nt = drawing.normalizeCoordinate(b);

      if (oc.type === OptionKey.PENCIL) {
        drawing.loadOperations([
          {
            actionType: CanvasAction.LINE,
            points: [nf, nt],
            color: oc.color,
            size: oc.brushSize,
          },
        ]);
      } else {
        drawing.loadOperations([
          {
            actionType: CanvasAction.ERASE,
            points: [nf, nt],
            size: oc.brushSize,
          },
        ]);
      }

      appendNormalizedToBuffer(pendingPolylineRef.current, nf, nt);
    }

    lastDrawnBitmapRef.current = { ...nextSmooth };
    scheduleNetworkFlush();
  }, [drawing]);

  const onPointerDragEnd = useCallback(() => {
    cancelScheduledFlush();
    flushNetworkBatchRef.current(true);
    resetStrokeGeometry();
  }, []);

  const onPointerClick = useCallback(
    (point: Coordinate) => {
      if (!drawing) return;
      const oc = optionConfigRef.current;
      if (!oc || oc.type !== OptionKey.FILL) return;

      const flooredPoint = drawing.normalizeCoordinate(point);

      drawing.loadOperations([
        {
          actionType: CanvasAction.FILL,
          points: [flooredPoint],
          color: oc.color,
        },
      ]);

      const canvasAction = convertOptionKeyToCanvasActionKey(oc.type);
      if (!canvasAction) return;
      emitFireAndForget(GameEvents.EMIT_GAME_CANVAS_OPERATION, {
        roomId: roomIdRef.current,
        canvasOperation: {
          actionType: canvasAction,
          points: [flooredPoint],
          color: oc.color,
          size: oc.brushSize,
        },
      });
    },
    [drawing]
  );

  return useMemo(() => {
    if (!optionConfig) return undefined;
    return { onPointerDrag, onPointerDragEnd, onPointerClick };
  }, [optionConfig, onPointerDrag, onPointerDragEnd, onPointerClick]);
};

export default useCanvasActions;
