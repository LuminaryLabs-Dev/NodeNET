#!/usr/bin/env node
import { NodeNET } from '../src/index.js';
import { runCli } from '../src/cli/cli.js';

try {
  process.exitCode = await runCli(process.argv.slice(2), { NodeNET });
} catch (error) {
  const code = error?.code ? ` (${error.code})` : '';
  console.error(`NodeNET${code}: ${error?.message ?? error}`);
  if (process.env.NODENET_DEBUG === '1' && error?.stack) console.error(error.stack);
  process.exitCode = 1;
}
