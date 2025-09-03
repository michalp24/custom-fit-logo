import { create } from 'zustand';

export interface LogoState {
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
  scaleFactor: number; // 0.0 - 2.0 multiplier from UI slider
  anchor: [number, number] | null; // logo bounds center
  
  // UI state
  showOutline: boolean;
  showCanvas: boolean;
  isProcessing: boolean;
  isDarkCanvas: boolean;

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
  }>) => void;
  setInitialTransform: (t: { scale: number; offsetX: number; offsetY: number }) => void;
  restoreInitialTransform: () => void;
  center: () => void;
  reset: () => void;
  refit: () => void;
}

export const useLogoStore = create<LogoState>((set, get) => ({
  // Initial state
  logoFile: null,
  logoData: null,
  logoType: null,
  
  scale: 1,
  offsetX: 0,
  offsetY: 0,
  padding: 0,
  baseScale: 1,
  scaleFactor: 1,
  anchor: null,
  
  showOutline: true,
  showCanvas: false,
  isProcessing: false,
  isDarkCanvas: false,

  initialTransform: null,
  
  // Actions
  setLogoFile: (file) => set({ logoFile: file }),
  
  setLogoData: (data, type) => set({ 
    logoData: data, 
    logoType: type,
    isProcessing: false 
  }),
  
  setTransform: (transform) => set((state) => {
    const next = { ...state, ...transform } as LogoState;
    // If baseScale or scaleFactor are provided without explicit scale, compute scale
    const base = transform.baseScale !== undefined ? transform.baseScale : next.baseScale;
    const factor = transform.scaleFactor !== undefined ? transform.scaleFactor : next.scaleFactor;
    if (transform.baseScale !== undefined || transform.scaleFactor !== undefined) {
      next.scale = base * factor;
    }
    return next;
  }),
  
  setUI: (ui) => set((state) => ({
    ...state,
    ...ui
  })),

  setAnchor: (anchor) => set({ anchor }),

  setInitialTransform: (t) => set({ initialTransform: { ...t } }),

  restoreInitialTransform: () => set((state) => {
    if (!state.initialTransform) return state;
    const { scale, offsetX, offsetY } = state.initialTransform;
    return { ...state, scale, offsetX, offsetY };
  }),
  
  center: () => {
    const state = get();
    if (!state.logoData) return;
    // If we have an initial transform, restore only the position (not scale)
    if (state.initialTransform) {
      const { offsetX, offsetY } = state.initialTransform;
      set({ offsetX, offsetY });
      return;
    }
    // Fallback: compute center based on current scale
    try {
      const { parseSVGBounds } = require('../utils/logoProcessor');
      const { MASK_CENTER } = require('../utils/mask');
      const bounds = parseSVGBounds(state.logoData);
      const [centerX, centerY] = MASK_CENTER;
      const logoCenterX = bounds.minX + bounds.width / 2;
      const logoCenterY = bounds.minY + bounds.height / 2;
      const offsetX = centerX - (logoCenterX * state.baseScale);
      const offsetY = centerY - (logoCenterY * state.baseScale);
      set({ offsetX, offsetY });
    } catch (error) {
      console.error('Error centering logo:', error);
    }
  },

  reset: () => {
    const state = get();
    set({
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      padding: 0,
    });
    
    // After reset, center the logo
    setTimeout(() => {
      const newState = get();
      if (newState.logoData) {
        newState.center();
      }
    }, 0);
  },

  refit: () => {
    const state = get();
    if (!state.logoData) return;
    
    try {
      const { parseSVGBounds, fitIntoMask } = require('../utils/logoProcessor');
      const { MASK_POINTS, MASK_CENTER } = require('../utils/mask');
      
      const bounds = parseSVGBounds(state.logoData);
      const { scale, offsetX, offsetY } = fitIntoMask(bounds, MASK_POINTS, MASK_CENTER, 0, 0);
      
      set({ baseScale: scale, scaleFactor: 1, scale, offsetX, offsetY });
    } catch (error) {
      console.error('Error refitting logo:', error);
    }
  },
}));