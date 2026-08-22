# Changelog

## 0.3.2 — Developer Preview

- Added a validated `display` service with lazy RGBA8 `Frame` and `FrameSurface` contracts.
- Added a zero-dependency software rasterizer, normalized pointer/keyboard input, and deterministic PNG export.
- Added `NodeNET.display()`, replaceable display providers, TypeScript declarations, and display capability reporting.
- Added binary process-frame transport and the framework-neutral `NodeNET.Display` C# helper.
- Added deterministic software, managed-.NET, and real Avalonia calculator acceptance paths for `12 + 7 = 19`.
- Added screenshot artifacts to software and Avalonia CI validation.
- Repaired truncated CLI source files that prevented the existing `0.3.1` unit/static gate from completing.

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
