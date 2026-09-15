import { constrainTemplate, fitTemplate } from '@/utils/templateFit';
import { create } from 'zustand';
import { getLayout, fitBody, type Rect } from '@/utils/layout';
import { normalizeSVG, parseSVGBounds, loadImageFromFile, getAlphaTightBounds } from '@/utils/logoProcessor';

export interface LogoState {
  bounds: Rect | null;
  isPartner: boolean;
  setMode: (partner: boolean) => void;
  loadLogo: (file: File) => Promise<void>;
  // Logo data
  logoFile: File | null;
  logoData: string | null;
  logoType: 'svg' | 'raster' | null;
  
  // Transform state
  scale: number;
  offsetX: number;
  offsetY: number;
  padding: number; // deprecated, kept for compatibility but not used
  baseScale: number; // baseline scale (fit-to-guide)
  scaleFactor: number; // 0.01 - 2.5 multiplier from UI slider
  anchor: [number, number] | null; // logo bounds center
  
  // UI state
  showOutline: boolean;
  showCanvas: boolean;
  isProcessing: boolean;
  isDarkCanvas: boolean;
  lockupOrientation: 'vertical' | 'horizontal';
  logoOrder: 'nvidia-left' | 'nvidia-right';

  // Saved state
  initialTransform: {
    scale: number;
    offsetX: number;
    offsetY: number;
  } | null;
  
  // Actions
  setLogoFile: (file: File) => void;
  setLogoData: (data: string, type: 'svg' | 'raster') => void;
  setTransform: (transform: Partial<{
    scale: number;
    baseScale: number;
    scaleFactor: number;
    offsetX: number;
    offsetY: number;
  }>) => void;
  setAnchor: (anchor: [number, number]) => void;
  setUI: (ui: Partial<{
    showOutline: boolean;
    showCanvas: boolean;
    isDarkCanvas: boolean;
    isProcessing: boolean;
    lockupOrientation: 'vertical' | 'horizontal';
    logoOrder: 'nvidia-left' | 'nvidia-right';
  }>) => void;
  setInitialTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
  restoreInitialTransform: () => void;
  center: () => void;
  reset: () => void;
  refit: () => void;
  clearLogo: () => void;
}


