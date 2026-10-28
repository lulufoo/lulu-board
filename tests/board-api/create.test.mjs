import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../../packages/board-api/src/index.js';
import { createOwnedGraph } from '../../packages/board-api/src/owned-graph.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};
const ownedSrc = readFileSync(path.join(root, 'packages/board-api/src/owned-graph.js'), 'utf8');
const wrangler = readFileSync(path.join(root, 'packages/board-api/wrangler.toml'), 'utf8');
const workerSrc = readFileSync(path.join(root, 'packages/board-api/src/index.js'), 'utf8');

assert.match(ownedSrc, /\/rest\/v1\/rpc\/create_owned_graph/);
assert.doesNotMatch(ownedSrc + workerSrc, /service_role|SUPABASE_SERVICE|board-mcp/);
assert.doesNotMatch(ownedSrc, /create_owned_graph_with_group/);
assert.match(wrangler, /pattern = "api\.luluboard\.app"/);
assert.match(wrangler, /custom_domain = true/);
assert.match(wrangler, /workers_dev = false/);

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
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  const method = (init && init.method) || 'GET';
  calls.push({ url: href, method, headers: (init && init.headers) || {}, body: init && init.body });
  if (href.endsWith('/auth/v1/user')) {
    const auth = String((init.headers && init.headers.Authorization) || '');
    if (auth.includes('reject-user')) {
      return { ok: false, json: async () => ({ msg: 'unauthorized' }), text: async () => '' };
    }
    return { ok: true, json: async () => ({ id: 'user-1', email: 'a@b.c' }), text: async () => '' };
  }
  if (href.includes('/rpc/create_owned_graph')) {
    const payload = JSON.parse(init.body);
    if (payload.p_group_id === 'g_deadbeef') {
      return {
        ok: false,
        status: 404,
        text: async () => JSON.stringify({ code: 'P0002', message: 'group not found' }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{
        graph_id: payload.p_graph_id,
        title: payload.p_title,
        bmd: payload.p_bmd,
        version: 1,
        updated_at: '2026-10-28T00:00:00Z',
        group_id: payload.p_group_id || 'g_11223344',
      }]),
    };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}', json: async () => ({}) };
};

try {
  const health = await worker.fetch(new Request('https://api.example/health'), env);
  assert.equal(health.status, 200);
  assert.equal(await health.text(), 'ok');

  const missing = await worker.fetch(new Request('https://api.example/graphs', { method: 'POST', body: '{}' }), env);
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: 'unauthorized' });

  const expired = token({
    iss: 'https://example.supabase.co/auth/v1',
    exp: Math.floor(Date.now() / 1000) - 10,
  });
  const before = calls.length;
  const denied = await worker.fetch(new Request('https://api.example/graphs', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + expired, 'content-type': 'application/json' },
    body: JSON.stringify({ bmd: 'boxes "Fresh"\n' }),
  }), env);
  assert.equal(denied.status, 401);
  assert.equal(calls.length, before, 'expired token does not call Auth or the database');

  const created = await createOwnedGraph(env, userToken(), { bmd: 'boxes "Fresh"\nitem Hello\n' });
  assert.equal(created.diagram_id.length > 0, true);
  assert.equal(created.url, 'https://luluboard.app/#b:' + created.diagram_id);
  assert.equal(created.group_id, 'g_11223344');
  assert.equal(created.version, 1);
  const rpc = calls.find((call) => call.url.includes('/rpc/create_owned_graph'));
  const rpcBody = JSON.parse(rpc.body);
  assert.equal(rpcBody.p_title, 'Fresh');
  assert.equal(rpcBody.p_bmd, 'boxes "Fresh"\nitem Hello\n');
  assert.equal(rpcBody.p_search_text, 'boxes "Fresh" item Hello');
  assert.equal(rpcBody.p_group_id, null);
  assert.equal(rpc.headers.Authorization, 'Bearer ' + userToken());
  assert.equal(rpc.headers.apikey, 'publishable-key');
  assert.equal(rpc.method, 'POST');

  calls.length = 0;
  const joined = await createOwnedGraph(env, userToken(), {
    bmd: 'boxes "Fresh"\n',
    diagram_id: 'b_aabbccdd',
    group_id: 'g_abcdef01',
  });
  assert.equal(joined.diagram_id, 'b_aabbccdd');
  assert.equal(joined.group_id, 'g_abcdef01');
  assert.equal(JSON.parse(calls[0].body).p_group_id, 'g_abcdef01');

  const emptySketch = 'sketch ""\ncontent ' + Buffer.from('<div></div>', 'utf8').toString('base64') + '\n';
  calls.length = 0;
  await createOwnedGraph(env, userToken(), { bmd: emptySketch, diagram_id: 'b_aabbccde' });
  assert.equal(JSON.parse(calls[0].body).p_search_text, '');

  await assert.rejects(
    () => createOwnedGraph(env, userToken(), { bmd: '  \n', diagram_id: 'b_aabbccdd' }),
    (error) => error.status === 400 && error.error === 'invalid_request'
  );
  await assert.rejects(
    () => createOwnedGraph(env, userToken(), { bmd: 'boxes "Fresh"\n', group_id: 'nope' }),
    (error) => error.status === 400 && /invalid group id/.test(error.message)
  );

  calls.length = 0;
  await assert.rejects(
    () => createOwnedGraph(env, userToken(), {
      bmd: 'boxes "Fresh"\n',
      diagram_id: 'b_aabbccdd',
      group_id: 'g_deadbeef',
    }),
    (error) => error.status === 403 && error.error === 'forbidden'
  );

  const viaHttp = await worker.fetch(new Request('https://api.example/graphs', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + userToken(), 'content-type': 'application/json' },
    body: JSON.stringify({ bmd: 'boxes "Fresh"\n', diagram_id: 'b_aabbccdf' }),
  }), env);
  assert.equal(viaHttp.status, 200);
  const viaBody = await viaHttp.json();
  assert.equal(viaBody.diagram_id, 'b_aabbccdf');
  assert.equal(viaBody.url, 'https://luluboard.app/#b:b_aabbccdf');
  assert.equal(viaHttp.headers.get('access-control-allow-origin'), '*');

  const opt = await worker.fetch(new Request('https://api.example/graphs', { method: 'OPTIONS' }), env);
  assert.equal(opt.status, 204);
  assert.match(opt.headers.get('access-control-allow-headers'), /Authorization/);
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok board-api create');
