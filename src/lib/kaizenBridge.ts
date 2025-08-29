/**
 * Kaizen UI Bridge - Maps Kaizen's computed styles to our CSS variables
 * and applies the specified pop color (#76B900) for primary/accent elements
 */

// Convert RGB(A) color string to HSL values
function rgbToHsl(rgbString: string): string {
  // Parse rgb(r, g, b) or rgba(r, g, b, a)
  const match = rgbString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/);
  if (!match) return "0 0% 0%"; // fallback to black
  
  const r = parseInt(match[1], 10) / 255;
  const g = parseInt(match[2], 10) / 255;
  const b = parseInt(match[3], 10) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    
    switch (max) {
      case r:
        h = (g - b) / diff + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      case b:
        h = (r - g) / diff + 4;
        break;
    }
    h /= 6;
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Convert hex color to HSL
function hexToHsl(hex: string): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const diff = max - min;
  
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (diff !== 0) {
    s = l > 0.5 ? diff / (2 - max - min) : diff / (max + min);
    
    switch (max) {
      case r:
        h = (g - b) / diff + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / diff + 2;
        break;
      case b:
        h = (r - g) / diff + 4;
        break;
    }
    h /= 6;
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// Apply Kaizen theme bridge with custom pop color
export function applyKaizenBridge(popColor: string = "#76B900"): void {
  try {
    // Get computed styles from document body
    const bodyStyles = window.getComputedStyle(document.body);
    const backgroundColor = bodyStyles.backgroundColor;
    const textColor = bodyStyles.color;
    
    // Create a hidden button to probe button styles
    const probeButton = document.createElement('button');
    probeButton.style.position = 'absolute';
    probeButton.style.visibility = 'hidden';
    probeButton.style.pointerEvents = 'none';
    document.body.appendChild(probeButton);
    
    const buttonStyles = window.getComputedStyle(probeButton);
    const buttonBg = buttonStyles.backgroundColor;
    const buttonText = buttonStyles.color;
    
    // Clean up probe element
    document.body.removeChild(probeButton);
    
    // Convert Kaizen colors to HSL
    const bgHsl = rgbToHsl(backgroundColor);
    const textHsl = rgbToHsl(textColor);
    
    // Convert pop color to HSL
    const popHsl = hexToHsl(popColor);
    
    // Apply to CSS custom properties
    const root = document.documentElement;
    
    // Base colors from Kaizen
    root.style.setProperty('--background', bgHsl);
    root.style.setProperty('--foreground', textHsl);
    
    // Card colors (slightly different from background)
    root.style.setProperty('--card', bgHsl);
    root.style.setProperty('--card-foreground', textHsl);
    
    // Pop color for primary elements
    root.style.setProperty('--primary', popHsl);
    root.style.setProperty('--primary-foreground', '0 0% 100%'); // White text on green
    
    // Accent using the same pop color
    root.style.setProperty('--accent', popHsl);
    root.style.setProperty('--accent-foreground', '0 0% 100%'); // White text on green
    
    // Muted colors (lighter version of text)
    const mutedLightness = Math.min(parseInt(textHsl.split(' ')[2]) + 20, 90);
    const mutedHsl = textHsl.replace(/\d+%$/, `${mutedLightness}%`);
    root.style.setProperty('--muted', mutedHsl);
    root.style.setProperty('--muted-foreground', textHsl);
    
    // Border and ring using pop color with lower opacity
    root.style.setProperty('--border', mutedHsl);
    root.style.setProperty('--ring', popHsl);
    
    // Destructive colors (keep original red-ish)
    root.style.setProperty('--destructive', '0 84% 60%');
    root.style.setProperty('--destructive-foreground', '0 0% 100%');
    
    // Popover colors
    root.style.setProperty('--popover', bgHsl);
    root.style.setProperty('--popover-foreground', textHsl);
    
    console.log('✅ Kaizen bridge applied successfully with pop color:', popColor);
  } catch (error) {
    console.warn('⚠️ Failed to apply Kaizen bridge:', error);
    // Keep default theme if bridge fails
  }
}
