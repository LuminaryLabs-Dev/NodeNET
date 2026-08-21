import { openLibrary } from '../interop/library.js';

export class ReflectionInteropService {
  openLibrary(context, assembly, options = {}) {
    return openLibrary(context, assembly, options);
  }
}
