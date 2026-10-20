#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Resilient dev runner for the ECG SHE API.
 *
 * `nest start --watch` (which we use under the hood) recompiles TypeScript on
 * file change and respawns `node dist/main.js`. On Windows this commonly
 * leaves a previous child squatting the API port for a few seconds — and on
 * a slow restart the next child fails with `EADDRINUSE` and the watcher
 * just sits there idle, never trying again until the next file change.
 *
 * This wrapper:
 *   1. Pre-flight: frees the API port (4000 by default) before starting.
 *   2. Spawns `nest start --watch` and pipes its output through.
 *   3. Watches the output for `EADDRINUSE`. When detected it (a) frees the
 *      port and (b) "touches" `src/main.ts` to nudge the tsc-watch pipeline
 *      into a fresh recompile + spawn cycle.
 *   4. If the watcher itself exits unexpectedly, it restarts it (capped
 *      at 5 retries with a 1.5 s backoff).
 *   5. Forwards Ctrl-C / SIGTERM so the watcher dies cleanly.
 */
import { spawn, execSync } from 'node:child_process';
import { platform } from 'node:os';
import { utimesSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const PORT = Number(process.env.API_PORT ?? process.env.PORT ?? 4000);
const MAX_RESTARTS = 5;
const BACKOFF_MS = 1500;
const TOUCH_FILE = resolve(join(process.cwd(), 'src', 'main.ts'));
const READDR_DEBOUNCE_MS = 8000;

function freePort(port) {
  try {
    if (platform() === 'win32') {
      const out = execSync(
        `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique"`,
        { stdio: ['ignore', 'pipe', 'ignore'] },
      ).toString();
      const pids = [...new Set(out.split(/\s+/).map((s) => s.trim()).filter(Boolean))];
      for (const pid of pids) {
        try {
          execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' });
          console.log(`[dev] freed port ${port} (killed PID ${pid})`);
        } catch {
          /* ignore */
        }
      }
    } else {
      try {
        execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* nothing to free */
  }
}

/** Touch a watched file so tsc-watch starts a fresh compile + respawn cycle. */
function nudgeWatcher() {
  if (!existsSync(TOUCH_FILE)) return;
  try {
    const now = new Date();
    utimesSync(TOUCH_FILE, now, now);
    console.log('[dev] nudged watcher (touched src/main.ts)');
  } catch (err) {
    console.warn('[dev] failed to nudge watcher:', err?.message ?? err);
  }
}

let child = null;
let restarts = 0;
let stopping = false;
let lastRecover = 0;

function handleStream(stream) {
  if (!stream) return;
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => {
    process.stdout.write(chunk);
    if (chunk.includes('EADDRINUSE')) {
      const now = Date.now();
      if (now - lastRecover < READDR_DEBOUNCE_MS) return;
      lastRecover = now;
      console.log(`[dev] EADDRINUSE detected on :${PORT} — recovering…`);
      freePort(PORT);
      // Give the OS a moment to actually release the socket before
      // touching main.ts to trigger a recompile/respawn.
      setTimeout(nudgeWatcher, 800);
    }
  });
}

function start() {
  freePort(PORT);
  console.log(`[dev] starting nest start --watch (api on :${PORT})`);
  child = spawn('nest', ['start', '--watch'], {
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: true,
    env: process.env,
  });
  handleStream(child.stdout);
  handleStream(child.stderr);
  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.log(`[dev] watcher exited (code=${code}, signal=${signal ?? 'none'})`);
    if (restarts >= MAX_RESTARTS) {
      console.error(`[dev] giving up after ${restarts} restarts`);
      process.exit(code ?? 1);
    }
    restarts += 1;
    setTimeout(start, BACKOFF_MS);
  });
}

function stop(signal) {
  stopping = true;
  if (child) {
    try {
      child.kill(signal ?? 'SIGINT');
    } catch {
      /* ignore */
    }
  }
  setTimeout(() => process.exit(0), 500);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));

start();
