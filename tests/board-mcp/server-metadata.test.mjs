import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { proxyAuthRequest } from '../../packages/board-mcp/src/auth-proxy.js';
import { proxyRegisterRequest } from '../../packages/board-mcp/src/register-proxy.js';
import { isServerMetadataPath, serverMetadataResponse } from '../../packages/board-mcp/src/server-metadata.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = readFileSync(path.join(root, 'packages/board-mcp/src/server-metadata.js'), 'utf8');
const worker = readFileSync(path.join(root, 'packages/board-mcp/src/index.js'), 'utf8');

const WELL_KNOWN = '/.well-known/oauth-authorization-server/auth/v1';
const ORIGIN = 'https://mcp.luluboard.app';
const OURS = ORIGIN + '/auth/v1';
const realFetch = globalThis.fetch;
const realNow = Date.now;
let calls = [];
let urlCounter = 0;

// A fresh Supabase address per case, because the Worker keeps one cached copy per address.
function freshEnv() {
  urlCounter += 1;
  return {
    SUPABASE_URL: 'https://case' + urlCounter + '.supabase.co',
    PUBLIC_ORIGIN: ORIGIN,
    SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
    REGISTER_GATEWAY_SECRET: 'x',
  };
}

function upstreamDocument(env) {
  const issuer = env.SUPABASE_URL + '/auth/v1';
  return {
    issuer,
    authorization_endpoint: issuer + '/oauth/authorize',
    token_endpoint: issuer + '/oauth/token',
    jwks_uri: issuer + '/.well-known/jwks.json',
    userinfo_endpoint: issuer + '/oauth/userinfo',
    registration_endpoint: issuer + '/oauth/clients/register',
    scopes_supported: ['openid', 'profile', 'email', 'phone', 'offline_access'],
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256', 'HS256', 'ES256'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    claims_supported: ['sub', 'aud', 'iss', 'exp', 'iat'],
    code_challenge_methods_supported: ['S256', 'plain'],
  };
}

function stub(answer) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return answer(String(url), init);
  };
}

const answerWith = (document) => () => new Response(JSON.stringify(document), { status: 200, headers: { 'content-type': 'application/json' } });
const ask = (env, method = 'GET', origin = ORIGIN) => serverMetadataResponse(new Request(origin + WELL_KNOWN, { method }), env);

