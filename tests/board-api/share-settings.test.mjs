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
  calls.push({ url: href, method: (init && init.method) || 'GET', headers: (init && init.headers) || {}, body: init && init.body });
  if (href.endsWith('/auth/v1/user')) {
    return { ok: true, json: async () => ({ id: 'user-1' }), text: async () => '' };
  }
  if (href.includes('/rpc/open_share')) {
    return { ok: true, status: 200, text: async () => JSON.stringify([{ share_id: 's_' + 'ab'.repeat(16), version: 3 }]) };
  }
  if (href.includes('/rpc/set_share_role')) {
    return { ok: true, status: 200, text: async () => JSON.stringify([{ share_id: 's_' + 'ab'.repeat(16), version: 3, role: 'view', is_public: true }]) };
  }
  if (href.includes('/rpc/unshare')) {
    return { ok: true, status: 200, text: async () => JSON.stringify([{ version: 4 }]) };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}' };
};

function post(path, body, auth) {
  return worker.fetch(new Request('https://api.example' + path, {
    method: 'POST',
    headers: Object.assign({ 'content-type': 'application/json' }, auth || {}),
    body: JSON.stringify(body),
  }), env);
}

try {
  const missing = await post('/shares/open', { diagram_id: 'b_aabbccdd' });
  assert.equal(missing.status, 401);

  calls.length = 0;
  const bad = await post('/shares/open', { diagram_id: 'nope' }, { authorization: 'Bearer ' + token() });
  assert.equal(bad.status, 400);
  assert.equal(calls.some((call) => call.url.includes('/rpc/')), false);

  calls.length = 0;
  const opened = await post('/shares/open', { diagram_id: 'b_aabbccdd' }, { authorization: 'Bearer ' + token() });
  assert.equal(opened.status, 200);
  assert.equal((await opened.json()).share_id, 's_' + 'ab'.repeat(16));
  const openRpc = calls.find((call) => call.url.includes('/rpc/open_share'));
  assert.equal(JSON.parse(openRpc.body).p_graph_id, 'b_aabbccdd');
  assert.equal(openRpc.headers.Authorization, 'Bearer ' + token());

  calls.length = 0;
  const role = await post('/shares/role', { diagram_id: 'b_aabbccdd', role: 'view', principal: 'public' }, { authorization: 'Bearer ' + token() });
  assert.equal(role.status, 200);
  const roleBody = JSON.parse(calls.find((call) => call.url.includes('/rpc/set_share_role')).body);
  assert.equal(roleBody.p_role, 'view');
  assert.equal(roleBody.p_principal, 'public');

  calls.length = 0;
  await post('/shares/role', { diagram_id: 'b_aabbccdd', role: 'edit' }, { authorization: 'Bearer ' + token() });
  const linkRole = JSON.parse(calls.find((call) => call.url.includes('/rpc/set_share_role')).body);
  assert.equal(linkRole.p_role, 'edit');
  assert.equal('p_principal' in linkRole, false);

  const stopped = await post('/shares/unshare', { diagram_id: 'b_aabbccdd' }, { authorization: 'Bearer ' + token() });
  assert.equal(stopped.status, 200);
  assert.equal((await stopped.json()).version, 4);
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok share settings');
