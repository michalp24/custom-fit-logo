import type React from 'react';
import { useCallback, useEffect, useRef } from 'react';
import { useLogoStore } from '@/store/logoStore';
import { loadImageFromFile, parseSVGBounds, getAlphaTightBounds, vectorizeRasterImage, fitIntoMask } from '@/utils/logoProcessor';
import { useToast } from '@/hooks/use-toast';

// Lockup canvas constants
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;
const SEPARATOR_WIDTH = 8;
const PADDING = 50;

// Partner logo area dimensions
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

// Helper function to extract SVG dimensions from vectorized SVG
function getSVGDimensions(svgString: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svg = doc.documentElement;
  
  const width = parseInt(svg.getAttribute('width') || '0');
  const height = parseInt(svg.getAttribute('height') || '0');
  
  return {
    minX: 0,
    maxX: width,
    minY: 0,
    maxY: height,
    width: width,
    height: height
  };
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
    isDarkCanvas,
    baseScale,
    scaleFactor,
    lockupOrientation,
    logoOrder,
  } = useLogoStore();
  const { setLogoFile, setLogoData, setTransform, setUI, setInitialTransform, setAnchor } = useLogoStore();

  // Calculate layout based on orientation and logo order
  const isHorizontal = lockupOrientation === 'horizontal';
  const isNvidiaLeft = logoOrder === 'nvidia-left';
  
  // Layout calculations
  let nvidiaArea, separatorConfig, partnerArea, partnerAreaCenter, partnerAreaPoints;
  
  if (isHorizontal) {
    // Horizontal layout: logos side by side with vertical separator
    const separatorX = CANVAS_WIDTH / 2;
    const leftAreaWidth = separatorX - PADDING * 2;
    const rightAreaXStart = separatorX + SEPARATOR_WIDTH + PADDING;
    const rightAreaWidth = CANVAS_WIDTH - rightAreaXStart - PADDING;
    
    if (isNvidiaLeft) {
      // NVIDIA left, partner right
      nvidiaArea = {
        x: PADDING,
        y: PADDING,
        width: leftAreaWidth,
        height: CANVAS_HEIGHT - PADDING * 2,
      };
      
      partnerArea = {
        x: rightAreaXStart + Math.max(0, (rightAreaWidth - HORIZONTAL_LOGO_WIDTH) / 2),
        y: PADDING + Math.max(0, (CANVAS_HEIGHT - PADDING * 2 - HORIZONTAL_LOGO_HEIGHT) / 2),
        width: HORIZONTAL_LOGO_WIDTH,
        height: HORIZONTAL_LOGO_HEIGHT,
      };
    } else {
      // Partner left, NVIDIA right
      partnerArea = {
        x: PADDING + Math.max(0, (leftAreaWidth - HORIZONTAL_LOGO_WIDTH) / 2),
        y: PADDING + Math.max(0, (CANVAS_HEIGHT - PADDING * 2 - HORIZONTAL_LOGO_HEIGHT) / 2),
        width: HORIZONTAL_LOGO_WIDTH,
        height: HORIZONTAL_LOGO_HEIGHT,
      };
      
      nvidiaArea = {
        x: rightAreaXStart,
        y: PADDING,
        width: rightAreaWidth,
        height: CANVAS_HEIGHT - PADDING * 2,
      };
    }
    
    separatorConfig = {
      x: separatorX - SEPARATOR_WIDTH / 2,
      y: (CANVAS_HEIGHT - 304) / 2, // 304px height for horizontal
      width: SEPARATOR_WIDTH,
      height: 304,
      isHorizontal: false,
    };
  } else {
    // Vertical layout: logos side by side with vertical separator
    const separatorX = CANVAS_WIDTH / 2;
    const leftAreaWidth = separatorX - PADDING * 2;
    const rightAreaXStart = separatorX + SEPARATOR_WIDTH + PADDING;
    const rightAreaWidth = CANVAS_WIDTH - rightAreaXStart - PADDING;
    
    if (isNvidiaLeft) {
      // NVIDIA left, partner right
      nvidiaArea = {
        x: PADDING,
        y: PADDING,
        width: leftAreaWidth,
        height: CANVAS_HEIGHT - PADDING * 2,
      };
      
      partnerArea = {
        x: rightAreaXStart + Math.max(0, (rightAreaWidth - VERTICAL_LOGO_WIDTH) / 2),
        y: PADDING + Math.max(0, (CANVAS_HEIGHT - PADDING * 2 - VERTICAL_LOGO_HEIGHT) / 2),
        width: VERTICAL_LOGO_WIDTH,
        height: VERTICAL_LOGO_HEIGHT,
      };
    } else {
      // Partner left, NVIDIA right
      partnerArea = {
        x: PADDING + Math.max(0, (leftAreaWidth - VERTICAL_LOGO_WIDTH) / 2),
        y: PADDING + Math.max(0, (CANVAS_HEIGHT - PADDING * 2 - VERTICAL_LOGO_HEIGHT) / 2),
        width: VERTICAL_LOGO_WIDTH,
        height: VERTICAL_LOGO_HEIGHT,
      };
      
      nvidiaArea = {
        x: rightAreaXStart,
        y: PADDING,
        width: rightAreaWidth,
        height: CANVAS_HEIGHT - PADDING * 2,
      };
    }
    
    separatorConfig = {
      x: separatorX - SEPARATOR_WIDTH / 2,
      y: (CANVAS_HEIGHT - 550) / 2, // 550px height for vertical
      width: SEPARATOR_WIDTH,
      height: 550,
      isHorizontal: false,
    };
  }
  
  partnerAreaCenter = [
    partnerArea.x + partnerArea.width / 2,
    partnerArea.y + partnerArea.height / 2,
  ];
  partnerAreaPoints = rectToPolygonPoints(partnerArea.x, partnerArea.y, partnerArea.width, partnerArea.height);

  // Debug: console.log('Main layout calculation - Logo Order:', logoOrder, 'Partner Area Center:', partnerAreaCenter);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = svgRef.current;

    // Clear SVG
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Background canvas rect (always visible, theme-aware)
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', CANVAS_WIDTH.toString());
    bgRect.setAttribute('height', CANVAS_HEIGHT.toString());
    bgRect.setAttribute('fill', isDarkCanvas ? '#000000' : '#ffffff');
    svg.appendChild(bgRect);

    // Add NVIDIA logo
    const nvidiaLogoImg = document.createElementNS('http://www.w3.org/2000/svg', 'image');
    const nvidiaLogoSrc = isHorizontal
      ? (isDarkCanvas ? '/nvidia-logo-lcokup-dark.svg' : '/nvidia-logo-lockup.svg')
      : (isDarkCanvas ? '/nvidia-logo-dark.svg' : '/nvidia-logo.svg');
    
    nvidiaLogoImg.setAttribute('href', nvidiaLogoSrc);

    // Calculate logo size to match export dimensions
    if (isHorizontal) {
      // Horizontal layout: target 692px width (matches export)
      const targetWidth = 692;
      const logoAspectRatio = 694 / 133; // lockup logo dimensions
      const targetHeight = targetWidth / logoAspectRatio;
      
      const logoX = nvidiaArea.x + (nvidiaArea.width - targetWidth) / 2;
      const logoY = nvidiaArea.y + (nvidiaArea.height - targetHeight) / 2;
      
      nvidiaLogoImg.setAttribute('x', String(logoX));
      nvidiaLogoImg.setAttribute('y', String(logoY));
      nvidiaLogoImg.setAttribute('width', String(targetWidth));
      nvidiaLogoImg.setAttribute('height', String(targetHeight));
    } else {
      // Vertical layout: target 477px width (matches export)
      const targetWidth = 477;
      const logoAspectRatio = 480 / 372; // regular logo dimensions
      const targetHeight = targetWidth / logoAspectRatio;
      
      const logoX = nvidiaArea.x + (nvidiaArea.width - targetWidth) / 2;
      const logoY = nvidiaArea.y + (nvidiaArea.height - targetHeight) / 2;
      
      nvidiaLogoImg.setAttribute('x', String(logoX));
      nvidiaLogoImg.setAttribute('y', String(logoY));
      nvidiaLogoImg.setAttribute('width', String(targetWidth));
      nvidiaLogoImg.setAttribute('height', String(targetHeight));
    }
    
    svg.appendChild(nvidiaLogoImg);

    // Add separator as HTML element within foreignObject for theme switching
    const separatorForeignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
    separatorForeignObject.setAttribute('x', separatorConfig.x.toString());
    separatorForeignObject.setAttribute('y', separatorConfig.y.toString());
    separatorForeignObject.setAttribute('width', separatorConfig.width.toString());
    separatorForeignObject.setAttribute('height', separatorConfig.height.toString());

    const separatorDiv = document.createElement('div');
    separatorDiv.style.width = '100%';
    separatorDiv.style.height = '100%';
    separatorDiv.style.backgroundColor = isDarkCanvas ? '#333333' : '#cccccc';
    separatorForeignObject.appendChild(separatorDiv);
    svg.appendChild(separatorForeignObject);

    // Add partner logo area outline if showOutline is true
    if (showOutline) {
      const outlineRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      outlineRect.setAttribute('x', partnerArea.x.toString());
      outlineRect.setAttribute('y', partnerArea.y.toString());
      outlineRect.setAttribute('width', partnerArea.width.toString());
      outlineRect.setAttribute('height', partnerArea.height.toString());
      outlineRect.setAttribute('fill', 'none');
      outlineRect.setAttribute('stroke', '#ff00ff');
      outlineRect.setAttribute('stroke-width', '2');
      outlineRect.setAttribute('stroke-dasharray', '5,5');
      svg.appendChild(outlineRect);
    }

    // Add placeholder text if no logo is loaded (2 lines, 36px font)
    if (!logoData) {
      const fontSize = 36;
      const lineSpacing = fontSize * 1.2; // 1.2x line height
      const textColor = "#ff00ff"; // Magenta color
      
      // First line: "Drop Logo or"
      const placeholderText1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      placeholderText1.setAttribute('x', partnerAreaCenter[0].toString());
      placeholderText1.setAttribute('y', (partnerAreaCenter[1] - lineSpacing / 2).toString());
      placeholderText1.setAttribute('text-anchor', 'middle');
      placeholderText1.setAttribute('dominant-baseline', 'middle');
      placeholderText1.setAttribute('fill', textColor);
      placeholderText1.setAttribute('font-size', fontSize.toString());
      placeholderText1.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
      placeholderText1.setAttribute('font-weight', '500');
      placeholderText1.textContent = 'Drop Logo or';
      svg.appendChild(placeholderText1);
      
      // Second line: "Upload from File"
      const placeholderText2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      placeholderText2.setAttribute('x', partnerAreaCenter[0].toString());
      placeholderText2.setAttribute('y', (partnerAreaCenter[1] + lineSpacing / 2).toString());
      placeholderText2.setAttribute('text-anchor', 'middle');
      placeholderText2.setAttribute('dominant-baseline', 'middle');
      placeholderText2.setAttribute('fill', textColor);
      placeholderText2.setAttribute('font-size', fontSize.toString());
      placeholderText2.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
      placeholderText2.setAttribute('font-weight', '500');
      placeholderText2.textContent = 'Upload from File';
      svg.appendChild(placeholderText2);
    }

    // Add uploaded logo if exists
    if (logoData) {
      const parser = new DOMParser();
      const logoDoc = parser.parseFromString(logoData, 'image/svg+xml');
      const logoSvg = logoDoc.documentElement;

      if (logoSvg && logoSvg.tagName === 'svg') {
        const logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        
        // Apply transforms in the correct order for scaling around logo center
        const transforms = [];
        
        // First, apply the base translation
        if (offsetX !== 0 || offsetY !== 0) {
          transforms.push(`translate(${offsetX}, ${offsetY})`);
        }
        
        // Then scale around the logo's own center (anchor point)
        if (scale !== 1) {
          const anchorX = useLogoStore.getState().anchor?.[0] || 0;
          const anchorY = useLogoStore.getState().anchor?.[1] || 0;
          transforms.push(`translate(${anchorX}, ${anchorY})`);
          transforms.push(`scale(${scale})`);
          transforms.push(`translate(${-anchorX}, ${-anchorY})`);
        }

        if (transforms.length > 0) {
          logoGroup.setAttribute('transform', transforms.join(' '));
        }

        // Copy all child elements from the logo SVG
        for (let i = 0; i < logoSvg.children.length; i++) {
          const clonedChild = logoSvg.children[i].cloneNode(true);
          logoGroup.appendChild(clonedChild);
        }

        svg.appendChild(logoGroup);
      }
    }
  }, [logoData, scale, offsetX, offsetY, showOutline, isDarkCanvas, baseScale, scaleFactor, lockupOrientation, logoOrder]);

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
        setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2] as [number, number]);
        setLogoData(svgText, 'svg');
        setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
        setInitialTransform({ scale, offsetX, offsetY });
      } else if (isValidPNG) {
        const img = await loadImageFromFile(file);
        const { canvas } = await getAlphaTightBounds(img);
        const svgString = await vectorizeRasterImage(canvas);
        
        // Use SVG dimensions directly instead of parseSVGBounds
        const bounds = getSVGDimensions(svgString);
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, partnerAreaPoints, partnerAreaCenter, 0, 0);
        setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2] as [number, number]);
        setLogoData(svgString, 'raster');
        setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
        setInitialTransform({ scale, offsetX, offsetY });
      }
      setLogoFile(file);
    } finally {
      setUI({ isProcessing: false });
    }
  }, [partnerAreaPoints, partnerAreaCenter, setLogoData, setTransform, setUI, setInitialTransform, setLogoFile, toast]);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const dt = event.dataTransfer;
    if (!dt?.files?.length) return;
    processFile(dt.files[0]);
  }, [processFile]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const onDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  // Listen for logo file selection from upload button
  useEffect(() => {
    const handleLogoFileSelected = (event: CustomEvent) => {
      const file = event.detail as File;
      if (file) {
        processFile(file);
      }
    };

    window.addEventListener('logoFileSelected', handleLogoFileSelected as EventListener);
    return () => {
      window.removeEventListener('logoFileSelected', handleLogoFileSelected as EventListener);
    };
  }, [processFile]);

  // Track previous logo order to detect changes and refit logo
  const prevLogoOrderRef = useRef(logoOrder);
  const prevOrientationRef = useRef(lockupOrientation);
  
  useEffect(() => {
    if (logoData && (prevLogoOrderRef.current !== logoOrder || prevOrientationRef.current !== lockupOrientation)) {
      // Debug: console.log('Logo order or orientation changed, refitting logo');
      // Debug: console.log('Previous order:', prevLogoOrderRef.current, 'New order:', logoOrder);
      // Debug: console.log('Previous orientation:', prevOrientationRef.current, 'New orientation:', lockupOrientation);
      
      // Refit logo to current partner area (use same coordinates as main rendering)
      try {
        let bounds;
        if (logoData.includes('<svg')) {
          // SVG logo
          bounds = parseSVGBounds(logoData);
        } else {
          // Raster logo (vectorized)
          bounds = getSVGDimensions(logoData);
        }
        
        // fitIntoMask is already imported at the top
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, partnerAreaPoints, partnerAreaCenter, 0, 0);
        // Debug: console.log('Refitting with new transforms:', { scale, offsetX, offsetY });
        // Debug: console.log('Using partner area center:', partnerAreaCenter);
        // Debug: console.log('Using partner area points:', partnerAreaPoints);
        
        setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2] as [number, number]);
        setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
        setInitialTransform({ scale, offsetX, offsetY });
      } catch (error) {
        console.error('Error refitting logo after layout change:', error);
      }
      
      // Update refs to current values
      prevLogoOrderRef.current = logoOrder;
      prevOrientationRef.current = lockupOrientation;
    }
  }, [logoData, logoOrder, lockupOrientation, partnerAreaPoints, partnerAreaCenter]);

  return (
    <div className="w-full h-full border-2 border-dashed border-border bg-background/10 rounded-lg p-5">
      <div
        className="w-full h-full flex items-center justify-center relative cursor-pointer"
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onClick={() => document.getElementById('lockup-file-input')?.click()}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="w-full h-full"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
        />
        
        <input
          id="lockup-file-input"
          type="file"
          accept=".svg,.png"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
