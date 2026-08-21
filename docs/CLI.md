# NodeNET CLI

`nodenet` is designed to feel like `dotnet` in a Node environment.

## NodeNET-native commands

```text
nodenet info
nodenet prepare
nodenet restore
nodenet build
nodenet test
nodenet publish
nodenet clean
nodenet run
nodenet doctor
nodenet env
nodenet capabilities
nodenet cache
```

Native commands call the same NodeNET API used by JavaScript. They are not a parallel implementation.

The current directory is the default target. Use `--target <path>` (or `--project <path>`) to select another project. Common build flags include `-c/--configuration`, `-f/--framework`, `-r/--runtime`, `-o/--output`, and `--no-restore`. Use `--json` for machine-readable output.

## Transparent dotnet passthrough

Any command not owned by NodeNET is passed to the selected private/system `dotnet` unchanged after NodeNET prepares an SDK workspace.

```text
nodenet new console -o Hello
nodenet new install Avalonia.Templates
nodenet workload list
nodenet tool list
nodenet nuget list source
nodenet add package Example.Package
```

This is intentionally future-proof: new Microsoft CLI commands do not need to be reimplemented by NodeNET.

## Empty-directory bootstrap

An empty directory is a valid NodeNET workspace, so a Node-only machine can start with:

```text
npx nodenet new console -o Hello
cd Hello
npx nodenet run
```

If no compatible .NET SDK exists, NodeNET provisions one privately.
