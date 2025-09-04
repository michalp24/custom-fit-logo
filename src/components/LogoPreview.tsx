import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { useLogoStore } from '@/store/logoStore';
import { MASK_OUTLINE_PATH, MASK_FILL_PATH, MASK_CENTER, MASK_POINTS } from '@/utils/mask';
import { loadImageFromFile, parseSVGBounds, getAlphaTightBounds, vectorizeRasterImage, fitIntoMask } from '@/utils/logoProcessor';
import { useToast } from '@/hooks/use-toast';

export function LogoPreview() {
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
    setAnchor 
  } = useLogoStore();
  const { setLogoFile, setLogoData, setTransform, setUI, setInitialTransform } = useLogoStore();

  useEffect(() => {
    if (!svgRef.current || !logoData) return;

    const svg = svgRef.current;
    
    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
    }

    // Background canvas rect (always visible, theme-aware)
    const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bgRect.setAttribute('x', '0');
    bgRect.setAttribute('y', '0');
    bgRect.setAttribute('width', '1250');
    bgRect.setAttribute('height', '700');
    bgRect.setAttribute('fill', isDarkCanvas ? '#000000' : '#ffffff');
    svg.appendChild(bgRect);

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
      
      // Get logo bounds and center for proper scaling anchor
      const logoBounds = parseSVGBounds(logoData);
      const logoCenterX = logoBounds.minX + logoBounds.width / 2;
      const logoCenterY = logoBounds.minY + logoBounds.height / 2;
      const [guideCenterX, guideCenterY] = MASK_CENTER;
      
      // Apply transforms in proper order for scaling around logo center
      // SVG transforms apply right-to-left, so we need:
      // 1. translate(offsetX, offsetY) - position adjustment 
      // 2. translate(logoCenterX, logoCenterY) - move to logo center
      // 3. scale(scale) - scale around logo center
      // 4. translate(-logoCenterX, -logoCenterY) - move back from logo center
      
      const transforms = [] as string[];
      
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
  }, [logoData, scale, offsetX, offsetY, showOutline, isDarkCanvas, baseScale, scaleFactor]);

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
        const { scale, offsetX, offsetY } = fitIntoMask(bounds, MASK_POINTS, MASK_CENTER, 0, 0);
        setLogoData(svgText, 'svg');
        setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
        setInitialTransform({ scale, offsetX, offsetY });
        setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2]);
      } else if (isValidPNG) {
        try {
          const img = await loadImageFromFile(file);
          const { canvas, bounds } = await getAlphaTightBounds(img);
          const svgString = await vectorizeRasterImage(canvas);
          const { scale, offsetX, offsetY } = fitIntoMask(bounds, MASK_POINTS, MASK_CENTER, 0, 0);
          setLogoData(svgString, 'raster');
          setTransform({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
          setInitialTransform({ scale, offsetX, offsetY });
          setAnchor([bounds.minX + bounds.width / 2, bounds.minY + bounds.height / 2]);
        } catch (pngError) {
          console.error('PNG processing error:', pngError);
          toast({
            title: "PNG processing failed",
            description: "There was an error processing your PNG file.",
            variant: "destructive"
          });
          return;
        }
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
    input.accept = '.svg,.png,image/svg+xml,image/png';
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) processFile(file);
    };
    input.click();
  }, [processFile]);

  return (
    <div className="relative w-full h-full rounded-lg border-dashed border-2 border-border overflow-hidden p-5" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }} onDrop={onDrop} onDragOver={onDragOver} onClick={onClickFile} role="button" aria-label="Drop or click to upload logo" tabIndex={0}>
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
              <div className="text-muted-foreground text-lg">Drop Logo or Upload from File</div>
              <div className="text-sm text-muted-foreground">
                Accepted files: SVG or PNG
              </div>
            </div>
        </div>
      )}
    </div>
  );
}