import { definePlugin } from '../kernel/plugin.js';
import { CapabilityService } from '../services/capabilities.js';
import { SERVICE } from '../services/names.js';

export function capabilityPlugin() {
  return definePlugin({
    name: 'nodenet.capabilities.default',
    provides: [SERVICE.CAPABILITIES],
    register(_registry, { provide }) {
      provide(SERVICE.CAPABILITIES, new CapabilityService());
    }
  });
}
