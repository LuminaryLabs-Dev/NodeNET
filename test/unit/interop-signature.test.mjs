import test from 'node:test';
import assert from 'node:assert/strict';
import { RemoteObjectHandle, RemoteType } from '../../src/interop/model/handles.js';

function fakeLibrary() {
  const requests = [];
  return {
    requests,
    assembly: '/tmp/Test.dll',
    protocol: {
      async request(op, fields, options) {
        requests.push({ op, fields, options });
        return { result: 1, payload: Buffer.alloc(0) };
      }
    },
    fromWire(value) { return value; },
    describe() {}
  };
}

test('RemoteType forwards deterministic CLR signatures', async () => {
  const library = fakeLibrary();
  const type = new RemoteType(library, 'Example.Calculator');
  await type.call({
    member: 'Add',
    signature: 'Add(System.Int32,System.Int32)',
    arguments: [5, 8]
  });
  assert.equal(library.requests[0].fields.signature, 'Add(System.Int32,System.Int32)');
});

test('RemoteObjectHandle forwards deterministic CLR signatures', async () => {
  const library = fakeLibrary();
  const value = new RemoteObjectHandle(library, { $handle: 'obj:1', $type: 'Example.Counter' });
  await value.call({
    member: 'Set',
    signature: 'Set(System.Int32)',
    arguments: [20]
  });
  assert.equal(library.requests[0].fields.signature, 'Set(System.Int32)');
});
