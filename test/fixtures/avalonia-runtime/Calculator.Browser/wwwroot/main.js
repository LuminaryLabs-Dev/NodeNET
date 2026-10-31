import { dotnet } from './_framework/dotnet.js';

if (typeof window === 'undefined') {
  throw new Error('Expected to run the Avalonia app in a browser.');
}

const runtime = await dotnet.withDiagnosticTracing(false).create();
const config = runtime.getConfig();
await runtime.runMain(config.mainAssemblyName, [globalThis.location.href]);
