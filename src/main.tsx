import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyKaizenBridge } from './lib/kaizenBridge'

// Initialize Kaizen theme bridge
function initializeKaizenTheme() {
  if (document.readyState === 'complete') {
    applyKaizenBridge('#76B900');
  } else {
    window.addEventListener('load', () => {
      applyKaizenBridge('#76B900');
    });
    // Fallback timeout in case load event doesn't fire
    setTimeout(() => {
      applyKaizenBridge('#76B900');
    }, 1000);
  }
}

createRoot(document.getElementById("root")!).render(<App />);

// Apply Kaizen theme after render
initializeKaizenTheme();
