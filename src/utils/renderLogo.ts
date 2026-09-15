import { TEMPLATE_PATH } from './templateFit';
import type { LogoState } from '@/store/logoStore';
import { getLayout, type Rect } from './layout';
const NS = 'http://www.w3.org/2000/svg';
function element<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}
function rect(box: Rect, attrs: Record<string, string | number>) { return element('rect', { ...box, ...attrs }); }
export function renderLogo(state: LogoState, guides = false): SVGSVGElement {
  const layout = getLayout(state.isPartner, state.lockupOrientation, state.logoOrder);
  const svg = element('svg', { xmlns: NS, viewBox: `0 0 ${layout.width} ${layout.height}`, width: layout.width, height: layout.height });
  svg.appendChild(rect({ x: 0, y: 0, width: layout.width, height: layout.height }, { fill: state.isDarkCanvas ? '#000000' : '#ffffff', 'data-canvas-background': 'true' }));
  if (layout.nvidia) {
    const name = state.lockupOrientation === 'horizontal' ? (state.isDarkCanvas ? 'nvidia-logo-lcokup-dark.svg' : 'nvidia-logo-lockup.svg') : (state.isDarkCanvas ? 'nvidia-logo-dark.svg' : 'nvidia-logo.svg');
    svg.appendChild(element('image', { ...layout.nvidia, href: `${import.meta.env.BASE_URL}${name}`, 'data-nvidia': 'true' }));
  }
  if (layout.separator) svg.appendChild(rect(layout.separator, { fill: state.isDarkCanvas ? '#333333' : '#cccccc' }));
  if (state.logoData) {
    const root = new DOMParser().parseFromString(state.logoData, 'image/svg+xml').documentElement;
    const [x, y] = state.anchor ?? [0, 0];
    const group = element('g', { 'data-partner': 'true', transform: `translate(${state.offsetX} ${state.offsetY}) translate(${x} ${y}) scale(${state.scale}) translate(${-x} ${-y})` });
    for (const child of [...root.children]) group.appendChild(child.cloneNode(true));
    svg.appendChild(group);
  }

  if (guides) {
    const { body: b, extension: e } = layout;
    if (e) for (const box of [{ x: b.x, y: b.y - e, width: b.width, height: e }, { x: b.x, y: b.y + b.height, width: b.width, height: e }, { x: b.x - e, y: b.y, width: e, height: b.height }, { x: b.x + b.width, y: b.y, width: e, height: b.height }]) svg.appendChild(rect(box, { fill: 'none', stroke: '#ff00ff', 'stroke-width': 2, opacity: 0.5 }));
    svg.appendChild(state.isPartner
      ? rect(b, { fill: 'none', stroke: '#ff00ff', 'stroke-width': 2, 'data-main-guide': 'true' })
      : element('path', { d: TEMPLATE_PATH, fill: 'none', stroke: '#ff00ff', 'stroke-width': 2, 'data-main-guide': 'true' }));
  }
  return svg;
}
export async function exportLogo(state: LogoState, format: string): Promise<Blob> {
  const svg = renderLogo(state);
  const bg = svg.querySelector('[data-canvas-background]');
  if (format === 'png') bg?.remove();
  const nvidia = svg.querySelector('image[data-nvidia]');
  if (nvidia) {
    const response = await fetch(nvidia.getAttribute('href')!);
    if (!response.ok) throw new Error('Could not load the NVIDIA logo. Please try again.');
    const source = await response.text();
    const document = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = document.documentElement;
    if (document.querySelector('parsererror') || root.localName !== 'svg' || !root.querySelector('path')) {
      throw new Error('Invalid NVIDIA logo asset.');
    }
    // Include the actual vector artwork. Nested SVG image URLs can disappear
    // when rasterizing or opening the export in a vector editor.
    const artwork = root.cloneNode(true) as SVGSVGElement;
    for (const name of ['x', 'y', 'width', 'height']) {
      artwork.setAttribute(name, nvidia.getAttribute(name)!);
    }
    artwork.setAttribute('data-nvidia', 'true');
    nvidia.replaceWith(artwork);
  }
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  if (format === 'svg') return blob;
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error('Could not render the export.')); img.src = url; });
    const canvas = document.createElement('canvas');
    canvas.width = Number(svg.getAttribute('width')); canvas.height = Number(svg.getAttribute('height'));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas is unavailable.');
    ctx.drawImage(img, 0, 0);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(result => result ? resolve(result) : reject(new Error('Could not encode the export.')), format === 'jpg' ? 'image/jpeg' : 'image/png', 0.95));
  } finally { URL.revokeObjectURL(url); }
}
