import { detectHost } from '../host/platform.js';

export class NodeHostService {
  detect(options = {}) {
    return detectHost(options);
  }
}
