import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = path.join(repo, 'checks/dependency-cruiser.cjs');
const rules = createRequire(import.meta.url)('./dependency-cruiser.cjs');
if ((rules.forbidden || []).some((rule) => rule.severity !== 'error')) {
  console.error('depcruise rules must be error');
  process.exit(1);
}
const result = spawnSync(
  process.execPath,
  [
    path.join(repo, 'node_modules/dependency-cruiser/bin/dependency-cruise.mjs'),
    '--config', config,
    '--output-type', 'json',
    'packages',
  ],
  { encoding: 'utf8', cwd: repo, maxBuffer: 20 * 1024 * 1024 },
);

if (result.error) throw result.error;
if (result.status && !result.stdout) {
  process.stderr.write(result.stderr || 'depcruise failed\n');
  process.exit(result.status);
}

const data = JSON.parse(result.stdout);
const modules = data.modules || [];
const violations = (data.summary && data.summary.violations) || [];
const edges = [];
for (const mod of modules) {
  const from = String(mod.source || '');
  for (const dep of mod.dependencies || []) {
    if (dep.dependencyTypes && dep.dependencyTypes.includes('unknown')) continue;
    edges.push({ from, to: String(dep.resolved || dep.module || '') });
  }
}

const cross = edges.filter((e) => {
  const a = e.from.split('/')[1];
  const b = e.to.split('/')[1];
  return e.from.startsWith('packages/') && e.to.startsWith('packages/') && a && b && a !== b;
});

console.log('ok depcruise');
console.log('modules', modules.length);
console.log('violations', violations.length);
for (const v of violations) {
  console.log(' error', v.rule && v.rule.name, v.from, '->', v.to);
}
if (violations.length) {
  process.exit(1);
}
console.log('cross-package import edges', cross.length);
for (const e of cross) console.log('  ', e.from, '->', e.to);
