import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { NodeNET } from '../../src/index.js';

const enabled = process.env.NODENET_INTEGRATION === '1';
const sdk = process.env.NODENET_TEST_SDK ?? '10.0';
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '..', 'fixtures');

test('managed temporary mode provisions once, builds/runs C# and invokes an arbitrary library', { skip: !enabled }, async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-integration-'));
  const consoleDir = path.join(work, 'console');
  const libraryDir = path.join(work, 'library');
  await fs.cp(path.join(fixtures, 'console'), consoleDir, { recursive: true });
  await fs.cp(path.join(fixtures, 'library'), libraryDir, { recursive: true });

  const net = await NodeNET.attach(work, {
    mode: 'temporary',
    isolation: 'managed',
    sdk,
    writeState: false
  });

  try {
    const context = await net.prepare({ restore: false });
    assert.equal(context.dotnet.source, 'managed');
    assert.equal(context.provisioned, true);

    const consoleProject = path.join(consoleDir, 'Console.csproj');
    await net.exec(['restore', consoleProject, '--nologo'], { cwd: consoleDir });
    await net.exec(['build', consoleProject, '--nologo', '--no-restore'], { cwd: consoleDir });
    const major = context.dotnet.info.sdks.at(-1).version.split('.')[0];
    const consoleAssembly = path.join(consoleDir, 'bin', 'Debug', `net${major}.0`, 'Console.dll');
    const directRun = await net.exec([consoleAssembly], { cwd: consoleDir, requireSdk: false });
    assert.match(directRun.stdout, /NodeNET portable console OK/);

    const consoleNet = await NodeNET.attach(consoleProject, {
      mode: 'temporary',
      dotnetPath: context.dotnet.path,
      env: context.dotnet.env,
      writeState: false
    });
    try {
      await consoleNet.prepare();
      const handle = await consoleNet.run();
      const runResult = await handle.wait();
      assert.equal(runResult.ok, true);
      assert.match(runResult.stdout, /NodeNET portable console OK/);
    } finally {
      await consoleNet.dispose();
    }

    const libraryProject = path.join(libraryDir, 'Library.csproj');
    await net.exec(['restore', libraryProject, '--nologo'], { cwd: libraryDir });
    await net.exec(['build', libraryProject, '--nologo', '-c', 'Release', '--no-restore'], { cwd: libraryDir });
    const libraryAssembly = path.join(libraryDir, 'bin', 'Release', `net${major}.0`, 'Library.dll');
    const library = await net.library(libraryAssembly);
    try {
      const response = await library.invoke({
        type: 'NodeNET.TestLibrary.Calculator',
        method: 'Add',
        arguments: [5, 8]
      });
      assert.equal(response.result, 13);
    } finally {
      await library.close();
    }
  } finally {
    await net.dispose();
    await fs.rm(work, { recursive: true, force: true });
  }
});
