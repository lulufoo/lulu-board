import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = require('path').dirname(fileURLToPath(import.meta.url));
const assert = require('assert');

global.window = global;
global.location = { pathname: '/landing' };

const sentry = require('../../packages/drawer-app/src/core/sentry-count.js');

const started = new Date('2026-11-02T00:00:00.000Z');
const calls = [];
global.Sentry = {
  startSpan: function (options, run) {
    calls.push(options);
    run({
      spanContext: function () { throw new Error('sentry trace id'); },
    });
  },
};

sentry.recordDiagramFetch('6f1c0a3e-9b24-4d7a-8c11-2e5a9d0b7f44', started, {
  requestBytes: 912,
  responseBytes: 3240,
  wireBytes: 1817,
});
assert.strictEqual(calls.length, 1);
assert.strictEqual(calls[0].name, 'diagram.fetch');
assert.strictEqual(calls[0].op, 'http.client');
assert.strictEqual(calls[0].startTime, started);
assert.strictEqual(calls[0].attributes['diagram.fetch.id'], '6f1c0a3e-9b24-4d7a-8c11-2e5a9d0b7f44');
assert.strictEqual(calls[0].attributes['diagram.fetch.request_bytes'], 912);
assert.strictEqual(calls[0].attributes['diagram.fetch.response_bytes'], 3240);
assert.strictEqual(calls[0].attributes['diagram.fetch.response_wire_bytes'], 1817);

calls.length = 0;
sentry.recordDiagramFetch('again', started, { requestBytes: 10, responseBytes: 20, wireBytes: 0 });
assert.strictEqual(calls[0].attributes['diagram.fetch.response_wire_bytes'], undefined);

const previous = global.Sentry;
global.Sentry = null;
assert.doesNotThrow(() => sentry.recordDiagramFetch('x', started, { requestBytes: 1, responseBytes: 1, wireBytes: 1 }));
global.Sentry = previous;

const url = 'https://api.luluboard.app/graphs?diagram_id=b_aabbccdd';
const authorization = 'Bearer token';
assert.strictEqual(
  sentry.diagramFetchRequestBytes(url, authorization),
  new TextEncoder().encode(url).length + new TextEncoder().encode('Authorization: ' + authorization).length
);

global.performance = {
  getEntriesByType: function () {
    return [
      { name: url, encodedBodySize: 0 },
      { name: url, encodedBodySize: 1817 },
    ];
  },
};
assert.strictEqual(sentry.diagramFetchWireBytes(url), 1817);
assert.strictEqual(sentry.diagramFetchWireBytes('https://api.luluboard.app/other'), 0);

console.log('ok sentry diagram fetch');
