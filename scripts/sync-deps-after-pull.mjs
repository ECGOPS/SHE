#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * After git pull / merge / checkout, install packages when the lockfile or
 * package manifests changed. Prevents missing deps like @fontsource-variable/inter.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const lockfile = join(root, 'package-lock.json');
if (!existsSync(lockfile)) process.exit(0);

const hook = process.argv[2] ?? 'post-merge';
const changed = dependencyFilesChanged(hook);
if (!changed) process.exit(0);

console.log(`[deps] ${hook}: package files changed — running npm install…`);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['install'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
process.exit(result.status ?? 1);

function dependencyFilesChanged(kind) {
  const patterns = ['package.json', 'package-lock.json', 'apps/*/package.json', 'packages/*/package.json'];
  if (kind === 'post-checkout') {
    const previous = process.env.GIT_PREVIOUS_HEAD;
    const next = process.env.GIT_NEW_HEAD;
    if (!previous || !next || previous === next) return false;
    return filesChangedBetween(previous, next, patterns);
  }
  // post-merge / post-rewrite: compare ORIG_HEAD to HEAD when available
  const hasOrig = spawnSync('git', ['rev-parse', '--verify', 'ORIG_HEAD'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (hasOrig.status !== 0) return true;
  return filesChangedBetween('ORIG_HEAD', 'HEAD', patterns);
}

function filesChangedBetween(from, to, patterns) {
  const listed = spawnSync('git', ['diff-tree', '-r', '--name-only', '--no-commit-id', from, to], {
    cwd: root,
    encoding: 'utf8',
  });
  if (listed.status !== 0) return true;
  const files = listed.stdout.split(/\r?\n/).filter(Boolean);
  return files.some((file) =>
    patterns.some((pattern) => matchGlob(file, pattern)),
  );
}

function matchGlob(file, pattern) {
  if (!pattern.includes('*')) return file === pattern || file.endsWith(`/${pattern}`);
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '[^/]+');
  return new RegExp(`^${escaped}$`).test(file);
}
