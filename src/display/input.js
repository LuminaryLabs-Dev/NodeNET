const POINTER_TYPES = new Set(['move', 'down', 'up', 'click']);
const KEY_TYPES = new Set(['down', 'up', 'text']);

function modifiers(value = {}) {
  return Object.freeze({
    alt: value.alt === true,
    control: value.control === true,
    meta: value.meta === true,
    shift: value.shift === true
  });
}

export function normalizePointerEvent(event = {}) {
  if (!POINTER_TYPES.has(event.type)) throw new TypeError(`Unsupported pointer event type: ${event.type}`);
  if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) throw new TypeError('Pointer coordinates must be finite numbers.');
  const button = event.button ?? 0;
  if (!Number.isInteger(button) || button < 0 || button > 4) throw new RangeError('Pointer button must be an integer from 0 through 4.');
  return Object.freeze({
    type: event.type,
    x: event.x,
    y: event.y,
    button,
    modifiers: modifiers(event.modifiers)
  });
}

export function normalizeKeyEvent(event = {}) {
  if (!KEY_TYPES.has(event.type)) throw new TypeError(`Unsupported key event type: ${event.type}`);
  const key = event.key ?? '';
  const code = event.code ?? '';
  if (typeof key !== 'string' || typeof code !== 'string') throw new TypeError('Keyboard key and code must be strings.');
  if (event.type === 'text' && !key) throw new TypeError('Text input requires a non-empty key value.');
  return Object.freeze({ type: event.type, key, code, modifiers: modifiers(event.modifiers) });
}
