import { createSoftwareApp } from '../_shared/app-runtime.js';
import { pointInRect } from '../_shared/geometry.js';
import { drawSoftwareText } from '../_shared/software-text.js';
import { TextBuffer } from './text-buffer.js';

export const NOTEPAD_WIDTH = 640;
export const NOTEPAD_HEIGHT = 420;
export const NOTEPAD_EDITOR = Object.freeze({ x: 24, y: 84, width: 592, height: 278 });
export const NOTEPAD_CLEAR = Object.freeze({ x: 528, y: 16, width: 96, height: 32 });

const VISIBLE_LINES = 11;
const MAX_COLUMNS = 45;
const LINE_HEIGHT = 22;

const COLORS = Object.freeze({
  background: [10, 15, 30, 255],
  toolbar: [24, 35, 59, 255],
  paper: [248, 250, 252, 255],
  ink: [30, 41, 59, 255],
  white: [240, 246, 255, 255],
  muted: [148, 163, 184, 255],
  focus: [99, 102, 241, 255],
  button: [79, 70, 229, 255],
  placeholder: [148, 163, 184, 255]
});

function stateSnapshot(state) {
  return {
    ...state.buffer.snapshot(),
    focused: state.focused,
    firstVisibleLine: state.firstVisibleLine
  };
}

function synchronizeScroll(state) {
  const line = state.buffer.caretPosition.line;
  if (line < state.firstVisibleLine) state.firstVisibleLine = line;
  if (line >= state.firstVisibleLine + VISIBLE_LINES) state.firstVisibleLine = line - VISIBLE_LINES + 1;
}

function render(draw, state) {
  const snapshot = state.buffer.snapshot();
  draw.clear(COLORS.background);
  draw.fillRect(0, 0, NOTEPAD_WIDTH, 64, COLORS.toolbar);
  drawSoftwareText(draw, 'KEYBOARD NOTEPAD', 16, 17, COLORS.white, { scale: 2 });
  draw.roundedRect(NOTEPAD_CLEAR.x, NOTEPAD_CLEAR.y, NOTEPAD_CLEAR.width, NOTEPAD_CLEAR.height, 7, COLORS.button);
  drawSoftwareText(draw, 'CLEAR', NOTEPAD_CLEAR.x + 32, NOTEPAD_CLEAR.y + 12, COLORS.white);

  if (state.focused) draw.roundedRect(NOTEPAD_EDITOR.x - 3, NOTEPAD_EDITOR.y - 3, NOTEPAD_EDITOR.width + 6, NOTEPAD_EDITOR.height + 6, 10, COLORS.focus);
  draw.roundedRect(NOTEPAD_EDITOR.x, NOTEPAD_EDITOR.y, NOTEPAD_EDITOR.width, NOTEPAD_EDITOR.height, 8, COLORS.paper);

  const lines = state.buffer.lines;
  if (!snapshot.text && !state.focused) drawSoftwareText(draw, 'Click here, then type...', 42, 108, COLORS.placeholder, { scale: 2 });
  for (let row = 0; row < VISIBLE_LINES; row += 1) {
    const lineIndex = state.firstVisibleLine + row;
    if (lineIndex >= lines.length) break;
    drawSoftwareText(draw, lines[lineIndex].slice(0, MAX_COLUMNS), 42, 108 + row * LINE_HEIGHT, COLORS.ink, { scale: 2 });
  }

  if (state.focused) {
    const caret = state.buffer.caretPosition;
    const visibleRow = caret.line - state.firstVisibleLine;
    if (visibleRow >= 0 && visibleRow < VISIBLE_LINES) {
      const column = Math.min(MAX_COLUMNS, caret.column);
      draw.fillRect(42 + column * 12, 106 + visibleRow * LINE_HEIGHT, 2, 17, COLORS.focus);
    }
  }

  drawSoftwareText(draw, `${snapshot.characterCount} CHARS  ${snapshot.lineCount} LINES`, 24, 386, COLORS.muted);
  drawSoftwareText(draw, state.focused ? 'FOCUSED' : 'CLICK EDITOR TO FOCUS', 430, 386, state.focused ? COLORS.focus : COLORS.muted);
}

function pointer(input, state) {
  if (input.type !== 'click') return false;
  if (pointInRect(input, NOTEPAD_CLEAR)) {
    state.buffer.clear();
    state.focused = false;
    state.firstVisibleLine = 0;
    return true;
  }
  const focused = pointInRect(input, NOTEPAD_EDITOR);
  if (focused) state.buffer.caret = state.buffer.text.length;
  if (state.focused === focused && !focused) return false;
  state.focused = focused;
  synchronizeScroll(state);
  return true;
}

function key(input, state) {
  if (!state.focused) return false;
  if (input.type === 'text') state.buffer.insert(input.key);
  else if (input.type === 'down') {
    if (input.key === 'Enter') state.buffer.enter();
    else if (input.key === 'Backspace') state.buffer.backspace();
    else if (input.key === 'Delete') state.buffer.delete();
    else if (input.key === 'ArrowLeft') state.buffer.left();
    else if (input.key === 'ArrowRight') state.buffer.right();
    else if (input.key === 'Home') state.buffer.home();
    else if (input.key === 'End') state.buffer.end();
    else return false;
  } else return false;
  synchronizeScroll(state);
  return true;
}

export function createKeyboardNotepad() {
  return createSoftwareApp({
    id: 'keyboard-notepad',
    width: NOTEPAD_WIDTH,
    height: NOTEPAD_HEIGHT,
    state: { buffer: new TextBuffer(), focused: false, firstVisibleLine: 0 },
    draw: render,
    onPointer: pointer,
    onKey: key,
    snapshot: stateSnapshot
  });
}
