import { runProcess } from '../process/run.js';
import { spawnManagedProcess } from '../process/handle.js';

function fullArgs(dotnet, args) {
  return [...(dotnet.argsPrefix ?? []), ...args];
}

function mergedEnv(dotnet, options) {
  if (!options.env) return dotnet.env;
  return { ...(dotnet.env ?? process.env), ...options.env };
}

export function runDotnet(dotnet, args, options = {}) {
  const execution = options.executor ?? dotnet.executor;
  const runOptions = {
    ...options,
    env: mergedEnv(dotnet, options)
  };
  delete runOptions.executor;
  if (execution?.exec) return execution.exec(dotnet.path, fullArgs(dotnet, args), runOptions);
  return runProcess(dotnet.path, fullArgs(dotnet, args), runOptions);
}

export function spawnDotnet(dotnet, args, options = {}) {
  const execution = options.executor ?? dotnet.executor;
  const spawnOptions = {
    ...options,
    env: mergedEnv(dotnet, options)
  };
  delete spawnOptions.executor;
  if (execution?.spawn) return execution.spawn(dotnet.path, fullArgs(dotnet, args), spawnOptions);
  return spawnManagedProcess(dotnet.path, fullArgs(dotnet, args), spawnOptions);
}
