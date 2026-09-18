import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  boardTitleFromBody,
  newBoardId,
  assertBoardId,
  createBoard,
  saveBoard,
} from '../../packages/board-mcp/src/boards.js';
import { metadataDocument, unauthorized } from '../../packages/board-mcp/src/meta.js';
import { decodePayload } from '../../packages/board-mcp/src/jwt.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const drawerTitle = readFileSync(path.join(root, 'packages/drawer-app/js/05-board-file.js'), 'utf8');
const drawerId = readFileSync(path.join(root, 'packages/drawer-app/js/00-document-meta.js'), 'utf8');
const worker = readFileSync(path.join(root, 'packages/board-mcp/src/index.js'), 'utf8');
const skill = readFileSync(path.join(root, 'skill/board/SKILL.md'), 'utf8');

assert.equal(boardTitleFromBody('board "Onboarding"\nbox A\n'), 'Onboarding');
assert.equal(boardTitleFromBody('item X\n'), '');
assert.match(drawerTitle, /function boardTitleFromBody/, 'drawer still owns the title regex');
assert.equal(newBoardId(Uint8Array.from([0x0f, 0xc1, 0x00, 0x01])), 'b_0fc10001');
assert.equal(assertBoardId('b_0fc10001'), 'b_0fc10001');
assert.throws(() => assertBoardId('s_deadbeef'), /invalid board id/);
assert.match(drawerId, /return "b_" \+ hex/, 'drawer mints b_ + 8 hex');

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'pub' };
const calls = [];
const latest = {
  board_id: 'b_0fc10001',
  title: 'Now',
  bmd: 'board "Now"\n',
  version: 4,
  updated_at: '2026-09-19T00:00:00Z',
};

const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), method: (init && init.method) || 'GET', body: init && init.body });
  if (String(url).includes('version=eq.3')) {
    return { ok: true, text: async () => '[]' };
  }
  if (String(url).includes('board_id=eq.b_0fc10001') && !(init && init.method === 'PATCH')) {
    return { ok: true, text: async () => JSON.stringify([latest]) };
  }
  if (init && init.method === 'POST') {
    return {
      ok: true,
      text: async () => JSON.stringify([{
        board_id: 'b_aabbccdd',
        title: 'Fresh',
        bmd: 'board "Fresh"\n',
        version: 1,
        updated_at: latest.updated_at,
      }]),
    };
  }
  return { ok: true, text: async () => JSON.stringify([latest]) };
};

try {
  const created = await createBoard(env, 'tok', 'user-1', 'board "Fresh"\n', 'b_aabbccdd');
  assert.equal(created.board_id, 'b_aabbccdd');
  assert.equal(created.version, 1);
  assert.match(calls[0].body, /"owner_id":"user-1"/);

  const conflict = await saveBoard(env, 'tok', 'b_0fc10001', 'board "Mine"\n', 3);
  assert.equal(conflict.conflict, true);
  assert.equal(conflict.row.version, 4);
  assert.equal(conflict.row.bmd, 'board "Now"\n');
  assert.ok(calls.some((c) => c.method === 'PATCH' && c.url.includes('version=eq.3')));
  assert.ok(calls.some((c) => c.url.includes('select=board_id,title,bmd,version,updated_at')));
} finally {
  globalThis.fetch = prevFetch;
}

const meta = metadataDocument({
  SUPABASE_URL: 'https://xjwlxxuafhsfzksxxmtu.supabase.co',
  PUBLIC_ORIGIN: 'https://mcp.luluboard.app',
});
assert.equal(meta.resource, 'https://mcp.luluboard.app/mcp');
assert.deepEqual(meta.authorization_servers, ['https://xjwlxxuafhsfzksxxmtu.supabase.co/auth/v1']);
const denied = unauthorized(
  { PUBLIC_ORIGIN: 'https://mcp.luluboard.app' },
  new Request('https://mcp.luluboard.app/mcp')
);
assert.equal(denied.status, 401);
assert.match(denied.headers.get('www-authenticate'), /resource_metadata="https:\/\/mcp\.luluboard\.app\/\.well-known\/oauth-protected-resource"/);

assert.match(worker, /registerTool\("whoami"/, 'whoami is registered');
assert.match(worker, /registerTool\("get_board"/, 'get_board is registered');
assert.match(worker, /registerTool\("create_board"/, 'create_board is registered');
assert.match(worker, /registerTool\("save_board"/, 'save_board is registered');
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

console.log('ok board-mcp boards');
