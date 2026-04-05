import { Coordinate } from '../types/common';

/** Pulls the pen toward raw input each frame; higher = snappier, lower = smoother. */
export const STROKE_SMOOTH_ALPHA = 0.42;

/** Max gap (bitmap px) between consecutive drawn samples for a continuous stroke. */
export const STROKE_MAX_STEP_PX = 4;

/**
 * Exponential smoothing toward the latest pointer sample (bitmap space).
 * Deterministic given the same input sequence — safe for multiplayer when applied before normalize.
 */
export const smoothToward = (
  current: Coordinate,
  target: Coordinate,
  alpha: number
): Coordinate => ({
  x: current.x + (target.x - current.x) * alpha,
  y: current.y + (target.y - current.y) * alpha,
});

/**
 * Inserts intermediate points along a segment so brush stamps don't leave gaps on fast moves.
 */
export const subdivideSegment = (
  from: Coordinate,
  to: Coordinate,
  maxStep: number
): Coordinate[] => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= maxStep || dist === 0) {
    return [from, to];
  }
  const steps = Math.ceil(dist / maxStep);
  const out: Coordinate[] = [];
  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    out.push({ x: from.x + dx * t, y: from.y + dy * t });
  }
  out.push(to);
  return out;
};
