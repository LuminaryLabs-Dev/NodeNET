import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { DotnetProvisionError } from '../errors.js';

function ensureInside(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  if (resolved !== resolvedRoot && !resolved.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new DotnetProvisionError(`Archive entry escapes extraction root: ${candidate}`);
  }
  return resolved;
}

function cleanArchivePath(name) {
  const normalized = name.replaceAll('\\', '/').replace(/^\.\//, '');
  if (!normalized || normalized === '.') return '';
  if (normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized)) {
    throw new DotnetProvisionError(`Archive contains an absolute path: ${name}`);
  }
  const parts = normalized.split('/');
  if (parts.some(part => part === '..')) {
    throw new DotnetProvisionError(`Archive contains path traversal: ${name}`);
  }
  return normalized;
}

function parseOctal(buffer, start, length) {
  const raw = buffer.subarray(start, start + length).toString('utf8').replace(/\0.*$/, '').trim();
  return raw ? Number.parseInt(raw, 8) : 0;
}

function parsePax(buffer) {
  const text = buffer.toString('utf8');
  const result = {};
  let offset = 0;
  while (offset < text.length) {
    const space = text.indexOf(' ', offset);
    if (space < 0) break;
    const length = Number.parseInt(text.slice(offset, space), 10);
    if (!Number.isFinite(length) || length <= 0) break;
    const record = text.slice(space + 1, offset + length - 1);
    const eq = record.indexOf('=');
    if (eq > 0) result[record.slice(0, eq)] = record.slice(eq + 1);
    offset += length;
  }
  return result;
}

async function readRange(fileHandle, position, size) {
  const buffer = Buffer.alloc(size);
  let read = 0;
  while (read < size) {
    const { bytesRead } = await fileHandle.read(buffer, read, size - read, position + read);
    if (bytesRead === 0) break;
    read += bytesRead;
  }
  return read === size ? buffer : buffer.subarray(0, read);
}

async function extractTarFile(tarPath, destination) {
  await fsp.mkdir(destination, { recursive: true });
  const handle = await fsp.open(tarPath, 'r');
  let position = 0;
  let pendingLongName = null;
  let pendingPax = null;

  try {
    const stat = await handle.stat();
    while (position + 512 <= stat.size) {
      const header = await readRange(handle, position, 512);
      if (header.length < 512) break;
      if (header.every(byte => byte === 0)) break;

      const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/, '');
      const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/, '');
      const size = parseOctal(header, 124, 12);
      const mode = parseOctal(header, 100, 8) || 0o644;
      const type = String.fromCharCode(header[156] || 48);
      const linkName = header.subarray(157, 257).toString('utf8').replace(/\0.*$/, '');
      const dataStart = position + 512;
      const paddedSize = Math.ceil(size / 512) * 512;

      if (type === 'L' || type === 'x') {
        const data = await readRange(handle, dataStart, size);
        if (type === 'L') pendingLongName = data.toString('utf8').replace(/\0+$/, '').trimEnd();
        else pendingPax = parsePax(data);
        position = dataStart + paddedSize;
        continue;
      }

      const archiveName = pendingPax?.path ?? pendingLongName ?? (prefix ? `${prefix}/${name}` : name);
      pendingLongName = null;
      const pax = pendingPax;
      pendingPax = null;
      const cleaned = cleanArchivePath(archiveName);
      if (!cleaned) {
        position = dataStart + paddedSize;
        continue;
      }
      const outputPath = ensureInside(destination, path.join(destination, cleaned));

      if (type === '5') {
        await fsp.mkdir(outputPath, { recursive: true, mode });
      } else if (type === '2') {
        await fsp.mkdir(path.dirname(outputPath), { recursive: true });
        const target = pax?.linkpath ?? linkName;
        if (path.isAbsolute(target)) throw new DotnetProvisionError(`Archive symlink is absolute: ${target}`);
        ensureInside(destination, path.resolve(path.dirname(outputPath), target));
        await fsp.rm(outputPath, { force: true, recursive: true });
        await fsp.symlink(target, outputPath);
      } else if (type === '1') {
        await fsp.mkdir(path.dirname(outputPath), { recursive: true });
        const targetName = cleanArchivePath(pax?.linkpath ?? linkName);
        const targetPath = ensureInside(destination, path.join(destination, targetName));
        await fsp.link(targetPath, outputPath);
      } else if (type === '0' || type === '\0' || type === '7') {
        await fsp.mkdir(path.dirname(outputPath), { recursive: true });
        if (size === 0) {
          await fsp.writeFile(outputPath, '');
        } else {
          await pipeline(
            fs.createReadStream(tarPath, { start: dataStart, end: dataStart + size - 1 }),
            fs.createWriteStream(outputPath, { mode })
          );
        }
        if (process.platform !== 'win32') await fsp.chmod(outputPath, mode & 0o777).catch(() => {});
      }

      position = dataStart + paddedSize;
    }
  } finally {
    await handle.close();
  }
}

