import type { Point, Transform } from './types';

const CANVAS_SIZE = 800;

/**
 * Convert screen coordinates to canvas coordinates
 * Applies the inverse of the CSS transform
 * CSS Transform: translate(translateX, translateY) rotate(rotation) scale(scale)
 * Inverse: un-translate → un-rotate → un-scale
 */
export function screenToCanvas(
  screenX: number,
  screenY: number,
  viewportRect: DOMRect,
  transform: Transform
): Point {
  // The canvas center in screen coordinates
  const viewportCenterX = viewportRect.left + viewportRect.width / 2;
  const viewportCenterY = viewportRect.top + viewportRect.height / 2;
  
  // Step 1: Reverse translation - get position relative to transformed center
  const relX = screenX - viewportCenterX - transform.translateX;
  const relY = screenY - viewportCenterY - transform.translateY;
  
  // Step 2: Reverse rotation
  const rotationRad = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(-rotationRad);
  const sin = Math.sin(-rotationRad);
  
  const rotatedX = relX * cos - relY * sin;
  const rotatedY = relX * sin + relY * cos;
  
  // Step 3: Reverse scale and convert to canvas coordinates
  // The canvas is 800x800, centered at (400, 400)
  const canvasX = rotatedX / transform.scale + CANVAS_SIZE / 2;
  const canvasY = rotatedY / transform.scale + CANVAS_SIZE / 2;
  
  return {
    x: Math.max(0, Math.min(CANVAS_SIZE, canvasX)),
    y: Math.max(0, Math.min(CANVAS_SIZE, canvasY))
  };
}

/**
 * Get viewport element's bounding rect
 */
function getViewportRect(containerRef: React.RefObject<HTMLDivElement>): DOMRect | null {
  const container = containerRef.current;
  if (!container) return null;
  
  // Find the viewport element
  const viewport = container.querySelector('.canvas-viewport');
  if (viewport) {
    return viewport.getBoundingClientRect();
  }
  
  // Fallback to container
  return container.getBoundingClientRect();
}

/**
 * Convert mouse/touch event to canvas coordinates
 * Accounts for the CSS transform applied to the canvas
 */
export function getPos(
  e: React.MouseEvent | React.TouchEvent,
  containerRef: React.RefObject<HTMLDivElement>,
  transform: Transform
): Point {
  const viewportRect = getViewportRect(containerRef);
  if (!viewportRect) return { x: 0, y: 0 };
  
  const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
  const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
  
  return screenToCanvas(clientX, clientY, viewportRect, transform);
}

export function getPosFromEvent(
  e: MouseEvent,
  containerRef: React.RefObject<HTMLDivElement>,
  transform: Transform
): Point {
  const viewportRect = getViewportRect(containerRef);
  if (!viewportRect) return { x: 0, y: 0 };
  
  return screenToCanvas(e.clientX, e.clientY, viewportRect, transform);
}

export function getTouchDistance(touches: TouchList | React.TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}


/**
 * Convert canvas coordinates to screen coordinates
 * Useful for positioning UI elements relative to canvas points
 */
export function canvasToScreen(
  canvasX: number,
  canvasY: number,
  viewportRect: DOMRect,
  transform: Transform
): Point {
  const viewportCenterX = viewportRect.left + viewportRect.width / 2;
  const viewportCenterY = viewportRect.top + viewportRect.height / 2;
  
  // Step 1: Convert from canvas to relative coordinates
  const relX = (canvasX - CANVAS_SIZE / 2) * transform.scale;
  const relY = (canvasY - CANVAS_SIZE / 2) * transform.scale;
  
  // Step 2: Apply rotation
  const rotationRad = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(rotationRad);
  const sin = Math.sin(rotationRad);
  
  const rotatedX = relX * cos - relY * sin;
  const rotatedY = relX * sin + relY * cos;
  
  // Step 3: Apply translation
  const screenX = viewportCenterX + transform.translateX + rotatedX;
  const screenY = viewportCenterY + transform.translateY + rotatedY;
  
  return { x: screenX, y: screenY };
}
