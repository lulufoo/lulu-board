import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import worker from '../../packages/board-api/src/index.js';
import { CHANNEL_ROUTES, channelVerdict } from '../../packages/board-api/src/channels.js';
import { verifyAccessToken } from '../../packages/board-api/src/jwt.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mcpGraphs = readFileSync(path.join(root, 'packages/board-mcp/src/graphs.js'), 'utf8');

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
};

// Pass `undefined` for a token with no channel claim at all.
function tokenFor(channel) {
  const claims = { iss: 'https://example.supabase.co/auth/v1', exp: Math.floor(Date.now() / 1000) + 3600, channel };
  return 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.sig';
}

// Routes that need a login.
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

const MCP_ROUTES = ['POST /groups/shells', 'GET /graphs', 'POST /graphs', 'PATCH /graphs', 'POST /search'];
const keyOf = (method, route) => method + ' ' + route.split('?')[0];

let calls = [];
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  calls.push({ url: href, headers: (init && init.headers) || {} });
  if (href.endsWith('/auth/v1/user')) {
    return { ok: true, json: async () => ({ id: 'user-1', email: 'a@b.c' }), text: async () => '' };
  }
  return { ok: false, status: 500, text: async () => '{"message":"unexpected"}', json: async () => ({}) };
};

function send(method, route, token) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  return worker.fetch(new Request('https://api.example' + route, {
    method,
    headers,
    body: method === 'GET' ? undefined : '{}',
  }), env);
}

async function expectRefused(channel, method, route, status, error) {
  calls = [];
  const res = await send(method, route, tokenFor(channel));
  const label = String(JSON.stringify(channel)) + ' on ' + method + ' ' + route;
  assert.equal(res.status, status, label);
  assert.deepEqual(await res.json(), { error }, label);
  assert.equal(res.headers.get('access-control-allow-origin'), '*', label + ': the refusal carries the CORS header');
  assert.ok(calls.every((call) => call.url.endsWith('/auth/v1/user')), label + ': refused before any data call');
}

async function expectOpen(channel, method, route) {
  calls = [];
  const res = await send(method, route, tokenFor(channel));
  const label = channel + ' on ' + method + ' ' + route;
  assert.ok(res.status !== 401 && res.status !== 403 && res.status !== 404, label + ': got ' + res.status);
}

try {
  // The list itself.
  assert.deepEqual(Object.keys(CHANNEL_ROUTES), ['web', 'mcp'], '`unknown` is not a channel with routes');
  assert.equal(CHANNEL_ROUTES.web, '*');
  assert.deepEqual([...CHANNEL_ROUTES.mcp], MCP_ROUTES);

  // The list is the set of calls board-mcp makes to board-api.
  const made = mcpGraphs.split('fetch("https://api.luluboard.app').slice(1).map((chunk) => {
    const route = chunk.match(/^(\/[a-z/]*)/)[1];
    const call = chunk.slice(0, chunk.indexOf('res.text()'));
    return (call.match(/method: "([A-Z]+)"/) || [null, 'GET'])[1] + ' ' + route;
  });
  assert.deepEqual([...new Set(made)].sort(), [...MCP_ROUTES].sort(), 'board-mcp calls exactly the routes the mcp channel may');

  // The decision on its own.
  assert.equal(channelVerdict('web', 'POST', '/anything'), 'ok');
  assert.equal(channelVerdict('mcp', 'POST', '/search'), 'ok');
  assert.equal(channelVerdict('mcp', 'GET', '/search'), 'forbidden', 'the method is part of the key');
  assert.equal(channelVerdict('mcp', 'DELETE', '/graphs'), 'forbidden');
  assert.equal(channelVerdict('mcp', 'POST', '/graphs/delete'), 'forbidden', 'a longer path is another route');
  assert.equal(channelVerdict('unknown', 'POST', '/search'), 'unauthorized');
  // Only a string can name a channel; an array or object would otherwise be turned into one by property lookup.
  for (const odd of [['web'], { toString: () => 'web' }, undefined, null, 0]) {
    assert.equal(channelVerdict(odd, 'POST', '/search'), 'unauthorized', 'not a string: ' + String(odd));
  }

  // The claim is read from the token Auth confirmed.
  calls = [];
  assert.equal((await verifyAccessToken(env, tokenFor('mcp'))).channel, 'mcp');
  assert.equal((await verifyAccessToken(env, tokenFor(undefined))).channel, '');
  assert.equal((await verifyAccessToken(env, tokenFor(7))).channel, '');

  // web: every route.
  for (const [method, route] of LOGIN_ROUTES) await expectOpen('web', method, route);

  // mcp: its five routes, a 403 on the other login routes (a login required, but not for this channel).
  const open = LOGIN_ROUTES.filter(([method, route]) => MCP_ROUTES.includes(keyOf(method, route)));
  const shut = LOGIN_ROUTES.filter(([method, route]) => !MCP_ROUTES.includes(keyOf(method, route)));
  assert.equal(open.length, 5);
  assert.equal(shut.length, 14);
  for (const [method, route] of open) await expectOpen('mcp', method, route);
  for (const [method, route] of shut) await expectRefused('mcp', method, route, 403, 'forbidden');

  // A token that carries no usable channel is not accepted anywhere: 401, so a client signs in again.
  const unusable = ['unknown', undefined, null, '', 'admin', 'WEB', ' web', 'web ', 'mcp,web', 7, true, {}, ['web'], 'constructor', '__proto__', 'toString', 'hasOwnProperty'];
  for (const channel of unusable) {
    for (const [method, route] of LOGIN_ROUTES) await expectRefused(channel, method, route, 401, 'unauthorized');
  }

  // Routes without a login do not look at the channel.
  for (const channel of ['mcp', 'unknown', undefined]) {
    calls = [];
    const res = await send('POST', '/short-links/get', tokenFor(channel));
    assert.ok(res.status !== 401 && res.status !== 403, 'short-links/get with channel ' + channel);
    assert.equal(calls.filter((call) => call.url.endsWith('/auth/v1/user')).length, 0);
  }
  calls = [];
  assert.equal((await send('GET', '/health')).status, 200);
  const anonymous = await send('POST', '/shares/get', undefined);
  assert.ok(anonymous.status !== 401 && anonymous.status !== 403, 'shares/get without a token is the anonymous read');
} finally {
  globalThis.fetch = prevFetch;
}

console.log('ok channel-routes');
