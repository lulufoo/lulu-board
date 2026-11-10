/* Read one owned graph with the caller JWT, or with a PAT through the definer RPC. */

import { assertGraphId } from '../../board-core/document-format.js';
import { fail, restJson } from './owned-graph.js';

const SELECT = 'graph_id,title,bmd,version,share_id,created_at,updated_at,group_id';
const PUBLIC_WEB_ORIGIN = 'https://luluboard.app';

function requireConfig(env) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
}

function graphId(diagramId) {
  try { return assertGraphId(diagramId); }
  catch (error) { throw fail(400, 'invalid_request', error.message); }
}

function firstGraph(rows) {
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw fail(404, 'not_found', 'Cloud diagram not found');
  return row;
}

export async function readOwnedGraph(env, token, diagramId) {
  requireConfig(env);
  const id = graphId(diagramId);
  const rows = await restJson(
    env,
    token,
    '/rest/v1/graphs?graph_id=eq.' + encodeURIComponent(id) + '&select=' + SELECT
  );
  return firstGraph(rows);
}

export async function readOwnedGraphWithPat(env, pat, diagramId) {
  requireConfig(env);
  const id = graphId(diagramId);
  const rows = await restJson(env, env.SUPABASE_PUBLISHABLE_KEY, '/rest/v1/rpc/read_owned_graph_with_pat', {
    method: 'POST',
    body: JSON.stringify({ p_token: pat, p_graph_id: id }),
  });
  const row = firstGraph(rows);
  return {
    diagram_id: row.graph_id,
    title: row.title || '',
    bmd: row.bmd || '',
    version: Number(row.version) || 1,
    updated_at: row.updated_at || '',
    group_id: row.group_id,
    url: PUBLIC_WEB_ORIGIN + '/#b:' + row.graph_id,
  };
}
