import { definePlugin } from '../kernel/plugin.js';
import { DotNetEnvironmentService } from '../services/environment.js';
import { SERVICE } from '../services/names.js';

export function dotnetEnvironmentPlugin() {
  return definePlugin({
    name: 'nodenet.environment.dotnet',
    requires: [SERVICE.EXECUTION],
    provides: [SERVICE.ENVIRONMENT],
    register(registry, { provide }) {
      provide(SERVICE.ENVIRONMENT, new DotNetEnvironmentService({
        execution: registry.require(SERVICE.EXECUTION)
      }));
    }
  });
}
