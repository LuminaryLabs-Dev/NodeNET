import { EventEmitter } from 'node:events';
import { Frame } from './frame.js';
import { ProtocolClient } from '../interop/protocol/client.js';
import { StdioTransport } from '../interop/transport/stdio.js';

export class ProcessDisplayAdapter extends EventEmitter {
  constructor(display, processHandle, { id, width = 1, height = 1, format = 'rgba8', maxFrameBytes } = {}) {
    super();
    if (!display?.createSurface) throw new TypeError('ProcessDisplayAdapter requires a display service.');
    if (!processHandle?.write || !processHandle?.on) throw new TypeError('ProcessDisplayAdapter requires a live ProcessHandle.');
    if (processHandle.binaryStdout !== true) throw new TypeError('Display protocol processes must be started with binaryStdout: true.');
    this.process = processHandle;
    this.closing = false;
    this.client = new ProtocolClient(new StdioTransport(processHandle));
    this.surface = display.createSurface({
      id,
      width,
      height,
      format,
      maxFrameBytes,
      handlers: {
        pointer: input => this.#request('display.pointer', { input }),
        key: input => this.#request('display.key', { input }),
        resize: size => this.#request('display.resize', size),
        dispose: () => this.#dispose()
      }
    });

    this.client.on('display.ready', payload => this.#ready(payload));
    this.client.on('display.frame', (payload, pixels) => this.#frame(payload, pixels));
    this.client.on('display.state', payload => this.surface.markState(payload));
    this.client.on('protocolError', error => this.emit('protocolError', error));
    this.client.on('exit', result => {
      if (!this.closing && !this.surface.disposed) {
        const detail = result.stderr ? `\n${result.stderr.trim()}` : '';
        this.surface.markFailure(new Error(`Display process exited with code ${result.exitCode}.${detail}`));
      }
      if (!this.surface.disposed) this.surface.dispose({ notify: false }).catch(error => this.emit('protocolError', error));
      this.emit('exit', result);
    });
    this.connection = this.client.request('display.connect', { surface: this.surface.id });
    this.connection.catch(error => this.emit('protocolError', error));
  }

  async #request(operation, fields = {}) {
    await this.connection;
    const response = await this.client.request(operation, { surface: this.surface.id, ...fields });
    if (response.result?.state !== undefined) this.surface.markState(response.result.state);
    return response.result;
  }

  async #dispose() {
    this.closing = true;
    return this.#request('display.dispose');
  }

  async #ready(payload = {}) {
    try {
      const width = payload.width ?? this.surface.width;
      const height = payload.height ?? this.surface.height;
      if (width !== this.surface.width || height !== this.surface.height) await this.surface.resize(width, height, { notify: false });
      this.surface.markReady(payload);
    } catch (error) { this.emit('protocolError', error); }
  }

  async #frame(payload = {}, pixels) {
    try {
      const width = payload.width ?? this.surface.width;
      const height = payload.height ?? this.surface.height;
      if (width !== this.surface.width || height !== this.surface.height) await this.surface.resize(width, height, { notify: false });
      this.surface.submit(new Frame({
        width,
        height,
        stride: payload.stride,
        format: payload.format ?? this.surface.format,
        pixels,
        maxBytes: this.surface.maxFrameBytes
      }));
      this.surface.present(payload.metadata ?? {});
    } catch (error) { this.emit('protocolError', error); }
  }
}
