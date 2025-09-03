import { Download, Target, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { useLogoStore } from '@/store/logoStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MASK_FILL_PATH, MASK_CENTER } from '@/utils/mask';
interface ControlPanelProps {
  isLockupPage?: boolean;
}

export function ControlPanel({ isLockupPage = false }: ControlPanelProps) {
  const {
    logoData,
    scale,
    offsetX,
    offsetY,
    padding,
    showOutline,
    showCanvas,
    isDarkCanvas,
    baseScale,
    scaleFactor,
    setTransform,
    setUI,
    center,
    reset,
    refit
  } = useLogoStore();
  const {
    toast
  } = useToast();
  const handleExport = () => {
    if (isLockupPage) {
      // Export full lockup canvas
      exportLockupCanvas();
    } else {
      // Export single logo
      exportSingleLogo();
    }
  };

  const exportSingleLogo = async () => {
    if (!logoData) {
      toast({
        title: "No logo to export",
        description: "Please upload a logo first.",
        variant: "destructive"
      });
      return;
    }
    try {
      // Create clean SVG with only the transformed logo
      const parser = new DOMParser();
      const logoDoc = parser.parseFromString(logoData, 'image/svg+xml');
      const logoSvg = logoDoc.documentElement;

      // Create new SVG for export
      const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      exportSvg.setAttribute('viewBox', '0 0 1250 700');
      exportSvg.setAttribute('width', '1250');
      exportSvg.setAttribute('height', '700');
      exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Create group with transforms (matching preview logic)
      const { parseSVGBounds } = await import('../utils/logoProcessor');
      const logoBounds = parseSVGBounds(logoData);
      const logoCenterX = logoBounds.minX + logoBounds.width / 2;
      const logoCenterY = logoBounds.minY + logoBounds.height / 2;
      
      const logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const transforms = [];
      
      // Apply transforms in same order as preview
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

      // Copy logo elements
      const logoElements = logoSvg.children;
      for (let i = 0; i < logoElements.length; i++) {
        const element = logoElements[i].cloneNode(true) as Element;
        logoGroup.appendChild(element);
      }
      exportSvg.appendChild(logoGroup);

      // Create and download the file
      const svgString = new XMLSerializer().serializeToString(exportSvg);
      const blob = new Blob([svgString], {
        type: 'image/svg+xml'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logo-in-mask.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Export successful",
        description: "Your fitted logo has been exported as SVG."
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your logo.",
        variant: "destructive"
      });
    }
  };

  const exportLockupCanvas = async () => {
    try {
      // Create full lockup canvas SVG
      const CANVAS_WIDTH = 1920;
      const CANVAS_HEIGHT = 1080;
      const SEPARATOR_X = CANVAS_WIDTH / 2;
      const SEPARATOR_WIDTH = 8;
      const RIGHT_PADDING = 120;
      const TOP_BOTTOM_PADDING = 160;

      const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      exportSvg.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);
      exportSvg.setAttribute('width', String(CANVAS_WIDTH));
      exportSvg.setAttribute('height', String(CANVAS_HEIGHT));
      exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Background
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', '0');
      bgRect.setAttribute('y', '0');
      bgRect.setAttribute('width', String(CANVAS_WIDTH));
      bgRect.setAttribute('height', String(CANVAS_HEIGHT));
      bgRect.setAttribute('fill', isDarkCanvas ? '#000000' : '#ffffff');
      exportSvg.appendChild(bgRect);

      // Left area for NVIDIA logo
      const leftAreaX = RIGHT_PADDING;
      const leftAreaY = TOP_BOTTOM_PADDING;
      const leftAreaWidth = SEPARATOR_X - RIGHT_PADDING * 2;
      const leftAreaHeight = CANVAS_HEIGHT - TOP_BOTTOM_PADDING * 2;
      const LOGO_PADDING = 120;

      // Load and embed NVIDIA logo
      try {
        const logoPath = isDarkCanvas ? '/nvidia-logo-dark.svg' : '/nvidia-logo.svg';
        const response = await fetch(logoPath);
        const logoSvgText = await response.text();
        const parser = new DOMParser();
        const logoDoc = parser.parseFromString(logoSvgText, 'image/svg+xml');
        const logoSvg = logoDoc.documentElement;

        // Create group for NVIDIA logo with proper positioning and size limit
        const nvidiaGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const availableWidth = leftAreaWidth - LOGO_PADDING * 2;
        const availableHeight = leftAreaHeight - LOGO_PADDING * 2;
        
        // NVIDIA logo actual dimensions are 480x372
        const logoActualWidth = 480;
        const logoActualHeight = 372;
        
        // Calculate scale to fit within available space and 478px max width limit
        const maxAllowedWidth = Math.min(478, availableWidth);
        const scaleX = maxAllowedWidth / logoActualWidth;
        const scaleY = availableHeight / logoActualHeight;
        const finalScale = Math.min(scaleX, scaleY);
        
        // Center the logo within the available space
        const scaledWidth = logoActualWidth * finalScale;
        const scaledHeight = logoActualHeight * finalScale;
        const centerOffsetX = (availableWidth - scaledWidth) / 2;
        const centerOffsetY = (availableHeight - scaledHeight) / 2;
        
        const nvidiaTransform = `translate(${leftAreaX + LOGO_PADDING + centerOffsetX}, ${leftAreaY + LOGO_PADDING + centerOffsetY}) scale(${finalScale})`;
        nvidiaGroup.setAttribute('transform', nvidiaTransform);

        // Copy NVIDIA logo elements
        const nvidiaElements = logoSvg.children;
        for (let i = 0; i < nvidiaElements.length; i++) {
          const element = nvidiaElements[i].cloneNode(true) as Element;
          nvidiaGroup.appendChild(element);
        }
        exportSvg.appendChild(nvidiaGroup);
      } catch (error) {
        console.warn('Could not load NVIDIA logo for export:', error);
      }

      // Separator
      const separatorRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      separatorRect.setAttribute('x', String(SEPARATOR_X - SEPARATOR_WIDTH / 2));
      separatorRect.setAttribute('y', String((CANVAS_HEIGHT - 550) / 2));
      separatorRect.setAttribute('width', String(SEPARATOR_WIDTH));
      separatorRect.setAttribute('height', '550');
      separatorRect.setAttribute('fill', isDarkCanvas ? '#333333' : '#cccccc');
      exportSvg.appendChild(separatorRect);

      // Partner logo (if exists)
      if (logoData) {
        const { parseSVGBounds } = await import('../utils/logoProcessor');
        const parser = new DOMParser();
        const logoDoc = parser.parseFromString(logoData, 'image/svg+xml');
        const logoSvg = logoDoc.documentElement;
        const logoBounds = parseSVGBounds(logoData);
        const logoCenterX = logoBounds.minX + logoBounds.width / 2;
        const logoCenterY = logoBounds.minY + logoBounds.height / 2;

        // Create group for partner logo with transforms (matching preview logic)
        const logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const transforms = [];
        
        // Apply transforms in same order as preview
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

        // Copy partner logo elements
        const logoElements = logoSvg.children;
        for (let i = 0; i < logoElements.length; i++) {
          const element = logoElements[i].cloneNode(true) as Element;
          logoGroup.appendChild(element);
        }
        exportSvg.appendChild(logoGroup);
      }

      // Create and download the file
      const svgString = new XMLSerializer().serializeToString(exportSvg);
      const blob = new Blob([svgString], {
        type: 'image/svg+xml'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'logo-lockup.svg';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Export successful",
        description: "Your logo lockup has been exported as SVG."
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your logo lockup.",
        variant: "destructive"
      });
    }
  };
  const handleNudge = (direction: 'up' | 'down' | 'left' | 'right', amount: number = 1) => {
    const newOffset = {
      offsetX: offsetX + (direction === 'left' ? -amount : direction === 'right' ? amount : 0),
      offsetY: offsetY + (direction === 'up' ? -amount : direction === 'down' ? amount : 0)
    };
    setTransform(newOffset);
  };
  return <div className="rounded-lg border border-border p-6 space-y-6 bg-[#0c0c0c]">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Transform Controls</h3>
        
        {/* Scale Slider */}
        <div className="space-y-2">
          <Label htmlFor="scale">Scale: {Math.round((scaleFactor || 1) * 100)}%</Label>
          <Slider
            id="scale"
            min={0}
            max={200}
            step={1}
            value={[Math.round((scaleFactor || 1) * 100)]}
            onValueChange={([value]) => setTransform({ scaleFactor: value / 100 })}
            className="w-full"
          />
        </div>

        {/* Position Controls */}
        <div className="space-y-2">
          <Label>Position (X: {offsetX.toFixed(0)}, Y: {offsetY.toFixed(0)})</Label>
          <div className="grid grid-cols-3 gap-2">
            <div></div>
            <Button variant="outline" size="sm" onClick={() => handleNudge('up', 5)} className="text-xs">
              ↑
            </Button>
            <div></div>
            
            <Button variant="outline" size="sm" onClick={() => handleNudge('left', 5)} className="text-xs">
              ←
            </Button>
            <Button variant="outline" size="sm" onClick={center} className="text-xs">
              Center
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleNudge('right', 5)} className="text-xs">
              →
            </Button>
            
            <div></div>
            <Button variant="outline" size="sm" onClick={() => handleNudge('down', 5)} className="text-xs">
              ↓
            </Button>
            <div></div>
          </div>
        </div>
      </div>

      <Separator />

      {/* View Options (moved into actions) */}
      <div className="space-y-3">
        {isLockupPage ? (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" size="sm" onClick={() => setUI({
            showOutline: !showOutline
          })} className="w-full justify-center text-center nv-button--kind-secondary">
              {showOutline ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
              Show Outline
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUI({ isDarkCanvas: !isDarkCanvas })}
              className="w-full justify-center text-center nv-button--kind-secondary"
            >
              {isDarkCanvas ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {isDarkCanvas ? 'Light Theme' : 'Dark Theme'}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Button variant="ghost" size="sm" onClick={() => setUI({
            showOutline: !showOutline
          })} className="w-full justify-center text-center nv-button--kind-secondary">
              {showOutline ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
              Show Outline
            </Button>
            
            <Button variant="ghost" size="sm" onClick={() => setUI({
            showCanvas: !showCanvas
          })} className="w-full justify-center text-center nv-button--kind-secondary">
              {showCanvas ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
              Show Canvas
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUI({ isDarkCanvas: !isDarkCanvas })}
              className="w-full justify-center text-center nv-button--kind-secondary col-span-2"
            >
              {isDarkCanvas ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {isDarkCanvas ? 'Light Theme' : 'Dark Theme'}
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3">
          <Button onClick={handleExport} disabled={!logoData} className="w-full text-neutral-950">
            <Download className="mr-2 h-4 w-4" />
            Export SVG
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
        <p className="font-medium">Keyboard Shortcuts:</p>
        <p>Arrow keys: Nudge 1px (Shift: 10px)</p>

      </div>
    </div>;
}