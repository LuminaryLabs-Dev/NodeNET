import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { captureByName, loadScenario, replayScenario } from '../_shared/input-scenario.js';
import { countChangedPixels, writeJson } from '../_shared/validation.js';
import { createFramebufferPaint } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function runFramebufferPaint({ outputDirectory = path.resolve('artifacts/examples/framebuffer-paint') } = {}) {
  const app = createFramebufferPaint();
  try {
    const scenario = await loadScenario(path.join(here, 'scenario.json'));
    const result = await replayScenario(app, scenario, outputDirectory);
    const initial = captureByName(result, 'initial');
    const first = captureByName(result, 'first-stroke');
    const painted = captureByName(result, 'painted');
    const undo = captureByName(result, 'undo');
    const cleared = captureByName(result, 'cleared');
    const initialFrame = result.frames.get('initial');
    const paintedFrame = result.frames.get('painted');
    const undoFrame = result.frames.get('undo');

    assert.equal(initial.state.strokeCount, 0);
    assert.equal(first.state.strokeCount, 1);
    assert.ok(first.state.segmentCount >= 3);
    assert.equal(painted.state.strokeCount, 2);
    assert.ok(painted.state.segmentCount > first.state.segmentCount);
    assert.equal(undo.state.strokeCount, 1);
    assert.equal(cleared.state.strokeCount, 0);
    assert.equal(cleared.state.segmentCount, 0);
    assert.notEqual(initial.rawSha256, painted.rawSha256);
    assert.notEqual(painted.rawSha256, undo.rawSha256);
    assert.equal(initial.rawSha256, cleared.rawSha256);

    const verification = {
      app: 'framebuffer-paint',
      provider: app.display.kind,
      inputPath: 'FrameSurface.pointer',
      scenario: scenario.name,
      pointerEvents: app.inputCounts.pointer,
      changedPixels: countChangedPixels(initialFrame, paintedFrame),
      undoChangedPixels: countChangedPixels(paintedFrame, undoFrame),
      clearRestoredInitialFrame: initial.rawSha256 === cleared.rawSha256,
      captures: result.captures,
      pass: true
    };
    await writeJson(path.join(outputDirectory, 'verification.json'), verification);
    return { status: 'PASS', verification, previewFrame: paintedFrame.clone() };
  } finally {
    await app.dispose();
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new TypeError('--output requires a directory.');
  const outputDirectory = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : undefined;
  const result = await runFramebufferPaint({ outputDirectory });
  process.stdout.write(`${JSON.stringify(result.verification, null, 2)}\n`);
}
