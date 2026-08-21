import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { inspectTarget, deriveRequirement } from '../../src/project/inspect.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, '..', 'fixtures');

test('inspectTarget reads project bootstrap metadata', async () => {
  const info = await inspectTarget(path.join(fixtures, 'console', 'Console.csproj'));
  assert.equal(info.kind, 'project');
  assert.deepEqual(info.targetFrameworks, ['net10.0']);
  assert.equal(info.outputType, 'Exe');
  assert.equal(info.runnable, true);
  const requirement = deriveRequirement(info);
  assert.equal(requirement.kind, 'sdk');
  assert.equal(requirement.version, '10.0');
});

test('global.json pins the SDK exactly', async () => {
  const info = await inspectTarget(path.join(fixtures, 'global-json', 'GlobalJson.csproj'));
  const requirement = deriveRequirement(info);
  assert.equal(requirement.version, '10.0.100');
  assert.equal(requirement.exact, true);
  assert.equal(requirement.source, 'global.json');
});

test('empty directory is a valid NodeNET workspace', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-workspace-'));
  try {
    const info = await inspectTarget(dir);
    assert.equal(info.kind, 'workspace');
    assert.equal(deriveRequirement(info).kind, 'sdk');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('runtimeconfig frameworks chooses the highest-level official shared framework', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-runtimeconfig-'));
  try {
    const dll = path.join(dir, 'Web.dll');
    await fs.writeFile(dll, 'fixture');
    await fs.writeFile(path.join(dir, 'Web.runtimeconfig.json'), JSON.stringify({
      runtimeOptions: {
        frameworks: [
          { name: 'Microsoft.NETCore.App', version: '10.0.0' },
          { name: 'Microsoft.AspNetCore.App', version: '10.0.0' }
        ]
      }
    }));
    const info = await inspectTarget(dll);
    assert.equal(info.runtimeFramework.name, 'Microsoft.AspNetCore.App');
    assert.equal(info.runtimeFrameworks.length, 2);
    const requirement = deriveRequirement(info);
    assert.equal(requirement.kind, 'runtime');
    assert.equal(requirement.frameworkName, 'Microsoft.AspNetCore.App');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('legacy .NET Framework TFMs are not treated as modern .NET runtime channels', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nodenet-legacy-'));
  try {
    const project = path.join(dir, 'Legacy.csproj');
    await fs.writeFile(project, '<Project Sdk="Microsoft.NET.Sdk"><PropertyGroup><TargetFramework>net48</TargetFramework></PropertyGroup></Project>');
    const info = await inspectTarget(project);
    assert.deepEqual(info.legacyFrameworks, ['net48']);
    const requirement = deriveRequirement(info, { defaultSdk: '10.0' });
    assert.equal(requirement.version, '10.0');
    assert.equal(requirement.source, 'default');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
