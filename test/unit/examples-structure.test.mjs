import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const actions = new Set(['pointer', 'key', 'capture']);

async function collect(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

test('example gallery has complete runnable source and valid live-input scenarios', async () => {
  const required = [
    'examples/README.md',
    'examples/_shared/app-runtime.js',
    'examples/_shared/geometry.js',
    'examples/_shared/input-scenario.js',
    'examples/_shared/software-text.js',
    'examples/_shared/validation.js',
    'scripts/validate-examples.mjs'
  ];
  const applications = ['framebuffer-paint', 'keyboard-notepad', 'image-filter-lab', 'self-contained-app'];
  for (const application of applications) {
    required.push(`examples/${application}/README.md`, `examples/${application}/app.js`, `examples/${application}/run.mjs`, `examples/${application}/scenario.json`);
  }
  for (const relative of required) assert.ok((await fs.stat(path.join(root, relative))).isFile(), `Missing ${relative}`);

  for (const application of applications) {
    const scenario = JSON.parse(await fs.readFile(path.join(root, 'examples', application, 'scenario.json'), 'utf8'));
    assert.ok(Array.isArray(scenario.steps) && scenario.steps.length > 0);
    assert.ok(scenario.steps.every(step => actions.has(step.action)));
    assert.ok(scenario.steps.some(step => step.action === 'capture'));
    assert.ok(scenario.steps.some(step => step.action === 'pointer' || step.action === 'key'));
  }

  const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
  for (const script of ['example:paint', 'example:notepad', 'example:filters', 'example:studio', 'validate:examples']) {
    assert.equal(typeof packageJson.scripts[script], 'string');
  }
  assert.equal(packageJson.files.some(entry => entry === 'examples' || entry.startsWith('examples/')), false);

  const files = await collect(path.join(root, 'examples'));
  assert.equal(files.some(file => /\.(?:png|log)$/.test(file) || /(?:^|\/)(?:bin|obj)(?:\/|$)/.test(file)), false);
  for (const file of files.filter(item => /\.(?:js|mjs)$/.test(item))) {
    const source = await fs.readFile(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('.') || match[1].startsWith('node:'), `Unsupported example dependency ${match[1]} in ${path.relative(root, file)}`);
    }
  }
});
