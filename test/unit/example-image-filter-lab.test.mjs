import test from 'node:test';
import assert from 'node:assert/strict';
import { Frame } from '../../src/index.js';
import { createImageFilterLab, FILTER_BUTTONS, FILTER_SLIDER } from '../../examples/image-filter-lab/app.js';
import { applyFilter, FILTER_NAMES } from '../../examples/image-filter-lab/filters.js';

test('image filters preserve source bytes, layout, and alpha', () => {
  const source = new Frame({ width: 2, height: 1, pixels: Buffer.from([10, 20, 30, 77, 240, 100, 40, 199]) });
  const original = Buffer.from(source.pixels);
  for (const name of FILTER_NAMES) {
    const result = applyFilter(source, name, { threshold: 100 });
    assert.notEqual(result, source);
    assert.deepEqual([result.width, result.height, result.stride], [2, 1, 8]);
    assert.deepEqual([result.pixels[3], result.pixels[7]], [77, 199]);
  }
  const grayscale = applyFilter(source, 'grayscale');
  assert.equal(grayscale.pixels[0], grayscale.pixels[1]);
  assert.equal(grayscale.pixels[1], grayscale.pixels[2]);
  const threshold = applyFilter(source, 'threshold', { threshold: 100 });
  assert.ok([0, 255].includes(threshold.pixels[0]));
  assert.deepEqual(source.pixels, original);
});

test('image filter lab changes filters and threshold through pointer input', async () => {
  const app = createImageFilterLab();
  try {
    const invert = FILTER_BUTTONS.find(item => item.name === 'invert').rect;
    await app.pointer({ type: 'click', x: invert.x + 2, y: invert.y + 2, button: 0 });
    assert.equal(app.snapshot().filter, 'invert');
    await app.pointer({ type: 'down', x: FILTER_SLIDER.x + 10, y: FILTER_SLIDER.y + 10, button: 0 });
    await app.pointer({ type: 'move', x: FILTER_SLIDER.x + FILTER_SLIDER.width - 10, y: FILTER_SLIDER.y + 10, button: 0 });
    await app.pointer({ type: 'up', x: FILTER_SLIDER.x + FILTER_SLIDER.width - 10, y: FILTER_SLIDER.y + 10, button: 0 });
    assert.equal(app.snapshot().filter, 'threshold');
    assert.ok(app.snapshot().threshold > 240);
  } finally {
    await app.dispose();
  }
});
