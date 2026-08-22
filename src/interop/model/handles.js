import { marshalArguments } from './marshal.js';

function callSpec(memberOrSpec, args) {
  if (memberOrSpec && typeof memberOrSpec === 'object') {
    const member = memberOrSpec.member;
    if (!member) throw new TypeError('call() object form requires member.');
    return {
      member,
      signature: memberOrSpec.signature,
      arguments: memberOrSpec.arguments ?? args
    };
  }
  return { member: memberOrSpec, signature: undefined, arguments: args };
}

export class RemoteStreamHandle {
  constructor(library, descriptor) {
    this.library = library;
    this.$stream = descriptor.$stream;
    this.$type = descriptor.$type ?? 'System.IO.Stream';
    this.closed = false;
  }

  async read(count = 64 * 1024) {
    const response = await this.library.protocol.request('stream.read', { handle: this.$stream, count });
    return { bytes: response.payload, eof: response.result?.eof === true };
  }

  async write(bytes) {
    const payload = Buffer.from(bytes);
    const response = await this.library.protocol.request('stream.write', { handle: this.$stream }, { payload });
    return response.result;
  }

  async dispose() {
    if (this.closed) return;
    await this.library.protocol.request('dispose', { handle: this.$stream });
    this.closed = true;
  }
}

export class RemoteObjectHandle {
  constructor(library, descriptor) {
    this.library = library;
    this.$handle = descriptor.$handle;
    this.$type = descriptor.$type ?? null;
    this.disposed = false;
  }

  async call(memberOrSpec, ...args) {
    const spec = callSpec(memberOrSpec, args);
    const marshalled = marshalArguments(spec.arguments);
    const response = await this.library.protocol.request('call', {
      handle: this.$handle,
      member: spec.member,
      ...(spec.signature ? { signature: spec.signature } : {}),
      arguments: marshalled.arguments
    }, { payload: marshalled.payload });
    return this.library.fromWire(response.result, response.payload);
  }

  async get(member) {
    const response = await this.library.protocol.request('get', { handle: this.$handle, member });
    return this.library.fromWire(response.result, response.payload);
  }

  async set(member, value) {
    const marshalled = marshalArguments([value]);
    const response = await this.library.protocol.request('set', {
      handle: this.$handle,
      member,
      value: marshalled.arguments[0]
    }, { payload: marshalled.payload });
    return response.result;
  }

  async describe() {
    const response = await this.library.protocol.request('describe', { handle: this.$handle });
    return response.result;
  }

  async dispose() {
    if (this.disposed) return;
    await this.library.protocol.request('dispose', { handle: this.$handle });
    this.disposed = true;
  }
}

export class RemoteType {
  constructor(library, name) {
    this.library = library;
    this.name = name;
  }

  describe() { return this.library.describe(this.name); }

  async construct({ signature, arguments: args = [] } = {}) {
    const marshalled = marshalArguments(args);
    const response = await this.library.protocol.request('construct', {
      assembly: this.library.assembly,
      type: this.name,
      ...(signature ? { signature } : {}),
      arguments: marshalled.arguments
    }, { payload: marshalled.payload });
    return this.library.fromWire(response.result, response.payload);
  }

  async new(...args) {
    return this.construct({ arguments: args });
  }

  async call(memberOrSpec, ...args) {
    const spec = callSpec(memberOrSpec, args);
    const marshalled = marshalArguments(spec.arguments);
    const response = await this.library.protocol.request('call', {
      assembly: this.library.assembly,
      type: this.name,
      member: spec.member,
      ...(spec.signature ? { signature: spec.signature } : {}),
      arguments: marshalled.arguments
    }, { payload: marshalled.payload });
    return this.library.fromWire(response.result, response.payload);
  }

  async get(member) {
    const response = await this.library.protocol.request('get', {
      assembly: this.library.assembly,
      type: this.name,
      member
    });
    return this.library.fromWire(response.result, response.payload);
  }

  async set(member, value) {
    const marshalled = marshalArguments([value]);
    const response = await this.library.protocol.request('set', {
      assembly: this.library.assembly,
      type: this.name,
      member,
      value: marshalled.arguments[0]
    }, { payload: marshalled.payload });
    return response.result;
  }
}
