# Architecture

NodeNET is an ESM-native control plane over the official .NET toolchain. It does not implement the CLR or C# language.

## Ownership boundary

NodeNET owns environment detection, .NET resolution and acquisition, integrity checks, private installation, SDK/runtime selection, NuGet cache/environment orchestration, `dotnet` CLI orchestration, process lifecycle, structured results, and the generic JS↔.NET RPC bridge.

Microsoft/.NET remains authoritative for CoreCLR, JIT, GC, BCL, Roslyn, MSBuild, NuGet dependency resolution, workloads, templates, C# semantics, and runtime behavior.

## Runtime flow

```text
Node
  ↓
NodeNET.attach(target)
  ↓
inspect target + detect host
  ↓
resolve requirement
  ↓
explicit / managed / system dotnet?
  ↓ no
resolve official archive → download → SHA-512 verify → extract staging → dotnet verify
  ↓
private DOTNET_ROOT
  ↓
restore / build / test / publish / run
```

Managed installations are versioned beneath a host-specific container. This avoids mutating an SDK/runtime tree while another process may be using it.

## Internal domains

- `host/`: OS, architecture, RID, paths, GUI capability.
- `process/`: shell-free process execution and long-lived handles.
- `dotnet/`: discovery, resolution, provisioning, environment creation, verification, CLI gateway.
- `project/`: bootstrap inspection, preparation, standard project operations.
- `library/`: generic RPC client and C# bridge lifecycle.
- `bridge/NodeNET.Bridge`: reflection-based .NET invocation worker.

The implementation deliberately does not create separate JavaScript reimplementations of NuGet, MSBuild, template management, workload management, or package graph resolution.

## Public surface

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
net.dispose()
```

`prepare()` is idempotent within a NodeNET instance and is the main abstraction. Advanced .NET CLI behavior remains available through `exec()`.

## Interop model

The hardened default is out-of-process:

```text
Node process
  ↓ stdin/stdout JSON RPC
NodeNET.Bridge.dll
  ↓
CoreCLR
  ↓
arbitrary .NET assembly
```

This keeps CLR crashes, UI threads, GC, and runtime lifetime isolated from Node. NodeNET does not embed `hostfxr` or CoreCLR into the Node process.
