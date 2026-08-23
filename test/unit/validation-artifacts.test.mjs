import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Frame, SoftwareRasterizer, encodePng } from '../../src/index.js';
import { createZip, inspectPng, overallVerdict } from '../../scripts/lib/validation-artifacts.mjs';

function readStoredZipEntries(bytes) {
  const entries = new Map();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18);
    const nameLength = bytes.readUInt16LE(offset + 26);
    const extraLength = bytes.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = bytes.subarray(nameStart, nameStart + nameLength).toString('utf8');
    entries.set(name, bytes.subarray(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}

test('validation verdict keeps required failures, blocks, and skips distinct', () => {
  assert.equal(overallVerdict([{ required: true, status: 'PASS' }]), 'PASS');
  assert.equal(overallVerdict([{ required: true, status: 'BLOCKED' }]), 'BLOCKED');
  assert.equal(overallVerdict([{ required: true, status: 'SKIPPED' }]), 'BLOCKED');
  assert.equal(overallVerdict([{ required: true, status: 'FAIL' }, { required: true, status: 'BLOCKED' }]), 'FAIL');
  assert.equal(overallVerdict([{ required: true, status: 'PASS' }, { required: false, status: 'SKIPPED' }]), 'PASS');
});

test('validation PNG inspection checks complete dimensions and content hash', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-png-inspect-'));
  try {
    const frame = new Frame({ width: 3, height: 2 });
    new SoftwareRasterizer(frame).clear([12, 34, 56, 255]);
    const file = path.join(directory, 'frame.png');
    await fs.writeFile(file, encodePng(frame));
    const inspected = await inspectPng(file);
    assert.equal(inspected.width, 3);
    assert.equal(inspected.height, 2);
    assert.match(inspected.sha256, /^[a-f0-9]{64}$/);
    const corrupted = Buffer.from(await fs.readFile(file));
    corrupted[29] ^= 0xff;
    await fs.writeFile(path.join(directory, 'corrupted.png'), corrupted);
    await assert.rejects(() => inspectPng(path.join(directory, 'corrupted.png')), /checksum/);
    await fs.writeFile(path.join(directory, 'truncated.png'), (await fs.readFile(file)).subarray(0, 24));
    await assert.rejects(() => inspectPng(path.join(directory, 'truncated.png')), /valid PNG|IEND/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('dependency-free report ZIP contains files and excludes itself', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-report-zip-'));
  try {
    await fs.mkdir(path.join(directory, 'nested'));
    await fs.writeFile(path.join(directory, 'REPORT.md'), '# pass\n');
    await fs.writeFile(path.join(directory, 'nested', 'summary.json'), '{"pass":true}\n');
    const zip = path.join(directory, 'nodenet-local-validation.zip');
    const result = await createZip(directory, zip);
    assert.equal(result.entries, 2);
    assert.match(result.sha256, /^[a-f0-9]{64}$/);
    const bytes = await fs.readFile(zip);
    assert.equal(bytes.readUInt32LE(0), 0x04034b50);
    assert.equal(bytes.readUInt32LE(bytes.length - 22), 0x06054b50);
    const entries = readStoredZipEntries(bytes);
    assert.deepEqual([...entries.keys()].sort(), ['REPORT.md', 'nested/summary.json'].sort());
    assert.equal(entries.get('REPORT.md').toString('utf8'), '# pass\n');
    assert.equal(entries.has('nodenet-local-validation.zip'), false);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
