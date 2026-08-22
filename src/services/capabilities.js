export class CapabilityService {
  snapshot({ context = null, targetInfo = null, host = null, execution = null, display = null } = {}) {
    const workloads = context?.workloads ?? { required: [], installed: [], missing: [] };
    const nativeAssets = context?.nativeAssets ?? { checked: false, assets: [] };
    const sdkVersions = context?.dotnet?.info?.sdks?.map(item => item.version) ?? [];
    const runtimeVersions = context?.dotnet?.info?.runtimes?.map(item => `${item.name} ${item.version}`) ?? [];
    const projectLike = ['project', 'solution'].includes(targetInfo?.kind);
    const hasDotnet = Boolean(context?.dotnet);
    return {
      ready: context ? Boolean(context.ready) : false,
      host: host ? { platform: host.platform, arch: host.arch, rid: host.rid, libc: host.libc ?? null } : null,
      dotnet: { available: hasDotnet, source: context?.dotnet?.source ?? null, sdk: sdkVersions.length > 0, sdkVersions, runtime: runtimeVersions.length > 0, runtimeVersions },
      project: { kind: targetInfo?.kind ?? null, restore: projectLike ? Boolean(context?.restoreResult?.ok) : false, build: projectLike && hasDotnet, run: Boolean(targetInfo?.runnable && (hasDotnet || targetInfo?.kind === 'executable')) },
      gui: { desktop: Boolean(host?.desktopGui), headless: Boolean(host?.headlessGui), reason: host?.desktopReason ?? null },
      workloads,
      native: nativeAssets,
      execution: { available: Boolean(execution), kind: execution?.kind ?? execution?.constructor?.name ?? null, provider: execution?.constructor?.name ?? null, sandboxed: execution?.sandboxed === true },
      display: display?.capabilities?.() ?? { available: false },
      warnings: [...(context?.readinessWarnings ?? [])]
    };
  }
}
