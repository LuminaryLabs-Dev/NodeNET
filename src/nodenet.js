import fs from 'node:fs/promises';
import path from 'node:path';
import { runDotnet } from './dotnet/cli.js';
import { NodeNetError, ProcessExitError } from './errors.js';
import { createDefaultKernel, serviceSnapshot } from './kernel/context.js';
import { packageVersion } from './version.js';

function normalizeTrust(options) {
  const trust = options.trust ?? 'trusted';
  if (!['trusted', 'untrusted'].includes(trust)) throw new TypeError(`Unsupported NodeNET trust mode: ${trust}`);
  return trust;
}

export class NodeNET {
  static async attach(target = '.', options = {}) {
    const resolved = path.resolve(target);
    const trust = normalizeTrust(options);
    const kernel = await createDefaultKernel({ plugins: options.plugins ?? [], baseEnv: options.env ?? process.env });
    try {
      const services = serviceSnapshot(kernel);
      if (trust === 'untrusted' && services.execution.sandboxed !== true) {
        throw new NodeNetError('Untrusted execution requires a sandboxed NodeNET execution provider.', {
          code: 'UNTRUSTED_EXECUTION_REQUIRES_SANDBOX',
          details: { execution: services.execution.kind ?? services.execution.constructor?.name ?? null }
        });
      }
      await services.project.inspect(resolved);
      return new NodeNET(resolved, { ...options, trust }, kernel, services);
    } catch (error) {
      await kernel.dispose().catch(() => {});
      throw error;
    }
  }

  constructor(target, options = {}, kernel, services) {
    this.target = target;
    this.options = { mode: 'shared', isolation: 'auto', defaultSdk: '10.0', trust: 'trusted', ...options };
    delete this.options.plugins;
    this.kernel = kernel;
    this.services = services;
    this.context = null;
    this.processes = new Set();
    this.libraries = new Set();
  }

  async info() {
    const version = await packageVersion();
    if (this.context) {
      return { version, prepared: true, ...this.context.state, host: this.context.host, ready: this.context.ready, readinessWarnings: this.context.readinessWarnings, services: this.kernel.describe() };
    }
    const targetInfo = await this.services.project.inspect(this.target);
    return { version, prepared: false, target: targetInfo, services: this.kernel.describe() };
  }

  async prepare(options = {}) {
    const requireSdk = options.requireSdk ?? false;
    if (this.context && !options.force) {
      const hasSdk = Boolean(this.context.dotnet?.info?.sdks?.length);
      const needsSdkUpgrade = requireSdk && !hasSdk;
      const needsRestore = options.restore !== false && this.context.targetInfo.needsRestore && !this.context.restoreResult;
      if (!needsSdkUpgrade) {
        if (needsRestore) this.context.restoreResult = await this.services.project.restore(this.context, options);
        return this.context;
      }
      if (this.context.paths?.temporary) await fs.rm(this.context.paths.baseDir, { recursive: true, force: true });
    }
    this.context = await this.services.project.prepare(this.target, { ...this.options, ...options, requireSdk });
    return this.context;
  }

  async #ensurePrepared(options = {}) { return this.prepare(options); }

  async restore(options = {}) {
    if (!this.context) this.context = await this.#ensurePrepared({ restore: false });
    const result = await this.services.project.restore(this.context, options);
    this.context.restoreResult = result;
    return result;
  }

  async build(options = {}) { return this.services.project.build(await this.#ensurePrepared({ restore: options.noRestore ? false : undefined }), options); }
  async test(options = {}) { return this.services.project.test(await this.#ensurePrepared({ restore: options.noRestore ? false : undefined }), options); }
  async publish(options = {}) { return this.services.project.publish(await this.#ensurePrepared({ restore: options.noRestore ? false : undefined }), options); }
  async clean(options = {}) { return this.services.project.clean(await this.#ensurePrepared({ restore: false }), options); }

  async run(options = {}) {
    const context = await this.#ensurePrepared({ restore: options.noRestore ? false : undefined });
    const handle = this.services.project.run(context, options);
    this.processes.add(handle);
    handle.once('exit', () => this.processes.delete(handle));
    return handle;
  }

  async exec(args, options = {}) {
    if (!Array.isArray(args) || args.some(arg => typeof arg !== 'string')) throw new TypeError('exec() expects an array of dotnet CLI arguments.');
    const context = await this.#ensurePrepared({ restore: false, requireSdk: options.requireSdk ?? true });
    if (!context.dotnet) throw new NodeNetError('This target does not require .NET and no SDK was prepared.', { code: 'DOTNET_NOT_PREPARED' });
    const result = await runDotnet(context.dotnet, args, { cwd: options.cwd ?? context.targetInfo.directory, timeout: options.timeout ?? 10 * 60_000, signal: options.signal, env: options.env });
    if (!result.ok && options.rejectOnNonZero !== false) throw new ProcessExitError(`dotnet ${args.join(' ')} exited with code ${result.exitCode}.`, { details: { result } });
    return result;
  }

  async library(assembly, options = {}) {
    const context = await this.#ensurePrepared({ restore: false, requireSdk: true });
    const handle = await this.services.interop.openLibrary(context, assembly, options);
    this.libraries.add(handle);
    handle.process.once('exit', () => this.libraries.delete(handle));
    return handle;
  }

  async capabilities({ prepare = false } = {}) {
    let context = this.context;
    let targetInfo = context?.targetInfo ?? null;
    let host = context?.host ?? null;
    if (prepare && !context) {
      context = await this.prepare({ restore: false });
      targetInfo = context.targetInfo;
      host = context.host;
    } else if (!context) {
      targetInfo = await this.services.project.inspect(this.target);
      host = this.services.host.detect();
    }
    return this.services.capabilities.snapshot({ context, targetInfo, host, execution: this.services.execution });
  }

  async doctor() {
    const context = await this.prepare({ restore: false });
    return {
      nodenet: { version: await packageVersion() },
      node: { version: process.version },
      target: context.targetInfo,
      environment: context.state,
      capabilities: await this.capabilities(),
      services: this.kernel.describe()
    };
  }

  environment() {
    if (!this.context) return null;
    return { mode: this.context.paths.mode, baseDir: this.context.paths.baseDir, root: this.context.dotnet?.root ?? null, source: this.context.dotnet?.source ?? null, state: this.context.state };
  }

  async dispose() {
    await Promise.allSettled([...this.libraries].map(handle => handle.close()));
    await Promise.allSettled([...this.processes].map(handle => handle.stop()));
    this.libraries.clear();
    this.processes.clear();
    if (this.context?.paths?.temporary) await fs.rm(this.context.paths.baseDir, { recursive: true, force: true });
    this.context = null;
    await this.kernel?.dispose?.();
  }
}
