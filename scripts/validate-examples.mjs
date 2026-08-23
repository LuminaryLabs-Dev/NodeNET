import fs from 'node:fs/promises';
import path from 'node:path';
import { Frame, SoftwareRasterizer } from '../src/index.js';
import { drawSoftwareText } from '../examples/_shared/software-text.js';
import { saveFrameArtifact, writeJson } from '../examples/_shared/validation.js';
import { runFramebufferPaint } from '../examples/framebuffer-paint/run.mjs';
import { runKeyboardNotepad } from '../examples/keyboard-notepad/run.mjs';
import { runImageFilterLab } from '../examples/image-filter-lab/run.mjs';
import { runSelfContainedApp } from '../examples/self-contained-app/run.mjs';

const outputIndex = process.argv.indexOf('--output');
if (outputIndex >= 0 && !process.argv[outputIndex + 1]) throw new TypeError('--output requires a directory.');
const outputRoot = path.resolve(outputIndex >= 0 ? process.argv[outputIndex + 1] : 'artifacts/examples');

const applications = [
  ['framebuffer-paint', runFramebufferPaint],
  ['keyboard-notepad', runKeyboardNotepad],
  ['image-filter-lab', runImageFilterLab],
  ['self-contained-app', runSelfContainedApp]
];

for (const [name] of applications) await fs.rm(path.join(outputRoot, name), { recursive: true, force: true });
for (const file of ['REPORT.md', 'summary.json', 'contact-sheet.png']) await fs.rm(path.join(outputRoot, file), { force: true });
await fs.mkdir(outputRoot, { recursive: true });

const outcomes = [];
for (const [name, run] of applications) {
  const started = Date.now();
  try {
    const result = await run({ outputDirectory: path.join(outputRoot, name) });
    outcomes.push({
      name,
      status: result.status,
      durationMs: Date.now() - started,
      verification: path.join(name, 'verification.json'),
      result
    });
  } catch (error) {
    outcomes.push({
      name,
      status: 'FAIL',
      durationMs: Date.now() - started,
      error: { name: error.name, message: error.message, stack: error.stack }
    });
  }
}

const passed = outcomes.filter(outcome => outcome.status === 'PASS');
let contactSheet = null;
if (passed.length) {
  const tileWidth = Math.max(...passed.map(outcome => outcome.result.previewFrame.width));
  const tileHeight = Math.max(...passed.map(outcome => outcome.result.previewFrame.height));
  const columns = 2;
  const rows = Math.ceil(passed.length / columns);
  const sheet = new Frame({ width: columns * tileWidth + 48, height: rows * (tileHeight + 34) + 16 });
  const draw = new SoftwareRasterizer(sheet);
  draw.clear([5, 9, 20, 255]);
  for (const [index, outcome] of passed.entries()) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = 16 + column * (tileWidth + 16);
    const y = 12 + row * (tileHeight + 34);
    drawSoftwareText(draw, outcome.name.toUpperCase(), x, y, [240, 246, 255, 255]);
    draw.blit(outcome.result.previewFrame, x, y + 18);
  }
  contactSheet = await saveFrameArtifact(sheet, path.join(outputRoot, 'contact-sheet.png'));
}

const overall = outcomes.every(outcome => outcome.status === 'PASS') ? 'PASS' : 'FAIL';
const summary = {
  overall,
  createdAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, architecture: process.arch },
  inputContract: ['FrameSurface.pointer', 'FrameSurface.key'],
  rendering: 'live-software-framebuffer',
  staticGoldenImages: false,
  contactSheet,
  applications: outcomes.map(({ result, ...outcome }) => ({
    ...outcome,
    pass: result?.verification?.pass === true
  }))
};
await writeJson(path.join(outputRoot, 'summary.json'), summary);

const report = [
  '# NodeNET Example Validation',
  '',
  `Overall: **${overall}**`,
  '',
  `Environment: ${process.version} on ${process.platform}-${process.arch}`,
  '',
  '| Application | Status | Duration | Evidence |',
  '| --- | --- | ---: | --- |',
  ...outcomes.map(outcome => `| ${outcome.name} | ${outcome.status} | ${outcome.durationMs} ms | ${outcome.verification ?? outcome.error?.message ?? 'Unavailable'} |`),
  '',
  'Every application was driven through public FrameSurface pointer/key input and rendered fresh RGBA8 frames. No checked-in screenshot was used as a runtime oracle.',
  ''
].join('\n');
await fs.writeFile(path.join(outputRoot, 'REPORT.md'), report);

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
if (overall !== 'PASS') process.exitCode = 1;
