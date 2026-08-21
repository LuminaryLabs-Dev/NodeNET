import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { ProcessStartError, ProcessTimeoutError } from '../errors.js';

const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;

function appendLimited(current, chunk, maxBuffer) {
  const next = current + chunk;
  if (Buffer.byteLength(next) <= maxBuffer) return next;
  const buffer = Buffer.from(next);
  return buffer.subarray(buffer.length - maxBuffer).toString('utf8');
}

export function runProcess(command, args = [], options = {}) {
  const {
    cwd,
    env = process.env,
    input,
    timeout = 0,
    signal,
    maxBuffer = DEFAULT_MAX_BUFFER,
    windowsHide = true
  } = options;

  return new Promise((resolve, reject) => {
    const started = performance.now();
    let stdout = '';
    let stderr = '';
    let settled = false;
    let timedOut = false;
    let timer = null;

    let child;
    try {
      child = spawn(command, args, {
        cwd,
        env,
        shell: false,
        windowsHide,
        stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (cause) {
      reject(new ProcessStartError(`Failed to start ${command}.`, {
        cause,
        details: { command, args, cwd }
      }));
      return;
    }

    const abort = () => {
      if (!child.killed) child.kill('SIGTERM');
    };
    if (signal?.aborted) abort();
    else signal?.addEventListener('abort', abort, { once: true });

    if (timeout > 0) {
      timer = setTimeout(() => {
        timedOut = true;
        if (!child.killed) child.kill('SIGTERM');
        setTimeout(() => {
          if (!settled) child.kill('SIGKILL');
        }, 1000).unref?.();
      }, timeout);
      timer.unref?.();
    }

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => { stdout = appendLimited(stdout, chunk, maxBuffer); });
    child.stderr.on('data', chunk => { stderr = appendLimited(stderr, chunk, maxBuffer); });

    child.on('error', cause => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new ProcessStartError(`Failed to execute ${command}.`, {
        cause,
        details: { command, args, cwd }
      }));
    });

    child.on('close', (exitCode, closeSignal) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      const durationMs = Math.round(performance.now() - started);

      if (timedOut) {
        reject(new ProcessTimeoutError(`${command} exceeded the ${timeout}ms timeout.`, {
          details: { command, args, cwd, stdout, stderr, durationMs }
        }));
        return;
      }

      resolve({
        ok: exitCode === 0,
        command,
        args: [...args],
        cwd: cwd ?? process.cwd(),
        exitCode,
        signal: closeSignal,
        durationMs,
        stdout,
        stderr,
        diagnostics: []
      });
    });

    if (input !== undefined && input !== null) child.stdin.end(String(input));
    else child.stdin.end();
  });
}
