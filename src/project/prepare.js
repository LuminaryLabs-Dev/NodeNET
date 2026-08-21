import fs from 'node:fs/promises';
import path from 'node:path';
import { detectHost } from '../host/platform.js';
import { createPathContext, ensurePathContext } from '../host/paths.js';
import { inspectTarget, deriveRequirement } from './inspect.js';
import { resolveDotnetHost } from '../dotnet/resolve.js';
import { provisionDotnet } from '../dotnet/provision.js';
import { verifyDotnet } from '../dotnet/verify.js';
import { runDotnet } from '../dotnet/cli.js';
import { DotnetResolutionError, RestoreError } from '../errors.js';
import { parseDiagnostics } from './commands.js';

function parseWorkloadList(output) {
  const ids = new Set();
  for (const line of output.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || /^Installed Workload Id/i.test(trimmed) || /^-+$/.test(trimmed)) continue;
    const first = trimmed.split(/\s+/)[0];
    if (/^[A-Za-z0-9._-]+$/.test(first)) ids.add(first);
  }
  return ids;
}

async function inspectWorkloads(dotnet, required, cwd) {
  if (!required?.length) return { required: [], installed: [], missing: [] };
  const result = await runDotnet(dotnet, ['workload', 'list'], { cwd, timeout: 60_000 });
  if (!result.ok) return { required, installed: [], missing: [...required], checkFailed: true, result };
  const installed = parseWorkloadList(result.stdout);
  return {
    required: [...required],
    installed: [...installed],
    missing: required.filter(id => !installed.has(id))
  };
}

async function inspectNativeAssets(targetInfo) {
  if (targetInfo.kind !== 'project') return { checked: false, assets: [] };
  const assetsPath = path.join(targetInfo.directory, 'obj', 'project.assets.json');
  let data;
  try {
    data = JSON.parse(await fs.readFile(assetsPath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return { checked: false, assets: [], path: assetsPath };
    return { checked: false, assets: [], path: assetsPath, error: error.message };
  }

  const assets = new Set();
  for (const target of Object.values(data.targets ?? {})) {
    for (const library of Object.values(target ?? {})) {
      for (const assetPath of Object.keys(library?.native ?? {})) assets.add(assetPath);
      for (const [assetPath, metadata] of Object.entries(library?.runtimeTargets ?? {})) {
        if (metadata?.assetType === 'native') assets.add(assetPath);
      }
    }
  }
  return { checked: true, path: assetsPath, assets: [...assets].sort() };
}

async function writeState(targetInfo, paths, state) {
  if (!['project', 'solution'].includes(targetInfo.kind)) return null;
  await fs.mkdir(path.dirname(paths.projectStatePath), { recursive: true });
  await fs.writeFile(paths.projectStatePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  return paths.projectStatePath;
}

export async function prepareTarget(target, options = {}) {
  const targetInfo = await inspectTarget(target);
  const host = detectHost(options.host);
  const paths = await ensurePathContext(await createPathContext({
    mode: options.mode ?? 'shared',
    targetDir: targetInfo.directory,
    rid: host.rid,
    home: options.home
  }));

  const requirement = deriveRequirement(targetInfo, {
    sdk: options.sdk,
    runtime: options.runtime,
    defaultSdk: options.defaultSdk ?? '10.0',
    requireSdk: options.requireSdk ?? false
  });

  let dotnet = null;
  let provisioned = false;
  if (requirement.kind !== 'none') {
    dotnet = await resolveDotnetHost({
      requirement,
      paths,
      isolation: options.isolation ?? 'auto',
      dotnetPath: options.dotnetPath,
      dotnetArgsPrefix: options.dotnetArgsPrefix,
      env: options.env ?? process.env
    });

    if (!dotnet) {
      if ((options.isolation ?? 'auto') === 'system') {
        throw new DotnetResolutionError('No compatible system .NET installation satisfies the target requirement.');
      }
      dotnet = await provisionDotnet({
        requirement,
        host,
        paths,
        env: options.env ?? process.env,
        offline: options.offline ?? false,
        artifactPath: options.artifactPath,
        expectedHash: options.expectedHash,
        fetchImpl: options.fetchImpl,
        signal: options.signal,
        onProgress: options.onProgress
      });
      provisioned = !dotnet.reused;
    }

    dotnet.info = dotnet.info ?? await verifyDotnet({
      path: dotnet.path,
      argsPrefix: dotnet.argsPrefix,
      env: dotnet.env
    });
  }

  let restoreResult = null;
  if (targetInfo.needsRestore && options.restore !== false) {
    restoreResult = await runDotnet(dotnet, ['restore', targetInfo.path, '--nologo'], {
      cwd: targetInfo.directory,
      timeout: options.restoreTimeout ?? 5 * 60_000,
      signal: options.signal
    });
    restoreResult.diagnostics = parseDiagnostics(`${restoreResult.stdout}\n${restoreResult.stderr}`);
    if (!restoreResult.ok) {
      throw new RestoreError(`dotnet restore failed for ${targetInfo.path}.`, {
        details: { result: restoreResult }
      });
    }
  }

  const workloads = dotnet
    ? await inspectWorkloads(dotnet, targetInfo.workloads, targetInfo.directory)
    : { required: [], installed: [], missing: [] };
  const nativeAssets = await inspectNativeAssets(targetInfo);
  const readinessWarnings = [];
  if (workloads.missing.length) readinessWarnings.push(`Missing .NET workloads: ${workloads.missing.join(', ')}`);
  if (targetInfo.legacyFrameworks?.length) {
    readinessWarnings.push(`Legacy .NET Framework target(s) detected (${targetInfo.legacyFrameworks.join(', ')}); targeting-pack availability is host-specific and is not provisioned as a modern .NET runtime channel.`);
  }

  const state = {
    version: 1,
    target: targetInfo.path,
    kind: targetInfo.kind,
    rid: host.rid,
    requirement,
    managedRoot: dotnet?.source === 'managed' ? dotnet.root : null,
    dotnetSource: dotnet?.source ?? null,
    sdkVersions: dotnet?.info?.sdks?.map(item => item.version) ?? [],
    runtimeVersions: dotnet?.info?.runtimes?.map(item => `${item.name} ${item.version}`) ?? [],
    workloads,
    nativeAssets,
    legacyFrameworks: targetInfo.legacyFrameworks ?? [],
    preparedAt: new Date().toISOString()
  };

  let statePath = null;
  const shouldWriteState = options.writeState === true || (options.writeState !== false && paths.mode !== 'temporary');
  if (shouldWriteState) {
    statePath = await writeState(targetInfo, paths, state);
  }

  return {
    targetInfo,
    host,
    paths,
    requirement,
    dotnet,
    provisioned,
    restoreResult,
    workloads,
    nativeAssets,
    state,
    statePath,
    ready: workloads.missing.length === 0,
    readinessWarnings
  };
}
