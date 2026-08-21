const NATIVE = new Set(['info','prepare','restore','build','test','publish','clean','run','doctor','env','capabilities','cache']);

export function isNativeCommand(command) {
  return NATIVE.has(command);
}

function takeValue(args, index, name) {
  const value = args[index + 1];
  if (value === undefined) throw new TypeError(`${name} requires a value.`);
  return value;
}

export function parseCli(argv = []) {
  const command = argv[0] ?? 'info';
  const rest = argv.slice(1);
  if (!isNativeCommand(command)) {
    return { kind: 'passthrough', command, dotnetArgs: [command, ...rest], target: process.cwd(), json: false, attachOptions: {} };
  }

  const parsed = {
    kind: 'native',
    command,
    target: process.cwd(),
    json: false,
    attachOptions: {},
    operationOptions: {},
    runArgs: [],
    raw: [...rest]
  };
  const positionals = [];
  let afterDoubleDash = false;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (afterDoubleDash) { parsed.runArgs.push(arg); continue; }
    if (arg === '--') { afterDoubleDash = true; continue; }
    if (arg === '--json') { parsed.json = true; continue; }
    if (arg === '--target' || arg === '--project') { parsed.target = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '--sdk') { parsed.attachOptions.sdk = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '--mode') { parsed.attachOptions.mode = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '--managed') { parsed.attachOptions.isolation = 'managed'; continue; }
    if (arg === '--system') { parsed.attachOptions.isolation = 'system'; continue; }
    if (arg === '--offline') { parsed.attachOptions.offline = true; continue; }
    if (arg === '--no-restore') { parsed.operationOptions.noRestore = true; continue; }
    if (arg === '-c' || arg === '--configuration') { parsed.operationOptions.configuration = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '-f' || arg === '--framework') { parsed.operationOptions.framework = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '-r' || arg === '--runtime') { parsed.operationOptions.runtime = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '-o' || arg === '--output') { parsed.operationOptions.output = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '--self-contained') { parsed.operationOptions.selfContained = true; continue; }
    if (arg === '--no-self-contained') { parsed.operationOptions.selfContained = false; continue; }
    if (arg.startsWith('-')) {
      parsed.operationOptions.passthrough ??= [];
      parsed.operationOptions.passthrough.push(arg);
      continue;
    }
    positionals.push(arg);
  }

  if (positionals.length && command !== 'run') parsed.target = positionals[0];
  else if (positionals.length && command === 'run') parsed.runArgs.unshift(...positionals);
  return parsed;
}
