# Portability

“Portable” means NodeNET can establish a private .NET environment without requiring a global .NET installation. It does not mean one binary can run on every OS/CPU.

## Supported host identities

- `win-x64`
- `win-arm64`
- `osx-x64`
- `osx-arm64`
- `linux-x64`
- `linux-arm64`
- `linux-musl-x64`
- `linux-musl-arm64`

NodeNET maps supported Node host combinations to explicit portable .NET RIDs rather than constructing arbitrary RIDs.

## Environment modes

### shared

`~/.nodenet` (or `NODENET_HOME`) stores versioned managed roots and caches reusable across projects.

### local

`<project>/.nodenet` contains the runtime root and caches for a project-attached environment.

### temporary

An OS temporary directory contains the entire managed environment and is deleted by `dispose()`.

## Provisioning invariants

1. no machine-wide PATH changes
2. no registry changes
3. no package-manager installation
4. official release metadata selects the artifact
5. SHA-512 is verified before extraction
6. extraction rejects absolute/path-traversal entries
7. installation occurs under a lock
8. a versioned root is staged and verified before activation
9. `dotnet --info`, `--list-sdks`, and `--list-runtimes` establish readiness

NodeNET includes built-in `.tar.gz` and `.zip` extraction so normal provisioning does not require Bash, PowerShell, `tar`, or an external unzip tool.

## Native dependencies

Private .NET extraction does not supply every OS-native dependency a framework may require. NodeNET reports host/GUI capability and workload gaps but does not run `apt`, `brew`, `dnf`, `choco`, or similar package managers.

For GUI frameworks, “can build”, “can execute CoreCLR”, and “has a desktop display” are separate capabilities. Linux environments without `DISPLAY`/`WAYLAND_DISPLAY` are reported as non-desktop while remaining suitable for framework-specific headless execution.
