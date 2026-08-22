# Current State

## NodeNET 0.3.1

**Status:** Developer Preview  
**Canonical branch:** `main`

NodeNET is a Node-native control surface for provisioning, building, running, and interoperating with official .NET.

The repository is the source of truth. The exact canonical commit is the current HEAD of `main` and is recorded by Git history; this document intentionally does not embed its own commit SHA.

## Current architecture

```text
JavaScript API        nodenet CLI
       \              /
        NodeNET facade
             |
       service kernel
             |
 Host / Environment / Execution / Project / Interop / Capabilities
             |
       default providers
             |
        official .NET
```

NodeNET owns orchestration and portability boundaries. Microsoft/.NET remains authoritative for CoreCLR, the JIT, GC, BCL, Roslyn, MSBuild, NuGet resolution, workloads, templates, C# semantics, and runtime behavior.

## Public JavaScript API

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

The stable product surface is the NodeNET facade. Plugin/service APIs and the richer interop object model remain Developer Preview.

## CLI

NodeNET-owned commands:

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

Commands NodeNET does not own are passed to the selected official `dotnet` CLI. NodeNET-owned commands preserve unrecognized .NET flags so Microsoft CLI options do not need to be reimplemented.

## Environment modes

- `shared` — reusable state under `~/.nodenet` or `NODENET_HOME`
- `local` — state under the attached project
- `temporary` — OS temporary state removed by `dispose()`

NodeNET may use an explicit, managed, or system .NET environment according to the selected isolation policy. Managed provisioning downloads official .NET artifacts, verifies SHA-512, stages extraction, verifies the runtime/SDK, and does not modify machine-wide PATH or install OS packages.

## Service contracts

Current service capabilities:

- Host: `detect()`
- Environment: `ensure()`
- Execution: `exec()`, `spawn()`, `kind`, `sandboxed`
- Project: `inspect()`, `prepare()`, `restore()`, `build()`, `test()`, `publish()`, `clean()`, `run()`
- Interop: `openLibrary()`
- Capabilities: `snapshot()`

Default execution is local, shell-free, and explicitly **not sandboxed**.

## Trust boundary

NodeNET is not a security sandbox.

- `trust: 'trusted'` may use the default local executor.
- `trust: 'untrusted'` requires an execution provider that declares a real sandbox boundary with `sandboxed: true`.

NodeNET does not claim process isolation merely because .NET is launched out of process.

## Current CLR interoperability

Supported concepts:

```text
Values
Handles
Descriptors
```

Supported operations:

```text
describe
construct
call
get
set
dispose
stream.read
stream.write
```

Current interoperability includes:

- compatibility `library.invoke()`
- persistent CLR object handles
- static and instance methods/properties
- deterministic member signatures for overload selection
- raw `Buffer` / `byte[]` transport
- pull-based remote `System.IO.Stream` handles
- deterministic disposal of handles on explicit dispose and bridge shutdown

Not part of 0.3.x: delegates/callbacks, CLR event subscriptions, generic invocation, `ref`/`out`, AbortSignal-to-CancellationToken mapping, or parallel bridge semantics.

## Host identities

Implemented:

- `win-x64`
- `win-arm64`
- `osx-x64`
- `osx-arm64`
- `linux-x64`
- `linux-arm64`
- `linux-musl-x64`
- `linux-musl-arm64`

Implemented does not mean continuously tested. Standard hosted CI covers Windows, macOS, and Linux; ARM/musl require separate validation.

## Framework boundary

Avalonia is a validation workload and future optional kit, not a dependency of NodeNET core. The same rule applies to ASP.NET, Roslyn, Unity-specific tooling, mobile workloads, and other framework integrations.

## Known limitations

- NodeNET does not replace .NET.
- NodeNET is not one native binary for every OS/CPU.
- OS-native framework dependencies may still be required.
- Local execution is not a sandbox.
- The bridge is out of process by design.
- 0.3.x does not yet provide bidirectional CLR callbacks/events.
- ARM/musl host identities are implemented but are not all continuously tested.
- Network-backed .NET/NuGet/framework validation depends on CI or another network-capable environment.

## Validation

The canonical validation procedure and the distinction between locally proven and network-backed gates are in [`VALIDATION.md`](VALIDATION.md).

## Next milestone

`0.4.0` focuses on **bidirectional CLR interoperability**: callbacks/delegates, events, cancellation, richer method semantics, stream improvements, protocol feature negotiation, and an explicit concurrency model.

Do not begin container/remote execution or framework expansion merely because the architecture permits it. Those remain later milestones after the 0.3.x portability foundation stays stable.
