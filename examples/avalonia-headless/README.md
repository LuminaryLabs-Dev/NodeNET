# Avalonia acceptance

Avalonia is intentionally an integration acceptance target rather than a NodeNET dependency.

Run the opt-in integration test with network access:

```bash
NODENET_INTEGRATION=1 NODENET_AVALONIA=1 npm run test:integration
```

The acceptance test forces `isolation: managed`, provisions the .NET SDK through NodeNET, installs `Avalonia.Templates` and `Avalonia.Headless`, and creates a real calculator. Node sends pointer events through DisplayService, Avalonia updates C# state to `19`, and the adapter submits initial/result RGBA8 frames for PNG evidence without making Avalonia a core dependency.
