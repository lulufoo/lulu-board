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
const row = {
  graph_id: 'b_aabbccdd', title: 'Fresh', bmd: 'boxes "Fresh"\n', version: 2,
  share_id: null, created_at: '2026-10-28T00:00:00Z', updated_at: '2026-10-28T00:00:00Z', group_id: 'g_11223344',
};

const calls = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const href = String(url);
  calls.push(href);
  if (href.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'user-1' }), text: async () => '' };
  if (href.includes('/rest/v1/graphs?graph_id=eq.')) return { ok: true, status: 200, text: async () => JSON.stringify([row]) };
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}' };
};

function get(query) {
  return worker.fetch(new Request('https://api.example/graphs' + query, {
    headers: { authorization: 'Bearer ' + user },
  }), env);
}

try {
  assert.equal((await get('?diagram_id=nope')).status, 400);
  const ok = await get('?diagram_id=b_aabbccdd');
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).group_id, 'g_11223344');
  assert.ok(calls.some((href) => href.includes('select=graph_id,title,bmd,version,share_id,created_at,updated_at,group_id')));
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok graph read');
