import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NodeNET, savePng } from '../src/index.js';
import {
  AVALONIA_VERSION,
  DOTNET_SDK_VERSION,
  buildHeadlessFixture,
  buildVisibleFixture,
  runAvaloniaAcceptance,
  runVisibleAcceptance,
  shutdownBuildServers
} from './lib/avalonia-runtime.mjs';
import { createZip, inspectPng, overallVerdict, sha256File } from './lib/validation-artifacts.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const visible = process.argv.includes('--visible');
const unexpected = process.argv.slice(2).filter(argument => argument !== '--visible');
if (unexpected.length) throw new TypeError(`Unknown local validation argument(s): ${unexpected.join(', ')}`);

class BlockedError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'BlockedError';
  }
}

function timestampId() {
  return new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').replace(/\.(\d{3})Z$/, '-$1');
}

function shellQuote(value) {
  const text = String(value);
  return /^[A-Za-z0-9_./:@=+-]+$/.test(text) ? text : JSON.stringify(text);
}

function conciseError(error) {
  const cause = error?.cause?.message ? ` Cause: ${error.cause.message}` : '';
  return `${error?.code ? `[${error.code}] ` : ''}${error?.message ?? String(error)}${cause}`.slice(0, 4000);
}

function environmentBlocked(error) {
  if (error instanceof BlockedError) return true;
  if (['DOTNET_PROVISION_FAILED', 'DOTNET_RESOLUTION_FAILED', 'GUI_UNAVAILABLE'].includes(error?.code)) return true;
  return /network|ENETUNREACH|ECONN|EAI_AGAIN|NU1301|service index|name resolution|timed out downloading/i.test(conciseError(error));
}

async function locateNpmCli() {
  const candidates = [
    process.env.npm_execpath,
    path.resolve(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js'),
    path.resolve(path.dirname(process.execPath), '..', 'node_modules', 'npm', 'bin', 'npm-cli.js')
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  throw new BlockedError('Unable to locate npm-cli.js for cross-platform packed-package validation.');
}

function spawnCapture(command, args, { cwd = root, env = process.env, stream = true } = {}) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn(command, args, { cwd, env, shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      stdout += chunk;
      if (stream) process.stdout.write(chunk);
    });
    child.stderr.on('data', chunk => {
      stderr += chunk;
      if (stream) process.stderr.write(chunk);
    });
    child.on('error', reject);
    child.on('close', exitCode => resolve({
      command,
      args: [...args],
      cwd,
      exitCode,
      durationMs: Date.now() - started,
      stdout,
      stderr,
      ok: exitCode === 0
    }));
  });
}

