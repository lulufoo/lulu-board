/* Delete owned graphs with the caller JWT. RLS limits the delete to rows the user may remove. */

import { assertGraphId } from '../../board-core/document-format.js';
import { fail, restJson } from './owned-graph.js';

export async function deleteOwnedGraphs(env, token, input) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  const raw = input && typeof input === 'object' ? input : {};
  const listed = Array.isArray(raw.diagram_ids) ? raw.diagram_ids : [];
  if (!listed.length) throw fail(400, 'invalid_request', 'diagram id required');
  const ids = [];
  for (let i = 0; i < listed.length; i += 1) {
    try { ids.push(assertGraphId(listed[i])); }
    catch (error) { throw fail(400, 'invalid_request', error.message); }
  }
  const filter = ids.map((id) => encodeURIComponent(id)).join(',');
  const rows = await restJson(env, token, '/rest/v1/graphs?graph_id=in.(' + filter + ')', {
    method: 'DELETE',
  });
  const deleted = Array.isArray(rows) ? rows.map((row) => row.graph_id) : [];
  return { deleted };
}
