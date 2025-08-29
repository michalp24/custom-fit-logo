import { Download, RotateCcw, Target, Eye, EyeOff } from 'lucide-react';
import { useLogoStore } from '@/store/logoStore';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { MASK_POINTS, polygonToPath } from '@/utils/mask';
import { parseSVGBounds, calculateFitScale } from '@/utils/logoProcessor';

export function ControlPanel() {
  const {
    logoData,
    scale,
    rotation,
    offsetX,
    offsetY,
    padding,
    showOutline,
    showClip,
    setTransform,
    setUI,
    reset,
    refit
  } = useLogoStore();
  
  const { toast } = useToast();

  const handleExport = () => {
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
      exportSvg.setAttribute('viewBox', '0 0 800 700');
      exportSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

      // Create group with transforms
      const logoGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      
      const transforms = [];
      if (offsetX !== 0 || offsetY !== 0) {
        transforms.push(`translate(${offsetX}, ${offsetY})`);
      }
      if (scale !== 1) {
        transforms.push(`scale(${scale})`);
      }
      if (rotation !== 0) {
        transforms.push(`rotate(${rotation}, 400, 350)`);
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
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
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

  const handleNudge = (direction: 'up' | 'down' | 'left' | 'right', amount: number = 1) => {
    const newOffset = {
      offsetX: offsetX + (direction === 'left' ? -amount : direction === 'right' ? amount : 0),
      offsetY: offsetY + (direction === 'up' ? -amount : direction === 'down' ? amount : 0)
    };
    setTransform(newOffset);
  };

  return (
    <div className="bg-controls rounded-lg border border-border p-6 space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Transform Controls</h3>
        
        {/* Padding Slider */}
        <div className="space-y-2">
          <Label htmlFor="padding">Padding: {padding}%</Label>
          <Slider
            id="padding"
            min={0}
            max={50}
            step={1}
            value={[padding]}
            onValueChange={([value]) => setTransform({ padding: value })}
            className="w-full"
          />
        </div>

        {/* Rotation Slider */}
        <div className="space-y-2">
          <Label htmlFor="rotation">Rotation: {rotation}°</Label>
          <Slider
            id="rotation"
            min={-180}
            max={180}
            step={1}
            value={[rotation]}
            onValueChange={([value]) => setTransform({ rotation: value })}
            className="w-full"
          />
        </div>

        {/* Position Controls */}
        <div className="space-y-2">
          <Label>Position (X: {offsetX.toFixed(0)}, Y: {offsetY.toFixed(0)})</Label>
          <div className="grid grid-cols-3 gap-2">
            <div></div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNudge('up', 5)}
              className="text-xs"
            >
              ↑
            </Button>
            <div></div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNudge('left', 5)}
              className="text-xs"
            >
              ←
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTransform({ offsetX: 200, offsetY: 175 })}
              className="text-xs"
            >
              Center
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNudge('right', 5)}
              className="text-xs"
            >
              →
            </Button>
            
            <div></div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNudge('down', 5)}
              className="text-xs"
            >
              ↓
            </Button>
            <div></div>
          </div>
        </div>
      </div>

      <Separator />

      {/* View Options */}
      <div className="space-y-3">
        <h4 className="font-medium">View Options</h4>
        <div className="flex flex-col space-y-2">
          <Button
            variant={showOutline ? "default" : "outline"}
            size="sm"
            onClick={() => setUI({ showOutline: !showOutline })}
            className="justify-start"
          >
            {showOutline ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
            Show Outline
          </Button>
          
          <Button
            variant={showClip ? "default" : "outline"}
            size="sm"
            onClick={() => setUI({ showClip: !showClip })}
            className="justify-start"
          >
            {showClip ? <Eye className="mr-2 h-4 w-4" /> : <EyeOff className="mr-2 h-4 w-4" />}
            Show Clip
          </Button>
        </div>
      </div>

      <Separator />

      {/* Action Buttons */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={refit}
            disabled={!logoData}
            className="w-full"
          >
            <Target className="mr-2 h-4 w-4" />
            Refit
          </Button>
          
          <Button
            variant="outline"
            onClick={reset}
            disabled={!logoData}
            className="w-full"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
          </Button>
        </div>
        
        <Button
          onClick={handleExport}
          disabled={!logoData}
          className="w-full"
        >
          <Download className="mr-2 h-4 w-4" />
          Export SVG
        </Button>
      </div>

      {/* Keyboard Shortcuts */}
      <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
        <p className="font-medium">Keyboard Shortcuts:</p>
        <p>Arrow keys: Nudge 1px (Shift: 10px)</p>
        <p>[ / ]: Rotate ±1° (Shift: ±10°)</p>
        <p>F: Refit logo</p>
      </div>
    </div>
  );
}