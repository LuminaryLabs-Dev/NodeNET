# Portability

“Portable” means NodeNET can establish and control a compatible .NET environment without requiring a machine-wide installation. It does not mean one compiled binary can run unchanged on every OS/CPU.

## Implemented host identities

- `win-x64`
- `win-arm64`
- `osx-x64`
- `osx-arm64`
- `linux-x64`
- `linux-arm64`
- `linux-musl-x64`
- `linux-musl-arm64`

NodeNET maps known Node host combinations to explicit official .NET RIDs rather than constructing arbitrary RIDs.

## Continuously tested vs implemented

The standard GitHub-hosted validation matrix continuously exercises Windows, macOS, and Linux. ARM and musl identities are implemented by the host/RID model but require separate ARM/container/self-hosted validation to claim continuous coverage.

Documentation and release notes should distinguish these two levels instead of treating an implemented RID as automatically proven.

## Why services improve portability

The public API asks for outcomes (`prepare`, `build`, `run`). Environment and execution details sit behind stable service contracts. A future container/remote provider can therefore change *where* a build runs without changing the application-facing NodeNET API.

The default remains deliberately small: local execution plus system/managed .NET resolution. Optional providers should only be added when a concrete deployment needs them.

## Environment modes

### shared

`~/.nodenet` or `NODENET_HOME` stores reusable versioned managed roots and caches.

### local

`<project>/.nodenet` contains project-local runtime/cache state.

### temporary

An OS temporary directory contains the managed environment and is removed by `dispose()`.

## Provisioning invariants

1. no machine-wide PATH changes
2. no registry changes
3. no automatic OS package-manager installation
4. official release metadata selects network artifacts
5. SHA-512 is verified before extraction
6. extraction rejects absolute/path-traversal entries
7. installation occurs under a lock
8. a versioned root is staged and verified before activation
9. `dotnet --info`, `--list-sdks`, and `--list-runtimes` establish readiness

NodeNET includes `.tar.gz` and `.zip` extraction so normal provisioning does not require Bash, PowerShell, `tar`, or an external unzip tool.

## Native dependencies

A private .NET archive does not supply every OS-native dependency a framework may require. NodeNET reports host/GUI capability and workload/native-asset evidence but does not run `apt`, `brew`, `dnf`, `choco`, or similar package managers.

For GUI frameworks, “can build”, “can execute CoreCLR”, and “has a desktop display” remain separate capabilities.
