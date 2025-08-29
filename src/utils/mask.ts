import maskData from '@/assets/mask.json';

export const MASK_POINTS: [number, number][] = maskData.points as [number, number][];
export const MASK_CENTER: [number, number] = maskData.center as [number, number];
export const MASK_BOUNDS = maskData.bounds;

// Create SVG path from polygon points
export function polygonToPath(points: [number, number][]): string {
  if (points.length === 0) return '';
  
  const [firstPoint, ...restPoints] = points;
  let path = `M ${firstPoint[0]} ${firstPoint[1]}`;
  
  for (const [x, y] of restPoints) {
    path += ` L ${x} ${y}`;
  }
  
  path += ' Z';
  return path;
}

// Point-in-polygon test using ray casting algorithm
export function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  
  return inside;
}