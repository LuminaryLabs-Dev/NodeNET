import { definePlugin } from '../kernel/plugin.js';
import { SoftwareDisplayService } from '../services/display.js';
import { SERVICE } from '../services/names.js';

export function softwareDisplayPlugin(options = {}) {
  const service = new SoftwareDisplayService(options);
  return definePlugin({
    name: 'nodenet.display.software',
    provides: [SERVICE.DISPLAY],
    register(_registry, { provide }) {
      provide(SERVICE.DISPLAY, service);
    },
    dispose() {
      return service.dispose();
    }
  });
}
