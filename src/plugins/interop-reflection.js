import { definePlugin } from '../kernel/plugin.js';
import { ReflectionInteropService } from '../services/interop.js';
import { SERVICE } from '../services/names.js';

export function reflectionInteropPlugin() {
  return definePlugin({
    name: 'nodenet.interop.reflection',
    requires: [SERVICE.EXECUTION, SERVICE.ENVIRONMENT],
    provides: [SERVICE.INTEROP],
    register(_registry, { provide }) {
      provide(SERVICE.INTEROP, new ReflectionInteropService());
    }
  });
}
