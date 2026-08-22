# NodeNET architecture

NodeNET is the Node.js-native control surface over the official .NET toolchain and runtime. JavaScript authors use `NodeNET`, terminal users use `nodenet`, and both enter the same behavior.

```text
JavaScript API       nodenet CLI
      \                /
       \              /
        NodeNET facade
              |
        service kernel
              |
  +-----------+-----------+-----------+
  |           |           |           |
Environment Execution   Interop     Display
  |           |           |           |
providers    providers   providers   providers
  +-----------+-----------+-----------+
              |
        official .NET
```

## Core boundary

NodeNET does not implement CoreCLR, JIT, GC, BCL, Roslyn, MSBuild, NuGet dependency resolution, workloads, templates, or C# semantics.

The core stays small as new capabilities are added: stable service contracts in the center, specialized implementations at the edge.

## Services and contracts

The stable capability names are `host`, `environment`, `execution`, `project`, `interop`, `display`, and `capabilities`.

The kernel validates known provider contracts at initialization. The current minimum contracts are:

- host: `detect()`
- environment: `ensure()`
- execution: `exec()`, `spawn()`, `kind`, `sandboxed`
- project: `inspect()`, `prepare()`, `restore()`, `build()`, `test()`, `publish()`, `clean()`, `run()`
- interop: `openLibrary()`
- display: `capabilities()`, `createSurface()`
- capabilities: `snapshot()`

This is intentionally not a dependency-injection framework; it is a small provider boundary.

## Execution and trust

The default `LocalExecutionService` is shell-free but not sandboxed. `NodeNET.attach(..., { trust: 'untrusted' })` requires an execution provider with `sandboxed === true`; NodeNET refuses to misrepresent a local child process as security isolation.

Container and remote executors remain optional future providers, not core dependencies.

## Environment boundary

The environment service owns .NET discovery, compatibility selection, private acquisition, integrity verification, and child environment configuration.

NodeNET does not install OS packages automatically.

## Project orchestration

`prepare()` remains the primary outcome abstraction: inspect target, derive .NET requirement, establish a compatible environment, restore when needed, inspect workloads/native assets, and return readiness evidence.

## Interop

CoreCLR remains out-of-process:

```text
Node
 |
NodeNET interop
 |
binary-safe framed protocol
 |
NodeNET.Bridge
 |
CoreCLR
```

The bridge uses values, persistent object/stream handles, and descriptors. Deterministic CLR signatures can be selected explicitly when overload inference is insufficient.

## Display boundary

NodeNET core owns `Frame`, `FrameSurface`, normalized input, and binary frame transport. The canonical V1 representation is owned RGBA8 memory with `stride = width * 4`.

The default software provider is a lazy universal fallback. Framework-specific renderers stay outside core:

```text
Avalonia / Skia / virtual display
              -> RGBA8 Frame
              -> FrameSurface
              -> Node
```

The C# display helper speaks the same framed standard-I/O protocol as the Node process adapter. It is framework-neutral and does not introduce a UI dependency.
