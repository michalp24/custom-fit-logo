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
        const { canvas } = await getAlphaTightBounds(img);
        const svgString = await vectorizeRasterImage(canvas);
        
        // Use the EXACT same approach as SVG processing
        const bounds = parseSVGBounds(svgString);
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
