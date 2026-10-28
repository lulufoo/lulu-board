import assert from 'node:assert/strict';
import worker from '../../packages/board-api/src/index.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};
const user = 'header.' + Buffer.from(JSON.stringify({
  iss: 'https://example.supabase.co/auth/v1',
  exp: Math.floor(Date.now() / 1000) + 3600,
})).toString('base64url') + '.sig';
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
  assert.equal((await post('/mine', { before: '2026-10-28T00:00:00Z', before_group_id: 'g_11223344' })).status, 200);
  const mine = JSON.parse(calls.find((call) => call.url.includes('/rpc/list_mine_groups')).body);
  assert.equal(mine.p_before, '2026-10-28T00:00:00Z');
  assert.equal(mine.p_before_group_id, 'g_11223344');
  calls.length = 0;
  assert.equal((await post('/groups/shells', { diagram_id: 'b_aabbccdd', group_id: 'g_11223344' })).status, 200);
  const shells = JSON.parse(calls.find((call) => call.url.includes('/rpc/load_group_shells')).body);
  assert.equal(shells.p_graph_id, 'b_aabbccdd');
  assert.equal(shells.p_group_id, 'g_11223344');
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok mine lists');
