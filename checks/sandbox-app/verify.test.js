import assert from 'node:assert/strict';
import http from 'node:http';
import { verifyRunner } from '../../scripts/verify-sandbox/verify.mjs';
import { runnerCsp } from '../../packages/sandbox-app/src/headers.js';

function serve(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler).listen(0, '127.0.0.1', () => resolve(server));
  });
}
const urlOf = (server) => 'http://127.0.0.1:' + server.address().port + '/';

const good = await serve((_req, res) => { res.writeHead(200, { 'Content-Security-Policy': runnerCsp() }); res.end('x'); });
assert.deepEqual(await verifyRunner(urlOf(good)), [], 'matching header passes');

const missing = await serve((_req, res) => { res.writeHead(200); res.end('x'); });
assert.match((await verifyRunner(urlOf(missing)))[0], /no Content-Security-Policy/, 'missing header is reported');

const loose = await serve((_req, res) => { res.writeHead(200, { 'Content-Security-Policy': "sandbox allow-scripts allow-same-origin" }); res.end('x'); });
assert.match((await verifyRunner(urlOf(loose)))[0], /CSP differs/, 'a weaker CSP is reported');

const gone = await serve((_req, res) => { res.writeHead(404); res.end(); });
assert.match((await verifyRunner(urlOf(gone)))[0], /status 404/, 'a missing page is reported');

for (const s of [good, missing, loose, gone]) s.close();
console.log('ok sandbox verify');
