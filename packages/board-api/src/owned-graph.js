/* Create one owned graph through create_owned_graph. The caller JWT is the DB role. */

import {
  assertGraphId,
  boardTitleFromBody,
  newGraphId,
  stripPersistedMeta,
} from '../../board-core/document-format.js';
import { searchTextFromBody } from '../../board-core/search-text.js';

const GROUP_ID_RE = /^g_[0-9a-f]{8}$/;
const PUBLIC_WEB_ORIGIN = 'https://luluboard.app';

export function fail(status, error, message) {
  const err = new Error(message || error);
  err.status = status;
  err.error = error;
  return err;
}

function assertGroupId(groupId) {
  const id = String(groupId || '').trim();
  if (!GROUP_ID_RE.test(id)) throw new Error('invalid group id');
  return id;
}

function restHeaders(env, token) {
  return {
    apikey: env.SUPABASE_PUBLISHABLE_KEY,
    Authorization: 'Bearer ' + token,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

export async function restJson(env, token, path, init) {
  const res = await fetch(env.SUPABASE_URL.replace(/\/$/, '') + path, Object.assign({
    headers: restHeaders(env, token),
  }, init || {}));
  const text = await res.text();
  let body = null;
  if (text) {
    try { body = JSON.parse(text); } catch (_e) { body = { message: text }; }
  }
  if (!res.ok) {
    const code = body && body.code;
    const message = (body && (body.message || body.error_description || body.error)) || ('HTTP ' + res.status);
    if (code === '28000' || res.status === 401) throw fail(401, 'unauthorized', message);
    if (code === 'P0002' || code === '42501') throw fail(403, 'forbidden', message);
    if (code === '22023') throw fail(400, 'invalid_request', message);
    if (code === '23505') throw fail(409, 'conflict', message);
    throw fail(res.status >= 500 ? 500 : 400, 'db_error', message);
  }
  return body;
}

function publicRow(row) {
  if (!row) throw fail(500, 'db_error', 'create failed');
  const groupId = String(row.group_id || '').trim();
  if (!groupId) throw fail(500, 'db_error', 'missing group id');
  return {
    diagram_id: row.graph_id,
    title: row.title || '',
    bmd: row.bmd || '',
    version: Number(row.version) || 1,
    updated_at: row.updated_at || '',
    group_id: assertGroupId(groupId),
    url: PUBLIC_WEB_ORIGIN + '/#b:' + row.graph_id,
  };
}

export async function createOwnedGraph(env, token, input) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  const raw = input && typeof input === 'object' ? input : {};
  const source = stripPersistedMeta(raw.bmd);
  if (!String(source || '').trim()) throw fail(400, 'invalid_request', 'board source must not be empty');
  let id;
  try {
    id = raw.diagram_id ? assertGraphId(raw.diagram_id) : newGraphId();
  } catch (error) {
    throw fail(400, 'invalid_request', error.message);
  }
  let groupId = null;
  if (String(raw.group_id || '').trim()) {
    try { groupId = assertGroupId(raw.group_id); }
    catch (error) { throw fail(400, 'invalid_request', error.message); }
  }
  const rows = await restJson(env, token, '/rest/v1/rpc/create_owned_graph', {
    method: 'POST',
    body: JSON.stringify({
      p_graph_id: id,
      p_title: boardTitleFromBody(source) || 'Untitled',
      p_bmd: source,
      p_search_text: searchTextFromBody(source),
      p_group_id: groupId,
    }),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  return publicRow(row);
}

export async function updateOwnedGraph(env, token, input) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  const raw = input && typeof input === 'object' ? input : {};
  const source = stripPersistedMeta(raw.bmd);
  if (!String(source || '').trim()) throw fail(400, 'invalid_request', 'board source must not be empty');
  let id;
  try {
    id = assertGraphId(raw.diagram_id);
  } catch (error) {
    throw fail(400, 'invalid_request', error.message);
  }
  const expected = Number(raw.expected_version);
  if (!Number.isInteger(expected) || expected < 1) throw fail(400, 'invalid_request', 'invalid version');
  const rows = await restJson(env, token, '/rest/v1/rpc/update_owned_graph', {
    method: 'POST',
    body: JSON.stringify({
      p_graph_id: id,
      p_title: boardTitleFromBody(source) || 'Untitled',
      p_bmd: source,
      p_search_text: searchTextFromBody(source),
      p_expected: expected,
    }),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw fail(409, 'conflict');
  return publicRow(row);
}
