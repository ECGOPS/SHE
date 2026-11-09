#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Runs every workspace's dev server side by side.
 *
 * `npm run dev --workspaces` runs them one after another, and each dev
 * script watches forever, so only the first one ever started. This builds
 * the shared package once (the API imports its compiled `dist`), then starts
 * the shared watcher, the API and the web app together with prefixed output.
 * Ctrl-C stops all of them; if one exits, the others are stopped too.
 */
import { spawn, spawnSync } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const shell = process.platform === 'win32';

const TASKS = [
  { name: 'shared', workspace: '@ecg-she/shared', color: 35 },
  { name: 'api', workspace: '@ecg-she/api', color: 36 },
  { name: 'web', workspace: '@ecg-she/web', color: 32 },
];

console.log('[dev] building @ecg-she/shared…');
const build = spawnSync(npm, ['run', 'build', '-w', '@ecg-she/shared'], { stdio: 'inherit', shell });
if (build.status !== 0) process.exit(build.status ?? 1);

const children = [];
let stopping = false;

function stopAll(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500);
}

function pipe(stream, prefix, out) {
  let buffered = '';
  stream.on('data', (chunk) => {
    buffered += chunk.toString();
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() ?? '';
    for (const line of lines) out.write(`${prefix} ${line}\n`);
  });
  stream.on('end', () => {
    if (buffered) out.write(`${prefix} ${buffered}\n`);
  });
}

for (const task of TASKS) {
  const prefix = `\x1b[${task.color}m[${task.name}]\x1b[0m`;
  const child = spawn(npm, ['run', 'dev', '-w', task.workspace], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, FORCE_COLOR: process.env.FORCE_COLOR ?? '1' },
    shell,
  });
  pipe(child.stdout, prefix, process.stdout);
  pipe(child.stderr, prefix, process.stderr);
  child.on('exit', (code) => {
    if (stopping) return;
    console.log(`${prefix} exited with code ${code ?? 'null'}; stopping the others.`);
    stopAll(code ?? 1);
  });
  children.push(child);
}

process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
