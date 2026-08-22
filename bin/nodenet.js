#!/usr/bin/env node
import { runCli } from '../src/cli/cli.js';
import { parseCli } from '../src/cli/parse.js';

try {
  const argv = process.argv.slice(2);
  const parsed = parseCli(argv);
  const needsFacade = !(parsed.kind === 'meta' || (parsed.kind === 'native' && parsed.help));
  const NodeNET = needsFacade ? (await import('../src/index.js')).NodeNET : null;
  process.exitCode = await runCli(argv, { NodeNET });
} catch (error) {
  const code = error?.code ? ` (${error.code})` : '';
  console.error(`NodeNET${code}: ${error?.message ?? error}`);
  if (process.env.NODENET_DEBUG === '1' && error?.stack) console.error(error.stack);
  process.exitCode = 1;
}
