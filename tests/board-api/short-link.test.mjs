import assert from 'node:assert/strict';
import worker from '../../packages/board-api/src/index.js';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'publishable-key' };
const id = 'p_' + 'ab'.repeat(32);
const calls = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), headers: (init && init.headers) || {}, body: init && init.body });
  if (String(url).includes('/rpc/get_short_link')) {
    return { ok: true, status: 200, text: async () => JSON.stringify([{ bmd: 'boxes "Fresh"\n' }]) };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}' };
};

function post(body) {
  return worker.fetch(new Request('https://api.example/short-links/get', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }), env);
}

try {
  calls.length = 0;
  assert.equal((await post({ id: 'nope' })).status, 400);
  assert.equal(calls.length, 0);
  const ok = await post({ id });
  assert.equal(ok.status, 200);
  const call = calls.find((item) => item.url.includes('/rpc/get_short_link'));
  assert.equal(JSON.parse(call.body).p_id, id);
  assert.equal(call.headers.Authorization, 'Bearer publishable-key');
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok short link');
