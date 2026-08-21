#!/usr/bin/env node
import { NodeNET } from '../src/index.js';

const [command = 'info', target = '.', ...rest] = process.argv.slice(2);
const net = await NodeNET.attach(target);

try {
  if (command === 'info') {
    console.log(JSON.stringify(await net.info(), null, 2));
  } else if (command === 'prepare') {
    const context = await net.prepare();
    console.log(JSON.stringify({ ready: context.ready, state: context.state, warnings: context.readinessWarnings }, null, 2));
  } else if (command === 'restore') {
    console.log(JSON.stringify(await net.restore(), null, 2));
  } else if (command === 'build') {
    console.log(JSON.stringify(await net.build(), null, 2));
  } else if (command === 'test') {
    console.log(JSON.stringify(await net.test(), null, 2));
  } else if (command === 'publish') {
    console.log(JSON.stringify(await net.publish(), null, 2));
  } else if (command === 'clean') {
    console.log(JSON.stringify(await net.clean(), null, 2));
  } else if (command === 'run') {
    const handle = await net.run({ args: rest });
    handle.on('stdout', chunk => process.stdout.write(chunk));
    handle.on('stderr', chunk => process.stderr.write(chunk));
    const result = await handle.wait();
    process.exitCode = result.exitCode ?? 1;
  } else if (command === 'exec') {
    console.log(JSON.stringify(await net.exec(rest), null, 2));
  } else {
    console.error('Usage: nodenet <info|prepare|restore|build|test|publish|clean|run|exec> [target] [...args]');
    process.exitCode = 2;
  }
} finally {
  await net.dispose();
}
