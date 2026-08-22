import { DisplayValidationHarness } from '../../src/display/validation.js';
import { SoftwareDisplayService } from '../../src/services/display.js';

const WIDTH = 420;
const HEIGHT = 640;
const BUTTONS = [
  ['7', '8', '9', '/'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', 'C', '=']
];

const COLORS = Object.freeze({
  background: [8, 13, 31, 255],
  panel: [17, 27, 54, 255],
  panelEdge: [39, 58, 96, 255],
  button: [28, 41, 73, 255],
  operator: [80, 57, 158, 255],
  equals: [226, 98, 54, 255],
  cyan: [67, 219, 218, 255],
  white: [240, 246, 255, 255],
  muted: [125, 146, 181, 255]
});

function trimNumber(value) {
  if (!Number.isFinite(value)) return 'ERROR';
  return String(Number(value.toFixed(10)));
}

export class DisplayCalculator {
  constructor(surface) {
    this.surface = surface;
    this.entry = '0';
    this.accumulator = null;
    this.operator = null;
    this.replaceEntry = true;
    this.buttons = new Map();
    for (let row = 0; row < BUTTONS.length; row++) {
      for (let column = 0; column < BUTTONS[row].length; column++) {
        const label = BUTTONS[row][column];
        this.buttons.set(label, { x: 24 + column * 93, y: 292 + row * 78, width: 81, height: 66 });
      }
    }
    surface.on('pointer', event => {
      if (event.type !== 'click') return;
      for (const [label, bounds] of this.buttons) {
        if (event.x >= bounds.x && event.x < bounds.x + bounds.width && event.y >= bounds.y && event.y < bounds.y + bounds.height) {
          this.press(label);
          break;
        }
      }
    });
    this.render();
  }

  get state() {
    return Object.freeze({
      display: this.entry,
      accumulator: this.accumulator,
      operator: this.operator,
      expression: this.operator && this.accumulator !== null ? `${trimNumber(this.accumulator)} ${this.operator}` : 'READY'
    });
  }

  buttonCenter(label) {
    const bounds = this.buttons.get(label);
    if (!bounds) throw new RangeError(`Unknown calculator button: ${label}`);
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }

  press(label) {
    if (/^\d$/.test(label)) {
      this.entry = this.replaceEntry || this.entry === '0' ? label : `${this.entry}${label}`;
      this.replaceEntry = false;
    } else if (label === '.') {
      if (this.replaceEntry) this.entry = '0';
      if (!this.entry.includes('.')) this.entry += '.';
      this.replaceEntry = false;
    } else if (label === 'C') {
      this.entry = '0';
      this.accumulator = null;
      this.operator = null;
      this.replaceEntry = true;
    } else if (['+', '-', '/', '*'].includes(label)) {
      this.accumulator = Number(this.entry);
      this.operator = label;
      this.replaceEntry = true;
    } else if (label === '=' && this.operator && this.accumulator !== null) {
      const right = Number(this.entry);
      const result = this.operator === '+' ? this.accumulator + right
        : this.operator === '-' ? this.accumulator - right
          : this.operator === '*' ? this.accumulator * right
            : right === 0 ? Number.NaN : this.accumulator / right;
      this.entry = trimNumber(result);
      this.accumulator = null;
      this.operator = null;
      this.replaceEntry = true;
    }
    this.render();
  }

  render() {
    const draw = this.surface.rasterizer();
    draw.clear(COLORS.background);
    draw.fillRect(0, 0, WIDTH, 6, COLORS.cyan);
    draw.text('NODENET', 24, 28, COLORS.cyan, { scale: 3, spacing: 1 });
    draw.text('DISPLAY SERVICE', 24, 62, COLORS.muted, { scale: 2, spacing: 1 });
    draw.roundedRect(24, 108, 372, 146, 18, COLORS.panel);
    draw.fillRect(24, 108, 4, 146, COLORS.cyan);
    draw.text(this.state.expression, 46, 136, COLORS.muted, { scale: 2, spacing: 1 });
    const display = this.entry.slice(-9);
    const displayMetrics = draw.measureText(display, { scale: 7, spacing: 1 });
    draw.text(display, Math.max(46, 372 - displayMetrics.width), 184, COLORS.white, { scale: 7, spacing: 1 });
    draw.text('HEADLESS RGBA8', 24, 270, COLORS.muted, { scale: 1, spacing: 1 });

    for (const [label, bounds] of this.buttons) {
      const fill = label === '=' ? COLORS.equals : ['+', '-', '/', '*'].includes(label) ? COLORS.operator : COLORS.button;
      draw.roundedRect(bounds.x, bounds.y, bounds.width, bounds.height, 14, fill);
      draw.fillRect(bounds.x + 12, bounds.y + bounds.height - 3, bounds.width - 24, 2, label === '=' ? COLORS.white : COLORS.panelEdge);
      const metrics = draw.measureText(label, { scale: 4, spacing: 1 });
      draw.text(label, bounds.x + Math.floor((bounds.width - metrics.width) / 2), bounds.y + 19, COLORS.white, { scale: 4, spacing: 1 });
    }
    this.surface.present(this.state);
  }
}

export async function runDisplayProof(outputDirectory) {
  const display = new SoftwareDisplayService();
  const surface = display.createSurface({ width: WIDTH, height: HEIGHT });
  const calculator = new DisplayCalculator(surface);
  const harness = new DisplayValidationHarness(surface, { outputDirectory });
  await harness.capture('calculator-initial.png');

  for (const label of ['1', '2', '+', '7']) {
    const point = calculator.buttonCenter(label);
    await harness.pointer({ type: 'click', ...point, button: 0 });
  }
  await harness.capture('calculator-12-plus-7.png');

  const equals = calculator.buttonCenter('=');
  await harness.pointer({ type: 'click', ...equals, button: 0 });
  const result = await harness.capture('calculator-result-19.png');
  const [initialCapture, expressionCapture, resultCapture] = harness.captures;

  const verification = {
    provider: display.kind,
    headless: display.headless,
    width: result.width,
    height: result.height,
    format: result.format,
    sequence: surface.sequence,
    expected: '19',
    actual: calculator.state.display,
    changed: initialCapture.sha256 !== resultCapture.sha256,
    hashes: { initial: initialCapture.sha256, expression: expressionCapture.sha256, result: resultCapture.sha256 },
    pass: calculator.state.display === '19' && initialCapture.sha256 !== resultCapture.sha256
  };
  const evidence = await harness.writeVerification(verification);
  await display.dispose();
  if (!verification.pass) throw new Error(`Display proof failed: ${JSON.stringify(verification)}`);
  return evidence;
}
