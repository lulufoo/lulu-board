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
  const href = String(url);
  calls.push({ url: href, body: init && init.body });
  if (href.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'user-1' }), text: async () => '' };
  if (href.includes('/rpc/reorder_group_graphs')) return { ok: true, status: 200, text: async () => '[]' };
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}' };
};

function post(body) {
  return worker.fetch(new Request('https://api.example/groups/reorder', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + user, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), env);
}

try {
  calls.length = 0;
  assert.equal((await post({ group_id: 'nope', diagram_ids: ['b_aabbccdd'] })).status, 400);
  assert.equal(calls.some((call) => call.url.includes('/rpc/')), false);
  calls.length = 0;
  assert.equal((await post({ group_id: 'g_11223344', diagram_ids: ['b_aabbccdd', 'b_11223344'] })).status, 200);
  const body = JSON.parse(calls.find((call) => call.url.includes('/rpc/reorder_group_graphs')).body);
  assert.equal(body.p_group_id, 'g_11223344');
  assert.deepEqual(body.p_graph_ids, ['b_aabbccdd', 'b_11223344']);
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok group reorder');
