# Framebuffer Paint

A live, dependency-free NodeNET DisplayService painting example. It receives normalized pointer events through `FrameSurface`, retains strokes as application state, redraws the software framebuffer, and captures fresh PNG evidence.

```bash
npm run example:paint
```

The scripted run selects brushes, draws two continuous strokes, uses Undo, clears the canvas, and writes screenshots plus `verification.json` under `artifacts/examples/framebuffer-paint/`.

This example intentionally supports one pointer and does not model pressure or multitouch.
