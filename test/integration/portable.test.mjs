import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { NodeNET } from '../../src/index.js';

const enabled = process.env.NODENET_INTEGRATION === '1';
const sdk = process.env.NODENET_TEST_SDK ?? '10.0';
const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '..', 'fixtures');
const root = path.resolve(here, '..', '..');

function exec(command, args, { cwd, env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = ''; let stderr = '';
    child.stdout.setEncoding('utf8'); child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => resolve({ code, stdout, stderr }));
  });
}

function processEvidence(result) {
  return `exit=${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}

test('managed NodeNET provisions, builds/runs C#, preserves interop, and powers the packed CLI', { skip: !enabled, timeout: 20 * 60_000 }, async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-integration-'));
  const home = path.join(work, 'home');
  const consoleDir = path.join(work, 'console');
  const libraryDir = path.join(work, 'library');
  await fs.cp(path.join(fixtures, 'console'), consoleDir, { recursive: true });
  await fs.cp(path.join(fixtures, 'library'), libraryDir, { recursive: true });

  const net = await NodeNET.attach(work, { mode: 'shared', home, isolation: 'managed', sdk, writeState: false });
  try {
    const context = await net.prepare({ restore: false });
    assert.equal(context.dotnet.source, 'managed');
    assert.equal(context.provisioned, true);
    assert.equal(context.dotnet.executor?.constructor?.name, 'LocalExecutionService');

    const consoleProject = path.join(consoleDir, 'Console.csproj');
    await net.exec(['restore', consoleProject, '--nologo'], { cwd: consoleDir });
    await net.exec(['build', consoleProject, '--nologo', '--no-restore'], { cwd: consoleDir });
    const major = context.dotnet.info.sdks.at(-1).version.split('.')[0];
    const consoleAssembly = path.join(consoleDir, 'bin', 'Debug', `net${major}.0`, 'Console.dll');
    const directRun = await net.exec([consoleAssembly], { cwd: consoleDir, requireSdk: false });
    assert.match(directRun.stdout, /NodeNET portable console OK/);

    const consoleNet = await NodeNET.attach(consoleProject, { mode: 'temporary', dotnetPath: context.dotnet.path, env: context.dotnet.env, writeState: false });
    try {
      await consoleNet.prepare();
      const handle = await consoleNet.run();
      const runResult = await handle.wait();
      assert.equal(runResult.ok, true);
      assert.match(runResult.stdout, /NodeNET portable console OK/);
    } finally { await consoleNet.dispose(); }

    const libraryProject = path.join(libraryDir, 'Library.csproj');
    await net.exec(['restore', libraryProject, '--nologo'], { cwd: libraryDir });
    await net.exec(['build', libraryProject, '--nologo', '-c', 'Release', '--no-restore'], { cwd: libraryDir });
    const libraryAssembly = path.join(libraryDir, 'bin', 'Release', `net${major}.0`, 'Library.dll');
    const library = await net.library(libraryAssembly);
    try {
      const legacy = await library.invoke({
        type: 'NodeNET.TestLibrary.Calculator',
        method: 'Add',
        signature: 'Add(System.Int32,System.Int32)',
        arguments: [5, 8]
      });
      assert.equal(legacy.result, 13);

      const counterType = library.type('NodeNET.TestLibrary.Counter');
      const descriptor = await counterType.describe();
      assert.ok(descriptor.constructors.some(member => member.signature === '.ctor(System.Int32)'));
      assert.ok(descriptor.methods.some(member => member.signature === 'Increment()'));
      assert.ok(descriptor.properties.some(member => member.name === 'Value'));

      const counter = await counterType.construct({ signature: '.ctor(System.Int32)', arguments: [10] });
      await counter.call({ member: 'Increment', signature: 'Increment()', arguments: [] });
      assert.equal(await counter.get('Value'), 11);
      await counter.set('Value', 20);
      assert.equal(await counter.get('Value'), 20);

      const bytes = Buffer.from([0, 1, 2, 10, 255]);
      const echoed = await counter.call('EchoBytes', bytes);
      assert.ok(Buffer.isBuffer(echoed));
      assert.deepEqual(echoed, bytes);

      const stream = await counter.call('OpenStream', Buffer.from('stream-data'));
      const chunks = [];
      while (true) {
        const { bytes: chunk, eof } = await stream.read(3);
        if (chunk.length) chunks.push(chunk);
        if (eof) break;
      }
      assert.equal(Buffer.concat(chunks).toString('utf8'), 'stream-data');
      await stream.dispose();
      await counter.dispose();
      await assert.rejects(() => counter.get('Value'));
    } finally { await library.close(); }

    const displayProject = path.join(fixtures, 'display-dotnet', 'DisplayFixture.csproj');
    await net.exec(['restore', displayProject, '--nologo'], { cwd: path.dirname(displayProject) });
    const displayBuild = await net.exec(['build', displayProject, '--nologo', '--no-restore'], {
      cwd: path.dirname(displayProject),
      rejectOnNonZero: false
    });
    assert.equal(displayBuild.ok, true, processEvidence(displayBuild));
    const displayAssembly = path.join(path.dirname(displayProject), 'bin', 'Debug', 'net10.0', 'DisplayFixture.dll');
    const displayNet = await NodeNET.attach(displayAssembly, {
      mode: 'temporary',
      dotnetPath: context.dotnet.path,
      env: context.dotnet.env,
      writeState: false
    });
    try {
      const handle = await displayNet.run({ binaryStdout: true });
      const surface = await displayNet.display({ process: handle });
      const ready = await surface.waitForReady();
      assert.equal(ready.metadata.fixture, 'managed-dotnet');
      const initial = await surface.waitForFrame({ afterSequence: 0 });
      assert.equal(initial.width, 4);
      assert.equal(initial.height, 2);
      assert.equal(initial.stride, 16);
      assert.equal(initial.format, 'rgba8');
      assert.deepEqual([...initial.pixels.subarray(0, 8)], [255, 0, 0, 255, 0, 255, 0, 255]);
      assert.equal(crypto.createHash('sha256').update(initial.pixels).digest('hex'), 'ad8558af4bb65a77a12c8ffce48b69845a16629bb24f2b2b4731475ceefac73f');
      const beforeInput = surface.sequence;
      const inputResult = await surface.pointer({ type: 'click', x: 1, y: 1, button: 0 });
      assert.equal(inputResult.state.display, 'changed');
      const changed = await surface.waitForFrame({ afterSequence: beforeInput });
      assert.deepEqual([...changed.pixels.subarray(0, 4)], [17, 34, 51, 255]);
      await surface.dispose();
      const processResult = await handle.wait();
      assert.equal(processResult.ok, true, processResult.stderr);
    } finally { await displayNet.dispose(); }

    const pack = await exec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['pack', '--pack-destination', work], { cwd: root });
    assert.equal(pack.code, 0, pack.stderr);
    const tarballName = pack.stdout.trim().split(/\r?\n/).filter(Boolean).at(-1);
    const tarball = path.join(work, tarballName);
    assert.ok((await fs.stat(tarball)).isFile());

    const consumer = path.join(work, 'consumer');
    await fs.mkdir(consumer, { recursive: true });
    await fs.writeFile(path.join(consumer, 'package.json'), '{"private":true}\n');
    const install = await exec(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', tarball, '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: consumer });
    assert.equal(install.code, 0, install.stderr);

    const packedCli = path.join(consumer, 'node_modules', '@luminarylabs', 'nodenet', 'bin', 'nodenet.js');
    const cliEnv = { ...process.env, NODENET_HOME: home, NODENET_ISOLATION: 'managed', NODENET_SDK: sdk };

    const version = await exec(process.execPath, [packedCli, '--version'], { cwd: consumer, env: cliEnv });
    assert.equal(version.code, 0, version.stderr);
    assert.match(version.stdout, /^NodeNET 0\.3\.2/m);

    const help = await exec(process.execPath, [packedCli, 'build', '--help'], { cwd: consumer, env: cliEnv });
    assert.equal(help.code, 0, help.stderr);
    assert.match(help.stdout, /build: Build the attached project or solution/);

    const create = await exec(process.execPath, [packedCli, 'new', 'console', '-o', 'Hello'], { cwd: consumer, env: cliEnv });
    assert.equal(create.code, 0, create.stderr);

    const hello = path.join(consumer, 'Hello');
    const build = await exec(process.execPath, [packedCli, 'build', '--verbosity', 'minimal'], { cwd: hello, env: cliEnv });
    assert.equal(build.code, 0, build.stderr);

    const cache = await exec(process.execPath, [packedCli, 'cache', 'info', '--json'], { cwd: hello, env: cliEnv });
    assert.equal(cache.code, 0, cache.stderr);
    assert.equal(JSON.parse(cache.stdout).baseDir, home);

    const run = await exec(process.execPath, [packedCli, 'run'], { cwd: hello, env: cliEnv });
    assert.equal(run.code, 0, run.stderr);
    assert.match(run.stdout, /Hello, World!/i);
  } finally {
    try { await net.exec(['build-server', 'shutdown'], { rejectOnNonZero: false }); } catch {}
    await net.dispose();
    await fs.rm(work, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  }
});
