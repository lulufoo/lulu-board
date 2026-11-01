import assert from 'node:assert/strict';
import { runnerCsp, runnerHeaders, runnerHeadersFile, RUNNER_PATHS, RUNNER_CACHE } from '../../packages/sandbox-app/src/headers.js';

const csp = runnerCsp();
const directives = csp.split('; ');
assert.deepEqual(directives, [
  'sandbox allow-scripts',
  "connect-src 'none'",
  'frame-ancestors https://luluboard.app',
  "frame-src 'none'",
  "object-src 'none'",
]);
assert.ok(!/allow-same-origin/.test(csp), 'the runner never regains an origin');
assert.ok(!/allow-(top-navigation|popups|forms|modals)/.test(csp), 'no permission beyond scripts');

assert.equal(runnerCsp(['https://a.example', 'https://b.example']).split('; ')[2], 'frame-ancestors https://a.example https://b.example');
assert.equal(runnerCsp([]).split('; ')[2], 'frame-ancestors https://luluboard.app', 'empty list falls back to Board');

assert.deepEqual(Object.keys(runnerHeaders()), ['Content-Security-Policy']);

const file = runnerHeadersFile();
for (const p of RUNNER_PATHS) {
  assert.ok(file.includes(p + '\n  Content-Security-Policy: ' + csp + '\n'), p + ' block');
}
assert.deepEqual(Object.keys(RUNNER_CACHE), ['/', '/capture-*']);
assert.match(RUNNER_CACHE['/capture-*'], /immutable/, 'a content-hashed file is immutable');
assert.ok(!/immutable/.test(RUNNER_CACHE['/']), 'the page is not immutable: it must pick up a new core');
assert.match(RUNNER_CACHE['/'], /stale-while-revalidate/, 'the page refreshes in the background');
for (const p of Object.keys(RUNNER_CACHE)) {
  assert.ok(file.includes('\n' + p + '\n  Cache-Control: ' + RUNNER_CACHE[p] + '\n'), p + ' cache block');
}

console.log('ok sandbox headers');
