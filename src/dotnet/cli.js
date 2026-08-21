import { runProcess } from '../process/run.js';
import { spawnManagedProcess } from '../process/handle.js';

function fullArgs(dotnet, args) {
  return [...(dotnet.argsPrefix ?? []), ...args];
}

export function runDotnet(dotnet, args, options = {}) {
  return runProcess(dotnet.path, fullArgs(dotnet, args), {
    env: dotnet.env,
    ...options
  });
}

export function spawnDotnet(dotnet, args, options = {}) {
  return spawnManagedProcess(dotnet.path, fullArgs(dotnet, args), {
    env: dotnet.env,
    ...options
  });
}
