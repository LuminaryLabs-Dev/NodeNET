import { fileURLToPath } from 'node:url';
import { NodeNET } from '../../src/index.js';

const app = await NodeNET.attach(fileURLToPath(new URL('./Hello.csproj', import.meta.url)), {
  mode: 'temporary',
  isolation: 'managed',
  sdk: '10.0',
  writeState: false
});

try {
  await app.prepare();
  await app.build();
  const processHandle = await app.run();
  processHandle.on('stdout', chunk => process.stdout.write(chunk));
  await processHandle.wait();
} finally {
  await app.dispose();
}
