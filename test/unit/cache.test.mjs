import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { clearCache, inspectCache, pruneCache, resolveCacheBase } from '../../src/cache.js';

test('cache inspection reports category sizes and category clear is scoped', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-cache-'));
  try {
    await fs.mkdir(path.join(base, 'downloads'), { recursive: true });
    await fs.mkdir(path.join(base, 'nuget'), { recursive: true });
    await fs.writeFile(path.join(base, 'downloads', 'sdk.bin'), Buffer.alloc(32));
    await fs.writeFile(path.join(base, 'nuget', 'keep.bin'), Buffer.alloc(16));

    const before = await inspectCache(base);
    assert.equal(before.categories.downloads.bytes, 32);
    assert.equal(before.categories.nuget.bytes, 16);

    const result = await clearCache(base, 'downloads');
    assert.equal(result.removedBytes, 32);

    const after = await inspectCache(base);
    assert.equal(after.categories.downloads.bytes, 0);
    assert.equal(after.categories.nuget.bytes, 16);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});

test('cache prune only removes stale temporary fragments', async () => {
  const base = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-cache-prune-'));
  try {
    const downloads = path.join(base, 'downloads');
    await fs.mkdir(downloads, { recursive: true });
    const stale = path.join(downloads, 'sdk.zip.download-1-1');
    const keep = path.join(downloads, 'sdk.zip');
    await fs.writeFile(stale, 'stale');
    await fs.writeFile(keep, 'keep');
    const old = new Date(Date.now() - 2 * 24 * 60 * 60_000);
    await fs.utimes(stale, old, old);

    const result = await pruneCache(base);
    assert.ok(result.removed.includes(stale));
    await assert.rejects(fs.access(stale));
    await fs.access(keep);
  } finally {
    await fs.rm(base, { recursive: true, force: true });
  }
});

test('cache base is deterministic for shared/local modes', () => {
  assert.equal(resolveCacheBase({ mode: 'shared', home: '/tmp/nodenet-home' }), path.resolve('/tmp/nodenet-home'));
  assert.equal(resolveCacheBase({ mode: 'local', target: '/tmp/app' }), path.join(path.resolve('/tmp/app'), '.nodenet'));
  assert.equal(resolveCacheBase({ mode: 'temporary' }), null);
});
