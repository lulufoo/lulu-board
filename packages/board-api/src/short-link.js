/* Read one anonymous short link. The publishable key is the anon role. */

import { fail, restJson } from './owned-graph.js';

const SHORT_LINK_ID_RE = /^p_[0-9a-f]{64}$/;

export async function readShortLink(env, input) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  const raw = input && typeof input === 'object' ? input : {};
  const id = String(raw.id || '').trim();
  if (!SHORT_LINK_ID_RE.test(id)) throw fail(400, 'invalid_request', 'invalid short link id');
  const rows = await restJson(env, env.SUPABASE_PUBLISHABLE_KEY, '/rest/v1/rpc/get_short_link', {
    method: 'POST',
    body: JSON.stringify({ p_id: id }),
  });
  return Array.isArray(rows) ? rows : [];
}
