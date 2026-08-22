import test from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli/cli.js';

function capture() {
  let stdout = '';
  let stderr = '';
  return {
    io: {
      stdout: { write(value) { stdout += String(value); } },
      stderr: { write(value) { stderr += String(value); } }
    },
    get stdout() { return stdout; },
    get stderr() { return stderr; }
  };
}

test('--version is handled by NodeNET without attaching .NET', async () => {
  const output = capture();
  const code = await runCli(['--version'], { NodeNET: null, io: output.io });
  assert.equal(code, 0);
  assert.match(output.stdout, /^NodeNET 0\.3\.2/m);
});

test('native command help is handled without attaching .NET', async () => {
  const output = capture();
  const code = await runCli(['build', '--help'], { NodeNET: null, io: output.io });
  assert.equal(code, 0);
  assert.match(output.stdout, /build: Build the attached project or solution/);
});
