# Validation

This document is the canonical NodeNET closeout and release-validation procedure.

A feature is not considered validated merely because its code exists. Record evidence at the strongest environment that can actually exercise the behavior.

## 0. One-command local release-candidate gate

From a clean `main` checkout after `npm ci --ignore-scripts`:

```bash
npm run validate:local
npm run validate:local:visible
```

`validate:local` runs the static/unit, software display, real tarball, clean runtime consumer, strict NodeNext TypeScript, fresh private .NET, exact C# frame/input, and real Avalonia headless gates. It restores the permanent fixture in NuGet locked mode and records semantic state plus changed pixels rather than requiring one host-specific full-image hash.

`validate:local:visible` runs the same automated ladder and then opens the shared Avalonia calculator through the normal desktop backend on macOS. Click `1`, `2`, `+`, `7`, `=`, confirm `19`, and close the window. The visible gate reads the actual C# state written when that window closes.

Every run writes:

```text
artifacts/local-validation/<run-id>/
  REPORT.md
  summary.json
  environment.json
  commands.log
  software/
  dotnet/
  avalonia/
  nodenet-local-validation.zip
```

`artifacts/local-validation/latest/` contains a copy of the newest result. Every gate is `PASS`, `FAIL`, `BLOCKED`, or `SKIPPED`; missing network, GUI, or platform evidence cannot become a pass. The report archive contains no private SDK, package cache, temporary consumer, host name, environment-variable dump, or secrets.

## 1. Static and unit gate

From a clean checkout:

```bash
npm ci --ignore-scripts
npm test
npm run check
npm run test:display
npm pack --dry-run
```

This gate proves:

- package and lockfile consistency
- required files and package exports exist
- JavaScript/MJS syntax parses
- the full unit suite passes
- CLI routing, service contracts, trust gates, caching, framing, provisioning helpers, and other deterministic behaviors pass without requiring external .NET downloads
- the npm package manifest contains the intended publish surface

The software display proof must produce:

```text
artifacts/display/
  calculator-initial.png
  calculator-12-plus-7.png
  calculator-result-19.png
  verification.json
```

`verification.json` must report `expected = 19`, `actual = 19`, `changed = true`, and `pass = true`. This gate requires no .NET SDK, NuGet access, native window manager, or GPU.

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
- framework-neutral C# display helper startup
- exact C# RGBA8 frame submission and SHA-256 verification in Node
- Node pointer request returning changed C# state and a changed frame

Real stdout/results must be asserted; exit code zero alone is insufficient.

## 4. Avalonia framework acceptance

```bash
NODENET_AVALONIA=1 npm run test:avalonia
```

The framework acceptance workflow should prove:

```text
NodeNET
→ exact managed .NET SDK 10.0.400
→ permanent locked Avalonia 12.1.1 projects
→ restore/build
→ headless startup
→ DisplayService process handshake
→ Node pointer input into real controls
→ C# calculator state `12 + 7 = 19`
→ real Avalonia RGBA8 frames
→ PNG rendering and verification JSON
```

`Calculator.Shared` owns the live C# state and real AXAML controls. `Calculator.Headless` owns automated rendering/input, while `Calculator.App` owns the normal visible desktop entrypoint. Avalonia remains a validation workload above NodeNET rather than a core dependency. The workflow must upload the initial, expression, and result screenshots even when the job fails so rendering failures remain inspectable.

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

## Observed 0.3.2 closeout evidence — 2026-08-22

The final implementation tree was exercised locally with Node.js 24.19.0 and on GitHub-hosted Ubuntu, Windows, and macOS runners. The local sandbox did not provide a .NET executable and could not acquire the SDK or NuGet packages, so the linked workflow runs—not inference—supply the network-backed managed .NET and Avalonia evidence.

