import { useEffect, useCallback, useRef } from 'react';
import type { Stroke, ToolType, Point } from '../types';
import { drawStroke, redrawAllStrokes, clearCanvas } from '../drawingTools';
import { decodeMessage, expandStroke } from '@kribble/shared';


export interface UseSocketEventsOptions {

  socket: any;
  staticCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  liveCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  canvasStateRef: React.MutableRefObject<{ strokes: Stroke[]; redoStack: Stroke[] }>;
  clearLiveCanvas: () => void;
  onClear?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
}

export function useSocketEvents({
  socket,
  staticCtxRef,
  liveCtxRef,
  canvasStateRef,
  clearLiveCanvas,
  onClear,
  onUndo,
  onRedo,
}: UseSocketEventsOptions) {
  const renderChunkToCanvas = useCallback((ctx: CanvasRenderingContext2D, points: Point[], tool: ToolType, color: string, size: number) => {
    if (points.length < 2) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const baseRadius = size / 2;

    for (let i = 1; i < points.length; i++) {
      const p = points[i];
      const prev = points[i - 1];
      const pressure = (p as any).pressure || 1;
      const radius = baseRadius * (0.2 + pressure * 0.8);

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
  }, []);

  useEffect(() => {
    console.log('[SOCKET] useSocketEvents effect running, socket exists:', !!socket);
    if (!socket) {
      console.log('[SOCKET] No socket, skipping event registration');
      return;
    }

    console.log('[SOCKET] Registering draw:stroke listener');
    const handleDrawStroke = (data: { playerId: string; stroke: Stroke }) => {

      // Server already excludes sender with socket.to(), no need to filter
      console.log('[DRAW] Received stroke from player:', data.playerId, 'strokeId:', data.stroke?.id);
      console.log('[DRAW] My socket.id:', socket.id);
      console.log('[DRAW] Canvas context exists:', !!staticCtxRef.current);
      console.log('[DRAW] Stroke data:', {
        tool: data.stroke?.tool,
        points: data.stroke?.points?.length,
        color: data.stroke?.color,
        size: data.stroke?.size
      });
      
      if (!staticCtxRef.current) {
        console.error('[DRAW] ERROR: staticCtxRef.current is null!');
        return;
      }
      
      if (!data.stroke || !data.stroke.points || data.stroke.points.length === 0) {
        console.error('[DRAW] ERROR: Invalid stroke data!', data.stroke);
        return;
      }
      
      canvasStateRef.current.strokes.push(data.stroke);
      drawStroke(staticCtxRef.current, data.stroke);
      console.log('[DRAW] Stroke drawn successfully');
    };




    const handleDrawStrokeBinary = (buffer: Uint8Array) => {
      try {
        const decoded = decodeMessage<{ playerId: string; stroke: (string | number)[] }>(buffer);
        // Server already excludes sender with socket.to(), no need to filter
        
        const expanded = expandStroke(decoded.stroke);

        // Map expanded properties to Stroke type (width -> size)
        const stroke: Stroke = {
          id: expanded.id,
          tool: expanded.tool as Stroke['tool'],
          points: expanded.points,
          color: expanded.color,
          size: expanded.width, // Map width to size
          opacity: expanded.opacity,
        };

        canvasStateRef.current.strokes.push(stroke);
        drawStroke(staticCtxRef.current!, stroke);
      } catch (error) {
        console.error('Failed to decode binary stroke:', error);
      }
    };



    const handleDrawStrokeChunk = (data: { playerId: string; points: Point[]; tool: ToolType; color: string; size: number }) => {
      // Server already excludes sender with socket.to(), no need to filter
      if (liveCtxRef.current) {
        renderChunkToCanvas(liveCtxRef.current, data.points, data.tool, data.color, data.size);
      }
    };


    const handleDrawClear = () => {
      if (!staticCtxRef.current) return;
      clearCanvas(staticCtxRef.current);
      clearLiveCanvas();
      canvasStateRef.current.strokes = [];
      onClear?.();
    };

    const handleGameRoundEnd = () => {
      if (!staticCtxRef.current) return;
      clearCanvas(staticCtxRef.current);
      clearLiveCanvas();
      canvasStateRef.current = { strokes: [], redoStack: [] };
    };

    const handleDrawUndo = () => {
      const { strokes, redoStack } = canvasStateRef.current;
      if (strokes.length === 0) return;

      const removed = strokes.pop()!;
      redoStack.push(removed);
      redrawAllStrokes(staticCtxRef.current!, strokes);
      clearLiveCanvas();
      onUndo?.();
    };

    const handleDrawRedo = () => {
      const { strokes, redoStack } = canvasStateRef.current;
      if (redoStack.length === 0) return;

      const stroke = redoStack.pop()!;
      strokes.push(stroke);
      drawStroke(staticCtxRef.current!, stroke);
      onRedo?.();
    };

    const handleCanvasSync = (data: { strokes: Stroke[] }) => {
      if (data.strokes?.length > 0) {
        canvasStateRef.current.strokes = data.strokes;
        canvasStateRef.current.redoStack = [];
        redrawAllStrokes(staticCtxRef.current!, data.strokes);
      }
    };

    const handleCanvasHistory = (data: { strokes: Stroke[] }) => {
      if (data.strokes?.length > 0) {
        canvasStateRef.current.strokes = data.strokes;
        canvasStateRef.current.redoStack = [];
        redrawAllStrokes(staticCtxRef.current!, data.strokes);
      }
    };

    console.log('[SOCKET] Attaching socket listeners...');
    socket.on('draw:stroke', handleDrawStroke);
    console.log('[SOCKET] draw:stroke listener attached');

    socket.on('draw:stroke:binary', handleDrawStrokeBinary);

    socket.on('draw:stroke:chunk', handleDrawStrokeChunk);

    socket.on('draw:clear', handleDrawClear);
    socket.on('game:round:end', handleGameRoundEnd);
    socket.on('draw:undo', handleDrawUndo);
    socket.on('draw:redo', handleDrawRedo);
    socket.on('canvas:sync', handleCanvasSync);
    socket.on('canvas:history', handleCanvasHistory);

    return () => {
      console.log('[SOCKET] Cleaning up socket listeners');
      socket.off('draw:stroke', handleDrawStroke);
      socket.off('draw:stroke:binary', handleDrawStrokeBinary);
      socket.off('draw:stroke:chunk', handleDrawStrokeChunk);

      socket.off('draw:clear', handleDrawClear);
      socket.off('game:round:end', handleGameRoundEnd);
      socket.off('draw:undo', handleDrawUndo);
      socket.off('draw:redo', handleDrawRedo);
      socket.off('canvas:sync', handleCanvasSync);
      socket.off('canvas:history', handleCanvasHistory);
    };


  }, [socket, staticCtxRef, liveCtxRef, canvasStateRef, clearLiveCanvas, onClear, onUndo, onRedo, renderChunkToCanvas]);
}
