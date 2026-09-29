# Maintainer memory

Durable repository facts and lessons that future maintainers should not need to rediscover. Revalidate against current source when the repository materially changes.

## Architecture

- NodeNET is an orchestration/interoperability layer over official .NET, not an alternate .NET implementation.
- `src/nodenet.js` is the primary facade; both the JavaScript API and CLI route toward the same underlying services.
- The service kernel is intentionally small. `ServiceRegistry` validates provider composition and known service contracts before initialization.
- Local execution is shell-free but explicitly unsandboxed.
- CLR interop remains out-of-process by design.
- DisplayService uses a framework-neutral owned RGBA8 frame/input contract; framework rendering sits above core.

## Provisioning and environment

- Managed/private provisioning uses official .NET artifacts.
- Artifact integrity verification is a security and correctness boundary; do not bypass it.
- Managed environment variables and paths are scoped to child processes rather than installed globally.
- NodeNET deliberately does not invoke `apt`, `brew`, `dnf`, `choco`, or equivalent OS package managers automatically.
- A private .NET SDK/runtime does not guarantee every framework's native dependencies are present.

## Runtime resolution

Conceptually, automatic resolution prefers:

1. an explicit `dotnetPath` when supplied
2. a compatible NodeNET-managed environment when allowed
3. a compatible system `dotnet` when allowed
4. private official SDK/runtime provisioning when needed by preparation

`isolation: 'managed'` forbids using system .NET; `isolation: 'system'` forbids private managed resolution/provisioning.

## Interop memory

The current model is organized around:

- Values
- Handles
- Descriptors

Current documented operation families include `describe`, `construct`, `call`, `get`, `set`, `dispose`, `stream.read`, and `stream.write`. Compatibility `library.invoke()` remains available. Persistent CLR objects and streams have explicit remote lifetimes. See `docs/INTEROP.md` for canonical protocol semantics and current limitations.

## Display memory

- Default display provider: `software-framebuffer`.
- Canonical V1 frame representation: RGBA8 with the frame/layout constraints defined in `src/display/frame.js` and `docs/DISPLAY.md`.
- `DisplayValidationHarness` composes evidence operations above the core display contract.
- `bridge/NodeNET.Display` provides a framework-neutral C# process helper.
- Avalonia acceptance proves the same boundary with real framework controls/rendering; Avalonia must remain above core.
- Frame validation guards format, dimensions, stride/payload correctness, and allocation limits.

## Host identities

Implemented identities documented at the audit baseline:

- `win-x64`
- `win-arm64`
- `osx-x64`
- `osx-arm64`
- `linux-x64`
- `linux-arm64`
- `linux-musl-x64`
- `linux-musl-arm64`

Implementation support is not the same as continuous validation. `docs/VALIDATION.md` records hosted evidence for Windows, macOS, and Linux; ARM/musl require matching execution before they can be promoted to validated.

## Validation lessons

- Never turn source presence into runtime proof.
- Never turn a passing Node/unit gate into managed-.NET provisioning or real CLR bridge proof.
- Never turn configuration for a RID/framework into host acceptance.
- Network-backed SDK/NuGet/framework evidence must come from an environment that actually ran it.
- `npm pack --dry-run` and clean packed-consumer tests protect the published package boundary; importing directly from the source tree is not equivalent.
- `bin/nodenet.js` is executable on non-Windows hosts and that bit is part of release validation.

## Historical traps to avoid

- Do not make Avalonia a core dependency because it is the first real display framework acceptance fixture.
- Do not weaken the `trust: 'untrusted'` rejection just to make an unsandboxed workload run.
- Do not add remote/container execution simply because the provider architecture makes it possible.
- Do not conflate root `CHANGELOG.md` (product release history) with `.agent/change-log.md` (maintainer/documentation continuity).
- Do not duplicate canonical technical docs in `.agent/`; route to them.
- Do not claim that all implemented ARM/musl hosts are continuously tested.
