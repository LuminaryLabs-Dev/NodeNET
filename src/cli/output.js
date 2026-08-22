function line(label, value) {
  return `${String(label).padEnd(14)}${value ?? '-'}`;
}

function formatBytes(value = 0) {
  const units = ['B','KB','MB','GB','TB'];
  let amount = Number(value) || 0;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

export function formatPrepare(context) {
  const sdk = context.dotnet?.info?.sdks?.at(-1)?.version ?? 'runtime-only';
  return [
    'NodeNET',
    '',
    line('Target', context.targetInfo.path),
    line('Host', context.host.rid),
    line('SDK', sdk),
    line('Source', context.dotnet?.source ?? 'none'),
    line('Environment', context.dotnet?.root ?? context.paths.baseDir),
    '',
    context.dotnet ? '✓ .NET ready' : '✓ No .NET requirement',
    context.restoreResult ? '✓ Restore complete' : '• Restore not required',
    context.ready ? '✓ Project ready' : '⚠ Project has readiness warnings',
    ...(context.readinessWarnings ?? []).map(item => `  - ${item}`)
  ].join('\n');
}

export function formatDoctor(report) {
  const c = report.capabilities;
  const e = report.environment;
  return [
    'NodeNET doctor',
    '',
    line('NodeNET', report.nodenet?.version),
    line('Node', report.node.version),
    line('Host', c.host?.rid),
    line('Target', report.target?.path),
    line('Target kind', report.target?.kind),
    line('.NET source', e.dotnetSource ?? 'none'),
    line('SDKs', e.sdkVersions?.join(', ') || 'none'),
    line('Runtimes', e.runtimeVersions?.join(', ') || 'none'),
    line('Execution', e.execution?.kind ? `${e.execution.kind} / ${c.execution?.sandboxed ? 'sandboxed' : 'not sandboxed'}` : c.execution?.kind),
    line('Trust', e.execution?.trust ?? 'trusted'),
    line('Desktop GUI', c.gui?.desktop ? 'available' : `unavailable${c.gui?.reason ? ` — ${c.gui.reason}` : ''}`),
    line('Headless GUI', c.gui?.headless ? 'available' : 'unavailable'),
    line('Workloads', c.workloads?.missing?.length ? `missing: ${c.workloads.missing.join(', ')}` : 'ready'),
    line('Ready', c.ready ? 'yes' : 'no'),
    ...(c.warnings ?? []).map(item => `⚠ ${item}`)
  ].join('\n');
}

export function formatCapabilities(c) {
  return [
    'NodeNET capabilities',
    '',
    line('Host', c.host?.rid),
    line('SDK', c.dotnet.sdk ? 'available' : 'not prepared'),
    line('Runtime', c.dotnet.runtime ? 'available' : 'not prepared'),
    line('Build', c.project.build ? 'supported' : 'not applicable'),
    line('Run', c.project.run ? 'supported' : 'not runnable'),
    line('Desktop GUI', c.gui?.desktop ? 'available' : 'unavailable'),
    line('Headless GUI', c.gui?.headless ? 'available' : 'unavailable'),
    line('Execution', c.execution?.kind),
    line('Sandboxed', c.execution?.sandboxed ? 'yes' : 'no')
  ].join('\n');
}

export function formatCache(result) {
  if (result.removed !== undefined || result.removedBytes !== undefined) {
    return [
      'NodeNET cache',
      '',
      line('Base', result.baseDir),
      line('Removed', formatBytes(result.removedBytes ?? 0)),
      ...(result.category ? [line('Category', result.category)] : []),
      ...(Array.isArray(result.removed) ? [line('Entries', result.removed.length)] : [])
    ].join('\n');
  }

  const categories = result.categories ?? {};
  const details = [];
  for (const [category, entries] of Object.entries(result.entries ?? {})) {
    if (!entries.length) continue;
    details.push('', `${category}:`);
    for (const entry of entries) details.push(`  ${entry.name}  ${formatBytes(entry.bytes)}`);
  }
  return [
    'NodeNET cache',
    '',
    line('Base', result.baseDir ?? 'temporary / none'),
    ...Object.entries(categories).map(([name, item]) => line(name, formatBytes(item.bytes))),
    line('Total', formatBytes(result.totalBytes ?? 0)),
    ...details
  ].join('\n');
}

export function writeResult(io, result, { json = false, formatter } = {}) {
  if (json) {
    io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (formatter) {
    io.stdout.write(`${formatter(result)}\n`);
    return;
  }
  if (result?.stdout !== undefined || result?.stderr !== undefined) {
    if (result.stdout) io.stdout.write(result.stdout);
    if (result.stderr) io.stderr.write(result.stderr);
    return;
  }
  if (typeof result === 'string') io.stdout.write(`${result}\n`);
  else io.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
