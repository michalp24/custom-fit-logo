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

// Normalize the root into a group so inherited paint and transforms survive embedding.
export function normalizeSVG(source: string): string {
  const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
  const root = doc.documentElement;
  if (doc.querySelector('parsererror') || root.localName !== 'svg') throw new Error('Invalid SVG file.');
  root.querySelectorAll('script, foreignObject, iframe, animate, animateTransform, set').forEach(el => el.remove());
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      if (/^on/i.test(attr.name) || ((attr.localName === 'href') && !attr.value.startsWith('#') && !/^data:image\/(png|jpeg|webp);base64,/i.test(attr.value))) el.removeAttributeNode(attr);
    }
  }
  // Resolve SVG styles in an isolated tree, then inline them. Uploaded selectors
  // must not recolor the canvas, guides, or other logos in the exported document.
  const externalResources = (value: string) => /@import/i.test(value) || [...value.matchAll(/url\(([^)]*)\)/gi)].some(match => !match[1].trim().replace(/^["']|["']$/g, '').startsWith('#'));
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      if (externalResources(attr.value)) throw new Error('Please embed external SVG resources before uploading.');
    }
    if (el.localName === 'style' && externalResources(el.textContent || '')) throw new Error('Please embed external SVG resources before uploading.');
  }
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-100000px;top:0;pointer-events:none';
  const shadow = container.attachShadow({ mode: 'closed' });
  const mounted = document.importNode(root, true);
  shadow.appendChild(mounted);
  document.body.appendChild(container);
  const properties = ['stop-color', 'stop-opacity', 'flood-color', 'flood-opacity', 'lighting-color', 'fill', 'fill-opacity', 'fill-rule', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'opacity', 'display', 'visibility', 'color', 'clip-path', 'clip-rule', 'mask', 'filter', 'marker-start', 'marker-mid', 'marker-end', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'paint-order', 'vector-effect', 'transform', 'transform-origin'];
  try {
    const originals = [root, ...root.querySelectorAll('*')];
    const copies = [mounted, ...mounted.querySelectorAll('*')];
    originals.forEach((el, index) => {
      if (['style', 'title', 'desc'].includes(el.localName)) return;
      const computed = getComputedStyle(copies[index]);
      const style = properties.map(property => {
        const value = computed.getPropertyValue(property).replace(/url\(["']?[^)"']*#([^"')]+)["']?\)/g, 'url(#$1)');
        return `${property}:${value}`;
      }).join(';');
      el.setAttribute('style', style);
    });
  } finally { container.remove(); }
  root.querySelectorAll('style').forEach(el => el.remove());
  const group = doc.createElementNS('http://www.w3.org/2000/svg', 'g');
  for (const name of ['fill', 'stroke', 'stroke-width', 'fill-rule', 'clip-rule', 'opacity', 'transform', 'style', 'class', 'id', 'color']) {
    if (root.hasAttribute(name)) group.setAttribute(name, root.getAttribute(name)!);
  }
  while (root.firstChild) group.appendChild(root.firstChild);
  for (const name of ['fill', 'stroke', 'stroke-width', 'fill-rule', 'clip-rule', 'opacity', 'transform', 'style', 'class', 'id', 'color']) root.removeAttribute(name);
  root.appendChild(group);
  return new XMLSerializer().serializeToString(root);
}

export function parseSVGBounds(svgString: string): SVGBounds {
  const doc = new DOMParser().parseFromString(svgString, 'image/svg+xml');
  if (doc.querySelector('parsererror') || doc.documentElement.localName !== 'svg') throw new Error('Invalid SVG file.');
  const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  host.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none';
  const group = document.createElementNS(host.namespaceURI, 'g') as SVGGElement;
  for (const child of [...doc.documentElement.children]) group.appendChild(document.importNode(child, true));
  host.appendChild(group);
  document.body.appendChild(host);
  try {
    const box = group.getBBox();
    if (![box.x, box.y, box.width, box.height].every(Number.isFinite) || box.width <= 0 || box.height <= 0) throw new Error('SVG contains no measurable artwork.');
    return { minX: box.x, minY: box.y, maxX: box.x + box.width, maxY: box.y + box.height, width: box.width, height: box.height };
  } finally { host.remove(); }
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
        reject(new Error('This image is fully transparent. Please choose a visible logo.'));
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

export async function vectorizeRasterImage(canvas: HTMLCanvasElement): Promise<string> {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read image.');
  return ImageTracer.imageTracer.imageDataToSVG(ctx.getImageData(0, 0, canvas.width, canvas.height), {
    pathomit: 1, ltres: 0.1, qtres: 0.1, scale: 1, strokewidth: 0,
    blurradius: 0, colorsampling: 1, numberofcolors: 16, mincolorratio: 0.02, colorquantcycles: 3
  });
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not decode image.')); };
    img.src = url;
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
  const scale = Math.min(scaleX, scaleY);
  
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

// Sample points around logo perimeter for containment testing with high resolution
function sampleLogoPerimeter(bounds: SVGBounds, scale: number): [number, number][] {
  const { minX, minY, width, height } = bounds;
  const points: [number, number][] = [];
  
  // Scale-aware sampling: ~1px spacing, capped at 2000 points for performance
  const scaledPerimeter = 2 * (width * scale + height * scale);
  const targetSpacing = 1.0; // pixels
  const totalSamples = Math.min(Math.ceil(scaledPerimeter / targetSpacing), 2000);
  const samplesPerEdge = Math.ceil(totalSamples / 4);
  
  // Top edge
  for (let i = 0; i < samplesPerEdge; i++) {
    const t = i / Math.max(1, samplesPerEdge - 1);
    points.push([(minX + t * width) * scale, minY * scale]);
  }
  
  // Right edge
  for (let i = 0; i < samplesPerEdge; i++) {
    const t = i / Math.max(1, samplesPerEdge - 1);
    points.push([(minX + width) * scale, (minY + t * height) * scale]);
  }
  
  // Bottom edge
  for (let i = 0; i < samplesPerEdge; i++) {
    const t = i / Math.max(1, samplesPerEdge - 1);
    points.push([(minX + (1 - t) * width) * scale, (minY + height) * scale]);
  }
  
  // Left edge
  for (let i = 0; i < samplesPerEdge; i++) {
    const t = i / Math.max(1, samplesPerEdge - 1);
    points.push([minX * scale, (minY + (1 - t) * height) * scale]);
  }
  
  return points;
}

// Rotate a point around a center by degrees
function rotatePoint(point: [number, number], center: [number, number], degrees: number): [number, number] {
  const [x, y] = point;
  const [cx, cy] = center;
  const radians = (degrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  
  const dx = x - cx;
  const dy = y - cy;
  
  return [
    cx + dx * cos - dy * sin,
    cy + dx * sin + dy * cos
  ];
}

// Precise fitting function using binary search and point containment
export function fitIntoMask(
  logoBounds: SVGBounds,
  maskPoints: [number, number][],
  center: [number, number],
  paddingPct: number = 0,
  rotationDeg: number = 0
): { scale: number, offsetX: number, offsetY: number } {
  const [centerX, centerY] = center;
  
  // Start with conservative bounds and grow until we find the limits
  let lowerBound = 0;
  let upperBound = 0.1;
  
  // Find upper bound by growing until containment fails
  while (upperBound < 1e9) {
    const perimeterPoints = sampleLogoPerimeter(logoBounds, upperBound);
    const logoCenterX = logoBounds.minX + logoBounds.width / 2;
    const logoCenterY = logoBounds.minY + logoBounds.height / 2;
    const offsetX = centerX - (logoCenterX * upperBound);
    const offsetY = centerY - (logoCenterY * upperBound);
    
    let allInside = true;
    for (const [px, py] of perimeterPoints) {
      let worldPoint: [number, number] = [px + offsetX, py + offsetY];
      
      // Apply rotation if specified
      if (rotationDeg !== 0) {
        worldPoint = rotatePoint(worldPoint, center, rotationDeg);
      }
      
      if (!pointInPolygon(worldPoint, maskPoints)) {
        allInside = false;
        break;
      }
    }
    
    if (!allInside) break;
    lowerBound = upperBound;
    upperBound *= 1.1;
  }
  
  let bestScale = lowerBound;
  
  // Binary search for maximum scale that keeps logo inside mask
  for (let iteration = 0; iteration < 30; iteration++) {
    const testScale = (lowerBound + upperBound) / 2;
    
    // Sample logo perimeter at this scale
    const perimeterPoints = sampleLogoPerimeter(logoBounds, testScale);
    
    // Test if all perimeter points are inside mask (with offset to center)
    const logoCenterX = logoBounds.minX + logoBounds.width / 2;
    const logoCenterY = logoBounds.minY + logoBounds.height / 2;
    const offsetX = centerX - (logoCenterX * testScale);
    const offsetY = centerY - (logoCenterY * testScale);
    
    let allInside = true;
    for (const [px, py] of perimeterPoints) {
      let worldPoint: [number, number] = [px + offsetX, py + offsetY];
      
      // Apply rotation if specified
      if (rotationDeg !== 0) {
        worldPoint = rotatePoint(worldPoint, center, rotationDeg);
      }
      
      if (!pointInPolygon(worldPoint, maskPoints)) {
        allInside = false;
        break;
      }
    }
    
    if (allInside) {
      bestScale = testScale;
      lowerBound = testScale;
    } else {
      upperBound = testScale;
    }
    
    if (upperBound - lowerBound < 1e-4) break;
  }
  
  // Apply safety margin to ensure strict containment
  const safetyFactor = 0.995;
  bestScale *= safetyFactor;
  
  // Apply padding reduction (percentage-based, no minimum)
  const paddingFactor = 1 - paddingPct / 100;
  bestScale *= paddingFactor;
  
  // Calculate final offset for the new transform logic
  // New transform order: translate(-logoCenter) -> scale -> translate(logoCenter) -> rotate -> translate(offset)
  // After the scale sequence, the logo is scaled but still at its original position
  // So we need to translate from the original logo center to the mask center
  const logoCenterX = logoBounds.minX + logoBounds.width / 2;
  const logoCenterY = logoBounds.minY + logoBounds.height / 2;
  const offsetX = centerX - logoCenterX;
  const offsetY = centerY - logoCenterY;
  
  return { scale: bestScale, offsetX, offsetY };
}