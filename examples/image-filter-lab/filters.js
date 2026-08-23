import { Frame } from '../../src/index.js';

export const FILTER_NAMES = Object.freeze(['original', 'invert', 'grayscale', 'threshold', 'sepia']);

function validateSource(source) {
  if (!(source instanceof Frame) || source.format !== 'rgba8') throw new TypeError('Image filters expect an RGBA8 Frame.');
  return source;
}

function byte(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

export function applyFilter(source, name, { threshold = 128 } = {}) {
  validateSource(source);
  if (!FILTER_NAMES.includes(name)) throw new RangeError(`Unknown image filter: ${name}`);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 255) throw new RangeError('Threshold must be from 0 through 255.');
  const output = source.clone();
  if (name === 'original') return output;

  for (let offset = 0; offset < source.pixels.length; offset += 4) {
    const red = source.pixels[offset];
    const green = source.pixels[offset + 1];
    const blue = source.pixels[offset + 2];
    if (name === 'invert') {
      output.pixels[offset] = 255 - red;
      output.pixels[offset + 1] = 255 - green;
      output.pixels[offset + 2] = 255 - blue;
    } else if (name === 'grayscale' || name === 'threshold') {
      const luminance = byte(0.299 * red + 0.587 * green + 0.114 * blue);
      const value = name === 'threshold' ? (luminance >= threshold ? 255 : 0) : luminance;
      output.pixels[offset] = value;
      output.pixels[offset + 1] = value;
      output.pixels[offset + 2] = value;
    } else if (name === 'sepia') {
      output.pixels[offset] = byte(0.393 * red + 0.769 * green + 0.189 * blue);
      output.pixels[offset + 1] = byte(0.349 * red + 0.686 * green + 0.168 * blue);
      output.pixels[offset + 2] = byte(0.272 * red + 0.534 * green + 0.131 * blue);
    }
  }
  return output;
}
