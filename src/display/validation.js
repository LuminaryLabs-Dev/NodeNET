import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { FrameSurface } from './surface.js';
import { savePng } from './png.js';

function artifactName(name, extension) {
  if (typeof name !== 'string' || path.basename(name) !== name || !name.toLowerCase().endsWith(extension)) {
    throw new TypeError(`Artifact name must be a single ${extension} file name.`);
  }
  return name;
}

export class DisplayValidationHarness {
  constructor(surface, { outputDirectory = null, timeout = 10_000 } = {}) {
    if (!(surface instanceof FrameSurface)) throw new TypeError('DisplayValidationHarness expects a FrameSurface.');
    this.surface = surface;
    this.outputDirectory = outputDirectory ? path.resolve(outputDirectory) : null;
    this.timeout = timeout;
    this.captures = [];
  }

  waitForReady() {
    return this.surface.waitForReady({ timeout: this.timeout });
  }

  async pointer(input, { expectFrame = true } = {}) {
    const before = this.surface.sequence;
    const result = await this.surface.pointer(input);
    if (expectFrame && this.surface.sequence <= before) await this.surface.waitForFrame({ afterSequence: before, timeout: this.timeout });
    return result;
  }

  async key(input, { expectFrame = true } = {}) {
    const before = this.surface.sequence;
    const result = await this.surface.key(input);
    if (expectFrame && this.surface.sequence <= before) await this.surface.waitForFrame({ afterSequence: before, timeout: this.timeout });
    return result;
  }

  async capture(name) {
    const fileName = artifactName(name, '.png');
    const frame = this.surface.capture();
    const record = Object.freeze({
      name: fileName,
      width: frame.width,
      height: frame.height,
      format: frame.format,
      sha256: crypto.createHash('sha256').update(frame.pixels).digest('hex')
    });
    if (this.outputDirectory) {
      await fs.mkdir(this.outputDirectory, { recursive: true });
      await savePng(frame, path.join(this.outputDirectory, fileName));
    }
    this.captures.push(record);
    return frame;
  }

  async writeVerification(value, name = 'verification.json') {
    if (!this.outputDirectory) throw new Error('An output directory is required to write verification evidence.');
    const fileName = artifactName(name, '.json');
    await fs.mkdir(this.outputDirectory, { recursive: true });
    const document = { ...value, captures: [...this.captures] };
    await fs.writeFile(path.join(this.outputDirectory, fileName), `${JSON.stringify(document, null, 2)}\n`);
    return document;
  }
}
