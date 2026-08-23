import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeNET } from '../../src/index.js';
import {
  AVALONIA_VERSION,
  DOTNET_SDK_VERSION,
  buildHeadlessFixture,
  runAvaloniaAcceptance,
  shutdownBuildServers
} from '../../scripts/lib/avalonia-runtime.mjs';

const enabled = process.env.NODENET_AVALONIA === '1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function removeWorkspace(directory) {
  try {
    await fs.rm(directory, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
  } catch (error) {
    if (process.platform !== 'win32' || !['EBUSY', 'EPERM'].includes(error.code)) throw error;
  }
}

test('NodeNET drives and captures the permanent real Avalonia calculator fixture', { skip: !enabled, timeout: 25 * 60_000 }, async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-avalonia-'));
  const home = process.env.NODENET_TEST_HOME
    ? path.resolve(process.env.NODENET_TEST_HOME)
    : path.join(work, 'home');
  const output = path.resolve(process.env.NODENET_AVALONIA_OUTPUT ?? path.join(root, 'artifacts', 'avalonia-local'));
  const net = await NodeNET.attach(work, {
    mode: 'shared',
    home,
    isolation: 'managed',
    sdk: DOTNET_SDK_VERSION,
    writeState: false
  });

  try {
    const context = await net.prepare({ restore: false });
    assert.equal(context.dotnet.source, 'managed');
    assert.equal(context.dotnet.info.sdks.some(item => item.version === DOTNET_SDK_VERSION), true);
    const built = await buildHeadlessFixture({ net, repositoryRoot: root, workDirectory: work });
    const verification = await runAvaloniaAcceptance({
      dotnet: context.dotnet,
      project: built.project,
      outputDirectory: output
    });
    assert.equal(verification.frameworkVersion.startsWith(AVALONIA_VERSION), true);
    assert.equal(verification.expected, '19');
    assert.equal(verification.actual, '19');
    assert.equal(verification.pass, true);
  } finally {
    await shutdownBuildServers(net);
    await net.dispose();
    await removeWorkspace(work);
  }
});
