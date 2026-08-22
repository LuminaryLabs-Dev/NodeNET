import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  Frame,
  FrameSurface,
  NodeNET,
  SoftwareDisplayService,
  SoftwareRasterizer,
  encodePng,
  normalizeKeyEvent,
  normalizePointerEvent
} from '../../src/index.js';
import { runDisplayProof } from '../../examples/display-calculator/calculator.js';

test('Frame owns exact RGBA8 pixels and rejects malformed layouts', () => {
  const source = Buffer.alloc(16, 7);
  const frame = new Frame({ width: 2, height: 2, pixels: source });
  source[0] = 99;
  assert.equal(frame.pixels[0], 7);
  assert.equal(frame.stride, 8);
  assert.equal(frame.byteLength, 16);
  assert.throws(() => new Frame({ width: 2, height: 2, stride: 16 }), /stride/);
  assert.throws(() => new Frame({ width: 2, height: 2, pixels: Buffer.alloc(15) }), /exactly 16/);
  assert.throws(() => new Frame({ width: 20_000, height: 1 }), /maximum frame dimension/);
  assert.throws(() => new Frame({ width: 100, height: 100, maxBytes: 100 }), /allocation/);
  assert.throws(() => new Frame({ width: 1, height: 1, maxBytes: Number.NaN }), /byte limit/);
  assert.throws(() => new Frame({ width: 1, height: 1, maxBytes: 256 * 1024 * 1024 + 1 }), /byte limit/);
});

test('FrameSurface is lazy and capture never presents a frame', () => {
  const surface = new FrameSurface({ width: 3, height: 2 });
  assert.equal(surface.allocated, false);
  assert.equal(surface.sequence, 0);
  const draw = surface.rasterizer();
  assert.equal(surface.allocated, true);
  draw.clear([10, 20, 30, 255]);
  surface.present({ stage: 'initial' });
  const sequence = surface.sequence;
  const capture = surface.capture();
  assert.equal(surface.sequence, sequence);
  capture.pixels[0] = 200;
  assert.equal(surface.capture().pixels[0], 10);
});

test('FrameSurface normalizes key input, resizes, and closes deterministically', async () => {
  const calls = [];
  const surface = new FrameSurface({
    width: 4,
    height: 4,
    handlers: {
      key: input => calls.push(['key', input]),
      resize: size => calls.push(['resize', size]),
      dispose: () => calls.push(['dispose'])
    }
  });
  await surface.key({ type: 'down', key: 'Enter', code: 'Enter' });
  surface.rasterizer().clear([1, 2, 3, 255]);
  await surface.resize(8, 6);
  assert.equal(surface.allocated, false);
  assert.deepEqual([surface.width, surface.height, surface.stride], [8, 6, 32]);
  await surface.dispose();
  assert.equal(surface.disposed, true);
  assert.deepEqual(calls.map(call => call[0]), ['key', 'resize', 'dispose']);
  await assert.rejects(() => surface.pointer({ type: 'click', x: 0, y: 0 }), /disposed/);
});

test('software rasterizer clears alpha and clips primitives deterministically', () => {
  const frame = new Frame({ width: 8, height: 8, pixels: Buffer.alloc(8 * 8 * 4, 255) });
  const draw = new SoftwareRasterizer(frame);
  draw.clear([0, 0, 0, 0]);
  assert.ok(frame.pixels.every(byte => byte === 0));
  draw.fillRect(-2, -2, 5, 5, [1, 2, 3, 255]);
  draw.line(-5, 7, 12, 7, [9, 8, 7, 255]);
  draw.roundedRect(2, 2, 5, 5, 2, [30, 40, 50, 255]);
  draw.text('19', 0, 0, [255, 255, 255, 255]);
  assert.equal(frame.pixels.length, 256);
  assert.equal(frame.pixels[7 * frame.stride + 3], 255);
});

test('PNG encoding is valid and deterministic', () => {
  const frame = new Frame({ width: 2, height: 3 });
  new SoftwareRasterizer(frame).clear([11, 22, 33, 255]);
  const first = encodePng(frame);
  const second = encodePng(frame);
  assert.deepEqual(first, second);
  assert.deepEqual([...first.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(first.readUInt32BE(16), 2);
  assert.equal(first.readUInt32BE(20), 3);
});

test('display input normalization rejects ambiguous values', () => {
  assert.deepEqual(normalizePointerEvent({ type: 'click', x: 2.5, y: 4 }), {
    type: 'click', x: 2.5, y: 4, button: 0,
    modifiers: { alt: false, control: false, meta: false, shift: false }
  });
  assert.equal(normalizeKeyEvent({ type: 'text', key: 'A' }).key, 'A');
  assert.throws(() => normalizePointerEvent({ type: 'click', x: Number.NaN, y: 0 }), /finite/);
  assert.throws(() => normalizeKeyEvent({ type: 'text', key: '' }), /non-empty/);
});

test('default DisplayService is lazy, replaceable, and exposed by NodeNET', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-display-'));
  const net = await NodeNET.attach(directory, { writeState: false });
  try {
    const capabilities = await net.capabilities();
    assert.equal(capabilities.display.kind, 'software-framebuffer');
    const surface = await net.display({ width: 16, height: 9 });
    assert.equal(surface.allocated, false);
    assert.equal(net.services.display.surfaces.size, 1);
  } finally {
    await net.dispose();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('software calculator acceptance produces 12 + 7 = 19 evidence', async () => {
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-display-proof-'));
  try {
    const verification = await runDisplayProof(output);
    assert.equal(verification.pass, true);
    assert.equal(verification.actual, '19');
    for (const file of ['calculator-initial.png', 'calculator-12-plus-7.png', 'calculator-result-19.png', 'verification.json']) {
      assert.ok((await fs.stat(path.join(output, file))).isFile());
    }
  } finally { await fs.rm(output, { recursive: true, force: true }); }
});

test('software display service disposes every tracked surface', async () => {
  const display = new SoftwareDisplayService();
  const first = display.createSurface({ width: 2, height: 2 });
  const second = display.createSurface({ width: 2, height: 2 });
  await display.dispose();
  assert.equal(first.disposed, true);
  assert.equal(second.disposed, true);
});

test('surface cleanup completes even when an adapter disposal request fails', async () => {
  const surface = new FrameSurface({
    width: 2,
    height: 2,
    handlers: { dispose() { throw new Error('adapter closed'); } }
  });
  await assert.rejects(() => surface.dispose(), /adapter closed/);
  assert.equal(surface.disposed, true);
  assert.equal(surface.allocated, false);
});
