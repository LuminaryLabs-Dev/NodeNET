import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { extractArchive } from './archive.js';
import { createDotnetEnvironment } from './environment.js';
import { verifyDotnet, dotnetExecutableName } from './verify.js';
import { satisfiesRequirement } from './resolve.js';
import {
  DotnetIntegrityError,
  DotnetProvisionError,
  DotnetResolutionError
} from '../errors.js';

const METADATA_BASE = 'https://dotnetcli.blob.core.windows.net/dotnet/release-metadata';
const LOCK_STALE_MS = 15 * 60_000;
const LOCK_WAIT_MS = 10 * 60_000;

function reportProgress(onProgress, event) {
  if (typeof onProgress !== 'function') return;
  try { onProgress(event); } catch {}
}

function channelFromVersion(version = '10.0') {
  const parts = String(version).split('.');
  if (parts.length < 2) throw new DotnetResolutionError(`Invalid .NET version: ${version}`);
  return `${parts[0]}.${parts[1]}`;
}

function uniqueSdks(releases) {
  const result = [];
  const seen = new Set();
  for (const release of releases ?? []) {
    for (const sdk of [release.sdk, ...(release.sdks ?? [])].filter(Boolean)) {
      if (seen.has(sdk.version)) continue;
      seen.add(sdk.version);
      result.push(sdk);
    }
  }
  return result;
}

function selectPortableArchive(files, rid, prefix) {
  const expectedBase = `${prefix}${rid}`;
  return (files ?? []).find(file => {
    const name = String(file.name ?? '');
    return file.rid === rid
      && (name === `${expectedBase}.zip` || name === `${expectedBase}.tar.gz`);
  }) ?? null;
}

function runtimeComponent(frameworkName = 'Microsoft.NETCore.App') {
  if (frameworkName === 'Microsoft.NETCore.App') {
    return { key: 'runtime', prefix: 'dotnet-runtime-', id: 'core' };
  }
  if (frameworkName === 'Microsoft.AspNetCore.App') {
    return { key: 'aspnetcore-runtime', prefix: 'aspnetcore-runtime-', id: 'aspnetcore' };
  }
  if (frameworkName === 'Microsoft.WindowsDesktop.App') {
    return { key: 'windowsdesktop', prefix: 'windowsdesktop-runtime-', id: 'windowsdesktop' };
  }
  throw new DotnetResolutionError(`NodeNET cannot provision the custom shared framework ${frameworkName}.`);
}

export async function fetchReleaseMetadata(channel, { fetchImpl = globalThis.fetch, signal } = {}) {
  if (typeof fetchImpl !== 'function') throw new DotnetProvisionError('Global fetch is unavailable. Node 20+ is required.');
  const url = `${METADATA_BASE}/${channel}/releases.json`;
  let response;
  try {
    response = await fetchImpl(url, { signal });
  } catch (cause) {
    throw new DotnetProvisionError(`Failed to fetch .NET release metadata for ${channel}.`, { cause, details: { url } });
  }
  if (!response.ok) {
    throw new DotnetProvisionError(`.NET release metadata request failed with HTTP ${response.status}.`, { details: { url } });
  }
  return response.json();
}

export async function resolveOfficialArtifact(requirement, rid, options = {}) {
  const version = requirement?.version ?? '10.0';
  const channel = channelFromVersion(version);
  const metadata = options.metadata ?? await fetchReleaseMetadata(channel, options);
  const exact = requirement?.exact === true || (requirement?.kind === 'sdk' && String(version).split('.').length >= 3);

  if (requirement.kind === 'sdk') {
    const sdks = uniqueSdks(metadata.releases);
    const desiredVersion = exact ? version : metadata['latest-sdk'];
    const sdk = sdks.find(item => item.version === desiredVersion);
    if (!sdk) throw new DotnetResolutionError(`Unable to resolve .NET SDK ${version} from channel ${channel}.`);
    const file = selectPortableArchive(sdk.files, rid, 'dotnet-sdk-');
    if (!file) throw new DotnetResolutionError(`.NET SDK ${sdk.version} has no artifact for ${rid}.`);
    return { kind: 'sdk', channel, version: sdk.version, rid, ...file };
  }

  if (requirement.kind === 'runtime') {
    const component = runtimeComponent(requirement.frameworkName);
    const desiredVersion = exact ? version : metadata['latest-runtime'];
    const release = (metadata.releases ?? []).find(item => item[component.key]?.version === desiredVersion);
    const runtime = release?.[component.key];
    if (!runtime) {
      throw new DotnetResolutionError(`Unable to resolve ${requirement.frameworkName ?? 'Microsoft.NETCore.App'} runtime ${version} from channel ${channel}.`);
    }
    const file = selectPortableArchive(runtime.files, rid, component.prefix);
    if (!file) {
      throw new DotnetResolutionError(`${requirement.frameworkName ?? 'Microsoft.NETCore.App'} runtime ${runtime.version} has no portable archive for ${rid}.`);
    }
    return {
      kind: 'runtime',
      component: component.id,
      frameworkName: requirement.frameworkName ?? 'Microsoft.NETCore.App',
      channel,
      version: runtime.version,
      rid,
      ...file
    };
  }

  throw new DotnetResolutionError(`Unsupported .NET provision kind: ${requirement?.kind}`);
}