async function extractTarGz(archivePath, destination) {
  const tempTar = `${archivePath}.nodenet-${process.pid}-${Date.now()}.tar`;
  try {
    await pipeline(
      fs.createReadStream(archivePath),
      zlib.createGunzip(),
      fs.createWriteStream(tempTar)
    );
    await extractTarFile(tempTar, destination);
  } finally {
    await fsp.rm(tempTar, { force: true }).catch(() => {});
  }
}

function findEndOfCentralDirectory(tail) {
  for (let i = tail.length - 22; i >= 0; i -= 1) {
    if (tail.readUInt32LE(i) === 0x06054b50) return i;
  }
  return -1;
}

async function extractZip(archivePath, destination) {
  await fsp.mkdir(destination, { recursive: true });
  const handle = await fsp.open(archivePath, 'r');
  try {
    const stat = await handle.stat();
    const tailSize = Math.min(stat.size, 22 + 0xffff);
    const tail = await readRange(handle, stat.size - tailSize, tailSize);
    const eocdOffsetInTail = findEndOfCentralDirectory(tail);
    if (eocdOffsetInTail < 0) throw new DotnetProvisionError('ZIP end-of-central-directory record was not found.');

    const totalEntries = tail.readUInt16LE(eocdOffsetInTail + 10);
    const centralSize = tail.readUInt32LE(eocdOffsetInTail + 12);
    const centralOffset = tail.readUInt32LE(eocdOffsetInTail + 16);
    if (totalEntries === 0xffff || centralSize === 0xffffffff || centralOffset === 0xffffffff) {
      throw new DotnetProvisionError('ZIP64 archives are not supported by the built-in NodeNET extractor.');
    }

    const central = await readRange(handle, centralOffset, centralSize);
    let cursor = 0;
    for (let entryIndex = 0; entryIndex < totalEntries; entryIndex += 1) {
      if (cursor + 46 > central.length || central.readUInt32LE(cursor) !== 0x02014b50) {
        throw new DotnetProvisionError('Invalid ZIP central-directory entry.');
      }

      const flags = central.readUInt16LE(cursor + 8);
      const method = central.readUInt16LE(cursor + 10);
      const compressedSize = central.readUInt32LE(cursor + 20);
      const uncompressedSize = central.readUInt32LE(cursor + 24);
      const nameLength = central.readUInt16LE(cursor + 28);
      const extraLength = central.readUInt16LE(cursor + 30);
      const commentLength = central.readUInt16LE(cursor + 32);
      const externalAttributes = central.readUInt32LE(cursor + 38);
      const localOffset = central.readUInt32LE(cursor + 42);
      const nameBuffer = central.subarray(cursor + 46, cursor + 46 + nameLength);
      const name = nameBuffer.toString((flags & 0x800) !== 0 ? 'utf8' : 'utf8');
      cursor += 46 + nameLength + extraLength + commentLength;

      const cleaned = cleanArchivePath(name);
      if (!cleaned) continue;
      const outputPath = ensureInside(destination, path.join(destination, cleaned));
      if (name.endsWith('/')) {
        await fsp.mkdir(outputPath, { recursive: true });
        continue;
      }

      const localHeader = await readRange(handle, localOffset, 30);
      if (localHeader.length < 30 || localHeader.readUInt32LE(0) !== 0x04034b50) {
        throw new DotnetProvisionError(`Invalid ZIP local header for ${name}.`);
      }
      const localNameLength = localHeader.readUInt16LE(26);
      const localExtraLength = localHeader.readUInt16LE(28);
      const dataStart = localOffset + 30 + localNameLength + localExtraLength;

      await fsp.mkdir(path.dirname(outputPath), { recursive: true });
      if (uncompressedSize === 0) {
        await fsp.writeFile(outputPath, '');
      } else {
        const source = fs.createReadStream(archivePath, {
          start: dataStart,
          end: dataStart + compressedSize - 1
        });
        const output = fs.createWriteStream(outputPath);
        if (method === 0) await pipeline(source, output);
        else if (method === 8) await pipeline(source, zlib.createInflateRaw(), output);
        else throw new DotnetProvisionError(`ZIP compression method ${method} is not supported.`);
      }

      const unixMode = (externalAttributes >>> 16) & 0o777;
      if (process.platform !== 'win32' && unixMode) await fsp.chmod(outputPath, unixMode).catch(() => {});
    }
  } finally {
    await handle.close();
  }
}

export async function extractArchive(archivePath, destination) {
  const lower = archivePath.toLowerCase();
  if (lower.endsWith('.tar.gz') || lower.endsWith('.tgz')) return extractTarGz(archivePath, destination);
  if (lower.endsWith('.zip')) return extractZip(archivePath, destination);
  throw new DotnetProvisionError(`Unsupported .NET archive format: ${archivePath}`);
}
