import { runProcess } from '../process/run.js';
import { spawnManagedProcess } from '../process/handle.js';

function mergeEnv(baseEnv, env) {
  if (!env) return baseEnv;
  return { ...baseEnv, ...env };
}

export class LocalExecutionService {
  constructor({ baseEnv = process.env } = {}) {
    this.baseEnv = baseEnv;
    this.kind = 'local';
    this.sandboxed = false;
  }

  exec(command, args = [], options = {}) {
    const runOptions = { ...options, env: mergeEnv(this.baseEnv, options.env) };
    delete runOptions.executor;
    return runProcess(command, args, runOptions);
  }

  spawn(command, args = [], options = {}) {
    const spawnOptions = { ...options, env: mergeEnv(this.baseEnv, options.env) };
    delete spawnOptions.executor;
    return spawnManagedProcess(command, args, spawnOptions);
  }
}
