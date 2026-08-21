import path from 'node:path';

export function createDotnetEnvironment({ root, paths, baseEnv = process.env } = {}) {
  if (!root) throw new TypeError('A .NET root is required.');
  const executableDir = path.resolve(root);
  return {
    ...baseEnv,
    DOTNET_ROOT: executableDir,
    DOTNET_CLI_HOME: paths?.cliHome ?? baseEnv.DOTNET_CLI_HOME,
    NUGET_PACKAGES: paths?.nugetDir ?? baseEnv.NUGET_PACKAGES,
    PATH: `${executableDir}${path.delimiter}${baseEnv.PATH ?? ''}`,
    DOTNET_NOLOGO: baseEnv.DOTNET_NOLOGO ?? '1',
    DOTNET_CLI_TELEMETRY_OPTOUT: baseEnv.DOTNET_CLI_TELEMETRY_OPTOUT ?? '1'
  };
}
