import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LogoPreview } from '@/components/LogoPreview';
import { LockupPreview } from '@/components/LockupPreview';
import { ControlPanel } from '@/components/ControlPanel';
import { useLogoStore } from '@/store/logoStore';

export default function LogoExporter() {
  const { setTransform, refit, lockupOrientation, setUI } = useLogoStore();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const logoMode = params.get('logo') || 'default';
  const isLockup = logoMode === 'partner';
  const isDefault = logoMode !== 'partner';

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
          setTransform({ offsetY: useLogoStore.getState().offsetY - nudgeAmount });
          break;
        case 'ArrowDown':
          setTransform({ offsetY: useLogoStore.getState().offsetY + nudgeAmount });
          break;
        case 'ArrowLeft':
          setTransform({ offsetX: useLogoStore.getState().offsetX - nudgeAmount });
          break;
        case 'ArrowRight':
          setTransform({ offsetX: useLogoStore.getState().offsetX + nudgeAmount });
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
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
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
                  Export logos in SVG, PNG, and JPG formats using our custom layout
                </p>
              </div>
            </div>
            <nav aria-label="Primary navigation">
              <ul className="flex items-center gap-6">
                <li>
                  <a
                    href="?logo=default"
                    className={`text-sm font-semibold ${isDefault ? 'text-white' : 'text-[#898989] hover:text-white'}`}
                    aria-current={isDefault ? 'page' : undefined}
                  >
                    Logo Template
                  </a>
                </li>
                <li>
                  <a
                    href="?logo=partner"
                    className={`text-sm font-semibold ${!isDefault ? 'text-white' : 'text-[#898989] hover:text-white'}`}
                    aria-current={!isDefault ? 'page' : undefined}
                  >
                    Partner Lockup
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-4 lg:py-8 flex-1 min-h-0">
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 h-full">
          {/* Preview Area (65% width) */}
          <div className="flex-1 lg:w-[65%] min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Preview</h2>
              {isLockup && (
                <div className="relative">
                  <ul className="relative flex flex-wrap px-1.5 py-1.5 list-none rounded-md" style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)' }} role="list">
                    <li className="z-30 flex-auto text-center">
                      <button
                        className={`z-30 flex items-center justify-center w-full px-3 py-2 text-sm mb-0 transition-all ease-in-out border-0 rounded-md cursor-pointer ${
                          lockupOrientation === 'vertical'
                            ? 'text-white'
                            : 'text-[#898989] hover:text-white'
                        }`}
                        style={{
                          backgroundColor: lockupOrientation === 'vertical' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                          border: lockupOrientation === 'vertical' ? '1px solid #313131' : '1px solid transparent'
                        }}
                        onClick={() => setUI({ lockupOrientation: 'vertical' })}
                        role="tab"
                        aria-selected={lockupOrientation === 'vertical'}
                      >
                        Vertical
                      </button>
                    </li>
                    <li className="z-30 flex-auto text-center">
                      <button
                        className={`z-30 flex items-center justify-center w-full px-3 py-2 mb-0 text-sm transition-all ease-in-out border-0 rounded-lg cursor-pointer ${
                          lockupOrientation === 'horizontal'
                            ? 'text-white'
                            : 'text-[#898989] hover:text-white'
                        }`}
                        style={{
                          backgroundColor: lockupOrientation === 'horizontal' ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
                          border: lockupOrientation === 'horizontal' ? '1px solid #313131' : '1px solid transparent'
                        }}
                        onClick={() => setUI({ lockupOrientation: 'horizontal' })}
                        role="tab"
                        aria-selected={lockupOrientation === 'horizontal'}
                      >
                        Horizontal
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
            <div className="flex-1 min-h-[250px] lg:min-h-[300px] overflow-hidden">
              {isLockup ? <LockupPreview /> : <LogoPreview />}
            </div>
          </div>

          {/* Control Panel (35% width) */}
          <div className="flex-shrink-0 lg:w-[35%] min-h-0">
            <div className="h-full overflow-y-auto">
              <ControlPanel isLockupPage={isLockup} />
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card flex-shrink-0">
        <div className="container mx-auto px-6 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left side - Feedback text */}
            <div className="flex-1 text-sm text-muted-foreground space-y-4">
              <p>
                If you have any feedback, notice documentation is not aligned to current implementations/standards or have any ideas reach out to{' '}
                <span className="text-primary font-medium">@web_design_system_team</span> in Slack or reach out in the{' '}
                <span className="text-primary font-medium">#web-design-system-help</span> channel for any clarification.
              </p>
              <p>
                For any type of request regarding the design system, design files, addressing bugs, or any updates to this site please submit a request.
              </p>
            </div>
            
            {/* Right side - Links */}
            <div className="lg:w-auto">
              <div className="flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-white mb-2">Resources</h3>
                <a
                  href="https://brand.nvidia.com/d/UKVz9aA18m6Q"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#898989] hover:text-white transition-colors"
                >
                  NVIDIA Web Design System
                </a>
                <a
                  href="https://brand.nvidia.com/d/9M9wySQgZT2X/n-a?#/nvidia-logo/logo-quick-start-guideline/co-branding-layout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#898989] hover:text-white transition-colors"
                >
                  Co-branding Guidelines
                </a>
                <a
                  href="https://author.nvidia.com/assets.html/content/dam/logos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#898989] hover:text-white transition-colors"
                >
                  Logo DAM (VPN Required)
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}