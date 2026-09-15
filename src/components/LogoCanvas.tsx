import { useCallback, useEffect, useRef } from 'react';
import { useLogoStore } from '@/store/logoStore';
import { renderLogo } from '@/utils/renderLogo';
import { getLayout } from '@/utils/layout';
import { useToast } from '@/hooks/use-toast';

export function LogoCanvas({ partner }: { partner: boolean }) {
  const state = useLogoStore();
  const { setMode, loadLogo } = state;
  const host = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  useEffect(() => { setMode(partner); }, [partner, setMode]);
  useEffect(() => {
    if (!host.current) return;
    const svg = renderLogo(state, state.showOutline);
    svg.style.width = '100%'; svg.style.height = '100%';
    svg.setAttribute('role', state.logoData ? 'img' : 'group');
    svg.setAttribute('aria-label', partner ? 'Partner lockup preview' : 'Logo preview');
    if (!state.logoData) {
      // Use the same SVG coordinates as the guide, including viewport scaling.
      const { body } = getLayout(state.isPartner, state.lockupOrientation, state.logoOrder);
      const prompt = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
      for (const [name, value] of Object.entries(body)) prompt.setAttribute(name, String(value));
      prompt.setAttribute('data-upload-prompt', 'true');
      const button = document.createElement('button');
      button.type = 'button';
      button.disabled = state.isProcessing;
      button.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;border:0;padding:0;background:transparent;color:#ff00ff;font:500 36px/1.2 system-ui,sans-serif;cursor:pointer';
      button.setAttribute('aria-label', state.isProcessing ? 'Loading logo' : 'Drop logo or upload from file');
      for (const line of state.isProcessing ? ['Loading logo…'] : ['Drop logo or', 'upload from file']) {
        const text = document.createElement('span');
        text.textContent = line;
        button.appendChild(text);
      }
      button.onclick = () => input.current?.click();
      prompt.appendChild(button);
      svg.appendChild(prompt);
    }
    host.current.replaceChildren(svg);
  }, [state, partner]);
  const processFile = useCallback(async (file: File) => {
    try { await loadLogo(file); }
    catch (error) { toast({ title: 'Upload failed', description: error instanceof Error ? error.message : 'Could not read this file.', variant: 'destructive' }); }
  }, [loadLogo, toast]);
  useEffect(() => {
    const selected = (event: Event) => { const file = (event as CustomEvent<File>).detail; if (file) void processFile(file); };
    window.addEventListener('logoFileSelected', selected);
    return () => window.removeEventListener('logoFileSelected', selected);
  }, [processFile]);
  return <div style={{ aspectRatio: partner ? '1920 / 1080' : '1250 / 703' }} className="w-full border-2 border-dashed border-border rounded-lg p-5 relative"
    onDragOver={e => e.preventDefault()}
    onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) void processFile(file); }}>
    <div ref={host} className="w-full h-full" tabIndex={0} role="region" aria-label="Logo positioning canvas"
      onPointerDown={e => e.currentTarget.focus()} />
    <input ref={input} type="file" accept=".svg,.png,.jpg,.jpeg" className="hidden" onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void processFile(file); }} />
  </div>;
}
