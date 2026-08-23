import test from 'node:test';
import assert from 'node:assert/strict';
import { createKeyboardNotepad, NOTEPAD_CLEAR, NOTEPAD_EDITOR } from '../../examples/keyboard-notepad/app.js';
import { TextBuffer } from '../../examples/keyboard-notepad/text-buffer.js';

test('TextBuffer edits at the caret and respects line boundaries', () => {
  const buffer = new TextBuffer();
  buffer.insert('ab').enter().insert('cd').home().insert('!').end().backspace();
  assert.equal(buffer.text, 'ab\n!c');
  assert.deepEqual(buffer.caretPosition, { line: 1, column: 2 });
  buffer.left().delete();
  assert.equal(buffer.text, 'ab\n!');
  buffer.clear();
  assert.deepEqual(buffer.snapshot(), {
    text: '', caret: 0, caretPosition: { line: 0, column: 0 }, characterCount: 0, lineCount: 1
  });
});

test('keyboard notepad requires focus and processes public key events', async () => {
  const app = createKeyboardNotepad();
  try {
    await app.key({ type: 'text', key: 'ignored', code: '' });
    assert.equal(app.snapshot().text, '');
    await app.pointer({ type: 'click', x: NOTEPAD_EDITOR.x + 10, y: NOTEPAD_EDITOR.y + 10, button: 0 });
    await app.key({ type: 'text', key: 'ab', code: '' });
    await app.key({ type: 'down', key: 'Enter', code: 'Enter' });
    const sequence = app.surface.sequence;
    await app.key({ type: 'up', key: 'Enter', code: 'Enter' });
    assert.equal(app.surface.sequence, sequence, 'Key-up must not duplicate text editing.');
    await app.key({ type: 'text', key: 'c', code: 'KeyC' });
    assert.equal(app.snapshot().text, 'ab\nc');
    await app.pointer({ type: 'click', x: NOTEPAD_CLEAR.x + 5, y: NOTEPAD_CLEAR.y + 5, button: 0 });
    assert.equal(app.snapshot().text, '');
    assert.equal(app.snapshot().focused, false);
  } finally {
    await app.dispose();
  }
});
