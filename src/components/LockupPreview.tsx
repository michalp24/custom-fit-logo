import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useLogoStore } from '@/store/logoStore';
import { loadImageFromFile, parseSVGBounds, getAlphaTightBounds, vectorizeRasterImage, fitIntoMask } from '@/utils/logoProcessor';

// Lockup canvas constants
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const SEPARATOR_WIDTH = 8;
const PADDING = 120;
// Logo box dimensions (different for each layout)
const VERTICAL_LOGO_WIDTH = 480;
const VERTICAL_LOGO_HEIGHT = 370;
const HORIZONTAL_LOGO_WIDTH = 692;
const HORIZONTAL_LOGO_HEIGHT = 132;

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
    lockupOrientation,
  } = useLogoStore();
  const { setLogoFile, setLogoData, setTransform, setUI, setInitialTransform, setAnchor } = useLogoStore();

  // Calculate layout based on orientation
  const isHorizontal = lockupOrientation === 'horizontal';
  
  // Layout calculations
  let nvidiaArea, separatorConfig, partnerArea, partnerAreaCenter, partnerAreaPoints;
  
  if (isHorizontal) {
    // Horizontal layout: NVIDIA left, separator vertical, partner right
    const separatorX = CANVAS_WIDTH / 2;
    const leftAreaWidth = separatorX - PADDING * 2;
    const rightAreaXStart = separatorX + SEPARATOR_WIDTH + PADDING;
    const rightAreaWidth = CANVAS_WIDTH - rightAreaXStart - PADDING;
    
    nvidiaArea = {
      x: PADDING,
      y: PADDING,
      width: leftAreaWidth,
      height: CANVAS_HEIGHT - PADDING * 2,
    };
    
    separatorConfig = {
      x: separatorX - SEPARATOR_WIDTH / 2,
      y: (CANVAS_HEIGHT - 304) / 2, // 304px height for horizontal
      width: SEPARATOR_WIDTH,
      height: 304,
      isHorizontal: false,
    };
    
    // Horizontal layout uses 692x132 logo area
    partnerArea = {
      x: rightAreaXStart + Math.max(0, (rightAreaWidth - HORIZONTAL_LOGO_WIDTH) / 2),
      y: PADDING + Math.max(0, (CANVAS_HEIGHT - PADDING * 2 - HORIZONTAL_LOGO_HEIGHT) / 2),
      width: HORIZONTAL_LOGO_WIDTH,
      height: HORIZONTAL_LOGO_HEIGHT,
    };
  } else {
    // Vertical layout: Same side-by-side layout but with vertical NVIDIA logo
    const separatorX = CANVAS_WIDTH / 2;
    const leftAreaWidth = separatorX - PADDING * 2;
    const rightAreaXStart = separatorX + SEPARATOR_WIDTH + PADDING;
    const rightAreaWidth = CANVAS_WIDTH - rightAreaXStart - PADDING;
    
    nvidiaArea = {
      x: PADDING,
      y: PADDING,
      width: leftAreaWidth,
      height: CANVAS_HEIGHT - PADDING * 2,
    };
    
    separatorConfig = {
      x: separatorX - SEPARATOR_WIDTH / 2,
      y: (CANVAS_HEIGHT - 550) / 2, // 550px height for vertical
      width: SEPARATOR_WIDTH,
      height: 550,
      isHorizontal: false,
    };
    
    // Vertical layout uses 480x370 logo area
    partnerArea = {
      x: rightAreaXStart + Math.max(0, (rightAreaWidth - VERTICAL_LOGO_WIDTH) / 2),
      y: PADDING + Math.max(0, (CANVAS_HEIGHT - PADDING * 2 - VERTICAL_LOGO_HEIGHT) / 2),
      width: VERTICAL_LOGO_WIDTH,
      height: VERTICAL_LOGO_HEIGHT,
    };
  }
  
  partnerAreaCenter = [
    partnerArea.x + partnerArea.width / 2,
    partnerArea.y + partnerArea.height / 2,
  ];
  partnerAreaPoints = rectToPolygonPoints(partnerArea.x, partnerArea.y, partnerArea.width, partnerArea.height);

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

    // NVIDIA logo area (use lockup logos for horizontal layout)
    const LOGO_PADDING = 60;
    const logoImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    
    // Choose logo based on layout and theme
    let logoPath;
    if (isHorizontal) {
      logoPath = isDarkCanvas ? '/nvidia-logo-lcokup-dark.svg' : '/nvidia-logo-lockup.svg';
    } else {
      logoPath = isDarkCanvas ? '/nvidia-logo-dark.svg' : '/nvidia-logo.svg';
    }
    
    logoImg.setAttributeNS('http://www.w3.org/1999/xlink', 'href', logoPath);
    
    // Calculate logo size to match export dimensions
    if (isHorizontal) {
      // Horizontal layout: target 692px width (matches export)
      const targetWidth = 692;
      const logoAspectRatio = 694 / 133; // lockup logo dimensions
      const targetHeight = targetWidth / logoAspectRatio;
      
      const logoX = nvidiaArea.x + (nvidiaArea.width - targetWidth) / 2;
      const logoY = nvidiaArea.y + (nvidiaArea.height - targetHeight) / 2;
      
      logoImg.setAttribute('x', String(logoX));
      logoImg.setAttribute('y', String(logoY));
      logoImg.setAttribute('width', String(targetWidth));
      logoImg.setAttribute('height', String(targetHeight));
    } else {
      // Vertical layout: target 477px width (matches export)
      const targetWidth = 477;
      const logoAspectRatio = 480 / 372; // regular logo dimensions
      const targetHeight = targetWidth / logoAspectRatio;
      
      const logoX = nvidiaArea.x + (nvidiaArea.width - targetWidth) / 2;
      const logoY = nvidiaArea.y + (nvidiaArea.height - targetHeight) / 2;
      
      logoImg.setAttribute('x', String(logoX));
      logoImg.setAttribute('y', String(logoY));
      logoImg.setAttribute('width', String(targetWidth));
      logoImg.setAttribute('height', String(targetHeight));
    }
    
    logoImg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.appendChild(logoImg);

    // Separator (responsive to orientation)
    const separatorRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    separatorRect.setAttribute('x', String(separatorConfig.x));
    separatorRect.setAttribute('y', String(separatorConfig.y));
    separatorRect.setAttribute('width', String(separatorConfig.width));
    separatorRect.setAttribute('height', String(separatorConfig.height));
    separatorRect.setAttribute('fill', isDarkCanvas ? '#333333' : '#cccccc');
    svg.appendChild(separatorRect);

    // Partner logo guide outline
    if (showOutline) {
      const guide = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      guide.setAttribute('x', String(partnerArea.x));
      guide.setAttribute('y', String(partnerArea.y));
      guide.setAttribute('width', String(partnerArea.width));
      guide.setAttribute('height', String(partnerArea.height));
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
  }, [logoData, scale, offsetX, offsetY, showOutline, isDarkCanvas, baseScale, scaleFactor, lockupOrientation]);

  const processFile = useCallback(async (file: File) => {
    const state = useLogoStore.getState();
    setUI({ isProcessing: true });
    try {
      const fileType = file.type;
      if (fileType === 'image/svg+xml' || file.name.endsWith('.svg')) {
        const svgText = await file.text();
        const bounds = parseSVGBounds(svgText);
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, partnerAreaPoints, partnerAreaCenter, 0, 0);
        setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2]);
        setLogoData(svgText, 'svg');
        setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
        setInitialTransform({ scale, offsetX, offsetY });
      } else if (fileType.startsWith('image/')) {
        const img = await loadImageFromFile(file);
        const { canvas, bounds } = await getAlphaTightBounds(img);
        const svgString = await vectorizeRasterImage(canvas);
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, partnerAreaPoints, partnerAreaCenter, 0, 0);
        setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2]);
        setLogoData(svgString, 'raster');
        setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
        setInitialTransform({ scale, offsetX, offsetY });
      }
      setLogoFile(file);
    } finally {
      setUI({ isProcessing: false });
    }
  }, [partnerAreaPoints, partnerAreaCenter, setLogoData, setTransform, setUI, setInitialTransform, setLogoFile]);

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
      className="relative w-full h-full rounded-lg border-dashed border-2 border-border overflow-hidden p-5"
      style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
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


