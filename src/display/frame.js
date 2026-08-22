export const DISPLAY_FORMAT = 'rgba8';
export const MAX_FRAME_BYTES = 256 * 1024 * 1024;
export const MAX_FRAME_DIMENSION = 16_384;

function integer(value, name) {
  if (!Number.isInteger(value) || value <= 0) throw new RangeError(`${name} must be a positive integer.`);
  if (value > MAX_FRAME_DIMENSION) throw new RangeError(`${name} exceeds the maximum frame dimension.`);
  return value;
}

function byteView(value) {
  if (Buffer.isBuffer(value)) return value;
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  throw new TypeError('Frame pixels must be a Buffer, ArrayBuffer, or typed array.');
}

export function frameLayout({ width, height, stride, format = DISPLAY_FORMAT, maxBytes = MAX_FRAME_BYTES }) {
  const resolvedWidth = integer(width, 'Frame width');
  const resolvedHeight = integer(height, 'Frame height');
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0 || maxBytes > MAX_FRAME_BYTES) {
    throw new RangeError(`Frame byte limit must be a positive integer no greater than ${MAX_FRAME_BYTES}.`);
  }
  if (format !== DISPLAY_FORMAT) throw new RangeError(`Unsupported frame format: ${format}`);
  const expectedStride = resolvedWidth * 4;
  const resolvedStride = stride ?? expectedStride;
  if (!Number.isInteger(resolvedStride) || resolvedStride !== expectedStride) {
    throw new RangeError(`RGBA8 frame stride must equal width * 4 (${expectedStride}).`);
  }
  const byteLength = resolvedStride * resolvedHeight;
  if (!Number.isSafeInteger(byteLength) || byteLength > maxBytes) {
    throw new RangeError(`Frame allocation exceeds the ${maxBytes}-byte limit.`);
  }
  return Object.freeze({
    width: resolvedWidth,
    height: resolvedHeight,
    stride: resolvedStride,
    format,
    byteLength
  });
}

export class Frame {
  constructor({ width, height, stride, format = DISPLAY_FORMAT, pixels, maxBytes = MAX_FRAME_BYTES } = {}) {
    const layout = frameLayout({ width, height, stride, format, maxBytes });
    const source = pixels === undefined ? null : byteView(pixels);
    if (source && source.length !== layout.byteLength) {
      throw new RangeError(`Frame pixel length must be exactly ${layout.byteLength} bytes.`);
    }
    Object.defineProperties(this, {
      width: { value: layout.width, enumerable: true },
      height: { value: layout.height, enumerable: true },
      stride: { value: layout.stride, enumerable: true },
      format: { value: layout.format, enumerable: true },
      pixels: { value: source ? Buffer.from(source) : Buffer.alloc(layout.byteLength), enumerable: true }
    });
  }

  get byteLength() {
    return this.pixels.length;
  }

  clone() {
    return new Frame(this);
  }
}

export function asFrame(value, options = {}) {
  if (value instanceof Frame) return value.clone();
  return new Frame({ ...value, ...options });
}
