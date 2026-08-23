import { SoftwareDisplayService } from '../../src/index.js';

function clonePlain(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function createSoftwareApp({
  id,
  width,
  height,
  state,
  draw,
  onPointer,
  onKey,
  snapshot = value => value
}) {
  if (typeof id !== 'string' || !id) throw new TypeError('Example applications require an id.');
  if (typeof draw !== 'function') throw new TypeError('Example applications require a draw function.');

  const display = new SoftwareDisplayService();
  const surface = display.createSurface({ id, width, height });
  const inputCounts = { pointer: 0, key: 0 };
  let disposed = false;

  const app = {
    id,
    display,
    surface,
    state,
    inputCounts,
    get disposed() { return disposed; },
    snapshot() { return clonePlain(snapshot(state, app)); },
    render() {
      if (disposed) throw new Error(`Example application ${id} has been disposed.`);
      draw(surface.rasterizer(), state, app);
      surface.present(app.snapshot());
      return surface.capture();
    },
    pointer(event) { return surface.pointer(event); },
    key(event) { return surface.key(event); },
    async dispose() {
      if (disposed) return;
      disposed = true;
      await display.dispose();
    }
  };

  surface.on('pointer', input => {
    inputCounts.pointer += 1;
    if (onPointer?.(input, state, app) !== false) app.render();
  });
  surface.on('key', input => {
    inputCounts.key += 1;
    if (onKey?.(input, state, app) !== false) app.render();
  });

  app.render();
  return app;
}