async function main() {
  const runId = timestampId();
  const validationRoot = path.join(root, 'artifacts', 'local-validation');
  const runDirectory = path.join(validationRoot, runId);
  const logFile = path.join(runDirectory, 'commands.log');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-local-validation-'));
  await fs.mkdir(runDirectory, { recursive: true });
  await fs.writeFile(logFile, `NodeNET local validation ${runId}\n`);

  const gates = [];
  const evidence = {};
  let environment = null;
  let npmCli = null;
  let tarball = null;
  let managedNet = null;
  let managedContext = null;
  let builtFixture = null;

  async function logCommand(result, displayCommand = result.command) {
    const rendered = [displayCommand, ...result.args].map(shellQuote).join(' ');
    await fs.appendFile(logFile, [
      '',
      `$ ${rendered}`,
      `cwd: ${result.cwd}`,
      `exit: ${result.exitCode}`,
      `durationMs: ${result.durationMs}`,
      'stdout:',
      result.stdout ?? '',
      'stderr:',
      result.stderr ?? '',
      ''
    ].join('\n'));
  }

  async function command(command, args, options = {}) {
    const result = await spawnCapture(command, args, options);
    await logCommand(result, options.displayCommand ?? command);
    return result;
  }

  async function node(args, options = {}) {
    return command(process.execPath, args, { ...options, displayCommand: 'node' });
  }

  async function npm(args, options = {}) {
    npmCli ??= await locateNpmCli();
    const cache = path.join(temporary, 'npm-cache');
    const result = await spawnCapture(process.execPath, [npmCli, '--cache', cache, ...args], options);
    await logCommand({ ...result, args: ['--cache', cache, ...args] }, 'npm');
    return result;
  }

  async function logDotnetCommand(record) {
    await logCommand({ ...record, ok: record.exitCode === 0 }, 'dotnet');
  }

  async function netExec(net, args, options = {}) {
    const started = Date.now();
    const result = await net.exec(args, { ...options, rejectOnNonZero: false });
    await logDotnetCommand({
      args,
      cwd: options.cwd ?? root,
      exitCode: result.exitCode,
      durationMs: Date.now() - started,
      stdout: result.stdout,
      stderr: result.stderr
    });
    assert.equal(result.ok, true, `dotnet ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
    return result;
  }

  async function gate(id, label, operation, { required = true } = {}) {
    const started = Date.now();
    process.stdout.write(`\n[RUN ] ${label}\n`);
    try {
      const details = await operation();
      const record = { id, label, required, status: 'PASS', durationMs: Date.now() - started, details: details ?? null };
      gates.push(record);
      process.stdout.write(`[PASS] ${label}\n`);
      return record;
    } catch (error) {
      const status = environmentBlocked(error) ? 'BLOCKED' : 'FAIL';
      const record = { id, label, required, status, durationMs: Date.now() - started, error: conciseError(error) };
      gates.push(record);
      process.stderr.write(`[${status}] ${label}: ${record.error}\n`);
      return record;
    }
  }

  function skip(id, label, reason, { required = true } = {}) {
    const record = { id, label, required, status: 'SKIPPED', durationMs: 0, error: reason };
    gates.push(record);
    process.stdout.write(`[SKIP] ${label}: ${reason}\n`);
    return record;
  }

  function passed(id) {
    return gates.find(item => item.id === id)?.status === 'PASS';
  }

  const repositoryGate = await gate('repository', 'Repository and environment inspection', async () => {
    const commit = await command('git', ['rev-parse', 'HEAD'], { stream: false });
    const branch = await command('git', ['branch', '--show-current'], { stream: false });
    const status = await command('git', ['status', '--porcelain=v1', '--untracked-files=all'], { stream: false });
    const npmVersion = await npm(['--version'], { stream: false });
    for (const result of [commit, branch, status, npmVersion]) assert.equal(result.ok, true, result.stderr);
    const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
    const packageLock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
    const executable = await fs.stat(path.join(root, 'bin', 'nodenet.js'));
    assert.equal(branch.stdout.trim(), 'main', 'Production validation must run from main.');
    assert.equal(status.stdout, '', 'Production validation requires a clean working tree.');
    assert.equal(packageJson.version, '0.3.2');
    assert.equal(packageLock.version, packageJson.version);
    assert.equal(packageLock.packages[''].version, packageJson.version);
    if (process.platform !== 'win32') assert.ok((executable.mode & 0o111) !== 0, 'bin/nodenet.js must remain executable.');
    environment = {
      runId,
      startedAt: new Date().toISOString(),
      repository: 'LuminaryLabs-Dev/NodeNET',
      branch: branch.stdout.trim(),
      commit: commit.stdout.trim(),
      worktreeBefore: status.stdout,
      platform: process.platform,
      architecture: process.arch,
      osRelease: os.release(),
      osVersion: os.version(),
      node: process.version,
      npm: npmVersion.stdout.trim(),
      packageVersion: packageJson.version,
      pinnedDotnetSdk: DOTNET_SDK_VERSION,
      pinnedAvalonia: AVALONIA_VERSION,
      visibleRequested: visible
    };
    return { commit: environment.commit, branch: environment.branch, clean: true, node: environment.node, npm: environment.npm };
  });

  if (environment === null) {
    const commit = await spawnCapture('git', ['rev-parse', 'HEAD'], { cwd: root, stream: false }).catch(() => ({ stdout: 'unknown' }));
    environment = {
      runId,
      startedAt: new Date().toISOString(),
      repository: 'LuminaryLabs-Dev/NodeNET',
      branch: 'unknown',
      commit: commit.stdout.trim(),
      worktreeBefore: 'inspection failed',
      platform: process.platform,
      architecture: process.arch,
      osRelease: os.release(),
      osVersion: os.version(),
      node: process.version,
      npm: 'unknown',
      packageVersion: '0.3.2',
      pinnedDotnetSdk: DOTNET_SDK_VERSION,
      pinnedAvalonia: AVALONIA_VERSION,
      visibleRequested: visible
    };
  }

  await gate('static-unit', 'JavaScript syntax and unit suite', async () => {
    const result = await node([path.join(root, 'scripts', 'check.mjs')]);
    assert.equal(result.ok, true, result.stderr);
    const summaries = [...result.stdout.matchAll(/(?:^|\n)(?:#|ℹ)?\s*tests\s+(\d+)(?=\s|$)/g)];
    const count = Number(summaries.at(-1)?.[1] ?? 0);
    assert.ok(count >= 67, `Expected at least 67 unit tests, observed ${count}.`);
    return { tests: count, syntax: 'PASS' };
  });

  await gate('software-display', 'Software framebuffer live calculator', async () => {
    const output = path.join(runDirectory, 'software');
    const result = await node([path.join(root, 'scripts', 'display-proof.mjs'), '--output', output]);
    assert.equal(result.ok, true, result.stderr);
    const verification = JSON.parse(await fs.readFile(path.join(output, 'verification.json'), 'utf8'));
    assert.equal(verification.expected, '19');
    assert.equal(verification.actual, '19');
    assert.equal(verification.changed, true);
    assert.equal(verification.pass, true);
    const images = await Promise.all([
      'calculator-initial.png',
      'calculator-12-plus-7.png',
      'calculator-result-19.png'
    ].map(name => inspectPng(path.join(output, name))));
    evidence.software = { verification, images };
    return { actual: verification.actual, changed: verification.changed, hashes: verification.hashes };
  });

  const packageGate = await gate('package', 'Clean npm tarball creation and audit', async () => {
    const destination = path.join(temporary, 'package');
    await fs.mkdir(destination, { recursive: true });
    const result = await npm(['pack', '--json', '--pack-destination', destination], { cwd: root });
    assert.equal(result.ok, true, result.stderr);
    const manifest = JSON.parse(result.stdout);
    assert.equal(manifest.length, 1);
    const packed = manifest[0];
    tarball = path.join(destination, packed.filename);
    assert.ok((await fs.stat(tarball)).isFile());
    assert.ok(packed.files.every(item => {
      if (item.path === 'bin/nodenet.js') return true;
      return !/(^|\/)(?:bin|obj|test|scripts|artifacts|node_modules)(\/|$)/.test(item.path);
    }), 'Tarball contains validation-only or generated files.');
    evidence.package = {
      file: packed.filename,
      bytes: packed.size,
      unpackedBytes: packed.unpackedSize,
      entries: packed.entryCount,
      sha256: await sha256File(tarball)
    };
    return evidence.package;
  });

  if (packageGate.status === 'PASS') {
    await gate('packed-consumer', 'Clean packed-package runtime and CLI consumer', async () => {
      const consumer = path.join(temporary, 'consumer');
      await fs.mkdir(consumer, { recursive: true });
      await fs.writeFile(path.join(consumer, 'package.json'), '{"private":true,"type":"module"}\n');
      const install = await npm(['install', tarball, '--ignore-scripts', '--no-audit', '--no-fund'], { cwd: consumer });
      assert.equal(install.ok, true, install.stderr);
      await fs.writeFile(path.join(consumer, 'runtime.mjs'), `import assert from 'node:assert/strict';
import { Frame, FrameSurface, encodePng } from '@luminarylabs/nodenet';
const frame = new Frame({ width: 2, height: 1, pixels: new Uint8Array([255,0,0,255,0,255,0,255]) });
const surface = new FrameSurface({ width: 2, height: 1 });
surface.submit(frame); surface.present({ source: 'packed-consumer' });
assert.deepEqual([...surface.capture().pixels], [255,0,0,255,0,255,0,255]);
const png = encodePng(surface.capture());
assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
await surface.dispose();
console.log(JSON.stringify({ pixels: 8, png: true, pass: true }));
`);
      const runtime = await node([path.join(consumer, 'runtime.mjs')], { cwd: consumer });
      assert.equal(runtime.ok, true, runtime.stderr);
      const cli = path.join(consumer, 'node_modules', '@luminarylabs', 'nodenet', 'bin', 'nodenet.js');
      const versionResult = await node([cli, '--version'], { cwd: consumer });
      const helpResult = await node([cli, 'build', '--help'], { cwd: consumer });
      assert.equal(versionResult.ok, true, versionResult.stderr);
      assert.match(versionResult.stdout, /^NodeNET 0\.3\.2/m);
      assert.equal(helpResult.ok, true, helpResult.stderr);
      assert.match(helpResult.stdout, /build: Build the attached project or solution/);
      evidence.consumer = JSON.parse(runtime.stdout.trim().split(/\r?\n/).at(-1));
      return { runtime: true, cliVersion: '0.3.2', cliHelp: true };
    });

    await gate('typescript', 'Strict NodeNext TypeScript packed consumer', async () => {
      const consumer = path.join(temporary, 'consumer');
      const compiler = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
      await fs.access(compiler);
      await fs.writeFile(path.join(consumer, 'index.ts'), `import { DisplayValidationHarness, Frame, FrameSurface, NodeNET } from '@luminarylabs/nodenet';
const frame = new Frame({ width: 1, height: 1, pixels: new Uint8Array([1, 2, 3, 255]) });
const surface = new FrameSurface({ width: 1, height: 1 });
surface.submit(frame);
surface.present({ stage: 'typescript' });
const harness: DisplayValidationHarness = new DisplayValidationHarness(surface);
const pending: Promise<NodeNET> = NodeNET.attach('.', { isolation: 'managed', sdk: '${DOTNET_SDK_VERSION}' });
void harness; void pending;
`);
      await fs.writeFile(path.join(consumer, 'tsconfig.json'), `${JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          lib: ['ES2022', 'DOM'],
          strict: true,
          noEmit: true,
          skipLibCheck: false
        },
        files: ['index.ts']
      }, null, 2)}\n`);
      const result = await node([compiler, '--project', path.join(consumer, 'tsconfig.json')], { cwd: consumer });
      assert.equal(result.ok, true, result.stderr);
      return { compiler: '7.0.2', strict: true, moduleResolution: 'NodeNext' };
    });
  } else {
    skip('packed-consumer', 'Clean packed-package runtime and CLI consumer', 'Package creation did not pass.');
    skip('typescript', 'Strict NodeNext TypeScript packed consumer', 'Package creation did not pass.');
  }

  const provisionGate = await gate('dotnet-provision', 'Private .NET provisioning from an empty managed home', async () => {
    const managedHome = path.join(temporary, 'managed-home');
    let progressPhase = null;
    let progressAt = 0;
    await assert.rejects(fs.access(managedHome));
    managedNet = await NodeNET.attach(temporary, {
      mode: 'shared',
      home: managedHome,
      isolation: 'managed',
      sdk: DOTNET_SDK_VERSION,
      writeState: false,
      onProgress: event => {
        const now = Date.now();
        if (event.phase === progressPhase && now - progressAt < 1000) return;
        progressPhase = event.phase;
        progressAt = now;
        const total = Number.isFinite(event.total) ? `/${event.total}` : '';
        const received = Number.isFinite(event.received) ? ` ${event.received}${total}` : '';
        process.stdout.write(`[.NET] ${event.phase}${received}\n`);
      }
    });
    const started = Date.now();
    managedContext = await managedNet.prepare({ restore: false });
    await fs.appendFile(logFile, `\n$ NodeNET.prepare --managed-sdk ${DOTNET_SDK_VERSION}\nexit: 0\ndurationMs: ${Date.now() - started}\n`);
    assert.equal(managedContext.dotnet.source, 'managed');
    assert.equal(managedContext.provisioned, true, 'An empty managed home must provision a fresh SDK.');
    assert.equal(managedContext.dotnet.info.sdks.some(item => item.version === DOTNET_SDK_VERSION), true);
    const versionResult = await netExec(managedNet, ['--version'], { cwd: temporary });
    assert.equal(versionResult.stdout.trim(), DOTNET_SDK_VERSION);
    const provision = {
      source: managedContext.dotnet.source,
      provisioned: managedContext.provisioned,
      sdk: versionResult.stdout.trim(),
      rid: managedContext.host.rid,
      requirement: managedContext.requirement,
      officialArtifactSha512: managedContext.dotnet.artifact?.hash ?? null,
      sdkIncludedInReport: false,
      pass: true
    };
    await fs.mkdir(path.join(runDirectory, 'dotnet'), { recursive: true });
    await fs.writeFile(path.join(runDirectory, 'dotnet', 'provision.json'), `${JSON.stringify(provision, null, 2)}\n`);
    environment.dotnet = { source: provision.source, sdk: provision.sdk, rid: provision.rid };
    evidence.dotnetProvision = provision;
    return { source: provision.source, sdk: provision.sdk, rid: provision.rid, fresh: true };
  });

  if (provisionGate.status === 'PASS') {
    await gate('dotnet-frame-input', 'Exact C# RGBA frame and Node pointer round trip', async () => {
      const mirror = path.join(temporary, 'display-repository');
      const fixtureDirectory = path.join(mirror, 'test', 'fixtures', 'display-dotnet');
      const bridgeDirectory = path.join(mirror, 'bridge', 'NodeNET.Display');
      await fs.mkdir(path.dirname(fixtureDirectory), { recursive: true });
      const sourceOnly = item => !['bin', 'obj'].includes(path.basename(item));
      await fs.cp(path.join(root, 'test', 'fixtures', 'display-dotnet'), fixtureDirectory, { recursive: true, filter: sourceOnly });
      await fs.mkdir(path.dirname(bridgeDirectory), { recursive: true });
      await fs.cp(path.join(root, 'bridge', 'NodeNET.Display'), bridgeDirectory, { recursive: true, filter: sourceOnly });
      const project = path.join(fixtureDirectory, 'DisplayFixture.csproj');
      await netExec(managedNet, ['restore', project, '--nologo', '-p:NodeNETTargetFramework=net10.0'], { cwd: fixtureDirectory });
      await netExec(managedNet, ['build', project, '--nologo', '--no-restore', '-p:NodeNETTargetFramework=net10.0'], { cwd: fixtureDirectory });
      const assembly = path.join(fixtureDirectory, 'bin', 'Debug', 'net10.0', 'DisplayFixture.dll');
      const displayNet = await NodeNET.attach(assembly, {
        mode: 'temporary',
        dotnetPath: managedContext.dotnet.path,
        env: managedContext.dotnet.env,
        writeState: false
      });
      let handle;
      let surface;
      try {
        handle = await displayNet.run({ binaryStdout: true });
        assert.equal(path.resolve(handle.command), path.resolve(managedContext.dotnet.path));
        assert.ok(Number.isInteger(handle.pid) && handle.pid > 0);
        surface = await displayNet.display({ process: handle });
        const ready = await surface.waitForReady({ timeout: 30_000 });
        assert.equal(ready.metadata.fixture, 'managed-dotnet');
        const initial = await surface.waitForFrame({ afterSequence: 0, timeout: 30_000 });
        const initialHash = crypto.createHash('sha256').update(initial.pixels).digest('hex');
        assert.equal(initialHash, 'ad8558af4bb65a77a12c8ffce48b69845a16629bb24f2b2b4731475ceefac73f');
        assert.deepEqual([...initial.pixels.subarray(0, 8)], [255, 0, 0, 255, 0, 255, 0, 255]);
        const dotnetOutput = path.join(runDirectory, 'dotnet');
        await savePng(initial, path.join(dotnetOutput, 'csharp-frame-initial.png'));
        const before = surface.sequence;
        const input = await surface.pointer({ type: 'click', x: 1, y: 1, button: 0 });
        assert.equal(input.state.display, 'changed');
        const changed = await surface.waitForFrame({ afterSequence: before, timeout: 30_000 });
        const changedHash = crypto.createHash('sha256').update(changed.pixels).digest('hex');
        assert.notEqual(changedHash, initialHash);
        assert.deepEqual([...changed.pixels.subarray(0, 4)], [17, 34, 51, 255]);
        await savePng(changed, path.join(dotnetOutput, 'csharp-frame-after-input.png'));
        await surface.dispose();
        const processResult = await handle.wait();
        assert.equal(processResult.ok, true, processResult.stderr);
        const verification = {
          managedProcess: true,
          processId: handle.pid,
          displayHandshake: true,
          width: initial.width,
          height: initial.height,
          format: initial.format,
          exactInitialSha256: initialHash,
          changedSha256: changedHash,
          pointerState: input.state,
          changed: initialHash !== changedHash,
          processExitCode: processResult.exitCode,
          pass: input.state.display === 'changed' && initialHash !== changedHash && processResult.ok
        };
        await fs.writeFile(path.join(dotnetOutput, 'verification.json'), `${JSON.stringify(verification, null, 2)}\n`);
        evidence.dotnetFrame = verification;
        return { exactFrame: true, inputState: input.state.display, changed: true, processExitCode: processResult.exitCode };
      } finally {
        if (surface && surface.disposed === false) await surface.dispose().catch(() => {});
        if (handle?.running) await handle.stop().catch(() => {});
        await displayNet.dispose();
      }
    });
  } else {
    skip('dotnet-frame-input', 'Exact C# RGBA frame and Node pointer round trip', 'Private .NET provisioning did not pass.');
  }

  if (passed('dotnet-frame-input')) {
    await gate('avalonia-build', 'Pinned permanent Avalonia fixture locked restore and build', async () => {
      builtFixture = await buildHeadlessFixture({
        net: managedNet,
        repositoryRoot: root,
        workDirectory: temporary,
        onCommand: logDotnetCommand
      });
      return {
        sdk: DOTNET_SDK_VERSION,
        avalonia: AVALONIA_VERSION,
        lockedRestore: true,
        buildExitCode: builtFixture.build.exitCode
      };
    });
  } else {
    skip('avalonia-build', 'Pinned permanent Avalonia fixture locked restore and build', 'The C# display bridge gate did not pass.');
  }

  if (passed('avalonia-build')) {
    await gate('avalonia-runtime', 'Real Avalonia controls, live C# state, and NodeNET input', async () => {
      const output = path.join(runDirectory, 'avalonia');
      const verification = await runAvaloniaAcceptance({
        dotnet: managedContext.dotnet,
        project: builtFixture.project,
        outputDirectory: output,
        onProcess: async record => {
          await fs.appendFile(logFile, `\nAvalonia process ${record.phase}: ${JSON.stringify(record)}\n`);
        }
      });
      evidence.avalonia = verification;
      return {
        frameworkVersion: verification.frameworkVersion,
        managedProcess: verification.managedProcess,
        displayHandshake: verification.displayHandshake,
        controls: verification.realControls,
        inputCount: verification.inputCount,
        actual: verification.actual,
        changed: verification.changed
      };
    });
  } else {
    skip('avalonia-runtime', 'Real Avalonia controls, live C# state, and NodeNET input', 'The pinned Avalonia fixture did not build.');
  }

  if (passed('avalonia-runtime')) {
    await gate('avalonia-screenshots', 'Avalonia initial, expression, and result screenshot validation', async () => {
      const directory = path.join(runDirectory, 'avalonia');
      const images = await Promise.all([
        'calculator-initial.png',
        'calculator-12-plus-7.png',
        'calculator-result-19.png'
      ].map(name => inspectPng(path.join(directory, name))));
      assert.ok(images.every(image => image.width === evidence.avalonia.width && image.height === evidence.avalonia.height));
      assert.equal(new Set(images.map(image => image.sha256)).size, 3, 'All three screenshot PNG files must differ.');
      assert.equal(evidence.avalonia.pass, true);
      evidence.avaloniaImages = images;
      return { images, semanticResult: evidence.avalonia.actual };
    });
  } else {
    skip('avalonia-screenshots', 'Avalonia initial, expression, and result screenshot validation', 'The live Avalonia runtime gate did not pass.');
  }

  if (visible) {
    if (process.platform !== 'darwin') {
      await gate('visible-desktop', 'Visible macOS Avalonia desktop confirmation', async () => {
        throw new BlockedError(`Visible validation requires macOS; current platform is ${process.platform}.`);
      });
    } else if (passed('avalonia-runtime')) {
      await gate('visible-desktop', 'Visible macOS Avalonia desktop confirmation', async () => {
        const built = await buildVisibleFixture({ net: managedNet, fixture: builtFixture.fixture, onCommand: logDotnetCommand });
        process.stdout.write('\nA real Avalonia window is open. Click 1, 2, +, 7, =; confirm 19; then close the window.\n');
        const verification = await runVisibleAcceptance({
          dotnet: managedContext.dotnet,
          project: built.project,
          outputDirectory: path.join(runDirectory, 'visible'),
          onProcess: async record => fs.appendFile(logFile, `\nVisible process ${record.phase}: ${JSON.stringify(record)}\n`)
        });
        evidence.visible = verification;
        return verification;
      });
    } else {
      skip('visible-desktop', 'Visible macOS Avalonia desktop confirmation', 'Headless Avalonia acceptance did not pass.');
    }
  } else {
    skip('visible-desktop', 'Visible macOS Avalonia desktop confirmation', 'Run npm run validate:local:visible to request this manual gate.', { required: false });
  }

  await gate('cleanup', 'Cleanup and final clean-worktree verification', async () => {
    if (managedNet) {
      await shutdownBuildServers(managedNet);
      await managedNet.dispose();
      managedNet = null;
    }
    await fs.rm(temporary, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
    await assert.rejects(fs.access(temporary));
    const status = await command('git', ['status', '--porcelain=v1', '--untracked-files=all'], { stream: false });
    assert.equal(status.ok, true, status.stderr);
    environment.worktreeAfter = status.stdout;
    assert.equal(status.stdout, '', 'Validation changed the tracked working tree.');
    return { temporaryWorkspaceRemoved: true, worktreeClean: true };
  });

  if (managedNet) {
    await shutdownBuildServers(managedNet);
    await managedNet.dispose().catch(() => {});
    managedNet = null;
  }
  await fs.rm(temporary, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 }).catch(() => {});

  environment.finishedAt = new Date().toISOString();
  const verdict = overallVerdict(gates);
  const summary = {
    schemaVersion: 1,
    project: 'NodeNET DisplayService',
    releaseCandidate: '0.3.2',
    runId,
    verdict,
    commit: environment.commit,
    platform: environment.platform,
    architecture: environment.architecture,
    visibleRequested: visible,
    gates,
    evidence,
    reportArchive: 'nodenet-local-validation.zip'
  };
  await fs.writeFile(path.join(runDirectory, 'environment.json'), `${JSON.stringify(environment, null, 2)}\n`);
  await fs.writeFile(path.join(runDirectory, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);

  const rows = gates.map(item => {
    const details = item.details ? JSON.stringify(item.details).slice(0, 240) : (item.error ?? '');
    return `| ${item.label.replace(/\|/g, '\\|')} | ${item.status} | ${item.durationMs} | ${details.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')} |`;
  });
  const failures = gates.filter(item => ['FAIL', 'BLOCKED', 'SKIPPED'].includes(item.status) && item.required !== false);
  const report = [
    `# NodeNET local validation: ${verdict}`,
    '',
    `- Repository: \`${environment.repository}\``,
    `- Commit: \`${environment.commit}\``,
    `- Branch: \`${environment.branch}\``,
    `- Release candidate: \`0.3.2\``,
    `- Host: \`${environment.platform} ${environment.architecture}\``,
    `- Node/npm: \`${environment.node}\` / \`${environment.npm}\``,
    `- Private .NET: \`${environment.dotnet?.sdk ?? 'not available'}\``,
    `- Avalonia: \`${AVALONIA_VERSION}\``,
    `- Worktree before/after: \`${environment.worktreeBefore === '' ? 'clean' : 'dirty'}\` / \`${environment.worktreeAfter === '' ? 'clean' : 'not verified'}\``,
    '',
    '## Gates',
    '',
    '| Gate | Status | Duration (ms) | Evidence / error |',
    '| --- | --- | ---: | --- |',
    ...rows,
    '',
    '## Decisive runtime evidence',
    '',
    `- Software calculator: \`${evidence.software?.verification?.actual ?? 'not run'}\`; changed pixels: \`${evidence.software?.verification?.changed ?? false}\`.`,
    `- Exact C# RGBA frame: \`${evidence.dotnetFrame?.exactInitialSha256 ?? 'not run'}\`.`,
    `- C# pointer state: \`${evidence.dotnetFrame?.pointerState?.display ?? 'not run'}\`; changed pixels: \`${evidence.dotnetFrame?.changed ?? false}\`.`,
    `- Avalonia process/control/input result: \`${evidence.avalonia?.actual ?? 'not run'}\`; input count: \`${evidence.avalonia?.inputCount ?? 'not run'}\`; changed pixels: \`${evidence.avalonia?.changed ?? false}\`.`,
    `- Packed package SHA-256: \`${evidence.package?.sha256 ?? 'not run'}\`.`,
    '',
    '## Remaining required action',
    '',
    failures.length ? failures.map(item => `- ${item.label}: ${item.status} — ${item.error ?? 'No evidence recorded.'}`).join('\n') : '- None. Every required local gate passed.',
    '',
    'Full command output is in `commands.log`. The private SDK, NuGet/npm caches, temporary consumer, and secrets are not included in this report.',
    ''
  ].join('\n');
  await fs.writeFile(path.join(runDirectory, 'REPORT.md'), report);

  const archivePath = path.join(runDirectory, 'nodenet-local-validation.zip');
  const archive = await createZip(runDirectory, archivePath);
  const latest = path.join(validationRoot, 'latest');
  await fs.rm(latest, { recursive: true, force: true });
  await fs.cp(runDirectory, latest, { recursive: true });

  process.stdout.write(`\n${verdict}: NodeNET local validation for ${environment.commit}\n`);
  process.stdout.write(`Report: ${path.join(latest, 'REPORT.md')}\n`);
  process.stdout.write(`Archive: ${path.join(latest, 'nodenet-local-validation.zip')}\n`);
  process.stdout.write(`Archive SHA-256: ${archive.sha256}\n`);
  process.exitCode = verdict === 'PASS' ? 0 : 1;
  return { repositoryGate, verdict };
}

await main();
