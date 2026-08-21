import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs/promises';

export async function createPathContext({ mode = 'shared', targetDir, rid, home = process.env.NODENET_HOME } = {}) {
  if (!['shared', 'local', 'temporary'].includes(mode)) {
    throw new TypeError(`Unsupported NodeNET mode: ${mode}`);
  }

  const resolvedTargetDir = path.resolve(targetDir ?? process.cwd());
  let baseDir;
  let temporary = false;

  if (mode === 'shared') {
    baseDir = path.resolve(home ?? path.join(os.homedir(), '.nodenet'));
  } else if (mode === 'local') {
    baseDir = path.join(resolvedTargetDir, '.nodenet');
  } else {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-'));
    temporary = true;
  }

  const root = mode === 'shared'
    ? path.join(baseDir, 'roots', rid)
    : path.join(baseDir, 'root');

  const projectStatePath = path.join(resolvedTargetDir, '.nodenet', 'state.json');

  return {
    mode,
    temporary,
    baseDir,
    root,
    downloadsDir: path.join(baseDir, 'downloads'),
    stateDir: path.join(baseDir, 'state'),
    cliHome: path.join(baseDir, 'cli-home'),
    nugetDir: path.join(baseDir, 'nuget'),
    bridgeDir: path.join(baseDir, 'bridge'),
    projectStatePath
  };
}

export async function ensurePathContext(paths) {
  await Promise.all([
    fs.mkdir(paths.downloadsDir, { recursive: true }),
    fs.mkdir(paths.stateDir, { recursive: true }),
    fs.mkdir(paths.cliHome, { recursive: true }),
    fs.mkdir(paths.nugetDir, { recursive: true }),
    fs.mkdir(paths.bridgeDir, { recursive: true })
  ]);
  return paths;
}
