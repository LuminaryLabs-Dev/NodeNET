# Start here

NodeNET lets Node.js code and terminal users provision, control, execute, and interoperate with official .NET without replacing .NET itself. The package exposes an ESM JavaScript API and the `nodenet` CLI; both converge on the same service-kernel architecture.

## Repository snapshot

- Repository: `LuminaryLabs-Dev/NodeNET`
- Default branch: `main`
- Documentation audit baseline: `862ca90ac08c65065c32b39670d67cb530df041a`
- Package: `@luminarylabs/nodenet`
- Version at the audit baseline: `0.3.2`
- Status: Developer Preview
- Node engine: `>=20`
- License: MIT
- Upkeep pass: `MNT-358`

The baseline above is the source state inspected for this documentation pass. The commit that introduces this `.agent/` package is the documentation head; use Git history and Upkeep for its exact SHA.

## Immediate architecture map

```text
src/index.js
    ↓
src/nodenet.js
    ↓
service kernel
    ↓
services / providers
    ↓
official .NET
```

## Repository map

- `src/cli/` — CLI implementation
- `src/dotnet/` — SDK/runtime discovery, resolution, provisioning, environment construction, verification
- `src/kernel/` — provider registry and plugin composition
- `src/services/` — service contracts and default service implementations
- `src/interop/` — Node-side JS ↔ CLR bridge client/protocol/model/transport
- `src/display/` — framebuffer, input, PNG, process adapter, rasterizer, surface, validation
- `bridge/NodeNET.Bridge/` — C# CLR bridge process
- `bridge/NodeNET.Display/` — framework-neutral C# display helper
- `bin/` — executable CLI shim
- `test/unit/` — deterministic unit/regression coverage
- `test/integration/` — portable .NET and Avalonia acceptance
- `test/fixtures/` — controlled .NET/framework fixtures
- `examples/` — working usage/display examples
- `types/` — TypeScript declarations
- `scripts/` — checks, tests, evidence generation, local validation
- `docs/` — canonical technical/product documentation
- `.github/workflows/` — hosted CI/integration/framework validation

## If you are changing…

| Area | Read first |
| --- | --- |
| CLI | `docs/CLI.md` |
| kernel/services | `docs/ARCHITECTURE.md` |
| SDK/runtime provisioning | `docs/PORTABILITY.md` |
| CLR bridge/interoperability | `docs/INTEROP.md` |
| display/input/framebuffer | `docs/DISPLAY.md` |
| trust/security | `SECURITY.md`, `docs/SECURITY.md` |
| release/acceptance evidence | `docs/VALIDATION.md` |
| public API stability | `docs/API-STABILITY.md` |
| current capabilities/limits | `docs/CURRENT_STATE.md` |
| future scope | `docs/ROADMAP.md` |

## Immediate warnings

- NodeNET is not a sandbox.
- A managed/private .NET SDK does not automatically satisfy OS-native framework dependencies.
- An implemented runtime identifier is not the same as a continuously validated host.
- Avalonia is an acceptance/framework layer above NodeNET, not a core dependency.
- Static and unit tests do not prove network-backed SDK provisioning, real CLR bridge execution, Avalonia rendering, GUI behavior, or a host architecture that did not actually run.

Continue with `.agent/repository-profile.md` for the audited inventory, then `.agent/workflow.md` before editing.