| Gate | Result |
| --- | --- |
| Full Node unit/static suite | PASS — 67/67 |
| Hosted Node matrix | PASS — Node 20/22 on Ubuntu, Windows, and macOS ([run 32598116139](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/32598116139)) |
| Software framebuffer calculator | PASS — `12 + 7 = 19` |
| Initial/expression/result PNG evidence | PASS — distinct pixel SHA-256 values and visual inspection |
| Binary display process handshake, frame, input, and disposal | PASS |
| Workflow YAML and C# project XML parsing | PASS |
| Package/lock/CLI version agreement | PASS — `0.3.2` |
| Clean tarball consumer: ESM display API and exact pixels | PASS |
| Clean tarball consumer: PNG and validation harness | PASS |
| Packed CLI `--version` / `--help` | PASS |
| Packed TypeScript declarations (strict `NodeNext`, `tsc --noEmit`) | PASS |
| Package generated-content and required-file audit | PASS — 83 intended entries |
| Ubuntu portable managed .NET/C# bridge | PASS ([run 32598116155](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/32598116155)) |
| Windows portable managed .NET/C# bridge | PASS ([run 32598116155](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/32598116155)) |
| macOS portable managed .NET/C# bridge | PASS ([run 32598116155](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/32598116155)) |
| Ubuntu real Avalonia input/render/screenshots | PASS ([run 32598116146](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/32598116146)) |
| Windows real Avalonia input/render/screenshots | PASS ([run 32598116146](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/32598116146)) |
| macOS real Avalonia input/render/screenshots | PASS ([run 32598116146](https://github.com/LuminaryLabs-Dev/NodeNET/actions/runs/32598116146)) |
| ARM/musl acceptance | NOT RUN — implemented identities remain unverified on matching runners |
| Portable managed .NET fixture in this sandbox | NOT RUN — SDK acquisition blocked by sandbox policy |
| Real Avalonia calculator in this sandbox | NOT RUN — requires managed .NET and NuGet access |

The software proof records these frame-pixel hashes:

- initial: `d147bba954c1be5414c94928038a0090863e0966cbc76a136f09e80a15e0a9c7`
- expression: `0872798d7b01885c6be1d5eeaa20b7545f3eaf97035f2b4d736504730593205e`
- result: `8a5d27e55c85bf4497c570d41a97235baaa2e33c5b1f96c4025913b31b1ddc03`

The final Linux Avalonia artifact records these raw frame-pixel hashes:

- initial: `f571229cda0a2a0246f7547c7a51b9a84e32292e654370e9397c746dc85febf6`
- expression: `9b88644064f308c82d59c6708b4a7a2f2af5642537838aca0a7b3104f6c03f37`
- result: `48f78249b9008405b0704a78100565481d50ff2050bec5e3764d11433234d8f5`

Its `verification.json` reports `framework = Avalonia`, `managedDotnet = true`, `inputRoundTrip = true`, `expected = actual = 19`, `changed = true`, and `pass = true`. The 420×640 RGBA8 initial, expression, and result PNGs were also opened and visually inspected. The portable workflow separately proves private SDK provisioning, real C# execution, exact frame bytes, Node pointer input, changed C# state, changed pixels, the packed CLI, and a clean consumer project on all three hosted operating systems.

## Observed 0.3.1 closeout evidence — 2026-08-22

The closeout sandbox had Node.js 22 and TypeScript available, but no usable local `dotnet` executable and no external package network suitable for real SDK/NuGet/Avalonia acceptance.

Observed locally:

| Gate | Result |
| --- | --- |
| Focused closeout regression suite | PASS — 30/30 |
| Reconstructed local candidate `npm test` subset | PASS — 22/22 |
| Reconstructed local candidate `npm run check` | PASS |
| TypeScript declaration compile (`tsc --noEmit`) | PASS |
| `nodenet --version` | PASS — `NodeNET 0.3.1` |
| `nodenet --help` / `nodenet build --help` | PASS without .NET provisioning |
| `npm pack --dry-run` | PASS using a writable temporary npm cache |
| packed tarball install in a separate consumer project | PASS |
| packed CLI `--version` / `--help` | PASS |
| packed package-root ESM import | PASS |
| real private .NET provisioning/build/run in this sandbox | NOT RUN — no usable local .NET/network |
| real CLR bridge execution in this sandbox | NOT RUN — no usable local .NET |
| real Avalonia headless/render acceptance in this sandbox | NOT RUN — requires network-backed .NET/NuGet runner |

The local reconstruction was used to exercise the authored hardening paths and package boundary; it is not a substitute for the repository's complete Windows/macOS/Linux workflow suite. The live Git tree still contains the full historical unit, portable integration, and Avalonia acceptance tests, and those network-backed results must be reported separately when observable.

GitHub connector observation for the closeout push:

- branch/ref verification: PASS
- final implementation commit matched `main` at `0 ahead / 0 behind` before this evidence-only documentation update
- push-triggered combined status list: no statuses exposed by the connector
- commit workflow-run lookup: no runs exposed by the connector

An empty connector result is **not** treated as a successful CI result.

## Current sandbox limitation

The current ChatGPT sandbox provisioned the exact private .NET SDK `10.0.400` through NodeNET and completed the fixture's locked NuGet restores. Its policy broker terminated managed compiler child execution before approval could complete, so this environment cannot supply new C# build/runtime evidence. The push-triggered GitHub-hosted matrices must provide that proof, and the visible desktop gate remains reserved for the clean Mac report. These limitations are recorded as unavailable evidence, never inferred passes.
