import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCli } from '../../src/cli/parse.js';

test('unknown commands transparently preserve dotnet arguments', () => {
  const parsed = parseCli(['new', 'console', '-o', 'Hello']);
  assert.equal(parsed.kind, 'passthrough');
  assert.deepEqual(parsed.dotnetArgs, ['new', 'console', '-o', 'Hello']);
});

test('native build parsing keeps target and structured options separate', () => {
  const parsed = parseCli(['build', '--target', './Server', '--json', '-c', 'Release', '--no-restore']);
  assert.equal(parsed.kind, 'native');
  assert.equal(parsed.command, 'build');
  assert.equal(parsed.target, './Server');
  assert.equal(parsed.json, true);
  assert.equal(parsed.operationOptions.configuration, 'Release');
  assert.equal(parsed.operationOptions.noRestore, true);
});

test('run arguments after double dash are passed to the application', () => {
  const parsed = parseCli(['run', '--target', './App', '--', '--port', '8080']);
  assert.deepEqual(parsed.runArgs, ['--port', '8080']);
  assert.equal(parsed.target, './App');
});
