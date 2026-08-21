import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import zlib from 'node:zlib';
import { detectHost } from '../../src/host/platform.js';
import { createPathContext, ensurePathContext } from '../../src/host/paths.js';
import { provisionDotnet, hashFile } from '../../src/dotnet/provision.js';
import { DotnetIntegrityError } from '../../src/errors.js';

function writeString(buf, offset, length, value) {
  Buffer.from(value).copy(buf, offset, 0, Math.min(length, Buffer.byteLength(value)));
}

function tarEntry(name, content, mode = 0o644) {
  const data = Buffer.from(content);
  const header = Buffer.alloc(512);
  writeString(header, 0, 100, name);
  writeString(header, 100, 8, `${mode.toString(8).padStart(7, '0')}\0`);
  writeString(header, 108, 8, '0000000\0');
  writeString(header, 116, 8, '0000000\0');
  writeString(header, 124, 12, `${data.length.toString(8).padStart(11, '0')}\0`);
  writeString(header, 136, 12, '00000000000\0');
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  writeString(header, 257, 6, 'ustar\0');
  writeString(header, 263, 2, '00');
  let checksum = 0;
  for (const byte of header) checksum += byte;
  writeString(header, 148, 8, `${checksum.toString(8).padStart(6, '0')}\0 `);
  const padding = Buffer.alloc((512 - (data.length % 512)) % 512);
  return Buffer.concat([header, data, padding]);
}

function fakeDotnetArchive() {
  const script = `#!/usr/bin/env node\nconst a=process.argv.slice(2);\nif(a[0]==='--info'){console.log('.NET SDK fake');process.exit(0)}\nif(a[0]==='--list-sdks'){console.log('10.0.100 [/managed/sdk]');process.exit(0)}\nif(a[0]==='--list-runtimes'){console.log('Microsoft.NETCore.App 10.0.0 [/managed/shared]');process.exit(0)}\nprocess.exit(0)\n`;
  const tar = Buffer.concat([tarEntry('dotnet', script, 0o755), Buffer.alloc(1024)]);
  return zlib.gzipSync(tar);
}

test('local artifact provisioning validates hash, extracts, verifies and activates a private root', { skip: process.platform === 'win32' }, async () => {
  const host = detectHost();
  const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-provision-target-'));
  const paths = await ensurePathContext(await createPathContext({ mode: 'temporary', targetDir, rid: host.rid }));
  const archive = path.join(paths.baseDir, 'fake-sdk.tar.gz');
  await fs.writeFile(archive, fakeDotnetArchive());
  const expectedHash = await hashFile(archive);

  try {
    const result = await provisionDotnet({
      requirement: { kind: 'sdk', version: '10.0.100', exact: true },
      host,
      paths,
      artifactPath: archive,
      expectedHash,
      offline: true
    });
    assert.equal(result.source, 'managed');
    assert.equal(result.info.sdks[0].version, '10.0.100');
    assert.match(result.root, /sdk-10\.0\.100$/);
    assert.equal((await fs.stat(result.path)).isFile(), true);
  } finally {
    await fs.rm(paths.baseDir, { recursive: true, force: true });
    await fs.rm(targetDir, { recursive: true, force: true });
  }
});

test('local artifact provisioning rejects a bad SHA-512 before extraction', { skip: process.platform === 'win32' }, async () => {
  const host = detectHost();
  const targetDir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-provision-badhash-'));
  const paths = await ensurePathContext(await createPathContext({ mode: 'temporary', targetDir, rid: host.rid }));
  const archive = path.join(paths.baseDir, 'fake-sdk.tar.gz');
  await fs.writeFile(archive, fakeDotnetArchive());
  try {
    await assert.rejects(
      provisionDotnet({
        requirement: { kind: 'sdk', version: '10.0.100', exact: true },
        host,
        paths,
        artifactPath: archive,
        expectedHash: '00'.repeat(64),
        offline: true
      }),
      error => error instanceof DotnetIntegrityError
    );
  } finally {
    await fs.rm(paths.baseDir, { recursive: true, force: true });
    await fs.rm(targetDir, { recursive: true, force: true });
  }
});
