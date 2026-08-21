import path from 'node:path';
import { discoverManagedDotnets, discoverSystemDotnet } from './discover.js';
import { createDotnetEnvironment } from './environment.js';
import { verifyDotnet } from './verify.js';
import { DotnetResolutionError } from '../errors.js';

function versionParts(version) {
  return String(version ?? '').split('.').map(part => Number.parseInt(part, 10)).filter(Number.isFinite);
}

export function compareVersions(a, b) {
  const aa = versionParts(a);
  const bb = versionParts(b);
  const length = Math.max(aa.length, bb.length);
  for (let i = 0; i < length; i += 1) {
    const delta = (aa[i] ?? 0) - (bb[i] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function sameFeatureBand(candidate, requested) {
  const c = versionParts(candidate);
  const r = versionParts(requested);
  if (r.length < 2) return c[0] === r[0];
  return c[0] === r[0] && c[1] === r[1];
}

export function satisfiesRequirement(info, requirement) {
  if (!requirement || requirement.kind === 'none') return true;
  const requested = requirement.version;
  const exact = requirement.exact === true || versionParts(requested).length >= 3 && requirement.kind === 'sdk';

  if (requirement.kind === 'sdk') {
    const versions = info.sdks.map(item => item.version);
    if (exact) return versions.includes(requested);
    return versions.some(version => sameFeatureBand(version, requested));
  }

  const versions = info.runtimes
    .filter(item => item.name === (requirement.frameworkName ?? 'Microsoft.NETCore.App'))
    .map(item => item.version);
  if (requirement.exact === true) return versions.includes(requested);
  if (versionParts(requested).length >= 3) {
    return versions.some(version => sameFeatureBand(version, requested) && compareVersions(version, requested) >= 0);
  }
  return versions.some(version => sameFeatureBand(version, requested));
}

async function inspectCandidate({ dotnetPath, argsPrefix = [], source, root, requirement, paths, env }) {
  const candidateRoot = root ?? path.dirname(dotnetPath);
  const candidateEnv = source === 'managed'
    ? createDotnetEnvironment({ root: candidateRoot, paths, baseEnv: env })
    : env;
  try {
    const info = await verifyDotnet({ path: dotnetPath, argsPrefix, env: candidateEnv });
    if (!satisfiesRequirement(info, requirement)) return null;
    return {
      path: dotnetPath,
      argsPrefix,
      source,
      root: candidateRoot,
      env: candidateEnv,
      info
    };
  } catch {
    return null;
  }
}

export async function resolveDotnetHost({ requirement, paths, isolation = 'auto', dotnetPath, dotnetArgsPrefix = [], env = process.env } = {}) {
  if (!['auto', 'managed', 'system'].includes(isolation)) {
    throw new DotnetResolutionError(`Unsupported isolation mode: ${isolation}`);
  }

  if (dotnetPath) {
    const explicit = await inspectCandidate({
      dotnetPath: path.resolve(dotnetPath),
      argsPrefix: dotnetArgsPrefix,
      source: 'explicit',
      root: path.dirname(path.resolve(dotnetPath)),
      requirement,
      paths,
      env
    });
    if (!explicit) throw new DotnetResolutionError('The explicit dotnet host does not satisfy the target requirement.');
    return explicit;
  }

  if (isolation !== 'system') {
    const managedCandidates = await discoverManagedDotnets(paths.root);
    for (const candidate of managedCandidates) {
      const managed = await inspectCandidate({ dotnetPath: candidate.path, source: 'managed', root: candidate.root, requirement, paths, env });
      if (managed) return managed;
    }
  }

  if (isolation !== 'managed') {
    const systemPath = await discoverSystemDotnet({ env });
    if (systemPath) {
      const system = await inspectCandidate({ dotnetPath: systemPath, source: 'system', requirement, paths, env });
      if (system) return system;
    }
  }

  return null;
}
