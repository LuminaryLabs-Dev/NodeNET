import fs from 'node:fs/promises';
import path from 'node:path';
import { dotnetExecutableName } from './verify.js';

async function isFile(candidate) {
  try {
    const stat = await fs.stat(candidate);
    return stat.isFile();
  } catch {
    return false;
  }
}

export async function discoverSystemDotnet({ env = process.env, platform = process.platform } = {}) {
  const executable = dotnetExecutableName(platform);
  const entries = (env.PATH ?? '').split(path.delimiter).filter(Boolean);
  for (const entry of entries) {
    const candidate = path.join(entry, executable);
    if (await isFile(candidate)) return candidate;
  }
  return null;
}

export async function discoverManagedDotnets(rootContainer, platform = process.platform) {
  const executable = dotnetExecutableName(platform);
  const found = [];
  const direct = path.join(rootContainer, executable);
  if (await isFile(direct)) found.push({ path: direct, root: rootContainer });

  let entries = [];
  try {
    entries = await fs.readdir(rootContainer, { withFileTypes: true });
  } catch {
    return found;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const root = path.join(rootContainer, entry.name);
    const candidate = path.join(root, executable);
    if (await isFile(candidate)) found.push({ path: candidate, root });
  }
  return found;
}