function assertProvisionedRequirement(info, requirement) {
  if (!satisfiesRequirement(info, requirement)) {
    throw new DotnetProvisionError('Provisioned .NET environment does not satisfy the requested SDK/runtime requirement.', {
      details: { requirement, sdks: info.sdks, runtimes: info.runtimes }
    });
  }
  return info;
}

export async function hashFile(filePath, algorithm = 'sha512') {
  const hash = crypto.createHash(algorithm);
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest('hex');
}

async function verifyArchiveHash(filePath, expectedHash, { onProgress, artifact } = {}) {
  if (!expectedHash) throw new DotnetIntegrityError('Official .NET artifact metadata did not include a SHA-512 hash.');
  reportProgress(onProgress, { phase: 'verify', artifact });
  const actual = await hashFile(filePath, 'sha512');
  if (actual.toLowerCase() !== String(expectedHash).toLowerCase()) {
    throw new DotnetIntegrityError(`Checksum mismatch for ${path.basename(filePath)}.`, {
      details: { expected: expectedHash, actual }
    });
  }
  return actual;
}

async function downloadArtifact(artifact, destination, { fetchImpl = globalThis.fetch, signal, onProgress } = {}) {
  const existing = await fsp.stat(destination).catch(() => null);
  if (existing?.isFile()) {
    try {
      await verifyArchiveHash(destination, artifact.hash, { onProgress, artifact });
      return { path: destination, reused: true };
    } catch {
      await fsp.rm(destination, { force: true });
    }
  }

  if (typeof fetchImpl !== 'function') throw new DotnetProvisionError('Global fetch is unavailable. Node 20+ is required.');
  const temp = `${destination}.download-${process.pid}-${Date.now()}`;
  await fsp.mkdir(path.dirname(destination), { recursive: true });

  try {
    const response = await fetchImpl(artifact.url, { signal });
    if (!response.ok || !response.body) {
      throw new DotnetProvisionError(`.NET artifact download failed with HTTP ${response.status}.`, {
        details: { url: artifact.url }
      });
    }
    const total = Number(response.headers.get('content-length')) || null;
    let received = 0;
    const body = Readable.fromWeb(response.body);
    body.on('data', chunk => {
      received += chunk.length;
      reportProgress(onProgress, { phase: 'download', received, total, artifact });
    });
    await pipeline(body, fs.createWriteStream(temp, { flags: 'wx' }));
    await verifyArchiveHash(temp, artifact.hash, { onProgress, artifact });
    await fsp.rename(temp, destination);
    return { path: destination, reused: false };
  } catch (cause) {
    await fsp.rm(temp, { force: true }).catch(() => {});
    if (cause instanceof DotnetProvisionError || cause instanceof DotnetIntegrityError) throw cause;
    throw new DotnetProvisionError(`Failed to download ${artifact.url}.`, { cause });
  }
}

async function acquireLock(lockPath) {
  const started = Date.now();
  await fsp.mkdir(path.dirname(lockPath), { recursive: true });
  while (Date.now() - started < LOCK_WAIT_MS) {
    try {
      const handle = await fsp.open(lockPath, 'wx');
      await handle.writeFile(JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }));
      return handle;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      const stat = await fsp.stat(lockPath).catch(() => null);
      if (stat && Date.now() - stat.mtimeMs > LOCK_STALE_MS) {
        await fsp.rm(lockPath, { force: true }).catch(() => {});
        continue;
      }
      await delay(250);
    }
  }
  throw new DotnetProvisionError(`Timed out waiting for NodeNET installation lock: ${lockPath}`);
}

async function withLock(lockPath, fn) {
  const handle = await acquireLock(lockPath);
  try {
    return await fn();
  } finally {
    await handle.close().catch(() => {});
    await fsp.rm(lockPath, { force: true }).catch(() => {});
  }
}

function installationName(artifact) {
  const component = artifact.kind === 'runtime' && artifact.component ? `-${artifact.component}` : '';
  return `${artifact.kind}${component}-${artifact.version}`.replace(/[^A-Za-z0-9._-]/g, '_');
}

