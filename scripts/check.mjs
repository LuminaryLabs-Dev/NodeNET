import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
if (packageJson.type !== 'module') throw new Error('package.json must keep "type": "module".');
if (packageJson.exports?.['.'] !== './src/index.js') throw new Error('Package root export must remain ./src/index.js.');

const required = [
  'src/index.js',
  'src/nodenet.js',
  'src/dotnet/provision.js',
  'src/project/prepare.js',
  'bridge/NodeNET.Bridge/NodeNET.Bridge.csproj'
];
for (const relative of required) await fs.access(path.join(root, relative));

const script = path.join(root, 'scripts', 'run-tests.mjs');
const child = spawn(process.execPath, [script, 'unit'], {
  cwd: root,
  stdio: 'inherit',
  shell: false
});
child.on('exit', code => process.exit(code ?? 1));
