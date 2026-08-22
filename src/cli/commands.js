import { clearCache, inspectCache, listCache, pruneCache, resolveCacheBase } from '../cache.js';
import { formatCache, formatCapabilities, formatDoctor, formatPrepare, writeResult } from './output.js';

export async function runNativeCommand(net, parsed, io) {
  const options = parsed.operationOptions ?? {};
  switch (parsed.command) {
    case 'info': {
      const result = await net.info();
      writeResult(io, result, { json: parsed.json });
      return 0;
    }
    case 'prepare': {
      const result = await net.prepare({ restore: options.noRestore ? false : undefined });
      writeResult(io, result, { json: parsed.json, formatter: formatPrepare });
      return result.ready ? 0 : 1;
    }
    case 'restore': writeResult(io, await net.restore(options), { json: parsed.json }); return 0;
    case 'build': writeResult(io, await net.build(options), { json: parsed.json }); return 0;
    case 'test': writeResult(io, await net.test(options), { json: parsed.json }); return 0;
    case 'publish': writeResult(io, await net.publish(options), { json: parsed.json }); return 0;
    case 'clean': writeResult(io, await net.clean(options), { json: parsed.json }); return 0;
    case 'run': {
      const handle = await net.run({ ...options, args: parsed.runArgs });
      handle.on('stdout', chunk => io.stdout.write(chunk));
      handle.on('stderr', chunk => io.stderr.write(chunk));
      const result = await handle.wait();
      return result.exitCode ?? 1;
    }
    case 'doctor': {
      const result = await net.doctor();
      writeResult(io, result, { json: parsed.json, formatter: formatDoctor });
      return result.capabilities.ready ? 0 : 1;
    }
    case 'capabilities': {
      const result = await net.capabilities({ prepare: true });
      writeResult(io, result, { json: parsed.json, formatter: formatCapabilities });
      return 0;
    }
    case 'env': {
      if (!net.environment()) await net.prepare({ restore: false });
      writeResult(io, net.environment(), { json: parsed.json });
      return 0;
    }
    case 'cache': {
      const baseDir = resolveCacheBase({
        mode: net.options?.mode ?? 'shared',
        target: net.target,
        home: net.options?.home
      });
      const action = parsed.commandArgs?.[0] ?? 'info';
      let result;
      if (action === 'info') result = await inspectCache(baseDir);
      else if (action === 'list') result = await listCache(baseDir);
      else if (action === 'prune') result = await pruneCache(baseDir);
      else if (action === 'clear') {
        const category = parsed.commandArgs?.[1];
        result = await clearCache(baseDir, !category || category === 'all' ? null : category);
      } else {
        throw new TypeError(`Unknown NodeNET cache action: ${action}`);
      }
      writeResult(io, result, { json: parsed.json, formatter: formatCache });
      return 0;
    }
    default: throw new Error(`Unsupported NodeNET command: ${parsed.command}`);
  }
