import { drawSoftwareText } from '../../_shared/software-text.js';

export function renderAbout(draw, bounds, state, app) {
  drawSoftwareText(draw, 'ABOUT', bounds.x + 20, bounds.y + 20, [240, 246, 255, 255], { scale: 3 });
  const rows = [
    ['APPLICATION', 'NodeNET Studio'],
    ['NODENET', state.version],
    ['PROVIDER', app.display.kind],
    ['FORMAT', app.surface.format],
    ['SURFACE', `${app.surface.width} x ${app.surface.height}`],
    ['SEQUENCE', String(app.surface.sequence)],
    ['POINTER INPUTS', String(app.inputCounts.pointer)],
    ['KEY INPUTS', String(app.inputCounts.key)]
  ];
  for (const [index, [label, value]] of rows.entries()) {
    const y = bounds.y + 82 + index * 42;
    draw.roundedRect(bounds.x + 20, y, bounds.width - 40, 32, 6, [24, 35, 59, 255]);
    drawSoftwareText(draw, label, bounds.x + 34, y + 12, [148, 163, 184, 255]);
    drawSoftwareText(draw, value, bounds.x + 250, y + 12, [52, 211, 153, 255]);
  }
}
