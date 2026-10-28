import assert from 'node:assert/strict';
import worker from '../../packages/board-api/src/index.js';
import { updateOwnedGraph } from '../../packages/board-api/src/owned-graph.js';

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};

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
let rpcRows = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  const method = (init && init.method) || 'GET';
  calls.push({ url: href, method, headers: (init && init.headers) || {}, body: init && init.body });
  if (href.endsWith('/auth/v1/user')) {
    return { ok: true, json: async () => ({ id: 'user-1', email: 'a@b.c' }), text: async () => '' };
  }
  if (href.includes('/rpc/update_owned_graph')) {
    return { ok: true, status: 200, text: async () => JSON.stringify(rpcRows) };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}', json: async () => ({}) };
};

function patch(body, auth) {
  return worker.fetch(new Request('https://api.example/graphs', {
    method: 'PATCH',
    headers: Object.assign({ 'content-type': 'application/json' }, auth || {}),
    body: JSON.stringify(body),
  }), env);
}

try {
  const missing = await patch({ bmd: 'boxes "Fresh"\n', diagram_id: 'b_aabbccdd', expected_version: 2 });
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: 'unauthorized' });

  calls.length = 0;
  const blank = await patch(
    { bmd: '  \n', diagram_id: 'b_aabbccdd', expected_version: 2 },
    { authorization: 'Bearer ' + userToken() }
  );
  assert.equal(blank.status, 400);
  assert.equal((await blank.json()).error, 'invalid_request');
  assert.equal(calls.some((call) => call.url.includes('/rpc/update_owned_graph')), false);

  rpcRows = [{
    graph_id: 'b_aabbccdd',
    title: 'Fresh',
    bmd: 'boxes "Fresh"\nitem Hello\n',
    version: 3,
    updated_at: '2026-10-28T00:00:00Z',
    group_id: 'g_11223344',
  }];
  calls.length = 0;
  const saved = await updateOwnedGraph(env, userToken(), {
    bmd: 'boxes "Fresh"\nitem Hello\n',
    diagram_id: 'b_aabbccdd',
    expected_version: 2,
  });
  assert.equal(saved.diagram_id, 'b_aabbccdd');
  assert.equal(saved.version, 3);
  assert.equal(saved.url, 'https://luluboard.app/#b:b_aabbccdd');
  const rpc = calls.find((call) => call.url.includes('/rpc/update_owned_graph'));
  const rpcBody = JSON.parse(rpc.body);
  assert.equal(rpcBody.p_graph_id, 'b_aabbccdd');
  assert.equal(rpcBody.p_title, 'Fresh');
  assert.equal(rpcBody.p_bmd, 'boxes "Fresh"\nitem Hello\n');
  assert.equal(rpcBody.p_search_text, 'boxes "Fresh" item Hello');
  assert.equal(rpcBody.p_expected, 2);
  assert.equal(rpc.headers.Authorization, 'Bearer ' + userToken());
  assert.equal(rpc.method, 'POST');

  const viaHttp = await patch(
    { bmd: 'boxes "Fresh"\nitem Hello\n', diagram_id: 'b_aabbccdd', expected_version: 2 },
    { authorization: 'Bearer ' + userToken() }
  );
  assert.equal(viaHttp.status, 200);
  const viaBody = await viaHttp.json();
  assert.equal(viaBody.diagram_id, 'b_aabbccdd');
  assert.equal(viaBody.version, 3);
  assert.equal('search_text' in viaBody, false);

  rpcRows = [];
  calls.length = 0;
  const conflict = await patch(
    { bmd: 'boxes "Fresh"\n', diagram_id: 'b_aabbccdd', expected_version: 1 },
    { authorization: 'Bearer ' + userToken() }
  );
  assert.equal(conflict.status, 409);
  assert.deepEqual(await conflict.json(), { error: 'conflict' });

  const opt = await worker.fetch(new Request('https://api.example/graphs', { method: 'OPTIONS' }), env);
  assert.equal(opt.status, 204);
  assert.match(opt.headers.get('access-control-allow-methods'), /PATCH/);
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok board-api update');
