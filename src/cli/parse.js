const NATIVE = new Set(['info','prepare','restore','build','test','publish','clean','run','doctor','env','capabilities','cache']);

const OPTION_COMMANDS = Object.freeze({
  noRestore: new Set(['prepare','build','test','publish','run']),
  configuration: new Set(['build','test','publish','clean','run']),
  framework: new Set(['build','test','publish','run']),
  runtime: new Set(['restore','build','publish','run']),
  output: new Set(['build','publish']),
  selfContained: new Set(['publish'])
});

function supports(command, option) {
  return OPTION_COMMANDS[option]?.has(command) === true;
}

export function isNativeCommand(command) {
  return NATIVE.has(command);
}

function takeValue(args, index, name) {
  const value = args[index + 1];
  if (value === undefined) throw new TypeError(`${name} requires a value.`);
  return value;
}

function passthrough(parsed, arg) {
  parsed.operationOptions.passthrough ??= [];
  parsed.operationOptions.passthrough.push(arg);
}

export function parseCli(argv = []) {
  if (argv[0] === '--version' || argv[0] === '-v') return { kind: 'meta', command: 'version' };
  if (argv[0] === '--help' || argv[0] === '-h') return { kind: 'meta', command: 'help' };

  const command = argv[0] ?? 'info';
  const rest = argv.slice(1);
  if (!isNativeCommand(command)) {
    return { kind: 'passthrough', command, dotnetArgs: [command, ...rest], target: process.cwd(), json: false, attachOptions: {} };
  }

  const parsed = {
    kind: 'native',
    command,
    target: process.cwd(),
    targetExplicit: false,
    json: false,
    help: false,
    attachOptions: {},
    operationOptions: {},
    runArgs: [],
    commandArgs: [],
    raw: [...rest]
  };

  let afterDoubleDash = false;
  let unknownMayTakeValue = false;
  let positionalTargetTaken = false;

  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];

    if (afterDoubleDash) {
      if (command === 'run') parsed.runArgs.push(arg);
      else passthrough(parsed, arg);
      continue;
    }

    if (arg === '--') {
      afterDoubleDash = true;
      unknownMayTakeValue = false;
      continue;
    }

    if (unknownMayTakeValue && !arg.startsWith('-')) {
      passthrough(parsed, arg);
      unknownMayTakeValue = false;
      continue;
    }
    unknownMayTakeValue = false;

    if (arg === '--help' || arg === '-h') { parsed.help = true; continue; }
    if (arg === '--json') { parsed.json = true; continue; }
    if (arg === '--target' || arg === '--project') {
      parsed.target = takeValue(rest, i, arg);
      parsed.targetExplicit = true;
      positionalTargetTaken = true;
      i += 1;
      continue;
    }
    if (arg === '--sdk') { parsed.attachOptions.sdk = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '--mode') { parsed.attachOptions.mode = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '--managed') { parsed.attachOptions.isolation = 'managed'; continue; }
    if (arg === '--system') { parsed.attachOptions.isolation = 'system'; continue; }
    if (arg === '--offline') { parsed.attachOptions.offline = true; continue; }
    if (arg === '--no-restore' && supports(command, 'noRestore')) { parsed.operationOptions.noRestore = true; continue; }
    if ((arg === '-c' || arg === '--configuration') && supports(command, 'configuration')) { parsed.operationOptions.configuration = takeValue(rest, i, arg); i += 1; continue; }
    if ((arg === '-f' || arg === '--framework') && supports(command, 'framework')) { parsed.operationOptions.framework = takeValue(rest, i, arg); i += 1; continue; }
    if ((arg === '-r' || arg === '--runtime') && supports(command, 'runtime')) { parsed.operationOptions.runtime = takeValue(rest, i, arg); i += 1; continue; }
    if ((arg === '-o' || arg === '--output') && supports(command, 'output')) { parsed.operationOptions.output = takeValue(rest, i, arg); i += 1; continue; }
    if (arg === '--self-contained' && supports(command, 'selfContained')) { parsed.operationOptions.selfContained = true; continue; }
    if (arg === '--no-self-contained' && supports(command, 'selfContained')) { parsed.operationOptions.selfContained = false; continue; }

    if (command === 'cache' && !arg.startsWith('-')) {
      parsed.commandArgs.push(arg);
      continue;
    }

    if (arg.startsWith('-')) {
      passthrough(parsed, arg);
      unknownMayTakeValue = true;
      continue;
    }

    if (command === 'run') {
      parsed.runArgs.push(arg);
      continue;
    }

    if (!positionalTargetTaken) {
      parsed.target = arg;
      positionalTargetTaken = true;
      continue;
    }

    passthrough(parsed, arg);
  }

  return parsed;
}
