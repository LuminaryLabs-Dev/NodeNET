import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageVersion } from '../../src/version.js';
import { captureByName, loadScenario, replayScenario } from '../_shared/input-scenario.js';
import { countChangedPixels, writeJson } from '../_shared/validation.js';
import { createNodeNETStudio } from './app.js';

const here = path.dirname(fileURLToPath(import.meta.url));

export async function runSelfContainedApp({ outputDirectory = path.resolve('artifacts/examples/self-contained-app') } = {}) {
  const app = createNodeNETStudio({ version: await packageVersion() });
  try {
    const scenario = await loadScenario(path.join(here, 'scenario.json'));
    const result = await replayScenario(app, scenario, outputDirectory);
    const home = captureByName(result, 'home');
    const canvas = captureByName(result, 'canvas');
    const notes = captureByName(result, 'notes');
    const filters = captureByName(result, 'filters');
    const restoredCanvas = captureByName(result, 'restored-canvas');
    const restoredNotes = captureByName(result, 'restored-notes');
    const about = captureByName(result, 'about');
    const final = captureByName(result, 'final');

    assert.equal(home.state.activeScreen, 'home');
    assert.equal(canvas.state.activeScreen, 'canvas');
    assert.equal(canvas.state.canvas.strokeCount, 1);
    assert.equal(notes.state.activeScreen, 'notes');
    assert.equal(notes.state.notes.text, 'Studio note');
    assert.equal(filters.state.activeScreen, 'filters');
    assert.equal(filters.state.filters.filter, 'grayscale');
    assert.equal(restoredCanvas.state.canvas.strokeCount, 1);
    assert.equal(restoredNotes.state.notes.text, 'Studio note');
    assert.equal(about.state.activeScreen, 'about');
    assert.equal(about.state.provider, 'software-framebuffer');
    assert.equal(final.state.activeScreen, 'home');
    assert.equal(final.state.canvas.strokeCount, 1);
    assert.equal(final.state.notes.text, 'Studio note');
    assert.equal(final.state.filters.filter, 'grayscale');
    assert.ok(final.state.activity.includes('Canvas stroke completed'));
    assert.ok(final.state.activity.includes('Note edited'));
    assert.ok(final.state.activity.includes('Filter grayscale'));
    assert.equal(new Set([home, canvas, notes, filters, about].map(capture => capture.rawSha256)).size, 5);

    const verification = {
      app: 'self-contained-app',
      displayName: 'NodeNET Studio',
      provider: app.display.kind,
      inputPaths: ['FrameSurface.pointer', 'FrameSurface.key'],
      scenario: scenario.name,
      pointerEvents: app.inputCounts.pointer,
      keyEvents: app.inputCounts.key,
      retainedState: {
        canvasStrokeCount: final.state.canvas.strokeCount,
        note: final.state.notes.text,
        filter: final.state.filters.filter
      },
      screenHashesDistinct: true,
      changedPixels: countChangedPixels(result.frames.get('home'), result.frames.get('final')),
      activity: final.state.activity,
      captures: result.captures,
      pass: true
    };
    await writeJson(path.join(outputDirectory, 'verification.json'), verification);
    return { status: 'PASS', verification, previewFrame: result.frames.get('final').clone() };
  } finally {
    await app.dispose();
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new TypeError('--output requires a directory.');
  const outputDirectory = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : undefined;
  const result = await runSelfContainedApp({ outputDirectory });
  process.stdout.write(`${JSON.stringify(result.verification, null, 2)}\n`);
}
