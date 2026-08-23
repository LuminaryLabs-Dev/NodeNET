import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Frame, SoftwareRasterizer } from '../../src/index.js';
import { captureByName, loadScenario, replayScenario } from '../_shared/input-scenario.js';
import { countChangedPixels, saveFrameArtifact, writeJson } from '../_shared/validation.js';
import { drawSoftwareText } from '../_shared/software-text.js';
import { createImageFilterLab } from './app.js';
import { applyFilter } from './filters.js';

const here = path.dirname(fileURLToPath(import.meta.url));

async function contactSheet(source, outputDirectory) {
  const items = [
    ['ORIGINAL', applyFilter(source, 'original')],
    ['INVERT', applyFilter(source, 'invert')],
    ['GRAYSCALE', applyFilter(source, 'grayscale')],
    ['THRESHOLD', applyFilter(source, 'threshold', { threshold: 220 })],
    ['SEPIA', applyFilter(source, 'sepia')]
  ];
  const frame = new Frame({ width: 832, height: 590 });
  const draw = new SoftwareRasterizer(frame);
  draw.clear([10, 15, 30, 255]);
  for (const [index, [label, item]] of items.entries()) {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const x = 16 + column * 272;
    const y = 18 + row * 286;
    drawSoftwareText(draw, label, x, y, [240, 246, 255, 255]);
    draw.blit(item, x, y + 18);
  }
  const record = await saveFrameArtifact(frame, path.join(outputDirectory, 'contact-sheet.png'));
  return { frame, record };
}

export async function runImageFilterLab({ outputDirectory = path.resolve('artifacts/examples/image-filter-lab') } = {}) {
  const app = createImageFilterLab();
  try {
    const scenario = await loadScenario(path.join(here, 'scenario.json'));
    const result = await replayScenario(app, scenario, outputDirectory);
    const original = captureByName(result, 'original');
    const invert = captureByName(result, 'invert');
    const grayscale = captureByName(result, 'grayscale');
    const low = captureByName(result, 'threshold-low');
    const high = captureByName(result, 'threshold-high');
    const sepia = captureByName(result, 'sepia');
    const restored = captureByName(result, 'restored-original');
    const sourceHashes = new Set(result.captures.map(capture => capture.state.sourceHash));
    const filteredCaptures = [original, invert, grayscale, low, high, sepia, restored];

    assert.equal(sourceHashes.size, 1, 'Filters must never mutate the source frame.');
    assert.equal(filteredCaptures.every(capture => capture.state.resultOpaque), true, 'Every live filter result must preserve opaque alpha.');
    assert.equal(original.state.filter, 'original');
    assert.equal(invert.state.filter, 'invert');
    assert.equal(grayscale.state.filter, 'grayscale');
    assert.equal(low.state.filter, 'threshold');
    assert.equal(high.state.filter, 'threshold');
    assert.notEqual(low.state.threshold, high.state.threshold);
    assert.notEqual(low.state.resultHash, high.state.resultHash);
    assert.equal(sepia.state.filter, 'sepia');
    assert.equal(restored.state.resultHash, restored.state.sourceHash);
    for (const capture of [invert, grayscale, low, high, sepia]) assert.notEqual(capture.state.resultHash, capture.state.sourceHash);
    assert.equal(original.state.resultHash, restored.state.resultHash);

    const contact = await contactSheet(app.state.source, outputDirectory);
    const verification = {
      app: 'image-filter-lab',
      provider: app.display.kind,
      inputPath: 'FrameSurface.pointer',
      scenario: scenario.name,
      pointerEvents: app.inputCounts.pointer,
      sourcePreserved: sourceHashes.size === 1,
      alphaPreserved: filteredCaptures.every(capture => capture.state.resultOpaque),
      changedPixels: countChangedPixels(result.frames.get('original'), result.frames.get('sepia')),
      contactSheet: contact.record,
      captures: result.captures,
      pass: true
    };
    await writeJson(path.join(outputDirectory, 'verification.json'), verification);
    return { status: 'PASS', verification, previewFrame: result.frames.get('sepia').clone() };
  } finally {
    await app.dispose();
  }
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] ?? '')) {
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new TypeError('--output requires a directory.');
  const outputDirectory = outputIndex >= 0 ? path.resolve(process.argv[outputIndex + 1]) : undefined;
  const result = await runImageFilterLab({ outputDirectory });
  process.stdout.write(`${JSON.stringify(result.verification, null, 2)}\n`);
}
