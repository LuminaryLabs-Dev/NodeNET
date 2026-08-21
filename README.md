# NodeNET

**Bring `dotnet` into the Node.js ecosystem.**

NodeNET is an ESM-native Node.js facade over the official .NET toolchain and runtime. It can inspect .NET projects, resolve or privately provision a compatible SDK/runtime, restore/build/test/publish/run them, pass arbitrary `dotnet` commands through from a `nodenet` CLI, and interoperate with compiled .NET libraries without requiring a machine-wide .NET setup.

> Developer Preview — `0.3.0`

## Install

```bash
npm install @luminarylabs/nodenet
```

Or evaluate commands without a global install:

```bash
npx nodenet info
```

## `dotnet`, from Node

If you know the .NET CLI, the NodeNET CLI is intentionally familiar:

```text
dotnet restore      → nodenet restore
dotnet build        → nodenet build
dotnet test         → nodenet test
dotnet publish      → nodenet publish
dotnet run          → nodenet run
```

Commands NodeNET does not own transparently pass through to the selected .NET SDK:

```bash
nodenet new console -o Hello
nodenet workload list
nodenet tool list
nodenet nuget list source
```

Starting from a machine with Node and no compatible global .NET SDK:

```bash
npx nodenet new console -o Hello
cd Hello
npx nodenet run
```

NodeNET can provision a private official SDK and keep `DOTNET_ROOT`, CLI home, NuGet cache, and PATH changes scoped to child processes.

## JavaScript API

```js
import { NodeNET } from '@luminarylabs/nodenet';

const app = await NodeNET.attach('./MyApp');

await app.prepare();
await app.build();

const process = await app.run();
const result = await process.wait();

await app.dispose();
```

The public facade remains deliberately small:

```text
NodeNET.attach()
net.info()
net.prepare()
net.restore()
net.build()
net.test()
net.publish()
net.clean()
net.run()
net.exec()
net.library()
net.capabilities()
net.doctor()
net.environment()
net.dispose()
```

## Native CLI commands

```text
nodenet info
nodenet prepare
nodenet restore
nodenet build
nodenet test
nodenet publish
nodenet clean
nodenet run
nodenet doctor
nodenet env
nodenet capabilities
nodenet cache
```

Use `--json` for automation output. Native commands use the current directory by default; `--target <path>` selects another project/workspace.

See [`docs/CLI.md`](docs/CLI.md).

## Portable environment modes

- **shared** — reusable managed environments under `~/.nodenet` (or `NODENET_HOME`)
- **local** — managed state under the attached project's `.nodenet`
- **temporary** — isolated OS-temp environment removed by `dispose()`

Resolution order in `auto` mode:

1. explicit `dotnetPath`
2. compatible NodeNET-managed environment
3. compatible system `dotnet`
4. provision an official private .NET SDK/runtime

Use `isolation: 'managed'` to forbid system .NET or `isolation: 'system'` to forbid private provisioning.

## Service/plugin architecture

NodeNET presents one product to users, but internally composes stable services from plugins:

```text
NodeNET facade
     ↓
service kernel
     ↓
Environment  Execution  Project  Interop  Capabilities
     ↓          ↓          ↓        ↓
 default providers / replaceable plugins
     ↓
official .NET
```

The default execution provider is local and shell-free. The architecture permits future container/remote execution providers without changing `prepare()`, `build()`, or `run()`.

Advanced plugin APIs are exported from the package root, but normal NodeNET users do not need to configure them.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## JavaScript ↔ .NET

Compatibility invocation still works:

```js
const lib = await app.library('./bin/Release/net10.0/MyLibrary.dll');

const response = await lib.invoke({
  type: 'Example.Calculator',
  method: 'Add',
  arguments: [5, 8]
});

console.log(response.result); // 13
```

NodeNET 0.3 also introduces persistent CLR object handles:

```js
const Counter = lib.type('Example.Counter');
const counter = await Counter.new(10);

await counter.call('Increment');
console.log(await counter.get('Value')); // 11

await counter.dispose();
```

Interop uses a versioned binary-safe framed protocol between Node and the out-of-process bridge. `Buffer`/`Uint8Array` arguments can travel as raw payload bytes, and returned `System.IO.Stream` instances become chunked remote stream handles.

See [`docs/INTEROP.md`](docs/INTEROP.md).

## Avalonia

Avalonia remains a framework that runs **on top of NodeNET**, not a dependency embedded into NodeNET core.

The intended end-user flow is:

```bash
nodenet new install Avalonia.Templates
nodenet new avalonia.app -o DesktopApp
cd DesktopApp
nodenet restore
nodenet build
nodenet run
```

The integration suite also includes an opt-in headless Avalonia acceptance path that creates an application, drives state, and captures rendered PNG evidence with Avalonia's headless Skia backend when network-backed framework dependencies are available.

## Security

NodeNET is an orchestration and interoperability layer, **not a security sandbox**. Building, testing, running, or loading untrusted .NET code can execute arbitrary native-capable code with the privileges of the selected executor.

Use a real container/OS isolation boundary for untrusted workloads.

See [`docs/SECURITY.md`](docs/SECURITY.md).

## Supported host identities

- `win-x64`
- `win-arm64`
- `osx-x64`
- `osx-arm64`
- `linux-x64`
- `linux-arm64`
- `linux-musl-x64`
- `linux-musl-arm64`

A private .NET archive does not supply every OS-native dependency required by every framework. NodeNET deliberately does not run `apt`, `brew`, `dnf`, `choco`, or similar package managers automatically.

## Validation

```bash
npm test
npm run check
npm pack --dry-run
```

Network-backed portable integration:

```bash
NODENET_INTEGRATION=1 npm run test:integration
```

Avalonia build/headless acceptance:

```bash
NODENET_INTEGRATION=1 NODENET_AVALONIA=1 npm run test:integration
```

## Ownership boundary

NodeNET owns environment detection, .NET acquisition/selection, isolated child environments, CLI/API orchestration, process lifecycle, structured results, capabilities, and JS↔.NET bridge semantics.

Microsoft/.NET remains authoritative for CoreCLR, JIT, GC, BCL, Roslyn, MSBuild, NuGet resolution, workloads, templates, C# semantics, and runtime behavior.
