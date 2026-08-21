import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectHost } from '../../src/host/platform.js';
import { createPathContext } from '../../src/host/paths.js';
import { createDotnetEnvironment } from '../../src/dotnet/environment.js';

test('detectHost maps supported Windows and macOS RIDs', () => {
  assert.equal(detectHost({ platform: 'win32', arch: 'x64', env: {} }).rid, 'win-x64');
  assert.equal(detectHost({ platform: 'darwin', arch: 'arm64', env: {} }).rid, 'osx-arm64');
});

test('temporary path mode is isolated', async () => {
  const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-target-'));
  const paths = await createPathContext({ mode: 'temporary', targetDir, rid: 'linux-x64' });
  try {
    assert.equal(paths.temporary, true);
    assert.notEqual(paths.baseDir, targetDir);
    assert.match(path.basename(paths.baseDir), /^nodenet-/);
  } finally {
    await fs.rm(paths.baseDir, { recursive: true, force: true });
    await fs.rm(targetDir, { recursive: true, force: true });
  }
});

test('createDotnetEnvironment does not mutate process.env', () => {
  const original = process.env.DOTNET_ROOT;
  const env = createDotnetEnvironment({
    root: '/private/dotnet',
    paths: { cliHome: '/tmp/cli', nugetDir: '/tmp/nuget' },
    baseEnv: { PATH: '/usr/bin' }
  });
  assert.equal(env.DOTNET_ROOT, path.resolve('/private/dotnet'));
  assert.equal(env.NUGET_PACKAGES, '/tmp/nuget');
  assert.equal(process.env.DOTNET_ROOT, original);
});
