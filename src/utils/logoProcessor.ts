import * as ImageTracer from 'imagetracer';

// SVG parsing utilities
export interface SVGBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export function parseSVGBounds(svgString: string): SVGBounds {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;
  
  // Get all visible elements
  const elements = svg.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon');
  
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let hasContent = false;
  
  elements.forEach(element => {
    const svgElement = element as SVGElement;
    
    // Skip hidden elements
    const computedStyle = window.getComputedStyle ? window.getComputedStyle(svgElement) : null;
    const style = computedStyle || (svgElement as any).style || {};
    if (style.display === 'none' || style.opacity === '0') return;
    
    try {
      const bbox = (svgElement as any).getBBox ? (svgElement as any).getBBox() : svgElement.getBoundingClientRect();
      if (bbox.width > 0 && bbox.height > 0) {
        minX = Math.min(minX, bbox.x);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        minY = Math.min(minY, bbox.y);
        maxY = Math.max(maxY, bbox.y + bbox.height);
        hasContent = true;
      }
    } catch (e) {
      // Ignore elements that can't provide bbox
    }
  });
  
  if (!hasContent) {
    // Fallback to viewBox or default
    const viewBox = (svg as any).viewBox?.baseVal;
    if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
      return {
        minX: viewBox.x,
        maxX: viewBox.x + viewBox.width,
        minY: viewBox.y,
        maxY: viewBox.y + viewBox.height,
        width: viewBox.width,
        height: viewBox.height
      };
    }
    
    return { minX: 0, maxX: 100, minY: 0, maxY: 100, width: 100, height: 100 };
  }
  
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY
  };
}

export function getAlphaTightBounds(imageElement: HTMLImageElement): Promise<{ canvas: HTMLCanvasElement, bounds: SVGBounds }> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    canvas.width = imageElement.naturalWidth || imageElement.width;
    canvas.height = imageElement.naturalHeight || imageElement.height;
    
    ctx.drawImage(imageElement, 0, 0);
    
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      let minX = canvas.width, maxX = 0, minY = canvas.height, maxY = 0;
      let hasAlpha = false;
      
      // Find tight bounds based on alpha channel
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 0) {
            minX = Math.min(minX, x);
            maxX = Math.max(maxX, x);
            minY = Math.min(minY, y);
            maxY = Math.max(maxY, y);
            hasAlpha = true;
          }
        }
      }
      
      if (!hasAlpha) {
        // No transparent pixels, use full image
        resolve({
          canvas,
          bounds: { minX: 0, maxX: canvas.width, minY: 0, maxY: canvas.height, width: canvas.width, height: canvas.height }
        });
        return;
      }
      
      // Create cropped canvas
      const croppedCanvas = document.createElement('canvas');
      const croppedCtx = croppedCanvas.getContext('2d');
      
      if (!croppedCtx) {
        reject(new Error('Could not get cropped canvas context'));
        return;
      }
      
      const width = maxX - minX + 1;
      const height = maxY - minY + 1;
      
      croppedCanvas.width = width;
      croppedCanvas.height = height;
      
      croppedCtx.drawImage(canvas, minX, minY, width, height, 0, 0, width, height);
      
      resolve({
        canvas: croppedCanvas,
        bounds: { minX, maxX, minY, maxY, width, height }
      });
    } catch (error) {
      reject(error);
    }
  });
}

export function vectorizeRasterImage(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const imageData = canvas.toDataURL('image/png');
      
      // Configure ImageTracer for logo-friendly settings
      const options = {
        pathomit: 1,
        ltres: 0.1,
        qtres: 0.1,
        scale: 1,
        strokewidth: 0,
        blurradius: 0,
        colorsampling: 1,
        numberofcolors: 16,
        mincolorratio: 0.02,
        colorquantcycles: 3
      };
      
      // Use the correct ImageTracer API
      const svgString = (ImageTracer as any).imageDataToSVG(imageData, options);
      resolve(svgString);
    } catch (error) {
      reject(error);
    }
  });
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// Calculate optimal scale to fit logo bounds inside mask
export function calculateFitScale(
  logoBounds: SVGBounds,
  maskPoints: [number, number][],
  padding: number = 10
): { scale: number, offsetX: number, offsetY: number } {
  // Find mask bounds
  const maskMinX = Math.min(...maskPoints.map(p => p[0]));
  const maskMaxX = Math.max(...maskPoints.map(p => p[0]));
  const maskMinY = Math.min(...maskPoints.map(p => p[1]));
  const maskMaxY = Math.max(...maskPoints.map(p => p[1]));
  
  const maskWidth = maskMaxX - maskMinX;
  const maskHeight = maskMaxY - maskMinY;
  const maskCenterX = (maskMinX + maskMaxX) / 2;
  const maskCenterY = (maskMinY + maskMaxY) / 2;
  
  // Apply padding
  const availableWidth = maskWidth - (padding * 2);
  const availableHeight = maskHeight - (padding * 2);
  
  // Calculate scale to fit
  const scaleX = availableWidth / logoBounds.width;
  const scaleY = availableHeight / logoBounds.height;
  const scale = Math.min(scaleX, scaleY) * 0.9; // 10% additional margin
  
  // Calculate offset to center
  const logoCenterX = logoBounds.minX + logoBounds.width / 2;
  const logoCenterY = logoBounds.minY + logoBounds.height / 2;
  
  const offsetX = maskCenterX - (logoCenterX * scale);
  const offsetY = maskCenterY - (logoCenterY * scale);
  
  return { scale, offsetX, offsetY };
}

