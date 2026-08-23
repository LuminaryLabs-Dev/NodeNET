import test from 'node:test';
import assert from 'node:assert/strict';
import { createNodeNETStudio } from '../../examples/self-contained-app/app.js';

test('NodeNET Studio routes input only to the active screen and retains workspace state', async () => {
  const app = createNodeNETStudio({ version: 'test' });
  try {
    await app.key({ type: 'text', key: 'ignored', code: '' });
    assert.equal(app.snapshot().notes.text, '');

    await app.pointer({ type: 'click', x: 78, y: 169, button: 0 });
    await app.pointer({ type: 'down', x: 240, y: 300, button: 0 });
    await app.pointer({ type: 'move', x: 330, y: 200, button: 0 });
    await app.pointer({ type: 'up', x: 420, y: 330, button: 0 });
    assert.equal(app.snapshot().canvas.strokeCount, 1);

    await app.pointer({ type: 'click', x: 78, y: 227, button: 0 });
    await app.pointer({ type: 'click', x: 250, y: 150, button: 0 });
    await app.key({ type: 'text', key: 'saved note', code: '' });
    assert.equal(app.snapshot().notes.text, 'saved note');

    await app.pointer({ type: 'click', x: 78, y: 285, button: 0 });
    await app.pointer({ type: 'click', x: 462, y: 104, button: 0 });
    assert.equal(app.snapshot().filters.filter, 'grayscale');

    await app.key({ type: 'down', key: '2', code: 'Digit2' });
    assert.equal(app.snapshot().activeScreen, 'canvas');
    assert.equal(app.snapshot().canvas.strokeCount, 1);
    assert.equal(app.snapshot().notes.text, 'saved note');
  } finally {
    await app.dispose();
  }
});
