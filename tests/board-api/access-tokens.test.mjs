import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../../packages/board-api/src/index.js';
import { isPatToken } from '../../packages/board-api/src/pat-token.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = [
  readFileSync(path.join(root, 'packages/board-api/src/access-tokens.js'), 'utf8'),
  readFileSync(path.join(root, 'packages/board-api/src/index.js'), 'utf8'),
].join('\n');

assert.match(source, /\/rest\/v1\/rpc\/create_personal_access_token/);
assert.match(source, /\/rest\/v1\/rpc\/list_personal_access_tokens/);
assert.match(source, /\/rest\/v1\/rpc\/revoke_personal_access_token/);
assert.doesNotMatch(source, /console\.(log|info|debug|warn|error)\([^)]*token/);
assert.doesNotMatch(source, /service_role|SUPABASE_SERVICE/);

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};

function jwt(channel) {
  return 'header.' + Buffer.from(JSON.stringify({
    iss: 'https://example.supabase.co/auth/v1',
    channel: channel || 'web',
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url') + '.sig';
}

const minted = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Spark — Mac',
  prefix: 'lbp_6a2f',
  expires_at: '2026-12-10T00:00:00Z',
  token: 'lbp_' + 'ab'.repeat(32),
};
const listed = {
  id: minted.id,
  name: minted.name,
  prefix: minted.prefix,
  expires_at: minted.expires_at,
  created_at: '2026-11-10T00:00:00Z',
};

const calls = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  calls.push({ url: href, method: (init && init.method) || 'GET', headers: (init && init.headers) || {}, body: init && init.body });
  if (href.endsWith('/auth/v1/user')) {
    return { ok: true, json: async () => ({ id: 'user-1' }), text: async () => '' };
  }
  if (href.includes('/rpc/create_personal_access_token')) {
    const body = JSON.parse(init.body);
    if (body.p_expires_in_days > 90) {
      return { ok: false, status: 400, text: async () => JSON.stringify({ code: '22023', message: 'invalid expiry' }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify([minted]) };
  }
  if (href.includes('/rpc/list_personal_access_tokens')) {
    return { ok: true, status: 200, text: async () => JSON.stringify([listed]) };
  }
  if (href.includes('/rpc/revoke_personal_access_token')) {
    const body = JSON.parse(init.body);
    if (body.p_id === '22222222-2222-4222-8222-222222222222') {
      return { ok: false, status: 404, text: async () => JSON.stringify({ code: 'P0002', message: 'token not found' }) };
    }
    return { ok: true, status: 200, text: async () => JSON.stringify([{ id: body.p_id, revoked_at: '2026-11-10T01:00:00Z' }]) };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}' };
};

function send(method, path, body, token) {
  const headers = {};
  if (token) headers.authorization = 'Bearer ' + token;
  if (body !== undefined) headers['content-type'] = 'application/json';
  return worker.fetch(new Request('https://api.example' + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  }), env);
}

try {
  const pat = 'lbp_' + 'cd'.repeat(32);
  assert.equal(isPatToken(pat), true);
  calls.length = 0;
  const asPat = await send('POST', '/tokens', { name: 'Spark', expires_in_days: 30 }, pat);
  assert.equal(asPat.status, 401);
  assert.equal(calls.some((call) => call.url.includes('/rpc/') || call.url.endsWith('/auth/v1/user')), false);

  calls.length = 0;
  const mcp = await send('POST', '/tokens', { name: 'Spark', expires_in_days: 30 }, jwt('mcp'));
  assert.equal(mcp.status, 403);
  assert.equal(calls.some((call) => call.url.includes('/rpc/')), false);

  calls.length = 0;
  const badName = await send('POST', '/tokens', { name: '  ', expires_in_days: 30 }, jwt());
  assert.equal(badName.status, 400);
  assert.equal(calls.some((call) => call.url.includes('/rpc/')), false);

  calls.length = 0;
  const badDays = await send('POST', '/tokens', { name: 'Spark', expires_in_days: 91 }, jwt());
  assert.equal(badDays.status, 400);
  assert.equal(calls.some((call) => call.url.includes('/rpc/')), false);

  calls.length = 0;
  const web = jwt();
  const created = await send('POST', '/tokens', { name: 'Spark — Mac', expires_in_days: 30 }, web);
  assert.equal(created.status, 200);
  const createdBody = await created.json();
  assert.equal(createdBody.token, minted.token);
  assert.equal(createdBody.prefix, 'lbp_6a2f');
  const createRpc = calls.find((call) => call.url.includes('/rpc/create_personal_access_token'));
  assert.deepEqual(JSON.parse(createRpc.body), { p_name: 'Spark — Mac', p_expires_in_days: 30 });
  assert.equal(createRpc.headers.Authorization, 'Bearer ' + web);

  calls.length = 0;
  const listedRes = await send('GET', '/tokens', undefined, jwt());
  assert.equal(listedRes.status, 200);
  const listedBody = await listedRes.json();
  assert.equal(listedBody.length, 1);
  assert.equal(listedBody[0].name, 'Spark — Mac');
  assert.equal('token' in listedBody[0], false);
  assert.equal('token_hash' in listedBody[0], false);
  assert.ok(calls.some((call) => call.url.includes('/rpc/list_personal_access_tokens')));

  calls.length = 0;
  const revoked = await send('POST', '/tokens/revoke', { id: minted.id }, jwt());
  assert.equal(revoked.status, 200);
  assert.equal((await revoked.json()).id, minted.id);
  assert.equal(JSON.parse(calls.find((call) => call.url.includes('/rpc/revoke_personal_access_token')).body).p_id, minted.id);

  calls.length = 0;
  const foreign = await send('POST', '/tokens/revoke', { id: '22222222-2222-4222-8222-222222222222' }, jwt());
  assert.equal(foreign.status, 403);

  calls.length = 0;
  const badId = await send('POST', '/tokens/revoke', { id: 'nope' }, jwt());
  assert.equal(badId.status, 400);
  assert.equal(calls.some((call) => call.url.includes('/rpc/')), false);

  calls.length = 0;
  const missing = await send('POST', '/tokens/', { name: 'Spark', expires_in_days: 30 }, jwt());
  assert.equal(missing.status, 404);
  assert.equal((await missing.json()).error, 'not_found');
  assert.equal(calls.some((call) => call.url.includes('/rpc/')), false);
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok access tokens');
