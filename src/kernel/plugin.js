export function definePlugin(spec) {
  if (!spec || typeof spec !== 'object') throw new TypeError('A NodeNET plugin must be an object.');
  if (!spec.name || typeof spec.name !== 'string') throw new TypeError('A NodeNET plugin requires a string name.');
  if (spec.provides && !Array.isArray(spec.provides)) throw new TypeError(`${spec.name}.provides must be an array.`);
  if (spec.requires && !Array.isArray(spec.requires)) throw new TypeError(`${spec.name}.requires must be an array.`);
  if (typeof spec.register !== 'function') throw new TypeError(`${spec.name} requires register(registry).`);
  return Object.freeze({
    provides: [],
    requires: [],
    replace: false,
    ...spec
  });
}
