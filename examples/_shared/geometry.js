export function clamp(value, minimum, maximum) {
  if (![value, minimum, maximum].every(Number.isFinite)) throw new TypeError('Clamp values must be finite numbers.');
  if (minimum > maximum) throw new RangeError('Clamp minimum cannot exceed maximum.');
  return Math.min(maximum, Math.max(minimum, value));
}

export function pointInRect(point, rectangle) {
  return point.x >= rectangle.x
    && point.x < rectangle.x + rectangle.width
    && point.y >= rectangle.y
    && point.y < rectangle.y + rectangle.height;
}

export function rectCenter(rectangle) {
  return Object.freeze({
    x: rectangle.x + rectangle.width / 2,
    y: rectangle.y + rectangle.height / 2
  });
}

export function valueFromHorizontalPosition(x, rectangle, minimum, maximum) {
  const ratio = clamp((x - rectangle.x) / rectangle.width, 0, 1);
  return minimum + ratio * (maximum - minimum);
}
