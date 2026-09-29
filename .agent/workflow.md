# Maintainer workflow

Use this workflow for repository changes. `docs/VALIDATION.md` remains authoritative for release acceptance.

## Before editing

1. verify the exact repository, branch, and current `main` SHA
2. run or inspect `git status` when working from a local checkout
3. read `AGENTS.md` and `.agent/start-here.md`
4. read the specialist document for the subsystem being changed
5. inspect package/version state before public-package changes
6. keep generated evidence and managed SDK/cache state out of source control

## Dependency setup

Canonical clean dependency setup:

```bash
npm ci --ignore-scripts
```

## Deterministic floor

```bash
npm test
npm run check
npm run test:display
npm pack --dry-run
```

`npm run check` performs repository checks including JavaScript/MJS syntax and the unit test route. `npm test` explicitly runs the unit route. Keep the separate commands in documentation because they represent the public maintenance/release workflow.

## Network-backed portable integration

```bash
NODENET_INTEGRATION=1 npm run test:integration
```

This is the portable managed-.NET/integration tier. It must run in an environment with the required network and .NET/NuGet access.

## Avalonia acceptance

```bash
NODENET_AVALONIA=1 npm run test:avalonia
```

This is a framework acceptance tier above NodeNET core.

## Full local release-candidate validation

```bash
npm run validate:local
npm run validate:local:visible
```

`validate:local` writes auditable evidence under `artifacts/local-validation/`. `validate:local:visible` adds the real visible Avalonia window gate and requires human interaction/confirmation; do not report it as passed unless that interaction actually occurred.

## Example validation

```bash
npm run example:paint
npm run example:notepad
npm run example:filters
npm run example:studio
npm run validate:examples
```

Example screenshots/reports are generated under `artifacts/examples/` and are evidence outputs, not golden source inputs.

## Minimum validation by change type

| Change | Minimum evidence |
| --- | --- |
| documentation only | paths, links, commands, source claims, and documentation-only diff verification |
| CLI | unit/CLI routing plus `npm run check` |
| provisioning/resolution | unit coverage plus portable integration when behavior reaches real provisioning |
| kernel/service contract | contract/regression tests plus `npm run check` |
| interop/bridge | interop unit tests plus portable integration |
| display | unit/display proof plus process/framework evidence when applicable |
| Avalonia fixture/adapter | framework acceptance |
| public API/types/package | package audit, clean packed consumer, TypeScript declarations, appropriate runtime gates |
| release candidate | follow `docs/VALIDATION.md` completely |

## Closeout discipline

- review every changed path
- keep unrelated findings in `.agent/feedback.md`
- verify no generated/local state entered the diff
- preserve executable mode on `bin/nodenet.js`
- perform a fresh `main` race check before moving the branch
- use a normal fast-forward update; do not force-push routine maintenance
- after push, verify intended commit equals remote `main` and inspect CI when the task's evidence tier requires it
