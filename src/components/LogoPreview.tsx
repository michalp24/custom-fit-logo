import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { useLogoStore } from '@/store/logoStore';
import { MASK_OUTLINE_PATH, MASK_FILL_PATH, MASK_CENTER, MASK_POINTS } from '@/utils/mask';
import { loadImageFromFile, parseSVGBounds, getAlphaTightBounds, vectorizeRasterImage, fitIntoMask } from '@/utils/logoProcessor';

export function LogoPreview() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { 
    logoData, 
    scale, 
    rotation, 
    offsetX, 
    offsetY, 
    showOutline, 
    showCanvas 
  } = useLogoStore();
  const { setLogoFile, setLogoData, setTransform, setUI } = useLogoStore();

  useEffect(() => {
    if (!svgRef.current || !logoData) return;

    const svg = svgRef.current;
    
    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Background canvas rect (export area only)
    if (showCanvas) {
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', '0');
      bgRect.setAttribute('y', '0');
      bgRect.setAttribute('width', '1250');
      bgRect.setAttribute('height', '700');
      bgRect.setAttribute('fill', '#cccccc');
      svg.appendChild(bgRect);
    }

    // Create defs for clipping path
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    // Create clipping path from mask
    const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
    clipPath.id = 'maskClip';
    
    const clipPathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    clipPathElement.setAttribute('d', MASK_FILL_PATH);
    clipPath.appendChild(clipPathElement);
    defs.appendChild(clipPath);
    svg.appendChild(defs);

    // Add mask outline (if enabled)
    if (showOutline) {
      const outlinePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      outlinePath.setAttribute('d', MASK_OUTLINE_PATH);
      outlinePath.setAttribute('fill', 'none');
      outlinePath.setAttribute('stroke', 'hsl(var(--outline))');
      outlinePath.setAttribute('stroke-width', '2');
      outlinePath.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(outlinePath);
    }

    // Parse and add logo content
    try {
      const parser = new DOMParser();
      const logoDoc = parser.parseFromString(logoData, 'image/svg+xml');
      const logoSvg = logoDoc.documentElement;

      // Create a group for the logo with transforms
      const logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      // Apply transforms
      const transforms = [];
      if (offsetX !== 0 || offsetY !== 0) {
        transforms.push(`translate(${offsetX}, ${offsetY})`);
      }
      if (scale !== 1) {
        transforms.push(`scale(${scale})`);
      }
      if (rotation !== 0) {
        const [centerX, centerY] = MASK_CENTER;
        transforms.push(`rotate(${rotation}, ${centerX}, ${centerY})`);
      }
      
      if (transforms.length > 0) {
        logoGroup.setAttribute('transform', transforms.join(' '));
      }

      // No clipping; background handled via canvas toggle

      // Copy logo elements to the group
      const logoElements = logoSvg.children;
      for (let i = 0; i < logoElements.length; i++) {
        const element = logoElements[i].cloneNode(true) as Element;
        logoGroup.appendChild(element);
      }

      svg.appendChild(logoGroup);
    } catch (error) {
      console.error('Error rendering logo:', error);
    }
  }, [logoData, scale, rotation, offsetX, offsetY, showOutline, showCanvas]);

  const processFile = useCallback(async (file: File) => {
    const state = useLogoStore.getState();
    setUI({ isProcessing: true });
    try {
      const fileType = file.type;
      if (fileType === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const svgText = await file.text();
        const bounds = parseSVGBounds(svgText);
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, MASK_POINTS, MASK_CENTER, state.padding);
        setLogoData(svgText, 'svg');
        setTransform({ scale, offsetX, offsetY });
      } else if (fileType.startsWith('image/')) {
        const img = await loadImageFromFile(file);
        const { canvas, bounds } = await getAlphaTightBounds(img);
        const svgString = await vectorizeRasterImage(canvas);
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, MASK_POINTS, MASK_CENTER, state.padding);
        setLogoData(svgString, 'raster');
        setTransform({ scale, offsetX, offsetY });
      }
      setLogoFile(file);
    } finally {
      setUI({ isProcessing: false });
    }
  }, [setLogoData, setTransform, setUI, setLogoFile]);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dt = event.dataTransfer;
    if (!dt?.files?.length) return;
    processFile(dt.files[0]);
  }, [processFile]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const onClickFile = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.svg,.png,.jpg,.jpeg,image/svg+xml,image/png,image/jpeg';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) processFile(file);
    };
    input.click();
  }, [processFile]);

  return (
    <div className="relative w-full h-full bg-canvas rounded-lg border border-border overflow-hidden" onDrop={onDrop} onDragOver={onDragOver} onClick={onClickFile} role="button" aria-label="Drop or click to upload logo" tabIndex={0}>
      <svg
        ref={svgRef}
        viewBox="0 0 1250 700"
        className="w-full h-full"
        style={{ background: 'transparent' }}
      >
        {/* SVG content will be dynamically inserted here */}
      </svg>
      
      {!logoData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-muted-foreground text-lg">Preview Area</div>
            <div className="text-sm text-muted-foreground">
              Drop or click to upload a logo (SVG/PNG/JPG)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}