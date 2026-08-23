const LOWERCASE = Object.freeze({
  a: ['00000','01110','00001','01111','10001','01111','00000'],
  b: ['10000','10000','10110','11001','10001','11110','00000'],
  c: ['00000','01111','10000','10000','10000','01111','00000'],
  d: ['00001','00001','01101','10011','10001','01111','00000'],
  e: ['00000','01110','10001','11111','10000','01111','00000'],
  f: ['00110','01001','01000','11100','01000','01000','00000'],
  g: ['00000','01111','10001','01111','00001','01110','00000'],
  h: ['10000','10000','10110','11001','10001','10001','00000'],
  i: ['00100','00000','01100','00100','00100','01110','00000'],
  j: ['00010','00000','00110','00010','10010','01100','00000'],
  k: ['10000','10010','10100','11000','10100','10010','00000'],
  l: ['01100','00100','00100','00100','00100','01110','00000'],
  m: ['00000','11010','10101','10101','10101','10101','00000'],
  n: ['00000','10110','11001','10001','10001','10001','00000'],
  o: ['00000','01110','10001','10001','10001','01110','00000'],
  p: ['00000','11110','10001','11110','10000','10000','00000'],
  q: ['00000','01111','10001','01111','00001','00001','00000'],
  r: ['00000','10110','11001','10000','10000','10000','00000'],
  s: ['00000','01111','10000','01110','00001','11110','00000'],
  t: ['01000','01000','11100','01000','01001','00110','00000'],
  u: ['00000','10001','10001','10001','10011','01101','00000'],
  v: ['00000','10001','10001','10001','01010','00100','00000'],
  w: ['00000','10001','10001','10101','10101','01010','00000'],
  x: ['00000','10001','01010','00100','01010','10001','00000'],
  y: ['00000','10001','10001','01111','00001','01110','00000'],
  z: ['00000','11111','00010','00100','01000','11111','00000']
});

const PUNCTUATION = Object.freeze({
  '!': ['00100','00100','00100','00100','00100','00000','00100'],
  '?': ['01110','10001','00001','00010','00100','00000','00100'],
  ',': ['00000','00000','00000','00000','00110','00100','01000'],
  ';': ['00000','00110','00110','00000','00110','00100','01000'],
  "'": ['00100','00100','00000','00000','00000','00000','00000'],
  '"': ['01010','01010','00000','00000','00000','00000','00000'],
  '(': ['00010','00100','01000','01000','01000','00100','00010'],
  ')': ['01000','00100','00010','00010','00010','00100','01000'],
  '[': ['01110','01000','01000','01000','01000','01000','01110'],
  ']': ['01110','00010','00010','00010','00010','00010','01110'],
  '_': ['00000','00000','00000','00000','00000','00000','11111'],
  '#': ['01010','11111','01010','01010','11111','01010','00000'],
  '%': ['11001','11010','00100','01000','10110','00110','00000']
});

const CORE_GLYPH = /^[A-Z0-9 +\-=.:/]$/;

function customGlyph(character) {
  return LOWERCASE[character] ?? PUNCTUATION[character] ?? null;
}

function drawGlyph(draw, glyph, x, y, color, scale) {
  for (let row = 0; row < glyph.length; row += 1) {
    for (let column = 0; column < glyph[row].length; column += 1) {
      if (glyph[row][column] === '1') draw.fillRect(x + column * scale, y + row * scale, scale, scale, color);
    }
  }
}

export function drawSoftwareText(draw, value, x, y, color, { scale = 1, spacing = 1, lineSpacing = 1 } = {}) {
  if (!Number.isInteger(scale) || scale <= 0) throw new RangeError('Text scale must be a positive integer.');
  const originX = Math.trunc(x);
  let cursorX = originX;
  let cursorY = Math.trunc(y);
  for (const character of String(value)) {
    if (character === '\n') {
      cursorX = originX;
      cursorY += (7 + lineSpacing) * scale;
      continue;
    }
    if (character === '\t') {
      cursorX += 4 * (6 * scale);
      continue;
    }
    const glyph = customGlyph(character);
    if (glyph) drawGlyph(draw, glyph, cursorX, cursorY, color, scale);
    else if (CORE_GLYPH.test(character)) draw.text(character, cursorX, cursorY, color, { scale, spacing });
    else if (character !== ' ') drawGlyph(draw, PUNCTUATION['?'], cursorX, cursorY, color, scale);
    cursorX += (5 + spacing) * scale;
  }
  return draw;
}

export function measureSoftwareText(value, { scale = 1, spacing = 1, lineSpacing = 1 } = {}) {
  const lines = String(value).split('\n');
  const widths = lines.map(line => {
    const columns = [...line].reduce((total, character) => total + (character === '\t' ? 4 : 1), 0);
    return Math.max(0, columns * (5 + spacing) - spacing) * scale;
  });
  return {
    width: Math.max(0, ...widths),
    height: lines.length * 7 * scale + Math.max(0, lines.length - 1) * lineSpacing * scale
  };
}
