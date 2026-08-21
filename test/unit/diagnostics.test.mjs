import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDiagnostics } from '../../src/project/commands.js';

test('MSBuild diagnostics are normalized', () => {
  const diagnostics = parseDiagnostics('/tmp/Fake.cs(4,2): error CS1002: ; expected [Fake.csproj]');
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].severity, 'error');
  assert.equal(diagnostics[0].code, 'CS1002');
  assert.equal(diagnostics[0].line, 4);
  assert.equal(diagnostics[0].column, 2);
});
