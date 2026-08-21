import path from 'node:path';
import { runProcess } from '../process/run.js';
import { DotnetVerificationError } from '../errors.js';

export function dotnetExecutableName(platform = process.platform) {
  return platform === 'win32' ? 'dotnet.exe' : 'dotnet';
}

export function parseSdkList(output) {
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(\S+)\s+\[(.+)\]$/);
    return match ? { version: match[1], path: match[2] } : null;
  }).filter(Boolean);
}

export function parseRuntimeList(output) {
  return output.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^(\S+)\s+(\S+)\s+\[(.+)\]$/);
    return match ? { name: match[1], version: match[2], path: match[3] } : null;
  }).filter(Boolean);
}

export async function verifyDotnet({ path: dotnetPath, argsPrefix = [], env = process.env, cwd } = {}) {
  if (!dotnetPath) throw new DotnetVerificationError('A dotnet executable path is required.');

  const info = await runProcess(dotnetPath, [...argsPrefix, '--info'], { env, cwd, timeout: 30_000 });
  if (!info.ok) {
    throw new DotnetVerificationError(`dotnet --info failed with exit code ${info.exitCode}.`, {
      details: { result: info }
    });
  }

  const [sdksResult, runtimesResult] = await Promise.all([
    runProcess(dotnetPath, [...argsPrefix, '--list-sdks'], { env, cwd, timeout: 30_000 }),
    runProcess(dotnetPath, [...argsPrefix, '--list-runtimes'], { env, cwd, timeout: 30_000 })
  ]);

  if (!sdksResult.ok || !runtimesResult.ok) {
    throw new DotnetVerificationError('dotnet inventory commands failed.', {
      details: { sdksResult, runtimesResult }
    });
  }

  return {
    executable: dotnetPath,
    root: path.dirname(dotnetPath),
    infoText: info.stdout,
    sdks: parseSdkList(sdksResult.stdout),
    runtimes: parseRuntimeList(runtimesResult.stdout)
  };
}
