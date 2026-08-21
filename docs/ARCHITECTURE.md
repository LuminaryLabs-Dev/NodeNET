# NodeNET architecture

NodeNET is the Node.js-native control surface over the official .NET toolchain and runtime. The public product is intentionally cohesive: JavaScript authors use `NodeNET`, terminal users use `nodenet`, and both enter the same core behavior.

## Product boundary

```text
JavaScript API       nodenet CLI
      \                /
       \              /
        NodeNET facade
              |
        service kernel
              |
  +-----------+-----------+
  |           |           |
Environment Execution   Interop
  |           |           |
plugins      plugins     plugins
  +-----------+-----------+
              |
        official .NET
```

NodeNET does not implement CoreCLR, the JIT, GC, BCL, Roslyn, MSBuild, NuGet dependency resolution, workloads, templates, or C# semantics. Microsoft/.NET remains authoritative for those systems.

## Kernel and plugins

The kernel is deliberately small. A service registry resolves stable capabilities such as `host`, `environment`, `execution`, `project`, `interop`, and `capabilities`. Plugins provide implementations. Default users never need to configure the graph.

The standard composition is:

- `nodenet.host.node`
- `nodenet.execution.local`
- `nodenet.environment.dotnet`
- `nodenet.capabilities.default`
- `nodenet.project.dotnet`
- `nodenet.interop.reflection`

Custom plugins can replace services without changing `NodeNET.attach()`, `prepare()`, `build()`, or `run()`.

## Execution boundary

Execution is a service. The default `LocalExecutionService` uses shell-free native child processes and is explicitly **not a security sandbox**. The contract permits future container or remote executors without making those providers mandatory in core.

## Environment boundary

The environment service owns .NET discovery, compatibility selection, private acquisition, verification, and child environment configuration. The default provider continues to use the hardened versioned NodeNET roots, official release metadata, SHA-512 verification, staging, and install locks.

## Project orchestration

Project operations compose services to produce outcomes. `prepare()` remains the primary abstraction: inspect the target, determine the .NET requirement, establish a compatible environment, restore when needed, inspect workloads/native assets, and return readiness evidence.

## Interop model

NodeNET keeps CoreCLR out-of-process.

```text
Node
  |
NodeNET interop
  |
versioned framed protocol
  |
NodeNET.Bridge
  |
CoreCLR
  |
assembly
```

The bridge model has three concepts:

- **values**: primitives/value types transferred by value
- **handles**: persistent CLR objects/streams retained in the bridge
- **descriptors**: type/member metadata used for deterministic invocation

Current rich operations are `describe`, `construct`, `call`, `get`, `set`, `dispose`, `stream.read`, and `stream.write`. The legacy `library.invoke()` surface remains supported on top of the same bridge.

## Protocol and transport

Control headers are versioned JSON. Transport framing is binary-safe: each frame carries an 8-byte little-endian prefix containing header length and payload length, followed by the JSON header and optional raw payload. This avoids base64 overhead for byte buffers and stream chunks while keeping protocol semantics independent of future transport providers.
