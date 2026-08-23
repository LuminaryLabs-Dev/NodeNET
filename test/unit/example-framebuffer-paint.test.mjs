import test from 'node:test';
import assert from 'node:assert/strict';
import { createFramebufferPaint, PAINT_BRUSHES, PAINT_CLEAR, PAINT_PALETTE, PAINT_UNDO } from '../../examples/framebuffer-paint/app.js';

test('framebuffer paint uses public pointer input for drawing, undo, and reset', async () => {
  const app = createFramebufferPaint();
  try {
    await app.pointer({ type: 'down', x: 20, y: 20, button: 0 });
    await app.pointer({ type: 'move', x: 100, y: 120, button: 0 });
    await app.pointer({ type: 'up', x: 120, y: 150, button: 0 });
    assert.equal(app.snapshot().strokeCount, 0, 'Toolbar input must not draw.');

    const palette = PAINT_PALETTE[1].rect;
    const brush = PAINT_BRUSHES[2].rect;
    await app.pointer({ type: 'click', x: palette.x + 2, y: palette.y + 2, button: 0 });
    await app.pointer({ type: 'click', x: brush.x + 2, y: brush.y + 2, button: 0 });
    await app.pointer({ type: 'down', x: 50, y: 150, button: 0 });
    await app.pointer({ type: 'move', x: 100, y: 220, button: 0 });
    await app.pointer({ type: 'up', x: 180, y: 180, button: 0 });
    assert.deepEqual(app.snapshot().strokes, [{ color: 'MINT', size: 5, points: 3 }]);

    await app.pointer({ type: 'click', x: PAINT_UNDO.x + 2, y: PAINT_UNDO.y + 2, button: 0 });
    assert.equal(app.snapshot().strokeCount, 0);
    await app.pointer({ type: 'click', x: PAINT_CLEAR.x + 2, y: PAINT_CLEAR.y + 2, button: 0 });
    assert.equal(app.snapshot().brushColor, 'INK');
    assert.equal(app.snapshot().brushSize, 3);
  } finally {
    await app.dispose();
  }
  assert.equal(app.surface.disposed, true);
});
