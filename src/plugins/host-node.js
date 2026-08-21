import { definePlugin } from '../kernel/plugin.js';
import { NodeHostService } from '../services/host.js';
import { SERVICE } from '../services/names.js';

export function nodeHostPlugin() {
  return definePlugin({
    name: 'nodenet.host.node',
    provides: [SERVICE.HOST],
    register(_registry, { provide }) {
      provide(SERVICE.HOST, new NodeHostService());
    }
  });
}
