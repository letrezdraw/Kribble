/**
 * MessagePack Binary Protocol Utilities
 * Provides efficient binary encoding for socket events
 * Reduces bandwidth by ~50% compared to JSON
 */

import { encode, decode } from '@msgpack/msgpack';

// Protocol version for backward compatibility
export const PROTOCOL_VERSION = 1;

// Event types that benefit from binary encoding
export const BINARY_EVENTS = [
  'canvas:stroke',
  'canvas:sync',
  'canvas:batch',
  'game:state-update',
] as const;

type BinaryEventType = typeof BINARY_EVENTS[number];

/**
 * Check if an event should use binary encoding
 */
export function shouldUseBinary(event: string): boolean {
  return BINARY_EVENTS.includes(event as BinaryEventType);
}

/**
 * Encode data to MessagePack binary format
 */
export function encodeMessage<T>(data: T): Uint8Array {
  return encode(data);
}

/**
 * Decode MessagePack binary data
 */
export function decodeMessage<T>(buffer: Uint8Array | ArrayBuffer): T {
  return decode(buffer) as T;
}

/**
 * Compact stroke format for drawing data
 * Converts stroke object to compact array format: [id, tool, color, width, opacity, points...]
 * Reduces size by ~60% compared to JSON object
 */
export function compactStroke(stroke: {
  id: string;
  tool: string;
  color: string;
  width: number;
  opacity: number;
  points: { x: number; y: number; pressure?: number }[];
  layerId?: string;
}): (string | number)[] {
  // Flatten points to array: [x1, y1, p1, x2, y2, p2, ...]
  const flatPoints: number[] = [];
  for (const point of stroke.points) {
    flatPoints.push(point.x, point.y);
    if (point.pressure !== undefined && point.pressure !== 1) {
      flatPoints.push(point.pressure);
    }
  }

  return [
    stroke.id,
    stroke.tool,
    stroke.color,
    stroke.width,
    stroke.opacity,
    stroke.layerId || '',
    ...flatPoints,
  ];
}

/**
 * Expand compact stroke format back to stroke object
 */
export function expandStroke(compact: (string | number)[]): {
  id: string;
  tool: string;
  color: string;
  width: number;
  opacity: number;
  points: { x: number; y: number; pressure?: number }[];
  layerId: string;
} {
  const [id, tool, color, width, opacity, layerId, ...pointData] = compact;

  // Reconstruct points from flat array
  const points: { x: number; y: number; pressure?: number }[] = [];
  for (let i = 0; i < pointData.length; i += 3) {
    const point: { x: number; y: number; pressure?: number } = {
      x: pointData[i] as number,
      y: pointData[i + 1] as number,
    };
    // Check if there's a pressure value (3rd value in triplet)
    if (i + 2 < pointData.length && typeof pointData[i + 2] === 'number') {
      const pressure = pointData[i + 2] as number;
      if (pressure >= 0 && pressure <= 1) {
        point.pressure = pressure;
      }
    }
    points.push(point);
  }

  return {
    id: id as string,
    tool: tool as string,
    color: color as string,
    width: width as number,
    opacity: opacity as number,
    layerId: (layerId as string) || 'default',
    points,
  };
}

/**
 * Delta encoding for points - store differences instead of absolute positions
 * Further reduces size for smooth strokes
 */
export function deltaEncodePoints(
  points: { x: number; y: number; pressure?: number }[]
): number[] {
  if (points.length === 0) return [];

  const result: number[] = [points[0].x, points[0].y];
  if (points[0].pressure !== undefined) {
    result.push(points[0].pressure);
  }

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    // Store delta from previous point
    const dx = Math.round((curr.x - prev.x) * 100) / 100; // 2 decimal precision
    const dy = Math.round((curr.y - prev.y) * 100) / 100;

    result.push(dx, dy);

    if (curr.pressure !== undefined) {
      result.push(curr.pressure);
    }
  }

  return result;
}

/**
 * Decode delta-encoded points back to absolute positions
 */
export function deltaDecodePoints(encoded: number[]): { x: number; y: number; pressure?: number }[] {
  if (encoded.length < 2) return [];

  const points: { x: number; y: number; pressure?: number }[] = [];
  let x = encoded[0];
  let y = encoded[1];
  let idx = 2;

  // Check if first point has pressure
  let pressure: number | undefined;
  if (encoded.length > 2 && encoded[2] >= 0 && encoded[2] <= 1) {
    pressure = encoded[2];
    idx = 3;
  }

  points.push({ x, y, pressure });

  // Decode deltas
  while (idx < encoded.length) {
    x += encoded[idx];
    y += encoded[idx + 1];
    idx += 2;

    pressure = undefined;
    if (idx < encoded.length && encoded[idx] >= 0 && encoded[idx] <= 1) {
      pressure = encoded[idx];
      idx++;
    }

    points.push({ x, y, pressure });
  }

  return points;
}

/**
 * Batch multiple strokes for efficient transmission
 */
export function batchStrokes(strokes: any[]): {
  version: number;
  count: number;
  data: (string | number)[][];
} {
  return {
    version: PROTOCOL_VERSION,
    count: strokes.length,
    data: strokes.map(compactStroke),
  };
}

/**
 * Unbatch strokes
 */
export function unbatchStrokes(batch: {
  version: number;
  count: number;
  data: (string | number)[][];
}): any[] {
  return batch.data.map(expandStroke);
}

/**
 * Socket.io message wrapper with protocol metadata
 */
export function wrapSocketMessage<T>(
  event: string,
  data: T,
  useBinary: boolean = true
): { event: string; binary: boolean; payload: Uint8Array | T } {
  if (useBinary && shouldUseBinary(event)) {
    return {
      event,
      binary: true,
      payload: encodeMessage(data),
    };
  }

  return {
    event,
    binary: false,
    payload: data,
  };
}

/**
 * Unwrap socket message
 */
export function unwrapSocketMessage<T>(message: {
  event: string;
  binary: boolean;
  payload: Uint8Array | T;
}): { event: string; data: T } {
  return {
    event: message.event,
    data: message.binary
      ? decodeMessage<T>(message.payload as Uint8Array)
      : (message.payload as T),
  };
}

/**
 * Calculate bandwidth savings
 */
export function calculateSavings(original: any, encoded: Uint8Array): {
  originalSize: number;
  encodedSize: number;
  savings: number;
  savingsPercent: number;
} {
  const originalJson = JSON.stringify(original);
  const originalSize = new Blob([originalJson]).size;
  const encodedSize = encoded.length;

  return {
    originalSize,
    encodedSize,
    savings: originalSize - encodedSize,
    savingsPercent: Math.round(((originalSize - encodedSize) / originalSize) * 100),
  };
}

// Default export
export default {
  encode: encodeMessage,
  decode: decodeMessage,
  compactStroke,
  expandStroke,
  deltaEncodePoints,
  deltaDecodePoints,
  batchStrokes,
  unbatchStrokes,
  shouldUseBinary,
  calculateSavings,
  PROTOCOL_VERSION,
};
