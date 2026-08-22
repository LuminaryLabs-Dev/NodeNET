# Changelog

## 0.3.1 — Developer Preview

- Added first-class `nodenet --help`, `nodenet --version`, and command help.
- Preserved unknown native `dotnet` flags instead of swallowing them.
- Added human provisioning progress for private .NET acquisition.
- Expanded `nodenet cache` with `info`, `list`, `prune`, and `clear`.
- Added TypeScript declarations and public package metadata.
- Added service-contract validation and an explicit trusted/untrusted execution gate.
- Exposed deterministic CLR method signatures through the JavaScript interop API.
- Added contributor, security, conduct, issue, and release documentation.

## 0.3.0 — Developer Preview

- Added the Node-native CLI facade and transparent `dotnet` passthrough.
- Introduced service/plugin composition for host, environment, execution, project, interop, and capabilities.
- Added persistent CLR object handles, descriptors, binary-safe framing, raw byte transfer, and remote streams.
- Added portable .NET and Avalonia acceptance workflows.
