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
const capture = names.filter((n) => /^capture-[0-9a-f]{8}\.js$/.test(n));
assert.equal(capture.length, 1, 'one hashed capture bundle');
assert.ok(names.includes('index.html'), 'index.html is shipped: the runner is served at /');
assert.ok(names.includes('_headers'), '_headers is shipped');
assert.equal(names.length, 3, 'nothing else is shipped: ' + names.join(', '));

const html = readFileSync(path.join(out, 'index.html'), 'utf8');
assert.doesNotMatch(html, /<script[^>]+src=/, 'rendering waits for no script file: the core is inline');
assert.match(html, /lulu-sandbox:render/, 'the inline core carries the protocol');
assert.ok(Buffer.byteLength(html) < 20000, 'the page stays small; SnapDOM is not inlined');
assert.ok(html.includes('window.LuluCaptureSrc="./' + capture[0] + '"'), 'the core knows which file to load for export');
assert.doesNotMatch(html, /type="module"/, 'classic script: an opaque origin needs no CORS to load it');
assert.doesNotMatch(html, /<meta[^>]+(Content-Security-Policy|http-equiv)/i, 'CSP is a response header, not a meta tag');
assert.doesNotMatch(html, /import\(/, 'no dynamic import: that would need CORS from an opaque origin');

const headersFile = readFileSync(path.join(out, '_headers'), 'utf8');
assert.match(headersFile, /^\/\*\n  Content-Security-Policy: sandbox allow-scripts; /m, 'every path carries the CSP');
assert.match(headersFile, /^\/\n  Cache-Control: public, max-age=60, stale-while-revalidate=86400$/m, 'the page is cached briefly');
assert.match(headersFile, /^\/capture-\*\n  Cache-Control: public, max-age=31536000, immutable$/m, 'the hashed capture script never revalidates');

const bundle = readFileSync(path.join(out, capture[0]), 'utf8');
assert.doesNotMatch(bundle, /^\s*(import|export)\s/m, 'bundle has no module syntax');
assert.match(bundle, /LuluSnapdom/, 'bundle exposes SnapDOM through one global');
assert.doesNotMatch(bundle, /import\(/, 'no dynamic import: that would need CORS from an opaque origin');

console.log('ok sandbox build');
