import { NodeNetError } from '../errors.js';
import { validateServiceContract } from '../services/contracts.js';

export class ServiceRegistry {
  constructor() {
    this.services = new Map();
    this.providers = new Map();
    this.plugins = [];
    this.initialized = false;
    this.disposed = false;
  }

  provide(capability, service, { plugin = 'anonymous', replace = false } = {}) {
    if (!capability || typeof capability !== 'string') throw new TypeError('Service capability must be a non-empty string.');
    if (service === undefined || service === null) throw new TypeError(`Service ${capability} cannot be null.`);
    if (this.services.has(capability) && !replace) {
      throw new NodeNetError(`Capability ${capability} already has a provider.`, {
        code: 'CAPABILITY_CONFLICT',
        details: { capability, existing: this.providers.get(capability), attempted: plugin }
      });
    }
    this.services.set(capability, service);
    this.providers.set(capability, plugin);
    return service;
  }

  has(capability) {
    return this.services.has(capability);
  }

  provider(capability) {
    return this.providers.get(capability) ?? null;
  }

  require(capability) {
    if (!this.services.has(capability)) {
      throw new NodeNetError(`Required NodeNET capability is unavailable: ${capability}`, {
        code: 'MISSING_CAPABILITY',
        details: { capability, available: [...this.services.keys()].sort() }
      });
    }
    return this.services.get(capability);
  }

  register(plugin) {
    if (this.initialized) throw new NodeNetError('Plugins cannot be registered after the kernel is initialized.', { code: 'KERNEL_INITIALIZED' });
    if (!plugin?.name || typeof plugin.register !== 'function') throw new TypeError('Invalid NodeNET plugin.');
    if (this.plugins.some(item => item.name === plugin.name)) {
      throw new NodeNetError(`Plugin already registered: ${plugin.name}`, { code: 'PLUGIN_CONFLICT' });
    }
    plugin.register(this, {
      provide: (capability, service, options = {}) => this.provide(capability, service, {
        plugin: plugin.name,
        replace: plugin.replace === true || options.replace === true
      })
    });
    this.plugins.push(plugin);
    return this;
  }

  validate() {
    const missing = [];
    for (const plugin of this.plugins) {
      for (const capability of plugin.requires ?? []) {
        if (!this.has(capability)) missing.push({ plugin: plugin.name, capability });
      }
      for (const capability of plugin.provides ?? []) {
        if (!this.has(capability)) missing.push({ plugin: plugin.name, capability, reason: 'declared-but-not-provided' });
      }
    }
    if (missing.length) {
      throw new NodeNetError('NodeNET plugin composition is incomplete.', {
        code: 'PLUGIN_DEPENDENCY_FAILED',
        details: { missing }
      });
    }

    for (const [capability, service] of this.services) validateServiceContract(capability, service);
    return true;
  }

  async initialize(context = {}) {
    if (this.initialized) return this;
    this.validate();
    for (const plugin of this.plugins) await plugin.initialize?.(this, context);
    this.initialized = true;
    return this;
  }

  describe() {
    return {
      plugins: this.plugins.map(plugin => ({
        name: plugin.name,
        provides: [...(plugin.provides ?? [])],
        requires: [...(plugin.requires ?? [])]
      })),
      services: [...this.services.keys()].sort().map(capability => ({
        capability,
        provider: this.providers.get(capability) ?? null
      }))
    };
  }

  async dispose(context = {}) {
    if (this.disposed) return;
    for (const plugin of [...this.plugins].reverse()) await plugin.dispose?.(this, context);
    this.disposed = true;
  }
}
