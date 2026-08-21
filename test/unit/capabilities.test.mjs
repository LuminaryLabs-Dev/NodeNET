import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { NodeNET, definePlugin, SERVICE } from '../../src/index.js';

function fakeEnvironmentPlugin() {
  return definePlugin({
    name: 'test.environment.fake',
    provides: [SERVICE.ENVIRONMENT],
    replace: true,
    register(_registry, { provide }) {
      provide(SERVICE.ENVIRONMENT, {
        async ensure({ paths }) {
          return { provisioned: false, dotnet: { path: process.execPath, root: path.dirname(process.execPath), source: 'test', env: process.env, info: { sdks: [{ version: '10.0.100' }], runtimes: [] } } };
        }
      });
    }
  });
}

test('capabilities with prepare reports the prepared host and workspace target', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-capabilities-'));
  const net = await NodeNET.attach(dir, { mode: 'temporary', writeState: false, plugins: [fakeEnvironmentPlugin()] });
  try {
    const capabilities = await net.capabilities({ prepare: true });
    assert.ok(capabilities.host?.rid);
    assert.equal(capabilities.project.kind, 'workspace');
    assert.equal(capabilities.dotnet.source, 'test');
    assert.equal(capabilities.execution.kind, 'local');
    assert.equal(capabilities.execution.sandboxed, false);
  } finally {
    await net.dispose();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
