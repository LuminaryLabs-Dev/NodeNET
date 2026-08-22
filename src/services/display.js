import { MAX_FRAME_BYTES } from '../display/frame.js';
import { ProcessDisplayAdapter } from '../display/process-adapter.js';
import { FrameSurface } from '../display/surface.js';

export class SoftwareDisplayService {
  constructor({ maxFrameBytes = MAX_FRAME_BYTES } = {}) {
    this.kind = 'software-framebuffer';
    this.headless = true;
    this.maxFrameBytes = maxFrameBytes;
    this.sequence = 0;
    this.surfaces = new Set();
    this.adapters = new Set();
  }

  capabilities() {
    return Object.freeze({
      available: true,
      kind: this.kind,
      headless: this.headless,
      formats: Object.freeze(['rgba8']),
      input: Object.freeze(['pointer', 'keyboard']),
      maxFrameBytes: this.maxFrameBytes
    });
  }

  createSurface(options = {}) {
    const surface = new FrameSurface({
      ...options,
      id: options.id ?? `surface:${++this.sequence}`,
      maxFrameBytes: options.maxFrameBytes ?? this.maxFrameBytes
    });
    this.surfaces.add(surface);
    surface.once('close', () => this.surfaces.delete(surface));
    return surface;
  }

  connectProcess(processHandle, options = {}) {
    const adapter = new ProcessDisplayAdapter(this, processHandle, options);
    this.adapters.add(adapter);
    adapter.once('exit', () => this.adapters.delete(adapter));
    return adapter.surface;
  }

  async dispose() {
    await Promise.allSettled([...this.surfaces].map(surface => surface.dispose()));
    this.surfaces.clear();
    this.adapters.clear();
  }
}
