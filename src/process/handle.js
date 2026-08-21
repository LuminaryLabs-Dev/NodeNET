import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { performance } from 'node:perf_hooks';
import { ProcessStartError } from '../errors.js';

const DEFAULT_MAX_BUFFER = 16 * 1024 * 1024;

function appendLimited(current, chunk, maxBuffer) {
  const next = current + chunk;
  if (Buffer.byteLength(next) <= maxBuffer) return next;
  const buffer = Buffer.from(next);
  return buffer.subarray(buffer.length - maxBuffer).toString('utf8');
}

export class ProcessHandle extends EventEmitter {
  constructor(child, { command, args, cwd, maxBuffer = DEFAULT_MAX_BUFFER, started, binaryStdout = false }) {
    super();
    this.child = child;
    this.command = command;
    this.args = [...args];
    this.cwd = cwd ?? process.cwd();
    this.maxBuffer = maxBuffer;
    this.binaryStdout = binaryStdout;
    this.stdout = '';
    this.stderr = '';
    this.running = true;
    this.exitCode = null;
    this.signal = null;
    this.pid = child.pid;

    this._wait = new Promise((resolve, reject) => {
      child.on('error', cause => {
        this.running = false;
        const error = new ProcessStartError(`Failed to execute ${command}.`, {
          cause,
          details: { command, args, cwd }
        });
        if (this.listenerCount('error') > 0) this.emit('error', error);
        else this.emit('processError', error);
        reject(error);
      });

      child.on('close', (exitCode, signal) => {
        this.running = false;
        this.exitCode = exitCode;
        this.signal = signal;
        const result = {
          ok: exitCode === 0,
          command,
          args: [...args],
          cwd: this.cwd,
          exitCode,
          signal,
          durationMs: Math.round(performance.now() - started),
          stdout: this.stdout,
          stderr: this.stderr,
          diagnostics: []
        };
        this.emit('exit', result);
        resolve(result);
      });
    });

    if (!binaryStdout) child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', chunk => {
      if (!binaryStdout) this.stdout = appendLimited(this.stdout, chunk, maxBuffer);
      this.emit('stdout', chunk);
    });
    child.stderr.on('data', chunk => {
      this.stderr = appendLimited(this.stderr, chunk, maxBuffer);
      this.emit('stderr', chunk);
    });
  }

  write(data) {
    if (!this.running || this.child.stdin.destroyed) return false;
    return this.child.stdin.write(data);
  }

  closeStdin() {
    if (!this.child.stdin.destroyed) this.child.stdin.end();
  }

  async stop() {
    if (this.running) this.child.kill('SIGTERM');
    return this.wait();
  }

  async kill() {
    if (this.running) this.child.kill('SIGKILL');
    return this.wait();
  }

  wait() {
    return this._wait;
  }
}

export function spawnManagedProcess(command, args = [], options = {}) {
  const {
    cwd,
    env = process.env,
    maxBuffer = DEFAULT_MAX_BUFFER,
    windowsHide = true,
    signal,
    binaryStdout = false
  } = options;

  const started = performance.now();
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
    throw new ProcessStartError(`Failed to start ${command}.`, {
      cause,
      details: { command, args, cwd }
    });
  }

  const handle = new ProcessHandle(child, { command, args, cwd, maxBuffer, started, binaryStdout });
  if (signal) {
    const abort = () => child.kill('SIGTERM');
    if (signal.aborted) abort();
    else {
      signal.addEventListener('abort', abort, { once: true });
      handle.once('exit', () => signal.removeEventListener('abort', abort));
    }
  }
  return handle;
}
