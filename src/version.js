import fs from 'node:fs/promises';

const PACKAGE_JSON = new URL('../package.json', import.meta.url);
let versionPromise;

export function packageVersion() {
  versionPromise ??= fs.readFile(PACKAGE_JSON, 'utf8')
    .then(text => JSON.parse(text).version);
  return versionPromise;
}
