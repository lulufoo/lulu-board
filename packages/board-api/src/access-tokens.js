/* Issue, list, and revoke personal access tokens. The caller JWT is the DB role. */

import { fail, restJson } from './owned-graph.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertName(raw) {
  const name = String(raw == null ? '' : raw).trim();
  if (!name || name.length > 80) throw fail(400, 'invalid_request', 'invalid name');
  return name;
}

function assertDays(raw) {
  const days = Number(raw);
  if (!Number.isInteger(days) || days < 1 || days > 90) throw fail(400, 'invalid_request', 'invalid expiry');
  return days;
}

function assertTokenId(raw) {
  const id = String(raw || '').trim();
  if (!UUID_RE.test(id)) throw fail(400, 'invalid_request', 'invalid token id');
  return id;
}

function requireConfig(env) {
  if (!env || !env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    throw fail(500, 'db_error', 'missing supabase config');
  }
}

function firstRow(rows, missing) {
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) throw fail(500, 'db_error', missing);
  return row;
}

export async function createAccessToken(env, jwt, input) {
  requireConfig(env);
  const raw = input && typeof input === 'object' ? input : {};
  const rows = await restJson(env, jwt, '/rest/v1/rpc/create_personal_access_token', {
    method: 'POST',
    body: JSON.stringify({
      p_name: assertName(raw.name),
      p_expires_in_days: assertDays(raw.expires_in_days),
    }),
  });
  const row = firstRow(rows, 'create failed');
  if (!row.token) throw fail(500, 'db_error', 'create failed');
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    expires_at: row.expires_at,
    token: row.token,
  };
}

export async function listAccessTokens(env, jwt) {
  requireConfig(env);
  const rows = await restJson(env, jwt, '/rest/v1/rpc/list_personal_access_tokens', {
    method: 'POST',
    body: '{}',
  });
  return Array.isArray(rows) ? rows : [];
}

export async function revokeAccessToken(env, jwt, input) {
  requireConfig(env);
  const raw = input && typeof input === 'object' ? input : {};
  const rows = await restJson(env, jwt, '/rest/v1/rpc/revoke_personal_access_token', {
    method: 'POST',
    body: JSON.stringify({ p_id: assertTokenId(raw.id) }),
  });
  const row = firstRow(rows, 'revoke failed');
  return { id: row.id, revoked_at: row.revoked_at };
}
