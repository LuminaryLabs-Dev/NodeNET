const COMMAND_HELP = Object.freeze({
  info: 'Inspect the attached target without preparing .NET.',
  prepare: 'Make the target ready by resolving/provisioning .NET and restoring when needed.',
  restore: 'Restore the attached project or solution.',
  build: 'Build the attached project or solution.',
  test: 'Run tests for the attached project or solution.',
  publish: 'Publish the attached project or solution.',
  clean: 'Clean the attached project or solution.',
  run: 'Run the attached executable or runnable project.',
  doctor: 'Show host, .NET, project, capability, and execution diagnostics.',
  env: 'Show the selected NodeNET environment.',
  capabilities: 'Show resolved NodeNET capabilities.',
  cache: 'Inspect, prune, or clear NodeNET-managed cache data.'
});

const COMMON = [
  '  --target, --project <path>  Attach to another project/workspace',
  '  --sdk <version>             Request a .NET SDK version/channel',
  '  --mode <shared|local|temporary>',
  '  --managed                   Do not use system .NET',
  '  --system                    Do not provision managed .NET',
  '  --offline                   Do not use the network',
  '  --json                      Emit machine-readable final output',
  '  -h, --help                  Show NodeNET help'
];

export function formatHelp(command, version = '') {
  const header = `NodeNET${version ? ` ${version}` : ''}`;
  if (!command) {
    return [
      header,
      'Bring dotnet into the Node.js ecosystem.',
      '',
      'Usage:',
      '  nodenet <command> [options]',
      '  nodenet <dotnet-command> [...args]',
      '',
      'NodeNET commands:',
      ...Object.entries(COMMAND_HELP).map(([name, description]) => `  ${name.padEnd(14)}${description}`),
      '',
      'Global options:',
      ...COMMON,
      '  -v, --version               Show the NodeNET version',
      '',
      'Commands not owned by NodeNET are passed through to the selected dotnet CLI unchanged.'
    ].join('\n');
  }

  if (!(command in COMMAND_HELP)) return formatHelp(null, version);

  const extra = command === 'cache'
    ? [
        '',
        'Cache subcommands:',
        '  nodenet cache info',
        '  nodenet cache list',
        '  nodenet cache prune',
        '  nodenet cache clear [roots|downloads|nuget|bridge|cli-home|state]'
      ]
    : [];

  return [
    header,
    '',
    `${command}: ${COMMAND_HELP[command]}`,
    '',
    `Usage: nodenet ${command} [options]`,
    ...extra,
    '',
    'Common options:',
    ...COMMON,
    '',
    'Unknown dotnet options are preserved and forwarded by build/test/publish/restore/clean/run.'
  ].join('\n');
