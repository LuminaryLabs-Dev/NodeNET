import { pointInRect } from '../_shared/geometry.js';
import { drawSoftwareText } from '../_shared/software-text.js';

export const STUDIO_SCREENS = Object.freeze([
  Object.freeze({ id: 'home', label: 'HOME', shortcut: '1' }),
  Object.freeze({ id: 'canvas', label: 'CANVAS', shortcut: '2' }),
  Object.freeze({ id: 'notes', label: 'NOTES', shortcut: '3' }),
  Object.freeze({ id: 'filters', label: 'FILTERS', shortcut: '4' }),
  Object.freeze({ id: 'about', label: 'ABOUT', shortcut: '5' })
]);

export const STUDIO_CONTENT = Object.freeze({ x: 168, y: 16, width: 616, height: 470 });

function navRect(index) {
  return Object.freeze({ x: 12, y: 90 + index * 58, width: 132, height: 42 });
}

export function screenAtPoint(point) {
  const index = STUDIO_SCREENS.findIndex((screen, screenIndex) => pointInRect(point, navRect(screenIndex)));
  return index < 0 ? null : STUDIO_SCREENS[index].id;
}

export function screenForShortcut(key) {
  return STUDIO_SCREENS.find(screen => screen.shortcut === key)?.id ?? null;
}

export function renderNavigation(draw, activeScreen) {
  draw.fillRect(0, 0, 156, 520, [17, 27, 48, 255]);
  drawSoftwareText(draw, 'NODENET', 16, 20, [99, 102, 241, 255], { scale: 2 });
  drawSoftwareText(draw, 'STUDIO', 16, 42, [240, 246, 255, 255], { scale: 2 });
  for (const [index, screen] of STUDIO_SCREENS.entries()) {
    const rectangle = navRect(index);
    const active = screen.id === activeScreen;
    draw.roundedRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height, 8, active ? [79, 70, 229, 255] : [30, 41, 59, 255]);
    drawSoftwareText(draw, `${screen.shortcut} ${screen.label}`, rectangle.x + 14, rectangle.y + 16, active ? [255, 255, 255, 255] : [148, 163, 184, 255]);
  }
  drawSoftwareText(draw, 'FRAMEBUFFER APP', 16, 486, [100, 116, 139, 255]);
}
