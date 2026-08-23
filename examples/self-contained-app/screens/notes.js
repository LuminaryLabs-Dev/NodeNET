import { pointInRect } from '../../_shared/geometry.js';
import { drawSoftwareText } from '../../_shared/software-text.js';

export function createNotesState() {
  return { text: '', caret: 0, focused: false };
}

function layout(bounds) {
  return {
    editor: { x: bounds.x + 20, y: bounds.y + 72, width: bounds.width - 40, height: bounds.height - 112 },
    clear: { x: bounds.x + bounds.width - 104, y: bounds.y + 18, width: 84, height: 32 }
  };
}

export function renderNotes(draw, bounds, state) {
  const controls = layout(bounds);
  drawSoftwareText(draw, 'NOTES', bounds.x + 20, bounds.y + 20, [240, 246, 255, 255], { scale: 3 });
  drawSoftwareText(draw, `${state.text.length} CHARS`, bounds.x + 200, bounds.y + 32, [148, 163, 184, 255]);
  draw.roundedRect(controls.clear.x, controls.clear.y, controls.clear.width, controls.clear.height, 7, [79, 70, 229, 255]);
  drawSoftwareText(draw, 'CLEAR', controls.clear.x + 25, controls.clear.y + 12, [255, 255, 255, 255]);
  if (state.focused) draw.roundedRect(controls.editor.x - 3, controls.editor.y - 3, controls.editor.width + 6, controls.editor.height + 6, 10, [99, 102, 241, 255]);
  draw.roundedRect(controls.editor.x, controls.editor.y, controls.editor.width, controls.editor.height, 8, [248, 250, 252, 255]);
  const lines = state.text.split('\n');
  if (!state.text && !state.focused) drawSoftwareText(draw, 'Click here, then type...', controls.editor.x + 18, controls.editor.y + 22, [148, 163, 184, 255], { scale: 2 });
  for (const [index, line] of lines.slice(0, 11).entries()) {
    drawSoftwareText(draw, line.slice(0, 45), controls.editor.x + 18, controls.editor.y + 22 + index * 22, [30, 41, 59, 255], { scale: 2 });
  }
  if (state.focused) {
    const before = state.text.slice(0, state.caret).split('\n');
    const row = Math.min(10, before.length - 1);
    const column = Math.min(45, before.at(-1).length);
    draw.fillRect(controls.editor.x + 18 + column * 12, controls.editor.y + 20 + row * 22, 2, 17, [99, 102, 241, 255]);
  }
}

export function pointerNotes(input, bounds, state) {
  if (input.type !== 'click') return { changed: false };
  const controls = layout(bounds);
  if (pointInRect(input, controls.clear)) {
    state.text = '';
    state.caret = 0;
    state.focused = false;
    return { changed: true, action: 'Note cleared' };
  }
  const focused = pointInRect(input, controls.editor);
  if (focused) state.caret = state.text.length;
  const changed = state.focused !== focused;
  state.focused = focused;
  return { changed, action: focused ? 'Note focused' : undefined };
}

export function keyNotes(input, state) {
  if (!state.focused) return { changed: false };
  if (input.type === 'text') {
    state.text = `${state.text.slice(0, state.caret)}${input.key}${state.text.slice(state.caret)}`;
    state.caret += input.key.length;
    return { changed: true, action: 'Note edited' };
  }
  if (input.type !== 'down') return { changed: false };
  if (input.key === 'Backspace' && state.caret > 0) {
    state.text = `${state.text.slice(0, state.caret - 1)}${state.text.slice(state.caret)}`;
    state.caret -= 1;
  } else if (input.key === 'Enter') {
    state.text = `${state.text.slice(0, state.caret)}\n${state.text.slice(state.caret)}`;
    state.caret += 1;
  } else if (input.key === 'ArrowLeft') state.caret = Math.max(0, state.caret - 1);
  else if (input.key === 'ArrowRight') state.caret = Math.min(state.text.length, state.caret + 1);
  else return { changed: false };
  return { changed: true, action: 'Note edited' };
}
