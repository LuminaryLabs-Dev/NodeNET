const PREFIX_BYTES = 8;
const MAX_HEADER_BYTES = 4 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 1024 * 1024 * 1024;

export function encodeFrame(message, payload = Buffer.alloc(0)) {
  const header = Buffer.from(JSON.stringify(message), 'utf8');
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload ?? []);
  if (header.length > MAX_HEADER_BYTES) throw new RangeError('NodeNET protocol header is too large.');
  if (body.length > MAX_PAYLOAD_BYTES) throw new RangeError('NodeNET protocol payload is too large.');
  const prefix = Buffer.allocUnsafe(PREFIX_BYTES);
  prefix.writeUInt32LE(header.length, 0);
  prefix.writeUInt32LE(body.length, 4);
  return Buffer.concat([prefix, header, body]);
}

export class FrameDecoder {
  constructor() {
    this.buffer = Buffer.alloc(0);
  }

  push(chunk) {
    const next = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    this.buffer = this.buffer.length ? Buffer.concat([this.buffer, next]) : next;
    const frames = [];
    while (this.buffer.length >= PREFIX_BYTES) {
      const headerLength = this.buffer.readUInt32LE(0);
      const payloadLength = this.buffer.readUInt32LE(4);
      if (headerLength > MAX_HEADER_BYTES) throw new RangeError('NodeNET protocol header exceeds the maximum size.');
      if (payloadLength > MAX_PAYLOAD_BYTES) throw new RangeError('NodeNET protocol payload exceeds the maximum size.');
      const total = PREFIX_BYTES + headerLength + payloadLength;
      if (this.buffer.length < total) break;
      const headerStart = PREFIX_BYTES;
      const payloadStart = headerStart + headerLength;
      const header = JSON.parse(this.buffer.subarray(headerStart, payloadStart).toString('utf8'));
      const payload = Buffer.from(this.buffer.subarray(payloadStart, total));
      this.buffer = this.buffer.subarray(total);
      frames.push({ message: header, payload });
    }
    return frames;
  }
}
