import { EventEmitter } from 'node:events';
import { InvocationError, ProtocolError } from '../../errors.js';

export class ProtocolClient extends EventEmitter {
  constructor(transport) {
    super();
    this.transport = transport;
    this.pending = new Map();
    this.sequence = 0;

    transport.on('frame', frame => this.#onFrame(frame));
    transport.on('exit', result => {
      const error = new ProtocolError(`NodeNET bridge exited with code ${result.exitCode}.`, { details: { result } });
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
      this.emit('exit', result);
    });
    transport.on('stderr', chunk => this.emit('stderr', chunk));
    transport.on('protocolError', error => {
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
      this.emit('protocolError', error);
    });
  }

  #onFrame({ message, payload }) {
    if (message.event) {
      this.emit('event', { ...message, payloadBytes: payload });
      this.emit(message.event, message.payload, payload);
      return;
    }
    const pending = this.pending.get(String(message.id));
    if (!pending) return;
    this.pending.delete(String(message.id));
    if (message.ok) pending.resolve({ ...message, payload });
    else pending.reject(new InvocationError(message.error?.message ?? 'The .NET invocation failed.', {
      details: { response: message }
    }));
  }

  request(op, fields = {}, { payload = Buffer.alloc(0) } = {}) {
    if (!this.transport.running) return Promise.reject(new ProtocolError('NodeNET bridge is not running.'));
    const id = String(++this.sequence);
    const message = { version: 1, id, op, ...fields };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      try {
        const written = this.transport.send(message, payload);
        if (!written && !this.transport.running) {
          this.pending.delete(id);
          reject(new ProtocolError('Failed to write to the NodeNET bridge.'));
        }
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  async close() {
    if (!this.transport.running) return this.transport.close();
    try { await this.request('shutdown'); } catch {}
    return this.transport.close();
  }
}
