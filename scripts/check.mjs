import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const packageLock = JSON.parse(await fs.readFile(path.join(root, 'package-lock.json'), 'utf8'));
if (packageJson.type !== 'module') throw new Error('package.json must keep "type": "module".');
if (packageJson.exports?.['.'] !== './src/index.js') throw new Error('Package root export must remain ./src/index.js.');
if (packageJson.bin?.nodenet !== './bin/nodenet.js') throw new Error('The nodenet executable mapping must remain ./bin/nodenet.js.');
if (packageJson.version !== packageLock.version || packageJson.version !== packageLock.packages?.['']?.version) throw new Error('package.json and package-lock.json versions must match.');

const required = ['src/index.js','src/nodenet.js','src/kernel/registry.js','src/services/names.js','src/services/execution.js','src/services/environment.js','src/services/project.js','src/cli/cli.js','src/interop/protocol/framing.js','src/dotnet/provision.js','src/project/prepare.js','bridge/NodeNET.Bridge/NodeNET.Bridge.csproj'];
for (const relative of required) await fs.access(path.join(root, relative));

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
