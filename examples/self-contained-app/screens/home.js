import { drawSoftwareText } from '../../_shared/software-text.js';

function card(draw, x, y, width, title, value, color) {
  draw.roundedRect(x, y, width, 88, 10, [30, 41, 59, 255]);
  drawSoftwareText(draw, title, x + 16, y + 16, [148, 163, 184, 255]);
  drawSoftwareText(draw, String(value), x + 16, y + 42, color, { scale: 3 });
}

export function renderHome(draw, bounds, state) {
  drawSoftwareText(draw, 'NODE NET STUDIO', bounds.x + 20, bounds.y + 20, [240, 246, 255, 255], { scale: 3 });
  drawSoftwareText(draw, 'ONE SURFACE. FOUR LIVE WORKSPACES.', bounds.x + 22, bounds.y + 52, [148, 163, 184, 255]);
  card(draw, bounds.x + 20, bounds.y + 86, 174, 'ACTIONS', state.actionCount, [52, 211, 153, 255]);
  card(draw, bounds.x + 208, bounds.y + 86, 174, 'STROKES', state.canvas.strokes.length, [249, 115, 22, 255]);
  card(draw, bounds.x + 396, bounds.y + 86, 174, 'NOTE CHARS', state.notes.text.length, [99, 102, 241, 255]);
  drawSoftwareText(draw, 'RECENT ACTIVITY', bounds.x + 20, bounds.y + 202, [240, 246, 255, 255], { scale: 2 });
  if (!state.activity.length) drawSoftwareText(draw, 'Choose a workspace to begin.', bounds.x + 20, bounds.y + 238, [148, 163, 184, 255]);
  const recent = state.activity.slice(-7).reverse();
  for (const [index, item] of recent.entries()) {
    draw.roundedRect(bounds.x + 20, bounds.y + 230 + index * 30, 550, 24, 5, [24, 35, 59, 255]);
    drawSoftwareText(draw, item.slice(0, 72), bounds.x + 30, bounds.y + 239 + index * 30, [203, 213, 225, 255]);
  }
}
