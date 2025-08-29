import { useEffect } from 'react';
import { UploadZone } from '@/components/UploadZone';
import { LogoPreview } from '@/components/LogoPreview';
import { ControlPanel } from '@/components/ControlPanel';
import { useLogoStore } from '@/store/logoStore';

export default function LogoExporter() {
  const { setTransform, refit } = useLogoStore();

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default if we're handling the key
      const isHandled = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'BracketLeft', 'BracketRight', 'KeyF'].includes(e.code);
      if (isHandled) {
        e.preventDefault();
      }

      const nudgeAmount = e.shiftKey ? 10 : 1;
      const rotateAmount = e.shiftKey ? 10 : 1;

      switch (e.code) {
        case 'ArrowUp':
          setTransform({ offsetY: -nudgeAmount });
          break;
        case 'ArrowDown':
          setTransform({ offsetY: nudgeAmount });
          break;
        case 'ArrowLeft':
          setTransform({ offsetX: -nudgeAmount });
          break;
        case 'ArrowRight':
          setTransform({ offsetX: nudgeAmount });
          break;
        case 'BracketLeft': // [
          setTransform({ rotation: -rotateAmount });
          break;
        case 'BracketRight': // ]
          setTransform({ rotation: rotateAmount });
          break;
        case 'KeyF':
          refit();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setTransform, refit]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-5 h-5 text-black"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7,10 12,15 17,10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Logo Exporter</h1>
              <p className="text-sm text-muted-foreground">
                Fit logos inside custom outlines and export clean SVGs
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-180px)]">
          {/* Upload Zone */}
          <div className="lg:col-span-1 space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Upload Logo</h2>
              <UploadZone />
            </div>
          </div>

          {/* Preview Area */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">Preview</h2>
            <div className="h-full min-h-[400px]">
              <LogoPreview />
            </div>
          </div>

          {/* Control Panel */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">Controls</h2>
            <ControlPanel />
          </div>
        </div>
      </main>
    </div>
  );
}