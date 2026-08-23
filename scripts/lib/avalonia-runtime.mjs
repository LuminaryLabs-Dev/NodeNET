import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DisplayValidationHarness, NodeNET } from '../../src/index.js';

export const AVALONIA_VERSION = '12.1.1';
export const DOTNET_SDK_VERSION = '10.0.400';

function processEvidence(result) {
  return `exit=${result.exitCode}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}

export async function shutdownBuildServers(net) {
  try {
    await net.exec(['build-server', 'shutdown'], { rejectOnNonZero: false, timeout: 15_000 });
  } catch {}
}

export async function copyAvaloniaFixture(repositoryRoot, workDirectory) {
  const mirror = path.join(workDirectory, 'fixture-repository');
  const source = path.join(repositoryRoot, 'test', 'fixtures', 'avalonia-runtime');
  const fixture = path.join(mirror, 'test', 'fixtures', 'avalonia-runtime');
  const bridge = path.join(mirror, 'bridge', 'NodeNET.Display');
  await fs.mkdir(path.dirname(fixture), { recursive: true });
  await fs.cp(source, fixture, {
    recursive: true,
    filter: item => !['bin', 'obj'].includes(path.basename(item))
  });
  await fs.mkdir(bridge, { recursive: true });
  await fs.copyFile(
    path.join(repositoryRoot, 'bridge', 'NodeNET.Display', 'NodeNETDisplay.cs'),
    path.join(bridge, 'NodeNETDisplay.cs')
  );
  return { mirror, fixture };
}

async function checkedExec(net, args, options, onCommand) {
  const started = Date.now();
  const result = await net.exec(args, { ...options, rejectOnNonZero: false });
  await onCommand?.({
    command: 'dotnet',
    args,
    cwd: options.cwd,
    durationMs: Date.now() - started,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr
  });
  assert.equal(result.ok, true, processEvidence(result));
  return result;
}

export async function buildHeadlessFixture({ net, repositoryRoot, workDirectory, onCommand }) {
  const copied = await copyAvaloniaFixture(repositoryRoot, workDirectory);
  const packageProject = path.join(copied.fixture, 'AvaloniaRuntime.Packages.csproj');
  const project = path.join(copied.fixture, 'Calculator.Headless', 'Calculator.Headless.csproj');
  const aggregateRestore = await checkedExec(net, ['restore', packageProject, '--nologo', '--locked-mode'], {
    cwd: copied.fixture,
    timeout: 10 * 60_000
  }, onCommand);
  const restore = await checkedExec(net, ['restore', project, '--nologo', '--locked-mode'], {
    cwd: copied.fixture,
    timeout: 10 * 60_000
  }, onCommand);
  const build = await checkedExec(net, ['build', project, '--nologo', '--no-restore'], {
    cwd: copied.fixture,
    timeout: 10 * 60_000
  }, onCommand);
  return { ...copied, project, aggregateRestore, restore, build };
}

function assertControlPoints(ready, width, height) {
  assert.equal(ready.metadata.framework, 'Avalonia');
  assert.equal(ready.metadata.adapter, 'NodeNET.Display');
  assert.equal(ready.metadata.managed, true);
  assert.equal(ready.metadata.controlCount, 5);
  assert.match(ready.metadata.frameworkVersion, /^12\.1\.1(?:\.|$)/);
  for (const token of ['1', '2', '+', '7', '=']) {
    const point = ready.metadata.controls[token];
    assert.ok(point && Number.isFinite(point.x) && Number.isFinite(point.y), `Missing real control coordinates for ${token}.`);
    assert.ok(point.x >= 0 && point.x < width && point.y >= 0 && point.y < height, `Control ${token} is outside the rendered frame.`);
  }
}

export async function runAvaloniaAcceptance({ dotnet, project, outputDirectory, onProcess }) {
  const app = await NodeNET.attach(project, {
    mode: 'temporary',
    dotnetPath: dotnet.path,
    env: dotnet.env,
    writeState: false
  });
  let handle;
  let surface;
  try {
    const prepared = await app.prepare({ restore: false });
    assert.equal(prepared.ready, true);
    handle = await app.run({ binaryStdout: true, passthrough: ['--no-build'] });
    assert.ok(Number.isInteger(handle.pid) && handle.pid > 0, 'A managed application process did not start.');
    assert.equal(path.resolve(handle.command), path.resolve(dotnet.path), 'The Avalonia process did not use the managed .NET executable.');
    await onProcess?.({ phase: 'started', pid: handle.pid, command: handle.command, args: handle.args });

    surface = await app.display({ process: handle });
    const harness = new DisplayValidationHarness(surface, { outputDirectory, timeout: 60_000 });
    const ready = await harness.waitForReady();
    await surface.waitForFrame({ afterSequence: 0, timeout: 60_000 });
    assertControlPoints(ready, surface.width, surface.height);
    await harness.capture('calculator-initial.png');

    let result;
    for (const token of ['1', '2', '+', '7']) {
      const point = ready.metadata.controls[token];
      result = await harness.pointer({ type: 'click', x: point.x, y: point.y, button: 0 });
    }
    assert.equal(result.state.display, '7');
    assert.equal(result.state.expression, '12 +');
    assert.equal(result.state.inputCount, 4);
    await harness.capture('calculator-12-plus-7.png');

    const equals = ready.metadata.controls['='];
    result = await harness.pointer({ type: 'click', x: equals.x, y: equals.y, button: 0 });
    const finalFrame = await harness.capture('calculator-result-19.png');
    assert.equal(result.state.display, '19');
    assert.equal(result.state.expression, '12 + 7 =');
    assert.equal(result.state.inputCount, 5);
    assert.equal(surface.lastState.display, '19');

    const [initialCapture, expressionCapture, resultCapture] = harness.captures;
    assert.notEqual(initialCapture.sha256, expressionCapture.sha256);
    assert.notEqual(initialCapture.sha256, resultCapture.sha256);
    assert.notEqual(expressionCapture.sha256, resultCapture.sha256);

    await surface.dispose();
    const processResult = await handle.wait();
    assert.equal(processResult.ok, true, processResult.stderr);
    const verification = {
      framework: 'Avalonia',
      frameworkVersion: ready.metadata.frameworkVersion,
      adapter: ready.metadata.adapter,
      managedDotnet: true,
      managedProcess: true,
      processId: ready.metadata.processId,
      nodeObservedPid: handle.pid,
      displayHandshake: true,
      realControls: ready.metadata.controlCount,
      inputRoundTrip: true,
      inputCount: result.state.inputCount,
      expected: '19',
      actual: result.state.display,
      expression: result.state.expression,
      width: finalFrame.width,
      height: finalFrame.height,
      format: finalFrame.format,
      changed: initialCapture.sha256 !== resultCapture.sha256,
      hashes: {
        initial: initialCapture.sha256,
        expression: expressionCapture.sha256,
        result: resultCapture.sha256
      },
      processExitCode: processResult.exitCode,
      processStderrSha256: crypto.createHash('sha256').update(processResult.stderr).digest('hex'),
      pass: result.state.display === '19'
        && result.state.inputCount === 5
        && initialCapture.sha256 !== resultCapture.sha256
        && processResult.ok
    };
    const written = await harness.writeVerification(verification);
    assert.equal(written.pass, true);
    await onProcess?.({ phase: 'exited', pid: handle.pid, exitCode: processResult.exitCode, durationMs: processResult.durationMs });
    return written;
  } finally {
    if (surface && surface.disposed === false) await surface.dispose().catch(() => {});
    if (handle?.running) await handle.stop().catch(() => {});
    await app.dispose();
  }
}

export async function buildVisibleFixture({ net, fixture, onCommand }) {
  const project = path.join(fixture, 'Calculator.App', 'Calculator.App.csproj');
  const restore = await checkedExec(net, ['restore', project, '--nologo', '--locked-mode'], {
    cwd: fixture,
    timeout: 10 * 60_000
  }, onCommand);
  const build = await checkedExec(net, ['build', project, '--nologo', '--no-restore'], {
    cwd: fixture,
    timeout: 10 * 60_000
  }, onCommand);
  return { project, restore, build };
}

export async function runVisibleAcceptance({ dotnet, project, outputDirectory, timeout = 15 * 60_000, onProcess }) {
  const reportPath = path.join(outputDirectory, 'verification.json');
  await fs.mkdir(outputDirectory, { recursive: true });
  const app = await NodeNET.attach(project, {
    mode: 'temporary',
    dotnetPath: dotnet.path,
    env: dotnet.env,
    writeState: false
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let handle;
  try {
    await app.prepare({ restore: false });
    handle = await app.run({
      passthrough: ['--no-build'],
      env: { NODENET_VISIBLE_REPORT_PATH: reportPath },
      signal: controller.signal
    });
    assert.ok(Number.isInteger(handle.pid) && handle.pid > 0);
    assert.equal(path.resolve(handle.command), path.resolve(dotnet.path));
    await onProcess?.({ phase: 'started', pid: handle.pid, command: handle.command, args: handle.args });
    const processResult = await handle.wait();
    assert.equal(processResult.ok, true, processEvidence(processResult));
    const verification = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    assert.equal(verification.framework, 'Avalonia');
    assert.equal(verification.mode, 'visible-desktop');
    assert.equal(verification.expected, '19');
    assert.equal(verification.actual, '19', 'The visible calculator must show 19 before the window is closed.');
    assert.equal(verification.pass, true);
    await onProcess?.({ phase: 'exited', pid: handle.pid, exitCode: processResult.exitCode, durationMs: processResult.durationMs });
    return { ...verification, processExitCode: processResult.exitCode };
  } finally {
    clearTimeout(timer);
    if (handle?.running) await handle.stop().catch(() => {});
    await app.dispose();
  }
}
