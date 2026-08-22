import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const CACHE_CATEGORIES = Object.freeze({
  roots: 'roots',
  downloads: 'downloads',
  nuget: 'nuget',
  bridge: 'bridge',
  'cli-home': 'cli-home',
  state: 'state'
});

export function resolveCacheBase({ mode = 'shared', target = process.cwd(), home = process.env.NODENET_HOME } = {}) {
  if (mode === 'temporary') return null;
  if (mode === 'local') return path.join(path.resolve(target), '.nodenet');
  return path.resolve(home ?? path.join(os.homedir(), '.nodenet'));
}

async function statSafe(candidate) {
  return fs.lstat(candidate).catch(() => null);
}

async function directorySize(directory) {
  const stat = await statSafe(directory);
  if (!stat) return 0;
  if (stat.isSymbolicLink()) return 0;
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;
  let total = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
    total += await directorySize(path.join(directory, entry.name));
  }
  return total;
}

async function listEntries(directory) {
  const entries = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(directory, entry.name);
    const stat = await statSafe(full);
    entries.push({
      name: entry.name,
      path: full,
      kind: entry.isDirectory() ? 'directory' : 'file',
      bytes: await directorySize(full),
      modifiedAt: stat?.mtime?.toISOString?.() ?? null
    });
  }
  return entries.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name));
}

export async function inspectCache(baseDir) {
  if (!baseDir) return { baseDir: null, exists: false, temporary: true, categories: {}, totalBytes: 0 };
  const categories = {};
  let totalBytes = 0;
  for (const [name, relative] of Object.entries(CACHE_CATEGORIES)) {
    const candidate = path.join(baseDir, relative);
    const stat = await statSafe(candidate);
    const bytes = await directorySize(candidate);
    totalBytes += bytes;
    categories[name] = { path: candidate, exists: Boolean(stat), bytes };
  }
  return { baseDir, exists: Boolean(await statSafe(baseDir)), categories, totalBytes };
}

export async function listCache(baseDir) {
  const summary = await inspectCache(baseDir);
  if (!baseDir) return { ...summary, entries: {} };
  const entries = {};
  for (const [name, item] of Object.entries(summary.categories)) {
    entries[name] = item.exists ? await listEntries(item.path) : [];
  }
  return { ...summary, entries };
}

function categoryPath(baseDir, category) {
  if (!baseDir) throw new TypeError('Temporary mode does not have a persistent cache.');
  if (!category) return baseDir;
  const relative = CACHE_CATEGORIES[category];
  if (!relative) throw new TypeError(`Unknown NodeNET cache category: ${category}`);
  return path.join(baseDir, relative);
}

export async function clearCache(baseDir, category = null) {
  const target = categoryPath(baseDir, category);
  const before = await directorySize(target);
  await fs.rm(target, { recursive: true, force: true });
  return { baseDir, category: category ?? 'all', removedBytes: before, path: target };
}

async function collectPrunable(directory, now, results) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true }).catch(() => [])) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (/\.staging-\d+-\d+$/.test(entry.name)) {
        const stat = await statSafe(full);
        if (stat && now - stat.mtimeMs > 24 * 60 * 60_000) results.push({ path: full, bytes: await directorySize(full) });
      } else {
        await collectPrunable(full, now, results);
      }
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = await statSafe(full);
    if (!stat) continue;
    const staleDownload = /\.download-\d+-\d+$/.test(entry.name) && now - stat.mtimeMs > 24 * 60 * 60_000;
    const staleLock = entry.name.endsWith('.lock') && now - stat.mtimeMs > 15 * 60_000;
    if (staleDownload || staleLock) results.push({ path: full, bytes: stat.size });
  }
}

export async function pruneCache(baseDir) {
  if (!baseDir) return { baseDir: null, removed: [], removedBytes: 0 };
  const candidates = [];
  await collectPrunable(baseDir, Date.now(), candidates);
  for (const item of candidates) await fs.rm(item.path, { recursive: true, force: true });
  return {
    baseDir,
    removed: candidates.map(item => item.path),
    removedBytes: candidates.reduce((sum, item) => sum + item.bytes, 0)
  };
}
