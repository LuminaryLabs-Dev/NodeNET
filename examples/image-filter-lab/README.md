# Image Filter Lab

A live NodeNET DisplayService image-processing example. It generates a deterministic RGBA source, applies filters to owned `Frame` copies, composites previews with `blit`, and changes filters through normalized pointer input.

```bash
npm run example:filters
```

The run validates Original, Invert, Grayscale, two Threshold settings, and Sepia. It proves source bytes and alpha remain unchanged and writes screenshots plus a contact sheet under `artifacts/examples/image-filter-lab/`.

Image decoding and external assets are intentionally outside this dependency-free example.