export async function provisionDotnet({ requirement, host, paths, env = process.env, offline = false, artifactPath, expectedHash, fetchImpl, signal, onProgress } = {}) {
  if (!requirement || !['sdk', 'runtime'].includes(requirement.kind)) {
    throw new DotnetProvisionError('Provisioning requires an SDK or runtime requirement.');
  }

  let artifact;
  if (artifactPath) {
    if (!expectedHash) throw new DotnetIntegrityError('artifactPath requires expectedHash so local provisioning cannot bypass integrity verification.');
    const resolved = path.resolve(artifactPath);
    const extension = resolved.toLowerCase().endsWith('.zip') ? '.zip' : '.tar.gz';
    artifact = {
      kind: requirement.kind,
      component: requirement.kind === 'runtime' ? runtimeComponent(requirement.frameworkName).id : undefined,
      frameworkName: requirement.kind === 'runtime' ? (requirement.frameworkName ?? 'Microsoft.NETCore.App') : undefined,
      version: requirement.version,
      rid: host.rid,
      name: path.basename(resolved),
      url: null,
      hash: expectedHash ?? null,
      localPath: resolved,
      extension
    };
    reportProgress(onProgress, { phase: 'artifact', artifact, requirement });
    await verifyArchiveHash(resolved, expectedHash, { onProgress, artifact });
  } else {
    if (offline) throw new DotnetProvisionError('Offline provisioning requires artifactPath when no compatible managed .NET environment exists.');
    artifact = await resolveOfficialArtifact(requirement, host.rid, { fetchImpl, signal });
    reportProgress(onProgress, { phase: 'artifact', artifact, requirement });
  }

  const installRoot = path.join(paths.root, installationName(artifact));
  const executable = path.join(installRoot, dotnetExecutableName(host.platform));
  const existing = await fsp.stat(executable).catch(() => null);
  if (existing?.isFile()) {
    reportProgress(onProgress, { phase: 'reuse', source: 'managed', version: artifact.version, artifact });
    const managedEnv = createDotnetEnvironment({ root: installRoot, paths, baseEnv: env });
    const info = assertProvisionedRequirement(await verifyDotnet({ path: executable, env: managedEnv }), requirement);
    return { path: executable, root: installRoot, source: 'managed', env: managedEnv, info, artifact, reused: true };
  }

  const lockPath = path.join(paths.stateDir, `install-${host.rid}-${installationName(artifact)}.lock`);
  return withLock(lockPath, async () => {
    const afterLock = await fsp.stat(executable).catch(() => null);
    if (afterLock?.isFile()) {
      reportProgress(onProgress, { phase: 'reuse', source: 'managed', version: artifact.version, artifact });
      const managedEnv = createDotnetEnvironment({ root: installRoot, paths, baseEnv: env });
      const info = assertProvisionedRequirement(await verifyDotnet({ path: executable, env: managedEnv }), requirement);
      return { path: executable, root: installRoot, source: 'managed', env: managedEnv, info, artifact, reused: true };
    }

    await fsp.mkdir(paths.root, { recursive: true });
    const archivePath = artifact.localPath ?? path.join(paths.downloadsDir, artifact.name ?? path.basename(new URL(artifact.url).pathname));
    if (!artifact.localPath) await downloadArtifact(artifact, archivePath, { fetchImpl, signal, onProgress });

    const staging = `${installRoot}.staging-${process.pid}-${Date.now()}`;
    await fsp.rm(staging, { force: true, recursive: true });
    await fsp.mkdir(staging, { recursive: true });

    try {
      reportProgress(onProgress, { phase: 'extract', artifact });
      await extractArchive(archivePath, staging);
      const stagingExecutable = path.join(staging, dotnetExecutableName(host.platform));
      if (host.platform !== 'win32') await fsp.chmod(stagingExecutable, 0o755).catch(() => {});
      const stagingEnv = createDotnetEnvironment({ root: staging, paths, baseEnv: env });
      reportProgress(onProgress, { phase: 'verify', artifact });
      assertProvisionedRequirement(await verifyDotnet({ path: stagingExecutable, env: stagingEnv }), requirement);
      await fsp.rename(staging, installRoot);
    } catch (cause) {
      await fsp.rm(staging, { force: true, recursive: true }).catch(() => {});
      if (cause instanceof DotnetProvisionError || cause instanceof DotnetIntegrityError) throw cause;
      throw new DotnetProvisionError(`Failed to provision .NET ${artifact.version} for ${host.rid}.`, { cause });
    }

    const managedEnv = createDotnetEnvironment({ root: installRoot, paths, baseEnv: env });
    const info = assertProvisionedRequirement(await verifyDotnet({ path: executable, env: managedEnv }), requirement);
    return { path: executable, root: installRoot, source: 'managed', env: managedEnv, info, artifact, reused: false };
  });
}
