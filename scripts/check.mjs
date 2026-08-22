import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
if (packageJson.type !== 'module') throw new Error('package.json must keep "type": "module".');
if (packageJson.exports?.['.']?.types !== './types/index.d.ts') throw new Error('Package root export must expose ./types/index.d.ts to modern TypeScript consumers.');
if (packageJson.exports?.['.']?.import !== './src/index.js' || packageJson.exports?.['.']?.default !== './src/index.js') {
  throw new Error('Package root runtime exports must remain ./src/index.js.');
}
if (packageJson.bin?.nodenet !== './bin/nodenet.js') throw new Error('The nodenet executable mapping must remain ./bin/nodenet.js.');
if (packageJson.types !== './types/index.d.ts') throw new Error('Package TypeScript declarations must remain ./types/index.d.ts.');
if (!packageJson.files?.includes('types')) throw new Error('Published package files must include TypeScript declarations.');
if (!packageJson.repository?.url || !packageJson.homepage || !packageJson.bugs?.url) throw new Error('Public package repository/homepage/bugs metadata is required.');
if (packageJson.version !== packageLock.version || packageJson.version !== packageLock.packages?.['']?.version) throw new Error('package.json and package-lock.json versions must match.');

const required = [
  'src/index.js','src/nodenet.js','src/version.js','src/cache.js',
  'src/kernel/registry.js','src/services/names.js','src/services/contracts.js',
  'src/services/execution.js','src/services/environment.js','src/services/project.js',
  'src/services/display.js','src/plugins/display-software.js','src/display/frame.js','src/display/surface.js',
  'src/display/rasterizer.js','src/display/input.js','src/display/png.js','src/display/process-adapter.js','src/display/validation.js',
  'src/cli/cli.js','src/cli/help.js','src/cli/progress.js',
  'src/interop/protocol/framing.js','src/dotnet/provision.js','src/project/prepare.js',
  'bridge/NodeNET.Bridge/NodeNET.Bridge.csproj','bridge/NodeNET.Display/NodeNET.Display.csproj','bridge/NodeNET.Display/NodeNETDisplay.cs','types/index.d.ts',
  'CHANGELOG.md','CONTRIBUTING.md','SECURITY.md','CODE_OF_CONDUCT.md',
  'docs/CURRENT_STATE.md','docs/DISPLAY.md','docs/VALIDATION.md','docs/ROADMAP.md'
];
for (const relative of required) await fs.access(path.join(root, relative));
const declarations = await fs.readFile(path.join(root, 'types', 'index.d.ts'), 'utf8');
if (!declarations.includes('constructor(options: DisplaySurfaceOptions);')) {
  throw new Error('FrameSurface declarations must expose the public constructor used by package consumers.');
}

async function collect(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collect(full));
    else if (entry.isFile() && /\.(?:mjs|js)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, stdio: options.stdio ?? 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? resolve() : reject(new Error(`${command} ${args.join(' ')} exited with ${code}`)));
  });
}

for (const directory of ['src','bin','scripts','test']) {
  for (const file of await collect(path.join(root, directory))) await run(process.execPath, ['--check', file], { stdio: 'ignore' });
}
await run(process.execPath, [path.join(root, 'scripts', 'run-tests.mjs'), 'unit']);
