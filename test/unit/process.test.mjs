import test from 'node:test';
import assert from 'node:assert/strict';
import { runProcess } from '../../src/process/run.js';
import { spawnManagedProcess } from '../../src/process/handle.js';
import { ProcessTimeoutError } from '../../src/errors.js';

const node = process.execPath;

test('runProcess captures stdout, stderr and exit status', async () => {
  const result = await runProcess(node, ['-e', 'console.log("out"); console.error("err")']);
  assert.equal(result.ok, true);
  assert.equal(result.exitCode, 0);
  assert.match(result.stdout, /out/);
  assert.match(result.stderr, /err/);
});

test('runProcess reports non-zero exit without throwing', async () => {
  const result = await runProcess(node, ['-e', 'process.exit(7)']);
  assert.equal(result.ok, false);
  assert.equal(result.exitCode, 7);
});

test('runProcess enforces timeout', async () => {
  await assert.rejects(
    runProcess(node, ['-e', 'setTimeout(() => {}, 5000)'], { timeout: 40 }),
    error => error instanceof ProcessTimeoutError
  );
});

test('ProcessHandle streams and waits for a live process', async () => {
  const handle = spawnManagedProcess(node, ['-e', 'console.log("live")']);
  const chunks = [];
  handle.on('stdout', chunk => chunks.push(chunk));
  const result = await handle.wait();
  assert.equal(result.ok, true);
  assert.match(chunks.join(''), /live/);
});

test('runProcess honors an already-aborted signal', async () => {
  const controller = new AbortController();
  controller.abort();
  const started = Date.now();
  const result = await runProcess(node, ['-e', 'setTimeout(() => {}, 5000)'], { signal: controller.signal });
  assert.equal(result.ok, false);
  assert.ok(Date.now() - started < 1500);
});
