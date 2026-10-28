/* Share settings through the existing SQL functions. The caller JWT is the DB role. */

import { assertGraphId } from '../../board-core/document-format.js';
import { fail, restJson } from './owned-graph.js';

const RPC = {
  open_share: '/rest/v1/rpc/open_share',
  rotate_share: '/rest/v1/rpc/rotate_share',
  unshare: '/rest/v1/rpc/unshare',
  set_share_role: '/rest/v1/rpc/set_share_role',
};

export async function changeShareSetting(env, token, action, input) {
  const path = RPC[action];
  if (!path) throw fail(400, 'invalid_request', 'unknown share action');
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  const raw = input && typeof input === 'object' ? input : {};
  let id;
  try {
    id = assertGraphId(raw.diagram_id);
  } catch (error) {
    throw fail(400, 'invalid_request', error.message);
  }
  const body = { p_graph_id: id };
  if (action === 'set_share_role') {
    body.p_role = raw.role;
    if (raw.principal) body.p_principal = raw.principal;
  }
  const rows = await restJson(env, token, path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw fail(500, 'db_error', 'share update failed');
  return row;
}
