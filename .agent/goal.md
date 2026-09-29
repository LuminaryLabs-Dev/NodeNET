# Goal

## Enduring goal

NodeNET should provide a portable, Node-native control surface over official .NET so JavaScript and CLI users can discover or provision .NET, prepare and orchestrate projects, execute processes, interoperate with CLR libraries, and use framework-neutral display/input capabilities without duplicating or misrepresenting the .NET platform.

```text
Node consumers
     ↓
   NodeNET
     ↓
official .NET
```

## Success conditions

- predictable and explainable environment resolution
- private managed SDK/runtime support without requiring a machine-wide install
- stable public facade and service boundaries
- replaceable providers/plugins with contract validation
- deterministic, binary-safe JS ↔ CLR transport and lifecycle semantics
- framework-neutral display/input contracts
- strong package, unit, integration, framework, and release evidence
- portable behavior with explicit host-evidence boundaries
- truthful security/trust claims

## Current milestone sequence

`docs/CURRENT_STATE.md` is authoritative. At the documentation baseline it identifies the immediate sequence as:

1. close the remaining `0.3.2` release-candidate gates and publish/tag as appropriate
2. use `0.3.3` for maintenance work
3. use `0.4.0` for bidirectional CLR interoperability

Current `0.4.0` direction includes callbacks/delegates, events, cancellation, richer method semantics, stream improvements, protocol feature negotiation, and an explicit concurrency model. Treat `docs/ROADMAP.md` as the authoritative future-work source.

## Explicit non-goals

- replacing .NET or owning CLR/toolchain semantics
- implementing CoreCLR, Roslyn, MSBuild, or NuGet behavior inside NodeNET
- describing unsandboxed local child processes as a security sandbox
- silently installing OS-native dependencies
- treating every implemented RID as continuously validated
- moving framework-specific rendering into core without a generic capability justification
- adding container/remote execution merely because the provider architecture can support it
