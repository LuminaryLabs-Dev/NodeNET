import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { extractArchive } from '../../src/dotnet/archive.js';

function writeString(buf, offset, length, value) {
  Buffer.from(value).copy(buf, offset, 0, Math.min(length, Buffer.byteLength(value)));
}

function tarEntry(name, content, mode = 0o644) {
  const data = Buffer.from(content);
  const header = Buffer.alloc(512);
  writeString(header, 0, 100, name);
  writeString(header, 100, 8, `${mode.toString(8).padStart(7, '0')}\0`);
  writeString(header, 108, 8, '0000000\0');
  writeString(header, 116, 8, '0000000\0');
  writeString(header, 124, 12, `${data.length.toString(8).padStart(11, '0')}\0`);
  writeString(header, 136, 12, '00000000000\0');
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeString(header, 257, 6, 'ustar\0');
  writeString(header, 263, 2, '00');
  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
  const padding = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([header, data, padding]);
}

function makeTarGz(entries) {
  const tar = Buffer.concat([...entries.map(([n, c]) => tarEntry(n, c)), Buffer.alloc(1024)]);
  return zlib.gzipSync(tar);
}

function makeStoredZip(name, content) {
  const nameBuf = Buffer.from(name);
  const data = Buffer.from(content);
  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0, 6);
  local.writeUInt16LE(0, 8);
  local.writeUInt32LE(0, 14);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(data.length, 22);
  local.writeUInt16LE(nameBuf.length, 26);
  nameBuf.copy(local, 30);

  const central = Buffer.alloc(46 + nameBuf.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(0, 8);
  central.writeUInt16LE(0, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(data.length, 24);
  central.writeUInt16LE(nameBuf.length, 28);
  central.writeUInt32LE((0o100644 * 65536) >>> 0, 38);
  central.writeUInt32LE(0, 42);
  nameBuf.copy(central, 46);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(central.length, 12);
  eocd.writeUInt32LE(local.length + data.length, 16);
  return Buffer.concat([local, data, central, eocd]);
}

test('built-in tar.gz extractor writes files without shell tools', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-tar-'));
  const archive = path.join(root, 'sample.tar.gz');
  const output = path.join(root, 'out');
  try {
    await fs.writeFile(archive, makeTarGz([['sdk/file.txt', 'hello tar']]));
    await extractArchive(archive, output);
    assert.equal(await fs.readFile(path.join(output, 'sdk', 'file.txt'), 'utf8'), 'hello tar');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('built-in zip extractor writes files without PowerShell', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-zip-'));
  const archive = path.join(root, 'sample.zip');
  const output = path.join(root, 'out');
  try {
    await fs.writeFile(archive, makeStoredZip('sdk/file.txt', 'hello zip'));
    await extractArchive(archive, output);
    assert.equal(await fs.readFile(path.join(output, 'sdk', 'file.txt'), 'utf8'), 'hello zip');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
