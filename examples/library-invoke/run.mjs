import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NodeNET } from '../../src/index.js';

const directory = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(directory, 'Library.csproj');
const net = await NodeNET.attach(project, {
  mode: 'temporary',
  isolation: 'managed',
  sdk: '10.0',
  writeState: false
});

try {
  await net.prepare();
  await net.build({ configuration: 'Release' });
  const library = await net.library(path.join(directory, 'bin', 'Release', 'net10.0', 'Library.dll'));
  const response = await library.invoke({
    type: 'Example.Calculator',
    method: 'Add',
    arguments: [5, 8]
  });
  console.log(response.result);
  await library.close();
} finally {
  await net.dispose();
}
