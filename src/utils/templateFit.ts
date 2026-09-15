import template from '@/assets/mask.json';
import type { Rect } from './layout';

const points = template.points as [number, number][];
const EPSILON = 1e-8;
export const TEMPLATE_CENTER = template.center as [number, number];
export const TEMPLATE_PATH = template.fillPath;
export const TEMPLATE_WIDTH = 1250;
export const TEMPLATE_HEIGHT = 703;

function inside(x: number, y: number) {
  let result = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[j], [bx, by] = points[i];
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
    if (Math.abs(cross) < EPSILON && x >= Math.min(ax, bx) - EPSILON && x <= Math.max(ax, bx) + EPSILON && y >= Math.min(ay, by) - EPSILON && y <= Math.max(ay, by) + EPSILON) return true;
    if ((ay > y) !== (by > y) && x < ax + (y - ay) * (bx - ax) / (by - ay)) result = !result;
  }
  return result;
}

// A concave boundary can cross the rectangle even when all four corners fit.
function edgeCrossesInterior(a: [number, number], b: [number, number], box: Rect) {
  let start = 0, end = 1;
  for (const [origin, delta, min, max] of [
    [a[0], b[0] - a[0], box.x + EPSILON, box.x + box.width - EPSILON],
    [a[1], b[1] - a[1], box.y + EPSILON, box.y + box.height - EPSILON],
  ]) {
    if (Math.abs(delta) < EPSILON) {
      if (origin < min || origin > max) return false;
    } else {
      const t1 = (min - origin) / delta, t2 = (max - origin) / delta;
      start = Math.max(start, Math.min(t1, t2));
      end = Math.min(end, Math.max(t1, t2));
      if (start > end) return false;
    }
  }
  return start <= end;
}

export function insideTemplate(box: Rect): boolean {
  if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) return false;
  if (![[box.x, box.y], [box.x + box.width, box.y], [box.x + box.width, box.y + box.height], [box.x, box.y + box.height]].every(([x, y]) => inside(x, y))) return false;
  return !points.some((point, i) => edgeCrossesInterior(point, points[(i + 1) % points.length], box));
}

export function placedBounds(bounds: Rect, scale: number, offsetX: number, offsetY: number): Rect {
  return { x: bounds.x + bounds.width / 2 + offsetX - bounds.width * scale / 2,
    y: bounds.y + bounds.height / 2 + offsetY - bounds.height * scale / 2,
    width: bounds.width * scale, height: bounds.height * scale };
}

export function fitTemplate(bounds: Rect, offsetX: number, offsetY: number): number {
  let low = 0, high = Math.min(1002 / bounds.width, 455 / bounds.height);
  for (let i = 0; i < 50; i++) {
    const scale = (low + high) / 2;
    if (insideTemplate(placedBounds(bounds, scale, offsetX, offsetY))) low = scale;
    else high = scale;
  }
  return low * 0.999; // Keep artwork just inside the redline.
}

export function constrainTemplate(bounds: Rect, previous: { scale: number; offsetX: number; offsetY: number }, requested: { scale: number; offsetX: number; offsetY: number }) {
  const scale = requested.scale > previous.scale * (1 + 1e-12)
    ? Math.min(requested.scale, fitTemplate(bounds, previous.offsetX, previous.offsetY))
    : requested.scale;
  if (insideTemplate(placedBounds(bounds, scale, requested.offsetX, requested.offsetY))) return { ...requested, scale };
  // Stop a nudge at the boundary rather than crop or shrink the artwork to move it.
  let low = 0, high = 1;
  for (let i = 0; i < 50; i++) {
    const t = (low + high) / 2;
    const x = previous.offsetX + (requested.offsetX - previous.offsetX) * t;
    const y = previous.offsetY + (requested.offsetY - previous.offsetY) * t;
    if (insideTemplate(placedBounds(bounds, scale, x, y))) low = t;
    else high = t;
  }
  return { scale, offsetX: previous.offsetX + (requested.offsetX - previous.offsetX) * low,
    offsetY: previous.offsetY + (requested.offsetY - previous.offsetY) * low };
}
