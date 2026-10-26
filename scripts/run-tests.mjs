import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.join(repo, 'tests');

function listTests(dir, out) {
  for (const name of readdirSync(dir).sort()) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      listTests(full, out);
      continue;
    }
    if (name.endsWith('.test.js') || name.endsWith('.test.mjs') || name.startsWith('test_') && name.endsWith('.py')) {
      out.push(full);
    }
  }
}

const files = [];
listTests(root, files);
if (!files.length) {
  console.error('no tests');
  process.exit(1);
}

let failed = 0;
for (const file of files) {
  const cmd = file.endsWith('.py') ? ['python3', file] : [process.execPath, file];
  const result = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit', cwd: repo });
  if (result.status) {
    failed += 1;
    console.error('FAIL', path.relative(repo, file));
  }
}
if (failed) {
  console.error(failed + '/' + files.length + ' failed');
  process.exit(1);
}
console.log('ok', files.length, 'tests');
