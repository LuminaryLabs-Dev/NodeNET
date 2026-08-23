# NodeNET

**Bring `dotnet` into the Node.js ecosystem.**

NodeNET is an ESM-native Node.js facade over the official .NET toolchain and runtime. It can inspect .NET targets, resolve or privately provision a compatible SDK/runtime, restore/build/test/publish/run projects, pass arbitrary `dotnet` commands through a `nodenet` CLI, and interoperate with compiled .NET libraries without requiring a machine-wide .NET setup.

> Developer Preview — `0.3.2`

## Install

```bash
npm install @luminarylabs/nodenet
```

Or run the CLI without a global install:

```bash
npx nodenet --help
npx nodenet --version
```

## `dotnet`, from Node

```text
dotnet restore      → nodenet restore
dotnet build        → nodenet build
dotnet test         → nodenet test
dotnet publish      → nodenet publish
dotnet run          → nodenet run
```

Commands NodeNET does not own pass through to the selected .NET SDK:

```bash
nodenet new console -o Hello
nodenet workload list
nodenet tool list
nodenet nuget list source
```

Unknown options on NodeNET-owned build/test/publish/restore/clean/run commands are preserved and forwarded to `dotnet`, so NodeNET does not need to reimplement every Microsoft CLI flag.

Starting from Node with no compatible global .NET SDK:

```bash
npx nodenet new console -o Hello
cd Hello
npx nodenet run
```

NodeNET can provision an official SDK privately and scopes `DOTNET_ROOT`, CLI home, NuGet cache, and PATH changes to child processes. Human CLI sessions show provisioning progress; `--json` keeps final output machine-readable.

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
net.display()
net.capabilities()
net.doctor()
net.environment()
net.dispose()
```

TypeScript declarations ship with the package.

## Native CLI

```text
nodenet --help
nodenet --version
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

Examples:

```bash
nodenet build --target ./Server -c Release --verbosity diagnostic
nodenet cache info
nodenet cache list
nodenet cache prune
nodenet cache clear downloads
```

See [`docs/CLI.md`](docs/CLI.md).

## Portable environments

- **shared** — reusable managed environments under `~/.nodenet` or `NODENET_HOME`
- **local** — managed state under the attached project's `.nodenet`
- **temporary** — isolated OS-temp environment removed by `dispose()`

Resolution order in `auto` mode:

1. explicit `dotnetPath`
2. compatible NodeNET-managed environment
3. compatible system `dotnet`
4. official private SDK/runtime provisioning

Use `isolation: 'managed'` to forbid system .NET or `isolation: 'system'` to forbid private provisioning.

## Service/plugin architecture

NodeNET presents one product to users while composing stable services internally:

```text
NodeNET facade
     ↓
service kernel
     ↓
Environment  Execution  Project  Interop  Display  Capabilities
     ↓          ↓          ↓        ↓       ↓
 default providers / replaceable plugins
     ↓
official .NET
```

Known service providers are contract-validated when the kernel initializes. The default execution provider is local, shell-free, and explicitly unsandboxed.

Advanced plugin APIs are exported from the package root; normal users do not need to configure them.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Trust boundary

NodeNET is **not a sandbox**.

Trusted local development is the default:

```js
await NodeNET.attach('./App', { trust: 'trusted' });
```

If a caller explicitly marks a workload untrusted, NodeNET refuses to use the default unsandboxed local executor:

```js
await NodeNET.attach('./UntrustedApp', { trust: 'untrusted' });
```

A future/custom executor must declare a real sandbox boundary (`sandboxed: true`) for that composition to be accepted. NodeNET does not pretend that a child process is isolation.

See [`SECURITY.md`](SECURITY.md) and [`docs/SECURITY.md`](docs/SECURITY.md).

## JavaScript ↔ .NET

Compatibility invocation remains available:

```js
const lib = await app.library('./bin/Release/net10.0/MyLibrary.dll');

const response = await lib.invoke({
  type: 'Example.Calculator',
  method: 'Add',
  arguments: [5, 8]
});

console.log(response.result); // 13
```

Persistent CLR objects:

