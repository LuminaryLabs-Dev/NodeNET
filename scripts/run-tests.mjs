import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const suite = process.argv[2] ?? 'unit';
const directory = path.join(root, 'test', suite);
const files = (await fs.readdir(directory))
  .filter(file => file.endsWith('.test.mjs'))
  .sort()
  .map(file => path.join(directory, file));

if (!files.length) {
  console.error(`No ${suite} tests found.`);
  process.exit(1);
}

const child = spawn(process.execPath, ['--test', ...files], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
  shell: false
});
child.on('exit', code => process.exit(code ?? 1));
