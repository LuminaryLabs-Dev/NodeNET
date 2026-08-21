import fs from 'node:fs/promises';
import path from 'node:path';
import { inspectTarget } from './project/inspect.js';
import { prepareTarget } from './project/prepare.js';
import {
  restoreTarget,
  buildTarget,
  testTarget,
  publishTarget,
  cleanTarget,
  runTarget
} from './project/commands.js';
import { runDotnet } from './dotnet/cli.js';
import { openLibrary } from './library/bridge.js';
import { NodeNetError, ProcessExitError } from './errors.js';

export class NodeNET {
  static async attach(target = '.', options = {}) {
    const resolved = path.resolve(target);
    await inspectTarget(resolved);
    return new NodeNET(resolved, options);
  }

  constructor(target, options = {}) {
    this.target = target;
    this.options = {
      mode: 'shared',
      isolation: 'auto',
      defaultSdk: '10.0',
      ...options
    };
    this.context = null;
    this.processes = new Set();
    this.libraries = new Set();
  }

  async info() {
    if (this.context) {
      return {
        prepared: true,
        ...this.context.state,
        host: this.context.host,
        ready: this.context.ready,
        readinessWarnings: this.context.readinessWarnings
      };
    }
    const targetInfo = await inspectTarget(this.target);
    return { prepared: false, target: targetInfo };
  }

  async prepare(options = {}) {
    const requireSdk = options.requireSdk ?? false;
    if (this.context && !options.force) {
      const hasSdk = Boolean(this.context.dotnet?.info?.sdks?.length);
      const needsSdkUpgrade = requireSdk && !hasSdk;
      const needsRestore = options.restore !== false
        && this.context.targetInfo.needsRestore
        && !this.context.restoreResult;

      if (!needsSdkUpgrade) {
        if (needsRestore) this.context.restoreResult = await restoreTarget(this.context, options);
        return this.context;
      }

      if (this.context.paths?.temporary) {
        await fs.rm(this.context.paths.baseDir, { recursive: true, force: true });
      }
    }
    this.context = await prepareTarget(this.target, {
      ...this.options,
      ...options,
      requireSdk
    });
    return this.context;
  }

  async #ensurePrepared(options = {}) {
    return this.prepare(options);
  }

  async restore(options = {}) {
    if (!this.context) {
      const context = await this.#ensurePrepared();
      return context.restoreResult ?? restoreTarget(context, options);
    }
    const result = await restoreTarget(this.context, options);
    this.context.restoreResult = result;
    return result;
  }

  async build(options = {}) {
    const context = await this.#ensurePrepared();
    return buildTarget(context, options);
  }

  async test(options = {}) {
    const context = await this.#ensurePrepared();
    return testTarget(context, options);
  }

  async publish(options = {}) {
    const context = await this.#ensurePrepared();
    return publishTarget(context, options);
  }

  async clean(options = {}) {
    const context = await this.#ensurePrepared({ restore: false });
    return cleanTarget(context, options);
  }

  async run(options = {}) {
    const context = await this.#ensurePrepared();
    const handle = runTarget(context, options);
    this.processes.add(handle);
    handle.once('exit', () => this.processes.delete(handle));
    return handle;
  }

  async exec(args, options = {}) {
    if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string')) {
      throw new TypeError('exec() expects an array of dotnet CLI arguments.');
    }
    const context = await this.#ensurePrepared({ restore: false, requireSdk: options.requireSdk ?? true });
    if (!context.dotnet) throw new NodeNetError('This target does not require .NET and no SDK was prepared.', { code: 'DOTNET_NOT_PREPARED' });
    const result = await runDotnet(context.dotnet, args, {
      cwd: options.cwd ?? context.targetInfo.directory,
      timeout: options.timeout ?? 10 * 60_000,
      signal: options.signal
    });
    if (!result.ok && options.rejectOnNonZero !== false) {
      throw new ProcessExitError(`dotnet ${args.join(' ')} exited with code ${result.exitCode}.`, { details: { result } });
    }
    return result;
  }

  async library(assembly, options = {}) {
    const context = await this.#ensurePrepared({ restore: false, requireSdk: true });
    const handle = await openLibrary(context, assembly, options);
    this.libraries.add(handle);
    handle.process.once('exit', () => this.libraries.delete(handle));
    return handle;
  }

  async dispose() {
    await Promise.allSettled([...this.libraries].map(handle => handle.close()));
    await Promise.allSettled([...this.processes].map(handle => handle.stop()));
    this.libraries.clear();
    this.processes.clear();
    if (this.context?.paths?.temporary) {
      await fs.rm(this.context.paths.baseDir, { recursive: true, force: true });
    }
    this.context = null;
  }
}
