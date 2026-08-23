import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  CRC_TABLE[index] = value >>> 0;
}

export function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

export async function sha256File(file) {
  const bytes = await fs.readFile(file);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

export async function inspectPng(file) {
  const bytes = await fs.readFile(file);
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 33 || Buffer.compare(bytes.subarray(0, 8), signature) !== 0) {
    throw new Error(`${path.basename(file)} is not a valid PNG stream.`);
  }
  let offset = 8;
  let chunkIndex = 0;
  let sawData = false;
  let sawEnd = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error(`${path.basename(file)} has a truncated PNG chunk.`);
    const length = bytes.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > bytes.length) throw new Error(`${path.basename(file)} has a truncated PNG chunk payload.`);
    const type = bytes.subarray(offset + 4, offset + 8);
    const name = type.toString('ascii');
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    const expectedCrc = bytes.readUInt32BE(offset + 8 + length);
    const actualCrc = crc32(Buffer.concat([type, data]));
    if (expectedCrc !== actualCrc) throw new Error(`${path.basename(file)} has an invalid ${name} chunk checksum.`);
    if (chunkIndex === 0 && (name !== 'IHDR' || length !== 13)) throw new Error(`${path.basename(file)} has no valid first PNG IHDR chunk.`);
    if (name === 'IDAT') sawData = true;
    if (name === 'IEND') {
      if (length !== 0 || end !== bytes.length) throw new Error(`${path.basename(file)} has an invalid PNG IEND chunk.`);
      sawEnd = true;
    }
    offset = end;
    chunkIndex++;
  }
  if (!sawData || !sawEnd) throw new Error(`${path.basename(file)} is missing required PNG image data or end chunks.`);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1) throw new Error(`${path.basename(file)} has invalid dimensions.`);
  return {
    file: path.basename(file),
    bytes: bytes.length,
    width,
    height,
    sha256: crypto.createHash('sha256').update(bytes).digest('hex')
  };
}

export function overallVerdict(gates) {
  const required = gates.filter(gate => gate.required !== false);
  if (required.some(gate => gate.status === 'FAIL')) return 'FAIL';
  if (required.some(gate => gate.status === 'BLOCKED')) return 'BLOCKED';
  if (required.some(gate => gate.status === 'SKIPPED')) return 'BLOCKED';
  return required.every(gate => gate.status === 'PASS') ? 'PASS' : 'BLOCKED';
}

function dosDateTime(value) {
  const date = new Date(value);
  const year = Math.min(2107, Math.max(1980, date.getFullYear()));
  return {
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  };
}

async function collectFiles(directory, output, excluded) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(directory, entry.name);
    if (excluded.has(path.resolve(full))) continue;
    if (entry.isSymbolicLink()) throw new Error(`Report archives cannot contain symbolic links: ${full}`);
    if (entry.isDirectory()) await collectFiles(full, output, excluded);
    else if (entry.isFile()) output.push(full);
  }
}

export async function createZip(sourceDirectory, outputFile, { exclude = [] } = {}) {
  const root = path.resolve(sourceDirectory);
  const destination = path.resolve(outputFile);
  if (destination === root || destination.startsWith(`${root}${path.sep}`) === false) {
    throw new Error('The validation ZIP must be written inside its source report directory.');
  }
  const excluded = new Set([destination, ...exclude.map(item => path.resolve(item))]);
  const files = [];
  await collectFiles(root, files, excluded);

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const file of files) {
    const data = await fs.readFile(file);
    const stat = await fs.stat(file);
    const name = Buffer.from(path.relative(root, file).split(path.sep).join('/'), 'utf8');
    const { date, time } = dosDateTime(stat.mtime);
    const checksum = crc32(data);
    if (data.length > 0xffffffff || offset > 0xffffffff) throw new Error('ZIP64 reports are not supported.');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(0x0314, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + data.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  await fs.writeFile(destination, Buffer.concat([...localParts, centralDirectory, end]));
  return {
    file: destination,
    entries: files.length,
    bytes: (await fs.stat(destination)).size,
    sha256: await sha256File(destination)
  };
}
