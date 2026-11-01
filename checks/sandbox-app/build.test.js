import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(repo, '.cache/sandbox');
const run = spawnSync(process.execPath, [path.join(repo, 'scripts/build-sandbox/build.mjs')], { encoding: 'utf8' });
assert.equal(run.status, 0, run.stderr);

const names = readdirSync(out).sort();
const js = names.filter((n) => /^runner-[0-9a-f]{8}\.js$/.test(n));
assert.equal(js.length, 1, 'one hashed runner bundle');
assert.ok(names.includes('runner.html'), 'runner.html is shipped');
assert.equal(names.length, 2, 'nothing else is shipped: ' + names.join(', '));

const html = readFileSync(path.join(out, 'runner.html'), 'utf8');
assert.ok(html.includes('src="./' + js[0] + '"'), 'html points at the hashed bundle');
assert.doesNotMatch(html, /\.\/runner\.js/, 'no unhashed reference left');
assert.doesNotMatch(html, /type="module"/, 'classic script: an opaque origin needs no CORS to load it');
assert.doesNotMatch(html, /<meta[^>]+(Content-Security-Policy|http-equiv)/i, 'CSP is a response header, not a meta tag');

const bundle = readFileSync(path.join(out, js[0]), 'utf8');
assert.doesNotMatch(bundle, /^\s*(import|export)\s/m, 'bundle has no module syntax');
assert.match(bundle, /lulu-sandbox:render/, 'bundle carries the protocol');
assert.doesNotMatch(bundle, /import\(/, 'no dynamic import: that would need CORS from an opaque origin');

console.log('ok sandbox build');