```js
const Counter = lib.type('Example.Counter');
const counter = await Counter.new(10);

await counter.call('Increment');
console.log(await counter.get('Value')); // 11

await counter.dispose();
```

When CLR overloads are ambiguous, NodeNET can pass the deterministic bridge signature explicitly:

```js
await Counter.call({
  member: 'Create',
  signature: 'Create(System.Int32)',
  arguments: [10]
});
```

Interop uses a versioned binary-safe framed protocol. `Buffer`/`Uint8Array` arguments can travel as raw payload bytes, and `System.IO.Stream` results become pull-based remote stream handles.

See [`docs/INTEROP.md`](docs/INTEROP.md).

## Headless display

DisplayService gives NodeNET a zero-dependency, lazy RGBA8 framebuffer plus capture and normalized input:

```js
import { NodeNET, savePng } from '@luminarylabs/nodenet';

const app = await NodeNET.attach('.');
const surface = await app.display({ width: 420, height: 640 });
const draw = surface.rasterizer();
draw.clear([8, 13, 31, 255]);
surface.present();
await savePng(surface.capture(), 'frame.png');
await app.dispose();
```

Graphical child processes can submit raw frames over NodeNET's binary protocol and receive pointer/key input. The shipped C# helper and Avalonia acceptance fixture prove the same contract without making Avalonia or Skia core dependencies.

See [`docs/DISPLAY.md`](docs/DISPLAY.md).

## Example applications

The repository includes four live software-framebuffer applications that exercise NodeNET through normalized pointer/key input and generate fresh screenshot evidence:

```bash
npm run example:paint
npm run example:notepad
npm run example:filters
npm run example:studio
npm run validate:examples
```

See [`examples/README.md`](examples/README.md). Generated screenshots and verification reports are written under `artifacts/examples/` and remain outside the published npm package.

## Avalonia

Avalonia remains a framework on top of NodeNET rather than a dependency embedded into core.

```bash
nodenet new install Avalonia.Templates
nodenet new avalonia.app -o DesktopApp
cd DesktopApp
nodenet restore
nodenet build
nodenet run
```

The repository contains a permanent, version-locked calculator fixture shared by a headless entrypoint and a normal desktop entrypoint. Framework acceptance builds that real C# project, sends Node pointer input into its Avalonia controls, verifies `12 + 7 = 19`, and captures the initial, expression, and result frames through DisplayService.

## Supported host identities

Implemented host identities:

- `win-x64`
- `win-arm64`
- `osx-x64`
- `osx-arm64`
- `linux-x64`
- `linux-arm64`
- `linux-musl-x64`
- `linux-musl-arm64`

Implemented does not mean every RID is continuously tested. Standard CI currently targets hosted Windows, macOS, and Linux runners; ARM/musl validation remains a separate portability gate.

A private .NET archive does not provide every OS-native dependency required by every framework. NodeNET deliberately does not run `apt`, `brew`, `dnf`, `choco`, or similar package managers automatically.

## Validation

```bash
npm test
npm run check
npm run test:display
npm pack --dry-run
```

Network-backed portable integration:

```bash
NODENET_INTEGRATION=1 npm run test:integration
```

Avalonia acceptance:

```bash
NODENET_AVALONIA=1 npm run test:avalonia
```

Complete local production validation and the additional macOS window confirmation:

```bash
npm run validate:local
npm run validate:local:visible
```

Each local run writes a self-contained report under `artifacts/local-validation/`. The visible command requires clicking `1`, `2`, `+`, `7`, `=`, confirming `19`, and closing the real Avalonia window.

## Canonical project state

For closeout and future handoff, use these repository documents rather than chat history:

- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — current product, architecture, capabilities, and limitations
- [`docs/VALIDATION.md`](docs/VALIDATION.md) — exact acceptance and release gates
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — deliberately staged future work

## Ownership boundary

NodeNET owns environment detection, .NET acquisition/selection, isolated child environments, CLI/API orchestration, process lifecycle, structured results, capabilities, display frames/input contracts, service contracts, and JS↔.NET bridge semantics.

Microsoft/.NET remains authoritative for CoreCLR, JIT, GC, BCL, Roslyn, MSBuild, NuGet resolution, workloads, templates, C# semantics, and runtime behavior.
