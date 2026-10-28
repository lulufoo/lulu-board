/* Save one shared graph through save_shared_graph. The caller JWT is the DB role. */

import {
  boardTitleFromBody,
  stripPersistedMeta,
} from '../../board-core/document-format.js';
import { searchTextFromBody } from '../../board-core/search-text.js';
import { fail, restJson } from './owned-graph.js';

const SHARE_ID_RE = /^s_[0-9a-f]{32}$/;

export async function saveSharedGraph(env, token, input) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
  const raw = input && typeof input === 'object' ? input : {};
  const source = stripPersistedMeta(raw.bmd);
  if (!String(source || '').trim()) throw fail(400, 'invalid_request', 'board source must not be empty');
  const shareId = String(raw.share_id || '').trim();
  if (!SHARE_ID_RE.test(shareId)) throw fail(400, 'invalid_request', 'invalid share id');
  const expected = Number(raw.expected_version);
  if (!Number.isInteger(expected) || expected < 1) throw fail(400, 'invalid_request', 'invalid version');
  const rows = await restJson(env, token, '/rest/v1/rpc/save_shared_graph', {
    method: 'POST',
    body: JSON.stringify({
      p_share_id: shareId,
      p_title: boardTitleFromBody(source) || 'Untitled',
      p_bmd: source,
      p_search_text: searchTextFromBody(source),
      p_expected: expected,
    }),
  });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw fail(409, 'conflict');
  return {
    title: row.title || '',
    bmd: row.bmd || '',
    version: Number(row.version) || 1,
  };
}
