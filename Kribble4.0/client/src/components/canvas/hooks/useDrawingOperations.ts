import { useRef, useCallback } from 'react';
import type { Point, Stroke, ToolType, Transform } from '../types';
import { drawPreviewShape, drawShape, drawStroke, floodFill, drawOriginalRasterStroke } from '../drawingTools';

export interface UseDrawingOperationsOptions {

  liveCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  staticCtxRef: React.MutableRefObject<CanvasRenderingContext2D | null>;
  currentStrokeRef: React.MutableRefObject<Point[]>;
  shapeStartRef: React.MutableRefObject<Point | null>;
  smoothedPressureRef: React.MutableRefObject<number>;
  brushSize: number;
  brushColor: string;
  brushOpacity: number;
  activeTool: ToolType;
  shapeType: 'rect' | 'circle' | 'line';
  transform: Transform;
}

export function useDrawingOperations({
  liveCtxRef,
  staticCtxRef,
  currentStrokeRef,
  shapeStartRef,
  smoothedPressureRef,
  brushSize,
  brushColor,
  brushOpacity,
  activeTool,
  shapeType,
  transform,
}: UseDrawingOperationsOptions) {
  const clearLiveCanvas = useCallback(() => {
    if (!liveCtxRef.current) return;
    liveCtxRef.current.clearRect(0, 0, 800, 800);
  }, [liveCtxRef]);

  const renderLiveStroke = useCallback(() => {
    if (!liveCtxRef.current || currentStrokeRef.current.length === 0) return;

    const ctx = liveCtxRef.current;
    const points = currentStrokeRef.current;

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = activeTool === 'eraser' ? 1 : brushOpacity;
    ctx.fillStyle = brushColor;
    drawOriginalRasterStroke(ctx, points, brushSize, activeTool === 'eraser');
    ctx.restore();
  }, [liveCtxRef, currentStrokeRef, brushSize, brushColor, brushOpacity, activeTool]);

  const startDrawing = useCallback((pos: Point, pressure: number) => {
    shapeStartRef.current = pos;
    currentStrokeRef.current = [{ x: pos.x, y: pos.y, pressure }];
    smoothedPressureRef.current = pressure;
  }, [shapeStartRef, currentStrokeRef, smoothedPressureRef]);

  const continueDrawing = useCallback((pos: Point, pressure: number) => {
    const prevSmoothed = smoothedPressureRef.current;
    const newSmoothed = prevSmoothed + (pressure - prevSmoothed) * 0.35;
    smoothedPressureRef.current = newSmoothed;

    currentStrokeRef.current.push({
      x: pos.x,
      y: pos.y,
      pressure: newSmoothed,
    });

    if (activeTool === 'brush' || activeTool === 'eraser') {
      renderLiveStroke();
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
  }, [activeTool, brushColor, brushSize, brushOpacity, renderLiveStroke, clearLiveCanvas, liveCtxRef, currentStrokeRef, shapeStartRef, smoothedPressureRef]);

  const endDrawing = useCallback((): Stroke | null => {
    if (!staticCtxRef.current || !liveCtxRef.current) return null;

    clearLiveCanvas();

    let stroke: Stroke;
    if (['rect', 'circle', 'line'].includes(activeTool)) {
      const endPos = currentStrokeRef.current[currentStrokeRef.current.length - 1] || shapeStartRef.current!;
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
      stroke = {
        id: Date.now().toString(),
        tool: activeTool as ToolType,
        points: currentStrokeRef.current.map(p => ({ x: p.x, y: p.y, pressure: (p as any).pressure })),
        color: brushColor,
        size: brushSize,
        opacity: brushOpacity,
      };
      drawStroke(staticCtxRef.current, stroke);
    }

    currentStrokeRef.current = [];
    shapeStartRef.current = null;
    smoothedPressureRef.current = 1;

    return stroke;
  }, [activeTool, brushColor, brushSize, brushOpacity, clearLiveCanvas, staticCtxRef, liveCtxRef, currentStrokeRef, shapeStartRef, smoothedPressureRef]);

  const handleFill = useCallback((pos: Point): Stroke | null => {
    if (!staticCtxRef.current) return null;

    const canvasState = staticCtxRef.current.getImageData(0, 0, 800, 800).data;
    floodFill(staticCtxRef.current, pos.x, pos.y, brushColor, brushOpacity);

    const stroke: Stroke = {
      id: Date.now().toString(),
      tool: 'fill',
      points: [{ x: pos.x, y: pos.y, pressure: 1 }],
      color: brushColor,
      size: brushSize,
      opacity: brushOpacity,
      canvasState: new Uint8ClampedArray(canvasState),
    };

    return stroke;
  }, [brushColor, brushSize, brushOpacity, staticCtxRef]);

  return {
    clearLiveCanvas,
    renderLiveStroke,
    startDrawing,
    continueDrawing,
    endDrawing,
    handleFill,
  };
}
