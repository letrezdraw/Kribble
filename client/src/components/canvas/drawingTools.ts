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
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  
  return ctx;
}

export function clearCanvas(ctx: CanvasRenderingContext2D): void {
  ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

export function setupBrush(ctx: CanvasRenderingContext2D, color: string, size: number, opacity: number): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.fillStyle = color;
}

export function setupEraser(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = BG_COLOR;
  ctx.lineWidth = size;
  ctx.globalAlpha = 1;
}

// Unified distance-based stamping - MATCHES live renderer exactly
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
  const minSpacing = 0.1;

  // Track last stamp position for consistent spacing
  let lastStamp = points[0];

  for (let i = 1; i < points.length; i++) {
    const p = points[i];

    const dx = p.x - lastStamp.x;
    const dy = p.y - lastStamp.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const mappedPressure = mapPressure(p.pressure);
    const stampRadius = baseRadius * mappedPressure;

    // spacing = radius * 0.02 gives ~98% overlap for ultra-smooth strokes
    const spacing = Math.max(minSpacing, stampRadius * 0.02);

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

        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = isEraser ? BG_COLOR : color;
        ctx.globalAlpha = isEraser ? 1 : interpOpacity;

        ctx.beginPath();
        ctx.arc(interpX, interpY, interpStampRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Single stamp for small gaps
      const opacity = baseOpacity * mappedPressure;

      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = isEraser ? BG_COLOR : color;
      ctx.globalAlpha = isEraser ? 1 : opacity;

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
  
  ctx.globalCompositeOperation = 'source-over';
  ctx.strokeStyle = BG_COLOR;
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

// Color tolerance for gap detection - increased for anti-aliased edges
const COLOR_TOLERANCE = 48;
const GAP_CLOSURE_RADIUS = 2; // Pixels to check for gap closure

// Flood fill algorithm (paint bucket) with improved gap detection
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
  
  const tempCtx = document.createElement('canvas').getContext('2d')!;
  tempCtx.fillStyle = fillColor;
  tempCtx.fillRect(0, 0, 1, 1);
  const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
  
  const r = fillData[0];
  const g = fillData[1];
  const b = fillData[2];
  const a = Math.round(255 * opacity);
  
  const startIdx = (startY * width + startX) * 4;
  const targetR = data[startIdx];
  const targetG = data[startIdx + 1];
  const targetB = data[startIdx + 2];
  const targetA = data[startIdx + 3];
  
  if (targetR === r && targetG === g && targetB === b && targetA === a) {
    return;
  }
  
  const stack: [number, number][] = [[startX, startY]];
  const visited = new Uint8Array(width * height);
  const filled = new Uint8Array(width * height); // Track actually filled pixels
  
  const getIdx = (x: number, y: number) => (y * width + x) * 4;
  const getKey = (x: number, y: number) => y * width + x;
  
  // Check if color matches target (with tolerance)
  const matchesTarget = (idx: number) => {
    const dr = Math.abs(data[idx] - targetR);
    const dg = Math.abs(data[idx + 1] - targetG);
    const db = Math.abs(data[idx + 2] - targetB);
    const da = Math.abs(data[idx + 3] - targetA);
    return (dr + dg + db + da) <= COLOR_TOLERANCE * 2;
  };
  
  // Check if already filled with target color
  const isFilled = (idx: number) => {
    return data[idx] === r && data[idx + 1] === g && data[idx + 2] === b && data[idx + 3] === a;
  };
  
  // Check if there's a boundary nearby (for gap detection)
  const hasBoundaryNearby = (x: number, y: number): boolean => {
    for (let dy = -GAP_CLOSURE_RADIUS; dy <= GAP_CLOSURE_RADIUS; dy++) {
      for (let dx = -GAP_CLOSURE_RADIUS; dx <= GAP_CLOSURE_RADIUS; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        
        const idx = getIdx(nx, ny);
        // If we find a significantly different color (likely a stroke), consider it a boundary
        const dr = Math.abs(data[idx] - targetR);
        const dg = Math.abs(data[idx + 1] - targetG);
        const db = Math.abs(data[idx + 2] - targetB);
        if (dr + dg + db > COLOR_TOLERANCE * 3) {
          return true;
        }
      }
    }
    return false;
  };
  
  let filledCount = 0;
  const MAX_FILL_PIXELS = width * height * 0.5; // Limit to 50% of canvas
  
  // First pass: standard flood fill
  while (stack.length > 0 && filledCount < MAX_FILL_PIXELS) {
    const [x, y] = stack.pop()!;
    const key = getKey(x, y);
    
    if (x < 0 || x >= width || y < 0 || y >= height || visited[key]) {
      continue;
    }
    
    const idx = getIdx(x, y);
    
    if (isFilled(idx)) continue;
    
    // Check if this pixel matches target OR is near a boundary (gap closure)
    const matches = matchesTarget(idx);
    const nearBoundary = hasBoundaryNearby(x, y);
    
    if (!matches && !nearBoundary) continue;
    
    visited[key] = 1;
    filled[key] = 1;
    filledCount++;
    
    data[idx] = r;
    data[idx + 1] = g;
    data[idx + 2] = b;
    data[idx + 3] = a;
    
    // 4-directional fill for cleaner edges
    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }
  
  // Second pass: dilate to fill small gaps and smooth edges
  const dilateFilled = () => {
    const newFilled = new Uint8Array(width * height);
    const EDGE_DILATION = 1;
    
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const key = getKey(x, y);
        
        // If this pixel is filled, skip
        if (filled[key]) {
          newFilled[key] = 1;
          continue;
        }
        
        // Check if any neighbor is filled
        let hasFilledNeighbor = false;
        for (let dy = -EDGE_DILATION; dy <= EDGE_DILATION && !hasFilledNeighbor; dy++) {
          for (let dx = -EDGE_DILATION; dx <= EDGE_DILATION && !hasFilledNeighbor; dx++) {
            const nk = getKey(x + dx, y + dy);
            if (filled[nk]) {
              hasFilledNeighbor = true;
            }
          }
        }
        
        // If has filled neighbor and matches target color, fill it
        if (hasFilledNeighbor) {
          const idx = getIdx(x, y);
          if (matchesTarget(idx) || isFilled(idx)) {
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
            newFilled[key] = 1;
          }
        }
      }
    }
    
    return newFilled;
  };
  
  // Apply dilation to close small gaps
  dilateFilled();
  
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
