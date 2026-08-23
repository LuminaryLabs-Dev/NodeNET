import { clamp, pointInRect } from '../../_shared/geometry.js';
import { drawSoftwareText } from '../../_shared/software-text.js';

export function createCanvasState() {
  return { strokes: [], activeStroke: null };
}

function layout(bounds) {
  return {
    drawing: { x: bounds.x + 20, y: bounds.y + 72, width: bounds.width - 40, height: bounds.height - 112 },
    clear: { x: bounds.x + bounds.width - 104, y: bounds.y + 18, width: 84, height: 32 }
  };
}

function point(input, rectangle) {
  return {
    x: Math.round(clamp(input.x, rectangle.x, rectangle.x + rectangle.width - 1)),
    y: Math.round(clamp(input.y, rectangle.y, rectangle.y + rectangle.height - 1))
  };
}

function stroke(draw, points) {
  if (!points.length) return;
  draw.fillRect(points[0].x - 2, points[0].y - 2, 5, 5, [52, 211, 153, 255]);
  for (let index = 1; index < points.length; index += 1) {
    for (let offset = -2; offset <= 2; offset += 1) {
      draw.line(points[index - 1].x + offset, points[index - 1].y, points[index].x + offset, points[index].y, [52, 211, 153, 255]);
    }
  }
}

export function renderCanvas(draw, bounds, state) {
  const controls = layout(bounds);
  drawSoftwareText(draw, 'CANVAS', bounds.x + 20, bounds.y + 20, [240, 246, 255, 255], { scale: 3 });
  drawSoftwareText(draw, `${state.strokes.length} STROKES`, bounds.x + 220, bounds.y + 32, [148, 163, 184, 255]);
  draw.roundedRect(controls.clear.x, controls.clear.y, controls.clear.width, controls.clear.height, 7, [79, 70, 229, 255]);
  drawSoftwareText(draw, 'CLEAR', controls.clear.x + 25, controls.clear.y + 12, [255, 255, 255, 255]);
  draw.roundedRect(controls.drawing.x, controls.drawing.y, controls.drawing.width, controls.drawing.height, 8, [248, 250, 252, 255]);
  for (const item of state.strokes) stroke(draw, item);
  if (state.activeStroke) stroke(draw, state.activeStroke);
}

export function pointerCanvas(input, bounds, state) {
  const controls = layout(bounds);
  if (input.type === 'click' && pointInRect(input, controls.clear)) {
    state.strokes = [];
    state.activeStroke = null;
    return { changed: true, action: 'Canvas cleared' };
  }
  if (input.type === 'down' && pointInRect(input, controls.drawing)) {
    state.activeStroke = [point(input, controls.drawing)];
    return { changed: true };
  }
  if (input.type === 'move' && state.activeStroke) {
    state.activeStroke.push(point(input, controls.drawing));
    return { changed: true };
  }
  if (input.type === 'up' && state.activeStroke) {
    const final = point(input, controls.drawing);
    const previous = state.activeStroke.at(-1);
    if (previous.x !== final.x || previous.y !== final.y) state.activeStroke.push(final);
    state.strokes.push(state.activeStroke);
    state.activeStroke = null;
    return { changed: true, action: 'Canvas stroke completed' };
  }
  return { changed: false };
}
