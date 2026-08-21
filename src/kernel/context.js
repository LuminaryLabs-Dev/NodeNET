import { ServiceRegistry } from './registry.js';
import { nodeHostPlugin } from '../plugins/host-node.js';
import { localExecutionPlugin } from '../plugins/execution-local.js';
import { dotnetEnvironmentPlugin } from '../plugins/environment-dotnet.js';
import { capabilityPlugin } from '../plugins/capabilities.js';
import { dotnetProjectPlugin } from '../plugins/project-dotnet.js';
import { reflectionInteropPlugin } from '../plugins/interop-reflection.js';
import { SERVICE } from '../services/names.js';
import { DotNetEnvironmentService } from '../services/environment.js';

export async function createDefaultKernel({ plugins = [], baseEnv = process.env } = {}) {
  const registry = new ServiceRegistry();
  for (const plugin of [
    nodeHostPlugin(),
    localExecutionPlugin({ baseEnv }),
    dotnetEnvironmentPlugin(),
    capabilityPlugin(),
    dotnetProjectPlugin(),
    reflectionInteropPlugin()
  ]) registry.register(plugin);

  for (const plugin of plugins ?? []) registry.register(typeof plugin === 'function' ? plugin() : plugin);

  // Rebind default dependent services after user replacements so a custom execution
  // provider is actually used by the default environment/project composition.
  if (registry.provider(SERVICE.ENVIRONMENT) === 'nodenet.environment.dotnet') {
    registry.provide(SERVICE.ENVIRONMENT, new DotNetEnvironmentService({
      execution: registry.require(SERVICE.EXECUTION)
    }), { plugin: 'nodenet.environment.dotnet', replace: true });
  }
  if (registry.provider(SERVICE.PROJECT) === 'nodenet.project.dotnet') {
    registry.require(SERVICE.PROJECT).setServices({
      host: registry.require(SERVICE.HOST),
      environment: registry.require(SERVICE.ENVIRONMENT),
      execution: registry.require(SERVICE.EXECUTION),
      capabilities: registry.require(SERVICE.CAPABILITIES),
      project: registry.require(SERVICE.PROJECT)
    });
  }

  await registry.initialize();
  return registry;
}

export function serviceSnapshot(kernel) {
  return Object.freeze({
    host: kernel.require(SERVICE.HOST),
    environment: kernel.require(SERVICE.ENVIRONMENT),
    execution: kernel.require(SERVICE.EXECUTION),
    project: kernel.require(SERVICE.PROJECT),
    interop: kernel.require(SERVICE.INTEROP),
    capabilities: kernel.require(SERVICE.CAPABILITIES)
  });
}
