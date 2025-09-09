import { Download, Target, Eye, EyeOff, Sun, Moon, ChevronDown, X } from 'lucide-react';
import { useState } from 'react';
import { useLogoStore } from '@/store/logoStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { MASK_FILL_PATH, MASK_CENTER } from '@/utils/mask';
interface ControlPanelProps {
  isLockupPage?: boolean;
}
// Helper function to get SVG dimensions (same as in preview components)
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


export function ControlPanel({ isLockupPage = false }: ControlPanelProps) {
  const {
    logoData,
    logoFile,
    scale,
    offsetX,
    offsetY,
    padding,
    showOutline,
    showCanvas,
    isDarkCanvas,
    baseScale,
    scaleFactor,
    lockupOrientation,
    setTransform,
    setUI,
    center,
    reset,
    refit,
    clearLogo
  } = useLogoStore();
  const { toast } = useToast();
  
  // Export modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [fileName, setFileName] = useState('');
  const [exportFormat, setExportFormat] = useState('svg');
  const handleExport = () => {
    if (!logoData && !isLockupPage) {
      toast({
        title: "No logo to export",
        description: "Please upload a logo first.",
        variant: "destructive"
      });
      return;
    }
    
    // Set default filename based on uploaded file name or page type
    let defaultName;
    if (logoFile) {
      // Use uploaded file name without extension
      const nameWithoutExt = logoFile.name.replace(/\.[^/.]+$/, '');
      if (isLockupPage) {
        // Use the correct naming convention for lockup
        const orientation = lockupOrientation === 'vertical' ? 'v' : 'h';
        const theme = isDarkCanvas ? 'on-dark' : 'on-light';
        defaultName = `nvidia-and-${nameWithoutExt}-partnership-${orientation}-${theme}`;
      } else {
        defaultName = nameWithoutExt;
      }
    } else {
      if (isLockupPage) {
        const orientation = lockupOrientation === 'vertical' ? 'v' : 'h';
        const theme = isDarkCanvas ? 'on-dark' : 'on-light';
        defaultName = `nvidia-and-CHANGE-partnership-${orientation}-${theme}`;
      } else {
        defaultName = 'logo-in-mask';
      }
    }
    setFileName(defaultName);
    setShowExportModal(true);
  };
  
  const handleConfirmExport = () => {
    const finalFileName = fileName.trim() || (isLockupPage ? 'logo-lockup' : 'logo-in-mask');
    setShowExportModal(false);
    
    if (isLockupPage) {
      exportLockupCanvas(finalFileName, exportFormat);
    } else {
      exportSingleLogo(finalFileName, exportFormat);
    }
  };

  const exportSingleLogo = async (filename: string, format: string = 'svg') => {
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
      const logoBounds = getSVGDimensions(logoData);
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
      await downloadSvgAsFormat(exportSvg, filename, format);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your logo.",
        variant: "destructive"
      });
    }
  };

  const exportLockupCanvas = async (filename: string, format: string = 'svg') => {
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

      // Load and embed NVIDIA logo (choose based on layout and theme)
      try {
        const { lockupOrientation } = useLogoStore.getState();
        const isHorizontal = lockupOrientation === 'horizontal';
        
        let logoPath;
        if (isHorizontal) {
          logoPath = isDarkCanvas ? '/nvidia-logo-lcokup-dark.svg' : '/nvidia-logo-lockup.svg';
        } else {
          logoPath = isDarkCanvas ? '/nvidia-logo-dark.svg' : '/nvidia-logo.svg';
        }
        
        const response = await fetch(logoPath);
        const logoSvgText = await response.text();
        const parser = new DOMParser();
        const logoDoc = parser.parseFromString(logoSvgText, 'image/svg+xml');
        const logoSvg = logoDoc.documentElement;

        // Create group for NVIDIA logo with proper positioning and size limit
        const nvidiaGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        const availableWidth = leftAreaWidth - LOGO_PADDING * 2;
        const availableHeight = leftAreaHeight - LOGO_PADDING * 2;
        
        // Logo dimensions and scaling based on layout
        const logoActualWidth = isHorizontal ? 694 : 480; // lockup is 694x133, regular is 480x372
        const logoActualHeight = isHorizontal ? 133 : 372;
        
        // For horizontal layout, target 692px width; for vertical, use 478px max
        let finalScale;
        if (isHorizontal) {
          // Target 692px width for horizontal lockup logo
          finalScale = 692 / logoActualWidth;
        } else {
          // Use original logic for vertical layout with 478px max
          const maxAllowedWidth = Math.min(478, availableWidth);
          const scaleX = maxAllowedWidth / logoActualWidth;
          const scaleY = availableHeight / logoActualHeight;
          finalScale = Math.min(scaleX, scaleY);
        }
        
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

      // Separator (responsive to orientation)
      const { lockupOrientation } = useLogoStore.getState();
      const isHorizontal = lockupOrientation === 'horizontal';
      const separatorHeight = isHorizontal ? 304 : 550; // 304px for horizontal, 550px for vertical
      
      const separatorRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      separatorRect.setAttribute('x', String(SEPARATOR_X - SEPARATOR_WIDTH / 2));
      separatorRect.setAttribute('y', String((CANVAS_HEIGHT - separatorHeight) / 2));
      separatorRect.setAttribute('width', String(SEPARATOR_WIDTH));
      separatorRect.setAttribute('height', String(separatorHeight));
      separatorRect.setAttribute('fill', isDarkCanvas ? '#333333' : '#cccccc');
      exportSvg.appendChild(separatorRect);

      // Partner logo (if exists)
      if (logoData) {
        const { parseSVGBounds } = await import('../utils/logoProcessor');
        const parser = new DOMParser();
        const logoDoc = parser.parseFromString(logoData, 'image/svg+xml');
        const logoSvg = logoDoc.documentElement;
        const logoBounds = getSVGDimensions(logoData);
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
      await downloadSvgAsFormat(exportSvg, filename, format);
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your logo lockup.",
        variant: "destructive"
      });
    }
  };

  // Helper function to download SVG in different formats
  const downloadSvgAsFormat = async (svgElement: SVGSVGElement, filename: string, format: string) => {
    try {
      if (format === 'svg') {
        // SVG export
        const svgString = new XMLSerializer().serializeToString(svgElement);
        const blob = new Blob([svgString], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.svg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast({
          title: "Export successful",
          description: `Your logo has been exported as SVG.`
        });
      } else {
        // PNG/JPG export - clone SVG and modify for format
        const svgClone = svgElement.cloneNode(true) as SVGSVGElement;
        
        // For PNG (transparent), remove background rect to make transparent
        if (format === 'png') {
          const bgRects = svgClone.querySelectorAll('rect[fill="#000000"], rect[fill="#ffffff"]');
          bgRects.forEach(rect => {
            const fill = rect.getAttribute('fill');
            if (fill === '#000000' || fill === '#ffffff') {
              rect.remove();
            }
          });
        }
        
        const svgString = new XMLSerializer().serializeToString(svgClone);
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const img = new Image();
        
        // Set canvas size to match SVG
        const svgWidth = parseInt(svgElement.getAttribute('width') || '1250');
        const svgHeight = parseInt(svgElement.getAttribute('height') || '700');
        canvas.width = svgWidth;
        canvas.height = svgHeight;
        
        // For JPG and PNG-BG, add white background; PNG stays transparent
        if (format === 'jpg' || format === 'png-bg') {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        
        img.onload = () => {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              const fileExtension = format === 'png-bg' ? 'png' : format;
              a.download = `${filename}.${fileExtension}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              
              const formatDisplay = format === 'png-bg' ? 'PNG (with Background)' : format.toUpperCase();
              toast({
                title: "Export successful",
                description: `Your logo has been exported as ${formatDisplay}.`
              });
            }
          }, `image/${format === 'png-bg' ? 'png' : format}`, 0.95);
        };
        
        // Convert SVG to data URL for canvas
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
        const svgUrl = URL.createObjectURL(svgBlob);
        img.src = svgUrl;
      }
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "There was an error exporting your logo.",
        variant: "destructive"
      });
    }
  };

  const handleNudge = (direction: 'up' | 'down' | 'left' | 'right', amount: number = 1) => {
    const deltaX = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
    const deltaY = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
    
    setTransform({
      offsetX: offsetX + deltaX,
      offsetY: offsetY + deltaY
    });
  };
  return <div className="rounded-lg border border-border p-6 space-y-6 bg-[#0c0c0c]">
      {/* Upload Confirmation / Upload Button */}
      {logoFile ? (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-[#2a2a2a] border border-[#444444] rounded-lg flex items-center justify-center overflow-hidden">
              {logoData && (
                <div 
                  className="w-10 h-10 flex items-center justify-center"
                  style={{
                    transform: 'scale(0.8)',
                    transformOrigin: 'center'
                  }}
                  dangerouslySetInnerHTML={{ __html: logoData }}
                />
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-white">{logoFile.name}</h4>
              <p className="text-xs text-gray-400">
                {logoFile.type === 'image/svg+xml' ? 'SVG' : 'PNG'} • {(logoFile.size / 1024).toFixed(1)}KB
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              clearLogo();
            }}
            className="h-8 w-8 p-0 hover:bg-[#333333] text-gray-400 hover:text-white"
            title="Remove logo"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 h-[80px] flex items-center justify-center">
          <input
            type="file"
            accept=".svg,.png"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                // This will be handled by the preview components
                window.dispatchEvent(new CustomEvent('logoFileSelected', { detail: file }));
              }
            }}
            className="hidden"
            id="upload-input"
          />
          <label
            htmlFor="upload-input"
            className="cursor-pointer text-center flex flex-col items-center justify-center space-y-1 hover:opacity-80 transition-opacity"
          >
            <div className="text-sm font-medium text-white">Upload from File</div>
            <div className="text-xs text-gray-400">Accepted files: SVG or PNG</div>
          </label>
        </div>
      )}

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
        )}
        <div className="grid grid-cols-1 gap-3">
          <Button onClick={handleExport} disabled={!logoData} className="w-full text-neutral-950">
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
        <p className="font-medium">Keyboard Shortcuts:</p>
        <p>Arrow keys: Nudge 1px (Shift: 10px)</p>
      </div>
      
      {/* Export Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Export {isLockupPage ? 'Logo Lockup' : 'Logo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="filename">File Name</Label>
              <Input
                id="filename"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder={isLockupPage ? 'logo-lockup' : 'logo-in-mask'}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="format">Export Format</Label>
              <Select value={exportFormat} onValueChange={setExportFormat}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select format" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="svg">SVG (Vector)</SelectItem>
                  <SelectItem value="png">PNG (Transparent)</SelectItem>
                  <SelectItem value="png-bg">PNG (with Background)</SelectItem>
                  <SelectItem value="jpg">JPG (White Background)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <p className="text-sm text-muted-foreground">
              File will be saved as: <strong>{fileName.trim() || (isLockupPage ? 'logo-lockup' : 'logo-in-mask')}.{exportFormat === 'png-bg' ? 'png' : exportFormat}</strong>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmExport} className="text-neutral-950">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}