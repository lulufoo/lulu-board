import assert from 'node:assert/strict';
import worker from '../../packages/board-api/src/index.js';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'publishable-key' };
const user = 'header.' + Buffer.from(JSON.stringify({
  iss: 'https://example.supabase.co/auth/v1',
  exp: Math.floor(Date.now() / 1000) + 3600,
})).toString('base64url') + '.sig';
const shareId = 's_' + 'ab'.repeat(16);
const calls = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), body: init && init.body });
  if (String(url).endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'user-1' }), text: async () => '' };
  if (String(url).includes('/rpc/')) return { ok: true, status: 200, text: async () => '[]' };
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}' };
};

function post(path, body) {
  return worker.fetch(new Request('https://api.example' + path, {
    method: 'POST',
    headers: { authorization: 'Bearer ' + user, 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  }), env);
}

try {
  calls.length = 0;
  assert.equal((await post('/shares/get', { share_id: shareId })).status, 200);
  assert.equal(JSON.parse(calls.find((call) => call.url.includes('get_shared_graph')).body).p_share_id, shareId);
  calls.length = 0;
  assert.equal((await post('/shares/state', { diagram_id: 'b_aabbccdd' })).status, 200);
  assert.equal(JSON.parse(calls.find((call) => call.url.includes('own_share_state')).body).p_graph_id, 'b_aabbccdd');
  calls.length = 0;
  assert.equal((await post('/shares/outgoing')).status, 200);
  assert.ok(calls.some((call) => call.url.includes('/rpc/list_outgoing_shares')));
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok share reads');
