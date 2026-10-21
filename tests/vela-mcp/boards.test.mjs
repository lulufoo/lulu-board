import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  boardTitleFromBody,
  newBoardId,
  newGroupId,
  assertBoardId,
  assertGroupId,
  getBoard,
  createBoard,
  saveBoard,
  stripPersistedMeta,
} from '../../packages/vela-mcp/src/boards.js';
import { metadataDocument, unauthorized } from '../../packages/vela-mcp/src/meta.js';
import { decodePayload } from '../../packages/vela-mcp/src/jwt.js';
import { brandResponse, FAVICON_PNG_BASE64, FAVICON_SVG, serverInfo } from '../../packages/vela-mcp/src/brand.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const drawerTitle = readFileSync(path.join(root, 'packages/drawer-app/js/00-document-meta.js'), 'utf8');
const drawerId = readFileSync(path.join(root, 'packages/drawer-app/js/00-document-meta.js'), 'utf8');
const boardsSrc = readFileSync(path.join(root, 'packages/vela-mcp/src/boards.js'), 'utf8');
const worker = readFileSync(path.join(root, 'packages/vela-mcp/src/index.js'), 'utf8');
const skill = readFileSync(path.join(root, 'skill/board/SKILL.md'), 'utf8');

assert.equal(boardTitleFromBody('board "Onboarding"\nbox A\n'), 'Onboarding');
assert.equal(boardTitleFromBody('item X\n'), '');
assert.equal(boardTitleFromBody('%% title Demo\nflowchart TD\n  A-->B\n'), 'Demo');
assert.equal(boardTitleFromBody('%% title: "Ship"\nflowchart TD\n  A-->B\n'), 'Ship');
assert.equal(boardTitleFromBody('flowchart TD\n  A-->B\n'), '');
assert.notEqual(boardTitleFromBody('flowchart TD\n  A-->B\n'), 'flowchart');
assert.equal(
  stripPersistedMeta('%% meta {"id":"m_51c67540","version":1}\nflowchart TD\n  A-->B\n'),
  'flowchart TD\n  A-->B\n'
);
assert.match(drawerTitle, /function velaTitleFromBody/, 'drawer still owns the title regex');
assert.match(drawerTitle, /%%\\s\*title/, 'drawer reads mermaid %% title');
assert.equal(newBoardId(Uint8Array.from([0x0f, 0xc1, 0x00, 0x01])), 'b_0fc10001');
assert.equal(newGroupId(Uint8Array.from([0x0f, 0xc1, 0x00, 0x01])), 'g_0fc10001');
assert.equal(assertBoardId('b_0fc10001'), 'b_0fc10001');
assert.equal(assertGroupId('g_0fc10001'), 'g_0fc10001');
assert.throws(() => assertBoardId('s_deadbeef'), /invalid board id/);
assert.throws(() => assertGroupId('b_0fc10001'), /invalid group id/);
assert.throws(() => assertGroupId(''), /invalid group id/);
assert.match(drawerId, /return "b_" \+ hex/, 'drawer mints b_ + 8 hex');
assert.match(boardsSrc, /return "b_" \+ hex/, 'MCP still mints b_ + 8 hex');
assert.doesNotMatch(boardsSrc, /\/rest\/v1\/boards", \{\s*method: "POST"/, 'create does not POST boards rows');

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pub' };
const calls = [];
const latest = {
  board_id: 'b_0fc10001',
  title: 'Now',
  bmd: 'board "Now"\n',
  version: 4,
  updated_at: '2026-09-19T00:00:00Z',
  group_id: 'g_99aabbcc',
};
const arrayEmbed = {
  board_id: 'b_0fc10002',
  title: 'Arr',
  bmd: 'board "Arr"\n',
  version: 1,
  updated_at: '2026-09-19T00:00:00Z',
  group_members: [{ group_id: 'g_99aabbcc' }],
  group_id: 'g_99aabbcc',
};
const missingEmbed = {
  board_id: 'b_0fc10003',
  title: 'Bare',
  bmd: 'board "Bare"\n',
  version: 1,
  updated_at: '2026-09-19T00:00:00Z',
};
const ownedGroupId = 'g_abcdef01';
const missingGroupId = 'g_ffffffff';

function rowForBoardId(href) {
  if (href.includes('board_id=eq.b_0fc10002')) return arrayEmbed;
  if (href.includes('board_id=eq.b_0fc10003')) return missingEmbed;
  return latest;
}

function isBoardsInsert(call) {
  return call.method === 'POST' && /\/rest\/v1\/boards(?:\?|$)/.test(call.url);
}

const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  const href = String(url);
  const method = (init && init.method) || 'GET';
  const body = init && init.body;
  calls.push({ url: href, method, body });
  if (href.includes('/rpc/create_owned_board_with_group')) {
    const payload = JSON.parse(body);
    if (payload.p_group_id && payload.p_group_id !== ownedGroupId) {
      return { ok: false, text: async () => JSON.stringify({ message: 'group not found' }) };
    }
    return {
      ok: true,
      text: async () => JSON.stringify([{
        board_id: payload.p_board_id,
        title: payload.p_title,
        bmd: payload.p_bmd,
        version: 1,
        updated_at: latest.updated_at,
        group_id: payload.p_group_id || 'g_11223344',
      }]),
    };
  }
  if (href.includes('version=eq.3') && method === 'PATCH') {
    return { ok: true, text: async () => '[]' };
  }
  if (method === 'PATCH') {
    const patch = JSON.parse(body || '{}');
    return {
      ok: true,
      text: async () => JSON.stringify([{
        board_id: 'b_0fc10001',
        title: patch.title,
        bmd: patch.bmd,
        version: 5,
        updated_at: latest.updated_at,
        group_id: 'g_99aabbcc',
      }]),
    };
  }
  return { ok: true, text: async () => JSON.stringify([rowForBoardId(href)]) };
};

