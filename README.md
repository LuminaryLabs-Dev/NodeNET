# NodeNET

Portable .NET environment, build, runtime, and interop control for Node.js.

NodeNET lets an ESM application attach to a .NET workspace, project, assembly, or executable and make the required .NET environment available without requiring a machine-wide installation. It can use a compatible system `dotnet`, or provision an isolated official SDK/runtime into a NodeNET-managed root.

## Core contract

```js
import { NodeNET } from '@luminarylabs/nodenet';

const app = await NodeNET.attach('./MyApp');

await app.prepare();
const build = await app.build();
const process = await app.run();
const result = await process.wait();
```

`prepare()` is the central operation. It inspects the target and host, resolves the required SDK/runtime, finds or provisions a compatible `dotnet`, configures an isolated child environment, restores project dependencies when needed, checks declared workload requirements, and records readiness evidence.

## Portable modes

- **shared** (default): managed SDKs/runtimes are cached under `~/.nodenet` and reused across projects.
- **local**: managed state lives under the attached project's `.nodenet` directory.
- **temporary**: an isolated root is created in the OS temp directory and removed by `dispose()`; useful for CI, sandboxes, and agents.

NodeNET does not modify machine/user `PATH`, register .NET globally, write the Windows registry, or invoke OS package managers. `DOTNET_ROOT`, `DOTNET_CLI_HOME`, `NUGET_PACKAGES`, and `PATH` are configured only for NodeNET child processes.

## System .NET is optional

Resolution order in the default `auto` isolation mode is:

1. explicit `dotnetPath`
2. compatible NodeNET-managed environment
3. compatible system `dotnet`
4. provision an official private .NET environment

Use `isolation: 'managed'` to forbid system .NET, or `isolation: 'system'` to forbid provisioning.

```js
const app = await NodeNET.attach('./MyApp', {
  mode: 'temporary',
  isolation: 'managed',
  sdk: '10.0'
});

await app.prepare();
```

## Project operations

```js
await app.restore();
await app.build({ configuration: 'Release' });
await app.test();
await app.publish({
  configuration: 'Release',
  runtime: 'linux-x64',
  selfContained: true,
  output: './publish'
});

const running = await app.run({ args: ['--example'] });
running.on('stdout', chunk => process.stdout.write(chunk));
await running.stop();
```

The underlying .NET SDK remains authoritative for MSBuild, Roslyn, NuGet, workloads, templates, and tools. Advanced commands stay available without duplicating those systems in JavaScript:

```js
await app.exec(['new', 'install', 'Avalonia.Templates']);
await app.exec(['workload', 'list']);
```

An empty directory can be attached as a NodeNET **workspace** when the goal is to provision an SDK and use raw `dotnet` CLI commands before a project exists.

## JavaScript → .NET libraries

NodeNET ships one generic C# bridge instead of framework-specific adapters. It loads an arbitrary assembly in a separate CoreCLR process and uses newline-delimited JSON RPC over stdin/stdout.

```js
const net = await NodeNET.attach('./MyLibrary.csproj', {
  sdk: '10.0'
});

await net.prepare();
await net.build({ configuration: 'Release' });

const library = await net.library('./bin/Release/net10.0/MyLibrary.dll');
const response = await library.invoke({
  type: 'Example.Calculator',
  method: 'Add',
  arguments: [5, 8]
});

console.log(response.result); // 13
await library.close();
```

The bridge currently supports public static methods and public instance methods whose declaring type has a public parameterless constructor. JSON arguments are converted to the selected method's parameter types. `Task` and `ValueTask` results are awaited.

## CLI

```text
nodenet info <target>
nodenet prepare <target>
nodenet restore <target>
nodenet build <target>
nodenet test <target>
nodenet publish <target>
nodenet run <target> [...args]
nodenet exec <target> [...dotnet args]
```

## Provisioning and trust

NodeNET resolves official SDK/runtime archives from Microsoft's .NET release metadata, verifies the published SHA-512 hash before extraction, extracts into a staging directory, verifies `dotnet --info`, and only then activates the versioned managed root. Install locks prevent two Node processes from provisioning the same SDK/runtime simultaneously.

A NodeNET-managed root is versioned (`sdk-10.0.100`, `runtime-10.0.0`, etc.) so a new install never mutates an in-use runtime tree.

NodeNET is an orchestration layer, **not a security sandbox**. Running an untrusted .NET project is equivalent to running other untrusted native-capable code on the host.

## Requirements

- Node.js 20+
- a supported host: Windows x64/ARM64, macOS x64/ARM64, Linux glibc x64/ARM64, or Linux musl x64/ARM64
- ability to spawn native child processes
- required OS-native dependencies for the selected .NET runtime/framework
- network access when an SDK/runtime or NuGet package is not already cached

## Validation

```bash
npm test
npm run check
```

Network-backed provisioning tests are opt-in:

```bash
NODENET_INTEGRATION=1 npm run test:integration
```

Avalonia template/build acceptance is additionally gated behind `NODENET_AVALONIA=1` so normal unit tests stay fast and deterministic.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/PORTABILITY.md`](docs/PORTABILITY.md), and [`docs/SECURITY.md`](docs/SECURITY.md).
