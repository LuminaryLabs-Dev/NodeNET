# API stability

NodeNET is a Developer Preview.

## Stable-direction facade

These APIs are intended to remain the primary product surface:

```text
NodeNET.attach()
prepare()
restore()
build()
test()
publish()
clean()
run()
exec()
library()
display()
capabilities()
doctor()
environment()
dispose()
```

## Developer-preview

The following may evolve before `1.0`:

- plugin/service provider contracts
- CLR object/type/stream handles
- protocol-specific APIs
- capability report schemas
- custom execution providers
- low-level `Frame`, `FrameSurface`, rasterizer, process-display adapter, and display-validation harness APIs

## Internal

Archive extraction, bridge build internals, release-metadata parsing, and low-level resolution helpers are implementation details unless explicitly exported from the package root.
