import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = path.join(repo, 'checks');
if (!existsSync(checks)) {
  console.log('ok check (no checks/ yet)');
  process.exit(0);
}

function listChecks(dir, out) {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      listChecks(full, out);
      continue;
    }
    if (name.endsWith('.test.js') || name.endsWith('.test.mjs') || name.endsWith('.js') || name.endsWith('.mjs')) {
      out.push(full);
    }
  }
}

const files = [];
listChecks(checks, files);
if (!files.length) {
  console.log('ok check (checks/ empty)');
  process.exit(0);
}

let failed = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit', cwd: repo });
  if (result.status) {
    failed += 1;
    console.error('FAIL', path.relative(repo, file));
  }
}
if (failed) {
  console.error(failed + '/' + files.length + ' failed');
  process.exit(1);
}
console.log('ok', files.length, 'checks');
