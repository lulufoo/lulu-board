/* Mine list and group shells through the existing SQL functions. */

import { assertGraphId } from '../../board-core/document-format.js';
import { fail, restJson } from './owned-graph.js';

const GROUP_ID_RE = /^g_[0-9a-f]{8}$/;

async function rpc(env, token, name, body) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  const rows = await restJson(env, token, '/rest/v1/rpc/' + name, {
    method: 'POST',
    body: JSON.stringify(body || {}),
  });
  return Array.isArray(rows) ? rows : [];
}

export function listMine(env, token, input) {
  const raw = input && typeof input === 'object' ? input : {};
  const body = {};
  if (raw.before) body.p_before = raw.before;
  if (raw.before_group_id) body.p_before_group_id = raw.before_group_id;
  return rpc(env, token, 'list_mine_groups', body);
}

export function loadGroupShells(env, token, input) {
  const raw = input && typeof input === 'object' ? input : {};
  let id;
  try { id = assertGraphId(raw.diagram_id); }
  catch (error) { throw fail(400, 'invalid_request', error.message); }
  const body = { p_graph_id: id };
  if (String(raw.group_id || '').trim()) {
    const groupId = String(raw.group_id).trim();
    if (!GROUP_ID_RE.test(groupId)) throw fail(400, 'invalid_request', 'invalid group id');
    body.p_group_id = groupId;
  }
  return rpc(env, token, 'load_group_shells', body);
}
