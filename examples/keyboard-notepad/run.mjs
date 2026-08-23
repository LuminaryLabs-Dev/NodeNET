import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureByName, loadScenario, replayScenario } from '../_shared/input-scenario.js';
import { countChangedPixels, writeJson } from '../_shared/validation.js';
import { createKeyboardNotepad } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function runKeyboardNotepad({ outputDirectory = path.resolve('artifacts/examples/keyboard-notepad') } = {}) {
  const app = createKeyboardNotepad();
  try {
    const scenario = await loadScenario(path.join(here, 'scenario.json'));
    const result = await replayScenario(app, scenario, outputDirectory);
    const initial = captureByName(result, 'initial');
    const focused = captureByName(result, 'focused');
    const typed = captureByName(result, 'typed');
    const edited = captureByName(result, 'edited');
    const cleared = captureByName(result, 'cleared');

    assert.equal(initial.state.text, '');
    assert.equal(focused.state.text, '', 'Text sent before focus must be ignored.');
    assert.equal(focused.state.focused, true);
    assert.equal(typed.state.text, 'NodeNET\nworks');
    assert.equal(typed.state.lineCount, 2);
    assert.equal(edited.state.text, 'NodeNET\nwork!s');
    assert.equal(edited.state.characterCount, 14);
    assert.equal(cleared.state.text, '');
    assert.equal(cleared.state.focused, false);
    assert.notEqual(initial.rawSha256, focused.rawSha256);
    assert.notEqual(focused.rawSha256, typed.rawSha256);
    assert.notEqual(typed.rawSha256, edited.rawSha256);
    assert.equal(initial.rawSha256, cleared.rawSha256);

    const initialFrame = result.frames.get('initial');
    const editedFrame = result.frames.get('edited');
    const verification = {
      app: 'keyboard-notepad',
      provider: app.display.kind,
      inputPath: 'FrameSurface.key',
      scenario: scenario.name,
      keyEvents: app.inputCounts.key,
      pointerEvents: app.inputCounts.pointer,
      actualText: edited.state.text,
      changedPixels: countChangedPixels(initialFrame, editedFrame),
      clearRestoredInitialFrame: initial.rawSha256 === cleared.rawSha256,
      captures: result.captures,
      pass: true
    };
    await writeJson(path.join(outputDirectory, 'verification.json'), verification);
    return { status: 'PASS', verification, previewFrame: editedFrame.clone() };
  } finally {
    await app.dispose();
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new TypeError('--output requires a directory.');
  const outputDirectory = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : undefined;
  const result = await runKeyboardNotepad({ outputDirectory });
  process.stdout.write(`${JSON.stringify(result.verification, null, 2)}\n`);
}
