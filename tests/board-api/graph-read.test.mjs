import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import worker from '../../packages/board-api/src/index.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};
const user = 'header.' + Buffer.from(JSON.stringify({
  iss: 'https://example.supabase.co/auth/v1',
  exp: Math.floor(Date.now() / 1000) + 3600,
})).toString('base64url') + '.sig';
const row = {
  graph_id: 'b_aabbccdd', title: 'Fresh', bmd: 'boxes "Fresh"\n', version: 2,
  share_id: null, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z', group_id: 'g_11223344',
};

const calls = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  calls.push({ href: href, headers: (init && init.headers) || {} });
  if (href.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'user-1' }), text: async () => '' };
  if (href.includes('graph_id=eq.b_00aa00aa')) {
    return { ok: true, status: 200, text: async () => JSON.stringify([{ group_id: 'g_11223344' }]) };
  }
  if (href.includes('/rest/v1/graphs?graph_id=eq.')) return { ok: true, status: 200, text: async () => JSON.stringify([row]) };
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}' };
};

function get(query, headers, cf) {
  const request = new Request('https://api.example/graphs' + query, {
    headers: Object.assign({ authorization: 'Bearer ' + user }, headers || {}),
  });
  if (cf) Object.defineProperty(request, 'cf', { value: cf });
  return worker.fetch(request, env);
}

function jsonFromGzip(response) {
  return response.arrayBuffer().then((bytes) => JSON.parse(gunzipSync(Buffer.from(bytes)).toString('utf8')));
}

try {
  assert.equal((await get('?diagram_id=nope')).status, 400);
  const ok = await get('?diagram_id=b_aabbccdd');
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get('timing-allow-origin'), '*');
  assert.equal(ok.headers.get('content-encoding'), null);
  assert.equal((await ok.json()).group_id, 'g_11223344');
  const db = calls.find((call) => call.href.includes('/rest/v1/graphs'));
  assert.ok(db.href.includes('select=graph_id,title,bmd,version,share_id,created_at,updated_at,group_id'));
  assert.equal(db.headers['Accept-Encoding'], undefined);

  const packed = await get('?diagram_id=b_aabbccdd', { 'accept-encoding': 'gzip' });
  assert.equal(packed.status, 200);
  assert.equal(packed.headers.get('content-encoding'), 'gzip');
  assert.equal(packed.headers.get('timing-allow-origin'), '*');
  const packedBytes = Buffer.from(await packed.clone().arrayBuffer());
  assert.ok(packedBytes.byteLength < JSON.stringify(row).length);
  assert.equal((await jsonFromGzip(packed)).group_id, 'g_11223344');

  const fromEdge = await get('?diagram_id=b_aabbccdd', {}, { clientAcceptEncoding: 'br, gzip' });
  assert.equal(fromEdge.headers.get('content-encoding'), 'gzip');
  assert.equal((await jsonFromGzip(fromEdge)).bmd, row.bmd);

  const refused = await get('?diagram_id=b_aabbccdd', { 'accept-encoding': 'gzip;q=0' });
  assert.equal(refused.headers.get('content-encoding'), null);
  assert.equal((await refused.json()).graph_id, 'b_aabbccdd');

  const tiny = await get('?diagram_id=b_00aa00aa', { 'accept-encoding': 'gzip' });
  assert.equal(tiny.headers.get('content-encoding'), null);
  assert.equal((await tiny.json()).group_id, 'g_11223344');
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok graph read');
