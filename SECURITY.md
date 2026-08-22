# Security Policy

NodeNET is an orchestration and interoperability layer, not a security sandbox.

Building, testing, running, or loading untrusted .NET code can execute arbitrary native-capable code with the privileges of the selected execution provider. The default local provider is explicitly unsandboxed. NodeNET rejects `trust: 'untrusted'` unless a replacement execution provider declares a real sandbox boundary.

For the technical threat model, see `docs/SECURITY.md`.

Please report suspected vulnerabilities privately to the repository maintainers rather than opening a public exploit report. Include the affected NodeNET version, host platform, reproduction steps, and impact.
