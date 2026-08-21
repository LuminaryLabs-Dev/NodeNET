import fs from 'node:fs/promises';
import path from 'node:path';
import { TargetNotFoundError } from '../errors.js';

const PROJECT_EXTENSIONS = new Set(['.csproj', '.fsproj', '.vbproj']);
const SOLUTION_EXTENSIONS = new Set(['.sln', '.slnx']);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findUp(startDir, fileName) {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, fileName);
    if (await exists(candidate)) return candidate;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function firstMatch(text, regex) {
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function allMatches(text, regex) {
  return [...text.matchAll(regex)].map(match => match[1].trim());
}

function splitList(value) {
  return value ? value.split(';').map(item => item.trim()).filter(Boolean) : [];
}

function inferWorkloads({ sdk, targetFrameworks }) {
  const workloads = new Set();
  const text = `${sdk ?? ''} ${targetFrameworks.join(' ')}`.toLowerCase();
  if (text.includes('maui')) workloads.add('maui');
  if (text.includes('-android')) workloads.add('android');
  if (text.includes('-ios')) workloads.add('ios');
  if (text.includes('-maccatalyst')) workloads.add('maccatalyst');
  if (text.includes('browser-wasm')) workloads.add('wasm-tools');
  return [...workloads];
}

async function parseGlobalJson(startDir) {
  const globalPath = await findUp(startDir, 'global.json');
  if (!globalPath) return null;
  try {
    const data = JSON.parse(await fs.readFile(globalPath, 'utf8'));
    return {
      path: globalPath,
      sdkVersion: data?.sdk?.version ?? null,
      rollForward: data?.sdk?.rollForward ?? null,
      allowPrerelease: data?.sdk?.allowPrerelease ?? null
    };
  } catch (cause) {
    throw new TargetNotFoundError(`Unable to parse ${globalPath}.`, { cause });
  }
}

async function inspectProject(projectPath) {
  const raw = await fs.readFile(projectPath, 'utf8');
  const text = raw.replace(/<!--[\s\S]*?-->/g, '');
  const sdk = firstMatch(text, /<Project\b[^>]*\bSdk=["']([^"']+)["']/i)
    ?? firstMatch(text, /<Sdk>([^<]+)<\/Sdk>/i);
  const targetFramework = firstMatch(text, /<TargetFramework>([^<]+)<\/TargetFramework>/i);
  const targetFrameworks = splitList(firstMatch(text, /<TargetFrameworks>([^<]+)<\/TargetFrameworks>/i));
  if (targetFramework && !targetFrameworks.includes(targetFramework)) targetFrameworks.unshift(targetFramework);
  const runtimeIdentifiers = splitList(
    firstMatch(text, /<RuntimeIdentifiers>([^<]+)<\/RuntimeIdentifiers>/i)
    ?? firstMatch(text, /<RuntimeIdentifier>([^<]+)<\/RuntimeIdentifier>/i)
  );
  const packages = [...text.matchAll(/<PackageReference\b[^>]*\bInclude=["']([^"']+)["'][^>]*>/gi)].map(match => ({ name: match[1] }));
  const projectReferences = allMatches(text, /<ProjectReference\b[^>]*\bInclude=["']([^"']+)["'][^>]*>/gi)
    .map(reference => path.resolve(path.dirname(projectPath), reference));
  const outputType = firstMatch(text, /<OutputType>([^<]+)<\/OutputType>/i) ?? 'Library';
  const globalJson = await parseGlobalJson(path.dirname(projectPath));
  const directoryBuildProps = await findUp(path.dirname(projectPath), 'Directory.Build.props');
  const nugetConfig = await findUp(path.dirname(projectPath), 'NuGet.config');

  return {
    kind: 'project',
    path: projectPath,
    directory: path.dirname(projectPath),
    extension: path.extname(projectPath).toLowerCase(),
    sdk,
    targetFrameworks,
    runtimeIdentifiers,
    packages,
    projectReferences,
    outputType,
    globalJson,
    directoryBuildProps,
    nugetConfig,
    workloads: inferWorkloads({ sdk, targetFrameworks }),
    legacyFrameworks: targetFrameworks.filter(isLegacyDotNetFramework),
    needsRestore: true,
    runnable: !/^library$/i.test(outputType)
  };
}

async function resolveDirectory(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries.filter(entry => entry.isFile()).map(entry => entry.name);
  const solutions = files.filter(file => SOLUTION_EXTENSIONS.has(path.extname(file).toLowerCase())).sort();
  if (solutions.length === 1) return path.join(directory, solutions[0]);
  if (solutions.length > 1) throw new TargetNotFoundError(`Multiple solution files exist in ${directory}; attach to one explicitly.`);
  const projects = files.filter(file => PROJECT_EXTENSIONS.has(path.extname(file).toLowerCase())).sort();
  if (projects.length === 1) return path.join(directory, projects[0]);
  if (projects.length > 1) throw new TargetNotFoundError(`Multiple project files exist in ${directory}; attach to one explicitly.`);
  return null;
}


function selectRuntimeFramework(runtimeOptions = {}) {
  const frameworks = [
    ...(runtimeOptions.framework ? [runtimeOptions.framework] : []),
    ...(Array.isArray(runtimeOptions.frameworks) ? runtimeOptions.frameworks : [])
  ].filter(item => item?.name && item?.version);
  const priority = new Map([
    ['Microsoft.WindowsDesktop.App', 3],
    ['Microsoft.AspNetCore.App', 2],
    ['Microsoft.NETCore.App', 1]
  ]);
  frameworks.sort((a, b) => (priority.get(b.name) ?? 0) - (priority.get(a.name) ?? 0));
  return { primary: frameworks[0] ?? null, frameworks };
}

async function inspectAssembly(assemblyPath) {
  const base = assemblyPath.slice(0, -path.extname(assemblyPath).length);
  const runtimeConfigPath = `${base}.runtimeconfig.json`;
  let runtimeConfig = null;
  if (await exists(runtimeConfigPath)) {
    runtimeConfig = JSON.parse(await fs.readFile(runtimeConfigPath, 'utf8'));
  }
  const selected = selectRuntimeFramework(runtimeConfig?.runtimeOptions ?? {});
  return {
    kind: 'assembly',
    path: assemblyPath,
    directory: path.dirname(assemblyPath),
    runtimeConfigPath: runtimeConfig ? runtimeConfigPath : null,
    runtimeFramework: selected.primary,
    runtimeFrameworks: selected.frameworks,
    needsRestore: false,
    runnable: true,
    workloads: []
  };
}

export async function inspectTarget(target = '.') {
  let resolved = path.resolve(target);
  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch (cause) {
    throw new TargetNotFoundError(`Target does not exist: ${resolved}`, { cause });
  }

  if (stat.isDirectory()) {
    const selected = await resolveDirectory(resolved);
    if (!selected) {
      return {
        kind: 'workspace',
        path: resolved,
        directory: resolved,
        globalJson: await parseGlobalJson(resolved),
        targetFrameworks: [],
        workloads: [],
        needsRestore: false,
        runnable: false
      };
    }
    resolved = selected;
    stat = await fs.stat(resolved);
  }
  if (!stat.isFile()) throw new TargetNotFoundError(`Target is not a file or project directory: ${resolved}`);

  const extension = path.extname(resolved).toLowerCase();
  if (PROJECT_EXTENSIONS.has(extension)) return inspectProject(resolved);
  if (SOLUTION_EXTENSIONS.has(extension)) {
    return {
      kind: 'solution',
      path: resolved,
      directory: path.dirname(resolved),
      extension,
      globalJson: await parseGlobalJson(path.dirname(resolved)),
      targetFrameworks: [],
      workloads: [],
      needsRestore: true,
      runnable: false
    };
  }
  if (extension === '.dll') return inspectAssembly(resolved);
  return {
    kind: 'executable',
    path: resolved,
    directory: path.dirname(resolved),
    workloads: [],
    needsRestore: false,
    runnable: true
  };
}

function majorMinorFromTfm(tfm) {
  const value = String(tfm ?? '').toLowerCase();
  const modern = value.match(/^net(\d+)\.(\d+)/);
  if (modern) return `${Number(modern[1])}.${Number(modern[2])}`;
  const core = value.match(/^netcoreapp(\d+)\.(\d+)/);
  if (core) return `${Number(core[1])}.${Number(core[2])}`;
  return null;
}

function isLegacyDotNetFramework(tfm) {
  const value = String(tfm ?? '').toLowerCase();
  return /^net(?:1|2|3|4)\d{1,2}$/.test(value);
}

export function deriveRequirement(targetInfo, { sdk, runtime, defaultSdk = '10.0', requireSdk = false } = {}) {
  if (targetInfo.kind === 'executable' && !requireSdk) return { kind: 'none', version: null };
  if (targetInfo.kind === 'workspace') {
    if (targetInfo.globalJson?.sdkVersion && !sdk) {
      return { kind: 'sdk', version: targetInfo.globalJson.sdkVersion, exact: true, source: 'global.json' };
    }
    return { kind: 'sdk', version: String(sdk ?? defaultSdk), exact: String(sdk ?? defaultSdk).split('.').length >= 3, source: sdk ? 'explicit' : 'default' };
  }
  if (sdk) return { kind: 'sdk', version: String(sdk), exact: String(sdk).split('.').length >= 3 };

  if (requireSdk || targetInfo.kind === 'project' || targetInfo.kind === 'solution') {
    if (targetInfo.globalJson?.sdkVersion) {
      return { kind: 'sdk', version: targetInfo.globalJson.sdkVersion, exact: true, source: 'global.json' };
    }
    const fromTfm = majorMinorFromTfm(targetInfo.targetFrameworks?.[0]);
    return { kind: 'sdk', version: fromTfm ?? defaultSdk, exact: false, source: fromTfm ? 'target-framework' : 'default' };
  }

  if (targetInfo.kind === 'assembly') {
    const framework = targetInfo.runtimeFramework;
    const version = runtime ?? framework?.version ?? defaultSdk;
    return {
      kind: 'runtime',
      version: String(version),
      exact: Boolean(runtime && String(runtime).split('.').length >= 3),
      frameworkName: framework?.name ?? 'Microsoft.NETCore.App',
      source: framework ? 'runtimeconfig' : 'default'
    };
  }

  return { kind: 'sdk', version: defaultSdk, exact: false, source: 'default' };
}
