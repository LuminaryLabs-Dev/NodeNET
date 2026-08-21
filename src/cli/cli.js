import { parseCli } from './parse.js';
import { runNativeCommand } from './commands.js';

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
  if (!NodeNET?.attach) throw new TypeError('runCli requires the NodeNET facade.');
  const parsed = parseCli(argv);
  if (parsed.kind === 'passthrough') {
    const net = await NodeNET.attach(cwd, attachOptionsFromEnv(env));
    try {
      const result = await net.exec(parsed.dotnetArgs, { cwd, requireSdk: true, rejectOnNonZero: false });
      if (result.stdout) io.stdout.write(result.stdout);
      if (result.stderr) io.stderr.write(result.stderr);
      return result.exitCode ?? 1;
    } finally {
      await net.dispose();
    }
  }

  const net = await NodeNET.attach(parsed.target, { ...attachOptionsFromEnv(env), ...parsed.attachOptions });
  try {
    return await runNativeCommand(net, parsed, io);
  } finally {
    await net.dispose();
  }
}
