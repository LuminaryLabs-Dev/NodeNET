import { createSoftwareApp } from '../_shared/app-runtime.js';
import { drawSoftwareText } from '../_shared/software-text.js';
import { renderNavigation, screenAtPoint, screenForShortcut, STUDIO_CONTENT, STUDIO_SCREENS } from './navigation.js';
import { renderHome } from './screens/home.js';
import { createCanvasState, pointerCanvas, renderCanvas } from './screens/canvas.js';
import { createNotesState, keyNotes, pointerNotes, renderNotes } from './screens/notes.js';
import { createFilterState, pointerFilters, renderFilters } from './screens/filters.js';
import { renderAbout } from './screens/about.js';

export const STUDIO_WIDTH = 800;
export const STUDIO_HEIGHT = 520;

function screenLabel(id) {
  return STUDIO_SCREENS.find(screen => screen.id === id)?.label ?? id.toUpperCase();
}

function record(state, action) {
  if (!action) return;
  state.actionCount += 1;
  if (state.activity.at(-1) !== action) state.activity.push(action);
  if (state.activity.length > 20) state.activity.shift();
}

function switchScreen(state, id) {
  if (state.activeScreen === id) return false;
  state.notes.focused = false;
  state.activeScreen = id;
  record(state, `Opened ${screenLabel(id)}`);
  return true;
}

function snapshot(state, app) {
  return {
    activeScreen: state.activeScreen,
    actionCount: state.actionCount,
    activity: [...state.activity],
    canvas: {
      strokeCount: state.canvas.strokes.length,
      pointCount: state.canvas.strokes.reduce((total, stroke) => total + stroke.length, 0),
      drawing: state.canvas.activeStroke !== null
    },
    notes: {
      text: state.notes.text,
      caret: state.notes.caret,
      focused: state.notes.focused,
      characterCount: state.notes.text.length
    },
    filters: { filter: state.filters.filter },
    version: state.version,
    provider: app.display.kind,
    format: app.surface.format,
    width: app.surface.width,
    height: app.surface.height,
    surfaceSequence: app.surface.sequence
  };
}

function render(draw, state, app) {
  draw.clear([10, 15, 30, 255]);
  renderNavigation(draw, state.activeScreen);
  draw.roundedRect(STUDIO_CONTENT.x, STUDIO_CONTENT.y, STUDIO_CONTENT.width, STUDIO_CONTENT.height, 12, [17, 24, 39, 255]);
  if (state.activeScreen === 'home') renderHome(draw, STUDIO_CONTENT, state);
  else if (state.activeScreen === 'canvas') renderCanvas(draw, STUDIO_CONTENT, state.canvas);
  else if (state.activeScreen === 'notes') renderNotes(draw, STUDIO_CONTENT, state.notes);
  else if (state.activeScreen === 'filters') renderFilters(draw, STUDIO_CONTENT, state.filters);
  else renderAbout(draw, STUDIO_CONTENT, state, app);
  draw.fillRect(STUDIO_CONTENT.x, 492, STUDIO_CONTENT.width, 28, [24, 35, 59, 255]);
  drawSoftwareText(draw, `SCREEN ${screenLabel(state.activeScreen)}  SEQ ${app.surface.sequence}  ACTIONS ${state.actionCount}`, STUDIO_CONTENT.x + 14, 502, [148, 163, 184, 255]);
}

function pointer(input, state) {
  if (input.type === 'click') {
    const destination = screenAtPoint(input);
    if (destination) return switchScreen(state, destination);
  }
  let result = { changed: false };
  if (state.activeScreen === 'canvas') result = pointerCanvas(input, STUDIO_CONTENT, state.canvas);
  else if (state.activeScreen === 'notes') result = pointerNotes(input, STUDIO_CONTENT, state.notes);
  else if (state.activeScreen === 'filters') result = pointerFilters(input, state.filters);
  if (result.action) record(state, result.action);
  return result.changed;
}

function key(input, state) {
  if (input.type === 'down') {
    const destination = screenForShortcut(input.key);
    if (destination) return switchScreen(state, destination);
  }
  if (state.activeScreen !== 'notes') return false;
  const result = keyNotes(input, state.notes);
  if (result.action) record(state, result.action);
  return result.changed;
}

export function createNodeNETStudio({ version = '0.3.2' } = {}) {
  return createSoftwareApp({
    id: 'self-contained-app',
    width: STUDIO_WIDTH,
    height: STUDIO_HEIGHT,
    state: {
      activeScreen: 'home',
      actionCount: 0,
      activity: [],
      canvas: createCanvasState(),
      notes: createNotesState(),
      filters: createFilterState(),
      version
    },
    draw: render,
    onPointer: pointer,
    onKey: key,
    snapshot
  });
}
