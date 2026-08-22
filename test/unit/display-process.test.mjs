import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SoftwareDisplayService } from '../../src/index.js';
import { spawnManagedProcess } from '../../src/process/handle.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = path.resolve(here, '..', 'fixtures', 'display-process.mjs');

test('process display adapter receives frames and sends normalized input', { timeout: 10_000 }, async () => {
  const handle = spawnManagedProcess(process.execPath, [fixture], { binaryStdout: true });
  const display = new SoftwareDisplayService();
  const surface = display.connectProcess(handle);
  const ready = await surface.waitForReady();
  assert.equal(ready.format, 'rgba8');
  const initial = await surface.waitForFrame({ afterSequence: 0 });
  assert.equal(initial.pixels[0], 24);
  const sequence = surface.sequence;
  const result = await surface.pointer({ type: 'click', x: 1, y: 1, button: 0 });
  assert.equal(result.state.display, '1');
  const changed = await surface.waitForFrame({ afterSequence: sequence });
  assert.equal(changed.pixels[0], 200);
  assert.equal(surface.lastState.display, '1');
  await surface.dispose();
  const exit = await handle.wait();
  assert.equal(exit.ok, true, exit.stderr);
});
