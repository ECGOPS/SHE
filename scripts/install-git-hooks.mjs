#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Writes local git hooks that call sync-deps-after-pull.mjs.
 * Safe to re-run; does not change git config.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, chmodSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' });
if (top.status !== 0) {
  console.log('[hooks] not a git checkout — skip');
  process.exit(0);
}
const root = top.stdout.trim();
const hooksDir = join(root, '.git', 'hooks');
if (!existsSync(join(root, '.git'))) {
  console.log('[hooks] .git missing — skip');
  process.exit(0);
}
mkdirSync(hooksDir, { recursive: true });

const syncScript = 'scripts/sync-deps-after-pull.mjs';

const hooks = {
  'post-merge': `#!/bin/sh
# Installed by scripts/install-git-hooks.mjs — runs npm install when deps change.
cd "$(git rev-parse --show-toplevel)" || exit 0
node ${syncScript} post-merge
`,
  'post-checkout': `#!/bin/sh
# Installed by scripts/install-git-hooks.mjs — runs npm install when deps change.
# $1 previous HEAD, $2 new HEAD, $3 1 if branch checkout
previous="$1"
next="$2"
branch="$3"
[ "$branch" = "1" ] || exit 0
[ "$previous" != "$next" ] || exit 0
cd "$(git rev-parse --show-toplevel)" || exit 0
GIT_PREVIOUS_HEAD="$previous" GIT_NEW_HEAD="$next" node ${syncScript} post-checkout
`,
};

for (const [name, body] of Object.entries(hooks)) {
  const path = join(hooksDir, name);
  writeFileSync(path, body.replace(/\r\n/g, '\n'), { encoding: 'utf8' });
  try {
    chmodSync(path, 0o755);
  } catch {
    // Windows may ignore chmod; Git Bash still runs the hook.
  }
  console.log(`[hooks] installed ${name}`);
}
