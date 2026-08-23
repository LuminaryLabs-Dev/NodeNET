import { Frame } from '../../src/index.js';

export function createSourceImage(width = 256, height = 256) {
  const frame = new Frame({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * frame.stride + x * 4;
      const checker = (Math.floor(x / 32) + Math.floor(y / 32)) % 2;
      frame.pixels[offset] = Math.round(x / Math.max(1, width - 1) * 255);
      frame.pixels[offset + 1] = Math.round(y / Math.max(1, height - 1) * 255);
      frame.pixels[offset + 2] = checker ? 225 : 35;
      frame.pixels[offset + 3] = 255;
    }
  }
  return frame;
}
