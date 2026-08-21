import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { prepareTarget } from '../../src/project/prepare.js';
import { LocalExecutionService } from '../../src/services/execution.js';

const host = { platform: process.platform, arch: process.arch, libc: process.platform === 'linux' ? 'glibc' : null, rid: process.platform === 'win32' ? `win-${process.arch}` : process.platform === 'darwin' ? `osx-${process.arch}` : `linux-${process.arch}`, desktopGui: false, desktopReason: 'test host', headlessGui: true };

test('prepareTarget composes the injected environment and execution services', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-service-prepare-'));
  const execution = new LocalExecutionService();
  const environment = { async ensure() { return { provisioned: false, dotnet: { path: process.execPath, argsPrefix: [], source: 'test', root: path.dirname(process.execPath), env: process.env, executor: execution, info: { sdks: [{ version: '10.0.100' }], runtimes: [] } } }; } };
  const services = { host: { detect: () => host }, execution, environment, project: { constructor: { name: 'TestProjectService' } } };
  try {
    const context = await prepareTarget(dir, { mode: 'temporary', restore: false, writeState: false, services });
    assert.equal(context.targetInfo.kind, 'workspace');
    assert.equal(context.dotnet.source, 'test');
    assert.equal(context.dotnet.executor, execution);
    assert.equal(context.state.services.execution, 'LocalExecutionService');
    assert.equal(context.ready, true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
