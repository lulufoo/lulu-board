import assert from 'node:assert/strict';
import worker from '../../packages/board-api/src/index.js';
import { saveSharedGraph } from '../../packages/board-api/src/share-graph.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};
const shareId = 's_' + 'ab'.repeat(16);

function token(claims) {
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return 'header.' + body + '.sig';
}

function userToken() {
  return token({
    iss: 'https://example.supabase.co/auth/v1',
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
}

const calls = [];
let rpcStatus = 200;
let rpcBody = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  const method = (init && init.method) || 'GET';
  calls.push({ url: href, method, headers: (init && init.headers) || {}, body: init && init.body });
  if (href.endsWith('/auth/v1/user')) {
    return { ok: true, json: async () => ({ id: 'user-1', email: 'a@b.c' }), text: async () => '' };
  }
  if (href.includes('/rpc/save_shared_graph')) {
    return {
      ok: rpcStatus === 200,
      status: rpcStatus,
      text: async () => rpcStatus === 200 ? JSON.stringify(rpcBody) : JSON.stringify({ code: '42501', message: 'not allowed' }),
    };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}', json: async () => ({}) };
};

try {
  calls.length = 0;
  const blank = await saveSharedGraph(env, userToken(), { bmd: ' \n', share_id: shareId, expected_version: 2 });
  assert.fail('blank bmd should reject');
} catch (error) {
  assert.equal(error.status, 400);
  assert.equal(calls.some((call) => call.url.includes('/rpc/save_shared_graph')), false);
}

try {
  rpcBody = [{ title: 'Fresh', bmd: 'boxes "Fresh"\nitem Hello\n', version: 4 }];
  rpcStatus = 200;
  calls.length = 0;
  const saved = await saveSharedGraph(env, userToken(), {
    bmd: 'boxes "Fresh"\nitem Hello\n',
    share_id: shareId,
    expected_version: 3,
  });
  assert.equal(saved.title, 'Fresh');
  assert.equal(saved.version, 4);
  assert.equal('search_text' in saved, false);
  const rpc = JSON.parse(calls.find((call) => call.url.includes('/rpc/save_shared_graph')).body);
  assert.equal(rpc.p_share_id, shareId);
  assert.equal(rpc.p_search_text, 'boxes "Fresh" item Hello');
  assert.equal(rpc.p_expected, 3);
  assert.equal(calls.find((call) => call.url.includes('/rpc/save_shared_graph')).headers.Authorization, 'Bearer ' + userToken());

  rpcBody = [];
  const conflict = await worker.fetch(new Request('https://api.example/shares', {
    method: 'PATCH',
    headers: { authorization: 'Bearer ' + userToken(), 'content-type': 'application/json' },
    body: JSON.stringify({ bmd: 'boxes "Fresh"\n', share_id: shareId, expected_version: 1 }),
  }), env);
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), { error: 'conflict' });

  rpcStatus = 403;
  const denied = await worker.fetch(new Request('https://api.example/shares', {
    method: 'PATCH',
    headers: { authorization: 'Bearer ' + userToken(), 'content-type': 'application/json' },
    body: JSON.stringify({ bmd: 'boxes "Fresh"\n', share_id: shareId, expected_version: 1 }),
  }), env);
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).error, 'forbidden');
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok board-api share');
