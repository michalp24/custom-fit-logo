import { useCallback, useEffect, useRef } from 'react';
import type React from 'react';
import { useLogoStore } from '@/store/logoStore';
import { MASK_OUTLINE_PATH, MASK_FILL_PATH, MASK_CENTER, MASK_POINTS } from '@/utils/mask';
import { loadImageFromFile, parseSVGBounds, getAlphaTightBounds, vectorizeRasterImage, fitIntoMask } from '@/utils/logoProcessor';
import { useToast } from '@/hooks/use-toast';

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
  } = useLogoStore();
  const { setLogoFile, setLogoData, setTransform, setUI, setInitialTransform, setAnchor } = useLogoStore();

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
    bgRect.setAttribute('width', '1250');
    bgRect.setAttribute('height', '700');
    bgRect.setAttribute('fill', isDarkCanvas ? '#000000' : '#ffffff');
    svg.appendChild(bgRect);

    // Add mask outline if showOutline is true
    if (showOutline) {
      const outlinePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      outlinePath.setAttribute('d', MASK_OUTLINE_PATH);
      outlinePath.setAttribute('fill', 'none');
      outlinePath.setAttribute('stroke', '#ff00ff');
      outlinePath.setAttribute('stroke-width', '2');
      outlinePath.setAttribute('stroke-dasharray', '5,5');
      svg.appendChild(outlinePath);
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
          const { canvas } = await getAlphaTightBounds(img);
          const svgString = await vectorizeRasterImage(canvas);
          
          // Use SVG dimensions directly instead of parseSVGBounds
          const bounds = getSVGDimensions(svgString);
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
  }, [setLogoData, setTransform, setUI, setLogoFile, toast]);

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
        onClick={() => document.getElementById('file-input')?.click()}
      >
        {!logoData ? (
          <div className="text-center text-muted-foreground">
            <p className="text-lg mb-2">Drop Logo or Upload from File</p>
            <p className="text-sm">Accepted files: SVG or PNG</p>
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="0 0 1250 700"
            className="w-full h-full"
            style={{ maxWidth: '100%', maxHeight: '100%' }}
          />
        )}
        
        <input
          id="file-input"
          type="file"
          accept=".svg,.png"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    </div>
  );
}
