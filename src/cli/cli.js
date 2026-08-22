import { formatHelp } from './help.js';
import { createProgressReporter } from './progress.js';
import { parseCli } from './parse.js';
import { runNativeCommand } from './commands.js';
import { packageVersion } from '../version.js';

function attachOptionsFromEnv(env) {
  return {
    ...(env.NODENET_MODE ? { mode: env.NODENET_MODE } : {}),
    ...(env.NODENET_ISOLATION ? { isolation: env.NODENET_ISOLATION } : {}),
    ...(env.NODENET_SDK ? { sdk: env.NODENET_SDK } : {}),
    ...(env.NODENET_HOME ? { home: env.NODENET_HOME } : {})
  };
}

export async function runCli(argv, {
  NodeNET,
  cwd = process.cwd(),
  env = process.env,
  io = { stdout: process.stdout, stderr: process.stderr }
} = {}) {
  const parsed = parseCli(argv);
  const version = await packageVersion();

  if (parsed.kind === 'meta') {
    if (parsed.command === 'version') io.stdout.write(`NodeNET ${version}\n`);
    else io.stdout.write(`${formatHelp(null, version)}\n`);
    return 0;
  }

  if (parsed.kind === 'native' && parsed.help) {
    io.stdout.write(`${formatHelp(parsed.command, version)}\n`);
    return 0;
  }

  if (!NodeNET?.attach) throw new TypeError('runCli requires the NodeNET facade.');
  const progress = parsed.json ? null : createProgressReporter(io);
  const baseAttachOptions = {
    ...attachOptionsFromEnv(env),
    ...(progress ? { onProgress: progress } : {})
  };

  if (parsed.kind === 'passthrough') {
    const net = await NodeNET.attach(cwd, baseAttachOptions);
    try {
      const result = await net.exec(parsed.dotnetArgs, { cwd, requireSdk: true, rejectOnNonZero: false });
      if (result.stdout) io.stdout.write(result.stdout);
      if (result.stderr) io.stderr.write(result.stderr);
      return result.exitCode ?? 1;
    } finally {
      await net.dispose();
    }
  }

  const net = await NodeNET.attach(parsed.target, { ...baseAttachOptions, ...parsed.attachOptions });
  try {
    return await runNativeCommand(net, parsed, io);
  } finally {
    await net.dispose();
  }
}
