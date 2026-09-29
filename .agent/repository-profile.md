# Repository profile

## Identity

- Owner: `LuminaryLabs-Dev`
- Repository: `NodeNET`
- Visibility: public
- Default branch: `main`
- Audit baseline: `862ca90ac08c65065c32b39670d67cb530df041a`
- Baseline tree: `7a82e752b8f02e74719745cd28ff596b0af938bf`
- npm package: `@luminarylabs/nodenet`
- Baseline version: `0.3.2`
- Module type: ESM
- Node engine: `>=20`
- Package entry: `./src/index.js`
- Type declarations: `./types/index.d.ts`
- CLI entry: `./bin/nodenet.js`
- License: MIT

## Project type

NodeNET is simultaneously a Node.js library/package and CLI, a portable official-.NET environment/orchestration layer, a JS ↔ CLR interoperability system, and a framework-neutral display/input abstraction. The package deliberately delegates .NET runtime/toolchain semantics to Microsoft .NET.

## Root inventory

- `.github/` — issue/PR templates and hosted workflows
- `bin/` — executable CLI shim
- `bridge/` — C# bridge/display helpers
- `docs/` — canonical product and technical documentation
- `examples/` — live example applications and usage fixtures
- `scripts/` — test/check/evidence/release-candidate tooling
- `src/` — package implementation
- `test/` — unit, integration, and controlled fixtures
- `types/` — TypeScript declaration surface
- `package.json` / `package-lock.json` — package metadata and lock state
- `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md` — public project/release/policy documentation

## Source systems

Top-level implementation areas under `src/`:

- `cache.js` — cache management
- `cli/` — native CLI routing/commands
- `display/` — frame/input/PNG/process/raster/surface/validation primitives
- `dotnet/` — official .NET discovery/resolution/provisioning/environment/verification
- `errors.js` — typed NodeNET errors
- `host/` — host/platform detection
- `index.js` — public package exports
- `interop/` — CLR interoperability client/model/protocol/transport
- `kernel/` — service registry/plugin/context composition
- `nodenet.js` — primary `NodeNET` facade
- `plugins/` — provider/plugin implementations
- `process/` — child-process abstractions
- `project/` — project inspection/orchestration
- `services/` — service contracts/default capabilities
- `version.js` — package version access

## Public facade and exports

`src/index.js` exports `NodeNET`, errors, host detection, target inspection, plugin/kernel APIs, execution/display services, service contract helpers, interoperability exports, and the framework-neutral display primitives. `src/nodenet.js` is the main facade and currently provides attach/info/prepare/restore/build/test/publish/clean/run/exec/library/display/capabilities/doctor/environment/dispose behavior.

## Kernel and services

`src/kernel/` contains `context.js`, `plugin.js`, and `registry.js`. `ServiceRegistry` owns provider registration, conflict detection, plugin dependency validation, service contract validation, initialization, description, and reverse-order disposal.

`src/services/` contains `capabilities.js`, `contracts.js`, `display.js`, `environment.js`, `execution.js`, `host.js`, `interop.js`, `names.js`, and `project.js`. Known contracts are validated before work begins. Current required service methods include host `detect`, environment `ensure`, execution `exec`/`spawn` plus `kind`/`sandboxed`, project orchestration methods, interop `openLibrary`, display `capabilities`/`createSurface`, and capabilities `snapshot`.

## .NET environment layer

`src/dotnet/` contains `archive.js`, `cli.js`, `discover.js`, `environment.js`, `provision.js`, `resolve.js`, and `verify.js`. The layer is responsible for host-compatible .NET discovery, compatibility selection, managed/private official artifact acquisition, SHA-512 integrity verification, extraction/staging, executable verification, and child environment construction. Resolution honors explicit hosts, managed environments, system .NET, and private provisioning according to isolation policy.

## Interoperability

`src/interop/` contains `index.js`, `library.js`, and the `model/`, `protocol/`, and `transport/` subtrees. `bridge/NodeNET.Bridge/` contains the C# bridge (`Invocation.cs`, `ObjectTable.cs`, `Program.cs`, `Protocol.cs`, project file). Canonical interop semantics and current limitations live in `docs/INTEROP.md` and `docs/CURRENT_STATE.md`.

## Display

`src/display/` contains `frame.js`, `input.js`, `png.js`, `process-adapter.js`, `rasterizer.js`, `surface.js`, and `validation.js`. `bridge/NodeNET.Display/` supplies the C# display helper. NodeNET owns a framework-neutral RGBA8 frame/input boundary; framework rendering remains above core. Canonical details live in `docs/DISPLAY.md`.

## Tests and fixtures

`test/` is divided into `unit/`, `integration/`, and `fixtures/`. Unit coverage includes archive/cache behavior, capabilities, CLI metadata/routing, diagnostics, display/process behavior, examples, execution service, framing, target inspection, interop signatures, kernel/service contracts, platform paths, preparation, process/progress, local provisioning, resolution, trust boundaries, and validation artifacts.

Current integration entrypoints are:

- `test/integration/portable.test.mjs`
- `test/integration/avalonia.test.mjs`

Fixtures include console/library/multi-project/broken-build/global-json/fake-dotnet/display process and the version-locked Avalonia runtime projects.

## Hosted workflows

`.github/workflows/` contains:

- `ci.yml`
- `integration.yml`
- `framework.yml`

These provide hosted evidence tiers; the exact historical results and acceptance semantics are recorded in `docs/VALIDATION.md`.

## Examples

The repository includes live examples such as `portable-console`, `library-invoke`, `display-calculator`, `framebuffer-paint`, `keyboard-notepad`, `image-filter-lab`, `self-contained-app`, and `avalonia-headless`. The public example commands in `package.json` currently cover Paint, Notepad, Filters, Studio, and full example validation. Generated evidence under `artifacts/examples/` is intentionally ignored.

## Validation classification

Keep these states distinct in all future documentation and closeout reports:

- implemented in source
- covered by deterministic unit/static tests
- exercised locally
- exercised by hosted CI
- requires network-backed official .NET/NuGet access
- requires a real .NET runtime/SDK
- requires Avalonia/framework acceptance
- requires host/architecture-specific evidence
- implemented but not continuously validated

At the audit baseline, hosted Windows/macOS/Linux evidence is documented for the 0.3.2 closeout. ARM/musl identities are implemented but must not be described as continuously validated without matching runs.
