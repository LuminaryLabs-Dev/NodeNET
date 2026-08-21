import { definePlugin } from '../kernel/plugin.js';
import { LocalExecutionService } from '../services/execution.js';
import { SERVICE } from '../services/names.js';

export function localExecutionPlugin(options = {}) {
  return definePlugin({
    name: 'nodenet.execution.local',
    provides: [SERVICE.EXECUTION],
    register(_registry, { provide }) {
      provide(SERVICE.EXECUTION, new LocalExecutionService(options));
    }
  });
}
