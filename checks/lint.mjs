import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Runs ESLint (no-undef) over packages/. Config: checks/eslint.config.cjs.
// scripts/run-checks.mjs runs every .js / .mjs under checks/, so this file is picked up by `npm run check`.
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = spawnSync(
  process.execPath,
  [
    path.join(repo, 'node_modules/eslint/bin/eslint.js'),
    '--config', path.join(repo, 'checks/eslint.config.cjs'),
    '--max-warnings', '0',
    'packages',
  ],
  { encoding: 'utf8', cwd: repo },
);

if (result.error) throw result.error;
if (result.status) {
  process.stdout.write(result.stdout || '');
  process.stderr.write(result.stderr || 'eslint failed\n');
  process.exit(result.status);
}
console.log('ok eslint no-undef');
