/* Reorder one owned group through reorder_group_graphs. The caller JWT is the DB role. */

import { assertGraphId } from '../../board-core/document-format.js';
import { fail, restJson } from './owned-graph.js';

const GROUP_ID_RE = /^g_[0-9a-f]{8}$/;

export async function reorderGroup(env, token, input) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  const raw = input && typeof input === 'object' ? input : {};
  const groupId = String(raw.group_id || '').trim();
  if (!GROUP_ID_RE.test(groupId)) throw fail(400, 'invalid_request', 'invalid group id');
  const listed = Array.isArray(raw.diagram_ids) ? raw.diagram_ids : [];
  if (!listed.length) throw fail(400, 'invalid_request', 'diagram id required');
  const ids = [];
  for (let i = 0; i < listed.length; i += 1) {
    try { ids.push(assertGraphId(listed[i])); }
    catch (error) { throw fail(400, 'invalid_request', error.message); }
  }
  const rows = await restJson(env, token, '/rest/v1/rpc/reorder_group_graphs', {
    method: 'POST',
    body: JSON.stringify({ p_group_id: groupId, p_graph_ids: ids }),
  });
  return Array.isArray(rows) ? rows : [];
}
