# Keyboard Notepad

A live NodeNET DisplayService text editor that uses normalized `FrameSurface.key` events, explicit focus, a deterministic caret, and a software-rendered multiline buffer.

```bash
npm run example:notepad
```

The scenario proves that text is ignored before focus, types `NodeNET`, edits a second line through Enter, Backspace and ArrowLeft, clears the document, and writes fresh screenshots under `artifacts/examples/keyboard-notepad/`.

Clipboard, selection, IME composition, persistence, and rich text are intentionally outside this focused example.
