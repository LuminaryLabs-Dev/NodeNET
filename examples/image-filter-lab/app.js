import { createSoftwareApp } from '../_shared/app-runtime.js';
import { pointInRect, valueFromHorizontalPosition } from '../_shared/geometry.js';
import { drawSoftwareText } from '../_shared/software-text.js';
import { frameSha256 } from '../_shared/validation.js';
import { applyFilter, FILTER_NAMES } from './filters.js';
import { createSourceImage } from './source-image.js';

export const FILTER_LAB_WIDTH = 720;
export const FILTER_LAB_HEIGHT = 540;
export const FILTER_SLIDER = Object.freeze({ x: 180, y: 486, width: 500, height: 24 });

export const FILTER_BUTTONS = Object.freeze([
  Object.freeze({ name: 'original', label: 'ORIGINAL', rect: Object.freeze({ x: 20, y: 424, width: 108, height: 34 }) }),
  Object.freeze({ name: 'invert', label: 'INVERT', rect: Object.freeze({ x: 138, y: 424, width: 100, height: 34 }) }),
  Object.freeze({ name: 'grayscale', label: 'GRAYSCALE', rect: Object.freeze({ x: 248, y: 424, width: 126, height: 34 }) }),
  Object.freeze({ name: 'threshold', label: 'THRESHOLD', rect: Object.freeze({ x: 384, y: 424, width: 126, height: 34 }) }),
  Object.freeze({ name: 'sepia', label: 'SEPIA', rect: Object.freeze({ x: 520, y: 424, width: 92, height: 34 }) })
]);

const COLORS = Object.freeze({
  background: [10, 15, 30, 255],
  toolbar: [24, 35, 59, 255],
  panel: [30, 41, 59, 255],
  white: [240, 246, 255, 255],
  muted: [148, 163, 184, 255],
  button: [38, 52, 78, 255],
  active: [79, 70, 229, 255],
  slider: [71, 85, 105, 255],
  knob: [52, 211, 153, 255]
});

function updateResult(state) {
  state.result = applyFilter(state.source, state.filter, { threshold: state.threshold });
}

function isOpaque(frame) {
  for (let offset = 3; offset < frame.pixels.length; offset += 4) {
    if (frame.pixels[offset] !== 255) return false;
  }
  return true;
}

function snapshot(state) {
  return {
    filter: state.filter,
    threshold: state.threshold,
    draggingThreshold: state.draggingThreshold,
    width: state.source.width,
    height: state.source.height,
    byteLength: state.source.byteLength,
    sourceHash: frameSha256(state.source),
    resultHash: frameSha256(state.result),
    resultOpaque: isOpaque(state.result)
  };
}

function button(draw, item, active) {
  draw.roundedRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height, 7, active ? COLORS.active : COLORS.button);
  const x = item.rect.x + Math.max(7, Math.floor((item.rect.width - item.label.length * 6) / 2));
  drawSoftwareText(draw, item.label, x, item.rect.y + 13, COLORS.white);
}

function render(draw, state) {
  draw.clear(COLORS.background);
  draw.fillRect(0, 0, FILTER_LAB_WIDTH, 64, COLORS.toolbar);
  drawSoftwareText(draw, 'IMAGE FILTER LAB', 16, 17, COLORS.white, { scale: 2 });
  drawSoftwareText(draw, `${state.source.width} x ${state.source.height}  ${state.source.byteLength} RGBA BYTES`, 392, 27, COLORS.muted);
  drawSoftwareText(draw, 'SOURCE', 32, 88, COLORS.muted);
  drawSoftwareText(draw, state.filter.toUpperCase(), 432, 88, COLORS.knob);
  draw.roundedRect(24, 112, 272, 272, 8, COLORS.panel);
  draw.roundedRect(424, 112, 272, 272, 8, COLORS.panel);
  draw.blit(state.source, 32, 120);
  draw.blit(state.result, 432, 120);
  for (const item of FILTER_BUTTONS) button(draw, item, state.filter === item.name);
  drawSoftwareText(draw, `THRESHOLD ${state.threshold}`, 20, 493, COLORS.muted);
  draw.roundedRect(FILTER_SLIDER.x, FILTER_SLIDER.y + 8, FILTER_SLIDER.width, 8, 4, COLORS.slider);
  const knobX = FILTER_SLIDER.x + Math.round(state.threshold / 255 * FILTER_SLIDER.width);
  draw.roundedRect(knobX - 7, FILTER_SLIDER.y + 2, 14, 20, 7, COLORS.knob);
}

function setThreshold(state, x) {
  state.threshold = Math.round(valueFromHorizontalPosition(x, FILTER_SLIDER, 0, 255));
  state.filter = 'threshold';
  updateResult(state);
}

function pointer(input, state) {
  if (input.type === 'click') {
    const item = FILTER_BUTTONS.find(candidate => pointInRect(input, candidate.rect));
    if (!item) return false;
    state.filter = item.name;
    updateResult(state);
    return true;
  }
  if (input.type === 'down' && pointInRect(input, FILTER_SLIDER)) {
    state.draggingThreshold = true;
    setThreshold(state, input.x);
    return true;
  }
  if (input.type === 'move' && state.draggingThreshold) {
    setThreshold(state, input.x);
    return true;
  }
  if (input.type === 'up' && state.draggingThreshold) {
    setThreshold(state, input.x);
    state.draggingThreshold = false;
    return true;
  }
  return false;
}

export function createImageFilterLab() {
  const source = createSourceImage();
  return createSoftwareApp({
    id: 'image-filter-lab',
    width: FILTER_LAB_WIDTH,
    height: FILTER_LAB_HEIGHT,
    state: {
      source,
      result: applyFilter(source, 'original'),
      filter: FILTER_NAMES[0],
      threshold: 128,
      draggingThreshold: false
    },
    draw: render,
    onPointer: pointer,
    onKey: () => false,
    snapshot
  });
}
