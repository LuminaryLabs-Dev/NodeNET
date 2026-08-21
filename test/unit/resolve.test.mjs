import test from 'node:test';
import assert from 'node:assert/strict';
import { compareVersions, satisfiesRequirement } from '../../src/dotnet/resolve.js';
import { resolveOfficialArtifact } from '../../src/dotnet/provision.js';

const info = {
  sdks: [{ version: '8.0.412' }, { version: '10.0.100' }],
  runtimes: [
    { name: 'Microsoft.NETCore.App', version: '8.0.19' },
    { name: 'Microsoft.NETCore.App', version: '10.0.0' },
    { name: 'Microsoft.AspNetCore.App', version: '10.0.0' }
  ]
};

const metadata = {
  'latest-sdk': '10.0.100',
  'latest-runtime': '10.0.0',
  releases: [{
    sdk: {
      version: '10.0.100',
      files: [
        { rid: 'win-x64', name: 'dotnet-sdk-win-x64.exe', url: 'https://example.invalid/sdk.exe', hash: 'installer' },
        { rid: 'win-x64', name: 'dotnet-sdk-win-x64.zip', url: 'https://example.invalid/sdk.zip', hash: 'sdkzip' },
        { rid: 'linux-x64', name: 'dotnet-sdk-linux-x64.tar.gz', url: 'https://example.invalid/sdk', hash: 'abc' }
      ]
    },
    runtime: {
      version: '10.0.0',
      files: [
        { rid: 'linux-x64', name: 'dotnet-apphost-pack-linux-x64.tar.gz', url: 'https://example.invalid/apphost', hash: 'wrong' },
        { rid: 'linux-x64', name: 'dotnet-runtime-linux-x64.tar.gz', url: 'https://example.invalid/runtime', hash: 'def' }
      ]
    },
    'aspnetcore-runtime': {
      version: '10.0.0',
      files: [
        { rid: 'linux-x64', name: 'aspnetcore-runtime-composite-linux-x64.tar.gz', url: 'https://example.invalid/composite', hash: 'wrong-composite' },
        { rid: 'linux-x64', name: 'aspnetcore-runtime-linux-x64.tar.gz', url: 'https://example.invalid/aspnet', hash: 'asp' }
      ]
    },
    windowsdesktop: {
      version: '10.0.0',
      files: [
        { rid: 'win-x64', name: 'windowsdesktop-runtime-win-x64.exe', url: 'https://example.invalid/desktop.exe', hash: 'installer' },
        { rid: 'win-x64', name: 'windowsdesktop-runtime-win-x64.zip', url: 'https://example.invalid/desktop.zip', hash: 'desktop' }
      ]
    }
  }]
};

test('version comparison and requirement matching are deterministic', () => {
  assert.equal(compareVersions('10.0.100', '10.0.99') > 0, true);
  assert.equal(satisfiesRequirement(info, { kind: 'sdk', version: '10.0' }), true);
  assert.equal(satisfiesRequirement(info, { kind: 'sdk', version: '10.0.101', exact: true }), false);
  assert.equal(satisfiesRequirement(info, { kind: 'runtime', version: '8.0.5' }), true);
  assert.equal(satisfiesRequirement(info, { kind: 'runtime', version: '10.0.0', exact: true }), true);
  assert.equal(satisfiesRequirement(info, { kind: 'runtime', version: '10.0.1', exact: true }), false);
  assert.equal(satisfiesRequirement(info, { kind: 'runtime', version: '10.0', frameworkName: 'Microsoft.AspNetCore.App' }), true);
});

test('official SDK artifact resolution selects a portable archive, not an installer', async () => {
  const linux = await resolveOfficialArtifact({ kind: 'sdk', version: '10.0' }, 'linux-x64', { metadata });
  assert.equal(linux.version, '10.0.100');
  assert.equal(linux.hash, 'abc');

  const windows = await resolveOfficialArtifact({ kind: 'sdk', version: '10.0' }, 'win-x64', { metadata });
  assert.equal(windows.name, 'dotnet-sdk-win-x64.zip');
  assert.equal(windows.hash, 'sdkzip');
});

test('runtime artifact resolution ignores apphost and ASP.NET composite packs', async () => {
  const core = await resolveOfficialArtifact({ kind: 'runtime', version: '10.0', frameworkName: 'Microsoft.NETCore.App' }, 'linux-x64', { metadata });
  assert.equal(core.name, 'dotnet-runtime-linux-x64.tar.gz');
  assert.equal(core.component, 'core');

  const aspnet = await resolveOfficialArtifact({ kind: 'runtime', version: '10.0', frameworkName: 'Microsoft.AspNetCore.App' }, 'linux-x64', { metadata });
  assert.equal(aspnet.name, 'aspnetcore-runtime-linux-x64.tar.gz');
  assert.equal(aspnet.hash, 'asp');
  assert.equal(aspnet.component, 'aspnetcore');
});

test('WindowsDesktop runtime resolves the portable Windows archive', async () => {
  const artifact = await resolveOfficialArtifact({ kind: 'runtime', version: '10.0', frameworkName: 'Microsoft.WindowsDesktop.App' }, 'win-x64', { metadata });
  assert.equal(artifact.name, 'windowsdesktop-runtime-win-x64.zip');
  assert.equal(artifact.hash, 'desktop');
  assert.equal(artifact.component, 'windowsdesktop');
});


test('runtimeconfig minimum versions provision the latest patch unless the caller explicitly pins a runtime', async () => {
  const rollingMetadata = {
    'latest-sdk': '10.0.100',
    'latest-runtime': '10.0.1',
    releases: [
      {
        runtime: {
          version: '10.0.1',
          files: [{ rid: 'linux-x64', name: 'dotnet-runtime-linux-x64.tar.gz', url: 'https://example.invalid/runtime-10.0.1', hash: 'new' }]
        }
      },
      {
        runtime: {
          version: '10.0.0',
          files: [{ rid: 'linux-x64', name: 'dotnet-runtime-linux-x64.tar.gz', url: 'https://example.invalid/runtime-10.0.0', hash: 'old' }]
        }
      }
    ]
  };

  const rolled = await resolveOfficialArtifact({ kind: 'runtime', version: '10.0.0', exact: false, frameworkName: 'Microsoft.NETCore.App' }, 'linux-x64', { metadata: rollingMetadata });
  assert.equal(rolled.version, '10.0.1');

  const pinned = await resolveOfficialArtifact({ kind: 'runtime', version: '10.0.0', exact: true, frameworkName: 'Microsoft.NETCore.App' }, 'linux-x64', { metadata: rollingMetadata });
  assert.equal(pinned.version, '10.0.0');
});
