import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeNET, SERVICE, definePlugin } from '../../src/index.js';

test('untrusted workloads cannot use the default local executor', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-trust-'));
  try {
    await assert.rejects(
      NodeNET.attach(dir, { trust: 'untrusted' }),
      error => error.code === 'UNTRUSTED_EXECUTION_REQUIRES_SANDBOX'
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('untrusted workloads can compose with a declared sandbox executor', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-trust-sandbox-'));
  const plugin = definePlugin({
    name: 'test.execution.sandbox',
    provides: [SERVICE.EXECUTION],
    replace: true,
    register(_registry, { provide }) {
      provide(SERVICE.EXECUTION, {
        kind: 'test-sandbox',
        sandboxed: true,
        async exec() { return { ok: true, stdout: '', stderr: '', diagnostics: [], exitCode: 0 }; },
        spawn() { throw new Error('not used'); }
      });
    }
  });
  const net = await NodeNET.attach(dir, { trust: 'untrusted', plugins: [plugin] });
  try {
    assert.equal(net.services.execution.sandboxed, true);
  } finally {
    await net.dispose();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
