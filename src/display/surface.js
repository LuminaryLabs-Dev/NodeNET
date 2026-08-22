import { EventEmitter } from 'node:events';
import { Frame, DISPLAY_FORMAT, MAX_FRAME_BYTES, asFrame, frameLayout } from './frame.js';
import { normalizeKeyEvent, normalizePointerEvent } from './input.js';
import { SoftwareRasterizer } from './rasterizer.js';

export class FrameSurface extends EventEmitter {
  constructor({
    id,
    width,
    height,
    format = DISPLAY_FORMAT,
    maxFrameBytes = MAX_FRAME_BYTES,
    handlers = {}
  } = {}) {
    super();
    const layout = frameLayout({ width, height, format, maxBytes: maxFrameBytes });
    this.id = id ?? 'surface';
    this.width = layout.width;
    this.height = layout.height;
    this.stride = layout.stride;
    this.format = layout.format;
    this.maxFrameBytes = maxFrameBytes;
    this.handlers = handlers;
    this.currentFrame = null;
    this.sequence = 0;
    this.presentedMetadata = null;
    this.readyInfo = null;
    this.lastState = null;
    this.failure = null;
    this.disposed = false;
  }

  get allocated() {
    return this.currentFrame !== null;
  }

  #active() {
    if (this.disposed) throw new Error(`Display surface ${this.id} has been disposed.`);
  }

  submit(value) {
    this.#active();
    const frame = asFrame(value, { maxBytes: this.maxFrameBytes });
    if (frame.width !== this.width || frame.height !== this.height || frame.stride !== this.stride || frame.format !== this.format) {
      throw new RangeError('Submitted frame does not match the surface layout.');
    }
    this.currentFrame = frame;
    this.emit('frame', frame.clone());
    return frame;
  }

  present(metadata = {}) {
    this.#active();
    if (!this.currentFrame) throw new Error('A frame must be submitted before it can be presented.');
    this.sequence++;
    this.presentedMetadata = Object.freeze({ ...metadata });
    const presentation = Object.freeze({ sequence: this.sequence, metadata: this.presentedMetadata, frame: this.currentFrame.clone() });
    this.emit('present', presentation);
    return presentation;
  }

  capture() {
    this.#active();
    if (!this.currentFrame) throw new Error('The display surface has no frame to capture.');
    return this.currentFrame.clone();
  }

  rasterizer() {
    this.#active();
    if (!this.currentFrame) this.currentFrame = new Frame({ width: this.width, height: this.height, format: this.format, maxBytes: this.maxFrameBytes });
    return new SoftwareRasterizer(this.currentFrame);
  }

  async resize(width, height, { notify = true } = {}) {
    this.#active();
    const layout = frameLayout({ width, height, format: this.format, maxBytes: this.maxFrameBytes });
    if (notify) await this.handlers.resize?.({ width: layout.width, height: layout.height });
    this.width = layout.width;
    this.height = layout.height;
    this.stride = layout.stride;
    this.currentFrame = null;
    this.emit('resize', Object.freeze({ width: this.width, height: this.height, stride: this.stride, format: this.format }));
    return this;
  }

  async pointer(event) {
    this.#active();
    const input = normalizePointerEvent(event);
    const result = await this.handlers.pointer?.(input);
    this.emit('pointer', input);
    return result;
  }

  async key(event) {
    this.#active();
    const input = normalizeKeyEvent(event);
    const result = await this.handlers.key?.(input);
    this.emit('key', input);
    return result;
  }

  markReady(info = {}) {
    this.#active();
    this.readyInfo = Object.freeze({ ...info });
    this.emit('ready', this.readyInfo);
    return this.readyInfo;
  }

  markState(state) {
    this.#active();
    this.lastState = state && typeof state === 'object' ? Object.freeze({ ...state }) : state;
    this.emit('state', this.lastState);
    return this.lastState;
  }

  markFailure(error) {
    if (this.disposed) return this.failure;
    this.failure = error instanceof Error ? error : new Error(String(error));
    this.emit('failure', this.failure);
    return this.failure;
  }

  async waitForReady({ timeout = 10_000 } = {}) {
    if (this.failure) throw this.failure;
    this.#active();
    if (this.readyInfo) return this.readyInfo;
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.off('ready', ready);
        this.off('failure', failed);
        this.off('close', closed);
      };
      const ready = info => { cleanup(); resolve(info); };
      const failed = error => { cleanup(); reject(error); };
      const closed = () => { cleanup(); reject(new Error(`Display surface ${this.id} closed before becoming ready.`)); };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for display surface ${this.id} to become ready.`));
      }, timeout);
      this.once('ready', ready);
      this.once('failure', failed);
      this.once('close', closed);
    });
  }

  async waitForFrame({ afterSequence = this.sequence, timeout = 10_000 } = {}) {
    if (this.failure) throw this.failure;
    this.#active();
    if (this.sequence > afterSequence) return this.capture();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.off('present', presented);
        this.off('failure', failed);
        this.off('close', closed);
      };
      const presented = presentation => { cleanup(); resolve(presentation.frame.clone()); };
      const failed = error => { cleanup(); reject(error); };
      const closed = () => { cleanup(); reject(new Error(`Display surface ${this.id} closed before presenting a frame.`)); };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for a frame on display surface ${this.id}.`));
      }, timeout);
      this.once('present', presented);
      this.once('failure', failed);
      this.once('close', closed);
    });
  }

  async dispose({ notify = true } = {}) {
    if (this.disposed) return;
    let failure;
    try {
      if (notify) await this.handlers.dispose?.();
    } catch (error) {
      failure = error;
    } finally {
      this.disposed = true;
      this.currentFrame = null;
      this.emit('close');
      this.removeAllListeners();
    }
    if (failure) throw failure;
  }
}
