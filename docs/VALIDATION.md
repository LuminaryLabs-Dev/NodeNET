# Validation

This document is the canonical NodeNET closeout and release-validation procedure.

A feature is not considered validated merely because its code exists. Record evidence at the strongest environment that can actually exercise the behavior.

## 1. Static and unit gate

From a clean checkout:

```bash
npm ci --ignore-scripts
npm test
npm run check
npm pack --dry-run
```

This gate proves:

- package and lockfile consistency
- required files and package exports exist
- JavaScript/MJS syntax parses
- the full unit suite passes
- CLI routing, service contracts, trust gates, caching, framing, provisioning helpers, and other deterministic behaviors pass without requiring external .NET downloads
- the npm package manifest contains the intended publish surface

## 2. Packed consumer gate

Create the real npm tarball:

```bash
npm pack
```

Install that tarball into a clean consumer directory rather than importing from the source repository.

Minimum checks:

```bash
npx nodenet --version
npx nodenet --help
```

These meta commands must work without provisioning .NET.

When network-backed integration is available, the packed CLI must also create and run a real console application.

## 3. Portable .NET integration

```bash
NODENET_INTEGRATION=1 npm run test:integration
```

The portable integration must prove:

```text
Node
→ NodeNET
→ privately managed official .NET SDK
→ restore
→ build
→ run
```

It also verifies the packed CLI and the real JS ↔ C# bridge.

Required interop evidence:

- compatibility static invocation
- persistent CLR object construction/state
- property get/set
- raw binary round trip
- remote stream chunk reads
- explicit disposal and invalid-handle failure afterward

Real stdout/results must be asserted; exit code zero alone is insufficient.

## 4. Avalonia framework acceptance

```bash
NODENET_INTEGRATION=1 NODENET_AVALONIA=1 npm run test:integration
```

The framework acceptance workflow should prove:

```text
NodeNET
→ managed .NET
→ Avalonia template/project
→ restore/build
→ headless startup
→ UI state interaction
→ PNG rendering
```

Avalonia remains a validation workload above NodeNET rather than a core dependency.

## 5. Negative behavior

Keep tests for:

- invalid artifact integrity → `DOTNET_INTEGRITY_FAILED`
- missing target → `TARGET_NOT_FOUND`
- incompatible system-only resolution → clear resolution failure
- offline provisioning without a usable local artifact → no hidden network fallback
- `trust: 'untrusted'` with local execution → `UNTRUSTED_EXECUTION_REQUIRES_SANDBOX`
- invalid plugin/service composition → contract/dependency failure before work begins

## 6. Cleanup behavior

Temporary mode must not leave expected-temporary SDK roots, staging directories, locks, or project state behind after disposal.

`NodeNET.dispose()` must close tracked library bridges and stop tracked child applications. CLR handles are cleared when the bridge exits.

## 7. Platform evidence

Standard hosted CI targets Windows, macOS, and Linux. The repository also implements ARM64 and musl RIDs, but implementation support must not be described as continuous validation unless a matching runner actually executed the acceptance suite.

Recommended evidence table after a release-validation run:

| Gate | Status |
| --- | --- |
| Node unit/static/package | record actual result |
| Ubuntu portable .NET | record actual result |
| Windows portable .NET | record actual result |
| macOS portable .NET | record actual result |
| Ubuntu Avalonia | record actual result |
| Windows Avalonia | record actual result |
| macOS Avalonia | record actual result |
| ARM/musl | mark unverified unless actually run |

Do not replace an unavailable result with an assumption.

## 8. Git closeout gate

Before moving `main`:

1. compare the final candidate against the current `main`
2. review every changed path
3. confirm intentional deletions only
4. confirm `bin/nodenet.js` remains executable
5. confirm package/lock/CLI versions agree
6. re-fetch `main` for a race check
7. fast-forward with `force=false`

After the push:

1. re-fetch `main`
2. compare the intended commit to `main` (`ahead = 0`, `behind = 0`)
3. re-open package, facade, CLI, kernel/services, interop, README, and the canonical state docs from live `main`
4. inspect CI results when observable

## Current sandbox limitation

The ChatGPT sandbox used during the 0.3.1 closeout can run Node/TypeScript/package tests but does not provide a usable local .NET SDK and cannot substitute for the network-backed real .NET/Avalonia acceptance jobs. Those gates must remain explicitly unverified until a capable runner reports them.
