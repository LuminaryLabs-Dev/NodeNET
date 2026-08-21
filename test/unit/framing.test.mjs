import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeFrame, FrameDecoder } from '../../src/interop/protocol/framing.js';

test('framing survives partial chunks and preserves binary payload bytes', () => {
  const payload = Buffer.from([0, 1, 2, 10, 255]);
  const frame = encodeFrame({ id: '1', op: 'call' }, payload);
  const decoder = new FrameDecoder();
  assert.deepEqual(decoder.push(frame.subarray(0, 3)), []);
  const decoded = decoder.push(frame.subarray(3));
  assert.equal(decoded.length, 1);
  assert.deepEqual(decoded[0].message, { id: '1', op: 'call' });
  assert.deepEqual(decoded[0].payload, payload);
});

test('framing decodes multiple adjacent messages', () => {
  const combined = Buffer.concat([encodeFrame({ id: '1' }), encodeFrame({ id: '2' }, Buffer.from('abc'))]);
  const decoded = new FrameDecoder().push(combined);
  assert.equal(decoded.length, 2);
  assert.equal(decoded[0].message.id, '1');
  assert.equal(decoded[1].message.id, '2');
  assert.equal(decoded[1].payload.toString('utf8'), 'abc');
});

test('framing rejects impossible declared sizes before allocation', () => {
  const prefix = Buffer.alloc(8);
  prefix.writeUInt32LE(0xffffffff, 0);
  assert.throws(() => new FrameDecoder().push(prefix), RangeError);
});
