# Security

NodeNET can download executables, compile source, load assemblies, and start native-capable .NET processes. **NodeNET is not a sandbox.**

## Trust boundaries

- Official .NET archives are selected from Microsoft release metadata and verified with the published SHA-512 value before extraction.
- Archive extraction rejects absolute paths and `..` traversal.
- Normal process execution is shell-free.
- Machine/user PATH and registry state are not modified.
- OS package managers are not invoked automatically.
- The CLR interoperability bridge runs out-of-process.

## Execution service

NodeNET 0.3 introduces an explicit execution-service boundary. The default local executor has the privileges of the Node process and reports `sandboxed: false`. This boundary is intended to permit separately implemented container or remote executors; merely selecting NodeNET does not make untrusted code safe.

## Untrusted projects

Treat `prepare()`, `restore()`, `build()`, `test()`, `run()`, arbitrary `exec()` commands, and library invocation against untrusted source/binaries as code execution. MSBuild targets, test assemblies, application code, native dependencies, and library initializers may perform arbitrary host actions.

Use a real OS/container isolation boundary when the target is untrusted.

## Bridge handles

The bridge is intended for trusted assemblies. Reflection operations can construct objects and invoke public members. Handles are scoped to the bridge process and are explicitly disposed or released when the bridge exits.
