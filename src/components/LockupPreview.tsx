import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useLogoStore } from '@/store/logoStore';
import { loadImageFromFile, parseSVGBounds, getAlphaTightBounds, vectorizeRasterImage, fitIntoMask } from '@/utils/logoProcessor';

// Lockup canvas constants
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const SEPARATOR_X = CANVAS_WIDTH / 2; // centered separator
const SEPARATOR_WIDTH = 8;
const RIGHT_PADDING = 120; // outer padding for right half
const TOP_BOTTOM_PADDING = 160;
const RIGHT_BOX_WIDTH = 480;
const RIGHT_BOX_HEIGHT = 370;

function rectToPolygonPoints(x: number, y: number, width: number, height: number): [number, number][] {
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height],
  ];
}

export function LockupPreview() {
  const svgRef = useRef<SVGSVGElement>(null);
  const {
    logoData,
    scale,
    offsetX,
    offsetY,
    showOutline,
    showCanvas,
    isDarkCanvas,
    baseScale,
    scaleFactor,
  } = useLogoStore();
  const { setLogoFile, setLogoData, setTransform, setUI, setInitialTransform, setAnchor } = useLogoStore();

  // Precompute partner logo placement box (fixed 480x370)
  const rightBoundsXStart = SEPARATOR_X + SEPARATOR_WIDTH + RIGHT_PADDING;
  const rightBoundsXEnd = CANVAS_WIDTH - RIGHT_PADDING;
  const availableRightWidth = rightBoundsXEnd - rightBoundsXStart;
  const availableRightHeight = CANVAS_HEIGHT - TOP_BOTTOM_PADDING * 2;
  const rightArea = {
    x: rightBoundsXStart + Math.max(0, (availableRightWidth - RIGHT_BOX_WIDTH) / 2),
    y: TOP_BOTTOM_PADDING + Math.max(0, (availableRightHeight - RIGHT_BOX_HEIGHT) / 2),
    width: RIGHT_BOX_WIDTH,
    height: RIGHT_BOX_HEIGHT,
  };
  const rightAreaCenter: [number, number] = [
    rightArea.x + rightArea.width / 2,
    rightArea.y + rightArea.height / 2,
  ];
  const rightAreaPoints = rectToPolygonPoints(rightArea.x, rightArea.y, rightArea.width, rightArea.height);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;

    // Clear previous content
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Background (always on for lockup). Uses dark/light toggle if set
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', String(CANVAS_WIDTH));
    bgRect.setAttribute('height', String(CANVAS_HEIGHT));
    bgRect.setAttribute('fill', isDarkCanvas ? '#000000' : '#ffffff');
    svg.appendChild(bgRect);

    // Left area for permanent company logo
    const leftAreaX = RIGHT_PADDING;
    const leftAreaY = TOP_BOTTOM_PADDING;
    const leftAreaWidth = SEPARATOR_X - RIGHT_PADDING * 2;
    const leftAreaHeight = CANVAS_HEIGHT - TOP_BOTTOM_PADDING * 2;

    const LOGO_PADDING = 120;
    const logoImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    logoImg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', isDarkCanvas ? '/nvidia-logo-dark.svg' : '/nvidia-logo.svg');
    logoImg.setAttribute('x', String(leftAreaX + LOGO_PADDING));
    logoImg.setAttribute('y', String(leftAreaY + LOGO_PADDING));
    logoImg.setAttribute('width', String(Math.max(0, leftAreaWidth - LOGO_PADDING * 2)));
    logoImg.setAttribute('height', String(Math.max(0, leftAreaHeight - LOGO_PADDING * 2)));
    logoImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.appendChild(logoImg);

    // Separator line
    // Separator rendered via foreignObject to allow HTML styling for theme colors
    const foreign = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    foreign.setAttribute('x', String(SEPARATOR_X - SEPARATOR_WIDTH / 2));
    foreign.setAttribute('y', String((CANVAS_HEIGHT - 550) / 2));
    foreign.setAttribute('width', String(SEPARATOR_WIDTH));
    foreign.setAttribute('height', '550');

    const div = document.createElement('div');
    div.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    div.style.width = `${SEPARATOR_WIDTH}px`;
    div.style.height = `550px`;
    div.style.background = isDarkCanvas ? '#333333' : '#cccccc';

    foreign.appendChild(div);
    svg.appendChild(foreign);

    // Right guide outline (fixed 480x370)
    if (showOutline) {
      const guide = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      guide.setAttribute('x', String(rightArea.x));
      guide.setAttribute('y', String(rightArea.y));
      guide.setAttribute('width', String(rightArea.width));
      guide.setAttribute('height', String(rightArea.height));
      guide.setAttribute('fill', 'none');
      guide.setAttribute('stroke', 'hsl(var(--outline))');
      guide.setAttribute('stroke-width', '2');
      guide.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(guide);
    }

    // Render uploaded logo (right side)
    if (logoData) {
      try {
        const parser = new DOMParser();
        const logoDoc = parser.parseFromString(logoData, 'image/svg+xml');
        const logoSvg = logoDoc.documentElement;

        const logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Get logo bounds and center for proper scaling anchor
        const logoBounds = parseSVGBounds(logoData);
        const logoCenterX = logoBounds.minX + logoBounds.width / 2;
        const logoCenterY = logoBounds.minY + logoBounds.height / 2;
        
        // Apply transforms in proper order for scaling around logo center
        // SVG transforms apply right-to-left, so we need:
        // 1. translate(offsetX, offsetY) - position adjustment 
        // 2. translate(logoCenterX, logoCenterY) - move to logo center
        // 3. scale(scale) - scale around logo center
        // 4. translate(-logoCenterX, -logoCenterY) - move back from logo center
        
        const transforms: string[] = [];
        
        // Order matters - these are applied right-to-left in SVG
        if (offsetX !== 0 || offsetY !== 0) {
          transforms.push(`translate(${offsetX}, ${offsetY})`);
        }
        
        // Scale around logo's own center
        if (scale !== 1) {
          transforms.push(`translate(${logoCenterX}, ${logoCenterY})`);
          transforms.push(`scale(${scale})`);
          transforms.push(`translate(${-logoCenterX}, ${-logoCenterY})`);
        }
        if (transforms.length > 0) logoGroup.setAttribute('transform', transforms.join(' '));

        const logoElements = logoSvg.children;
        for (let i = 0; i < logoElements.length; i++) {
          logoGroup.appendChild(logoElements[i].cloneNode(true) as Element);
        }
        svg.appendChild(logoGroup);
      } catch (e) {
        console.error('Error rendering lockup logo:', e);
      }
    }
  }, [logoData, scale, offsetX, offsetY, showOutline, isDarkCanvas, baseScale, scaleFactor]);

  const processFile = useCallback(async (file: File) => {
    const state = useLogoStore.getState();
    setUI({ isProcessing: true });
    try {
      const fileType = file.type;
      if (fileType === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const svgText = await file.text();
        const bounds = parseSVGBounds(svgText);
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, rightAreaPoints, rightAreaCenter, 0, 0);
        setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2]);
        setLogoData(svgText, 'svg');
        setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
        setInitialTransform({ scale, offsetX, offsetY });
      } else if (fileType.startsWith('image/')) {
        const img = await loadImageFromFile(file);
        const { canvas, bounds } = await getAlphaTightBounds(img);
        const svgString = await vectorizeRasterImage(canvas);
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, rightAreaPoints, rightAreaCenter, 0, 0);
        setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2]);
        setLogoData(svgString, 'raster');
        setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
        setInitialTransform({ scale, offsetX, offsetY });
      }
      setLogoFile(file);
    } finally {
      setUI({ isProcessing: false });
    }
  }, [rightAreaPoints, rightAreaCenter, setLogoData, setTransform, setUI, setInitialTransform, setLogoFile]);

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
    <div
      className="relative w-full h-full bg-canvas rounded-lg border border-border overflow-hidden"
      onDrop={onDrop}
      onDragOver={onDragOver}
      onClick={onClickFile}
      role="button"
      aria-label="Drop or click to upload logo for lockup"
      tabIndex={0}
    >
      <svg
        ref={svgRef}
        viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
        className="w-full h-full"
        style={{ background: 'transparent' }}
      />

      {!logoData && null}
    </div>
  );
}


