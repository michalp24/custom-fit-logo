// Default hexagonal-like mask based on the uploaded outline
export const DEFAULT_MASK_POINTS: [number, number][] = [
  [400, 150],  // Top center
  [600, 250],  // Top right
  [600, 450],  // Bottom right
  [400, 550],  // Bottom center
  [200, 450],  // Bottom left
  [200, 250],  // Top left
];

export const MASK_CENTER = [400, 350];
export const MASK_BOUNDS = {
  minX: 200,
  maxX: 600,
  minY: 150,
  maxY: 550,
  width: 400,
  height: 400
};

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

// Generate points along the perimeter of a shape for testing
export function generateTestPoints(bounds: { minX: number, maxX: number, minY: number, maxY: number }, density: number = 20): [number, number][] {
  const points: [number, number][] = [];
  const stepX = (bounds.maxX - bounds.minX) / density;
  const stepY = (bounds.maxY - bounds.minY) / density;
  
  for (let x = bounds.minX; x <= bounds.maxX; x += stepX) {
    for (let y = bounds.minY; y <= bounds.maxY; y += stepY) {
      points.push([x, y]);
    }
  }
  
  return points;
}

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