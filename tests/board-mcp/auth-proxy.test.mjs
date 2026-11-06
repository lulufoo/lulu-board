import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isAuthProxyPath, proxyAuthRequest } from '../../packages/board-mcp/src/auth-proxy.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const proxySrc = readFileSync(path.join(root, 'packages/board-mcp/src/auth-proxy.js'), 'utf8');
const worker = readFileSync(path.join(root, 'packages/board-mcp/src/index.js'), 'utf8');

const env = { SUPABASE_URL: 'https://example.supabase.co/' };
const ORIGIN = 'https://mcp.luluboard.app';
const realFetch = globalThis.fetch;
let seen = [];

function stubUpstream(makeReply) {
  seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return makeReply();
  };
}

function reply(status, headers, body) {
  return () => new Response(body === undefined ? null : body, { status, headers });
}

function ask(pathAndQuery, init) {
  return proxyAuthRequest(new Request(ORIGIN + pathAndQuery, init), env);
}

try {
  assert.equal(isAuthProxyPath('/auth/v1'), true);
  assert.equal(isAuthProxyPath('/auth/v1/oauth/token'), true);
  assert.equal(isAuthProxyPath('/auth/v10/oauth/token'), false);
  assert.equal(isAuthProxyPath('/auth'), false);
  assert.equal(isAuthProxyPath('/mcp'), false);
  assert.equal(isAuthProxyPath('/.well-known/oauth-protected-resource'), false);

  // authorize: query forwarded as is, the redirect comes back as is, upstream noise stays out.
  stubUpstream(reply(302, {
    location: 'https://luluboard.app/oauth/consent?authorization_id=a1',
    'set-cookie': '__cf_bm=x; Domain=supabase.co',
    'cf-ray': 'abc',
    'sb-request-id': 'r1',
  }));
  let res = await ask('/auth/v1/oauth/authorize?client_id=c1&state=s%201&code_challenge=abc', {
    headers: { accept: 'text/html', 'user-agent': 'ua-1', cookie: 'a=b' },
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].url, 'https://example.supabase.co/auth/v1/oauth/authorize?client_id=c1&state=s%201&code_challenge=abc');
  assert.equal(seen[0].init.method, 'GET');
  assert.equal(seen[0].init.redirect, 'manual', 'the redirect is returned, not followed');
  assert.equal(seen[0].init.body, undefined);
  assert.equal(seen[0].init.headers.get('accept'), 'text/html');
  assert.equal(seen[0].init.headers.get('user-agent'), 'ua-1');
  assert.equal(seen[0].init.headers.get('cookie'), null, 'cookies do not go upstream');
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), 'https://luluboard.app/oauth/consent?authorization_id=a1');
  assert.equal(res.headers.get('set-cookie'), null, 'the supabase.co cookie does not come back');
  assert.equal(res.headers.get('cf-ray'), null);
  assert.equal(res.headers.get('sb-request-id'), null);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');

  // token: body and Authorization forwarded as is; status and body come back as is.
  const form = 'grant_type=authorization_code&code=CODE123&code_verifier=VERIFIER456';
  stubUpstream(reply(400, { 'content-type': 'application/json', 'x-sb-error-code': 'invalid_credentials' }, '{"error":"invalid_grant"}'));
  res = await ask('/auth/v1/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: 'Basic abc' },
    body: form,
  });
  assert.equal(seen[0].url, 'https://example.supabase.co/auth/v1/oauth/token');
  assert.equal(seen[0].init.method, 'POST');
  assert.equal(await new Response(seen[0].init.body).text(), form, 'the request body is forwarded unchanged');
  assert.equal(seen[0].init.headers.get('content-type'), 'application/x-www-form-urlencoded');
  assert.equal(seen[0].init.headers.get('authorization'), 'Basic abc');
  assert.equal(res.status, 400);
  assert.equal(await res.text(), '{"error":"invalid_grant"}');
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(res.headers.get('x-sb-error-code'), 'invalid_credentials');

  // userinfo and jwks.
  stubUpstream(reply(200, { 'content-type': 'application/json' }, '{"sub":"u1"}'));
  res = await ask('/auth/v1/oauth/userinfo', { headers: { authorization: 'Bearer T1' } });
  assert.equal(seen[0].url, 'https://example.supabase.co/auth/v1/oauth/userinfo');
  assert.equal(seen[0].init.headers.get('authorization'), 'Bearer T1');
  assert.equal(await res.text(), '{"sub":"u1"}');

  stubUpstream(reply(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=600' }, '{"keys":[]}'));
  res = await ask('/auth/v1/.well-known/jwks.json');
  assert.equal(seen[0].url, 'https://example.supabase.co/auth/v1/.well-known/jwks.json');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=600');
  assert.equal(await res.text(), '{"keys":[]}');

  // Source IP: Cloudflare's CF-Connecting-IP replaces anything the client set.
  stubUpstream(reply(200, {}, '{}'));
  await ask('/auth/v1/.well-known/jwks.json', {
    headers: {
      'x-forwarded-for': '1.2.3.4',
      forwarded: 'for=1.2.3.4',
      'x-real-ip': '5.6.7.8',
      'x-forwarded-host': 'evil.example',
      'cf-connecting-ip': '203.0.113.9',
    },
  });
  assert.equal(seen[0].init.headers.get('x-forwarded-for'), '203.0.113.9');
  assert.equal(seen[0].init.headers.get('forwarded'), null);
  assert.equal(seen[0].init.headers.get('x-real-ip'), null);
  assert.equal(seen[0].init.headers.get('x-forwarded-host'), null);
  assert.equal(seen[0].init.headers.get('cf-connecting-ip'), null);

  stubUpstream(reply(200, {}, '{}'));
  await ask('/auth/v1/.well-known/jwks.json', { headers: { 'x-forwarded-for': '1.2.3.4' } });
  assert.equal(seen[0].init.headers.get('x-forwarded-for'), null, 'a client-set value is never forwarded');

  // Wrong method: 405 with Allow, nothing goes upstream.
  stubUpstream(reply(200, {}, '{}'));
  for (const [route, method, allow] of [
    ['/auth/v1/.well-known/jwks.json', 'POST', 'GET'],
    ['/auth/v1/.well-known/jwks.json', 'HEAD', 'GET'],
    ['/auth/v1/oauth/token', 'GET', 'POST'],
    ['/auth/v1/oauth/authorize', 'POST', 'GET'],
    ['/auth/v1/oauth/userinfo', 'DELETE', 'GET'],
  ]) {
    res = await ask(route, { method });
    assert.equal(res.status, 405, method + ' ' + route);
    assert.equal(res.headers.get('allow'), allow);
  }
  assert.equal(seen.length, 0);

  // Any other path is not forwarded, register included (a later Issue).
  for (const route of [
    '/auth/v1',
    '/auth/v1/',
    '/auth/v1/signup',
    '/auth/v1/oauth/token/',
    '/auth/v1/oauth/clients/register',
    '/auth/v1/oauth/__proto__',
    '/auth/v1/constructor',
  ]) {
    res = await ask(route);
    assert.equal(res.status, 404, route);
  }
  assert.equal(seen.length, 0);

  // Upstream down.
  globalThis.fetch = async () => { throw new Error('connect failed'); };
  res = await ask('/auth/v1/.well-known/jwks.json');
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'upstream_unreachable' });
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
} finally {
  globalThis.fetch = realFetch;
}

assert.doesNotMatch(proxySrc, /console\./, 'the proxy logs nothing: the token body holds the code and the refresh token');
assert.doesNotMatch(proxySrc, /SERVICE_ROLE|service_role|SUPABASE_PUBLISHABLE_KEY|apikey/i, 'the proxy holds no key');
assert.match(worker, /import \{ isAuthProxyPath, proxyAuthRequest \} from "\.\/auth-proxy\.js"/, 'Worker imports the proxy');
assert.ok(
  worker.indexOf('isAuthProxyPath(url.pathname)') !== -1
    && worker.indexOf('isAuthProxyPath(url.pathname)') < worker.indexOf('url.pathname !== "/mcp"'),
  'Worker routes /auth/v1 before the /mcp check'
);

console.log('ok auth-proxy');
