# Intention

This document records the durable design intent behind NodeNET's current shape. It does not replace `docs/ARCHITECTURE.md`.

## Keep .NET operable from Node

NodeNET should feel native to a Node.js consumer:

```js
import { NodeNET } from '@luminarylabs/nodenet';
```

The user should not need a separate orchestration model merely because the work ultimately runs on official .NET.

## Delegate platform semantics

NodeNET should coordinate official .NET rather than fork its semantics. Microsoft/.NET remains authoritative for runtime, language, build, package-resolution, workload, and template behavior.

## Prefer contained environments

Managed environments exist to make SDK/runtime use portable and reproducible while avoiding unnecessary machine-wide mutation. NodeNET scopes managed runtime paths, CLI home, NuGet cache, and related environment changes to child processes rather than silently changing the user's system.

## Keep API and CLI unified

```text
JavaScript API ─┐
                ├─→ same facade/services/providers
CLI ────────────┘
```

Do not allow the CLI and JavaScript API to evolve into separate products with divergent semantics.

## Keep providers replaceable

The service kernel provides a small, validated replacement boundary. Environment, execution, project, interop, display, host, and capabilities behavior can evolve behind contracts without inflating the public facade into a framework.

## Preserve truthful trust boundaries

Security claims must describe the actual executor. Shell-free local execution is still local execution. `trust: 'untrusted'` therefore requires a provider that explicitly supplies a real sandbox boundary.

## Keep frameworks above core

Avalonia is the first substantial framework acceptance layer, but it is not a NodeNET core dependency. Apply the same rule to ASP.NET, Roslyn tooling, Unity-specific tooling, mobile workloads, or future UI frameworks unless a capability is truly framework-neutral.