try {
  const beforeEmpty = calls.length;
  await assert.rejects(
    () => createBoard(env, 'tok', 'user-1', '  \n', 'b_aabbccdd'),
    /board source must not be empty/
  );
  assert.equal(calls.length, beforeEmpty, 'empty bmd writes no board, group, or membership');

  const created = await createBoard(env, 'tok', 'user-1', 'board "Fresh"\n', 'b_aabbccdd');
  assert.equal(created.board_id, 'b_aabbccdd');
  assert.equal(created.version, 1);
  assert.equal(created.group_id, 'g_11223344');
  assert.ok(calls[0].url.includes('/rpc/create_owned_board_with_group'), 'create uses t1 RPC');
  const createBody = JSON.parse(calls[0].body);
  assert.equal(createBody.p_board_id, 'b_aabbccdd');
  assert.equal(createBody.p_title, 'Fresh');
  assert.equal(createBody.p_bmd, 'board "Fresh"\n');
  assert.equal(createBody.p_group_id, null);
  assert.ok(!('owner_id' in createBody), 'RPC owner comes from the user JWT');
  assert.ok(!('share_id' in createBody), 'create does not move share_id');
  assert.ok(!calls.some(isBoardsInsert), 'create does not POST /rest/v1/boards');

  const joined = await createBoard(env, 'tok', 'user-1', 'board "Fresh"\n', 'b_aabbccdd', ownedGroupId);
  assert.equal(joined.board_id, 'b_aabbccdd');
  assert.equal(joined.group_id, ownedGroupId);
  const joinBody = JSON.parse(calls[1].body);
  assert.equal(joinBody.p_group_id, ownedGroupId);

  const minted = await createBoard(env, 'tok', 'user-1', 'board "Fresh"\n');
  assert.match(minted.board_id, /^b_[0-9a-f]{8}$/);
  assert.match(minted.group_id, /^g_[0-9a-f]{8}$/);
  const mintBody = JSON.parse(calls[2].body);
  assert.match(mintBody.p_board_id, /^b_[0-9a-f]{8}$/);
  assert.equal(mintBody.p_group_id, null);

  const flowCreated = await createBoard(
    env,
    'tok',
    'user-1',
    '%% meta {"id":"m_51c67540","version":1}\nflowchart TD\n  A-->B\n',
    'b_ff00aa11'
  );
  assert.equal(flowCreated.board_id, 'b_ff00aa11');
  const flowCreate = JSON.parse(calls[3].body);
  assert.equal(flowCreate.p_board_id, 'b_ff00aa11');
  assert.equal(flowCreate.p_bmd, 'flowchart TD\n  A-->B\n');
  assert.doesNotMatch(flowCreate.p_bmd, /m_[0-9a-f]{8}/);
  assert.equal(flowCreate.p_title, 'Untitled');

  const titledFlow = await createBoard(
    env,
    'tok',
    'user-1',
    '%% title Demo\nflowchart TD\n  A-->B\n',
    'b_ff00aa12'
  );
  assert.equal(titledFlow.title, 'Demo');
  const titledBody = JSON.parse(calls.find((c) => c.body && String(c.body).includes('b_ff00aa12')).body);
  assert.equal(titledBody.p_title, 'Demo');

  await assert.rejects(
    () => createBoard(env, 'tok', 'user-1', 'board "X"\n', 'b_aabbccdd', missingGroupId),
    /group not found/
  );
  assert.ok(!calls.some(isBoardsInsert), 'failed group create leaves no boards row');

  const got = await getBoard(env, 'tok', 'b_0fc10001');
  assert.equal(got.board_id, 'b_0fc10001');
  assert.equal(got.title, 'Now');
  assert.equal(got.bmd, 'board "Now"\n');
  assert.equal(got.version, 4);
  assert.equal(got.updated_at, latest.updated_at);
  assert.equal(got.group_id, 'g_99aabbcc');
  assert.ok(calls.some((c) => c.url.includes('select=board_id,title,bmd,version,updated_at,group_id')));
  assert.ok(!calls.some((c) => c.url.includes('group_members')));

  const fromArray = await getBoard(env, 'tok', 'b_0fc10002');
  assert.equal(fromArray.group_id, 'g_99aabbcc');

  await assert.rejects(() => getBoard(env, 'tok', 'b_0fc10003'), /missing group id/);

  const beforeInvalidGet = calls.length;
  await assert.rejects(() => getBoard(env, 'tok', 'nope'), /invalid board id/);
  assert.equal(calls.length, beforeInvalidGet);

  const saved = await saveBoard(env, 'tok', 'b_0fc10001', 'board "Mine"\n', 4);
  assert.equal(saved.conflict, false);
  assert.equal(saved.row.group_id, 'g_99aabbcc');
  assert.equal(saved.row.version, 5);
  const patch = calls.find((c) => c.method === 'PATCH' && c.url.includes('version=eq.4'));
  assert.ok(patch);
  assert.deepEqual(JSON.parse(patch.body), { title: 'Mine', bmd: 'board "Mine"\n' });

  const flowSaved = await saveBoard(env, 'tok', 'b_0fc10001', 'flowchart TD\n  A-->C\n', 5);
  assert.equal(flowSaved.conflict, false);
  const flowPatch = calls.find((c) => c.method === 'PATCH' && JSON.parse(c.body || '{}').bmd === 'flowchart TD\n  A-->C\n');
  assert.ok(flowPatch, 'save_vela stores flowchart in bmd');

  const conflict = await saveBoard(env, 'tok', 'b_0fc10001', 'board "Mine"\n', 3);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.row.version, 4);
  assert.equal(conflict.row.bmd, 'board "Now"\n');
  assert.equal(conflict.row.group_id, 'g_99aabbcc');
  assert.ok(calls.some((c) => c.method === 'PATCH' && c.url.includes('version=eq.3')));
} finally {
  globalThis.fetch = prevFetch;
}

