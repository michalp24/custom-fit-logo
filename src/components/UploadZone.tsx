import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Image, FileImage } from 'lucide-react';
import { useLogoStore } from '@/store/logoStore';
import { loadImageFromFile, parseSVGBounds, getAlphaTightBounds, vectorizeRasterImage, calculateFitScale } from '@/utils/logoProcessor';
import { DEFAULT_MASK_POINTS } from '@/utils/maskData';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function UploadZone() {
  const { setLogoFile, setLogoData, setTransform, setUI } = useLogoStore();
  const { toast } = useToast();

  const processFile = useCallback(async (file: File) => {
    const state = useLogoStore.getState();
    setUI({ isProcessing: true });
    
    try {
      const fileType = file.type;
      
      if (fileType === 'image/svg+xml' || file.name.endsWith('.svg')) {
        // Handle SVG
        const svgText = await file.text();
        const bounds = parseSVGBounds(svgText);
        const { scale, offsetX, offsetY } = calculateFitScale(bounds, DEFAULT_MASK_POINTS, state.padding);
        
        setLogoData(svgText, 'svg');
        setTransform({ scale, offsetX, offsetY });
        
        toast({
          title: "SVG loaded successfully",
          description: "Logo has been fitted inside the outline."
        });
      } else if (fileType.startsWith('image/')) {
        // Handle raster images (PNG, JPG, etc.)
        const img = await loadImageFromFile(file);
        const { canvas, bounds } = await getAlphaTightBounds(img);
        const svgString = await vectorizeRasterImage(canvas);
        
        const { scale, offsetX, offsetY } = calculateFitScale(bounds, DEFAULT_MASK_POINTS, state.padding);
        
        setLogoData(svgString, 'raster');
        setTransform({ scale, offsetX, offsetY });
        
        toast({
          title: "Image vectorized successfully",
          description: "Logo has been converted to SVG and fitted inside the outline."
        });
      } else {
        throw new Error('Unsupported file type. Please use SVG, PNG, or JPG.');
      }
      
      setLogoFile(file);
    } catch (error) {
      console.error('Error processing file:', error);
      toast({
        title: "Error processing file",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive"
      });
    } finally {
      setUI({ isProcessing: false });
    }
  }, [setLogoFile, setLogoData, setTransform, setUI, toast]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, [processFile]);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      'image/svg+xml': ['.svg'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    multiple: false,
    noClick: true,
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${isDragActive 
            ? 'border-primary bg-primary/5 scale-105' 
            : 'border-border hover:border-primary/50 hover:bg-primary/5'
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          <div className="p-4 rounded-full bg-primary/10">
            {isDragActive ? (
              <Upload className="h-8 w-8 text-primary animate-bounce" />
            ) : (
              <Image className="h-8 w-8 text-primary" />
            )}
          </div>
          
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">
              {isDragActive ? 'Drop your logo here' : 'Upload your logo'}
            </h3>
            <p className="text-sm text-muted-foreground">
              Supports SVG, PNG, and JPG files
            </p>
          </div>
          
          <Button onClick={open} variant="outline" className="mt-4">
            <FileImage className="mr-2 h-4 w-4" />
            Choose File
          </Button>
        </div>
      </div>
      
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• SVG files will be parsed for precise geometry</p>
        <p>• Raster images will be vectorized automatically</p>
        <p>• Logo will be auto-fitted inside the pink outline</p>
      </div>
    </div>
  );
}