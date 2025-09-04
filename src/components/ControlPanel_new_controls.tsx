import { Download, Target, Eye, EyeOff, Sun, Moon, ChevronDown } from 'lucide-react';
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
    refit
  } = useLogoStore();

  const { toast } = useToast();
  const [showExportModal, setShowExportModal] = useState(false);
  const [fileName, setFileName] = useState('');
  const [exportFormat, setExportFormat] = useState('svg');

  const handleExport = () => {
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
      // Use getSVGDimensions instead of parseSVGBounds for consistent bounds
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
        const clonedElement = logoElements[i].cloneNode(true);
        logoGroup.appendChild(clonedElement);
      }

      exportSvg.appendChild(logoGroup);

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
    if (!logoData) return;

    try {
      const parser = new DOMParser();
      
      // Canvas dimensions
      const CANVAS_WIDTH = 1920;
      const CANVAS_HEIGHT = 1080;
      const SEPARATOR_WIDTH = 8;
      const PADDING = 50;
      const TOP_BOTTOM_PADDING = 50;
      const RIGHT_PADDING = 50;
      
      const isHorizontal = lockupOrientation === 'horizontal';

      // Create export SVG
      const exportSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      exportSvg.setAttribute('viewBox', `0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`);
      exportSvg.setAttribute('width', CANVAS_WIDTH.toString());
      exportSvg.setAttribute('height', CANVAS_HEIGHT.toString());
      exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Background rect
      const bgRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      bgRect.setAttribute('x', '0');
      bgRect.setAttribute('y', '0');
      bgRect.setAttribute('width', CANVAS_WIDTH.toString());
      bgRect.setAttribute('height', CANVAS_HEIGHT.toString());
      bgRect.setAttribute('fill', isDarkCanvas ? '#000000' : '#ffffff');
      exportSvg.appendChild(bgRect);

      // Calculate available space
      const availableWidth = CANVAS_WIDTH - RIGHT_PADDING * 2;
      const availableHeight = CANVAS_HEIGHT - TOP_BOTTOM_PADDING * 2;
      const separatorX = CANVAS_WIDTH / 2;
      const availableLeftWidth = separatorX - RIGHT_PADDING - SEPARATOR_WIDTH / 2;

      // Load and embed NVIDIA logo (choose based on orientation)
      const nvidiaLogoPath = isHorizontal
        ? (isDarkCanvas ? '/nvidia-logo-lcokup-dark.svg' : '/nvidia-logo-lockup.svg')
        : (isDarkCanvas ? '/nvidia-logo-dark.svg' : '/nvidia-logo.svg');

      const nvidiaLogoResponse = await fetch(nvidiaLogoPath);
      if (!nvidiaLogoResponse.ok) throw new Error(`Failed to load NVIDIA logo from ${nvidiaLogoPath}`);
      const nvidiaLogoSvgText = await nvidiaLogoResponse.text();
      const nvidiaLogoDoc = parser.parseFromString(nvidiaLogoSvgText, 'image/svg+xml');
      const nvidiaLogoSvg = nvidiaLogoDoc.documentElement;

      // Logo dimensions and scaling based on layout
      let actualNvidiaLogoWidth, actualNvidiaLogoHeight, maxAllowedWidth, nvidiaScale;

      if (isHorizontal) {
        actualNvidiaLogoWidth = 694; // From nvidia-logo-lockup.svg
        actualNvidiaLogoHeight = 133; // From nvidia-logo-lockup.svg
        maxAllowedWidth = 692; // Target 692px width for horizontal
        nvidiaScale = maxAllowedWidth / actualNvidiaLogoWidth;
      } else {
        actualNvidiaLogoWidth = 480; // From nvidia-logo.svg
        actualNvidiaLogoHeight = 372; // From nvidia-logo.svg
        maxAllowedWidth = Math.min(478, availableLeftWidth); // Max 478px width for vertical
        nvidiaScale = maxAllowedWidth / actualNvidiaLogoWidth;
      }

      const scaledNvidiaWidth = actualNvidiaLogoWidth * nvidiaScale;
      const scaledNvidiaHeight = actualNvidiaLogoHeight * nvidiaScale;

      const nvidiaOffsetX = RIGHT_PADDING + (availableLeftWidth - scaledNvidiaWidth) / 2;
      const nvidiaOffsetY = TOP_BOTTOM_PADDING + (availableHeight - scaledNvidiaHeight) / 2;

      const nvidiaLogoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      nvidiaLogoGroup.setAttribute('transform', `translate(${nvidiaOffsetX}, ${nvidiaOffsetY}) scale(${nvidiaScale})`);

      for (let i = 0; i < nvidiaLogoSvg.children.length; i++) {
        nvidiaLogoGroup.appendChild(nvidiaLogoSvg.children[i].cloneNode(true) as Element);
      }
      exportSvg.appendChild(nvidiaLogoGroup);

      // Add separator
      const separatorRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      const separatorHeight = isHorizontal ? 304 : 550;
      separatorRect.setAttribute('x', (separatorX - SEPARATOR_WIDTH / 2).toString());
      separatorRect.setAttribute('y', ((CANVAS_HEIGHT - separatorHeight) / 2).toString());
      separatorRect.setAttribute('width', SEPARATOR_WIDTH.toString());
      separatorRect.setAttribute('height', separatorHeight.toString());
      separatorRect.setAttribute('fill', isDarkCanvas ? '#333333' : '#cccccc');
      exportSvg.appendChild(separatorRect);

      // Add partner logo with transforms matching preview
      // Use getSVGDimensions instead of parseSVGBounds for consistent bounds
      const logoBounds = getSVGDimensions(logoData);
      const logoCenterX = logoBounds.minX + logoBounds.width / 2;
      const logoCenterY = logoBounds.minY + logoBounds.height / 2;

      const logoDoc = parser.parseFromString(logoData, 'image/svg+xml');
      const logoSvg = logoDoc.documentElement;

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
      for (let i = 0; i < logoSvg.children.length; i++) {
        logoGroup.appendChild(logoSvg.children[i].cloneNode(true) as Element);
      }

      exportSvg.appendChild(logoGroup);

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
        
        // For PNG, remove background rect to make transparent
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
        
        // For JPG, add white background; PNG stays transparent
        if (format === 'jpg') {
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
              a.download = `${filename}.${format}`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
              
              toast({
                title: "Export successful",
                description: `Your logo has been exported as ${format.toUpperCase()}.`
              });
            }
          }, `image/${format}`, 0.95);
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

  const handleNudge = (direction: 'up' | 'down' | 'left' | 'right') => {
    const nudgeAmount = 5;
    const currentState = useLogoStore.getState();
    
    switch (direction) {
      case 'up':
        setTransform({ offsetY: currentState.offsetY - nudgeAmount });
        break;
      case 'down':
        setTransform({ offsetY: currentState.offsetY + nudgeAmount });
        break;
      case 'left':
        setTransform({ offsetX: currentState.offsetX - nudgeAmount });
        break;
      case 'right':
        setTransform({ offsetX: currentState.offsetX + nudgeAmount });
        break;
    }
  };

  return (
    <div className="space-y-6">
      {/* Scale Control */}
      <div className="space-y-3">
        <Label htmlFor="scale">Scale</Label>
        <Slider
          id="scale"
          min={0}
          max={200}
          step={1}
          value={[scaleFactor * 100]}
          onValueChange={(value) => {
            const newScaleFactor = value[0] / 100;
            const newScale = baseScale * newScaleFactor;
            setTransform({ scaleFactor: newScaleFactor, scale: newScale });
          }}
          className="w-full"
        />
        <div className="text-sm text-muted-foreground text-center">
          {Math.round(scaleFactor * 100)}%
        </div>
      </div>

      <Separator />

      {/* Nudge Controls */}
      <div className="space-y-3">
        <Label>Position</Label>
        <div className="grid grid-cols-3 gap-2">
          <div></div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNudge('up')}
            className="aspect-square"
          >
            ↑
          </Button>
          <div></div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNudge('left')}
            className="aspect-square"
          >
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={center}
            className="aspect-square"
          >
            <Target className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNudge('right')}
            className="aspect-square"
          >
            →
          </Button>
          <div></div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleNudge('down')}
            className="aspect-square"
          >
            ↓
          </Button>
          <div></div>
        </div>
      </div>

      <Separator />

      {/* View Options */}
      <div className="space-y-3">
        <Label>View Options</Label>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            onClick={() => setUI({ showOutline: !showOutline })}
            className="nv-button--kind-secondary justify-center"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderColor: '#313131',
            }}
          >
            {showOutline ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showOutline ? 'Hide Outline' : 'Show Outline'}
          </Button>
          
          {!isLockupPage && (
            <Button
              variant="outline"
              onClick={() => setUI({ isDarkCanvas: !isDarkCanvas })}
              className="nv-button--kind-secondary justify-center"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderColor: '#313131',
              }}
            >
              {isDarkCanvas ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {isDarkCanvas ? 'Light Theme' : 'Dark Theme'}
            </Button>
          )}
          
          {isLockupPage && (
            <Button
              variant="outline"
              onClick={() => setUI({ isDarkCanvas: !isDarkCanvas })}
              className="nv-button--kind-secondary justify-center"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                borderColor: '#313131',
              }}
            >
              {isDarkCanvas ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {isDarkCanvas ? 'Light Theme' : 'Dark Theme'}
            </Button>
          )}
        </div>
      </div>

      <Separator />

      {/* Action Buttons */}
      <div className="space-y-3">
        <div className="flex flex-col gap-2">
          <Button
            onClick={refit}
            variant="outline"
            className="w-full"
          >
            Refit
          </Button>
          <Button
            onClick={reset}
            variant="outline"
            className="w-full"
          >
            Reset
          </Button>
          <Button
            onClick={handleExport}
            className="w-full text-neutral-950"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
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
                  <SelectItem value="jpg">JPG (White Background)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <p className="text-sm text-muted-foreground">
              File will be saved as: <strong>{fileName.trim() || (isLockupPage ? 'logo-lockup' : 'logo-in-mask')}.{exportFormat}</strong>
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
    </div>
  );
}
