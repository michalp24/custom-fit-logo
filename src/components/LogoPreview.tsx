import { useEffect, useRef } from 'react';
import { useLogoStore } from '@/store/logoStore';
import { MASK_OUTLINE_PATH, MASK_FILL_PATH, MASK_CENTER } from '@/utils/mask';

export function LogoPreview() {
  const svgRef = useRef<SVGSVGElement>(null);
  const { 
    logoData, 
    scale, 
    rotation, 
    offsetX, 
    offsetY, 
    showOutline, 
    showClip 
  } = useLogoStore();

  useEffect(() => {
    if (!svgRef.current || !logoData) return;

    const svg = svgRef.current;
    
    // Clear previous content
    while (svg.firstChild) {
      svg.removeChild(svg.firstChild);
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
      outlinePath.setAttribute('fill', showClip ? 'hsl(var(--outline-fill))' : 'none');
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

      // Apply clipping if enabled
      if (showClip) {
        logoGroup.setAttribute('clip-path', 'url(#maskClip)');
      }

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
  }, [logoData, scale, rotation, offsetX, offsetY, showOutline, showClip]);

  return (
    <div className="relative w-full h-full bg-canvas rounded-lg border border-border overflow-hidden">
      <svg
        ref={svgRef}
        viewBox="0 0 1250 700"
        className="w-full h-full"
        style={{ 
          background: 'hsl(var(--canvas))',
          boxSizing: 'border-box',
          display: 'block'
        }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* SVG content will be dynamically inserted here */}
      </svg>
      
      {!logoData && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-muted-foreground text-lg">Preview Area</div>
            <div className="text-sm text-muted-foreground">
              Upload a logo to see it fitted inside the outline
            </div>
          </div>
        </div>
      )}
    </div>
  );
}