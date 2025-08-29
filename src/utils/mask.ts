import maskData from '@/assets/mask.json';

export const MASK_OUTLINE_PATH: string = (maskData as any).outlinePath as string;
export const MASK_FILL_PATH: string = (maskData as any).fillPath as string;
export const MASK_CENTER: [number, number] = maskData.center as [number, number];

// Convert path to dense polygon points for fitting calculations
function pathToPoints(d: string, stepPx: number = 1.5): [number, number][] {
  if (typeof document === 'undefined') return [];
  
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.style.position = 'absolute';
  svg.style.left = '-9999px';
  document.body.appendChild(svg);
  
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  svg.appendChild(path);
  
  const totalLength = path.getTotalLength();
  const points: [number, number][] = [];
  
  for (let i = 0; i <= totalLength; i += stepPx) {
    const point = path.getPointAtLength(i);
    points.push([point.x, point.y]);
  }
  
  document.body.removeChild(svg);
  return points;
}

export const MASK_POINTS: [number, number][] = pathToPoints(MASK_FILL_PATH);

// Create SVG path from polygon points (kept for backward compatibility)
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