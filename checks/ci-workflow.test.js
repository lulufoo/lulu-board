import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const yml = fs.readFileSync(path.join(repo, '.github/workflows/ci.yml'), 'utf8');

assert.match(yml, /npm ci/, 'CI installs from the lockfile');
assert.match(yml, /npm run build/, 'CI runs build');
assert.match(yml, /npm test/, 'CI runs test');
assert.match(yml, /npm run check/, 'CI runs check');
assert.doesNotMatch(yml, /continue-on-error:\s*true/, 'a failing step fails the job');

console.log('ok ci-workflow');
