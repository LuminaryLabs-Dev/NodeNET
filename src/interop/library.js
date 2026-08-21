import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runDotnet, spawnDotnet } from '../dotnet/cli.js';
import { BuildError, LibraryLoadError } from '../errors.js';
import { ProtocolClient } from './protocol/client.js';
import { StdioTransport } from './transport/stdio.js';
import { RemoteObjectHandle, RemoteStreamHandle, RemoteType } from './model/handles.js';
import { marshalArguments } from './model/marshal.js';

const THIS_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(THIS_DIR, '..', '..');
const BRIDGE_PROJECT = path.join(PACKAGE_ROOT, 'bridge', 'NodeNET.Bridge', 'NodeNET.Bridge.csproj');
const BRIDGE_PROTOCOL = 'v1-framed';

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
  const outputDir = path.join(context.paths.bridgeDir, BRIDGE_PROTOCOL, targetFramework);
  const intermediateDir = path.join(context.paths.bridgeDir, BRIDGE_PROTOCOL, 'obj', targetFramework);
  const assemblyPath = path.join(outputDir, 'NodeNET.Bridge.dll');
  try {
    await fs.access(assemblyPath);
    return { assemblyPath, targetFramework, reused: true };
  } catch {}

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
  if (!result.ok) throw new BuildError('Failed to build the NodeNET .NET bridge.', { details: { result } });
  await fs.access(assemblyPath).catch(cause => {
    throw new LibraryLoadError(`Bridge build succeeded but ${assemblyPath} was not produced.`, { cause });
  });
  return { assemblyPath, targetFramework, reused: false };
}

export class LibraryHandle {
  constructor({ protocol, transport, processHandle, assembly }) {
    this.protocol = protocol;
    this.transport = transport;
    this.process = processHandle;
    this.assembly = assembly;
  }

  type(name) {
    if (!name) throw new TypeError('type() requires a fully qualified .NET type name.');
    return new RemoteType(this, name);
  }

  async describe(type) {
    const response = await this.protocol.request('describe', { assembly: this.assembly, type });
    return response.result;
  }

  fromWire(value, payload = Buffer.alloc(0)) {
    if (!value || typeof value !== 'object') return value;
    if (value.$handle) return new RemoteObjectHandle(this, value);
    if (value.$stream) return new RemoteStreamHandle(this, value);
    if (value.$binary) {
      const descriptor = value.$binary === true ? { offset: 0, length: payload.length } : value.$binary;
      return Buffer.from(payload.subarray(descriptor.offset ?? 0, (descriptor.offset ?? 0) + (descriptor.length ?? payload.length)));
    }
    if (Array.isArray(value)) return value.map(item => this.fromWire(item, payload));
    return value;
  }

  async invoke({ type, method, member, arguments: args = [] } = {}) {
    if (!type) throw new TypeError('invoke() requires a fully qualified .NET type name.');
    const selectedMember = member ?? method;
    if (!selectedMember) throw new TypeError('invoke() requires method/member.');
    const marshalled = marshalArguments(args);
    const response = await this.protocol.request('invoke', {
      assembly: this.assembly,
      type,
      member: selectedMember,
      arguments: marshalled.arguments
    }, { payload: marshalled.payload });
    return {
      result: this.fromWire(response.result, response.payload),
      stdout: response.stdout ?? '',
      stderr: response.stderr ?? ''
    };
  }

  on(event, listener) {
    this.protocol.on(event, listener);
    return this;
  }

  close() {
    return this.protocol.close();
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
    signal: options.signal,
    binaryStdout: true
  });
  const transport = new StdioTransport(processHandle);
  const protocol = new ProtocolClient(transport);
  const ping = await protocol.request('ping');
  if (!ping.ok) {
    await protocol.close();
    throw new LibraryLoadError('NodeNET bridge failed its startup handshake.');
  }
  return new LibraryHandle({ protocol, transport, processHandle, assembly: resolvedAssembly });
}
