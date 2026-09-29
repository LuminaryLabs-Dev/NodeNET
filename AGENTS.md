# NodeNET agent operating contract

NodeNET is a Node.js-native orchestration and interoperability layer over official .NET. This file is the repository operating contract for agents and maintainers. Product behavior, architecture, validation, security, and release facts remain authoritative in the existing root and `docs/` documentation; `.agent/` exists to make those authorities discoverable and preserve maintainer continuity.

## Read order

1. `AGENTS.md`
2. `.agent/start-here.md`
3. `.agent/repository-profile.md`
4. `.agent/memory.md`
5. `.agent/workflow.md`
6. `docs/CURRENT_STATE.md`
7. the specialist document for the subsystem being changed

## Architectural invariants

- Keep `NodeNET.attach()` and the `nodenet` CLI as two surfaces over the same service-backed behavior.
- NodeNET orchestrates official .NET; it does not reimplement CoreCLR, the JIT, GC, BCL, Roslyn, MSBuild, NuGet resolution, workloads, templates, C# semantics, or runtime behavior.
- Keep the public facade and kernel small. Put platform- or framework-specific behavior behind service/provider/plugin boundaries.
- The default local execution provider is shell-free but explicitly unsandboxed. Never describe local child-process execution as isolation.
- `trust: 'untrusted'` must continue to require an execution provider that declares a real sandbox boundary with `sandboxed === true`.
- Do not weaken official artifact integrity verification or silently bypass SDK/runtime compatibility checks.
- Do not install or invoke OS package managers automatically. A private .NET archive does not guarantee every native framework dependency.
- Keep framework integrations such as Avalonia above the NodeNET core unless the capability is genuinely framework-neutral.

## High-impact boundaries

Changes under these areas require matching regression evidence and documentation review:

- `src/kernel/` — provider registry and composition
- `src/services/` — stable service contracts/default services
- `src/dotnet/` — discovery, resolution, provisioning, verification, and child environments
- `src/interop/` and `bridge/NodeNET.Bridge/` — JS ↔ CLR protocol and object/stream lifetime
- `src/display/` and `bridge/NodeNET.Display/` — frame/input/display contracts
- `types/` — public TypeScript surface
- `bin/` and `src/cli/` — CLI behavior

## Validation floor

For behavioral changes, add or update regression coverage. The deterministic floor is:

```bash
npm test
npm run check
npm run test:display
npm pack --dry-run
```

Use stronger gates when the affected behavior requires them:

- portable .NET integration: `NODENET_INTEGRATION=1 npm run test:integration`
- Avalonia acceptance: `NODENET_AVALONIA=1 npm run test:avalonia`
- complete local production validation: `npm run validate:local`
- macOS visible window gate: `npm run validate:local:visible`

Do not promote static/unit evidence into managed-.NET, framework, host, GUI, or device proof.

## Generated and local-only state

Treat generated evidence and managed runtime state as outputs, not source authority. Important examples include `artifacts/`, project or shared `.nodenet/` state, temporary managed SDK roots, npm tarballs, caches, and local validation bundles. Respect `.gitignore` and the package `files` allow-list.

## Version and release alignment

When a change affects the published package or public version, reconcile the applicable version-bearing and release surfaces, including `package.json`, `package-lock.json`, `src/version.js`, CLI output, `CHANGELOG.md`, and canonical state/release documentation. Do not change versions as part of unrelated work.

## Canonical documentation

- current product state: `docs/CURRENT_STATE.md`
- architecture: `docs/ARCHITECTURE.md`
- CLI: `docs/CLI.md`
- CLR interoperability: `docs/INTEROP.md`
- display: `docs/DISPLAY.md`
- validation: `docs/VALIDATION.md`
- portability: `docs/PORTABILITY.md`
- security: `SECURITY.md` and `docs/SECURITY.md`
- API stability: `docs/API-STABILITY.md`
- errors: `docs/ERRORS.md`
- future work: `docs/ROADMAP.md`
- product release history: `CHANGELOG.md`
- contribution rules: `CONTRIBUTING.md`

## Scope discipline

Record newly discovered work in `.agent/feedback.md` when it is outside the authorized task. Do not turn observations into implementation scope without explicit authorization.
