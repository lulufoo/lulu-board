import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../../packages/board-api/src/index.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(path.join(root, 'packages/board-api/src/index.js'), 'utf8');

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};

function token(claims) {
  return 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.sig';
}

const live = token({ iss: 'https://example.supabase.co/auth/v1', channel: 'web', exp: Math.floor(Date.now() / 1000) + 3600 });
const expired = token({ iss: 'https://example.supabase.co/auth/v1', channel: 'web', exp: Math.floor(Date.now() / 1000) - 10 });

// Every route that needs a login.
const LOGIN_ROUTES = [
  ['GET', '/graphs?diagram_id=b_aabbccdd'],
  ['POST', '/graphs'],
  ['PATCH', '/graphs'],
  ['PATCH', '/shares'],
  ['POST', '/search'],
  ['POST', '/mine'],
  ['POST', '/groups/shells'],
  ['POST', '/graphs/delete'],
  ['POST', '/groups/reorder'],
  ['POST', '/shares/get'],
  ['POST', '/shares/state'],
  ['POST', '/shares/outgoing'],
  ['POST', '/shares/open'],
  ['POST', '/shares/rotate'],
  ['POST', '/shares/unshare'],
  ['POST', '/shares/role'],
  ['GET', '/tokens'],
  ['POST', '/tokens'],
  ['POST', '/tokens/revoke'],
];

// Without a token this route is the anonymous read; with a token it goes through the login entrance.
const ANONYMOUS_WITHOUT_TOKEN = new Set(['POST /shares/get']);

let calls = [];
let userAnswer = 'valid';
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  calls.push({ url: href, headers: (init && init.headers) || {} });
  if (href.endsWith('/auth/v1/user')) {
    if (userAnswer === 'valid') return { ok: true, json: async () => ({ id: 'user-1', email: 'a@b.c' }), text: async () => '' };
    return { ok: false, status: 401, json: async () => ({ msg: 'invalid JWT' }), text: async () => '' };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}', json: async () => ({}) };
};

function send(method, route, authorization) {
  const headers = { 'content-type': 'application/json' };
  if (authorization) headers.authorization = authorization;
  return worker.fetch(new Request('https://api.example' + route, {
    method,
    headers,
    body: method === 'GET' ? undefined : '{}',
  }), env);
}

const userCalls = () => calls.filter((call) => call.url.endsWith('/auth/v1/user'));

try {
  for (const [method, route] of LOGIN_ROUTES) {
    const label = method + ' ' + route;

    calls = [];
    userAnswer = 'valid';
    let res;
    if (!ANONYMOUS_WITHOUT_TOKEN.has(label)) {
      res = await send(method, route);
      assert.equal(res.status, 401, label + ': no token');
      assert.deepEqual(await res.json(), { error: 'unauthorized' }, label);
      assert.equal(res.headers.get('access-control-allow-origin'), '*', label + ': the refusal carries the CORS header');
      assert.equal(calls.length, 0, label + ': no token, nothing is asked of Supabase');
    }

    calls = [];
    res = await send(method, route, 'Bearer not-a-jwt');
    assert.equal(res.status, 401, label + ': malformed token');
    assert.equal(calls.length, 0, label + ': a malformed token is refused before Supabase is asked');

    calls = [];
    res = await send(method, route, 'Bearer ' + expired);
    assert.equal(res.status, 401, label + ': expired token');
    assert.equal(calls.length, 0, label + ': an expired token is refused before Supabase is asked');

    calls = [];
    userAnswer = 'rejected';
    res = await send(method, route, 'Bearer ' + live);
    assert.equal(res.status, 401, label + ': Supabase rejects the token');
    assert.deepEqual(await res.json(), { error: 'unauthorized' }, label);
    assert.equal(userCalls().length, 1, label);

    calls = [];
    userAnswer = 'valid';
    res = await send(method, route, 'Bearer ' + live);
    assert.notEqual(res.status, 401, label + ': a good token passes the entrance');
    assert.equal(userCalls().length, 1, label + ': the token is verified exactly once');
    assert.equal(userCalls()[0].url, 'https://example.supabase.co/auth/v1/user', label);
    assert.equal(userCalls()[0].headers.apikey, 'publishable-key', label);
    assert.equal(userCalls()[0].headers.Authorization, 'Bearer ' + live, label);
  }

  // Routes without a login never ask Supabase who the caller is, even when a token is sent.
  userAnswer = 'valid';
  for (const [method, route, authorization] of [
    ['POST', '/shares/get', undefined],
    ['POST', '/short-links/get', undefined],
    ['POST', '/short-links/get', 'Bearer ' + live],
    ['GET', '/health', undefined],
    ['GET', '/nope', undefined],
  ]) {
    calls = [];
    await send(method, route, authorization);
    assert.equal(userCalls().length, 0, method + ' ' + route + ': no verification');
  }
} finally {
  globalThis.fetch = prevFetch;
}

const verifyCalls = source.split('verifyAccessToken(').length - 1;
assert.equal(verifyCalls, 1, 'index.js verifies a token in one place, found ' + verifyCalls);

console.log('ok auth-entrance');
