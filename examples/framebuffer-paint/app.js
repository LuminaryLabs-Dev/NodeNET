import { createSoftwareApp } from '../_shared/app-runtime.js';
import { clamp, pointInRect } from '../_shared/geometry.js';
import { drawSoftwareText } from '../_shared/software-text.js';

export const PAINT_WIDTH = 640;
export const PAINT_HEIGHT = 480;
export const PAINT_TOOLBAR_HEIGHT = 92;

const COLORS = Object.freeze({
  background: [10, 15, 30, 255],
  toolbar: [24, 35, 59, 255],
  canvas: [248, 250, 252, 255],
  white: [240, 246, 255, 255],
  muted: [148, 163, 184, 255],
  edge: [71, 85, 105, 255],
  selected: [99, 102, 241, 255]
});

export const PAINT_PALETTE = Object.freeze([
  Object.freeze({ name: 'INK', color: Object.freeze([15, 23, 42, 255]), rect: Object.freeze({ x: 230, y: 10, width: 30, height: 30 }) }),
  Object.freeze({ name: 'MINT', color: Object.freeze([52, 211, 153, 255]), rect: Object.freeze({ x: 268, y: 10, width: 30, height: 30 }) }),
  Object.freeze({ name: 'ORANGE', color: Object.freeze([249, 115, 22, 255]), rect: Object.freeze({ x: 306, y: 10, width: 30, height: 30 }) }),
  Object.freeze({ name: 'VIOLET', color: Object.freeze([168, 85, 247, 255]), rect: Object.freeze({ x: 344, y: 10, width: 30, height: 30 }) })
]);

export const PAINT_BRUSHES = Object.freeze([
  Object.freeze({ size: 1, rect: Object.freeze({ x: 16, y: 52, width: 44, height: 28 }) }),
  Object.freeze({ size: 3, rect: Object.freeze({ x: 68, y: 52, width: 44, height: 28 }) }),
  Object.freeze({ size: 5, rect: Object.freeze({ x: 120, y: 52, width: 44, height: 28 }) })
]);

export const PAINT_UNDO = Object.freeze({ x: 430, y: 50, width: 84, height: 30 });
export const PAINT_CLEAR = Object.freeze({ x: 528, y: 50, width: 96, height: 30 });

function initialState() {
  return {
    brushIndex: 0,
    brushSize: 3,
    strokes: [],
    activeStroke: null,
    strokeCount: 0,
    segmentCount: 0
  };
}

function recalculate(state) {
  state.strokeCount = state.strokes.length;
  state.segmentCount = state.strokes.reduce((total, stroke) => total + Math.max(0, stroke.points.length - 1), 0);
}

function reset(state) {
  Object.assign(state, initialState());
}

function drawThickLine(draw, start, end, color, size) {
  const radius = Math.floor(size / 2);
  for (let offset = -radius; offset <= radius; offset += 1) {
    draw.line(start.x + offset, start.y, end.x + offset, end.y, color);
    draw.line(start.x, start.y + offset, end.x, end.y + offset, color);
  }
}

function drawStroke(draw, stroke) {
  if (!stroke.points.length) return;
  const first = stroke.points[0];
  const radius = Math.floor(stroke.size / 2);
  draw.fillRect(first.x - radius, first.y - radius, stroke.size, stroke.size, stroke.color);
  for (let index = 1; index < stroke.points.length; index += 1) {
    drawThickLine(draw, stroke.points[index - 1], stroke.points[index], stroke.color, stroke.size);
  }
}

function drawButton(draw, rectangle, label, active = false) {
  draw.roundedRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height, 6, active ? COLORS.selected : [38, 52, 78, 255]);
  const x = rectangle.x + Math.max(6, Math.floor((rectangle.width - label.length * 6) / 2));
  drawSoftwareText(draw, label, x, rectangle.y + 10, COLORS.white);
}

