import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authenticate } from '../../packages/board-mcp/src/entrance.js';
import { verifyAccessToken } from '../../packages/board-mcp/src/jwt.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const worker = readFileSync(path.join(root, 'packages/board-mcp/src/index.js'), 'utf8');
const entranceSource = readFileSync(path.join(root, 'packages/board-mcp/src/entrance.js'), 'utf8');

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
  PUBLIC_ORIGIN: 'https://mcp.luluboard.app',
};
const ISSUER = 'https://example.supabase.co/auth/v1';
const CHALLENGE = 'Bearer realm="lulu-board", resource_metadata="https://mcp.luluboard.app/.well-known/oauth-protected-resource"';

// Pass `undefined` for a token with no channel claim at all.
function tokenFor(channel, extra) {
  const claims = Object.assign({ iss: ISSUER, exp: Math.floor(Date.now() / 1000) + 3600, channel }, extra || {});
  return 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.sig';
}

let calls = [];
let userAnswer = 'valid';
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), headers: (init && init.headers) || {} });
  if (userAnswer === 'valid') return { ok: true, json: async () => ({ id: 'user-1', email: 'a@b.c' }) };
  return { ok: false, status: 401, json: async () => ({ msg: 'invalid JWT' }) };
};

function ask(authorization) {
  const headers = authorization ? { authorization } : {};
  return authenticate(new Request('https://mcp.luluboard.app/mcp', { method: 'POST', headers }), env);
}

async function expectRefused(authorization, label, askedSupabase) {
  calls = [];
  const result = await ask(authorization);
  assert.ok(result.response, label + ': refused');
  assert.equal(result.token, undefined, label);
  assert.equal(result.response.status, 401, label);
  assert.equal(result.response.headers.get('www-authenticate'), CHALLENGE, label + ': the client is told where to sign in');
  assert.equal(result.response.headers.get('access-control-allow-origin'), '*', label);
  assert.deepEqual(await result.response.json(), { error: 'invalid_token' }, label);
  assert.equal(calls.length, askedSupabase, label + ': Supabase asked ' + calls.length + ' times');
}

try {
  // The one channel that gets in.
  userAnswer = 'valid';
  calls = [];
  const live = tokenFor('mcp', { client_id: 'c-1' });
  const ok = await ask('Bearer ' + live);
  assert.equal(ok.response, undefined);
  assert.equal(ok.token, live);
  assert.deepEqual(ok.identity, { user_id: 'user-1', email: 'a@b.c', client_id: 'c-1', channel: 'mcp' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://example.supabase.co/auth/v1/user');
  assert.equal(calls[0].headers.apikey, 'publishable-key');
  assert.equal(calls[0].headers.Authorization, 'Bearer ' + live);
  assert.equal((await ask('bearer ' + live)).token, live, 'the scheme is not case sensitive');

  // Every other channel is refused, after Auth has confirmed the token.
  const others = ['web', 'unknown', undefined, null, '', 'admin', 'MCP', ' mcp', 'mcp ', 'mcp,web', 'mcp-readonly', 7, true, {}, ['mcp']];
  for (const channel of others) {
    await expectRefused('Bearer ' + tokenFor(channel), 'channel ' + JSON.stringify(channel), 1);
  }

  // Refused before Auth is asked: no token, another scheme, not a JWT, expired, another issuer.
  await expectRefused(undefined, 'no token', 0);
  await expectRefused('Basic abc', 'another scheme', 0);
  await expectRefused('Bearer ', 'empty bearer', 0);
  await expectRefused('Bearer not-a-jwt', 'malformed token', 0);
  await expectRefused('Bearer ' + tokenFor('mcp', { exp: Math.floor(Date.now() / 1000) - 10 }), 'expired token', 0);
  await expectRefused('Bearer ' + tokenFor('mcp', { iss: 'https://other.supabase.co/auth/v1' }), 'another issuer', 0);

  // Auth rejects the token: refused whatever the channel claim says.
  userAnswer = 'rejected';
  await expectRefused('Bearer ' + tokenFor('mcp'), 'Auth rejects an mcp token', 1);
  userAnswer = 'valid';

  // The claim is read from the confirmed token; anything but a string counts as no channel.
  assert.equal((await verifyAccessToken(env, tokenFor('web'))).channel, 'web');
  assert.equal((await verifyAccessToken(env, tokenFor(undefined))).channel, '');
  assert.equal((await verifyAccessToken(env, tokenFor(['mcp']))).channel, '');
} finally {
  globalThis.fetch = prevFetch;
}

// The Worker gets in only through this function.
assert.match(worker, /import \{ authenticate \} from "\.\/entrance\.js"/, 'Worker imports the entrance');
assert.doesNotMatch(worker, /verifyAccessToken/, 'the Worker no longer verifies tokens itself');
const at = (needle) => worker.indexOf(needle);
assert.ok(at('await authenticate(request, env)') !== -1, 'the /mcp route authenticates');
assert.ok(at('url.pathname !== "/mcp"') < at('await authenticate(request, env)'), 'authenticate runs on /mcp');
assert.ok(at('await authenticate(request, env)') < at('handler.fetch(request'), 'authenticate runs before the MCP handler');
assert.doesNotMatch(entranceSource, /console\./, 'nothing is logged');
assert.match(entranceSource, /identity\.channel !== MCP_CHANNEL/, 'one comparison decides');

console.log('ok entrance');
