import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCli } from '../../src/cli/parse.js';

test('unknown commands transparently preserve dotnet arguments', () => {
  const parsed = parseCli(['new', 'console', '-o', 'Hello']);
  assert.equal(parsed.kind, 'passthrough');
  assert.deepEqual(parsed.dotnetArgs, ['new', 'console', '-o', 'Hello']);
});

test('NodeNET help and version are meta commands', () => {
  assert.deepEqual(parseCli(['--version']), { kind: 'meta', command: 'version' });
  assert.deepEqual(parseCli(['-h']), { kind: 'meta', command: 'help' });
  assert.equal(parseCli(['build', '--help']).help, true);
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

test('unknown native dotnet flags and values are preserved', () => {
  const parsed = parseCli(['build', '--verbosity', 'diagnostic', '-c', 'Release']);
  assert.deepEqual(parsed.operationOptions.passthrough, ['--verbosity', 'diagnostic']);
  assert.equal(parsed.operationOptions.configuration, 'Release');
});

test('command-specific options are not swallowed when NodeNET does not own their meaning', () => {
  const parsed = parseCli(['test', '-r', './results']);
  assert.deepEqual(parsed.operationOptions.passthrough, ['-r', './results']);
});

test('cache subcommands are not interpreted as project targets', () => {
  const parsed = parseCli(['cache', 'clear', 'downloads']);
  assert.deepEqual(parsed.commandArgs, ['clear', 'downloads']);
  assert.notEqual(parsed.target, 'clear');
});

test('run arguments after double dash are passed to the application', () => {
  const parsed = parseCli(['run', '--target', './App', '--', '--port', '8080']);
  assert.deepEqual(parsed.runArgs, ['--port', '8080']);
  assert.equal(parsed.target, './App');
});
