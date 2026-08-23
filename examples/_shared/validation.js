import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Frame, savePng } from '../../src/index.js';
import { inspectPng } from '../../scripts/lib/validation-artifacts.mjs';

export function frameSha256(frame) {
  if (!(frame instanceof Frame)) throw new TypeError('frameSha256 expects a Frame.');
  return crypto.createHash('sha256').update(frame.pixels).digest('hex');
}

export function countChangedPixels(left, right) {
  if (!(left instanceof Frame) || !(right instanceof Frame)) throw new TypeError('Pixel comparison expects Frame values.');
  if (left.width !== right.width || left.height !== right.height || left.stride !== right.stride) {
    throw new RangeError('Compared frames must have matching layouts.');
  }
  let changed = 0;
  for (let offset = 0; offset < left.pixels.length; offset += 4) {
    if (left.pixels[offset] !== right.pixels[offset]
      || left.pixels[offset + 1] !== right.pixels[offset + 1]
      || left.pixels[offset + 2] !== right.pixels[offset + 2]
      || left.pixels[offset + 3] !== right.pixels[offset + 3]) changed += 1;
  }
  return changed;
}

export function countNonOpaquePixels(frame) {
  if (!(frame instanceof Frame)) throw new TypeError('Alpha validation expects a Frame.');
  let count = 0;
  for (let offset = 3; offset < frame.pixels.length; offset += 4) if (frame.pixels[offset] !== 255) count += 1;
  return count;
}

export function validateFrame(frame, { width, height } = {}) {
  if (!(frame instanceof Frame)) throw new TypeError('Expected a NodeNET Frame.');
  if (frame.format !== 'rgba8' || frame.stride !== frame.width * 4) throw new Error('Example frame is not tightly packed RGBA8.');
  if (width !== undefined && frame.width !== width) throw new Error(`Expected frame width ${width}, received ${frame.width}.`);
  if (height !== undefined && frame.height !== height) throw new Error(`Expected frame height ${height}, received ${frame.height}.`);
  if (countNonOpaquePixels(frame) !== 0) throw new Error('Example frames must be fully opaque.');
  return frame;
}

export async function saveFrameArtifact(frame, file) {
  validateFrame(frame);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await savePng(frame, file);
  const png = await inspectPng(file);
  const bytes = await fs.readFile(file);
  if (bytes[24] !== 8 || bytes[25] !== 6) throw new Error(`${path.basename(file)} is not an 8-bit RGBA PNG.`);
  return Object.freeze({
    ...png,
    format: frame.format,
    rawSha256: frameSha256(frame),
    rawBytes: frame.byteLength
  });
}

export async function captureSurface(surface, file) {
  const frame = validateFrame(surface.capture());
  const record = await saveFrameArtifact(frame, file);
  return { frame, record };
}

export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
  return value;
}
