import { MutableRefObject, useEffect, useRef } from 'react';

import { Coordinate } from '../../types/common';

interface PointerTrackerConfig {
  onPointerDrag?: (from: Coordinate, to: Coordinate) => void;
  onPointerDragEnd?: (_dragPoints: Array<Coordinate>) => void;
  onPointerClick?: (point: Coordinate) => void;
}

/** Map viewport client coordinates to canvas bitmap space (matches width/height buffer). */
const mapClientToBitmap = (
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement
): Coordinate | null => {
  const rect = canvas.getBoundingClientRect();
  const bw = canvas.width;
  const bh = canvas.height;
  if (bw <= 0 || bh <= 0 || rect.width <= 0 || rect.height <= 0) {
    return null;
  }
  const scaleX = bw / rect.width;
  const scaleY = bh / rect.height;
  const x = (clientX - rect.left) * scaleX;
  const y = (clientY - rect.top) * scaleY;
  return {
    x: Math.min(Math.max(x, 0), bw),
    y: Math.min(Math.max(y, 0), bh),
  };
};

const usePointerTracker = <T extends HTMLCanvasElement>(
  elementRef: MutableRefObject<T | null>,
  config?: PointerTrackerConfig
) => {
  const _pointerDownCoordinate = useRef<Coordinate>();
  const _isDragging = useRef(false);
  const _dragPoints = useRef<Array<Coordinate>>([]);
  const _capturedPointerId = useRef<number | null>(null);

  const configRef = useRef(config);
  configRef.current = config;

  const releasePointerCaptureIfNeeded = (canvas: HTMLCanvasElement) => {
    const id = _capturedPointerId.current;
    if (id == null) return;
    try {
      if (canvas.hasPointerCapture(id)) {
        canvas.releasePointerCapture(id);
      }
    } catch {
      // Already released or unsupported
    }
    _capturedPointerId.current = null;
  };

  const resetGestureSilently = (canvas: HTMLCanvasElement | null) => {
    if (canvas) releasePointerCaptureIfNeeded(canvas);
    _pointerDownCoordinate.current = undefined;
    _isDragging.current = false;
    _dragPoints.current = [];
  };

  const endGesture = (canvas: HTMLCanvasElement) => {
    releasePointerCaptureIfNeeded(canvas);
    const cfg = configRef.current;
    if (_isDragging.current) {
      cfg?.onPointerDragEnd?.(_dragPoints.current);
    }
    _pointerDownCoordinate.current = undefined;
    _isDragging.current = false;
    _dragPoints.current = [];
  };

  useEffect(() => {
    const canvas = elementRef.current;
    const hasConfig = config && Object.keys(config).length > 0;
    if (!hasConfig || !canvas) return;

    const _getCoordinate = (ev: PointerEvent): Coordinate | null => {
      const el = ev.currentTarget as HTMLCanvasElement;
      return mapClientToBitmap(ev.clientX, ev.clientY, el);
    };

    const _handlePointerMovement = (ev: PointerEvent) => {
      if (!_pointerDownCoordinate.current) return;
      const currentCoordinate = _getCoordinate(ev);
      if (!currentCoordinate) return;
      _isDragging.current = true;
      configRef.current?.onPointerDrag?.(
        _pointerDownCoordinate.current,
        currentCoordinate
      );
      _pointerDownCoordinate.current = currentCoordinate;
      _dragPoints.current.push(currentCoordinate);
    };

    const _handlePointerDown = (ev: PointerEvent) => {
      const el = ev.currentTarget as HTMLCanvasElement;
      const currentCoordinate = _getCoordinate(ev);
      if (!currentCoordinate) return;
      try {
        el.setPointerCapture(ev.pointerId);
        _capturedPointerId.current = ev.pointerId;
      } catch {
        _capturedPointerId.current = null;
      }
      _pointerDownCoordinate.current = currentCoordinate;
      _dragPoints.current = [currentCoordinate];
    };

    const _handlePointerUp = (ev: PointerEvent) => {
      const el = ev.currentTarget as HTMLCanvasElement;
      const point = _getCoordinate(ev);
      releasePointerCaptureIfNeeded(el);
      if (point) configRef.current?.onPointerClick?.(point);
      endGesture(el);
    };

    const _handlePointerLeave = (ev: PointerEvent) => {
      const el = ev.currentTarget as HTMLCanvasElement;
      if (_capturedPointerId.current != null) return;
      endGesture(el);
    };

    const _handlePointerCancel = (ev: PointerEvent) => {
      const el = ev.currentTarget as HTMLCanvasElement;
      endGesture(el);
    };

    const onGeometryChange = () => {
      resetGestureSilently(canvas);
    };

    canvas.addEventListener('pointermove', _handlePointerMovement);
    canvas.addEventListener('pointerdown', _handlePointerDown);
    canvas.addEventListener('pointerup', _handlePointerUp);
    canvas.addEventListener('pointercancel', _handlePointerCancel);
    canvas.addEventListener('pointerleave', _handlePointerLeave);
    canvas.addEventListener('pointerout', _handlePointerLeave);

    const ro = new ResizeObserver(onGeometryChange);
    ro.observe(canvas);

    window.addEventListener('resize', onGeometryChange);
    window.visualViewport?.addEventListener('resize', onGeometryChange);
    window.visualViewport?.addEventListener('scroll', onGeometryChange);

    return () => {
      resetGestureSilently(canvas);
      canvas.removeEventListener('pointermove', _handlePointerMovement);
      canvas.removeEventListener('pointerdown', _handlePointerDown);
      canvas.removeEventListener('pointerup', _handlePointerUp);
      canvas.removeEventListener('pointercancel', _handlePointerCancel);
      canvas.removeEventListener('pointerleave', _handlePointerLeave);
      canvas.removeEventListener('pointerout', _handlePointerLeave);
      ro.disconnect();
      window.removeEventListener('resize', onGeometryChange);
      window.visualViewport?.removeEventListener('resize', onGeometryChange);
      window.visualViewport?.removeEventListener('scroll', onGeometryChange);
    };
  }, [config, elementRef]);
};

export default usePointerTracker;
