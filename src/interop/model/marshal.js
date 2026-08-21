function walk(value, chunks, offsetRef) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    const buffer = Buffer.from(value);
    const descriptor = { $binary: { offset: offsetRef.value, length: buffer.length } };
    chunks.push(buffer);
    offsetRef.value += buffer.length;
    return descriptor;
  }
  if (Array.isArray(value)) return value.map(item => walk(item, chunks, offsetRef));
  if (value && typeof value === 'object' && !('$handle' in value) && !('$stream' in value)) {
    const result = {};
    for (const [key, item] of Object.entries(value)) result[key] = walk(item, chunks, offsetRef);
    return result;
  }
  if (value?.$handle) return { $handle: value.$handle };
  if (value?.$stream) return { $stream: value.$stream };
  return value;
}

export function marshalArguments(args = []) {
  const chunks = [];
  const offsetRef = { value: 0 };
  const arguments_ = args.map(value => walk(value, chunks, offsetRef));
  return { arguments: arguments_, payload: chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0) };
}
