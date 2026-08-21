# Security

NodeNET can download executables, compile source, load assemblies, and start native-capable .NET processes. It is not a sandbox.

## Trust boundaries

- Official .NET archives are selected from Microsoft release metadata and verified with the metadata SHA-512 value before extraction.
- Archive extraction rejects absolute paths and `..` traversal.
- NodeNET never invokes a shell for normal process execution.
- NodeNET only mutates its managed directories and optional project `.nodenet/state.json`.
- Machine/user PATH and registry state are not modified.
- OS package managers are not invoked automatically.

## Untrusted projects

Treat `prepare()`, `build()`, `test()`, `run()`, and library invocation against untrusted source/binaries as code execution. MSBuild targets, test assemblies, application code, and library initializers may execute arbitrary host actions.

Use an OS/container sandbox when the target is not trusted.

## RPC bridge

The bridge is intended for trusted assemblies. It exposes public method invocation by reflection and does not enforce an application security policy. Keep it out-of-process so a bridge or target-library crash does not directly corrupt the controlling Node process.
