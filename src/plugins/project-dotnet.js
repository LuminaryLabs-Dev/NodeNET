import { definePlugin } from '../kernel/plugin.js';
import { DotNetProjectService } from '../services/project.js';
import { SERVICE } from '../services/names.js';

export function dotnetProjectPlugin() {
  return definePlugin({
    name: 'nodenet.project.dotnet',
    requires: [SERVICE.HOST, SERVICE.ENVIRONMENT, SERVICE.EXECUTION, SERVICE.CAPABILITIES],
    provides: [SERVICE.PROJECT],
    register(registry, { provide }) {
      const project = new DotNetProjectService();
      provide(SERVICE.PROJECT, project);
      project.setServices({
        host: registry.require(SERVICE.HOST),
        environment: registry.require(SERVICE.ENVIRONMENT),
        execution: registry.require(SERVICE.EXECUTION),
        capabilities: registry.require(SERVICE.CAPABILITIES),
        project
      });
    }
  });
}
