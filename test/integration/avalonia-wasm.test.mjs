import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeNET } from '../../src/index.js';
import {
  BROWSER_DOTNET_SDK_VERSION,
  publishBrowserFixture,
  shutdownBuildServers
} from '../../scripts/lib/avalonia-runtime.mjs';

const enabled = process.env.NODENET_AVALONIA === '1';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function findFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? findFiles(entryPath) : [entryPath];
  }));
  return files.flat();
}

test('publishes the pinned Avalonia calculator as a loadable browser WebAssembly site', {
  skip: !enabled,
  timeout: 60 * 60_000
}, async () => {
  const work = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-avalonia-wasm-'));
  const home = process.env.NODENET_TEST_HOME
    ? path.resolve(process.env.NODENET_TEST_HOME)
    : path.join(work, 'home');
  const outputRoot = path.resolve(process.env.NODENET_AVALONIA_WASM_OUTPUT ?? path.join(root, 'artifacts', 'avalonia-wasm'));
  const output = path.join(outputRoot, `publish-${Date.now()}`);
  const net = await NodeNET.attach(work, {
    mode: 'shared',
    home,
    isolation: 'managed',
    sdk: BROWSER_DOTNET_SDK_VERSION,
    writeState: false
  });

  try {
    const context = await net.prepare({ restore: false });
    assert.equal(context.dotnet.source, 'managed');
    assert.equal(context.dotnet.info.sdks.some(item => item.version === BROWSER_DOTNET_SDK_VERSION), true);

    const built = await publishBrowserFixture({
      net,
      repositoryRoot: root,
      workDirectory: work,
      outputDirectory: output
    });

    // .NET browser publish places deployable assets under wwwroot.
    const webRoot = path.join(output, 'wwwroot');
    assert.equal((await fs.stat(webRoot).catch(() => null))?.isDirectory(), true,
      'Published site is missing its wwwroot directory.');
    const files = await findFiles(webRoot);
    const relativeFiles = files.map(file => path.relative(webRoot, file).replaceAll(path.sep, '/'));
    assert.ok(relativeFiles.includes('index.html'), 'Published site is missing index.html.');
    assert.ok(relativeFiles.includes('main.js'), 'Published site is missing the browser bootstrap.');
    assert.ok(relativeFiles.includes('_framework/dotnet.js'), 'Published site is missing the .NET WebAssembly loader.');
    assert.ok(relativeFiles.some(file => file.startsWith('_framework/') && file.endsWith('.wasm')), 'Published site is missing WebAssembly runtime files.');
    // .NET 10 publishes managed WebCIL assemblies as fingerprinted .wasm assets, not .dll files.
    const managedApp = relativeFiles.find(file => /^_framework\/Calculator\.Browser(?:\.[A-Za-z0-9_-]+)?\.wasm$/.test(file));
    const managedShared = relativeFiles.find(file => /^_framework\/Calculator\.Shared(?:\.[A-Za-z0-9_-]+)?\.wasm$/.test(file));
    const nativeRuntime = relativeFiles.find(file => /^_framework\/dotnet\.native(?:\.[A-Za-z0-9_-]+)?\.wasm$/.test(file));
    const skia = relativeFiles.find(file => /^_framework\/SkiaSharp(?:\.[A-Za-z0-9_-]+)?\.wasm$/.test(file));
    assert.ok(managedApp, 'Published site is missing the managed Avalonia browser assembly (WebCIL).');
    assert.ok(managedShared, 'Published site is missing the shared C# application assembly (WebCIL).');
    assert.ok(nativeRuntime, 'Published site is missing the native .NET WebAssembly runtime.');
    assert.ok(skia, 'Published site is missing the SkiaSharp managed assembly (WebCIL).');
    for (const asset of [managedApp, managedShared, nativeRuntime, skia]) {
      const wasm = await fs.readFile(path.join(webRoot, asset));
      assert.equal(wasm.subarray(0, 4).toString('hex'), '0061736d', `Invalid WebAssembly header: ${asset}`);
    }

    const html = await fs.readFile(path.join(webRoot, 'index.html'), 'utf8');
    const bootstrap = await fs.readFile(path.join(webRoot, 'main.js'), 'utf8');
    assert.match(html, /id="out"/);
    assert.match(html, /src="\.\/main\.js"/);
    assert.match(bootstrap, /runMain/);

    await fs.mkdir(outputRoot, { recursive: true });
    await fs.writeFile(path.join(outputRoot, 'latest.json'), `${JSON.stringify({
      framework: 'Avalonia',
      frameworkVersion: '12.1.1',
      sdkVersion: BROWSER_DOTNET_SDK_VERSION,
      outputDirectory: path.relative(root, output).replaceAll(path.sep, '/'),
      webRoot: path.relative(root, webRoot).replaceAll(path.sep, '/'),
      assets: relativeFiles.length,
      wasmAssets: relativeFiles.filter(file => file.endsWith('.wasm')).length,
      managedApp,
      managedShared,
      nativeRuntime,
      skia,
      pass: true
    }, null, 2)}\n`);

    assert.equal(built.publish.ok, true);
  } finally {
    await shutdownBuildServers(net);
    await net.dispose();
    await fs.rm(work, { recursive: true, force: true, maxRetries: 4, retryDelay: 250 });
  }
});
