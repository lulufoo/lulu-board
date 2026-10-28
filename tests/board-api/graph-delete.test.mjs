import assert from 'node:assert/strict';
import worker from '../../packages/board-api/src/index.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};

function token() {
  const body = Buffer.from(JSON.stringify({
    iss: 'https://example.supabase.co/auth/v1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  return 'header.' + body + '.sig';
}

const calls = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  calls.push({ url: href, method: (init && init.method) || 'GET', body: init && init.body });
  if (href.endsWith('/auth/v1/user')) {
    return { ok: true, json: async () => ({ id: 'user-1' }), text: async () => '' };
  }
  if (href.includes('/rest/v1/graphs?graph_id=in.')) {
    return { ok: true, status: 200, text: async () => JSON.stringify([{ graph_id: 'b_aabbccdd' }]) };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}' };
};

function post(body, auth) {
  return worker.fetch(new Request('https://api.example/graphs/delete', {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, auth || {}),
    body: JSON.stringify(body),
  }), env);
}

try {
  assert.equal((await post({ diagram_ids: ['b_aabbccdd'] })).status, 401);
  calls.length = 0;
  const bad = await post({ diagram_ids: ['nope'] }, { authorization: 'Bearer ' + token() });
  assert.equal(bad.status, 400);
  assert.equal(calls.some((call) => call.url.includes('/rest/v1/graphs')), false);
  calls.length = 0;
  const ok = await post({ diagram_ids: ['b_aabbccdd', 'b_11223344'] }, { authorization: 'Bearer ' + token() });
  assert.equal(ok.status, 200);
  const del = calls.find((call) => call.method === 'DELETE');
  assert.ok(del.url.includes('graph_id=in.('));
  assert.ok(del.url.includes('b_aabbccdd'));
  assert.ok(del.url.includes('b_11223344'));
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok graph delete');
