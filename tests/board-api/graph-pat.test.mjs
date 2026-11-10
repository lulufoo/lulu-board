import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../../packages/board-api/src/index.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = [
  readFileSync(path.join(root, 'packages/board-api/src/index.js'), 'utf8'),
  readFileSync(path.join(root, 'packages/board-api/src/graph-read.js'), 'utf8'),
].join('\n');
assert.match(source, /isPatToken\(token\)/);
assert.match(source, /read_owned_graph_with_pat/);
assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)\([^)]*token/);
assert.equal(source.split('verifyAccessToken(').length - 1, 1);

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};
const pat = 'lbp_' + 'ab'.repeat(32);
const jwt = 'header.' + Buffer.from(JSON.stringify({
  iss: 'https://example.supabase.co/auth/v1',
  channel: 'web',
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
  calls.push({ href: href, headers: (init && init.headers) || {}, body: init && init.body });
  if (href.endsWith('/auth/v1/user')) return { ok: true, json: async () => ({ id: 'user-1' }), text: async () => '' };
  if (href.includes('/rpc/read_owned_graph_with_pat')) {
    const body = JSON.parse(init.body);
    if (body.p_graph_id === 'b_deadbeef') {
      return { ok: false, status: 404, text: async () => JSON.stringify({ code: 'P0002', message: 'cloud board not found' }) };
    }
    if (body.p_token !== pat) {
      return { ok: false, status: 401, text: async () => JSON.stringify({ code: '28000', message: 'unauthorized' }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify([row]) };
  }
  if (href.includes('/rest/v1/graphs?graph_id=eq.')) {
    return { ok: true, status: 200, text: async () => JSON.stringify([row]) };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}' };
};

function get(query, token) {
  return worker.fetch(new Request('https://api.example/graphs' + query, {
    headers: token ? { authorization: 'Bearer ' + token } : {},
  }), env);
}

function post(path, token, body) {
  return worker.fetch(new Request('https://api.example' + path, {
    method: 'POST',
    headers: {
      authorization: 'Bearer ' + token,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body || {}),
  }), env);
}

try {
  calls.length = 0;
  const ok = await get('?diagram_id=b_aabbccdd', pat);
  assert.equal(ok.status, 200);
  const body = await ok.json();
  assert.equal(body.diagram_id, 'b_aabbccdd');
  assert.equal(body.group_id, 'g_11223344');
  assert.equal(body.url, 'https://luluboard.app/#b:b_aabbccdd');
  assert.equal(body.bmd, row.bmd);
  const rpc = calls.find((call) => call.href.includes('/rpc/read_owned_graph_with_pat'));
  assert.ok(rpc);
  assert.equal(JSON.parse(rpc.body).p_token, pat);
  assert.equal(JSON.parse(rpc.body).p_graph_id, 'b_aabbccdd');
  assert.equal(rpc.headers.Authorization, 'Bearer publishable-key');
  assert.equal(calls.some((call) => call.href.endsWith('/auth/v1/user')), false);
  assert.equal(calls.some((call) => call.href.includes('/rest/v1/graphs?')), false);
  const text = JSON.stringify(body);
  assert.equal(text.includes(pat), false);

  calls.length = 0;
  const missing = await get('?diagram_id=b_deadbeef', pat);
  assert.equal(missing.status, 403);
  assert.equal(calls.some((call) => call.href.endsWith('/auth/v1/user')), false);

  calls.length = 0;
  const bad = await get('?diagram_id=b_aabbccdd', 'lbp_' + '00'.repeat(32));
  assert.equal(bad.status, 401);
  assert.deepEqual(await bad.json(), { error: 'unauthorized' });

  calls.length = 0;
  const jwtRead = await get('?diagram_id=b_aabbccdd', jwt);
  assert.equal(jwtRead.status, 200);
  assert.equal((await jwtRead.json()).graph_id, 'b_aabbccdd');
  assert.equal(calls.some((call) => call.href.endsWith('/auth/v1/user')), true);
  assert.equal(calls.some((call) => call.href.includes('/rpc/read_owned_graph_with_pat')), false);

  calls.length = 0;
  const write = await post('/graphs', pat, { bmd: 'boxes "Fresh"\n' });
  assert.equal(write.status, 401);
  assert.equal(calls.some((call) => call.href.includes('/rpc/')), false);

  calls.length = 0;
  const tokens = await post('/tokens', pat, { name: 'Spark', expires_in_days: 30 });
  assert.equal(tokens.status, 401);
  assert.equal(calls.some((call) => call.href.includes('/rpc/')), false);

  calls.length = 0;
  const search = await post('/search', pat, { query: 'card' });
  assert.equal(search.status, 401);
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok graph pat');
