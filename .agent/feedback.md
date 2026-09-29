# Feedback and deferred observations

This file records evidence-backed limitations, risks, and opportunities without silently turning them into implementation scope. Canonical future sequencing remains in `docs/ROADMAP.md`; canonical current state remains in `docs/CURRENT_STATE.md`.

## Entry format

Each future entry should record:

- ID
- type
- evidence
- observation
- impact
- suggested future action
- status

## Current observations

### FB-001 — Developer Preview surface

- Type: status
- Evidence: `README.md`, `docs/CURRENT_STATE.md`, `package.json`
- Observation: the package is currently `0.3.2` and described as Developer Preview.
- Impact: API/provider/interop behavior still has documented preview boundaries.
- Suggested future action: follow the explicit API-stability and roadmap documents when changing public surfaces.
- Status: informational

### FB-002 — Local execution is not sandboxed

- Type: security boundary
- Evidence: `src/nodenet.js`, `src/services/contracts.js`, `SECURITY.md`, `docs/SECURITY.md`
- Observation: the default local executor is intentionally unsandboxed and untrusted workloads are rejected without a genuinely sandboxed provider.
- Impact: weakening the gate would create a false isolation claim.
- Suggested future action: only add untrusted execution through an explicitly sandboxed provider.
- Status: required invariant

### FB-003 — Bidirectional CLR interoperability is future work

- Type: capability gap
- Evidence: `docs/CURRENT_STATE.md`, `docs/ROADMAP.md`
- Observation: callbacks/delegates, event subscriptions, cancellation mapping, richer method semantics, protocol negotiation, and explicit concurrency are outside the current 0.3.x capability set.
- Impact: consumers cannot assume those features exist because values/handles/streams already work.
- Suggested future action: treat the documented `0.4.0` line as the bounded feature phase.
- Status: recommended later

### FB-004 — ARM/musl evidence remains separate

- Type: validation gap
- Evidence: `docs/CURRENT_STATE.md`, `docs/VALIDATION.md`
- Observation: ARM64 and musl RIDs are implemented, but the repository explicitly separates implementation from continuous matching-run validation.
- Impact: support claims can overstate actual acceptance coverage.
- Suggested future action: add matching-run evidence before promoting those hosts to continuously validated.
- Status: blocked pending matching environment/evidence

### FB-005 — Native framework dependencies remain external

- Type: portability limitation
- Evidence: `README.md`, `docs/PORTABILITY.md`
- Observation: private official .NET provisioning does not install every OS-native dependency required by frameworks.
- Impact: a valid managed SDK/runtime may still be insufficient for a framework workload.
- Suggested future action: keep native dependency checks/framework guidance explicit rather than auto-installing OS packages.
- Status: informational

### FB-006 — DisplayService V1 is intentionally bounded

- Type: capability boundary
- Evidence: `docs/CURRENT_STATE.md`, `docs/DISPLAY.md`
- Observation: V1 does not claim WPF/WinForms adapters, GPU APIs, font shaping, shared memory, or remote display.
- Impact: generic display growth should not be confused with framework-specific or high-performance transport work.
- Suggested future action: extend only through separately scoped, evidence-backed milestones.
- Status: recommended later

## Current milestone opportunities

- close the remaining `0.3.2` release-candidate gates described by canonical state/validation docs
- use `0.3.3` for maintenance work
- use `0.4.0` for bidirectional CLR interoperability

These are references to existing repository direction, not authorization to implement them.
