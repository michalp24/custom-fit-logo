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
    // This will be implemented to auto-fit the logo
    const state = get();
    // Auto-fit logic will go here
    console.log('Refitting logo...', state);
  },
}));