# NodeNET

**Bring `dotnet` into the Node.js ecosystem.**

NodeNET is an ESM-native Node.js facade over the official .NET toolchain and runtime. It can inspect .NET targets, resolve or privately provision a compatible SDK/runtime, restore/build/test/publish/run projects, pass arbitrary `dotnet` commands through a `nodenet` CLI, and interoperate with compiled .NET libraries without requiring a machine-wide .NET setup.

> **0.3.2 Developer Preview — validated engineering baseline, not a published release.**

## Current state (2026-10-31)

| Field | Confirmed state |
| --- | --- |
| Maintainer | Luminary Labs |
| Engineering baseline | [`5903d21f`](https://github.com/LuminaryLabs-Dev/NodeNET/commit/5903d21f309882167240ab83b3345a37a99f8912) on `main` |
| Package source | `@luminarylabs/nodenet@0.3.2` |
| CI | 14/14 hosted jobs PASS across Windows, Linux and macOS |
| Browser | Native Avalonia WASM publish PASS; interactive Chromium NodeNET bridge not yet automated |
| Release | No v0.3.2 GitHub tag or GitHub release at baseline; npm publication unverified |

NodeNET is **JavaScript access to the official Microsoft .NET toolchain**, not its own C# compiler, self-contained offline SDK, or security sandbox. Its next phase is a portable SDK distribution and browser interaction acceptance (internal successor **LUM-000156**).

## Install from the repository

Until an approved npm release is verified, install from GitHub with appropriate repository access:

```bash
npm install github:LuminaryLabs-Dev/NodeNET#main
npx --no-install nodenet --version
npx --no-install nodenet --help
```

For reproducibility, pin a reviewed commit rather than `main`. Declaring `@luminarylabs/nodenet` in `package.json` does not mean the package is published to npm. An approved future registry release will use `npm install @luminarylabs/nodenet`.

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

Starting from Node with no system-wide .NET SDK (requires network access or verified cached SDK/NuGet assets):

```bash
npx --no-install nodenet new console -o Hello
cd Hello
npx --no-install nodenet run
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

## Portable .NET environments

- **shared** — reusable private .NET under `~/.nodenet` or `NODENET_HOME`
- **local** — project-local `.nodenet` state
- **temporary** — disposable environment removed by `dispose()`

`auto` resolution uses explicit `dotnetPath`, an existing managed SDK, a compatible system SDK, then verified official Microsoft provisioning. `isolation: 'managed'` forbids system .NET; `isolation: 'system'` forbids managed provisioning.

**Limit:** A NodeNET npm package does not contain the official compiler, CLR, NuGet cache, reference packs, or `wasm-tools`. Private provisioning works when the host can download official archives or has a verified cached archive. An empty network-disabled AI sandbox cannot compile fresh C# until real toolchain bytes have been supplied. See [portability](docs/PORTABILITY.md).

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

## Avalonia and browser WebAssembly

The permanent calculator fixture shares C# controls across headless, desktop and browser hosts. The **NodeNET DisplayService input-to-C#-state-to-RGBA frame** proof runs headlessly on Windows, Linux and macOS, including `12 + 7 = 19`.

The committed `Calculator.Browser` project is a genuine `net10.0-browser` Avalonia site. Its `Program.cs` starts `StartBrowserAppAsync("out")`; `wwwroot/main.js` launches Microsoft's .NET WebAssembly loader. Linux CI installs managed SDK `10.0.401` and `wasm-tools`, performs locked restore, publishes with `WasmBuildNative=true`, `WasmEnableSIMD=true` and `EmccLinkOptimizationFlag=-O1`, then checks `wwwroot` plus fingerprinted native/WebCIL assets.

**Validation boundary:** browser CI checks a loadable static site's assets, not automated mouse, keyboard, focus, text, or C# state/frame changes through a NodeNET browser bridge. The browser interaction and headless NodeNET integration are separate claims. See [DisplayService](docs/DISPLAY.md).

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

## Validation and evidence

```bash
npm ci --ignore-scripts
npm test
npm run check
npm run test:display
npm pack --dry-run
```

Managed integration and framework validation (require .NET provisioning and network/cached packages):

```bash
NODENET_INTEGRATION=1 npm run test:integration
NODENET_AVALONIA=1 npm run test:avalonia
NODENET_AVALONIA=1 npm run test:avalonia:wasm
```

Local release-candidate gates:

```bash
npm run validate:local
npm run validate:local:visible
```

The second command additionally requires a compatible visible macOS Avalonia session; it has **not** been independently verified for the recorded baseline. Reports are created under `artifacts/local-validation/`.

### Verified CI at `5903d21f`

- [General CI](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/41239507334): 7/7 PASS, including software display and Node 20/22 checks on three OS.
- [Avalonia Framework Acceptance](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/41239507349): 4/4 PASS, including headless acceptance on three OS and Linux browser WASM publishing.
- [Portable .NET Integration](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/41239507368): 3/3 PASS, including managed provisioning, C# interop and packed consumers.

**14/14 hosted jobs passed on the cited source commit.** This is not evidence of npm publication, the full local release report, an offline SDK capsule or live Chromium NodeNET interaction. Each later change requires fresh validation.

## Authoritative documentation and next decision

- [`docs/CURRENT_STATE.md`](docs/CURRENT_STATE.md) — verified architecture and limitations
- [`docs/VALIDATION.md`](docs/VALIDATION.md) — release gates, commands and evidence
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — staged product milestones
- [`docs/PORTABILITY.md`](docs/PORTABILITY.md) — host and SDK boundaries
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — service ownership

**Next:** deliver a reproducible, JavaScript-accessible C# SDK with verified offline toolchain delivery and actual browser NodeNET input/frame automation (LUM-000156). LUM-000152 and LUM-000153 remain separate documentation and ChatGPT application-acceptance tasks. Local prototype SDK/capsule code is **not committed to main**.

No v0.3.2 tag, npm publication, or deployment should occur without explicit release approval and the remaining acceptance evidence.

## Ownership boundary

NodeNET owns environment detection, .NET acquisition/selection, isolated child environments, CLI/API orchestration, process lifecycle, structured results, capabilities, display frames/input contracts, service contracts, and JS↔.NET bridge semantics.

Microsoft/.NET remains authoritative for CoreCLR, JIT, GC, BCL, Roslyn, MSBuild, NuGet resolution, workloads, templates, C# semantics, and runtime behavior.