const meta = metadataDocument({
  SUPABASE_URL: 'https://xjwlxxuafhsfzksxxmtu.supabase.co',
  PUBLIC_ORIGIN: 'https://mcp.luluboard.app',
});
assert.equal(meta.resource, 'https://mcp.luluboard.app/mcp');
assert.deepEqual(meta.authorization_servers, ['https://xjwlxxuafhsfzksxxmtu.supabase.co/auth/v1']);
const viaAlias = metadataDocument(
  {
    SUPABASE_URL: 'https://xjwlxxuafhsfzksxxmtu.supabase.co',
    PUBLIC_ORIGIN: 'https://mcp.luluboard.app',
  },
  new Request('https://example.workers.dev/mcp')
);
assert.equal(viaAlias.resource, 'https://mcp.luluboard.app/mcp');
const denied = unauthorized(
  { PUBLIC_ORIGIN: 'https://mcp.luluboard.app' },
  new Request('https://mcp.luluboard.app/mcp')
);
assert.equal(denied.status, 401);
assert.match(denied.headers.get('www-authenticate'), /resource_metadata="https:\/\/mcp\.luluboard\.app\/\.well-known\/oauth-protected-resource"/);

assert.match(worker, /registerTool\("whoami"/, 'whoami is registered');
assert.match(worker, /registerTool\("get_vela"/, 'get_vela is registered');
assert.match(worker, /registerTool\("create_vela"/, 'create_vela is registered');
assert.match(worker, /registerTool\("save_vela"/, 'save_vela is registered');
assert.match(worker, /vela_id: z\.string\(\)/, 'MCP input uses vela_id');
assert.doesNotMatch(worker, /inputSchema: \{ board_id/, 'MCP input does not use board_id');
assert.match(worker, /createBoard\(env, token, identity\.user_id, bmd, vela_id, group_id\)/);
assert.match(worker, /group_id: z\.string\(\)\.optional\(\)/);
assert.match(worker, /group this vela_id belongs to/, 'get/create say group_id is the Vela group');
assert.match(worker, /row\.group_id is the group this vela_id belongs to/, 'save describes row.group_id');
assert.match(worker, /current account/, 'create joins a group on the current account');
assert.match(worker, /Omit group_id to create a new group/, 'create says omit mints a group');
assert.doesNotMatch(worker, /create_mermaid/, 'MCP stays one persist set');
assert.doesNotMatch(worker, /outputSchema/, 'no outputSchema');
assert.doesNotMatch(worker, /workers\.dev/, 'personal workers.dev host is not allowed');
const payload = Buffer.from(JSON.stringify({
  iss: 'https://xjwlxxuafhsfzksxxmtu.supabase.co/auth/v1',
  sub: 'user-1',
  email: 'a@example.com',
  exp: 2000000000,
})).toString('base64url');
assert.equal(decodePayload('hdr.' + payload + '.sig').sub, 'user-1');
assert.throws(() => decodePayload('not-a-jwt'), /invalid token/);
assert.doesNotMatch(worker, /list_recent/, 'list_recent stays out of v1');
assert.doesNotMatch(worker, /service_role|SERVICE_ROLE/, 'worker holds no service key');
assert.match(skill, /If the `whoami` MCP tool is listed/, 'skill gates on whoami');
assert.match(skill, /Do not fall back/, 'failed MCP does not silently use #z:');
assert.match(skill, /[Oo]ptional `group_id`/, 'cloud create can join a group');
assert.match(skill, /group this\s+`vela_id` belongs to/, 'skill says group_id is the Vela group');
assert.match(skill, /current\s+account/, 'skill joins on the current account');
assert.match(skill, /Omit `group_id` to create a new group/, 'skill says omit mints a group');

const brandDir = path.join(root, 'packages/drawer-app/brand');
assert.equal(FAVICON_SVG, readFileSync(path.join(brandDir, 'favicon.svg'), 'utf8'), 'MCP svg matches drawer brand');
assert.equal(
  FAVICON_PNG_BASE64,
  readFileSync(path.join(brandDir, 'favicon-32.png')).toString('base64'),
  'MCP png matches drawer brand'
);
assert.match(FAVICON_SVG, /fill="#db4c84"/, 'svg uses the landing pink');
assert.match(FAVICON_SVG, /fill="#ffd166"/, 'svg uses the landing yellow');

const info = serverInfo({ PUBLIC_ORIGIN: 'https://mcp.luluboard.app' });
assert.equal(info.websiteUrl, 'https://luluboard.app');
assert.equal(info.icons[0].src, 'https://mcp.luluboard.app/favicon-32.png');
assert.equal(info.icons[0].mimeType, 'image/png');
assert.equal(info.icons[1].src, 'https://mcp.luluboard.app/favicon.svg');
assert.match(worker, /new McpServer\(serverInfo\(env\)\)/, 'initialize carries brand icons');
assert.match(worker, /isBrandPath\(url\.pathname\)/, 'favicon is served before /mcp auth');

const svgRes = brandResponse('/favicon.svg');
assert.equal(svgRes.status, 200);
assert.match(svgRes.headers.get('content-type'), /image\/svg\+xml/);
assert.equal(await svgRes.text(), FAVICON_SVG);
const pngRes = brandResponse('/favicon-32.png');
assert.equal(pngRes.status, 200);
assert.equal(pngRes.headers.get('content-type'), 'image/png');
assert.deepEqual(
  Buffer.from(await pngRes.arrayBuffer()),
  readFileSync(path.join(brandDir, 'favicon-32.png'))
);

console.log('ok vela-mcp boards');
