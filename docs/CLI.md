# NodeNET CLI

`nodenet` is designed to feel like `dotnet` in a Node environment.

## Meta commands

```text
nodenet --help
nodenet --version
nodenet build --help
nodenet doctor --help
```

NodeNET-owned help is handled without preparing a .NET environment. A non-NodeNET command such as `nodenet workload --help` is passed through to the real `dotnet` CLI.

## NodeNET-native commands

```text
info
prepare
restore
build
test
publish
clean
run
doctor
env
capabilities
cache
```

Native commands call the same NodeNET API used by JavaScript.

The current directory is the default target. Use `--target <path>` or `--project <path>` to select another project/workspace.

## Transparent dotnet passthrough

Any command not owned by NodeNET is passed unchanged after NodeNET establishes an SDK workspace:

```text
nodenet new console -o Hello
nodenet new install Avalonia.Templates
nodenet workload list
nodenet tool list
nodenet nuget list source
```

For NodeNET-owned build/test/publish/restore/clean/run commands, NodeNET parses its own options and forwards unknown dotnet options rather than dropping them:

```text
nodenet build --verbosity diagnostic
```

`run` reserves arguments after `--` for the application.

## Provisioning progress

Human CLI sessions print private-SDK resolution/download/verification/extraction progress to stderr. `--json` suppresses human progress so final stdout remains valid JSON.

## Cache

```text
nodenet cache info
nodenet cache list
nodenet cache prune
nodenet cache clear
nodenet cache clear downloads
```

`prune` only removes stale download fragments, staging directories, and stale install locks. `clear` is explicit and may target one managed category.
