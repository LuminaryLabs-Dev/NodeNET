import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDotnet, spawnDotnet } from '../dotnet/cli.js';
import { BuildError, LibraryLoadError } from '../errors.js';
import { RpcClient } from './rpc.js';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(THIS_DIR, '..', '..');
const BRIDGE_PROJECT = path.join(PACKAGE_ROOT, 'bridge', 'NodeNET.Bridge', 'NodeNET.Bridge.csproj');

function selectedSdkMajor(context) {
  const versions = context.dotnet?.info?.sdks?.map(item => item.version) ?? [];
  const preferred = context.requirement?.kind === 'sdk' ? context.requirement.version : versions[versions.length - 1];
  const major = Number.parseInt(String(preferred ?? '8').split('.')[0], 10);
  return Number.isFinite(major) && major >= 8 ? major : 8;
}

export async function ensureBridge(context, options = {}) {
  if (!context.dotnet) throw new LibraryLoadError('The NodeNET bridge requires a .NET SDK.');
  if (!context.dotnet.info.sdks.length) throw new LibraryLoadError('The selected .NET environment does not contain an SDK.');

  const targetFramework = `net${selectedSdkMajor(context)}.0`;
  const outputDir = path.join(context.paths.bridgeDir, targetFramework);
  const intermediateDir = path.join(context.paths.bridgeDir, 'obj', targetFramework);
  const assemblyPath = path.join(outputDir, 'NodeNET.Bridge.dll');
  try {
    await fs.access(assemblyPath);
    return { assemblyPath, targetFramework, reused: true };
  } catch {
    // Build below.
  }

  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(intermediateDir, { recursive: true });
  const result = await runDotnet(context.dotnet, [
    'build', BRIDGE_PROJECT,
    '--nologo',
    '-c', 'Release',
    '-o', outputDir,
    `-p:NodeNETTargetFramework=${targetFramework}`,
    `-p:BaseIntermediateOutputPath=${intermediateDir}${path.sep}`
  ], {
    cwd: PACKAGE_ROOT,
    timeout: options.timeout ?? 5 * 60_000,
    signal: options.signal
  });
  if (!result.ok) {
    throw new BuildError('Failed to build the NodeNET .NET bridge.', { details: { result } });
  }
  await fs.access(assemblyPath).catch(cause => {
    throw new LibraryLoadError(`Bridge build succeeded but ${assemblyPath} was not produced.`, { cause });
  });
  return { assemblyPath, targetFramework, reused: false };
}

export class LibraryHandle {
  constructor({ rpc, processHandle, assembly }) {
    this.rpc = rpc;
    this.process = processHandle;
    this.assembly = assembly;
  }

  async invoke({ type, method, member, arguments: args = [] } = {}) {
    if (!type) throw new TypeError('invoke() requires a fully qualified .NET type name.');
    const selectedMember = member ?? method;
    if (!selectedMember) throw new TypeError('invoke() requires method/member.');
    const response = await this.rpc.request('invoke', {
      assembly: this.assembly,
      type,
      member: selectedMember,
      arguments: args
    });
    return {
      result: response.result,
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? ''
    };
  }

  on(event, listener) {
    this.rpc.on(event, listener);
    return this;
  }

  close() {
    return this.rpc.close();
  }
}

export async function openLibrary(context, assembly, options = {}) {
  const resolvedAssembly = path.resolve(assembly);
  await fs.access(resolvedAssembly).catch(cause => {
    throw new LibraryLoadError(`Assembly does not exist: ${resolvedAssembly}`, { cause });
  });
  const bridge = await ensureBridge(context, options);
  const processHandle = spawnDotnet(context.dotnet, [bridge.assemblyPath], {
    cwd: options.cwd ?? path.dirname(resolvedAssembly),
    signal: options.signal
  });
  const rpc = new RpcClient(processHandle);
  const ping = await rpc.request('ping');
  if (!ping.ok) {
    await rpc.close();
    throw new LibraryLoadError('NodeNET bridge failed its startup handshake.');
  }
  return new LibraryHandle({ rpc, processHandle, assembly: resolvedAssembly });
}
