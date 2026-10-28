/* Share reads through the existing SQL functions. The caller JWT is the DB role. */

import { assertGraphId } from '../../board-core/document-format.js';
import { fail, restJson } from './owned-graph.js';

const SHARE_ID_RE = /^s_[0-9a-f]{32}$/;

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

export function readSharedGraph(env, token, input) {
  const raw = input && typeof input === 'object' ? input : {};
  const shareId = String(raw.share_id || '').trim();
  if (!SHARE_ID_RE.test(shareId)) throw fail(400, 'invalid_request', 'invalid share id');
  return rpc(env, token, 'get_shared_graph', { p_share_id: shareId });
}

export function readOwnShareState(env, token, input) {
  const raw = input && typeof input === 'object' ? input : {};
  let id;
  try { id = assertGraphId(raw.diagram_id); }
  catch (error) { throw fail(400, 'invalid_request', error.message); }
  return rpc(env, token, 'own_share_state', { p_graph_id: id });
}

export function listOutgoingShares(env, token) {
  return rpc(env, token, 'list_outgoing_shares', {});
}
