/* Search through the existing search_graphs function. The caller JWT is the DB role. */

import { fail, restJson } from './owned-graph.js';

export async function searchGraphs(env, token, input) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  const raw = input && typeof input === 'object' ? input : {};
  const query = String(raw.query || '').trim();
  if (!query) throw fail(400, 'invalid_request', 'query required');
  const rows = await restJson(env, token, '/rest/v1/rpc/search_graphs', {
    method: 'POST',
    body: JSON.stringify({ p_query: query }),
  });
  return Array.isArray(rows) ? rows : [];
}
