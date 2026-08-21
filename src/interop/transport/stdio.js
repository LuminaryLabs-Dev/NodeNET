import { EventEmitter } from 'node:events';
import { ProtocolError } from '../../errors.js';
import { encodeFrame, FrameDecoder } from '../protocol/framing.js';

export class StdioTransport extends EventEmitter {
  constructor(processHandle) {
    super();
    this.processHandle = processHandle;
    this.decoder = new FrameDecoder();

    processHandle.on('stdout', chunk => this.#onData(chunk));
    processHandle.on('exit', result => this.emit('exit', result));
    processHandle.on('stderr', chunk => this.emit('stderr', chunk));
  }

  #onData(chunk) {
    try {
      for (const frame of this.decoder.push(chunk)) this.emit('frame', frame);
    } catch (cause) {
      this.emit('protocolError', new ProtocolError('Failed to decode a NodeNET bridge frame.', { cause }));
    }
  }

  get running() {
    return this.processHandle.running;
  }

  send(message, payload = Buffer.alloc(0)) {
    if (!this.running) throw new ProtocolError('NodeNET bridge is not running.');
    return this.processHandle.write(encodeFrame(message, payload));
  }

  async close() {
    if (!this.running) return this.processHandle.wait();
    this.processHandle.closeStdin();
    if (this.running) return this.processHandle.stop();
    return this.processHandle.wait();
  }
}
