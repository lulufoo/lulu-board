import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isRegisterPath, proxyRegisterRequest } from '../../packages/board-mcp/src/register-proxy.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const proxySrc = readFileSync(path.join(root, 'packages/board-mcp/src/register-proxy.js'), 'utf8');
const worker = readFileSync(path.join(root, 'packages/board-mcp/src/index.js'), 'utf8');

const SECRET = 'test-gateway-secret-not-real';
const env = {
  SUPABASE_URL: 'https://example.supabase.co/',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  REGISTER_GATEWAY_SECRET: SECRET,
};
const REGISTER_URL = 'https://example.supabase.co/auth/v1/oauth/clients/register';
const RPC_URL = 'https://example.supabase.co/rest/v1/rpc/record_client_channel';
const ORIGIN = 'https://mcp.luluboard.app';
const CLIENT_ID = '0b6c3f0e-5a52-4c8a-9d56-3f1b2a7c9e11';
const CLIENT_SECRET = 'client-secret-value-not-real';
const REGISTERED = JSON.stringify({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, client_name: 'cli' });
const realFetch = globalThis.fetch;
let seen = [];

// replies: { register: () => Response | Error, rpc: () => Response | Error }
function stubUpstream(replies) {
  seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    const make = url === REGISTER_URL ? replies.register : url === RPC_URL ? replies.rpc : null;
    if (!make) throw new Error('unexpected url ' + url);
    const out = make();
    if (out instanceof Error) throw out;
    return out;
  };
}

const registered = () => new Response(REGISTERED, {
  status: 201,
  headers: { 'content-type': 'application/json', 'set-cookie': '__cf_bm=x; Domain=supabase.co', 'sb-request-id': 'r1' },
});
const rpcOk = () => new Response(null, { status: 204 });

function ask(init, askEnv = env) {
  const request = new Request(ORIGIN + '/auth/v1/oauth/clients/register', init);
  return proxyRegisterRequest(request, askEnv);
}

const post = (extra = {}) => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...extra },
  body: '{"client_name":"cli","redirect_uris":["http://127.0.0.1:48621/callback"]}',
});

try {
  assert.equal(isRegisterPath('/auth/v1/oauth/clients/register'), true);
  assert.equal(isRegisterPath('/auth/v1/oauth/clients/register/'), false);
  assert.equal(isRegisterPath('/auth/v1/oauth/token'), false);

  // Success: forwarded, registered, handed back as is.
  stubUpstream({ register: registered, rpc: rpcOk });
  let res = await ask(post({ 'x-forwarded-for': '1.2.3.4', 'cf-connecting-ip': '203.0.113.9', cookie: 'a=b' }));
  assert.equal(seen.length, 2);
  assert.equal(seen[0].url, REGISTER_URL);
  assert.equal(seen[0].init.method, 'POST');
  assert.equal(seen[0].init.redirect, 'manual');
  assert.equal(await new Response(seen[0].init.body).text(), '{"client_name":"cli","redirect_uris":["http://127.0.0.1:48621/callback"]}');
  assert.equal(seen[0].init.headers.get('content-type'), 'application/json');
  assert.equal(seen[0].init.headers.get('x-forwarded-for'), '203.0.113.9', 'the client IP comes from CF-Connecting-IP');
  assert.equal(seen[0].init.headers.get('cookie'), null);
  assert.equal(seen[0].init.headers.get('x-board-gateway'), null, 'the gateway secret does not go to Auth');
  assert.equal(seen[1].url, RPC_URL);
  assert.equal(seen[1].init.method, 'POST');
  assert.equal(seen[1].init.headers['x-board-gateway'], SECRET);
  assert.equal(seen[1].init.headers.apikey, 'sb_publishable_test');
  assert.equal(seen[1].init.headers.authorization, undefined, 'no user token and no service key');
  assert.deepEqual(JSON.parse(seen[1].init.body), { p_client_id: CLIENT_ID });
  assert.ok(!seen[1].init.body.includes(SECRET), 'the secret is in the header, not the body');
  assert.equal(res.status, 201);
  assert.equal(await res.text(), REGISTERED, 'the reply is returned unchanged, client_secret included');
  assert.equal(res.headers.get('content-type'), 'application/json');
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal(res.headers.get('sb-request-id'), null);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');

  // The registry write fails: 502, and neither client_id nor client_secret goes out.
  for (const rpc of [
    () => new Response('{"message":"gateway secret missing or wrong"}', { status: 403 }),
    () => new Response('boom', { status: 500 }),
    () => new Error('connect failed'),
  ]) {
    stubUpstream({ register: registered, rpc });
    res = await ask(post());
    assert.equal(seen.length, 2);
    assert.equal(res.status, 502);
    const body = await res.text();
    assert.equal(body, '{"error":"client_registration_failed"}');
    assert.ok(!body.includes(CLIENT_ID) && !body.includes(CLIENT_SECRET));
  }

  // Auth refuses the registration: passed through, nothing is written.
  stubUpstream({ register: () => new Response('{"error":"invalid_client_metadata"}', { status: 400, headers: { 'content-type': 'application/json' } }), rpc: rpcOk });
  res = await ask(post());
  assert.equal(seen.length, 1);
  assert.equal(res.status, 400);
  assert.equal(await res.text(), '{"error":"invalid_client_metadata"}');

  // A 2xx reply without a usable client_id is not handed out and nothing is written.
  for (const bad of ['not json', '{}', '{"client_id":"abc"}', '{"client_id":42}', '']) {
    stubUpstream({ register: () => new Response(bad || null, { status: 201 }), rpc: rpcOk });
    res = await ask(post());
    assert.equal(seen.length, 1, 'no write for: ' + bad);
    assert.equal(res.status, 502);
  }

  // Auth unreachable.
  stubUpstream({ register: () => new Error('connect failed'), rpc: rpcOk });
  res = await ask(post());
  assert.equal(seen.length, 1);
  assert.equal(res.status, 502);
  assert.deepEqual(await res.json(), { error: 'upstream_unreachable' });

  // Misconfigured: refuse before anything is registered upstream.
  for (const missing of ['REGISTER_GATEWAY_SECRET', 'SUPABASE_PUBLISHABLE_KEY']) {
    stubUpstream({ register: registered, rpc: rpcOk });
    res = await ask(post(), { ...env, [missing]: undefined });
    assert.equal(res.status, 503, missing);
    assert.equal(seen.length, 0, missing);
  }

  // Method.
  stubUpstream({ register: registered, rpc: rpcOk });
  for (const method of ['GET', 'DELETE', 'HEAD']) {
    res = await ask({ method });
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get('allow'), 'POST');
  }
  assert.equal(seen.length, 0);
} finally {
  globalThis.fetch = realFetch;
}

assert.doesNotMatch(proxySrc, /console\./, 'nothing is logged: the reply holds client_secret');
assert.doesNotMatch(proxySrc, /SERVICE_ROLE|service_role/i, 'no service key');
assert.match(worker, /import \{ isRegisterPath, proxyRegisterRequest \} from "\.\/register-proxy\.js"/, 'Worker imports the register proxy');
assert.ok(
  worker.indexOf('isRegisterPath(url.pathname)') !== -1
    && worker.indexOf('isRegisterPath(url.pathname)') < worker.indexOf('isAuthProxyPath(url.pathname)'),
  'Worker routes register before the generic /auth/v1 proxy'
);

console.log('ok register-proxy');