// Point-in-polygon test using ray casting algorithm (imported from mask.ts)
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
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

// Sample points around logo perimeter for containment testing
function sampleLogoPerimeter(bounds: SVGBounds, scale: number, sampleCount: number = 40): [number, number][] {
  const { minX, minY, width, height } = bounds;
  const points: [number, number][] = [];
  
  // Sample along each edge
  const edgeSamples = Math.ceil(sampleCount / 4);
  
  // Top edge
  for (let i = 0; i < edgeSamples; i++) {
    const t = i / (edgeSamples - 1);
    points.push([(minX + t * width) * scale, minY * scale]);
  }
  
  // Right edge
  for (let i = 0; i < edgeSamples; i++) {
    const t = i / (edgeSamples - 1);
    points.push([(minX + width) * scale, (minY + t * height) * scale]);
  }
  
  // Bottom edge
  for (let i = 0; i < edgeSamples; i++) {
    const t = i / (edgeSamples - 1);
    points.push([(minX + (1 - t) * width) * scale, (minY + height) * scale]);
  }
  
  // Left edge
  for (let i = 0; i < edgeSamples; i++) {
    const t = i / (edgeSamples - 1);
    points.push([minX * scale, (minY + (1 - t) * height) * scale]);
  }
  
  return points;
}

// Precise fitting function using binary search and point containment
export function fitIntoMask(
  logoBounds: SVGBounds,
  maskPoints: [number, number][],
  center: [number, number],
  paddingPct: number = 10
): { scale: number, offsetX: number, offsetY: number } {
  const [centerX, centerY] = center;
  
  // Initial bounds-based scale estimate
  const initialFit = calculateFitScale(logoBounds, maskPoints, paddingPct);
  let maxScale = initialFit.scale * 2; // Start higher than bounds-based estimate
  let minScale = 0.01;
  let bestScale = minScale;
  
  // Binary search for maximum scale that keeps logo inside mask
  for (let iteration = 0; iteration < 20; iteration++) {
    const testScale = (minScale + maxScale) / 2;
    
    // Sample logo perimeter at this scale
    const perimeterPoints = sampleLogoPerimeter(logoBounds, testScale);
    
    // Test if all perimeter points are inside mask (with offset to center)
    const logoCenterX = logoBounds.minX + logoBounds.width / 2;
    const logoCenterY = logoBounds.minY + logoBounds.height / 2;
    const offsetX = centerX - (logoCenterX * testScale);
    const offsetY = centerY - (logoCenterY * testScale);
    
    let allInside = true;
    for (const [px, py] of perimeterPoints) {
      const worldPoint: [number, number] = [px + offsetX, py + offsetY];
      if (!pointInPolygon(worldPoint, maskPoints)) {
        allInside = false;
        break;
      }
    }
    
    if (allInside) {
      bestScale = testScale;
      minScale = testScale;
    } else {
      maxScale = testScale;
    }
    
    if (maxScale - minScale < 0.001) break;
  }
  
  // Apply padding reduction
  const paddingFactor = Math.max(0.1, 1 - paddingPct / 100);
  bestScale *= paddingFactor;
  
  // Calculate final offset
  const logoCenterX = logoBounds.minX + logoBounds.width / 2;
  const logoCenterY = logoBounds.minY + logoBounds.height / 2;
  const offsetX = centerX - (logoCenterX * bestScale);
  const offsetY = centerY - (logoCenterY * bestScale);
  
  return { scale: bestScale, offsetX, offsetY };
}