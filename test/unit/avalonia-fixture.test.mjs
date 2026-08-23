import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AVALONIA_VERSION, DOTNET_SDK_VERSION } from '../../scripts/lib/avalonia-runtime.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = path.join(root, 'test', 'fixtures', 'avalonia-runtime');

test('permanent Avalonia fixture pins SDK, packages, and lock graphs', async () => {
  const globalJson = JSON.parse(await fs.readFile(path.join(fixture, 'global.json'), 'utf8'));
  assert.equal(globalJson.sdk.version, DOTNET_SDK_VERSION);
  assert.equal(globalJson.sdk.rollForward, 'disable');
  const projects = [
    'AvaloniaRuntime.Packages.csproj',
    'Calculator.Shared/Calculator.Shared.csproj',
    'Calculator.Headless/Calculator.Headless.csproj',
    'Calculator.App/Calculator.App.csproj'
  ];
  for (const project of projects) {
    const source = await fs.readFile(path.join(fixture, project), 'utf8');
    for (const match of source.matchAll(/<PackageReference Include="(Avalonia[^"]*)" Version="([^"]+)"/g)) {
      assert.equal(match[2], AVALONIA_VERSION, `${match[1]} is not pinned in ${project}.`);
    }
  }
  const lockPackages = new Map([
    ['packages.lock.json', ['Avalonia', 'Avalonia.Desktop', 'Avalonia.Fonts.Inter', 'Avalonia.Headless', 'Avalonia.Skia', 'Avalonia.Themes.Fluent']],
    ['Calculator.Shared/packages.lock.json', ['Avalonia']],
    ['Calculator.Headless/packages.lock.json', ['Avalonia', 'Avalonia.Fonts.Inter', 'Avalonia.Headless', 'Avalonia.Skia', 'Avalonia.Themes.Fluent']],
    ['Calculator.App/packages.lock.json', ['Avalonia', 'Avalonia.Desktop', 'Avalonia.Fonts.Inter', 'Avalonia.Themes.Fluent']]
  ]);
  for (const [lock, expectedPackages] of lockPackages) {
    const document = JSON.parse(await fs.readFile(path.join(fixture, lock), 'utf8'));
    assert.equal(document.version, 1);
    const directEntries = Object.entries(document.dependencies['net10.0']).filter(([, item]) => item.type === 'Direct');
    const direct = directEntries.map(([, item]) => item);
    assert.ok(direct.length > 0);
    assert.ok(direct.every(item => item.resolved === AVALONIA_VERSION));
    assert.deepEqual(directEntries.map(([name]) => name).sort(), expectedPackages.sort());
  }
});

test('shared calculator owns live controls/state and headless compiles the canonical display helper', async () => {
  const window = await fs.readFile(path.join(fixture, 'Calculator.Shared', 'CalculatorWindow.axaml'), 'utf8');
  const state = await fs.readFile(path.join(fixture, 'Calculator.Shared', 'CalculatorState.cs'), 'utf8');
  const headless = await fs.readFile(path.join(fixture, 'Calculator.Headless', 'Calculator.Headless.csproj'), 'utf8');
  const integration = await fs.readFile(path.join(root, 'test', 'integration', 'avalonia.test.mjs'), 'utf8');
  for (const control of ['B1', 'B2', 'BPlus', 'B7', 'BEquals']) assert.match(window, new RegExp(`x:Name="${control}"`));
  assert.match(state, /public void Press\(string token\)/);
  assert.match(headless, /bridge\/NodeNET\.Display\/NodeNETDisplay\.cs/);
  assert.doesNotMatch(integration, /dotnet.*new|Avalonia\.Templates/);
});
