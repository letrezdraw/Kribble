import type { Point, Stroke } from './types';

const CANVAS_SIZE = 800;
const BG_COLOR = '#f8fafc';

// Extended point with required pressure
interface PressurePoint extends Point {
  pressure: number;
  tiltX?: number;
  tiltY?: number;
}

// Pressure curve mapping - MUST MATCH live renderer exactly
function mapPressure(pressure: number): number {
  return 0.2 + Math.pow(pressure, 0.7) * 0.8;
}

export function initCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  
  const ctx = canvas.getContext('2d')!;
  // Don't fill with background - background layer handles white fill
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  return ctx;
}

export function initBackgroundCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  
  const ctx = canvas.getContext('2d')!;
  // Fill with white background - this layer is locked and never cleared
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  
  return ctx;
}


export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  // Only clear the drawing layer - background stays intact
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}



export function setupBrush(ctx: CanvasRenderingContext2D, color: string, size: number, opacity: number): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.fillStyle = color;
}

export function setupEraser(ctx: CanvasRenderingContext2D, size: number): void {
  // FIX: Use destination-out to actually erase pixels (make transparent)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = size;
  ctx.globalAlpha = 1;
}

// Unified distance-based stamping - FIXED: No more opacity blobs
export function drawPressureStroke(
  ctx: CanvasRenderingContext2D,
  points: PressurePoint[],
  color: string,
  baseSize: number,
  baseOpacity: number,
  isEraser: boolean = false
): void {
  if (points.length < 2) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const baseRadius = baseSize / 2;
  const minSpacing = 0.5; // Increased from 0.1 to reduce overlap

  // Track last stamp position for consistent spacing
  let lastStamp = points[0];

  for (let i = 1; i < points.length; i++) {
    const p = points[i];

    const dx = p.x - lastStamp.x;
    const dy = p.y - lastStamp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const mappedPressure = mapPressure(p.pressure);
    const stampRadius = baseRadius * mappedPressure;

    // FIXED: Adjust spacing based on opacity to prevent blobbing
    // Lower opacity = larger spacing to reduce overlap artifacts
    const opacityFactor = Math.max(0.3, baseOpacity);
    const spacing = Math.max(minSpacing, stampRadius * (0.05 + (1 - opacityFactor) * 0.1));

    if (dist < spacing) continue;

    // Always interpolate for smooth strokes - fill ALL gaps
    if (dist > spacing * 1.01) {
      const steps = Math.floor(dist / spacing);
      for (let j = 1; j <= steps; j++) {
        const t = j / steps;
        const interpX = lastStamp.x + dx * t;
        const interpY = lastStamp.y + dy * t;
        const interpPressure = lastStamp.pressure + (p.pressure - lastStamp.pressure) * t;
        const interpMappedPressure = mapPressure(interpPressure);
        const interpStampRadius = baseRadius * interpMappedPressure;
        const interpOpacity = baseOpacity * interpMappedPressure;

        // FIX: Use destination-out for eraser to actually erase pixels
        if (isEraser) {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = 1;
        } else {
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = color;
          // FIXED: Clamp opacity to prevent accumulation artifacts
          ctx.globalAlpha = Math.min(1, interpOpacity);
        }

        ctx.beginPath();
        ctx.arc(interpX, interpY, interpStampRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Single stamp for small gaps
      const opacity = baseOpacity * mappedPressure;

      // FIX: Use destination-out for eraser to actually erase pixels
      if (isEraser) {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.globalAlpha = 1;
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = color;
        // FIXED: Clamp opacity
        ctx.globalAlpha = Math.min(1, opacity);
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, stampRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    lastStamp = p;
  }

  ctx.restore();
}

// Legacy simple stroke for non-pressure drawing
export function drawBrushStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  size: number,
  opacity: number
): void {
  if (points.length < 2) return;
  
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.closePath();
  ctx.restore();
}

export function drawEraserStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  size: number
): void {
  if (points.length < 2) return;
  
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  
  // FIX: Use destination-out to actually erase pixels (make transparent)
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = 1;
  
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.stroke();
  ctx.closePath();
  ctx.restore();
}

export function drawShape(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke
): void {
  if (!stroke.startPoint || !stroke.endPoint) return;
  
  ctx.save();
  ctx.globalAlpha = stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.size;
  ctx.fillStyle = stroke.color;
  ctx.globalCompositeOperation = 'source-over';
  
  if (stroke.shapeType === 'rect') {
    ctx.strokeRect(
      stroke.startPoint.x,
      stroke.startPoint.y,
      stroke.endPoint.x - stroke.startPoint.x,
      stroke.endPoint.y - stroke.startPoint.y
    );
  } else if (stroke.shapeType === 'circle') {
    const radius = Math.sqrt(
      Math.pow(stroke.endPoint.x - stroke.startPoint.x, 2) +
      Math.pow(stroke.endPoint.y - stroke.startPoint.y, 2)
    );
    ctx.beginPath();
    ctx.arc(stroke.startPoint.x, stroke.startPoint.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
  } else if (stroke.shapeType === 'line') {
    ctx.beginPath();
    ctx.moveTo(stroke.startPoint.x, stroke.startPoint.y);
    ctx.lineTo(stroke.endPoint.x, stroke.endPoint.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawPreviewShape(
  ctx: CanvasRenderingContext2D,
  start: Point,
  end: Point,
  type: 'rect' | 'circle' | 'line',
  color: string,
  size: number,
  opacity: number
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.fillStyle = color;
  ctx.globalCompositeOperation = 'source-over';
  
  if (type === 'rect') {
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (type === 'circle') {
    const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    ctx.beginPath();
    ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
    ctx.stroke();
  } else if (type === 'line') {
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  color: string,
  size: number,
  opacity: number
): void {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `${size * 3}px Arial`;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Color tolerance for gap detection - REDUCED for more precise fills
const COLOR_TOLERANCE = 16;
const GAP_CLOSURE_RADIUS = 3;

// FIXED: Improved flood fill algorithm with better boundary detection
export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColor: string,
  opacity: number
): void {
  const canvas = ctx.canvas;
  const width = canvas.width;
  const height = canvas.height;
  
  startX = Math.max(0, Math.min(width - 1, Math.floor(startX)));
  startY = Math.max(0, Math.min(height - 1, Math.floor(startY)));
  
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  
  // Parse fill color
  const tempCtx = document.createElement('canvas').getContext('2d')!;
  tempCtx.fillStyle = fillColor;
  tempCtx.fillRect(0, 0, 1, 1);
  const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
  
  const fillR = fillData[0];
  const fillG = fillData[1];
  const fillB = fillData[2];
  const fillA = Math.round(255 * opacity);
  
  const startIdx = (startY * width + startX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];
  
  // Don't fill if already the target color
  if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) {
    return;
  }
  
  // Check if we're filling on a transparent/empty canvas
  const isTransparentTarget = targetA === 0;
  
  // Use a more efficient queue-based approach
  const queue: [number, number][] = [[startX, startY]];
  const visited = new Uint8Array(width * height);
  
  const getIdx = (x: number, y: number) => (y * width + x) * 4;
  const getKey = (x: number, y: number) => y * width + x;
  
  // Check if color matches target (with tolerance)
  const matchesTarget = (idx: number) => {
    // For transparent targets, check if pixel is also transparent
    if (isTransparentTarget) {
      return data[idx + 3] <= COLOR_TOLERANCE; // Alpha is near 0
    }
    
    // For non-transparent targets, check full color match
    const dr = data[idx] - targetR;
    const dg = data[idx + 1] - targetG;
    const db = data[idx + 2] - targetB;
    const da = data[idx + 3] - targetA;
    // Weighted Euclidean distance (human eyes are more sensitive to green)
    const dist = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11 + da * da * 0.5);
    return dist <= COLOR_TOLERANCE;
  };
  
  // Check if pixel is a boundary (significantly different from target)
  const isBoundary = (idx: number) => {
    // For transparent targets, boundary is any non-transparent pixel
    if (isTransparentTarget) {
      return data[idx + 3] > COLOR_TOLERANCE;
    }
    
    // For non-transparent targets, use color distance
    const dr = data[idx] - targetR;
    const dg = data[idx + 1] - targetG;
    const db = data[idx + 2] - targetB;
    const da = data[idx + 3] - targetA;
    const dist = Math.sqrt(dr * dr * 0.3 + dg * dg * 0.59 + db * db * 0.11 + da * da * 0.5);
    return dist > COLOR_TOLERANCE;
  };
  
  let filledCount = 0;
  const MAX_FILL_PIXELS = width * height; // Allow filling the entire canvas
  
  // BFS flood fill with boundary detection
  while (queue.length > 0 && filledCount < MAX_FILL_PIXELS) {
    const [x, y] = queue.shift()!;
    const key = getKey(x, y);
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[key]) {
      continue;
    }
    
    const idx = getIdx(x, y);
    
    // Check if this is a boundary pixel - stop here
    if (isBoundary(idx)) {
      continue;
    }
    
    // Check if matches target color
    if (!matchesTarget(idx)) {
      continue;
    }
    
    visited[key] = 1;
    filledCount++;
    
    // Fill the pixel with proper alpha blending
    if (fillA < 255) {
      // Alpha blending for semi-transparent fills
      const alpha = fillA / 255;
      const invAlpha = 1 - alpha;
      data[idx] = Math.round(fillR * alpha + data[idx] * invAlpha);
      data[idx + 1] = Math.round(fillG * alpha + data[idx + 1] * invAlpha);
      data[idx + 2] = Math.round(fillB * alpha + data[idx + 2] * invAlpha);
      data[idx + 3] = Math.round(fillA + data[idx + 3] * invAlpha);
    } else {
      // Opaque fill
      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = fillA;
    }
    
    // Add neighbors (4-directional)
    queue.push([x + 1, y]);
    queue.push([x - 1, y]);
    queue.push([x, y + 1]);
    queue.push([x, y - 1]);
  }
  
  ctx.putImageData(imageData, 0, 0);
}



export function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  if (stroke.tool === 'shape') {
    drawShape(ctx, stroke);
    return;
  }
  
  if (stroke.tool === 'text' && stroke.text && stroke.startPoint) {
    drawText(ctx, stroke.startPoint.x, stroke.startPoint.y, stroke.text, stroke.color, stroke.size, stroke.opacity);
    return;
  }
  
  // Handle clear tool - restore all cleared strokes
  if (stroke.tool === 'clear' && stroke.clearedStrokes) {
    // Restore all the strokes that were cleared
    stroke.clearedStrokes.forEach(clearedStroke => drawStroke(ctx, clearedStroke));
    return;
  }
  
  // Handle fill tool - restore the canvas state that was captured before the fill
  if (stroke.tool === 'fill' && stroke.canvasState) {
    // Restore the canvas to the state before this fill was applied
    const canvas = ctx.canvas;
    const width = canvas.width;
    const height = canvas.height;
    
    // Create ImageData from the stored canvas state
    const imageData = new ImageData(
      new Uint8ClampedArray(stroke.canvasState),
      width,
      height
    );
    ctx.putImageData(imageData, 0, 0);
    return;
  }

  
  const hasPressure = stroke.points.some(p => p.pressure !== undefined) || 
                      (stroke.pressureData && stroke.pressureData.length > 0);
  
  if (hasPressure) {
    const pressurePoints: PressurePoint[] = stroke.points.map((p, i) => ({
      x: p.x,
      y: p.y,
      pressure: p.pressure !== undefined 
        ? p.pressure 
        : stroke.pressureData?.[i] !== undefined 
          ? stroke.pressureData[i] 
          : 0.5,
      tiltX: p.tiltX,
      tiltY: p.tiltY
    }));

    drawPressureStroke(
      ctx, 
      pressurePoints, 
      stroke.color, 
      stroke.size, 
      stroke.opacity,
      stroke.tool === 'eraser'
    );
  } else if (stroke.tool === 'eraser') {
    drawEraserStroke(ctx, stroke.points, stroke.size);
  } else {
    drawBrushStroke(ctx, stroke.points, stroke.color, stroke.size, stroke.opacity);
  }
}

export function redrawAllStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]): void {
  clearCanvas(ctx);
  strokes.forEach(stroke => drawStroke(ctx, stroke));
}
