import { create } from 'zustand';

export interface LogoState {
  // Logo data
  logoFile: File | null;
  logoData: string | null;
  logoType: 'svg' | 'raster' | null;
  
  // Transform state
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  padding: number;
  
  // UI state
  showOutline: boolean;
  showCanvas: boolean;
  isProcessing: boolean;
  
  // Actions
  setLogoFile: (file: File) => void;
  setLogoData: (data: string, type: 'svg' | 'raster') => void;
  setTransform: (transform: Partial<{
    scale: number;
    rotation: number;
    offsetX: number;
    offsetY: number;
    padding: number;
  }>) => void;
  setUI: (ui: Partial<{
    showOutline: boolean;
    showCanvas: boolean;
    isProcessing: boolean;
  }>) => void;
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
  rotation: 0,
  offsetX: 0,
  offsetY: 0,
  padding: 0,
  
  showOutline: true,
  showCanvas: false,
  isProcessing: false,
  
  // Actions
  setLogoFile: (file) => set({ logoFile: file }),
  
  setLogoData: (data, type) => set({ 
    logoData: data, 
    logoType: type,
    isProcessing: false 
  }),
  
  setTransform: (transform) => set((state) => ({
    ...state,
    ...transform
  })),
  
  setUI: (ui) => set((state) => ({
    ...state,
    ...ui
  })),
  
  center: () => {
    const state = get();
    if (!state.logoData) return;
    
    try {
      const { parseSVGBounds } = require('../utils/logoProcessor');
      const { MASK_CENTER } = require('../utils/mask');
      
      const bounds = parseSVGBounds(state.logoData);
      const [centerX, centerY] = MASK_CENTER;
      
      // Calculate offset to center logo at current scale
      const logoCenterX = bounds.minX + bounds.width / 2;
      const logoCenterY = bounds.minY + bounds.height / 2;
      const offsetX = centerX - (logoCenterX * state.scale);
      const offsetY = centerY - (logoCenterY * state.scale);
      
      set({ offsetX, offsetY });
    } catch (error) {
      console.error('Error centering logo:', error);
    }
  },

  reset: () => {
    const state = get();
    set({
      scale: 1,
      rotation: 0,
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
      const { scale, offsetX, offsetY } = fitIntoMask(bounds, MASK_POINTS, MASK_CENTER, state.padding, state.rotation);
      
      set({ scale, offsetX, offsetY });
    } catch (error) {
      console.error('Error refitting logo:', error);
    }
  },
}));