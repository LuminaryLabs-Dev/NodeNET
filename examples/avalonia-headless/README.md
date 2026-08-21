# Avalonia acceptance

Avalonia is intentionally an integration acceptance target rather than a NodeNET dependency.

Run the opt-in integration test with network access:

```bash
NODENET_INTEGRATION=1 NODENET_AVALONIA=1 npm run test:integration
```

The acceptance test forces `isolation: managed`, provisions the .NET SDK through NodeNET, installs `Avalonia.Templates`, creates an Avalonia application, restores it, and builds it. A future framework-specific acceptance can add Avalonia's headless rendering package without changing NodeNET core architecture.
