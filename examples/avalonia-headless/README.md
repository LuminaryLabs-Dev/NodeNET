# Avalonia acceptance

Avalonia is intentionally an integration acceptance target rather than a NodeNET dependency.

Run the permanent version-locked fixture with network access:

```bash
NODENET_AVALONIA=1 npm run test:avalonia
```

The acceptance test forces `isolation: managed`, provisions the exact pinned .NET SDK through NodeNET, restores committed NuGet lock graphs, and builds `test/fixtures/avalonia-runtime`. Node sends pointer events into real Avalonia controls through DisplayService, C# state reaches `19`, and the adapter submits initial/expression/result RGBA8 frames for PNG evidence without making Avalonia a core dependency.
