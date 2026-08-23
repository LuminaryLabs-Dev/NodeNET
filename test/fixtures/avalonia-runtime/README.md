# Permanent Avalonia runtime fixture

This fixture is a live acceptance workload, not the NodeNET product and not a golden-image test.

- `Calculator.Shared` owns the calculator state, AXAML window, and real controls.
- `Calculator.Headless` renders that window through Avalonia Headless, compiles the canonical `bridge/NodeNET.Display/NodeNETDisplay.cs` helper source, exposes frames through `NodeNET.Display`, and accepts NodeNET pointer input.
- `Calculator.App` opens the same shared window through Avalonia Desktop for manual local confirmation.
- `global.json` pins the private SDK to `10.0.400` with roll-forward disabled.
- Every direct Avalonia package is pinned to `12.1.1`. The root aggregate and each project use NuGet lock files, and validation restores them in locked mode.

The headless acceptance asserts semantic state and changed RGBA8 pixels. It intentionally does not compare the complete screenshot to a single fixed hash because host font and renderer details may vary.

From the repository root, run:

```bash
npm run validate:local
npm run validate:local:visible
```

For the visible gate, click `1`, `2`, `+`, `7`, `=`, confirm the display reads `19`, and close the window. The command records the observed C# state in the local validation report.
