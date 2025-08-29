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
  showClip: boolean;
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
    showClip: boolean;
    isProcessing: boolean;
  }>) => void;
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
  padding: 10,
  
  showOutline: true,
  showClip: false,
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
  
  reset: () => set({
    scale: 1,
    rotation: 0,
    offsetX: 0,
    offsetY: 0,
    padding: 10,
  }),
  
  refit: () => {
    const state = get();
    if (!state.logoData) return;
    
    try {
      const { parseSVGBounds, calculateFitScale } = require('../utils/logoProcessor');
      const { MASK_POINTS } = require('../utils/mask');
      
      const bounds = parseSVGBounds(state.logoData);
      const { scale, offsetX, offsetY } = calculateFitScale(bounds, MASK_POINTS, state.padding);
      
      set({ scale, offsetX, offsetY });
    } catch (error) {
      console.error('Error refitting logo:', error);
    }
  },
}));