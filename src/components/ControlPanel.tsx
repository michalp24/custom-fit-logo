import { exportLogo } from '@/utils/renderLogo';
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
export function ControlPanel({ isLockupPage = false }: ControlPanelProps) {
  const {
    isProcessing,
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
    logoOrder,
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
  
  const [isExporting, setIsExporting] = useState(false);
  const handleConfirmExport = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const filename = fileName.trim() || 'logo';
      const blob = await exportLogo(useLogoStore.getState(), exportFormat);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.${exportFormat === 'png-bg' ? 'png' : exportFormat}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setShowExportModal(false);
      toast({ title: 'Export successful' });
    } catch (error) {
      toast({ title: 'Export failed', description: error instanceof Error ? error.message : 'Please try again.', variant: 'destructive' });
    } finally { setIsExporting(false); }
  };

  const handleNudge = (direction: 'up' | 'down' | 'left' | 'right', amount: number = 1) => {
    const deltaX = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
    const deltaY = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
    
    const current = useLogoStore.getState();
    setTransform({
      offsetX: current.offsetX + deltaX,
      offsetY: current.offsetY + deltaY
    });
  };
  return <div className="rounded-lg border border-border p-6 space-y-6 bg-[#0c0c0c]">
      {/* Upload Confirmation / Upload Button */}
      {logoFile ? (
        <div className="bg-[#1a1a1a] border border-[#333333] rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-[#2a2a2a] border border-[#444444] rounded-lg flex items-center justify-center overflow-hidden">
              {logoData && (
                <img className="w-10 h-10 object-contain" alt="Uploaded logo"
                  src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoData)}`} />
              )}
            </div>
            <div>
              <h4 className="text-sm font-medium text-white break-all">{logoFile.name}</h4>
              <p className="text-xs text-gray-400">
                {logoFile.name.split('.').pop()?.toUpperCase()} • {(logoFile.size / 1024).toFixed(1)}KB
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
            accept=".svg,.png,.jpg,.jpeg"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
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
            <div className="text-xs text-gray-400">Accepted files: SVG, PNG, or JPG</div>
          </label>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Transform Controls</h3>
        
        {/* Scale Slider */}
        <div className="space-y-2">
          <Label htmlFor="scale">Scale: {Math.round(scaleFactor * 100)}%</Label>
          <Slider
            id="scale"
            min={1}
            max={250}
            step={1}
            value={[Math.round(scaleFactor * 100)]}
            onValueChange={([value]) => setTransform({ scaleFactor: value / 100 })}
            className="w-full"
          />
        </div>

        {/* Logo Order Toggle (only for lockup page) */}
        {isLockupPage && (
        <div className="space-y-2">
            <Label>Logo Order</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant={logoOrder === 'nvidia-left' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUI({ logoOrder: 'nvidia-left' })}
                className="text-xs"
              >
                NVIDIA Left
              </Button>
              <Button
                variant={logoOrder === 'nvidia-right' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setUI({ logoOrder: 'nvidia-right' })}
                className="text-xs"
              >
                NVIDIA Right
              </Button>
            </div>
        </div>
        )}

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
          <Button onClick={handleExport} disabled={!logoData || isProcessing || isExporting} className="w-full text-neutral-950">
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
                  <SelectItem value="svg">SVG</SelectItem>
                  <SelectItem value="png">PNG (Transparent)</SelectItem>
                  <SelectItem value="png-bg">PNG (with Background)</SelectItem>
                  <SelectItem value="jpg">JPG (with Background)</SelectItem>
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
            <Button disabled={isExporting || isProcessing} onClick={handleConfirmExport} className="text-neutral-950">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>;
}