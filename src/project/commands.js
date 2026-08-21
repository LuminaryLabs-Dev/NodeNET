import { runProcess } from '../process/run.js';
import { spawnManagedProcess } from '../process/handle.js';
import { runDotnet, spawnDotnet } from '../dotnet/cli.js';
import {
  NodeNetError,
  RestoreError,
  BuildError,
  TestError,
  PublishError,
  ProcessExitError
} from '../errors.js';

export function parseDiagnostics(text) {
  const diagnostics = [];
  const regex = /^(.*?)(?:\((\d+),(\d+)\))?\s*:\s*(error|warning)\s+([A-Za-z]+\d+)\s*:\s*(.*?)(?:\s+\[(.*?)\])?$/gim;
  for (const match of text.matchAll(regex)) {
    diagnostics.push({
      file: match[1]?.trim() || null,
      line: match[2] ? Number(match[2]) : null,
      column: match[3] ? Number(match[3]) : null,
      severity: match[4].toLowerCase(),
      code: match[5],
      message: match[6].trim(),
      project: match[7]?.trim() || null
    });
  }
  return diagnostics;
}

function withDiagnostics(result) {
  return {
    ...result,
    diagnostics: parseDiagnostics(`${result.stdout}\n${result.stderr}`)
  };
}

function ensureProjectLike(context, operation) {
  if (!['project', 'solution'].includes(context.targetInfo.kind)) {
    throw new NodeNetError(`${operation} requires a .NET project or solution target.`, {
      code: 'UNSUPPORTED_TARGET_OPERATION',
      details: { operation, kind: context.targetInfo.kind }
    });
  }
}

async function shortCommand(context, args, options, ErrorType, label) {
  const result = withDiagnostics(await runDotnet(context.dotnet, args, {
    cwd: options.cwd ?? context.targetInfo.directory,
    timeout: options.timeout ?? 10 * 60_000,
    signal: options.signal
  }));
  if (!result.ok) {
    throw new ErrorType(`${label} failed for ${context.targetInfo.path}.`, {
      details: { result }
    });
  }
  return result;
}

export function restoreTarget(context, options = {}) {
  ensureProjectLike(context, 'restore');
  return shortCommand(context, ['restore', context.targetInfo.path, '--nologo'], options, RestoreError, 'dotnet restore');
}

export function buildTarget(context, options = {}) {
  ensureProjectLike(context, 'build');
  const args = ['build', context.targetInfo.path, '--nologo', '-c', options.configuration ?? 'Debug'];
  if (options.noRestore ?? Boolean(context.restoreResult)) args.push('--no-restore');
  if (options.framework) args.push('-f', options.framework);
  if (options.runtime) args.push('-r', options.runtime);
  for (const [key, value] of Object.entries(options.properties ?? {})) args.push(`-p:${key}=${value}`);
  return shortCommand(context, args, options, BuildError, 'dotnet build');
}

export function testTarget(context, options = {}) {
  ensureProjectLike(context, 'test');
  const args = ['test', context.targetInfo.path, '--nologo', '-c', options.configuration ?? 'Debug'];
  if (options.noRestore ?? Boolean(context.restoreResult)) args.push('--no-restore');
  if (options.framework) args.push('-f', options.framework);
  return shortCommand(context, args, options, TestError, 'dotnet test');
}

export function publishTarget(context, options = {}) {
  ensureProjectLike(context, 'publish');
  const args = ['publish', context.targetInfo.path, '--nologo', '-c', options.configuration ?? 'Release'];
  if (options.noRestore ?? Boolean(context.restoreResult)) args.push('--no-restore');
  if (options.framework) args.push('-f', options.framework);
  if (options.runtime) args.push('-r', options.runtime);
  if (options.output) args.push('-o', options.output);
  if (options.selfContained !== undefined) args.push('--self-contained', String(options.selfContained));
  for (const [key, value] of Object.entries(options.properties ?? {})) args.push(`-p:${key}=${value}`);
  return shortCommand(context, args, options, PublishError, 'dotnet publish');
}

export function cleanTarget(context, options = {}) {
  ensureProjectLike(context, 'clean');
  return shortCommand(
    context,
    ['clean', context.targetInfo.path, '--nologo', '-c', options.configuration ?? 'Debug'],
    options,
    ProcessExitError,
    'dotnet clean'
  );
}

export function runTarget(context, options = {}) {
  const args = options.args ?? [];
  if (context.targetInfo.kind === 'executable') {
    return spawnManagedProcess(context.targetInfo.path, args, {
      cwd: options.cwd ?? context.targetInfo.directory,
      env: options.env ?? process.env,
      signal: options.signal
    });
  }
  if (context.targetInfo.kind === 'assembly') {
    return spawnDotnet(context.dotnet, [context.targetInfo.path, ...args], {
      cwd: options.cwd ?? context.targetInfo.directory,
      signal: options.signal
    });
  }
  if (context.targetInfo.kind === 'project') {
    if (!context.targetInfo.runnable) {
      throw new NodeNetError(`Project output type is not runnable: ${context.targetInfo.path}`, {
        code: 'TARGET_NOT_RUNNABLE'
      });
    }
    const dotnetArgs = ['run', '--project', context.targetInfo.path, '--no-restore'];
    if (options.configuration) dotnetArgs.push('-c', options.configuration);
    if (args.length) dotnetArgs.push('--', ...args);
    return spawnDotnet(context.dotnet, dotnetArgs, {
      cwd: options.cwd ?? context.targetInfo.directory,
      signal: options.signal
    });
  }
  throw new NodeNetError('A solution cannot be run directly. Attach to a runnable project.', {
    code: 'TARGET_NOT_RUNNABLE'
  });
}

export async function runRawExecutable(command, args, options = {}) {
  const result = withDiagnostics(await runProcess(command, args, options));
  if (!result.ok && options.rejectOnNonZero !== false) {
    throw new ProcessExitError(`${command} exited with code ${result.exitCode}.`, { details: { result } });
  }
  return result;
}
