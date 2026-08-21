import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { NodeNET } from '../../src/index.js';

const enabled = process.env.NODENET_AVALONIA === '1';
const sdk = process.env.NODENET_TEST_SDK ?? '10.0';

test('Avalonia template can be restored and built through a managed NodeNET SDK', { skip: !enabled }, async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-avalonia-'));
  const net = await NodeNET.attach(work, {
    mode: 'temporary',
    isolation: 'managed',
    sdk,
    writeState: false
  });
  try {
    await net.prepare({ restore: false });
    await net.exec(['new', 'install', 'Avalonia.Templates'], { cwd: work });
    await net.exec(['new', 'avalonia.app', '-o', path.join(work, 'App')], { cwd: work });
    const app = await NodeNET.attach(path.join(work, 'App'), {
      mode: 'temporary',
      isolation: 'managed',
      sdk,
      writeState: false
    });
    try {
      await app.prepare();
      const build = await app.build();
      assert.equal(build.ok, true);
    } finally {
      await app.dispose();
    }
  } finally {
    await net.dispose();
    await fs.rm(work, { recursive: true, force: true });
  }
});
