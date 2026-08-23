import { Frame } from '../../../src/index.js';
import { pointInRect } from '../../_shared/geometry.js';
import { drawSoftwareText } from '../../_shared/software-text.js';

const BUTTONS = Object.freeze([
  Object.freeze({ name: 'original', rect: Object.freeze({ x: 188, y: 88, width: 100, height: 32 }) }),
  Object.freeze({ name: 'invert', rect: Object.freeze({ x: 300, y: 88, width: 92, height: 32 }) }),
  Object.freeze({ name: 'grayscale', rect: Object.freeze({ x: 404, y: 88, width: 116, height: 32 }) })
]);

function sourceFrame() {
  const frame = new Frame({ width: 180, height: 180 });
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      const offset = y * frame.stride + x * 4;
      frame.pixels[offset] = Math.round(x / 179 * 255);
      frame.pixels[offset + 1] = Math.round(y / 179 * 255);
      frame.pixels[offset + 2] = (Math.floor(x / 30) + Math.floor(y / 30)) % 2 ? 225 : 35;
      frame.pixels[offset + 3] = 255;
    }
  }
  return frame;
}

function filtered(source, name) {
  const result = source.clone();
  if (name === 'original') return result;
  for (let offset = 0; offset < result.pixels.length; offset += 4) {
    const red = source.pixels[offset];
    const green = source.pixels[offset + 1];
    const blue = source.pixels[offset + 2];
    if (name === 'invert') {
      result.pixels[offset] = 255 - red;
      result.pixels[offset + 1] = 255 - green;
      result.pixels[offset + 2] = 255 - blue;
    } else {
      const value = Math.round(0.299 * red + 0.587 * green + 0.114 * blue);
      result.pixels[offset] = value;
      result.pixels[offset + 1] = value;
      result.pixels[offset + 2] = value;
    }
  }
  return result;
}

export function createFilterState() {
  const source = sourceFrame();
  return { filter: 'original', source, result: source.clone() };
}

export function renderFilters(draw, bounds, state) {
  drawSoftwareText(draw, 'FILTERS', bounds.x + 20, bounds.y + 20, [240, 246, 255, 255], { scale: 3 });
  for (const item of BUTTONS) {
    draw.roundedRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height, 7, state.filter === item.name ? [79, 70, 229, 255] : [38, 52, 78, 255]);
    drawSoftwareText(draw, item.name.toUpperCase(), item.rect.x + 12, item.rect.y + 12, [255, 255, 255, 255]);
  }
  drawSoftwareText(draw, 'SOURCE', bounds.x + 40, bounds.y + 126, [148, 163, 184, 255]);
  drawSoftwareText(draw, state.filter.toUpperCase(), bounds.x + 350, bounds.y + 126, [52, 211, 153, 255]);
  draw.blit(state.source, bounds.x + 40, bounds.y + 150);
  draw.blit(state.result, bounds.x + 350, bounds.y + 150);
}

export function pointerFilters(input, state) {
  if (input.type !== 'click') return { changed: false };
  const selected = BUTTONS.find(item => pointInRect(input, item.rect));
  if (!selected || selected.name === state.filter) return { changed: false };
  state.filter = selected.name;
  state.result = filtered(state.source, state.filter);
  return { changed: true, action: `Filter ${state.filter}` };
}
