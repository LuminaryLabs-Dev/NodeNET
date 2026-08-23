# NodeNET Examples

These examples are live DisplayService applications. Each one receives normalized input through `FrameSurface`, changes application state, renders a fresh RGBA8 frame, and writes screenshots plus machine-readable verification evidence.

| Example | Demonstrates | Command |
| --- | --- | --- |
| [Framebuffer Paint](framebuffer-paint/) | Continuous pointer drawing, retained strokes, Undo and Clear | `npm run example:paint` |
| [Keyboard Notepad](keyboard-notepad/) | Focused text input, caret editing and multiline state | `npm run example:notepad` |
| [Image Filter Lab](image-filter-lab/) | RGBA filters, frame ownership, blitting and slider input | `npm run example:filters` |
| [Self-Contained App](self-contained-app/) | NodeNET Studio navigation and persistent multi-screen state | `npm run example:studio` |

Run the complete suite:

```bash
npm run validate:examples
```

Generated evidence is written under `artifacts/examples/` and is intentionally ignored by Git. Screenshots are created from live scenarios; they are not checked-in golden test inputs.

The `_shared` directory is a small example-only runtime, not a public NodeNET UI toolkit.
