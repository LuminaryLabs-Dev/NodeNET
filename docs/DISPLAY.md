# DisplayService

DisplayService is NodeNET's framework-neutral boundary for graphical workloads. NodeNET owns raw frames, surface lifecycle, input normalization, and transport. Avalonia, Skia, virtual desktops, and future framework adapters remain responsible for producing sophisticated pixels.

```text
NodeNET
  -> DisplayService
  -> FrameSurface
  -> RGBA8 Frame
  -> capture / PNG / input
```

## Software surface

The default provider is zero-dependency, headless, and lazy. Creating a surface does not allocate a framebuffer until a frame or rasterizer is requested.

```js
import { NodeNET, savePng } from '@luminarylabs/nodenet';

const app = await NodeNET.attach('.');
const surface = await app.display({ width: 420, height: 640 });
const draw = surface.rasterizer();

draw.clear([8, 13, 31, 255]);
draw.roundedRect(24, 24, 180, 64, 12, [67, 219, 218, 255]);
surface.present({ state: 'ready' });

await savePng(surface.capture(), 'frame.png');
await app.dispose();
```

V1 supports `clear`, `pixel`, `line`, filled and rounded rectangles, RGBA frame blitting, and deterministic bitmap text. It is a portable fallback and validation renderer, not a general UI toolkit.

## Contract

`Frame` is tightly constrained:

```text
width    positive integer
height   positive integer
stride   width * 4
format   rgba8
pixels   owned byte buffer
```

`FrameSurface` provides:

```text
submit / present / capture / resize / dispose
pointer / key
waitForReady / waitForFrame
```

`DisplayValidationHarness` stays above the surface contract. It sequences pointer/key actions, waits for resulting frames, writes named PNG captures, records SHA-256 hashes, and emits machine-readable verification evidence without adding testing semantics to `FrameSurface` itself.

Frames are capped at 256 MiB by default. Unsupported formats, padded strides, malformed payload lengths, and oversized allocations are rejected before allocation.

## Process and .NET adapter

A graphical child process uses the same versioned, binary-safe framing as NodeNET interop. Start it with binary stdout and attach the process to DisplayService:

```js
const process = await app.run({ binaryStdout: true });
const surface = await app.display({ process });

await surface.waitForReady();
await surface.pointer({ type: 'click', x: 120, y: 300, button: 0 });
const frame = surface.capture();
```

The shipped `bridge/NodeNET.Display` helper gives C# applications a small standard-I/O API for creating a surface, submitting RGBA8 frames, receiving input requests, and reporting state. It does not depend on Avalonia.

Protocol requests are `display.connect`, `display.pointer`, `display.key`, `display.resize`, and `display.dispose`. Child processes emit `display.ready`, `display.frame`, and `display.state`; frame metadata stays in JSON while pixels remain a raw binary payload.

The Avalonia acceptance fixture owns the framework-specific work: headless startup, real control input, rendered-frame capture, BGRA/RGBA normalization, and submission into `FrameSurface`.

## Acceptance proof

The deterministic proof uses one scenario at both levels:

```text
click 1 -> click 2 -> click + -> click 7 -> click = -> 19
```

The software proof always runs without .NET or network access. The managed-.NET and real Avalonia proofs run in network-backed CI and upload the initial, expression, and result screenshots plus `verification.json`.

## Scope boundary

DisplayService V1 does not include WPF/WinForms adapters, GPU APIs, font shaping, CSS layout, shared memory, remote desktop, or an AI visual agent. Those remain future adapters or measured optimizations.