let uploadVersion = 0;
function fitted(state: LogoState) {
  if (!state.bounds) return {};
  const body = state.bounds;
  const guide = getLayout(state.isPartner, state.lockupOrientation, state.logoOrder).body;

  const anchor: [number, number] = [body.x + body.width / 2, body.y + body.height / 2];
  const offsetX = guide.x + guide.width / 2 - anchor[0];
  const offsetY = guide.y + guide.height / 2 - anchor[1];
  const scale = state.isPartner ? fitBody(body, guide) : fitTemplate(body, offsetX, offsetY);
  return { scale, baseScale: scale, scaleFactor: 1, offsetX, offsetY, anchor, initialTransform: { scale, offsetX, offsetY } };
}
export const useLogoStore = create<LogoState>((set, get) => ({
  bounds: null, isPartner: false,
  logoFile: null, logoData: null, logoType: null,
  scale: 1, offsetX: 0, offsetY: 0, padding: 0, baseScale: 1, scaleFactor: 1, anchor: null,
  showOutline: true, showCanvas: false, isProcessing: false, isDarkCanvas: false,
  lockupOrientation: 'vertical', logoOrder: 'nvidia-right', initialTransform: null,
  setMode: (isPartner) => set(state => { if (state.isPartner === isPartner) return {}; const next = { ...state, isPartner }; return { isPartner, ...fitted(next) }; }),
  loadLogo: async (file) => {
    const version = ++uploadVersion;
    set({ isProcessing: true });
    try {
      let data: string;
      const svg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
      if (svg) data = normalizeSVG(await file.text());
      else {
        if (!/\.(png|jpe?g)$/i.test(file.name) && !['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Please choose an SVG, PNG, or JPG file.');
        const img = await loadImageFromFile(file);
        const { canvas } = await getAlphaTightBounds(img);
        // Preserve original pixels and colors. Automatic tracing can distort brand artwork.
        data = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${canvas.width} ${canvas.height}"><image width="${canvas.width}" height="${canvas.height}" href="${canvas.toDataURL('image/png')}"/></svg>`;
      }
      const measured = parseSVGBounds(data);
      if (version !== uploadVersion) return;
      const bounds = { x: measured.minX, y: measured.minY, width: measured.width, height: measured.height };
      const next = { ...get(), bounds };
      set({ logoData: data, logoFile: file, logoType: svg ? 'svg' : 'raster', bounds, ...fitted(next) });
    } finally { if (version === uploadVersion) set({ isProcessing: false }); }
  },
  setLogoFile: logoFile => set({ logoFile }),
  setLogoData: (logoData, logoType) => set({ logoData, logoType, isProcessing: false }),
  setAnchor: anchor => set({ anchor }),
  setInitialTransform: initialTransform => set({ initialTransform }),
  setTransform: patch => set(state => {
    const next = { ...state, ...patch };
    const scale = patch.scale ?? next.baseScale * next.scaleFactor;
    if (!Number.isFinite(scale) || !Number.isFinite(next.offsetX) || !Number.isFinite(next.offsetY)) return {};
    if (!Number.isFinite(next.baseScale) || next.baseScale <= 0) return {};
    // The guide defines the initial fit; manual sizing and positioning may exceed it.
    const scaleFactor = Math.max(0.01, Math.min(state.isPartner ? 2.5 : 1, scale / next.baseScale));
    if (!state.isPartner && state.bounds) {
      const constrained = constrainTemplate(state.bounds, state, { scale: next.baseScale * scaleFactor, offsetX: next.offsetX, offsetY: next.offsetY });
      return { ...patch, ...constrained, scaleFactor: constrained.scale / next.baseScale };
    }
    return { ...patch, scale: next.baseScale * scaleFactor, scaleFactor };
  }),
  setUI: patch => set(state => {
    const next = { ...state, ...patch };
    if (next.lockupOrientation !== state.lockupOrientation) return { ...patch, ...fitted(next) };
    if (next.logoOrder !== state.logoOrder && state.bounds) {
      // Move with the guide, retaining the user's scale and manual offset within it.
      const previousGuide = getLayout(state.isPartner, state.lockupOrientation, state.logoOrder).body;
      const nextGuide = getLayout(next.isPartner, next.lockupOrientation, next.logoOrder).body;
      const dx = nextGuide.x + nextGuide.width / 2 - previousGuide.x - previousGuide.width / 2;
      const dy = nextGuide.y + nextGuide.height / 2 - previousGuide.y - previousGuide.height / 2;
      return {
        ...patch,
        offsetX: state.offsetX + dx,
        offsetY: state.offsetY + dy,
        initialTransform: state.initialTransform ? {
          ...state.initialTransform,
          offsetX: state.initialTransform.offsetX + dx,
          offsetY: state.initialTransform.offsetY + dy,
        } : null,
      };
    }
    return patch;
  }),
  center: () => {
    const state = get();
    if (!state.anchor) return;
    const guide = getLayout(state.isPartner, state.lockupOrientation, state.logoOrder).body;
    state.setTransform({ offsetX: guide.x + guide.width / 2 - state.anchor[0], offsetY: guide.y + guide.height / 2 - state.anchor[1] });
  },
  refit: () => set(state => fitted(state)),
  reset: () => set(state => fitted(state)),
  restoreInitialTransform: () => set(state => fitted(state)),
  clearLogo: () => {
    ++uploadVersion;
    set({ logoFile: null, logoData: null, logoType: null, bounds: null, scale: 1, baseScale: 1, scaleFactor: 1, offsetX: 0, offsetY: 0, anchor: null, initialTransform: null, isProcessing: false });
  }
}));
