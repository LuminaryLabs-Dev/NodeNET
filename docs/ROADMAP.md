# Roadmap

NodeNET grows by preserving a small core and adding only abstractions that correspond to proven portability boundaries.

## 0.3.x — Hardening and portability proof

Current focus:

- cohesive `nodenet` CLI and JavaScript facade
- official private .NET provisioning
- service/plugin contracts
- explicit trust metadata
- package/TypeScript/OSS polish
- CLR values, handles, descriptors, binary payloads, and streams
- real Windows/macOS/Linux portable and Avalonia acceptance

Scope guard: do not add speculative execution providers or framework semantics while this foundation is still being validated.

## 0.4.0 — Bidirectional CLR interoperability

Planned:

- explicit overload/signature selection refinement
- generic method invocation
- `ref` / `out` representation
- AbortSignal ↔ CancellationToken
- delegate/callback handles
- CLR event subscriptions
- richer stream adapters and metadata
- protocol feature/version negotiation
- explicit bridge concurrency policy
- interop stress/performance tests

The architectural transition is:

```text
Node → C#
```

to:

```text
Node ⇄ C#
```

without hiding CLR semantics behind fragile JavaScript magic.

## 0.5.0 — Composable and isolated execution

Planned only after 0.4 foundations are stable:

- project CLI plugin/config loading
- executor/provider compliance suite
- a second real executor, likely container-based
- trusted/untrusted policy enforcement
- CPU/memory/time/filesystem/network limits through the isolated provider
- artifact transfer
- remote execution proof

The public API should remain the same regardless of execution location.

## 0.6+ — Distribution and framework ecosystem

Potential work, driven by real demand:

- offline capsules
- Avalonia kit
- ASP.NET kit
- Roslyn kit
- additional framework/workload providers
- ARM/musl continuous validation
- bridge/startup/cache performance improvements

## Core boundary

NodeNET core should not reimplement:

- CoreCLR
- Roslyn
- MSBuild
- NuGet
- framework-specific UI/server semantics
- operating-system package managers
- a security sandbox
- Android/iOS/Xcode toolchains

Those remain official .NET/tooling responsibilities or optional NodeNET services/plugins.

## Decision rule

Build the stable socket for a future capability when its boundary is real; do not build every possible thing that could plug into that socket.
