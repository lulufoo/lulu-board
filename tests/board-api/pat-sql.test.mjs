import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAT_TOKEN_RE } from '../../packages/board-api/src/pat-token.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sql = readFileSync(
  path.join(root, 'packages/board-api/sql/personal-access-tokens.sql'),
  'utf8'
);

assert.match(sql, /create table if not exists public\.personal_access_tokens/);
assert.match(sql, /user_id uuid not null references auth\.users/);
assert.match(sql, /\bname text not null/);
assert.match(sql, /\bprefix text not null/);
assert.match(sql, /\btoken_hash text not null/);
assert.match(sql, /\bexpires_at timestamptz not null/);
assert.match(sql, /\brevoked_at timestamptz/);
assert.doesNotMatch(sql, /\bplaintext\b|\bsecret text|\btoken text not null/);
assert.match(sql, /interval '90 days'/);
assert.match(sql, /enable row level security/);
assert.match(sql, /revoke all on table public\.personal_access_tokens from anon, authenticated/);
assert.doesNotMatch(sql, /grant (select|insert|update|delete) on table public\.personal_access_tokens to (anon|authenticated|public)/);

assert.match(sql, /function public\.create_personal_access_token/);
assert.match(sql, /function public\.list_personal_access_tokens/);
assert.match(sql, /function public\.revoke_personal_access_token/);
assert.match(sql, /function public\.read_owned_graph_with_pat/);
assert.match(sql, /security definer/);
assert.match(sql, /set search_path to ''/);
assert.doesNotMatch(sql, /p_user_id|p_owner_id|service_role/);

assert.match(sql, /v_uid := \(select auth\.uid\(\)\)/);
assert.match(sql, /p_expires_in_days < 1 or p_expires_in_days > 90/);
assert.match(sql, /extensions\.gen_random_bytes\(32\)/);
assert.match(sql, /token := v_token/);
{
  const start = sql.indexOf('function public.list_personal_access_tokens');
  const end = sql.indexOf('function public.revoke_personal_access_token');
  const listed = sql.slice(start, end);
  assert.match(listed, /t\.user_id = v_uid\s+and t\.revoked_at is null/);
  assert.doesNotMatch(listed, /token_hash|p_token|plaintext/);
}

assert.match(sql, /p_token !~ '\^lbp_\[0-9a-f\]\{64\}\$'/);
assert.equal(PAT_TOKEN_RE.source, '^lbp_[0-9a-f]{64}$');
assert.match(sql, /extensions\.digest\(p_token, 'sha256'\)/);
assert.match(sql, /t\.revoked_at is null\s+and t\.expires_at > now\(\)/);
assert.match(sql, /r\.owner_id = v_uid\s+and r\.graph_id = p_graph_id/);
assert.match(sql, /raise exception 'unauthorized' using errcode = '28000'/);
assert.match(sql, /raise exception 'cloud board not found' using errcode = 'P0002'/);
assert.doesNotMatch(sql, /raise exception[^;]*p_token/);

assert.match(sql, /revoke all on function public\.create_personal_access_token\(text, integer\) from public, anon;/);
assert.match(sql, /revoke all on function public\.list_personal_access_tokens\(\) from public, anon;/);
assert.match(sql, /revoke all on function public\.revoke_personal_access_token\(uuid\) from public, anon;/);
assert.match(sql, /grant execute on function public\.create_personal_access_token\(text, integer\) to authenticated;/);
assert.match(sql, /grant execute on function public\.list_personal_access_tokens\(\) to authenticated;/);
assert.match(sql, /grant execute on function public\.revoke_personal_access_token\(uuid\) to authenticated;/);
assert.match(sql, /grant execute on function public\.read_owned_graph_with_pat\(text, text\) to anon, authenticated;/);
assert.doesNotMatch(sql, /grant execute on function public\.create_personal_access_token[^;]*anon/);
assert.doesNotMatch(sql, /grant execute on function public\.list_personal_access_tokens[^;]*anon/);
assert.doesNotMatch(sql, /grant execute on function public\.revoke_personal_access_token[^;]*anon/);

console.log('ok pat sql');
