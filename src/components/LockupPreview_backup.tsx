import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useLogoStore } from '@/store/logoStore';
import { loadImageFromFile, parseSVGBounds, getAlphaTightBounds, vectorizeRasterImage, fitIntoMask } from '@/utils/logoProcessor';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();
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
      
      // Validate file type - only allow SVG and PNG
      const isValidSVG = fileType === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
      const isValidPNG = fileType === 'image/png' || file.name.toLowerCase().endsWith('.png');
      
      if (!isValidSVG && !isValidPNG) {
        toast({
          title: "Invalid file type",
          description: "Please upload only SVG or PNG files.",
          variant: "destructive"
        });
        return;
      }
      
      if (isValidSVG) {
        const svgText = await file.text();
        const bounds = parseSVGBounds(svgText);
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, partnerAreaPoints, partnerAreaCenter, 0, 0);
        setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2]);
        setLogoData(svgText, 'svg');
        setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
        setInitialTransform({ scale, offsetX, offsetY });
      } else if (isValidPNG) {
        const img = await loadImageFromFile(file);
        const { canvas, bounds } = await getAlphaTightBounds(img);
        const svgString = await vectorizeRasterImage(canvas);
        
        // Parse the actual SVG to get its real viewBox/dimensions
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;
        const svgWidth = parseInt(svgElement.getAttribute('width') || '0');
        const svgHeight = parseInt(svgElement.getAttribute('height') || '0');
        
        // Use the actual SVG dimensions for fitting
        const svgBounds = {
          minX: 0,
          maxX: svgWidth,
          minY: 0,
          maxY: svgHeight,
          width: svgWidth,
          height: svgHeight
        };
        
        // Calculate scale to fit within partner area
        const scaleX = partnerArea.width / svgBounds.width;
        const scaleY = partnerArea.height / svgBounds.height;
        const scale = Math.min(scaleX, scaleY);
        
        // Use guide area center as the fixed reference point
        const guideCenterX = partnerArea.x + partnerArea.width / 2;
        const guideCenterY = partnerArea.y + partnerArea.height / 2;
        
        // Parse the SVG to find the actual visual bounds of the content
        const parser2 = new DOMParser();
        const svgDoc2 = parser2.parseFromString(svgString, 'image/svg+xml');
        const svgElement2 = svgDoc2.documentElement;
        
        // Get the bounding box of all visible content in the SVG
        let contentBounds = null;
        try {
          // Create a temporary SVG element to measure bounds
          const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          tempSvg.setAttribute('width', svgBounds.width.toString());
          tempSvg.setAttribute('height', svgBounds.height.toString());
          tempSvg.style.position = 'absolute';
          tempSvg.style.visibility = 'hidden';
          document.body.appendChild(tempSvg);
          
          // Clone and append the SVG content
          for (let i = 0; i < svgElement2.children.length; i++) {
            const clonedChild = svgElement2.children[i].cloneNode(true);
            tempSvg.appendChild(clonedChild);
          }
          
          // Get the bounding box of the content
          const bbox = tempSvg.getBBox();
          contentBounds = {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height,
            centerX: bbox.x + bbox.width / 2,
            centerY: bbox.y + bbox.height / 2
          };
          
          // Clean up
          document.body.removeChild(tempSvg);
        } catch (error) {
          console.warn('Could not calculate content bounds, using SVG center:', error);
          // Fallback to SVG dimensions center
          contentBounds = {
            x: 0,
            y: 0,
            width: svgBounds.width,
            height: svgBounds.height,
            centerX: svgBounds.width / 2,
            centerY: svgBounds.height / 2
          };
        }
        
        // Calculate offset to align content center with guide center
        const offsetX = guideCenterX - contentBounds.centerX;
        const offsetY = guideCenterY - contentBounds.centerY;
        
        setAnchor([contentBounds.centerX, contentBounds.centerY]);
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


