import test from 'node:test';
import assert from 'node:assert/strict';
import { ServiceRegistry } from '../../src/kernel/registry.js';
import { definePlugin } from '../../src/kernel/plugin.js';
import { SERVICE } from '../../src/services/names.js';

function execution(id) {
  return {
    id,
    kind: id,
    sandboxed: false,
    async exec() { return { ok: true }; },
    spawn() { return {}; }
  };
}

test('service registry allows an explicit replacement provider', async () => {
  const registry = new ServiceRegistry();
  registry.register(definePlugin({ name: 'test.execution.one', provides: [SERVICE.EXECUTION], register(_registry, { provide }) { provide(SERVICE.EXECUTION, execution('one')); } }));
  registry.register(definePlugin({ name: 'test.execution.two', provides: [SERVICE.EXECUTION], replace: true, register(_registry, { provide }) { provide(SERVICE.EXECUTION, execution('two')); } }));
  await registry.initialize();
  assert.equal(registry.require(SERVICE.EXECUTION).id, 'two');
  assert.equal(registry.provider(SERVICE.EXECUTION), 'test.execution.two');
});

test('service registry rejects missing plugin dependencies before initialization', async () => {
  const registry = new ServiceRegistry();
  registry.register(definePlugin({ name: 'test.requires.execution', requires: [SERVICE.EXECUTION], register() {} }));
  await assert.rejects(registry.initialize(), error => error?.code === 'PLUGIN_DEPENDENCY_FAILED');
});

test('plugin disposal runs in reverse registration order', async () => {
  const calls = [];
  const registry = new ServiceRegistry();
  for (const name of ['one', 'two']) registry.register(definePlugin({ name: `test.${name}`, register() {}, dispose() { calls.push(name); } }));
  await registry.initialize();
  await registry.dispose();
  assert.deepEqual(calls, ['two', 'one']);
});
