import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import { Frame } from './frame.js';

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index++) {
  let value = index;
  for (let bit = 0; bit < 8; bit++) value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  CRC_TABLE[index] = value >>> 0;
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.allocUnsafe(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])), 0);
  return Buffer.concat([length, name, data, checksum]);
}

export function encodePng(frame) {
  if (!(frame instanceof Frame)) throw new TypeError('encodePng expects a Frame.');
  const header = Buffer.alloc(13);
  header.writeUInt32BE(frame.width, 0);
  header.writeUInt32BE(frame.height, 4);
  header[8] = 8;
  header[9] = 6;
  const scanlines = Buffer.alloc(frame.height * (frame.stride + 1));
  for (let y = 0; y < frame.height; y++) {
    const target = y * (frame.stride + 1);
    scanlines[target] = 0;
    frame.pixels.copy(scanlines, target + 1, y * frame.stride, (y + 1) * frame.stride);
  }
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(scanlines, { level: 9 })),
    chunk('IEND')
  ]);
}

export async function savePng(frame, file) {
  const png = encodePng(frame);
  await fs.writeFile(file, png);
  return { file, bytes: png.length, width: frame.width, height: frame.height };
}
