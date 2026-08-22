function formatBytes(value) {
  if (!Number.isFinite(value)) return null;
  const units = ['B','KB','MB','GB'];
  let amount = value;
  let index = 0;
  while (amount >= 1024 && index < units.length - 1) {
    amount /= 1024;
    index += 1;
  }
  return `${amount >= 10 || index === 0 ? amount.toFixed(0) : amount.toFixed(1)} ${units[index]}`;
}

export function formatProgress(event = {}) {
  switch (event.phase) {
    case 'resolve':
      return `Resolving .NET ${event.requirement?.kind ?? ''} ${event.requirement?.version ?? ''}${event.rid ? ` for ${event.rid}` : ''}`.trim();
    case 'artifact':
      return `Selected .NET ${event.artifact?.version ?? event.requirement?.version ?? ''}${event.artifact?.rid ? ` (${event.artifact.rid})` : ''}`.trim();
    case 'download': {
      const received = formatBytes(event.received);
      const total = formatBytes(event.total);
      const percent = event.total ? Math.floor((event.received / event.total) * 100) : null;
      return `Downloading .NET${received ? ` — ${received}` : ''}${total ? ` / ${total}` : ''}${percent !== null ? ` (${percent}%)` : ''}`;
    }
    case 'verify':
      return 'Verifying .NET integrity/runtime';
    case 'extract':
      return 'Extracting .NET';
    case 'reuse':
      return `Reusing ${event.source ?? 'managed'} .NET${event.version ? ` ${event.version}` : ''}`;
    case 'ready':
      return `.NET ready${event.version ? ` — ${event.version}` : ''}${event.source ? ` (${event.source})` : ''}`;
    default:
      return null;
  }
}

export function createProgressReporter(io = { stderr: process.stderr }) {
  let lastKey = null;
  let lastPercent = -1;
  return event => {
    if (event?.phase === 'download' && event.total) {
      const percent = Math.floor((event.received / event.total) * 100);
      if (percent < 100 && percent - lastPercent < 5) return;
      lastPercent = percent;
    }
    const message = formatProgress(event);
    if (!message) return;
    const key = event.phase === 'download' ? `${event.phase}:${lastPercent}` : `${event.phase}:${message}`;
    if (key === lastKey) return;
    lastKey = key;
    io.stderr.write(`NodeNET: ${message}\n`);
  };
}
