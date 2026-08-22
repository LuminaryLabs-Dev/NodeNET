# NodeNET security model

NodeNET can download official executables, compile source, restore packages, load assemblies, and start native-capable processes. It is not a sandbox.

## Default local execution

`LocalExecutionService` launches shell-free child processes with the privileges of the Node process. Shell-free spawning reduces quoting/shell-injection risk but does not isolate code.

Treat prepare/build/test/run/library invocation against untrusted source or assemblies as arbitrary code execution.

## Explicit trust gate

`NodeNET.attach(target, { trust: 'trusted' })` is the default.

`trust: 'untrusted'` requires the selected execution service to declare `sandboxed: true`. The default local executor therefore cannot be used for explicitly untrusted workloads. This prevents an API caller from accidentally treating process isolation as a security sandbox.

A provider declaring `sandboxed: true` is responsible for implementing and documenting the actual OS/container/remote isolation boundary.

## Provisioning integrity

Official .NET artifacts are selected from Microsoft release metadata and verified with the published SHA-512 hash before installation. Local offline artifacts also require an expected hash.

## Bridge boundary

The CLR bridge is out-of-process, but it is intended for trusted assemblies unless the entire execution provider is externally sandboxed. Reflection restrictions are not an application security policy.
