import test from 'node:test';
import assert from 'node:assert/strict';
import { formatProgress } from '../../src/cli/progress.js';

test('progress messages explain provisioning phases', () => {
  assert.match(formatProgress({ phase: 'resolve', requirement: { kind: 'sdk', version: '10.0' }, rid: 'linux-x64' }), /10\.0/);
  assert.match(formatProgress({ phase: 'download', received: 50, total: 100 }), /50%/);
  assert.equal(formatProgress({ phase: 'extract' }), 'Extracting .NET');
});
