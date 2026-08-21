import path from 'node:path';
import { resolveDotnetHost } from '../dotnet/resolve.js';
import { provisionDotnet } from '../dotnet/provision.js';
import { verifyDotnet } from '../dotnet/verify.js';
import { DotnetResolutionError } from '../errors.js';

export class DotNetEnvironmentService {
  constructor({ execution } = {}) {
    this.execution = execution ?? null;
  }

  async ensure({ requirement, host, paths, options = {} } = {}) {
    if (!requirement || requirement.kind === 'none') return { dotnet: null, provisioned: false };

    const isolation = options.isolation ?? 'auto';
    let dotnet = await resolveDotnetHost({
      requirement,
      paths,
      isolation,
      dotnetPath: options.dotnetPath,
      dotnetArgsPrefix: options.dotnetArgsPrefix,
      env: options.env ?? process.env
    });

    let provisioned = false;
    if (!dotnet) {
      if (isolation === 'system') {
        throw new DotnetResolutionError('No compatible system .NET installation satisfies the target requirement.');
      }
      dotnet = await provisionDotnet({
        requirement,
        host,
        paths,
        env: options.env ?? process.env,
        offline: options.offline ?? false,
        artifactPath: options.artifactPath,
        expectedHash: options.expectedHash,
        fetchImpl: options.fetchImpl,
        signal: options.signal,
        onProgress: options.onProgress
      });
      provisioned = !dotnet.reused;
    }

    dotnet.info = dotnet.info ?? await verifyDotnet({
      path: dotnet.path,
      argsPrefix: dotnet.argsPrefix,
      env: dotnet.env
    });
    dotnet.root ??= path.dirname(dotnet.path);
    dotnet.executor = this.execution;
    return { dotnet, provisioned };
  }
}
