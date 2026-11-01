import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const toml = readFileSync(path.join(repo, 'packages/sandbox-app/wrangler.toml'), 'utf8');
const live = toml.split('\n').filter((line) => !line.trim().startsWith('#')).join('\n');

assert.match(live, /^name = "lulu-board-sandbox"$/m, 'Worker name matches the Workers Builds project');
assert.match(live, /^directory = "\.\.\/\.\.\/\.cache\/sandbox\/"$/m, 'assets come from the sandbox build, not the web build');
assert.doesNotMatch(live, /\.cache\/web/, 'the sandbox never serves the Board site');
assert.doesNotMatch(live, /^main\s*=/m, 'static assets only: no Worker code runs on this domain');
assert.match(live, /^workers_dev = false$/m, 'no workers.dev copy of the runner');
assert.match(live, /pattern = "sandbox\.luluboard\.app"\s*\ncustom_domain = true/, 'the whole domain is the runner');

console.log('ok sandbox wrangler');
