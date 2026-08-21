import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalExecutionService } from '../../src/services/execution.js';

test('local execution service runs shell-free Node child processes', async () => {
  const execution = new LocalExecutionService();
  const result = await execution.exec(process.execPath, ['-e', 'process.stdout.write("service-ok")']);
  assert.equal(result.ok, true);
  assert.equal(result.stdout, 'service-ok');
});