function render(draw, state) {
  draw.clear(COLORS.background);
  draw.fillRect(0, 0, PAINT_WIDTH, PAINT_TOOLBAR_HEIGHT, COLORS.toolbar);
  drawSoftwareText(draw, 'FRAMEBUFFER PAINT', 16, 14, COLORS.white, { scale: 2 });
  drawSoftwareText(draw, `${state.strokeCount} STROKES  ${state.segmentCount} SEGMENTS`, 190, 62, COLORS.muted);

  for (const [index, item] of PAINT_PALETTE.entries()) {
    if (state.brushIndex === index) draw.roundedRect(item.rect.x - 3, item.rect.y - 3, item.rect.width + 6, item.rect.height + 6, 6, COLORS.white);
    draw.roundedRect(item.rect.x, item.rect.y, item.rect.width, item.rect.height, 5, item.color);
  }
  for (const brush of PAINT_BRUSHES) drawButton(draw, brush.rect, String(brush.size), state.brushSize === brush.size);
  drawButton(draw, PAINT_UNDO, 'UNDO');
  drawButton(draw, PAINT_CLEAR, 'CLEAR');

  draw.fillRect(0, PAINT_TOOLBAR_HEIGHT, PAINT_WIDTH, PAINT_HEIGHT - PAINT_TOOLBAR_HEIGHT, COLORS.canvas);
  draw.fillRect(0, PAINT_TOOLBAR_HEIGHT, PAINT_WIDTH, 2, COLORS.edge);
  for (const stroke of state.strokes) drawStroke(draw, stroke);
  if (state.activeStroke) drawStroke(draw, state.activeStroke);
}

function canvasPoint(input) {
  return {
    x: Math.round(clamp(input.x, 0, PAINT_WIDTH - 1)),
    y: Math.round(clamp(input.y, PAINT_TOOLBAR_HEIGHT + 2, PAINT_HEIGHT - 1))
  };
}

function pointer(input, state) {
  if (input.type === 'click') {
    const paletteIndex = PAINT_PALETTE.findIndex(item => pointInRect(input, item.rect));
    if (paletteIndex >= 0) {
      state.brushIndex = paletteIndex;
      return true;
    }
    const brush = PAINT_BRUSHES.find(item => pointInRect(input, item.rect));
    if (brush) {
      state.brushSize = brush.size;
      return true;
    }
    if (pointInRect(input, PAINT_UNDO)) {
      state.strokes.pop();
      recalculate(state);
      return true;
    }
    if (pointInRect(input, PAINT_CLEAR)) {
      reset(state);
      return true;
    }
    return false;
  }

  if (input.type === 'down' && input.y >= PAINT_TOOLBAR_HEIGHT) {
    const palette = PAINT_PALETTE[state.brushIndex];
    state.activeStroke = {
      colorName: palette.name,
      color: [...palette.color],
      size: state.brushSize,
      points: [canvasPoint(input)]
    };
    return true;
  }
  if (input.type === 'move' && state.activeStroke) {
    state.activeStroke.points.push(canvasPoint(input));
    return true;
  }
  if (input.type === 'up' && state.activeStroke) {
    const point = canvasPoint(input);
    const previous = state.activeStroke.points.at(-1);
    if (previous.x !== point.x || previous.y !== point.y) state.activeStroke.points.push(point);
    state.strokes.push(state.activeStroke);
    state.activeStroke = null;
    recalculate(state);
    return true;
  }
  return false;
}

function snapshot(state) {
  return {
    brushColor: PAINT_PALETTE[state.brushIndex].name,
    brushSize: state.brushSize,
    strokeCount: state.strokeCount,
    segmentCount: state.segmentCount,
    drawing: state.activeStroke !== null,
    strokes: state.strokes.map(stroke => ({ color: stroke.colorName, size: stroke.size, points: stroke.points.length }))
  };
}

export function createFramebufferPaint() {
  return createSoftwareApp({
    id: 'framebuffer-paint',
    width: PAINT_WIDTH,
    height: PAINT_HEIGHT,
    state: initialState(),
    draw: render,
    onPointer: pointer,
    onKey: () => false,
    snapshot
  });
}
