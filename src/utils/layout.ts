import { TEMPLATE_WIDTH, TEMPLATE_HEIGHT } from './templateFit';
export interface Rect { x: number; y: number; width: number; height: number }
export function getLayout(partner: boolean, orientation: string, order: string) {
  if (!partner) return { width: TEMPLATE_WIDTH, height: TEMPLATE_HEIGHT, body: { x: 398, y: 124, width: 454, height: 455 }, extension: 0, nvidia: null, separator: null };
  const horizontal = orientation === 'horizontal';
  const partnerCenter = order === 'nvidia-left' ? 1442 : 478;
  const width = horizontal ? 692 : 480;
  const height = horizontal ? 132 : 370;
  return {
    width: 1920, height: 1080,
    body: { x: partnerCenter - width / 2, y: 540 - height / 2, width, height },
    extension: horizontal ? 132 : 240,
    nvidia: { x: 1920 - partnerCenter - width / 2, y: 540 - (horizontal ? 132 : 372) / 2, width, height: horizontal ? 132 : 372 },
    separator: { x: 956, y: horizontal ? 388 : 265, width: 8, height: horizontal ? 304 : 550 }
  };
}
export function fitBody(body: Rect, guide: Rect) {
  return Math.min(guide.width / body.width, guide.height / body.height);
}
