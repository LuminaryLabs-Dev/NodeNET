import fs from 'node:fs/promises';
import { formatCapabilities, formatDoctor, formatPrepare, writeResult } from './output.js';

export async function runNativeCommand(net, parsed, io) {
  const options = parsed.operationOptions ?? {};
  switch (parsed.command) {
    case 'info': {
      const result = await net.info();
      writeResult(io, result, { json: parsed.json });
      return 0;
    }
    case 'prepare': {
      const result = await net.prepare();
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
      if (!net.environment()) await net.prepare({ restore: false });
      const env = net.environment();
      const result = { baseDir: env.baseDir, exists: Boolean(await fs.stat(env.baseDir).catch(() => null)) };
      writeResult(io, result, { json: parsed.json });
      return 0;
    }
    default: throw new Error(`Unsupported NodeNET command: ${parsed.command}`);
  }
}
