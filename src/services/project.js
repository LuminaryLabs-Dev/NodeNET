import { inspectTarget } from '../project/inspect.js';
import { prepareTarget } from '../project/prepare.js';
import { restoreTarget, buildTarget, testTarget, publishTarget, cleanTarget, runTarget } from '../project/commands.js';

export class DotNetProjectService {
  constructor() { this.services = null; }
  setServices(services) { this.services = services; return this; }
  inspect(target) { return inspectTarget(target); }
  prepare(target, options = {}) { return prepareTarget(target, { ...options, services: this.services }); }
  restore(context, options = {}) { context.services ??= this.services; return restoreTarget(context, options); }
  build(context, options = {}) { context.services ??= this.services; return buildTarget(context, options); }
  test(context, options = {}) { context.services ??= this.services; return testTarget(context, options); }
  publish(context, options = {}) { context.services ??= this.services; return publishTarget(context, options); }
  clean(context, options = {}) { context.services ??= this.services; return cleanTarget(context, options); }
  run(context, options = {}) { context.services ??= this.services; return runTarget(context, options); }
}
