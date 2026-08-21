import { EventEmitter } from 'node:events';
import { ProtocolError, InvocationError } from '../errors.js';

export class RpcClient extends EventEmitter {
  constructor(processHandle) {
    super();
    this.processHandle = processHandle;
    this.pending = new Map();
    this.sequence = 0;
    this.buffer = '';

    processHandle.on('stdout', chunk => this.#onData(chunk));
    processHandle.on('exit', result => {
      const error = new ProtocolError(`NodeNET bridge exited with code ${result.exitCode}.`, { details: { result } });
      for (const { reject } of this.pending.values()) reject(error);
      this.pending.clear();
      this.emit('exit', result);
    });
    processHandle.on('stderr', chunk => this.emit('stderr', chunk));
  }

  #onData(chunk) {
    this.buffer += chunk;
    while (true) {
      const newline = this.buffer.indexOf('\n');
      if (newline < 0) break;
      const line = this.buffer.slice(0, newline).trim();
      this.buffer = this.buffer.slice(newline + 1);
      if (!line) continue;
      let message;
      try {
        message = JSON.parse(line);
      } catch (cause) {
        this.emit('protocolError', new ProtocolError('Bridge emitted invalid JSON.', { cause, details: { line } }));
        continue;
      }
      if (message.event) {
        this.emit('event', message);
        this.emit(message.event, message.payload);
        continue;
      }
      const pending = this.pending.get(String(message.id));
      if (!pending) continue;
      this.pending.delete(String(message.id));
      if (message.ok) pending.resolve(message);
      else pending.reject(new InvocationError(message.error?.message ?? 'The .NET invocation failed.', {
        details: { response: message }
      }));
    }
  }

  request(method, payload = {}) {
    if (!this.processHandle.running) {
      return Promise.reject(new ProtocolError('NodeNET bridge is not running.'));
    }
    const id = String(++this.sequence);
    const message = { id, method, ...payload };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const written = this.processHandle.write(`${JSON.stringify(message)}\n`);
      if (!written && !this.processHandle.running) {
        this.pending.delete(id);
        reject(new ProtocolError('Failed to write to the NodeNET bridge.'));
      }
    });
  }

  async close() {
    if (!this.processHandle.running) return this.processHandle.wait();
    try {
      await this.request('shutdown');
    } catch {
      // If shutdown handshake fails, terminate below.
    }
    this.processHandle.closeStdin();
    if (this.processHandle.running) return this.processHandle.stop();
    return this.processHandle.wait();
  }
}
