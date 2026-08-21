import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { NodeNET } from '../../src/index.js';
import { prepareTarget } from '../../src/project/prepare.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '..', 'fixtures');
const fakeDotnet = path.join(fixtures, 'fake-dotnet', 'fake-dotnet.mjs');

test('prepareTarget verifies an explicit SDK and restores a project', async () => {
  const context = await prepareTarget(path.join(fixtures, 'console', 'Console.csproj'), {
    mode: 'temporary',
    dotnetPath: process.execPath,
    dotnetArgsPrefix: [fakeDotnet],
    writeState: false
  });
  try {
    assert.equal(context.ready, true);
    assert.equal(context.dotnet.source, 'explicit');
    assert.equal(context.restoreResult.ok, true);
    assert.equal(context.requirement.version, '10.0');
  } finally {
    await fs.rm(context.paths.baseDir, { recursive: true, force: true });
  }
});

test('NodeNET can attach to an empty workspace and expose raw dotnet CLI access', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-workspace-api-'));
  const net = await NodeNET.attach(dir, {
    mode: 'temporary',
    dotnetPath: process.execPath,
    dotnetArgsPrefix: [fakeDotnet],
    writeState: false
  });
  try {
    const context = await net.prepare({ restore: false });
    assert.equal(context.targetInfo.kind, 'workspace');
    const result = await net.exec(['--version']);
    assert.equal(result.stdout.trim(), '10.0.100');
  } finally {
    await net.dispose();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('prepareTarget inventories native package assets without installing OS packages', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-native-assets-'));
  const project = path.join(dir, 'Native.csproj');
  await fs.writeFile(project, '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>');
  await fs.mkdir(path.join(dir, 'obj'), { recursive: true });
  await fs.writeFile(path.join(dir, 'obj', 'project.assets.json'), JSON.stringify({
    targets: {
      'net10.0': {
        'Example.Native/1.0.0': {
          native: { 'runtimes/linux-x64/native/libexample.so': {} },
          runtimeTargets: {
            'runtimes/linux-x64/native/libother.so': { assetType: 'native', rid: 'linux-x64' }
          }
        }
      }
    }
  }));

  const context = await prepareTarget(project, {
    mode: 'temporary',
    dotnetPath: process.execPath,
    dotnetArgsPrefix: [fakeDotnet],
    writeState: false
  });
  try {
    assert.equal(context.nativeAssets.checked, true);
    assert.deepEqual(context.nativeAssets.assets, [
      'runtimes/linux-x64/native/libexample.so',
      'runtimes/linux-x64/native/libother.so'
    ]);
  } finally {
    await fs.rm(context.paths.baseDir, { recursive: true, force: true });
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('temporary mode leaves no project state file unless explicitly requested', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-temp-state-'));
  const project = path.join(dir, 'Temp.csproj');
  await fs.writeFile(project, '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net10.0</TargetFramework></PropertyGroup></Project>');
  const context = await prepareTarget(project, {
    mode: 'temporary',
    dotnetPath: process.execPath,
    dotnetArgsPrefix: [fakeDotnet]
  });
  try {
    assert.equal(context.statePath, null);
    await assert.rejects(fs.access(path.join(dir, '.nodenet', 'state.json')));
  } finally {
    await fs.rm(context.paths.baseDir, { recursive: true, force: true });
    await fs.rm(dir, { recursive: true, force: true });
  }
});