try {
  assert.equal(isServerMetadataPath(WELL_KNOWN), true);
  assert.equal(isServerMetadataPath(WELL_KNOWN + '/'), false);
  assert.equal(isServerMetadataPath('/.well-known/oauth-authorization-server'), false);
  assert.equal(isServerMetadataPath('/.well-known/openid-configuration/auth/v1'), false);
  assert.equal(isServerMetadataPath('/auth/v1/.well-known/oauth-authorization-server'), false);

  // The six address fields move under our issuer; the rest is copied as it is.
  let env = freshEnv();
  const upstream = upstreamDocument(env);
  stub(answerWith(upstream));
  let res = await ask(env);
  assert.equal(res.status, 200);
  const doc = await res.json();
  assert.deepEqual(
    {
      issuer: doc.issuer,
      authorization_endpoint: doc.authorization_endpoint,
      token_endpoint: doc.token_endpoint,
      jwks_uri: doc.jwks_uri,
      userinfo_endpoint: doc.userinfo_endpoint,
      registration_endpoint: doc.registration_endpoint,
    },
    {
      issuer: OURS,
      authorization_endpoint: OURS + '/oauth/authorize',
      token_endpoint: OURS + '/oauth/token',
      jwks_uri: OURS + '/.well-known/jwks.json',
      userinfo_endpoint: OURS + '/oauth/userinfo',
      registration_endpoint: OURS + '/oauth/clients/register',
    }
  );
  assert.deepEqual(Object.keys(doc).sort(), Object.keys(upstream).sort(), 'no field is added or dropped');
  const rewritten = ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri', 'userinfo_endpoint', 'registration_endpoint'];
  for (const name of Object.keys(upstream)) {
    if (!rewritten.includes(name)) assert.deepEqual(doc[name], upstream[name], name + ' is copied unchanged');
  }
  assert.ok(!JSON.stringify(doc).includes('supabase.co'), 'no Supabase address is left in the document');

  // RFC 8414 3.3: the issuer is the address the well-known path was built from.
  const issuerUrl = new URL(doc.issuer);
  assert.equal(issuerUrl.origin + '/.well-known/oauth-authorization-server' + issuerUrl.pathname, ORIGIN + WELL_KNOWN);

  // Reply headers, and what was asked of Supabase.
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=300');
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, env.SUPABASE_URL + WELL_KNOWN);
  assert.equal(new Headers(calls[0].init.headers).get('authorization'), null);
  assert.equal(new Headers(calls[0].init.headers).get('cookie'), null);

  // Every address the document names is a route this Worker serves, with the method a client uses there.
  const served = [
    ['authorization_endpoint', 'GET', proxyAuthRequest],
    ['token_endpoint', 'POST', proxyAuthRequest],
    ['jwks_uri', 'GET', proxyAuthRequest],
    ['userinfo_endpoint', 'GET', proxyAuthRequest],
    ['registration_endpoint', 'POST', proxyRegisterRequest],
  ];
  for (const [field, method, handler] of served) {
    stub(() => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }));
    const probe = new Request(doc[field], { method, body: method === 'POST' ? '{}' : undefined });
    const reply = await handler(probe, env);
    assert.ok(reply.status !== 404 && reply.status !== 405, field + ' is served by this Worker, got ' + reply.status);
  }

  // Cache: a second request inside the window does not ask Supabase again; after it, Supabase is asked again.
  stub(answerWith(upstream));
  await ask(env);
  assert.equal(calls.length, 0, 'served from the cached copy');
  let clock = realNow() + 6 * 60 * 1000;
  Date.now = () => clock;
  await ask(env);
  assert.equal(calls.length, 1, 'asked again after the window');
  // Supabase is down after the window: the last good copy is served.
  clock += 6 * 60 * 1000;
  stub(() => new Response('down', { status: 503 }));
  res = await ask(env);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).issuer, OURS);
  stub(() => { throw new Error('connect failed'); });
  clock += 6 * 60 * 1000;
  res = await ask(env);
  assert.equal(res.status, 200, 'a thrown fetch also falls back to the last good copy');
  Date.now = realNow;

  // A different Supabase address does not reuse the cached copy.
  const other = freshEnv();
  stub(answerWith(upstreamDocument(other)));
  res = await ask(other);
  assert.equal(calls.length, 1);
  assert.equal(res.status, 200);

  // HEAD has the headers and no body; other methods are refused.
  env = freshEnv();
  stub(answerWith(upstreamDocument(env)));
  res = await ask(env, 'HEAD');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '');
  assert.equal(res.headers.get('content-type'), 'application/json');
  for (const method of ['POST', 'PUT', 'DELETE']) {
    res = await serverMetadataResponse(new Request(ORIGIN + WELL_KNOWN, { method, body: method === 'DELETE' ? undefined : '{}' }), env);
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get('allow'), 'GET, HEAD');
  }

  // With no PUBLIC_ORIGIN the request origin is used.
  env = freshEnv();
  delete env.PUBLIC_ORIGIN;
  stub(answerWith(upstreamDocument(env)));
  res = await ask(env, 'GET', 'https://preview.example.workers.dev');
  assert.equal((await res.json()).issuer, 'https://preview.example.workers.dev/auth/v1');

  // Nothing readable from Supabase and no earlier copy: 502, never a partial document.
  const broken = [
    ['fetch throws', () => { throw new Error('connect failed'); }],
    ['HTTP 500', () => new Response('boom', { status: 500 })],
    ['not JSON', () => new Response('<html>', { status: 200 })],
    ['a JSON array', () => new Response('[]', { status: 200 })],
  ];
  for (const [label, answer] of broken) {
    env = freshEnv();
    stub(answer);
    res = await ask(env);
    assert.equal(res.status, 502, label);
    assert.deepEqual(await res.json(), { error: 'authorization_server_metadata_unavailable' }, label);
  }

  // A document that is not the shape we rewrite is refused, so a client is never sent to Supabase for part of the flow.
  const wrongShape = [
    ['another issuer', (d) => { d.issuer = 'https://elsewhere.example/auth/v1'; }],
    ['registration_endpoint missing', (d) => { delete d.registration_endpoint; }],
    ['token_endpoint is not a string', (d) => { d.token_endpoint = 42; }],
    ['jwks_uri on another host', (d) => { d.jwks_uri = 'https://elsewhere.example/.well-known/jwks.json'; }],
    ['userinfo_endpoint on a lookalike path', (d) => { d.userinfo_endpoint = d.issuer + 'x/oauth/userinfo'; }],
  ];
  for (const [label, damage] of wrongShape) {
    env = freshEnv();
    const document = upstreamDocument(env);
    damage(document);
    stub(answerWith(document));
    res = await ask(env);
    assert.equal(res.status, 502, label);
    assert.ok(!(await res.text()).includes('supabase.co'), label + ': nothing of the document is passed on');
  }
} finally {
  globalThis.fetch = realFetch;
  Date.now = realNow;
}

assert.doesNotMatch(src, /console\./, 'nothing is logged');
assert.doesNotMatch(src, /SERVICE_ROLE|service_role/i, 'no service key');
assert.match(worker, /import \{ isServerMetadataPath, serverMetadataResponse \} from "\.\/server-metadata\.js"/, 'Worker imports the metadata module');
const at = (needle) => worker.indexOf(needle);
assert.ok(at('isServerMetadataPath(url.pathname)') !== -1, 'Worker routes the metadata path');
assert.ok(at('isMetaPath(url.pathname)') < at('isServerMetadataPath(url.pathname)'), 'resource metadata is matched first');
assert.ok(at('isServerMetadataPath(url.pathname)') < at('isRegisterPath(url.pathname)'), 'metadata is routed before the proxies');
assert.ok(at('isServerMetadataPath(url.pathname)') < at('url.pathname !== "/mcp"'), 'metadata is routed before the /mcp check');

console.log('ok server-metadata');
