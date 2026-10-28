/* Read one owned graph with the caller JWT. */

import { assertGraphId } from '../../board-core/document-format.js';
import { fail, restJson } from './owned-graph.js';

const SELECT = 'graph_id,title,bmd,version,share_id,created_at,updated_at,group_id';

export async function readOwnedGraph(env, token, diagramId) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  let id;
  try { id = assertGraphId(diagramId); }
  catch (error) { throw fail(400, 'invalid_request', error.message); }
  const rows = await restJson(
    env,
    token,
    '/rest/v1/graphs?graph_id=eq.' + encodeURIComponent(id) + '&select=' + SELECT
  );
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw fail(404, 'not_found', 'Cloud diagram not found');
  return row;
}
