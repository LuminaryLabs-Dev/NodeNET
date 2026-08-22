import { Frame } from './frame.js';

const FONT = Object.freeze({
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
  '0': ['01110','10001','10011','10101','11001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['11110','00001','00001','01110','00001','00001','11110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','10000','11110','00001','00001','11110'],
  '6': ['01110','10000','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00001','01110'],
  'A': ['01110','10001','10001','11111','10001','10001','10001'],
  'B': ['11110','10001','10001','11110','10001','10001','11110'],
  'C': ['01111','10000','10000','10000','10000','10000','01111'],
  'D': ['11110','10001','10001','10001','10001','10001','11110'],
  'E': ['11111','10000','10000','11110','10000','10000','11111'],
  'F': ['11111','10000','10000','11110','10000','10000','10000'],
  'G': ['01111','10000','10000','10111','10001','10001','01110'],
  'H': ['10001','10001','10001','11111','10001','10001','10001'],
  'I': ['01110','00100','00100','00100','00100','00100','01110'],
  'J': ['00001','00001','00001','00001','10001','10001','01110'],
  'K': ['10001','10010','10100','11000','10100','10010','10001'],
  'L': ['10000','10000','10000','10000','10000','10000','11111'],
  'M': ['10001','11011','10101','10101','10001','10001','10001'],
  'N': ['10001','11001','10101','10011','10001','10001','10001'],
  'O': ['01110','10001','10001','10001','10001','10001','01110'],
  'P': ['11110','10001','10001','11110','10000','10000','10000'],
  'Q': ['01110','10001','10001','10001','10101','10010','01101'],
  'R': ['11110','10001','10001','11110','10100','10010','10001'],
  'S': ['01111','10000','10000','01110','00001','00001','11110'],
  'T': ['11111','00100','00100','00100','00100','00100','00100'],
  'U': ['10001','10001','10001','10001','10001','10001','01110'],
  'V': ['10001','10001','10001','10001','10001','01010','00100'],
  'W': ['10001','10001','10001','10101','10101','11011','10001'],
  'X': ['10001','10001','01010','00100','01010','10001','10001'],
  'Y': ['10001','10001','01010','00100','00100','00100','00100'],
  'Z': ['11111','00001','00010','00100','01000','10000','11111'],
  '+': ['00000','00100','00100','11111','00100','00100','00000'],
  '-': ['00000','00000','00000','11111','00000','00000','00000'],
  '=': ['00000','11111','00000','11111','00000','00000','00000'],
  '.': ['00000','00000','00000','00000','00000','00110','00110'],
  ':': ['00000','00110','00110','00000','00110','00110','00000'],
  '/': ['00001','00010','00010','00100','01000','01000','10000']
});

function color(value) {
  if (!Array.isArray(value) && !ArrayBuffer.isView(value)) throw new TypeError('Color must be an RGBA array.');
  if (value.length !== 4) throw new RangeError('Color must contain exactly four channels.');
  const channels = [...value];
  if (channels.some(channel => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
    throw new RangeError('RGBA channels must be integers from 0 through 255.');
  }
  return channels;
}

export class SoftwareRasterizer {
  constructor(frame) {
    if (!(frame instanceof Frame)) throw new TypeError('SoftwareRasterizer expects a Frame.');
    this.frame = frame;
  }

  clear(rgba = [0, 0, 0, 0]) {
    const [r, g, b, a] = color(rgba);
    for (let offset = 0; offset < this.frame.pixels.length; offset += 4) {
      this.frame.pixels[offset] = r;
      this.frame.pixels[offset + 1] = g;
      this.frame.pixels[offset + 2] = b;
      this.frame.pixels[offset + 3] = a;
    }
    return this;
  }

  pixel(x, y, rgba) {
    x = Math.trunc(x);
    y = Math.trunc(y);
    if (x < 0 || y < 0 || x >= this.frame.width || y >= this.frame.height) return this;
    const [r, g, b, a] = color(rgba);
    const offset = y * this.frame.stride + x * 4;
    this.frame.pixels[offset] = r;
    this.frame.pixels[offset + 1] = g;
    this.frame.pixels[offset + 2] = b;
    this.frame.pixels[offset + 3] = a;
    return this;
  }

  line(x0, y0, x1, y1, rgba) {
    x0 = Math.trunc(x0); y0 = Math.trunc(y0); x1 = Math.trunc(x1); y1 = Math.trunc(y1);
    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    let error = dx + dy;
    while (true) {
      this.pixel(x0, y0, rgba);
      if (x0 === x1 && y0 === y1) break;
      const twice = 2 * error;
      if (twice >= dy) { error += dy; x0 += sx; }
      if (twice <= dx) { error += dx; y0 += sy; }
    }
    return this;
  }

  fillRect(x, y, width, height, rgba) {
    const [r, g, b, a] = color(rgba);
    const left = Math.max(0, Math.trunc(x));
    const top = Math.max(0, Math.trunc(y));
    const right = Math.min(this.frame.width, Math.ceil(x + width));
    const bottom = Math.min(this.frame.height, Math.ceil(y + height));
    for (let py = top; py < bottom; py++) {
      for (let px = left; px < right; px++) {
        const offset = py * this.frame.stride + px * 4;
        this.frame.pixels[offset] = r;
        this.frame.pixels[offset + 1] = g;
        this.frame.pixels[offset + 2] = b;
        this.frame.pixels[offset + 3] = a;
      }
    }
    return this;
  }

  roundedRect(x, y, width, height, radius, rgba) {
    const boundedRadius = Math.max(0, Math.min(Math.trunc(radius), Math.floor(Math.min(width, height) / 2)));
    if (boundedRadius === 0) return this.fillRect(x, y, width, height, rgba);
    const left = Math.trunc(x);
    const top = Math.trunc(y);
    const right = Math.ceil(x + width);
    const bottom = Math.ceil(y + height);
    const radiusSquared = boundedRadius * boundedRadius;
    for (let py = top; py < bottom; py++) {
      for (let px = left; px < right; px++) {
        const cornerX = px < left + boundedRadius ? left + boundedRadius - 1 : px >= right - boundedRadius ? right - boundedRadius : px;
        const cornerY = py < top + boundedRadius ? top + boundedRadius - 1 : py >= bottom - boundedRadius ? bottom - boundedRadius : py;
        const dx = px - cornerX;
        const dy = py - cornerY;
        if (dx * dx + dy * dy <= radiusSquared) this.pixel(px, py, rgba);
      }
    }
    return this;
  }

  blit(source, x, y) {
    if (!(source instanceof Frame) || source.format !== this.frame.format) throw new TypeError('blit expects a compatible Frame.');
    x = Math.trunc(x); y = Math.trunc(y);
    const sourceLeft = Math.max(0, -x);
    const sourceTop = Math.max(0, -y);
    const width = Math.min(source.width - sourceLeft, this.frame.width - Math.max(0, x));
    const height = Math.min(source.height - sourceTop, this.frame.height - Math.max(0, y));
    if (width <= 0 || height <= 0) return this;
    const targetX = Math.max(0, x);
    const targetY = Math.max(0, y);
    for (let row = 0; row < height; row++) {
      const start = (sourceTop + row) * source.stride + sourceLeft * 4;
      source.pixels.copy(this.frame.pixels, (targetY + row) * this.frame.stride + targetX * 4, start, start + width * 4);
    }
    return this;
  }

  text(value, x, y, rgba, { scale = 1, spacing = 1 } = {}) {
    if (!Number.isInteger(scale) || scale <= 0) throw new RangeError('Text scale must be a positive integer.');
    const originX = Math.trunc(x);
    let cursorX = originX;
    let cursorY = Math.trunc(y);
    for (const character of String(value).toUpperCase()) {
      if (character === '\n') { cursorX = originX; cursorY += 8 * scale; continue; }
      const glyph = FONT[character] ?? FONT[' '];
      for (let row = 0; row < glyph.length; row++) {
        for (let column = 0; column < glyph[row].length; column++) {
          if (glyph[row][column] === '1') this.fillRect(cursorX + column * scale, cursorY + row * scale, scale, scale, rgba);
        }
      }
      cursorX += 5 * scale + spacing * scale;
    }
    return this;
  }

  measureText(value, { scale = 1, spacing = 1 } = {}) {
    const lines = String(value).split('\n');
    const width = Math.max(0, ...lines.map(line => Math.max(0, line.length * (5 + spacing) - spacing) * scale));
    return { width, height: lines.length * 7 * scale + Math.max(0, lines.length - 1) * scale };
  }
}
