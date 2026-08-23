# Self-Contained App — NodeNET Studio

NodeNET Studio is a complete software-framebuffer application with Home, Canvas, Notes, Filters, and About screens on one `FrameSurface`. It demonstrates navigation, pointer and keyboard routing, persistent per-screen state, and live runtime evidence without .NET, external services, or downloaded assets.

```bash
npm run example:studio
```

The scripted run draws a stroke, types a note, selects a filter, revisits each workspace to prove state retention, uses a keyboard navigation shortcut, and writes fresh screenshots under `artifacts/examples/self-contained-app/`.

Here, “self-contained” describes the example folder and runtime dependencies. It does not mean a native OS package.
