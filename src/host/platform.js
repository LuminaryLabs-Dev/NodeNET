import { UnsupportedHostError } from '../errors.js';

const RID_MAP = new Map([
  ['win32:x64', 'win-x64'],
  ['win32:arm64', 'win-arm64'],
  ['darwin:x64', 'osx-x64'],
  ['darwin:arm64', 'osx-arm64']
]);

function detectLinuxLibc() {
  try {
    const report = process.report?.getReport?.();
    if (report?.header?.glibcVersionRuntime) return 'glibc';
  } catch {
    // Fall through to musl. Node builds without process.report are uncommon.
  }
  return 'musl';
}

export function detectHost({ platform = process.platform, arch = process.arch, env = process.env } = {}) {
  let libc = null;
  let rid = RID_MAP.get(`${platform}:${arch}`) ?? null;

  if (platform === 'linux' && (arch === 'x64' || arch === 'arm64')) {
    libc = detectLinuxLibc();
    rid = libc === 'musl' ? `linux-musl-${arch}` : `linux-${arch}`;
  }

  if (!rid) {
    throw new UnsupportedHostError(`NodeNET does not support ${platform}/${arch}.`, {
      details: { platform, arch }
    });
  }

  let desktopGui = true;
  let desktopReason = null;
  if (platform === 'linux' && !env.DISPLAY && !env.WAYLAND_DISPLAY) {
    desktopGui = false;
    desktopReason = 'No DISPLAY or WAYLAND_DISPLAY is available.';
  }

  return {
    platform,
    arch,
    libc,
    rid,
    desktopGui,
    desktopReason,
    headlessGui: true
  };
}
