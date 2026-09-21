import type { JourneyStop } from '../data/journeyLotr';

// Index of the furthest stop the user has unlocked, or -1 before the first.
export function getCurrentStopIndex(totalCount: number, stops: JourneyStop[]): number {
  return stops.reduce((acc, stop, i) => (totalCount >= stop.threshold ? i : acc), -1);
}

// Stops up to one past the current one show their name; the rest stay "???".
export function isStopRevealed(stopIndex: number, currentIndex: number): boolean {
  return stopIndex <= currentIndex + 1;
}

// Catmull-Rom → cubic Bézier path through the stops (same smoothing as web),
// in the 960×740 map space. Pass `scale` to project into another pixel size.
export function buildRoutePath(
  points: { x: number; y: number }[],
  scaleX = 1,
  scaleY = 1,
): string {
  if (points.length === 0) return '';
  const pts = points.map((p) => ({ x: p.x * scaleX, y: p.y * scaleY }));
  if (pts.length < 3) {
    return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i === 0 ? 0 : i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2 < pts.length ? i + 2 : pts.length - 1];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
  }
  return d;
}
