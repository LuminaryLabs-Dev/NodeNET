import test from 'node:test';
import assert from 'node:assert/strict';
import { validateServiceContract } from '../../src/services/contracts.js';

test('execution service contract requires explicit trust metadata', () => {
  assert.throws(
    () => validateServiceContract('execution', { exec() {}, spawn() {}, kind: 'local' }),
    error => error.code === 'SERVICE_CONTRACT_FAILED'
  );
  assert.equal(validateServiceContract('execution', {
    exec() {},
    spawn() {},
    kind: 'local',
    sandboxed: false
  }), true);
});

test('known service contracts reject missing methods', () => {
  assert.throws(
    () => validateServiceContract('interop', {}),
    error => error.code === 'SERVICE_CONTRACT_FAILED'
  );
  assert.throws(
    () => validateServiceContract('display', { capabilities() {} }),
    error => error.code === 'SERVICE_CONTRACT_FAILED' && error.details.missing.includes('createSurface')
  );
  assert.equal(validateServiceContract('display', { capabilities() {}, createSurface() {} }), true);
});
