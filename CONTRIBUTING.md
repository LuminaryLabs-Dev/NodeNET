# Contributing to NodeNET

NodeNET keeps a small core: the public facade coordinates stable services, while official .NET remains authoritative for CLR, C#, MSBuild, NuGet, workloads, and templates.

## Development

```bash
npm ci --ignore-scripts
npm run check
npm pack --dry-run
```

Network-backed integration:

```bash
NODENET_INTEGRATION=1 npm run test:integration
```

Framework acceptance:

```bash
NODENET_AVALONIA=1 npm run test:avalonia
```

Release-candidate validation on a clean `main` checkout:

```bash
npm run validate:local
npm run validate:local:visible  # macOS manual window gate
```

## Change rules

- Keep `NodeNET.attach()` and the native CLI as two surfaces over the same core behavior.
- Do not reimplement official .NET semantics.
- Keep platform/framework-specific behavior behind service or plugin boundaries.
- Add a contract/regression test for every behavior change.
- Do not weaken checksum verification, process isolation, or trust-boundary diagnostics.
